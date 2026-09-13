import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// In-memory cache for API proxy rate limit defense
const serverCache = new Map<string, { data: any; expiry: number }>();

// In-memory store for XAUUSD signals
let xauusdSignals: any[] = [];
// Alert fatigue control (per session)
let notificationsSent = 0;
const MAX_NOTIFICATIONS = 20; // Cap notifications per session

function getCached(key: string) {
  const item = serverCache.get(key);
  if (item && item.expiry > Date.now()) {
    return item.data;
  }
  return null;
}

function setCached(key: string, data: any, ttlSeconds: number = 30) {
  serverCache.set(key, {
    data,
    expiry: Date.now() + ttlSeconds * 1000,
  });
}


// XAUUSD Webhook Endpoint (called by MT5 EA)
app.post('/api/signals/xauusd', async (req, res) => {
  const signal = req.body;
  if (!signal || !signal.action || !signal.price) {
    return res.status(400).json({ error: 'Invalid signal payload' });
  }

  const newSignal = {
    id: `xauusd-${Date.now()}`,
    timestamp: new Date().toISOString(),
    ...signal, // action, price, reason, timeframe, etc.
  };
  
  xauusdSignals.unshift(newSignal);
  // Keep only latest 100
  if (xauusdSignals.length > 100) xauusdSignals.pop();

  res.json({ success: true, signal: newSignal });
});

// Fetch XAUUSD Signals (called by frontend)
app.get('/api/signals/xauusd', (req, res) => {
  res.json(xauusdSignals);
});

// Health check endpoints for Cloud Run startup & liveness probes
app.get(['/api/health', '/health', '/_healthz', '/readyz'], (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    port: PORT,
    providers: {
      finnhub: !!process.env.FINNHUB_API_KEY,
    },
  });
});

