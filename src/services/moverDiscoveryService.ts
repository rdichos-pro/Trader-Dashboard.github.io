import { Candle, GotradeMoverCandidate, TickerQuote } from '../types/trading';
import { marketDataService } from './marketDataService';
import { STOCK_UNIVERSE } from './mockMarketData';
import { evaluateConfluenceDetails } from './signalEngine';

export interface MoverScanOptions {
  watchlistSymbols?: string[];
  maxPrice?: number; // e.g. 25 for cheaper stocks
  minRvol?: number; // e.g. 1.2
  minConfluencePct?: number; // e.g. 60%
  onlyNonWatchlist?: boolean;
}

export class MoverDiscoveryService {
  /**
   * Discovers high-momentum Gotrade-style market movers and cheaper entry point stocks,
   * evaluating their technical confluence across the full universe.
   */
  public discoverGotradeMovers(options: MoverScanOptions = {}): GotradeMoverCandidate[] {
    const {
      watchlistSymbols = [],
      maxPrice = 1000,
      minRvol = 1.0,
      minConfluencePct = 0,
      onlyNonWatchlist = false,
    } = options;

    const watchlistSet = new Set(watchlistSymbols.map(s => s.toUpperCase()));
    const results: GotradeMoverCandidate[] = [];

    for (const profile of STOCK_UNIVERSE) {
      const symbol = profile.symbol.toUpperCase();
      if (symbol === 'SPY' || symbol === 'QQQ' || symbol === 'IWM' || symbol === 'XAUUSD') {
        continue; // Focus on individual mover stocks
      }

      const inWatchlist = watchlistSet.has(symbol);
      if (onlyNonWatchlist && inWatchlist) {
        continue;
      }

      // Fetch quote and candles
      let quote: TickerQuote | null = null;
      let candles: Candle[] = [];

      try {
        quote = marketDataService.getCachedQuote(symbol);
        candles = marketDataService.getCachedCandles(symbol, '240') || [];
      } catch {
        // Fallback
      }

      const currentPrice = quote?.price ?? profile.basePrice;
      if (currentPrice > maxPrice) {
        continue;
      }

      const rvol = quote?.rvol ?? 1.5;
      if (rvol < minRvol) {
        continue;
      }

      const changePercent = quote?.changePercent ?? 0;
      const floatShares = quote?.floatShares ?? profile.floatShares ?? 500000000;
      const isCheapGem = currentPrice < 25;
      const isLowFloat = floatShares < 100000000;

      // Evaluate strict Confluence Engine details
      let confluenceScore = 60;
      let confluencePassedCount = 5;
      let confluenceStage = 'CONSOLIDATION';

      if (candles && candles.length >= 52) {
        const confResult = evaluateConfluenceDetails(symbol, candles);
        confluencePassedCount = confResult.entryPassedCount;
        confluenceScore = Math.round((confResult.entryPassedCount / 8) * 100);
        confluenceStage = confResult.trendStage;
      } else {
        // Estimate based on price & moving structure
        if (isCheapGem && rvol > 1.8) {
          confluenceScore = 75;
          confluencePassedCount = 6;
          confluenceStage = 'APPROACHING_BUY';
        }
      }

      if (confluenceScore < minConfluencePct) {
        continue;
      }

      // Construct friendly Gotrade reason
      let reason = '';
      if (isCheapGem && confluenceScore >= 75) {
        reason = `Cheaper Entry ($${currentPrice.toFixed(2)}) with ${confluenceScore}% Confluence Breakout & ${rvol.toFixed(1)}x RVOL surge.`;
      } else if (isLowFloat && rvol >= 2.0) {
        reason = `Low-Float (${(floatShares / 1e6).toFixed(0)}M shares) volume explosion with active catalyst.`;
      } else if (confluenceScore >= 80) {
        reason = `High Confluence Trend Inception (${confluencePassedCount}/8 criteria met).`;
      } else if (Math.abs(changePercent) >= 5) {
        reason = `High Velocity Mover (${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(1)}% 4H gain).`;
      } else {
        reason = `Gotrade active mover coiling near Cloud support floor.`;
      }

      results.push({
        symbol,
        name: profile.name,
        price: Number(currentPrice.toFixed(2)),
        changePercent: Number(changePercent.toFixed(2)),
        rvol: Number(rvol.toFixed(2)),
        volume: quote?.volume ?? profile.avgVolume,
        marketCap: profile.marketCap,
        sector: profile.sector,
        isCheapGem,
        isLowFloat,
        confluenceScore,
        confluencePassedCount,
        confluenceStage,
        catalystHeadline: profile.catalyst?.headline,
        catalystType: profile.catalyst?.type,
        inWatchlist,
        discoveredAt: new Date().toISOString(),
        reason,
      });
    }

    // Sort by high confluence score first, then RVOL
    return results.sort((a, b) => {
      if (b.confluenceScore !== a.confluenceScore) {
        return b.confluenceScore - a.confluenceScore;
      }
      return b.rvol - a.rvol;
    });
  }

  /**
   * Scans non-watchlist tickers to see if any have reached high confluence
   * (e.g., >= 75% / 6 of 8 conditions) to qualify for auto-adding to the user's watchlist.
   */
  public findQualifyingAutoAddMovers(
    currentWatchlist: string[],
    confluenceThresholdPct: number = 75
  ): GotradeMoverCandidate[] {
    const nonWatchlistMovers = this.discoverGotradeMovers({
      watchlistSymbols: currentWatchlist,
      onlyNonWatchlist: true,
      minConfluencePct: confluenceThresholdPct,
    });

    return nonWatchlistMovers.filter(m => m.confluenceScore >= confluenceThresholdPct);
  }
}

export const moverDiscoveryService = new MoverDiscoveryService();
export type { GotradeMoverCandidate };
