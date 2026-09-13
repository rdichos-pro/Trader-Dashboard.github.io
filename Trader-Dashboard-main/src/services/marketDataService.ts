import { Candle, MarketStatus, NewsItem, TickerQuote } from '../types/trading';
import { enrichCandlesWithIndicators, parseFinnhubCandles } from '../utils/indicators';
import { buildTickerQuote, generateHistoricalCandles, INITIAL_NEWS_FEED, STOCK_UNIVERSE, StockProfile } from './mockMarketData';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  isStale?: boolean;
}

class MarketDataService {
  private quoteCache: Map<string, CacheEntry<TickerQuote>> = new Map();
  private candleCache: Map<string, CacheEntry<Candle[]>> = new Map();
  private universeCache: TickerQuote[] = [];
  private newsCache: NewsItem[] = [...INITIAL_NEWS_FEED];
  private isLiveSimActive: boolean = true;
  private listeners: Set<(quotes: TickerQuote[]) => void> = new Set();
  private lastScanTimestamp: number = 0;

  constructor() {
    this.initUniverse();
    this.startSimulationTick();
  }

  private initUniverse() {
    this.universeCache = STOCK_UNIVERSE.map(profile => {
      const candles4H = generateHistoricalCandles(profile.symbol, profile, '240');
      const candlesD = generateHistoricalCandles(profile.symbol, profile, 'D');
      const enriched4H = enrichCandlesWithIndicators(candles4H);
      const enrichedD = enrichCandlesWithIndicators(candlesD);
      const quote = buildTickerQuote(profile, enriched4H, enrichedD);

      this.quoteCache.set(profile.symbol, {
        data: quote,
        timestamp: 0,
        isStale: true,
      });
      this.candleCache.set(`${profile.symbol}_240`, {
        data: enriched4H,
        timestamp: 0,
        isStale: true,
      });
      this.candleCache.set(`${profile.symbol}_D`, {
        data: enrichedD,
        timestamp: 0,
        isStale: true,
      });
      return quote;
    });
  }

  public subscribe(listener: (quotes: TickerQuote[]) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach(cb => cb(this.universeCache));
  }

  /**
   * Periodically generates realistic micro-ticks for active watched tickers
   */
  private startSimulationTick() {
    setInterval(() => {
      if (!this.isLiveSimActive) return;

      let changed = false;
      this.universeCache = this.universeCache.map(quote => {
        // 35% chance to tick in this cycle
        if (Math.random() > 0.35) return quote;

        changed = true;
        const tickPct = (Math.random() - 0.495) * 0.003; // tiny realistic tick
        const newPrice = Number(Math.max(1, quote.price * (1 + tickPct)).toFixed(2));
        
        // 4H candle & day high/low updates
        const fourHourOpen = quote.fourHourOpen ?? quote.open ?? newPrice;
        const new4HLow = Math.min(quote.fourHourLow ?? quote.low ?? newPrice, newPrice);
        const new4HHigh = Math.max(quote.fourHourHigh ?? quote.high ?? newPrice, newPrice);
        const new4HChange = Number((newPrice - fourHourOpen).toFixed(2));
        const new4HChangePct = fourHourOpen > 0 ? Number(((new4HChange / fourHourOpen) * 100).toFixed(2)) : 0;

        const volIncrement = Math.floor(Math.random() * 15000 + 1000);
        const newVolume = quote.volume + volIncrement;
        const newRvol = quote.avgVolume30D > 0 ? Number((newVolume / (quote.avgVolume30D / 2)).toFixed(2)) : 1.0;

        // Keep 20D daily trend sparkline stable, update current value
        const updatedSparkline = quote.sparkline && quote.sparkline.length > 0 
          ? [...quote.sparkline.slice(0, -1), newPrice] 
          : [newPrice];

        // Keep 4H trend sparkline updated with live tick
        const updatedSparkline4H = quote.sparkline4H && quote.sparkline4H.length > 0
          ? [...quote.sparkline4H.slice(0, -1), newPrice]
          : [newPrice];

        const updatedQuote: TickerQuote = {
          ...quote,
          price: newPrice,
          high: new4HHigh,
          low: new4HLow,
          change: new4HChange,
          changePercent: new4HChangePct,
          fourHourHigh: new4HHigh,
          fourHourLow: new4HLow,
          fourHourOpen: fourHourOpen,
          fourHourChange: new4HChange,
          fourHourChangePercent: new4HChangePct,
          volume: newVolume,
          rvol: newRvol,
          sparkline: updatedSparkline,
          sparkline4H: updatedSparkline4H,
          lastUpdated: new Date().toISOString(),
          isStale: false,
        };

        this.quoteCache.set(quote.symbol, {
          data: updatedQuote,
          timestamp: Date.now(),
        });

        // Also update latest 4H candle in cache
        const cachedCandles = this.candleCache.get(`${quote.symbol}_240`);
        if (cachedCandles && cachedCandles.data.length > 0) {
          const candles = [...cachedCandles.data];
          const lastIndex = candles.length - 1;
          const lastCandle = { ...candles[lastIndex] };
          lastCandle.close = newPrice;
          lastCandle.high = Math.max(lastCandle.high, newPrice);
          lastCandle.low = Math.min(lastCandle.low, newPrice);
          lastCandle.volume = newVolume;
          candles[lastIndex] = lastCandle;

          this.candleCache.set(`${quote.symbol}_240`, {
            data: enrichCandlesWithIndicators(candles),
            timestamp: Date.now(),
          });
        }

        return updatedQuote;
      });

      if (changed) {
        this.notify();
      }
    }, 2800);
  }