// Proxy for Market Quote (Finnhub with automatic live Yahoo Finance fallback)
app.get('/api/market/quote/:ticker', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase().trim();
  const cacheKey = `quote_${ticker}`;
  const cached = getCached(cacheKey);

  if (cached) {
    return res.json(cached);
  }

  const isXAU = ticker === 'XAUUSD' || ticker === 'GOLD' || ticker === 'OANDA:XAU_USD' || ticker === 'OANDA:XAUUSD';

  // 1. Dedicated Real-Time Continuous Spot Gold Provider (XAUUSD / GOLD)
  if (isXAU) {
    // 1a. Primary: Bybit continuous linear spot gold (XAUUSDT)
    try {
      const bRes = await fetch('https://api.bybit.com/v5/market/tickers?category=linear&symbol=XAUUSDT');
      if (bRes.ok) {
        const bData = await bRes.json();
        const item = bData?.result?.list?.[0];
        if (item && item.lastPrice) {
          const price = Number(parseFloat(item.lastPrice).toFixed(2));
          const prevClose = Number(parseFloat(item.prevPrice24h || item.lastPrice).toFixed(2));
          const change = Number((price - prevClose).toFixed(2));
          const changePercent = prevClose > 0 ? Number(((change / prevClose) * 100).toFixed(2)) : 0;
          const formatted = {
            symbol: ticker,
            name: 'Gold / US Dollar Spot (XAU/USD)',
            price,
            change,
            changePercent,
            high: Number(parseFloat(item.highPrice24h || item.lastPrice).toFixed(2)),
            low: Number(parseFloat(item.lowPrice24h || item.lastPrice).toFixed(2)),
            open: Number(parseFloat(item.prevPrice1h || item.lastPrice).toFixed(2)),
            previousClose: prevClose,
            volume: Number(parseFloat(item.volume24h || '10000').toFixed(0)),
            high52W: 4600,
            low52W: 2800,
            currency: 'USD',
            exchange: 'SPOT_CFD',
            lastUpdated: new Date().toISOString(),
            source: 'LIVE_SPOT_BYBIT',
          };
          setCached(cacheKey, formatted, 5); // 5s cache for fast daytrading
          return res.json(formatted);
        }
      }
    } catch (err) {
      console.warn(`Bybit spot quote error for ${ticker}:`, err);
    }

    // 1b. Fallback: Binance PAXGUSDT (1 physical troy ounce fine gold)
    try {
      const binanceRes = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=PAXGUSDT');
      if (binanceRes.ok) {
        const item = await binanceRes.json();
        if (item && item.lastPrice) {
          const price = Number(parseFloat(item.lastPrice).toFixed(2));
          const prevClose = Number(parseFloat(item.prevClosePrice || item.lastPrice).toFixed(2));
          const change = Number((price - prevClose).toFixed(2));
          const changePercent = Number(parseFloat(item.priceChangePercent || '0').toFixed(2));
          const formatted = {
            symbol: ticker,
            name: 'Gold / US Dollar Spot (XAU/USD)',
            price,
            change,
            changePercent,
            high: Number(parseFloat(item.highPrice).toFixed(2)),
            low: Number(parseFloat(item.lowPrice).toFixed(2)),
            open: Number(parseFloat(item.openPrice).toFixed(2)),
            previousClose: prevClose,
            volume: Number(parseFloat(item.volume).toFixed(0)),
            high52W: 4600,
            low52W: 2800,
            currency: 'USD',
            exchange: 'SPOT_PAXG',
            lastUpdated: new Date().toISOString(),
            source: 'LIVE_SPOT_BINANCE',
          };
          setCached(cacheKey, formatted, 5);
          return res.json(formatted);
        }
      }
    } catch (err) {
      console.warn(`Binance PAXG quote error for ${ticker}:`, err);
    }
  }

  // 2. If Finnhub API Key is present, try Finnhub
  if (process.env.FINNHUB_API_KEY) {
    try {
      const response = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${process.env.FINNHUB_API_KEY}`
      );
      if (response.ok) {
        const fh = await response.json();
        if (fh.c && fh.c > 0) {
          const formatted = {
            symbol: ticker,
            price: Number(fh.c.toFixed(2)),
            change: Number((fh.d || 0).toFixed(2)),
            changePercent: Number((fh.dp || 0).toFixed(2)),
            high: Number((fh.h || fh.c).toFixed(2)),
            low: Number((fh.l || fh.c).toFixed(2)),
            open: Number((fh.o || fh.c).toFixed(2)),
            previousClose: Number((fh.pc || fh.c).toFixed(2)),
            lastUpdated: new Date().toISOString(),
            source: 'FINNHUB',
          };
          setCached(cacheKey, formatted, 20); // 20s cache
          return res.json(formatted);
        }
      }
    } catch (err) {
      console.warn(`Finnhub quote error for ${ticker}:`, err);
    }
  }

  // 2. Real-time Live Market Data Fallback (Yahoo Finance chart endpoint)
  try {
    const isXAU = ticker === 'XAUUSD' || ticker === 'GOLD';
    const yTicker = isXAU ? 'GC=F' : ticker.replace('.', '-');
    const yRes = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${yTicker}?interval=1d&range=1d`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (yRes.ok) {
      const yData = await yRes.json();
      const meta = yData?.chart?.result?.[0]?.meta;
      if (meta && (meta.regularMarketPrice || meta.chartPreviousClose)) {
        const price = meta.regularMarketPrice || meta.chartPreviousClose;
        const prevClose = meta.chartPreviousClose || price;
        const change = price - prevClose;
        const changePercent = meta.regularMarketChangePercent ?? (prevClose > 0 ? (change / prevClose) * 100 : 0);

        const formatted = {
          symbol: ticker,
          name: isXAU ? 'Gold / US Dollar Spot (XAU/USD)' : (meta.longName || meta.shortName || `${ticker} Corp`),
          price: Number(price.toFixed(2)),
          change: Number(change.toFixed(2)),
          changePercent: Number(changePercent.toFixed(2)),
          high: Number((meta.regularMarketDayHigh || price).toFixed(2)),
          low: Number((meta.regularMarketDayLow || price).toFixed(2)),
          open: Number((meta.regularMarketDayLow || price).toFixed(2)),
          previousClose: Number(prevClose.toFixed(2)),
          volume: meta.regularMarketVolume || 1000000,
          high52W: meta.fiftyTwoWeekHigh,
          low52W: meta.fiftyTwoWeekLow,
          currency: meta.currency || 'USD',
          exchange: meta.fullExchangeName || meta.exchangeName || 'US',
          lastUpdated: new Date().toISOString(),
          source: 'LIVE_YAHOO',
        };
        setCached(cacheKey, formatted, 30); // 30s cache
        return res.json(formatted);
      }
    }
  } catch (err) {
    console.warn(`Yahoo live quote error for ${ticker}:`, err);
  }

  // Return fallback indicator that client service should use local realistic feed
  return res.json({
    symbol: ticker,
    status: 'USE_CLIENT_SIM',
  });
});

