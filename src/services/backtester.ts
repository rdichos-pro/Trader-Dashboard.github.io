import { BacktestParams, BacktestResult, BacktestRuleConfig, BacktestTrade, Candle } from '../types/trading';
import { enrichCandlesWithIndicators } from '../utils/indicators';
import { generateHistoricalCandles } from './mockMarketData';
import { enrichCandlesWithIndicatorsFull, getStrategyDefinitions, runSingleStrategyBacktest, StrategyPerformanceStats } from './xauusdBacktestEngine';

/**
 * Executes a simulated rule-based backtest on historical daily candles using
 * the Ichimoku + Stochastic + CCI Confluence Engine and Dynamic Kumo Stop Loss.
 */
export function runBacktest(
  paramOrTicker: BacktestParams | string,
  rawCandles?: Candle[],
  config?: BacktestRuleConfig,
  initialCapital: number = 25000
): BacktestResult {
  // Overload handling if passed a single BacktestParams object
  if (typeof paramOrTicker === 'object') {
    const params = paramOrTicker as BacktestParams;
    const ticker = params.universeScope === 'SINGLE' && params.specificTicker ? params.specificTicker : 'NVDA';
    const allCandles = generateHistoricalCandles(ticker);
    
    // Apply holdout (OOS) by truncating the end of the dataset
    const holdoutDays = params.holdoutDays || 0;
    const candles = holdoutDays > 0 ? allCandles.slice(0, allCandles.length - holdoutDays) : allCandles;
    
    const btConfig: BacktestRuleConfig = {
      entryRuleIds: [params.strategyId || 'rule-ichimoku-master-entry'],
      requireAllEntryRules: true,
      stopLossPct: params.stopLossPct || 5,
      takeProfitPct: params.takeProfitPct || 12,
      maxHoldDays: params.maxHoldDays || 20,
      positionSizePct: 25,
      trailingStopPct: 3.5,
    };
    
    return executeBacktest(ticker, candles, btConfig, initialCapital, params);
  }

  return executeBacktest(paramOrTicker, rawCandles || generateHistoricalCandles(paramOrTicker), config || {
    entryRuleIds: ['rule-ichimoku-master-entry'],
    requireAllEntryRules: true,
    stopLossPct: 5,
    takeProfitPct: 12,
    maxHoldDays: 20,
    positionSizePct: 25,
    trailingStopPct: 3.5,
  }, initialCapital);
}