  /**
   * Fetches latest quote for a symbol with fallback resilience
   */
  public async getQuote(symbol?: string): Promise<TickerQuote> {
    const cleanSym = (symbol || 'NVDA').toUpperCase().trim();
    const cached = this.quoteCache.get(cleanSym);

    // Try backend proxy for real-time live quotes (Finnhub or Yahoo Finance)
    try {
      const res = await fetch(`/api/market/quote/${cleanSym}`);
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data.price === 'number' && data.price > 0) {
          const fourHourLow = cached?.data.fourHourLow ?? data.low ?? data.price;
          const fourHourHigh = cached?.data.fourHourHigh ?? data.high ?? data.price;
          const fourHourOpen = cached?.data.fourHourOpen ?? data.open ?? data.price;
          const fourHourChange = cached?.data.fourHourChange ?? data.change ?? 0;
          const fourHourChangePercent = cached?.data.fourHourChangePercent ?? data.changePercent ?? 0;

          const updatedQuote: TickerQuote = {
            symbol: cleanSym,
            name: data.name || cached?.data.name || `${cleanSym} Corp`,
            price: data.price,
            change: fourHourChange,
            changePercent: fourHourChangePercent,
            open: data.open || data.price,
            high: Math.max(fourHourHigh, data.price),
            low: Math.min(fourHourLow, data.price),
            fourHourHigh: Math.max(fourHourHigh, data.price),
            fourHourLow: Math.min(fourHourLow, data.price),
            fourHourOpen: fourHourOpen,
            fourHourChange: fourHourChange,
            fourHourChangePercent: fourHourChangePercent,
            previousClose: data.previousClose || data.price,
            volume: data.volume || cached?.data.volume || 15000000,
            avgVolume30D: cached?.data.avgVolume30D || 12000000,
            rvol: cached?.data.rvol || 1.2,
            marketCap: cached?.data.marketCap || 5000000000,
            marketCapCategory: cached?.data.marketCapCategory || 'LARGE',
            high52W: data.high52W || cached?.data.high52W || data.price * 1.3,
            low52W: data.low52W || cached?.data.low52W || data.price * 0.7,
            sector: cached?.data.sector || 'Equities',
            sparkline: cached?.data.sparkline || [data.price * 0.98, data.price],
            lastUpdated: new Date().toISOString(),
          };
          this.quoteCache.set(cleanSym, { data: updatedQuote, timestamp: Date.now() });

          // Ensure it's in the universe cache
          const existingIdx = this.universeCache.findIndex(u => u.symbol === cleanSym);
          if (existingIdx >= 0) {
            this.universeCache[existingIdx] = updatedQuote;
          } else {
            this.universeCache.push(updatedQuote);
          }
          this.notify();
          return updatedQuote;
        }
      }
    } catch (err) {
      console.warn(`Quote fetch error for ${cleanSym}:`, err);
    }

    if (cached) {
      return cached.data;
    }

    // Generate ad-hoc profile for unknown ticker as last resort
    const profile: StockProfile = {
      symbol: cleanSym,
      name: `${cleanSym} Corp`,
      basePrice: 100.00,
      avgVolume: 12000000,
      marketCap: 15000000000,
      floatShares: 200000000,
      sector: 'Equities',
    };

    const candles4H = generateHistoricalCandles(cleanSym, profile, '240');
    const candlesD = generateHistoricalCandles(cleanSym, profile, 'D');
    const enriched4H = enrichCandlesWithIndicators(candles4H);
    const enrichedD = enrichCandlesWithIndicators(candlesD);
    const quote = buildTickerQuote(profile, enriched4H, enrichedD);

    this.quoteCache.set(cleanSym, { data: quote, timestamp: Date.now() });
    this.candleCache.set(`${cleanSym}_240`, { data: enriched4H, timestamp: Date.now() });
    this.candleCache.set(`${cleanSym}_D`, { data: enrichedD, timestamp: Date.now() });
    this.universeCache.push(quote);
    this.notify();
    return quote;
  }

  /**
   * Syncs real-time quotes in parallel for a batch of symbols (e.g. open positions & watchlist)
   */
  public async syncQuotesForSymbols(symbols: string[]): Promise<Map<string, TickerQuote>> {
    const results = new Map<string, TickerQuote>();
    if (!symbols || !Array.isArray(symbols)) return results;

    const unique = Array.from(new Set(symbols.map(s => (s || '').toUpperCase().trim()).filter(Boolean)));
    const promises = unique.map(async sym => {
      try {
        const q = await this.getQuote(sym);
        results.set(sym, q);
      } catch (err) {
        console.warn(`Failed syncing quote for ${sym}:`, err);
      }
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Fetches historical candles from Finnhub / local enriched cache for charting & indicator math
   */
  public async getCandles(
    symbol?: string, 
    timeframe: '1D' | '5D' | '1M' | '3M' | '6M' | '1Y' = '1Y',
    resolution: 'D' | '240' | '60' | '30' | '15' | '5' | '1' = '240',
    forceRefresh = false
  ): Promise<Candle[]> {
    const cleanSym = (symbol || 'NVDA').toUpperCase().trim();
    const cacheKey = `${cleanSym}_${resolution}`;
    const cached = this.candleCache.get(cacheKey);
    const isDaytrade = resolution === '1' || resolution === '5' || resolution === '15' || resolution === '30' || cleanSym === 'XAUUSD' || cleanSym === 'GOLD';
    const cacheTtlMs = isDaytrade ? 8 * 1000 : 5 * 60 * 1000;

    // Use fresh cached candles if available within throttling interval
    if (!forceRefresh && cached && (Date.now() - cached.timestamp < cacheTtlMs) && cached.data.length > 0) {
      return this.sliceTimeframe(cached.data, timeframe, resolution);
    }

    // Try fetching real Finnhub / spot provider OHLCV candles through proxy
    try {
      const res = await fetch(`/api/market/candles/${cleanSym}?resolution=${resolution}`);
      if (res.ok) {
        const raw = await res.json();
        if (raw && raw.s === 'ok' && raw.c && raw.c.length > 0) {
          // Parse raw Finnhub OHLCV array and enrich with pure indicator math
          const enriched = parseFinnhubCandles(raw);
          if (enriched.length > 0) {
            this.candleCache.set(cacheKey, { data: enriched, timestamp: Date.now() });
            return this.sliceTimeframe(enriched, timeframe, resolution);
          }
        }
      }
    } catch {
      // Fall through to local realistic generator
    }

    let allCandles: Candle[];
    if (cached && cached.data.length > 0) {
      allCandles = cached.data;
    } else {
      const generated = generateHistoricalCandles(cleanSym, undefined, resolution);
      allCandles = enrichCandlesWithIndicators(generated);
      this.candleCache.set(cacheKey, { data: allCandles, timestamp: Date.now() });
    }

    return this.sliceTimeframe(allCandles, timeframe, resolution);
  }

  /**
   * Aggregates lower-timeframe candles (e.g. 5m) into higher-timeframe candles (e.g. 30m or 15m)
   * Guaranteed to preserve exact timestamp and price boundary synchronization.
   */
  public aggregateCandles(candles: Candle[], targetMinutes = 30): Candle[] {
    if (!candles || candles.length === 0) return [];
    const targetMs = targetMinutes * 60 * 1000;
    const aggregated: Candle[] = [];

    let currentBucketTime = 0;
    let currentOpen = 0;
    let currentHigh = -Infinity;
    let currentLow = Infinity;
    let currentClose = 0;
    let currentVolume = 0;
    let bucketStarted = false;

    for (const c of candles) {
      const t = new Date(c.time).getTime();
      if (isNaN(t)) continue;
      const bucket = Math.floor(t / targetMs) * targetMs;

      if (!bucketStarted || bucket !== currentBucketTime) {
        if (bucketStarted) {
          const d = new Date(currentBucketTime);
          const timeStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
          aggregated.push({
            time: timeStr,
            open: Number(currentOpen.toFixed(2)),
            high: Number(currentHigh.toFixed(2)),
            low: Number(currentLow.toFixed(2)),
            close: Number(currentClose.toFixed(2)),
            volume: Math.round(currentVolume),
          });
        }
        currentBucketTime = bucket;
        currentOpen = c.open;
        currentHigh = c.high;
        currentLow = c.low;
        currentClose = c.close;
        currentVolume = c.volume;
        bucketStarted = true;
      } else {
        currentHigh = Math.max(currentHigh, c.high);
        currentLow = Math.min(currentLow, c.low);
        currentClose = c.close;
        currentVolume += c.volume;
      }
    }

    if (bucketStarted) {
      const d = new Date(currentBucketTime);
      const timeStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      aggregated.push({
        time: timeStr,
        open: Number(currentOpen.toFixed(2)),
        high: Number(currentHigh.toFixed(2)),
        low: Number(currentLow.toFixed(2)),
        close: Number(currentClose.toFixed(2)),
        volume: Math.round(currentVolume),
      });
    }

    return enrichCandlesWithIndicators(aggregated);
  }

  private sliceTimeframe(candles: Candle[], timeframe: '1D' | '5D' | '1M' | '3M' | '6M' | '1Y', resolution?: string): Candle[] {
    if (resolution === '1') {
      if (timeframe === '1D') return candles.slice(-1440); // 1 day = 1440 1m bars
      if (timeframe === '5D') return candles.slice(-7200); // 5 trading days = 7200 bars
      if (timeframe === '1M') return candles.slice(-32000); // 1 month of 1m bars (~32,000 bars)
      return candles;
    }
    if (resolution === '5') {
      if (timeframe === '1D') return candles.slice(-288);
      if (timeframe === '5D') return candles.slice(-1440); // 5 trading days = 1440 bars
      if (timeframe === '1M') return candles.slice(-6000); // ~21 trading days = ~6000 bars
      if (timeframe === '3M') return candles.slice(-18500); // ~65 trading days (>3.2 months) = 18500 bars
      return candles;
    }
    if (resolution === '15') {
      if (timeframe === '1D') return candles.slice(-96);
      if (timeframe === '5D') return candles.slice(-480); // 5 trading days = 480 bars
      if (timeframe === '1M') return candles.slice(-2000);
      if (timeframe === '3M') return candles.slice(-6500); // >3.3 months = 6500 bars
      return candles;
    }
    if (resolution === '30') {
      if (timeframe === '1D') return candles.slice(-48);
      if (timeframe === '5D') return candles.slice(-240); // 5 trading days = 240 bars
      if (timeframe === '1M') return candles.slice(-1000);
      if (timeframe === '3M') return candles.slice(-3300); // ~68 trading days (>3.3 months)
      return candles;
    }
    if (resolution === '60') {
      if (timeframe === '1D') return candles.slice(-24);
      if (timeframe === '5D') return candles.slice(-120);
      if (timeframe === '1M') return candles.slice(-500);
      if (timeframe === '3M') return candles.slice(-1650); // >3.4 months
      return candles;
    }
    if (timeframe === '1D') {
      return candles.slice(-15);
    } else if (timeframe === '5D') {
      return candles.slice(-30);
    } else if (timeframe === '1M') {
      return candles.slice(-45);
    } else if (timeframe === '3M') {
      return candles.slice(-90);
    } else if (timeframe === '6M') {
      return candles.slice(-130);
    }
    return candles;
  }

  /**
   * Hybrid Dual Timeframe Fetching for Watchlist:
   * - Fetches 4H candles (resolution '240') for primary indicator evaluation & 4H range
   * - Fetches Daily candles (resolution 'D') strictly to populate 20D Trend sparklines
   * - Uses Promise.all with rate-limit protection batching (chunks of 4 with small pacing)
   */
  public async fetchWatchlistHybridData(symbols: string[]): Promise<Map<string, { candles1H: Candle[]; candles4H: Candle[]; candlesDaily: Candle[] }>> {
    const results = new Map<string, { candles1H: Candle[]; candles4H: Candle[]; candlesDaily: Candle[] }>();
    if (!symbols || !Array.isArray(symbols)) return results;

    const unique = Array.from(new Set(symbols.map(s => (s || '').toUpperCase().trim()).filter(Boolean)));
    const BATCH_SIZE = 4;

    for (let i = 0; i < unique.length; i += BATCH_SIZE) {
      const batch = unique.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async sym => {
        try {
          // Parallel fetch of 1HR, 4H, and Daily candles
          const [c1H, c4H, cDaily] = await Promise.all([
            this.getCandles(sym, '1Y', '60'),
            this.getCandles(sym, '1Y', '240'),
            this.getCandles(sym, '1Y', 'D'),
          ]);

          results.set(sym, { candles1H: c1H, candles4H: c4H, candlesDaily: cDaily });

          // Update quote in cache with latest 4H and daily sparkline
          if (c4H.length > 0) {
            const last4H = c4H[c4H.length - 1];
            const prev4H = c4H[c4H.length - 2] || last4H;
            const dailyCloses = cDaily.map(d => d.close);
            const sparkline20D = dailyCloses.length > 0 ? dailyCloses.slice(-20) : [last4H.close];
            const closes4H = c4H.map(d => d.close);
            const sparkline4H = closes4H.length > 0 ? closes4H.slice(-20) : [last4H.close];

            const fourHourChange = Number((last4H.close - last4H.open).toFixed(2));
            const fourHourChangePercent = last4H.open > 0 
              ? Number(((fourHourChange / last4H.open) * 100).toFixed(2)) 
              : 0;

            const existingQuote = this.quoteCache.get(sym)?.data;
            const updatedQuote: TickerQuote = {
              symbol: sym,
              name: existingQuote?.name || `${sym} Corp`,
              price: last4H.close,
              change: fourHourChange,
              changePercent: fourHourChangePercent,
              open: last4H.open,
              high: last4H.high,
              low: last4H.low,
              fourHourHigh: last4H.high,
              fourHourLow: last4H.low,
              fourHourOpen: last4H.open,
              fourHourChange,
              fourHourChangePercent,
              previousClose: prev4H.close,
              volume: last4H.volume,
              avgVolume30D: existingQuote?.avgVolume30D || 15000000,
              rvol: existingQuote?.rvol || 1.2,
              marketCap: existingQuote?.marketCap || 10000000000,
              marketCapCategory: existingQuote?.marketCapCategory || 'LARGE',
              high52W: dailyCloses.length > 0 ? Math.max(...dailyCloses, last4H.close) : last4H.close,
              low52W: dailyCloses.length > 0 ? Math.min(...dailyCloses, last4H.close) : last4H.close,
              sector: existingQuote?.sector || 'Equities',
              catalyst: existingQuote?.catalyst,
              sparkline: sparkline20D,
              sparkline4H: sparkline4H,
              lastUpdated: new Date().toISOString(),
              isStale: false,
            };

            this.quoteCache.set(sym, { data: updatedQuote, timestamp: Date.now() });
            const uIdx = this.universeCache.findIndex(u => u.symbol === sym);
            if (uIdx >= 0) {
              this.universeCache[uIdx] = updatedQuote;
            } else {
              this.universeCache.push(updatedQuote);
            }
          }
        } catch (err) {
          console.warn(`Watchlist hybrid fetch failed for ${sym}:`, err);
        }
      });

      await Promise.all(batchPromises);
      this.notify();

      // Small 100ms pacing delay between batches if more symbols remain
      if (i + BATCH_SIZE < unique.length) {
        await new Promise(res => setTimeout(res, 100));
      }
    }

    this.lastScanTimestamp = Date.now();
    return results;
  }

  /**
   * Batch fetches and enriches candles for all watchlist tickers with rate-limit throttling (5-minute window)
   */
  public async fetchWatchlistData(symbols: string[]): Promise<Map<string, Candle[]>> {
    const hybridResults = await this.fetchWatchlistHybridData(symbols);
    const results = new Map<string, Candle[]>();
    hybridResults.forEach((val, sym) => {
      results.set(sym, val.candles4H);
    });
    return results;
  }

  /**
   * Clears all local in-memory candle and quote caches, triggers backend proxy cache wipe, and resets data
   */
  public async clearAllCacheAndReset(): Promise<void> {
    this.quoteCache.clear();
    this.candleCache.clear();
    this.universeCache = [];
    this.lastScanTimestamp = 0;

    try {
      await fetch('/api/market/cache/clear', { method: 'POST' });
    } catch (e) {
      console.warn('Backend cache clear failed:', e);
    }

    this.initUniverse();
    this.notify();
  }

  public getLastScanTimestamp(): number {
    return this.lastScanTimestamp;
  }

  public getCachedCandles(symbol?: string, resolution: 'D' | '240' | '60' | '30' | '15' | '5' | '1' | string = '240'): Candle[] | undefined {
    if (!symbol || typeof symbol !== 'string') return undefined;
    const clean = symbol.toUpperCase().trim();
    const resKey = resolution === '1h' ? '60' : resolution === '1d' ? 'D' : resolution;
    return this.candleCache.get(`${clean}_${resKey}`)?.data || this.candleCache.get(`${clean}_${resolution}`)?.data || this.candleCache.get(`${clean}_240`)?.data;
  }

  public getAllQuotes(): TickerQuote[] {
    return [...this.universeCache];
  }

  public getCachedQuote(symbol: string): TickerQuote | null {
    const cleanSym = symbol.toUpperCase().trim();
    return this.quoteCache.get(cleanSym)?.data ?? null;
  }

  public getUniverseQuotes(): TickerQuote[] {
    return [...this.universeCache];
  }

  public async getMarketNews(): Promise<NewsItem[]> {
    return [...this.newsCache];
  }

  public getNews(): NewsItem[] {
    return [...this.newsCache];
  }

  public async getMarketStatus(): Promise<MarketStatus> {
    return {
      isOpen: true,
      session: 'REGULAR',
      nextEvent: 'Market closes in 3h 45m',
      currentTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  }

  public addNewsItem(item: NewsItem) {
    this.newsCache.unshift(item);
    this.notify();
  }

  public toggleLiveSim(active: boolean) {
    this.isLiveSimActive = active;
  }
}

export const marketData = new MarketDataService();
export const marketDataService = marketData;