// Clear server-side cache on demand
app.post('/api/market/cache/clear', (req, res) => {
  serverCache.clear();
  res.json({ success: true, message: 'Server cache cleared' });
});

// Proxy for Finnhub Candles (4H / 1D) with live market fallback and rate limit caching
app.get('/api/market/candles/:ticker', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase().trim();
  const resolution = (req.query.resolution as string) || 'D'; // 'D' for Daily, '240' for 4-Hour
  const cacheKey = `candles_${ticker}_${resolution}`;
  const cached = getCached(cacheKey);

  if (cached) {
    return res.json(cached);
  }

  const isXAU = ticker === 'XAUUSD' || ticker === 'GOLD' || ticker === 'OANDA:XAU_USD' || ticker === 'OANDA:XAUUSD';

  // 1. Dedicated Real-Time Continuous Spot Gold Candlestick Provider (XAUUSD / GOLD)
  if (isXAU) {
    const is5m = resolution === '5';
    const is15m = resolution === '15';
    const is30m = resolution === '30';
    const is60m = resolution === '60';
    const is4H = resolution === '240';
    const isD = resolution === 'D';

    let bybitInterval = '5';
    if (is15m) bybitInterval = '15';
    else if (is30m) bybitInterval = '30';
    else if (is60m) bybitInterval = '60';
    else if (is4H) bybitInterval = '240';
    else if (isD) bybitInterval = 'D';

    // 1a. Primary: Bybit XAUUSDT (Continuous spot gold)
    try {
      const bybitRes = await fetch(
        `https://api.bybit.com/v5/market/kline?category=linear&symbol=XAUUSDT&interval=${bybitInterval}&limit=200`
      );
      if (bybitRes.ok) {
        const bybitData = await bybitRes.json();
        const list = bybitData?.result?.list || [];
        if (list.length > 0) {
          const rawBars = list.map((item: any[]) => ({
            t: Math.floor(Number(item[0]) / 1000),
            o: Number(parseFloat(item[1]).toFixed(2)),
            h: Number(parseFloat(item[2]).toFixed(2)),
            l: Number(parseFloat(item[3]).toFixed(2)),
            c: Number(parseFloat(item[4]).toFixed(2)),
            v: Number(parseFloat(item[5]).toFixed(2)),
          })).sort((a: { t: number }, b: { t: number }) => a.t - b.t);

          const formatted = {
            s: 'ok',
            t: rawBars.map((b: { t: number }) => b.t),
            o: rawBars.map((b: { o: number }) => b.o),
            h: rawBars.map((b: { h: number }) => b.h),
            l: rawBars.map((b: { l: number }) => b.l),
            c: rawBars.map((b: { c: number }) => b.c),
            v: rawBars.map((b: { v: number }) => b.v),
            source: 'LIVE_BYBIT_SPOT',
          };
          const ttl = (is5m || is15m || is30m) ? 10 : 120; // 10s for active 5m/15m/30m daytrade scalping
          setCached(cacheKey, formatted, ttl);
          return res.json(formatted);
        }
      }
    } catch (err) {
      console.warn(`Bybit spot candle error for ${ticker}:`, err);
    }

    // 1b. Fallback: Binance PAXGUSDT (1 physical troy ounce gold)
    try {
      let binanceInterval = '5m';
      if (is15m) binanceInterval = '15m';
      else if (is30m) binanceInterval = '30m';
      else if (is60m) binanceInterval = '1h';
      else if (is4H) binanceInterval = '4h';
      else if (isD) binanceInterval = '1d';

      const bRes = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=PAXGUSDT&interval=${binanceInterval}&limit=200`
      );
      if (bRes.ok) {
        const list = await bRes.json();
        if (Array.isArray(list) && list.length > 0) {
          const rawBars = list.map((item: any[]) => ({
            t: Math.floor(Number(item[0]) / 1000),
            o: Number(parseFloat(item[1]).toFixed(2)),
            h: Number(parseFloat(item[2]).toFixed(2)),
            l: Number(parseFloat(item[3]).toFixed(2)),
            c: Number(parseFloat(item[4]).toFixed(2)),
            v: Number(parseFloat(item[5]).toFixed(2)),
          })).sort((a: { t: number }, b: { t: number }) => a.t - b.t);

          const formatted = {
            s: 'ok',
            t: rawBars.map((b: { t: number }) => b.t),
            o: rawBars.map((b: { o: number }) => b.o),
            h: rawBars.map((b: { h: number }) => b.h),
            l: rawBars.map((b: { l: number }) => b.l),
            c: rawBars.map((b: { c: number }) => b.c),
            v: rawBars.map((b: { v: number }) => b.v),
            source: 'LIVE_BINANCE_PAXG',
          };
          const ttl = (is5m || is15m) ? 10 : 120;
          setCached(cacheKey, formatted, ttl);
          return res.json(formatted);
        }
      }
    } catch (err) {
      console.warn(`Binance PAXG candle error for ${ticker}:`, err);
    }
  }

  // 2. Try Finnhub if API key is provided
  if (process.env.FINNHUB_API_KEY) {
    try {
      const nowSec = Math.floor(Date.now() / 1000);
      const is4H = resolution === '240';
      // 1 year back for Daily, 90 days for 4H/Intraday
      const lookbackSec = is4H ? 90 * 86400 : 365 * 86400;
      const fromSec = nowSec - lookbackSec;

      let fhData: any = null;

      if (is4H) {
        // First attempt direct resolution=240
        try {
          const directUrl = `https://finnhub.io/api/v1/stock/candle?symbol=${ticker}&resolution=240&from=${fromSec}&to=${nowSec}&token=${process.env.FINNHUB_API_KEY}`;
          const directRes = await fetch(directUrl);
          if (directRes.ok) {
            const parsed = await directRes.json();
            if (parsed.s === 'ok' && parsed.c && parsed.c.length > 0) {
              fhData = parsed;
            }
          }
        } catch (e) {
          console.warn(`Direct 240 Finnhub fetch failed for ${ticker}, trying 60m fallback:`, e);
        }

        // If direct 240 is not supported or returned no data, fetch 60m bars and aggregate 4:1 into 4H candles
        if (!fhData) {
          const hourlyUrl = `https://finnhub.io/api/v1/stock/candle?symbol=${ticker}&resolution=60&from=${fromSec}&to=${nowSec}&token=${process.env.FINNHUB_API_KEY}`;
          const hourlyRes = await fetch(hourlyUrl);
          if (hourlyRes.ok) {
            const raw60 = await hourlyRes.json();
            if (raw60.s === 'ok' && raw60.c && raw60.c.length > 0) {
              const bars60: Array<{ t: number; o: number; h: number; l: number; c: number; v: number }> = [];
              for (let i = 0; i < raw60.c.length; i++) {
                bars60.push({
                  t: raw60.t[i],
                  o: raw60.o[i],
                  h: raw60.h[i],
                  l: raw60.l[i],
                  c: raw60.c[i],
                  v: raw60.v[i] || 0,
                });
              }
              // Strictly sort chronologically (oldest to newest)
              bars60.sort((a, b) => a.t - b.t);

              const aggregated4H: Array<{ t: number; o: number; h: number; l: number; c: number; v: number }> = [];
              for (let i = 0; i < bars60.length; i += 4) {
                const chunk = bars60.slice(i, i + 4);
                if (chunk.length === 0) continue;
                aggregated4H.push({
                  t: chunk[chunk.length - 1].t,
                  o: chunk[0].o,
                  h: Math.max(...chunk.map(b => b.h)),
                  l: Math.min(...chunk.map(b => b.l)),
                  c: chunk[chunk.length - 1].c,
                  v: chunk.reduce((sum, b) => sum + b.v, 0),
                });
              }

              if (aggregated4H.length > 0) {
                fhData = {
                  s: 'ok',
                  t: aggregated4H.map(b => b.t),
                  o: aggregated4H.map(b => b.o),
                  h: aggregated4H.map(b => b.h),
                  l: aggregated4H.map(b => b.l),
                  c: aggregated4H.map(b => b.c),
                  v: aggregated4H.map(b => b.v),
                  source: 'FINNHUB_60_AGGREGATED_4H',
                };
              }
            }
          }
        }
      } else {
        // Daily resolution ('D')
        const url = `https://finnhub.io/api/v1/stock/candle?symbol=${ticker}&resolution=D&from=${fromSec}&to=${nowSec}&token=${process.env.FINNHUB_API_KEY}`;
        const response = await fetch(url);
        if (response.ok) {
          const parsed = await response.json();
          if (parsed.s === 'ok' && parsed.c && parsed.c.length > 0) {
            fhData = parsed;
          }
        }
      }

      if (fhData && fhData.s === 'ok' && fhData.c && fhData.c.length > 0) {
        // Sort final bars chronologically (oldest to newest)
        const sortedBars: Array<{ t: number; o: number; h: number; l: number; c: number; v: number }> = [];
        for (let i = 0; i < fhData.c.length; i++) {
          sortedBars.push({
            t: fhData.t[i],
            o: fhData.o[i],
            h: fhData.h[i],
            l: fhData.l[i],
            c: fhData.c[i],
            v: fhData.v[i] || 0,
          });
        }
        sortedBars.sort((a, b) => a.t - b.t);

        const formatted = {
          s: 'ok',
          t: sortedBars.map(b => b.t),
          o: sortedBars.map(b => b.o),
          h: sortedBars.map(b => b.h),
          l: sortedBars.map(b => b.l),
          c: sortedBars.map(b => b.c),
          v: sortedBars.map(b => b.v),
          source: fhData.source || `FINNHUB_${resolution}`,
        };

        // Cache for 5 minutes (300 seconds) to strictly protect Finnhub rate limits
        setCached(cacheKey, formatted, 300);
        return res.json(formatted);
      }
    } catch (err) {
      console.warn(`Finnhub candle fetch error for ${ticker}:`, err);
    }
  }

  // 2. Try Yahoo Finance historical candles
  try {
    const isXAU = ticker === 'XAUUSD' || ticker === 'GOLD';
    const yTicker = isXAU ? 'GC=F' : ticker.replace('.', '-');
    const is5m = resolution === '5';
    const is15m = resolution === '15';
    const is4H = resolution === '240';
    const is60m = resolution === '60';

    let range = '1y';
    let interval = '1d';
    if (is5m) {
      interval = '5m';
      range = '5d';
    } else if (is15m) {
      interval = '15m';
      range = '30d';
    } else if (is4H || is60m) {
      interval = '60m';
      range = '1mo';
    }

    const yRes = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${yTicker}?interval=${interval}&range=${range}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (yRes.ok) {
      const yData = await yRes.json();
      const result = yData?.chart?.result?.[0];
      const timestamps = result?.timestamp;
      const quote = result?.indicators?.quote?.[0];

      if (timestamps && quote && quote.close && quote.close.length > 0) {
        const rawBars: Array<{ t: number; o: number; h: number; l: number; c: number; v: number }> = [];
        for (let i = 0; i < timestamps.length; i++) {
          if (quote.close[i] != null && quote.open[i] != null) {
            rawBars.push({
              t: timestamps[i],
              o: Number(quote.open[i].toFixed(2)),
              h: Number(quote.high[i].toFixed(2)),
              l: Number(quote.low[i].toFixed(2)),
              c: Number(quote.close[i].toFixed(2)),
              v: quote.volume[i] || 0,
            });
          }
        }

        if (rawBars.length > 0) {
          // Strictly sort chronologically (oldest to newest)
          rawBars.sort((a, b) => a.t - b.t);

          let finalBars = rawBars;
          // If 4H requested and we have 60m bars from Yahoo, aggregate every 4 hourly bars into a 4H candle
          if (is4H) {
            finalBars = [];
            for (let i = 0; i < rawBars.length; i += 4) {
              const chunk = rawBars.slice(i, i + 4);
              if (chunk.length === 0) continue;
              const open = chunk[0].o;
              const close = chunk[chunk.length - 1].c;
              const high = Math.max(...chunk.map(b => b.h));
              const low = Math.min(...chunk.map(b => b.l));
              const volume = chunk.reduce((sum, b) => sum + b.v, 0);
              finalBars.push({
                t: chunk[chunk.length - 1].t,
                o: open,
                h: high,
                l: low,
                c: close,
                v: volume,
              });
            }
          }

          const formatted = {
            s: 'ok',
            t: finalBars.map(b => b.t),
            o: finalBars.map(b => b.o),
            h: finalBars.map(b => b.h),
            l: finalBars.map(b => b.l),
            c: finalBars.map(b => b.c),
            v: finalBars.map(b => b.v),
            source: is4H ? 'LIVE_YAHOO_4H' : 'LIVE_YAHOO',
          };
          setCached(cacheKey, formatted, 300); // 5 min cache
          return res.json(formatted);
        }
      }
    }
  } catch (err) {
    console.warn(`Yahoo live candle fetch error for ${ticker}:`, err);
  }

  return res.json({
    s: 'no_data',
    symbol: ticker,
  });
});