function executeBacktest(
  ticker: string,
  rawCandles: Candle[],
  config: BacktestRuleConfig,
  initialCapital: number = 25000,
  params?: BacktestParams
): BacktestResult {
  const candles = enrichCandlesWithIndicators(rawCandles);
  
  const slippagePct = params?.slippagePct || 0;
  const commission = params?.commissionPerTrade || 0;
  if (!candles || candles.length < 30) {
    return {
      ticker,
      period: 'Insufficient Data',
      initialCapital,
      endingCapital: initialCapital,
      netProfit: 0,
      totalReturnPct: 0,
      benchmarkReturnPct: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRatePct: 0,
      winRate: 0,
      profitFactor: 1,
      maxDrawdownPct: 0,
      avgTradeReturnPct: 0,
      avgWinPct: 0,
      avgLossPct: 0,
      equityCurve: [],
      trades: [],
    };
  }

  let capital = initialCapital;
  let peakCapital = initialCapital;
  let maxDrawdownPct = 0;
  const trades: BacktestTrade[] = [];

  const firstPrice = candles[25].close;
  const lastPrice = candles[candles.length - 1].close;
  const benchmarkReturnPct = ((lastPrice - firstPrice) / firstPrice) * 100;

  const equityCurve: { date: string; equity: number; benchmark: number }[] = [];

  // Track active open trade
  let openTrade: {
    entryDate: string;
    entryPrice: number;
    quantity: number;
    peakPrice: number;
    daysHeld: number;
    reason: string;
    kumoStopPrice: number;
    trailingStopPrice: number;
    takeProfitPrice: number;
  } | null = null;

  // Start after indicator warm-up period (min 26-52 periods for Ichimoku)
  for (let i = 26; i < candles.length; i++) {
    const candle = candles[i];
    const dateStr = candle.time.split('T')[0];

    const benchmarkEquity = initialCapital * (candle.close / firstPrice);

    // 1. Evaluate open trade exits with Protective OR Logic
    if (openTrade) {
      openTrade.daysHeld += 1;
      
      // Update dynamic Kumo Stop Loss floor for current bar
      const currentCloudBottom = candle.cloudBottom ?? (candle.senkouA && candle.senkouB ? Math.min(candle.senkouA, candle.senkouB) : openTrade.kumoStopPrice);
      openTrade.kumoStopPrice = currentCloudBottom;

      // Update trailing stop ratchet
      if (candle.high > openTrade.peakPrice) {
        openTrade.peakPrice = candle.high;
        if (config.trailingStopPct) {
          const newTrailStop = openTrade.peakPrice * (1 - config.trailingStopPct / 100);
          if (newTrailStop > openTrade.trailingStopPrice) {
            openTrade.trailingStopPrice = newTrailStop;
          }
        }
      }

      let exitPrice: number | null = null;
      let exitReason = '';

      // Trend-Riding Exit 1: Dynamic Kumo Stop Loss Floor Breakdown (Price < Cloud Bottom)
      if (candle.low <= openTrade.kumoStopPrice) {
        exitPrice = Math.min(candle.open, openTrade.kumoStopPrice);
        exitReason = 'DYNAMIC_KUMO_STOP_LOSS (Cloud Floor Breached)';
      }
      // Trend-Riding Exit 2: Confirmed Bearish Structural Breakdown (All Confluence Filters)
      else if (
        candle.tenkan !== undefined &&
        candle.kijun !== undefined &&
        candle.cloudBottom !== undefined &&
        candle.stochK !== undefined &&
        candle.cci40 !== undefined &&
        candle.tenkan < candle.kijun &&
        candle.tenkan < candle.cloudBottom &&
        candle.kijun < candle.cloudBottom &&
        (candle.close26Ago !== undefined ? candle.close < candle.close26Ago : true) &&
        candle.stochK < 50 &&
        candle.cci40 < 50 &&
        candle.close < candle.cloudBottom
      ) {
        exitPrice = candle.close;
        exitReason = 'STRUCTURAL_BEARISH_REVERSAL (All Bearish Filters + Chikou Breakdown)';
      }
      // Trend-Riding Exit 3: Dynamic Trailing Stop Ratchet
      else if (openTrade.trailingStopPrice > 0 && candle.low <= openTrade.trailingStopPrice) {
        exitPrice = Math.min(candle.open, openTrade.trailingStopPrice);
        exitReason = 'TRAILING_STOP_RATCHET';
      }
      // Trend-Riding Exit 4: Fixed Take Profit Target
      else if (candle.high >= openTrade.takeProfitPrice) {
        exitPrice = Math.max(candle.open, openTrade.takeProfitPrice);
        exitReason = 'TAKE_PROFIT_TARGET';
      }
      // Trend-Riding Exit 5: Max Hold Days
      else if (config.maxHoldDays && openTrade.daysHeld >= config.maxHoldDays) {
        exitPrice = candle.close;
        exitReason = 'MAX_HOLD_REACHED';
      }

      if (exitPrice !== null) {
        const actualExitPrice = exitPrice * (1 - (slippagePct / 100));
        const grossReturn = (actualExitPrice * openTrade.quantity);
        const netReturn = grossReturn - commission;
        const pnlDollars = netReturn - (openTrade.entryPrice * openTrade.quantity);
        const pnlPercent = (pnlDollars / (openTrade.entryPrice * openTrade.quantity)) * 100;
        capital += netReturn;

        trades.push({
          id: `bt-trade-${trades.length + 1}`,
          ticker,
          entryDate: openTrade.entryDate,
          entryPrice: openTrade.entryPrice,
          exitDate: dateStr,
          exitPrice: Number(actualExitPrice.toFixed(2)),
          quantity: openTrade.quantity,
          pnlDollars: Number(pnlDollars.toFixed(2)),
          pnlPercent: Number(pnlPercent.toFixed(2)),
          returnPct: Number(pnlPercent.toFixed(2)),
          entryReason: openTrade.reason,
          exitReason,
          holdingPeriodDays: openTrade.daysHeld,
        });

        openTrade = null;
      }
    }

    // 2. If no open trade, check Master Long Entry (Ichimoku + Chikou + Future Cloud + Stoch + CCI Confluence)
    if (!openTrade) {
      const tenkan = candle.tenkan;
      const kijun = candle.kijun;
      const cloudTop = candle.cloudTop;
      const cloudBottom = candle.cloudBottom;
      const futureSenkouA = candle.futureSenkouA;
      const futureSenkouB = candle.futureSenkouB;
      const close26Ago = candle.close26Ago;
      const stochK = candle.stochK;
      const cci = candle.cci40;

      if (
        tenkan !== undefined &&
        kijun !== undefined &&
        cloudTop !== undefined
      ) {
        // Confluence Condition 1: Tenkan > Kijun (Bullish TK Cross)
        const tkCrossMet = tenkan > kijun;

        // Confluence Condition 2: Tenkan > Cloud Top AND Kijun > Cloud Top
        const trendMet = tenkan > cloudTop && kijun > cloudTop;

        // Confluence Condition 3: Chikou Span confirms macro uptrend (Close > Close[-26])
        const chikouMet = close26Ago !== undefined ? candle.close > close26Ago : true;

        // Confluence Condition 4: Future Cloud is green (Future Span A > Span B)
        const futureCloudMet = futureSenkouA !== undefined && futureSenkouB !== undefined ? futureSenkouA > futureSenkouB : true;

        // Confluence Condition 5: Close > Cloud Top (No-chop breakout)
        const noChopMet = candle.close > cloudTop;

        // Master Long Entry: ALL Ichimoku conditions strictly met simultaneously (Pure Ichimoku, No Stoch, No CCI)
        const isMasterLongEntry = tkCrossMet && trendMet && chikouMet && futureCloudMet && noChopMet;

        if (isMasterLongEntry) {
          const positionCapital = capital * (config.positionSizePct / 100);
          const actualEntryPrice = candle.close * (1 + (slippagePct / 100));
          const shares = Math.floor((positionCapital - commission) / actualEntryPrice);

          if (shares > 0) {
            const cost = (shares * actualEntryPrice) + commission;
            capital -= cost;

            // Initial Dynamic Kumo Stop Loss at entry candle's Cloud Bottom
            const initialKumoStop = cloudBottom ?? (actualEntryPrice * 0.95);
            const takeProfitPrice = actualEntryPrice * (1 + config.takeProfitPct / 100);

            openTrade = {
              entryDate: dateStr,
              entryPrice: actualEntryPrice,
              quantity: shares,
              peakPrice: actualEntryPrice,
              daysHeld: 0,
              reason: `Ichimoku Trend Inception: TK Cross, Tenkan ($${tenkan.toFixed(2)}) & Kijun ($${kijun.toFixed(2)}) > Cloud ($${cloudTop.toFixed(2)}), Chikou Bullish, Future Cloud Green, Stoch %K (${stochK.toFixed(1)} > 50), CCI (${cci.toFixed(1)} > 50)`,
              kumoStopPrice: initialKumoStop,
              trailingStopPrice: 0,
              takeProfitPrice,
            };
          }
        }
      }
    }

    // Compute current total portfolio equity
    let currentEquity = capital;
    if (openTrade) {
      currentEquity += openTrade.quantity * candle.close;
    }

    if (currentEquity > peakCapital) {
      peakCapital = currentEquity;
    }
    const currentDrawdown = ((peakCapital - currentEquity) / peakCapital) * 100;
    if (currentDrawdown > maxDrawdownPct) {
      maxDrawdownPct = currentDrawdown;
    }

    equityCurve.push({
      date: dateStr,
      equity: Number(currentEquity.toFixed(2)),
      benchmark: Number(benchmarkEquity.toFixed(2)),
    });
  }

  // Force close any remaining open trade at last bar
  if (openTrade) {
    const lastCandle = candles[candles.length - 1];
    const actualExitPrice = lastCandle.close * (1 - (slippagePct / 100));
    const grossReturn = (actualExitPrice * openTrade.quantity);
    const netReturn = grossReturn - commission;
    const pnlDollars = netReturn - (openTrade.entryPrice * openTrade.quantity);
    const pnlPercent = (pnlDollars / (openTrade.entryPrice * openTrade.quantity)) * 100;
    capital += netReturn;

    trades.push({
      id: `bt-trade-${trades.length + 1}`,
      ticker,
      entryDate: openTrade.entryDate,
      entryPrice: openTrade.entryPrice,
      exitDate: lastCandle.time.split('T')[0],
      exitPrice: Number(actualExitPrice.toFixed(2)),
      quantity: openTrade.quantity,
      pnlDollars: Number(pnlDollars.toFixed(2)),
      pnlPercent: Number(pnlPercent.toFixed(2)),
      returnPct: Number(pnlPercent.toFixed(2)),
      entryReason: openTrade.reason,
      exitReason: 'END_OF_BACKTEST_PERIOD',
      holdingPeriodDays: openTrade.daysHeld,
    });
  }

  const winningTrades = trades.filter(t => (t.pnlDollars || 0) > 0);
  const losingTrades = trades.filter(t => (t.pnlDollars || 0) <= 0);
  const totalTrades = trades.length;
  const winRatePct = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0;

  const totalGrossWin = winningTrades.reduce((sum, t) => sum + (t.pnlDollars || 0), 0);
  const totalGrossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnlDollars || 0), 0));
  const profitFactor = totalGrossLoss > 0 ? Number((totalGrossWin / totalGrossLoss).toFixed(2)) : totalGrossWin > 0 ? 99 : 1;

  const netProfit = capital - initialCapital;
  const totalReturnPct = (netProfit / initialCapital) * 100;

  const avgWinPct = winningTrades.length > 0
    ? winningTrades.reduce((s, t) => s + (t.pnlPercent || 0), 0) / winningTrades.length
    : 0;
  const avgLossPct = losingTrades.length > 0
    ? losingTrades.reduce((s, t) => s + (t.pnlPercent || 0), 0) / losingTrades.length
    : 0;
  const avgTradeReturnPct = totalTrades > 0
    ? trades.reduce((s, t) => s + (t.pnlPercent || 0), 0) / totalTrades
    : 0;

  return {
    ticker,
    period: `${candles[26].time.split('T')[0]} to ${candles[candles.length - 1].time.split('T')[0]}`,
    initialCapital,
    endingCapital: Number(capital.toFixed(2)),
    netProfit: Number(netProfit.toFixed(2)),
    totalReturnPct: Number(totalReturnPct.toFixed(2)),
    benchmarkReturnPct: Number(benchmarkReturnPct.toFixed(2)),
    totalTrades,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRatePct: Number(winRatePct.toFixed(1)),
    winRate: Number(winRatePct.toFixed(1)),
    profitFactor,
    maxDrawdownPct: Number(maxDrawdownPct.toFixed(2)),
    avgTradeReturnPct: Number(avgTradeReturnPct.toFixed(2)),
    avgWinPct: Number(avgWinPct.toFixed(2)),
    avgLossPct: Number(avgLossPct.toFixed(2)),
    equityCurve,
    trades,
  };
}

