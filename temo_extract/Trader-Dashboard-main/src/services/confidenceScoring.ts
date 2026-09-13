import { generateExtendedHistoricalCandles } from './mockMarketData';
import { runAllStrategiesBacktest } from './xauusdBacktestEngine';

export type ConfidenceGrade = 'HIGH' | 'MEDIUM' | 'LOW' | 'AVOID' | 'UNKNOWN';

export interface TickerConfidenceScore {
  ticker: string;
  grade: ConfidenceGrade;
  winRatePct: number;
  profitFactor: number;
  trades: number;
  strategyName: string;
  label: string;
}

// Session-lifetime cache: this backtest is not free to compute (6 strategies x ~270
// trading days of 1HR bars), so each ticker is only scored once per session.
const scoreCache = new Map<string, TickerConfidenceScore>();

/**
 * Grades how well the real 1D+1HR 8-pillar Ichimoku strategy family has historically
 * performed on a given ticker, using the same walk-forward-quality engine as the
 * Backtest tab. Used to flag tickers (like PLTR/SMCI in our own testing) where the
 * live signal fires but the strategy has no historical edge on that specific name.
 */
export function getTickerConfidenceScore(ticker: string): TickerConfidenceScore {
  const cached = scoreCache.get(ticker);
  if (cached) return cached;

  let result: TickerConfidenceScore;
  try {
    const candles1h = generateExtendedHistoricalCandles(ticker, '60', 270 * 24);
    const candlesD = generateExtendedHistoricalCandles(ticker, 'D', 350);
    const suite = runAllStrategiesBacktest(candles1h, candlesD, 10000, '1D', '1HR', 'PERCENT_OF_CAPITAL', true, 25);
    // Score against the flagship "1D TK Cross + 1HR Ichimoku" strategy specifically —
    // that's what the live Entry Signals alerts actually fire on. Grading against
    // whichever of the 6 variants backtests best would answer a different question
    // (does *some* Ichimoku variant work here) than what this badge is meant to convey
    // (should you trust the live signal on this ticker).
    const top = suite.rankedStrategies.find(s => s.id === 'strat-30m-tk-1m-ichimoku') || suite.topStrategy;

    if (!top || top.totalTrades < 5) {
      result = {
        ticker,
        grade: 'UNKNOWN',
        winRatePct: top?.winRatePct ?? 0,
        profitFactor: top?.profitFactor ?? 1,
        trades: top?.totalTrades ?? 0,
        strategyName: top?.shortName ?? 'N/A',
        label: 'Not enough historical signals yet to grade this ticker',
      };
    } else if (top.winRatePct >= 55 && top.profitFactor >= 2) {
      result = {
        ticker, grade: 'HIGH', winRatePct: top.winRatePct, profitFactor: top.profitFactor,
        trades: top.totalTrades, strategyName: top.shortName,
        label: `Strong historical fit: ${top.winRatePct}% win rate, ${top.profitFactor}x profit factor over ${top.totalTrades} trades (${top.shortName})`,
      };
    } else if (top.winRatePct >= 45 && top.profitFactor >= 1.2) {
      result = {
        ticker, grade: 'MEDIUM', winRatePct: top.winRatePct, profitFactor: top.profitFactor,
        trades: top.totalTrades, strategyName: top.shortName,
        label: `Moderate historical fit: ${top.winRatePct}% win rate, ${top.profitFactor}x profit factor over ${top.totalTrades} trades (${top.shortName})`,
      };
    } else if (top.profitFactor >= 1) {
      result = {
        ticker, grade: 'LOW', winRatePct: top.winRatePct, profitFactor: top.profitFactor,
        trades: top.totalTrades, strategyName: top.shortName,
        label: `Weak historical fit: ${top.winRatePct}% win rate, ${top.profitFactor}x profit factor over ${top.totalTrades} trades — marginal at best`,
      };
    } else {
      result = {
        ticker, grade: 'AVOID', winRatePct: top.winRatePct, profitFactor: top.profitFactor,
        trades: top.totalTrades, strategyName: top.shortName,
        label: `Historically a net loser here: ${top.winRatePct}% win rate, ${top.profitFactor}x profit factor over ${top.totalTrades} trades — this strategy has not worked on this ticker`,
      };
    }
  } catch {
    result = { ticker, grade: 'UNKNOWN', winRatePct: 0, profitFactor: 1, trades: 0, strategyName: 'N/A', label: 'Could not compute a confidence score for this ticker' };
  }

  scoreCache.set(ticker, result);
  return result;
}

export function clearConfidenceScoreCache(): void {
  scoreCache.clear();
}