// Proxy for market news
app.get('/api/market/news', async (req, res) => {
  const cacheKey = 'market_news';
  const cached = getCached(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  if (process.env.FINNHUB_API_KEY) {
    try {
      const response = await fetch(
        `https://finnhub.io/api/v1/news?category=general&token=${process.env.FINNHUB_API_KEY}`
      );
      if (response.ok) {
        const news = await response.json();
        setCached(cacheKey, news, 120); // 2 min cache
        return res.json(news);
      }
    } catch (err) {
      console.warn('Finnhub news fetch error:', err);
    }
  }

  res.json([]);
});

async function startServer() {
  // Vite middleware for development (dynamically imported so production bundles don't require vite)
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = fs.existsSync(path.join(process.cwd(), 'dist'))
      ? path.join(process.cwd(), 'dist')
      : __dirname;
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Application build files not found.');
      }
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Retail Trader Dashboard server running on http://0.0.0.0:${PORT}`);
  });

  // If running in an environment (e.g. Cloud Run) where PORT is not 3000,
  // also attempt to listen on 3000 to satisfy any reverse proxy expecting port 3000.
  if (PORT !== 3000) {
    try {
      const secondaryServer = app.listen(3000, '0.0.0.0', () => {
        console.log(`Retail Trader Dashboard secondary listener running on http://0.0.0.0:3000`);
      });
      secondaryServer.on('error', (err: any) => {
        console.log(`Secondary port 3000 not bound (${err?.code || err?.message || err}), continuing on port ${PORT}`);
      });
    } catch (err) {
      console.log(`Could not bind secondary port 3000:`, err);
    }
  }

  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');
    server.close(() => {
      process.exit(0);
    });
  });
}

startServer();