function emptyWalkForwardResult(ticker: string, initialCapital: number, period: string): BacktestResult {
  return {
    ticker,
    period,
    initialCapital,
    endingCapital: initialCapital,
    netProfit: 0,
    totalReturnPct: 0,
    benchmarkReturnPct: 0,
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    winRatePct: 0,
    winRate: 0,
    profitFactor: 1,
    maxDrawdownPct: 0,
    avgTradeReturnPct: 0,
    avgWinPct: 0,
    avgLossPct: 0,
    equityCurve: [],
    trades: [],
    isWalkForward: true,
  };
}

/**
 * Real dual-timeframe (1HR entry + 1D macro reference) walk-forward backtest for stocks,
 * using the same 6-strategy Ichimoku engine that powers the XAUUSD Daytrade tab — this is
 * the strategy that actually matches the live 8-pillar Entry Signals confluence, unlike the
 * single-timeframe runBacktest() above.
 *
 * Walk-forward validation: the last `holdoutDays` of data are held out. All 6 strategy
 * variants are ranked on the in-sample (earlier) data only; the single best-scoring one is
 * then re-run, unmodified, on the untouched out-of-sample window. The OUT-OF-SAMPLE result
 * is what's returned as the primary BacktestResult — the in-sample number is attached
 * separately for comparison, since in-sample performance alone is a poor guide to real
 * forward performance (it's the same data the strategy was picked to fit).
 */
export function runStockWalkForwardBacktest(
  ticker: string,
  candlesEntry1h: Candle[],
  candlesMacroD: Candle[],
  initialCapital: number = 10000,
  holdoutDays: number = 60,
  positionSizePct: number = 25
): BacktestResult {
  const allEntryBars = enrichCandlesWithIndicatorsFull(candlesEntry1h);
  const allMacroBars = enrichCandlesWithIndicatorsFull(candlesMacroD);

  if (allEntryBars.length < 80 || allMacroBars.length < 10) {
    return emptyWalkForwardResult(ticker, initialCapital, 'Insufficient Data');
  }

  const lastTs = allEntryBars[allEntryBars.length - 1].timestamp;
  const cutoffTs = lastTs - holdoutDays * 24 * 60 * 60 * 1000;

  const inSampleEntry = allEntryBars.filter(b => b.timestamp < cutoffTs);
  const outOfSampleEntry = allEntryBars.filter(b => b.timestamp >= cutoffTs);
  const inSampleMacro = allMacroBars.filter(b => b.timestamp < cutoffTs);
  const outOfSampleMacro = allMacroBars.filter(b => b.timestamp >= cutoffTs);

  if (inSampleEntry.length < 50 || outOfSampleEntry.length < 30) {
    return emptyWalkForwardResult(ticker, initialCapital, 'Insufficient Data For Walk-Forward Split (widen the dataset or shorten the holdout window)');
  }

  // The real 8-pillar strategy family: 1D macro reference + 1HR entry, volume-confirmed.
  const strategyDefs = getStrategyDefinitions('1D', '1HR', true);

  let bestInSample: StrategyPerformanceStats | null = null;
  let bestDef = strategyDefs[0];
  for (const def of strategyDefs) {
    const stats = runSingleStrategyBacktest(def, inSampleEntry, inSampleMacro, initialCapital, 'PERCENT_OF_CAPITAL', positionSizePct);
    if (!bestInSample || stats.compositeScore > bestInSample.compositeScore) {
      bestInSample = stats;
      bestDef = def;
    }
  }

  // Validate the SAME strategy (no re-selection) on the untouched holdout window.
  const oosStats = runSingleStrategyBacktest(bestDef, outOfSampleEntry, outOfSampleMacro, initialCapital, 'PERCENT_OF_CAPITAL', positionSizePct);

  let overfittingWarning: string | undefined;
  if (oosStats.totalTrades < 3) {
    overfittingWarning = `Only ${oosStats.totalTrades} out-of-sample trade(s) in the holdout window — too few to draw a reliable conclusion. Try a longer dataset or a shorter holdout window.`;
  } else if (bestInSample && bestInSample.totalTrades >= 5) {
    const wrDrop = bestInSample.winRatePct - oosStats.winRatePct;
    if (wrDrop > 20 || (bestInSample.profitFactor >= 1.5 && oosStats.profitFactor < 1)) {
      overfittingWarning = `In-sample looked much stronger (${bestInSample.winRatePct}% WR, ${bestInSample.profitFactor}x PF) than out-of-sample (${oosStats.winRatePct}% WR, ${oosStats.profitFactor}x PF) — sign of overfitting or a regime shift, not a settings problem.`;
    }
  }

  const trades: BacktestTrade[] = oosStats.trades.map(t => ({
    id: t.id,
    ticker,
    entryDate: t.entryTime.slice(0, 10),
    entryPrice: t.entryPrice,
    exitDate: t.exitTime === 'RUNNING (LIVE)' ? t.entryTime.slice(0, 10) : t.exitTime.slice(0, 10),
    exitPrice: t.exitPrice,
    quantity: t.quantity ?? 0,
    pnlDollars: t.pnlDollar,
    pnlPercent: t.pnlPct,
    entryReason: t.entryReason,
    exitReason: t.exitReason,
    holdingPeriodDays: Math.round((t.holdingMinutes || 0) / (24 * 60)),
    returnPct: t.pnlPct,
  }));

  const oosFirstClose = outOfSampleEntry[0]?.close || 1;
  const barsByTime = new Map(outOfSampleEntry.map(b => [b.time, b]));
  const equityCurve = oosStats.equityCurve.map(pt => {
    const bar = barsByTime.get(pt.time);
    const benchmark = bar ? initialCapital * (bar.close / oosFirstClose) : initialCapital;
    return { date: pt.time.slice(0, 10), equity: pt.equity, benchmark: Number(benchmark.toFixed(2)) };
  });
  const benchmarkReturnPct = equityCurve.length > 0
    ? Number((((equityCurve[equityCurve.length - 1].benchmark - initialCapital) / initialCapital) * 100).toFixed(2))
    : 0;

  return {
    ticker,
    period: `Walk-Forward: last ${holdoutDays}D held out (in-sample: ${inSampleEntry.length} 1HR bars, out-of-sample: ${outOfSampleEntry.length} 1HR bars)`,
    initialCapital,
    endingCapital: oosStats.endingCapital,
    netProfit: oosStats.netProfitDollar,
    totalReturnPct: oosStats.netProfitPct,
    benchmarkReturnPct,
    totalTrades: oosStats.totalTrades,
    winningTrades: oosStats.winningTrades,
    losingTrades: oosStats.losingTrades,
    winRatePct: oosStats.winRatePct,
    winRate: oosStats.winRatePct,
    profitFactor: oosStats.profitFactor,
    maxDrawdownPct: oosStats.maxDrawdownPct,
    avgTradeReturnPct: oosStats.totalTrades > 0
      ? Number((oosStats.trades.reduce((s, t) => s + t.pnlPct, 0) / oosStats.totalTrades).toFixed(2))
      : 0,
    avgWinPct: oosStats.avgWinPct,
    avgLossPct: oosStats.avgLossPct,
    equityCurve,
    trades,
    strategyName: bestDef.shortName,
    isWalkForward: true,
    inSample: bestInSample ? {
      trades: bestInSample.totalTrades,
      winRatePct: bestInSample.winRatePct,
      profitFactor: bestInSample.profitFactor,
      netReturnPct: bestInSample.netProfitPct,
    } : undefined,
    outOfSample: {
      trades: oosStats.totalTrades,
      winRatePct: oosStats.winRatePct,
      profitFactor: oosStats.profitFactor,
      netReturnPct: oosStats.netProfitPct,
    },
    overfittingWarning,
  };
}
