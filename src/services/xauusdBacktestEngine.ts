import { Candle } from '../types/trading';
import { calculateIchimoku, calculateStochastic, calculateCCI } from '../utils/indicators';

export interface IndicatorBar {
  time: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  tenkan: number;
  kijun: number;
  senkouA: number;
  senkouB: number;
  cloudTop: number;
  cloudBottom: number;
  chikou: number | undefined;
  futureSenkouA: number;
  futureSenkouB: number;
  stochK: number;
  stochD: number;
  cci: number;
  // 6 Pure Ichimoku Rules (Bullish / Buy)
  f1_tkCross: boolean;          // 1. Tenkan-sen >= Kijun-sen (Golden Cross)
  f2_priceAboveCloud: boolean;  // 2. Price (Close) > Cloud Top (Kumo Breakout)
  f3_tkAboveCloud: boolean;     // 3. Tenkan & Kijun > Cloud Top (Bullish Zone)
  f4_chikouBullish: boolean;    // 4. Chikou Macro Uptrend (Close > Close[-26])
  f5_futureCloudGreen: boolean; // 5. Future Kumo Green (Future Senkou A >= Senkou B)
  f6_kumoClearance: boolean;    // 6. Clean Kumo Clearance / No-Chop (Low >= Cloud Bottom)
  // Backward compatibility aliases
  f7_noChopAboveCloud: boolean; // Alias for f2_priceAboveCloud / f6_kumoClearance
  f8_notOverbought: boolean;    // Pure Ichimoku (always true)
  f5_stochBullish: boolean;     // Pure Ichimoku (always true)
  f6_cciBullish: boolean;       // Pure Ichimoku (always true)
  passedFiltersCount: number;   // 0 to 6 pure Ichimoku rules
  isFullBullish: boolean;       // All 6 Ichimoku rules passed

  // 6 Pure Ichimoku Rules (Bearish / Sell / Short)
  sf1_tkDeathCross: boolean;    // 1. Tenkan-sen <= Kijun-sen (Death Cross)
  sf2_priceBelowCloud: boolean; // 2. Price (Close) < Cloud Bottom (Kumo Breakdown)
  sf3_tkBelowCloud: boolean;    // 3. Tenkan & Kijun < Cloud Bottom (Bearish Zone)
  sf4_chikouBearish: boolean;   // 4. Chikou Macro Downtrend (Close < Close[-26])
  sf5_futureCloudRed: boolean;  // 5. Future Kumo Red (Future Senkou A < Senkou B)
  sf6_kumoClearance: boolean;   // 6. Clean Kumo Clearance below Cloud (High <= Cloud Top)
  // Backward compatibility aliases
  sf7_noChopBelowCloud: boolean;// Alias for sf2_priceBelowCloud
  sf8_notOversold: boolean;     // Pure Ichimoku (always true)
  sf5_stochBearish: boolean;    // Pure Ichimoku (always true)
  sf6_cciBearish: boolean;      // Pure Ichimoku (always true)
  passedSellFiltersCount: number; // 0 to 6 pure Ichimoku rules
  isFullBearish: boolean;       // All 6 Ichimoku rules passed

  // Consolidation / Chop status
  isInsideCloud: boolean;       // Close >= CloudBottom && Close <= CloudTop
  isConsolidation: boolean;     // Trapped in cloud or lack of trend clarity

  // Volume Confirmation (optional 8th pillar, opt-in via requireVolumeConfirmation)
  avgVolume20?: number;         // Trailing 20-bar average volume
  rvol?: number;                // This bar's volume relative to avgVolume20
  volumeConfirmed?: boolean;    // rvol >= 1.2x
}

export type MarketRegimeType = 'BUY' | 'SELL' | 'CONSOLIDATION';

export interface MultiTimeframeConfluenceState {
  time5m: string;
  time15m: string;
  timeTrend: string;
  time1h: string;
  time1d: string;
  entryTimeframe: '1M' | '1HR' | '5M';
  trendTimeframe: '30M' | '15M' | '1D';
  price: number;
  
  // Market Regime Overview
  marketRegime: MarketRegimeType;
  regimeLabel: string;
  regimeReason: string;

  // 1D (Daily) Macro Timeframe Tenkan-Kijun Crossover
  dailyTkCross: boolean;          // 1D Tenkan >= Kijun (Golden Cross)
  dailyTkDeathCross: boolean;     // 1D Tenkan <= Kijun (Death Cross)
  dailyTkBarsAgo: number;         // Days since last 1D crossover
  dailyTenkan: number;            // 1D Tenkan-sen value
  dailyKijun: number;             // 1D Kijun-sen value
  dailyCloudTop: number;
  dailyCloudBottom: number;
  bar1d: IndicatorBar;

  // 1HR Entry Timeframe Details (All Ichimoku Rules)
  bar1h: IndicatorBar;
  ichimoku1hRulesPassed: number;      // 0 to 6
  ichimoku1hSellRulesPassed: number;  // 0 to 6

  // 5M Details (Backwards compatible)
  bar5m: IndicatorBar;
  filters5mPassed: number; // Buy
  filters5mSellPassed: number; // Sell
  
  // Higher Timeframe (Backwards compatible)
  bar15m: IndicatorBar;
  filters15mPassed: number;
  filters15mSellPassed: number;
  barTrend: IndicatorBar;
  filtersTrendPassed: number;
  filtersTrendSellPassed: number;
  
  // Multi-Timeframe Combined Confluence (Buy): 1D TK Cross (1) + 1HR Ichimoku (6) = 7 Pillars
  totalPillarsPassed: number; // 0 to 7 (or 0-16 for legacy)
  dualBullishSync: boolean;   // 1D TK Cross + 1HR 6/6 rules
  alignmentScore: number;     // 0 - 100%

  // Multi-Timeframe Combined Confluence (Sell): 1D TK Death Cross (1) + 1HR Bearish Ichimoku (6) = 7 Pillars
  totalSellPillarsPassed: number; // 0 to 7
  dualBearishSync: boolean;   // 1D TK Death Cross + 1HR 6/6 bearish rules
  sellAlignmentScore: number; // 0 - 100%

  alignmentStatus: 
    | 'DUAL_MASTER_BUY'        // 1D TK Cross + 1HR 6/6 Ichimoku: Peak statistical edge
    | 'STRONG_BUY_SYNC'        // Strong alignment
    | '5M_SCALP_LEAD'          // 1HR Bullish, 1D still coiling
    | '15M_TREND_COILING'      // 1D Bullish, 1HR coiling
    | '30M_TREND_COILING'      
    | 'DUAL_MASTER_SELL'       // 1D TK Death Cross + 1HR 6/6 Bearish
    | 'STRONG_SELL_SYNC'       
    | '5M_SELL_LEAD'           
    | '15M_SELL_COILING'       
    | '30M_SELL_COILING'       
    | 'CHOP_CONSOLIDATION'     // Inside Cloud / Low momentum
    | 'DUAL_MASTER_EXIT'       
    | 'BEARISH_LEAD';
  guidance: string;

  // Buy Breakout Confirmation: Entry Must Be OVER Last 1HR Bar Close With All Confluences
  lastConfluenceBarClose: number;
  entryTriggerPrice: number;
  isEntryTriggered: boolean;
  entryConfirmationStatus: 'TRIGGERED_ABOVE_CLOSE' | 'WAITING_FOR_BREAKOUT' | 'NO_CONFLUENCE_SETUP';
  entryDiffDollar: number;

  // Sell Breakdown Confirmation: Entry Must Be UNDER Last 1HR Bar Close With All Sell Confluences
  lastSellConfluenceBarClose: number;
  sellTriggerPrice: number;
  isSellEntryTriggered: boolean;
  sellConfirmationStatus: 'TRIGGERED_BELOW_CLOSE' | 'WAITING_FOR_BREAKDOWN' | 'NO_SELL_SETUP';
  sellDiffDollar: number;

  // Exit Signal: Trigger below the first closed bar after the reversal cross (Tenkan < Kijun)
  hasReversalCross: boolean;
  reversalCrossBarTime: string;
  reversalCrossBarClose: number;
  exitTriggerPrice: number;
  isExitTriggered: boolean;
  exitConfirmationStatus: 'TRIGGERED_BELOW_REVERSAL_CLOSE' | 'AWAITING_BREAKDOWN_BELOW_REVERSAL_CLOSE' | 'NO_REVERSAL_CROSS';
  exitDiffDollar: number;
}

export interface FastTkSignalState {
  time: string;
  price: number;
  tenkan: number;
  kijun: number;
  tkCross: boolean; // Tenkan >= Kijun
  tkDeathCross: boolean; // Tenkan <= Kijun
  cci: number;
  cciBullish: boolean; // CCI >= 50
  cciBearish: boolean; // CCI <= -50
  marketRegime: MarketRegimeType;
  alignmentStatus: 
    | 'FAST_TK_BUY'             // Tenkan > Kijun + CCI > 50 (Active Signal)
    | 'WAITING_CCI_VELOCITY'    // Tenkan > Kijun, but CCI < 50
    | 'WAITING_TK_CROSS'        // Coiling / Consolidating
    | 'FAST_TK_SELL'            // Tenkan < Kijun + CCI < -50 (Active Short Signal)
    | 'WAITING_CCI_SELL_VELOCITY' // Tenkan < Kijun, but CCI > -50
    | 'FAST_TK_EXIT';           // Breakdown exit
  alignmentScore: number;       // 0 - 100%
  guidance: string;

  // Buy Side
  lastSignalBarClose: number;
  entryTriggerPrice: number;
  isEntryTriggered: boolean;
  entryConfirmationStatus: 'TRIGGERED_ABOVE_CLOSE' | 'WAITING_FOR_BREAKOUT' | 'NO_SIGNAL_SETUP';
  entryDiffDollar: number;

  // Sell Side
  lastSellSignalBarClose: number;
  sellTriggerPrice: number;
  isSellEntryTriggered: boolean;
  sellConfirmationStatus: 'TRIGGERED_BELOW_CLOSE' | 'WAITING_FOR_BREAKDOWN' | 'NO_SIGNAL_SETUP';
  sellDiffDollar: number;

  // Exit Signal Confirmation
  hasReversalCross: boolean;
  reversalCrossBarTime: string;
  reversalCrossBarClose: number;
  exitTriggerPrice: number;
  isExitTriggered: boolean;
  exitConfirmationStatus: 'TRIGGERED_BELOW_REVERSAL_CLOSE' | 'AWAITING_BREAKDOWN_BELOW_REVERSAL_CLOSE' | 'NO_REVERSAL_CROSS';
  exitDiffDollar: number;
}

export interface BacktestTradeRecord {
  id: string;
  strategyId: string;
  entryIndex: number;
  entryTime: string;
  entryPrice: number;
  stopLossPrice?: number;
  targetPrice?: number;
  quantity?: number;
  isRunning?: boolean;
  exitIndex: number;
  exitTime: string;
  exitPrice: number;
  direction: 'LONG' | 'SHORT';
  pnlDollar: number;
  pnlPct: number;
  holdingBars: number;
  holdingMinutes: number;
  isWin: boolean;
  entryReason: string;
  exitReason: string;
}

export interface StrategyPerformanceStats {
  id: string;
  name: string;
  shortName: string;
  description: string;
  indicatorsUsed: string[];
  timeframeTag: '1HR' | '1D' | 'DUAL (1HR+1D)' | '5M' | '15M' | '30M' | 'DUAL (5M+15M)' | 'DUAL (5M+30M)' | string;
  
  // Performance metrics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRatePct: number;
  profitFactor: number;
  netProfitDollar: number;
  netProfitPct: number;
  initialCapital: number;
  endingCapital: number;
  
  // Risk & Distribution
  avgWinPct: number;
  avgLossPct: number;
  winLossRatio: number;
  maxDrawdownPct: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  avgHoldingBars: number;
  avgHoldingMinutes: number;
  expectancyDollar: number;
  
  // Ranking Score (combines Win Rate, Profit Factor, Net Profit & Drawdown safety)
  compositeScore: number;
  rank: number;
  
  // Day-by-Day Performance Breakdown (e.g. Mon-Fri)
  dailyBreakdown: DailyBreakdownStat[];
  // Month-by-Month Performance Breakdown (e.g. for 3+ months backtest)
  monthlyBreakdown: MonthlyBreakdownStat[];

  // Trade Log & Curves
  trades: BacktestTradeRecord[];
  equityCurve: Array<{ time: string; equity: number }>;
}

export interface MonthlyBreakdownStat {
  monthKey: string;
  monthName: string;
  tradesCount: number;
  wins: number;
  losses: number;
  winRatePct: number;
  pnlDollar: number;
  profitFactor: number;
}

export interface DailyBreakdownStat {
  date: string;
  dayName: string;
  formattedDate: string;
  tradesCount: number;
  wins: number;
  losses: number;
  winRatePct: number;
  pnlDollar: number;
  profitFactor: number;
}

export interface BacktestSuiteResult {
  rankedStrategies: StrategyPerformanceStats[];
  topStrategy: StrategyPerformanceStats;
  summary: string;
  periodLabel: string;
  startDate: string;
  endDate: string;
  totalBars5m: number;
  totalBars15m: number;
  totalBarsTrend: number;
  trendTimeframe: '15M' | '30M' | '1D' | string;
}

/**
 * Pre-computes indicator series for candles array
 */
export function enrichCandlesWithIndicatorsFull(candles: Candle[]): IndicatorBar[] {
  if (!candles || candles.length === 0) return [];
  const len = candles.length;
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const closes = candles.map(c => c.close);

  const ichimoku = calculateIchimoku(highs, lows, closes, 9, 26, 52, 26);
  // Stoch 14, 3, 3 and CCI 20 close match standard TradingView indicator settings (as seen on chart)
  const stoch = calculateStochastic(highs, lows, closes, 14, 3, 3);
  const cci = calculateCCI(highs, lows, closes, 20);

  const result: IndicatorBar[] = [];

  for (let i = 0; i < len; i++) {
    const c = candles[i];
    const tVal = ichimoku.tenkan[i] ?? c.close;
    const kVal = ichimoku.kijun[i] ?? c.close;
    const sA = ichimoku.senkouA[i] ?? c.close;
    const sB = ichimoku.senkouB[i] ?? c.close;
    const cTop = ichimoku.cloudTop[i] ?? Math.max(sA, sB);
    const cBot = ichimoku.cloudBottom[i] ?? Math.min(sA, sB);
    const ch = ichimoku.chikou[i];
    const futA = ichimoku.rawSenkouA[i] ?? sA;
    const futB = ichimoku.rawSenkouB[i] ?? sB;
    const sk = stoch.stochK[i] ?? 50;
    const sd = stoch.stochD[i] ?? 50;
    const cc = cci[i] ?? 0;

    // 6 Pure Ichimoku Rules (Bullish / Buy)
    // 1. Tenkan-sen >= Kijun-sen (Golden Cross)
    const f1 = tVal >= kVal;
    // 2. Price (Close) > Cloud Top (Kumo Breakout)
    const f2 = c.close > cTop;
    // 3. Tenkan & Kijun > Cloud Top (Bullish Zone)
    const f3 = tVal >= cTop && kVal >= cTop;
    // 4. Chikou Macro Uptrend (Close > Close[-26])
    const past26Close = i >= 26 ? closes[i - 26] : closes[0];
    const f4 = c.close > past26Close;
    // 5. Future Kumo Green (Future Senkou A >= Senkou B)
    const f5 = futA >= futB;
    // 6. Clean Kumo Clearance / No-Chop (Low >= Cloud Bottom)
    const f6 = c.low >= cBot;

    // Pure Ichimoku Count: 0 to 6
    const count = (f1 ? 1 : 0) + (f2 ? 1 : 0) + (f3 ? 1 : 0) + (f4 ? 1 : 0) + (f5 ? 1 : 0) + (f6 ? 1 : 0);

    // 6 Pure Ichimoku Rules (Bearish / Sell / Short)
    // 1. Tenkan-sen <= Kijun-sen (Death Cross)
    const sf1 = tVal <= kVal;
    // 2. Price (Close) < Cloud Bottom (Kumo Breakdown)
    const sf2 = c.close < cBot;
    // 3. Tenkan & Kijun < Cloud Bottom (Bearish Zone)
    const sf3 = tVal <= cBot && kVal <= cBot;
    // 4. Chikou Macro Downtrend (Close < Close[-26])
    const sf4 = c.close < past26Close;
    // 5. Future Kumo Red (Future Senkou A < Senkou B)
    const sf5 = futA < futB;
    // 6. Clean Kumo Breakdown Clearance (High <= Cloud Top)
    const sf6 = c.high <= cTop;

    // Pure Ichimoku Sell Count: 0 to 6
    const sellCount = (sf1 ? 1 : 0) + (sf2 ? 1 : 0) + (sf3 ? 1 : 0) + (sf4 ? 1 : 0) + (sf5 ? 1 : 0) + (sf6 ? 1 : 0);

    const isInsideCloud = c.close >= cBot && c.close <= cTop;
    const isConsolidation = isInsideCloud || (!f2 && !sf2) || (count < 4 && sellCount < 4);

    const isFullBullish = count === 6;
    const isFullBearish = sellCount === 6 || ((tVal < kVal) && (c.close < cBot) && sf4);

    // Volume Confirmation: this bar's volume vs the trailing 20-bar average
    const volWindowStart = Math.max(0, i - 20);
    const trailingVols = candles.slice(volWindowStart, i).map(cc => cc.volume || 0).filter(v => v > 0);
    const avgVolume20 = trailingVols.length > 0
      ? trailingVols.reduce((a, b) => a + b, 0) / trailingVols.length
      : (c.volume || 0);
    const rvol = avgVolume20 > 0 ? (c.volume || 0) / avgVolume20 : 1;
    const volumeConfirmed = rvol >= 1.2;

    const parsedTime = typeof c.time === 'string' ? c.time : new Date(c.time * 1000).toISOString();
    const ts = typeof c.time === 'string' ? new Date(c.time).getTime() : c.time * 1000;

    result.push({
      time: parsedTime,
      timestamp: isNaN(ts) ? i * 300000 : ts,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume || 1000,
      tenkan: tVal,
      kijun: kVal,
      senkouA: sA,
      senkouB: sB,
      cloudTop: cTop,
      cloudBottom: cBot,
      chikou: ch,
      futureSenkouA: futA,
      futureSenkouB: futB,
      stochK: sk,
      stochD: sd,
      cci: cc,
      f1_tkCross: f1,
      f2_priceAboveCloud: f2,
      f3_tkAboveCloud: f3,
      f4_chikouBullish: f4,
      f5_futureCloudGreen: f5,
      f6_kumoClearance: f6,
      f7_noChopAboveCloud: f2,
      f8_notOverbought: true,
      f5_stochBullish: true,
      f6_cciBullish: true,
      passedFiltersCount: count,
      isFullBullish,
      sf1_tkDeathCross: sf1,
      sf2_priceBelowCloud: sf2,
      sf3_tkBelowCloud: sf3,
      sf4_chikouBearish: sf4,
      sf5_futureCloudRed: sf5,
      sf6_kumoClearance: sf6,
      sf7_noChopBelowCloud: sf2,
      sf8_notOversold: true,
      sf5_stochBearish: true,
      sf6_cciBearish: true,
      passedSellFiltersCount: sellCount,
      isFullBearish,
      isInsideCloud,
      isConsolidation,
      avgVolume20,
      rvol,
      volumeConfirmed,
    });
  }

  return result;
}

/**
 * Calculates Multi-Timeframe Confluence State (1HR Entry + 1D Daily Tenkan-Kijun Crossover)
 * All Ichimoku rules evaluated on 1HR closed candles, with 1D Daily TK Crossover requirement.
 * 100% Pure Ichimoku Kinko Hyo: No Stochastic, No CCI.
 */
export function evaluateMultiTimeframeConfluence(
  candlesEntry: Candle[],
  candlesMacro: Candle[],
  entryTfLabel: string = '1M',
  macroTfLabel: string = '30M'
): MultiTimeframeConfluenceState {
  const barsEntry = enrichCandlesWithIndicatorsFull(candlesEntry);
  const barsMacro = enrichCandlesWithIndicatorsFull(candlesMacro);

  const fallbackTrendTf: '1D' | '15M' | '30M' = macroTfLabel === '15M' ? '15M' : macroTfLabel === '1D' ? '1D' : '30M';
  const resolvedEntryTf: '1M' | '1HR' | '5M' = entryTfLabel === '1HR' ? '1HR' : entryTfLabel === '5M' ? '5M' : '1M';

  if (barsEntry.length === 0 || barsMacro.length === 0) {
    const dummyBar: IndicatorBar = {
      time: 'INITIALIZING',
      timestamp: 0,
      open: 2500,
      high: 2500,
      low: 2500,
      close: 2500,
      volume: 0,
      tenkan: 2500,
      kijun: 2500,
      senkouA: 2500,
      senkouB: 2500,
      cloudTop: 2500,
      cloudBottom: 2500,
      chikou: 2500,
      futureSenkouA: 2500,
      futureSenkouB: 2500,
      stochK: 50,
      stochD: 50,
      cci: 0,
      f1_tkCross: false,
      f2_priceAboveCloud: false,
      f3_tkAboveCloud: false,
      f4_chikouBullish: false,
      f5_futureCloudGreen: false,
      f6_kumoClearance: false,
      f7_noChopAboveCloud: false,
      f8_notOverbought: true,
      f5_stochBullish: true,
      f6_cciBullish: true,
      passedFiltersCount: 0,
      isFullBullish: false,
      sf1_tkDeathCross: false,
      sf2_priceBelowCloud: false,
      sf3_tkBelowCloud: false,
      sf4_chikouBearish: false,
      sf5_futureCloudRed: false,
      sf6_kumoClearance: false,
      sf7_noChopBelowCloud: false,
      sf8_notOversold: true,
      sf5_stochBearish: true,
      sf6_cciBearish: true,
      passedSellFiltersCount: 0,
      isFullBearish: false,
      isInsideCloud: true,
      isConsolidation: true,
    };

    return {
      time5m: 'INITIALIZING',
      time15m: 'INITIALIZING',
      timeTrend: 'INITIALIZING',
      time1h: 'INITIALIZING',
      time1d: 'INITIALIZING',
      entryTimeframe: resolvedEntryTf,
      trendTimeframe: fallbackTrendTf,
      price: 2500,
      marketRegime: 'CONSOLIDATION',
      regimeLabel: '🟡 INITIALIZING / STANDBY',
      regimeReason: 'Awaiting market candle data feed...',
      dailyTkCross: false,
      dailyTkDeathCross: false,
      dailyTkBarsAgo: 0,
      dailyTenkan: 2500,
      dailyKijun: 2500,
      dailyCloudTop: 2500,
      dailyCloudBottom: 2500,
      bar1d: dummyBar,
      bar1h: dummyBar,
      ichimoku1hRulesPassed: 0,
      ichimoku1hSellRulesPassed: 0,
      bar5m: dummyBar,
      filters5mPassed: 0,
      filters5mSellPassed: 0,
      bar15m: dummyBar,
      filters15mPassed: 0,
      filters15mSellPassed: 0,
      barTrend: dummyBar,
      filtersTrendPassed: 0,
      filtersTrendSellPassed: 0,
      totalPillarsPassed: 0,
      dualBullishSync: false,
      dualBearishSync: false,
      totalSellPillarsPassed: 0,
      sellAlignmentScore: 0,
      alignmentStatus: 'CHOP_CONSOLIDATION',
      alignmentScore: 0,
      guidance: 'Synchronizing multi-timeframe candle stream...',
      lastConfluenceBarClose: 2500,
      entryTriggerPrice: 2500,
      isEntryTriggered: false,
      entryConfirmationStatus: 'NO_CONFLUENCE_SETUP',
      entryDiffDollar: 0,
      lastSellConfluenceBarClose: 2500,
      sellTriggerPrice: 2500,
      isSellEntryTriggered: false,
      sellConfirmationStatus: 'NO_SELL_SETUP',
      sellDiffDollar: 0,
      hasReversalCross: false,
      reversalCrossBarTime: '',
      reversalCrossBarClose: 2500,
      exitTriggerPrice: 2500,
      isExitTriggered: false,
      exitConfirmationStatus: 'NO_REVERSAL_CROSS',
      exitDiffDollar: 0,
    };
  }

  const latest1h = barsEntry[barsEntry.length - 1];
  const latest1d = barsMacro[barsMacro.length - 1];

  // 1. 1D Daily Timeframe: Tenkan-Kijun Crossover Evaluation
  const dailyTkCross = latest1d.tenkan >= latest1d.kijun;
  const dailyTkDeathCross = latest1d.tenkan <= latest1d.kijun;

  // Calculate days since last 1D crossover occurred
  let dailyTkBarsAgo = 0;
  for (let d = barsMacro.length - 1; d >= 1; d--) {
    const curr = barsMacro[d];
    const prev = barsMacro[d - 1];
    if (dailyTkCross && curr.tenkan >= curr.kijun && prev.tenkan < prev.kijun) {
      dailyTkBarsAgo = barsMacro.length - 1 - d;
      break;
    }
    if (dailyTkDeathCross && curr.tenkan <= curr.kijun && prev.tenkan > prev.kijun) {
      dailyTkBarsAgo = barsMacro.length - 1 - d;
      break;
    }
  }

  // 2. 1HR Entry Timeframe: Pure Ichimoku Rules Evaluation
  const p1h = latest1h.passedFiltersCount; // 0 to 6
  const p1h_sell = latest1h.passedSellFiltersCount; // 0 to 6

  // 3. Combined Confluence: 1D TK Crossover (1 Pillar) + 1HR Ichimoku Rules (6 Pillars) = 7 Pillars Total
  const total = (dailyTkCross ? 1 : 0) + p1h; // 0 to 7 Buy
  const totalSell = (dailyTkDeathCross ? 1 : 0) + p1h_sell; // 0 to 7 Sell

  const dualBullish = dailyTkCross && p1h === 6;
  const dualBearish = dailyTkDeathCross && p1h_sell === 6;

  // Find the last completed 1HR bar that met full buy confluence (6/6 rules)
  let lastConfluenceBarClose = latest1h.close;
  let hasConfluenceSetup = false;
  for (let idx = barsEntry.length - 1; idx >= 0; idx--) {
    if (barsEntry[idx].passedFiltersCount >= 6) {
      lastConfluenceBarClose = barsEntry[idx].close;
      hasConfluenceSetup = true;
      break;
    }
  }

  // Find the last completed 1HR bar that met full sell confluence (6/6 rules)
  let lastSellConfluenceBarClose = latest1h.close;
  let hasSellConfluenceSetup = false;
  for (let idx = barsEntry.length - 1; idx >= 0; idx--) {
    if (barsEntry[idx].passedSellFiltersCount >= 6) {
      lastSellConfluenceBarClose = barsEntry[idx].close;
      hasSellConfluenceSetup = true;
      break;
    }
  }

  const currentPrice = latest1h.close;
  const entryTriggerPrice = Number(lastConfluenceBarClose.toFixed(2));
  const isEntryTriggered = hasConfluenceSetup && currentPrice > lastConfluenceBarClose;
  const entryDiffDollar = Number((currentPrice - lastConfluenceBarClose).toFixed(2));
  const entryConfirmationStatus: MultiTimeframeConfluenceState['entryConfirmationStatus'] = 
    !hasConfluenceSetup 
      ? 'NO_CONFLUENCE_SETUP' 
      : isEntryTriggered 
      ? 'TRIGGERED_ABOVE_CLOSE' 
      : 'WAITING_FOR_BREAKOUT';

  const sellTriggerPrice = Number(lastSellConfluenceBarClose.toFixed(2));
  const isSellEntryTriggered = hasSellConfluenceSetup && currentPrice < lastSellConfluenceBarClose;
  const sellDiffDollar = Number((lastSellConfluenceBarClose - currentPrice).toFixed(2));
  const sellConfirmationStatus: MultiTimeframeConfluenceState['sellConfirmationStatus'] = 
    !hasSellConfluenceSetup 
      ? 'NO_SELL_SETUP' 
      : isSellEntryTriggered 
      ? 'TRIGGERED_BELOW_CLOSE' 
      : 'WAITING_FOR_BREAKDOWN';

  // Find the first closed bar after the reversal cross (1HR Tenkan < Kijun)
  let hasReversalCross = false;
  let reversalCrossBarTime = '';
  let reversalCrossBarClose = 0;

  for (let idx = barsEntry.length - 1; idx >= 1; idx--) {
    const bCurrent = barsEntry[idx];
    const bPrior = barsEntry[idx - 1];

    if (bCurrent.tenkan < bCurrent.kijun && bPrior.tenkan >= bPrior.kijun) {
      hasReversalCross = true;
      reversalCrossBarTime = bCurrent.time;
      reversalCrossBarClose = bCurrent.close;
      break;
    }
    if (bCurrent.tenkan >= bCurrent.kijun && bPrior.tenkan < bPrior.kijun) {
      break;
    }
  }

  if (latest1h.tenkan >= latest1h.kijun) {
    hasReversalCross = false;
  }

  const exitTriggerPrice = Number(reversalCrossBarClose.toFixed(2));
  const isExitTriggered = hasReversalCross && currentPrice < reversalCrossBarClose;
  const exitDiffDollar = hasReversalCross ? Number((reversalCrossBarClose - currentPrice).toFixed(2)) : 0;
  const exitConfirmationStatus: MultiTimeframeConfluenceState['exitConfirmationStatus'] = 
    !hasReversalCross
      ? 'NO_REVERSAL_CROSS'
      : isExitTriggered
      ? 'TRIGGERED_BELOW_REVERSAL_CLOSE'
      : 'AWAITING_BREAKDOWN_BELOW_REVERSAL_CLOSE';

  // Determine Overall Market Regime (BUY, SELL, or CONSOLIDATION)
  let marketRegime: MarketRegimeType = 'CONSOLIDATION';
  let regimeLabel = '🟡 CONSOLIDATION / CHOP ZONE';
  let regimeReason = '';

  const is1hInCloud = latest1h.isInsideCloud;

  if (dailyTkCross && p1h >= 5 && !is1hInCloud) {
    marketRegime = 'BUY';
    regimeLabel = isEntryTriggered ? `🟢 STRONG BUY (${macroTfLabel} TK CROSS + ${entryTfLabel} BREAKOUT)` : `🟢 BUY SETUP (${macroTfLabel} TK CROSS + ${entryTfLabel} COILING)`;
    regimeReason = `${macroTfLabel} Tenkan-Kijun Golden Crossover active + ${entryTfLabel} Ichimoku confirms ${p1h}/6 rules. Price is above ${entryTfLabel} Kumo with bullish Chikou.`;
  } else if (dailyTkDeathCross && p1h_sell >= 5 && !is1hInCloud) {
    marketRegime = 'SELL';
    regimeLabel = isSellEntryTriggered ? `🔴 STRONG SELL (${macroTfLabel} TK DEATH CROSS + ${entryTfLabel} BREAKDOWN)` : `🔴 SELL SETUP (${macroTfLabel} TK DEATH CROSS + ${entryTfLabel} BREAKDOWN)`;
    regimeReason = `${macroTfLabel} Tenkan-Kijun Death Crossover active + ${entryTfLabel} Ichimoku confirms ${p1h_sell}/6 bearish rules. Price is below ${entryTfLabel} Kumo with bearish Chikou.`;
  } else if (dailyTkCross && p1h >= 3 && !is1hInCloud) {
    marketRegime = 'BUY';
    regimeLabel = `🟢 BUY LEAN (${macroTfLabel} TK CROSSOVER ACTIVE)`;
    regimeReason = `${macroTfLabel} Macro Golden Cross active. ${entryTfLabel} Ichimoku is forming (${p1h}/6 rules met). Awaiting complete 6/6 ${entryTfLabel} alignment.`;
  } else if (dailyTkDeathCross && p1h_sell >= 3 && !is1hInCloud) {
    marketRegime = 'SELL';
    regimeLabel = `🔴 SELL LEAN (${macroTfLabel} TK DEATH CROSS ACTIVE)`;
    regimeReason = `${macroTfLabel} Macro Death Cross active. ${entryTfLabel} Ichimoku is forming (${p1h_sell}/6 sell rules met). Awaiting complete 6/6 ${entryTfLabel} alignment.`;
  } else {
    marketRegime = 'CONSOLIDATION';
    regimeLabel = '🟡 CONSOLIDATION / CHOP ZONE';
    regimeReason = is1hInCloud 
      ? `Price ($${currentPrice.toFixed(2)}) is inside the ${entryTfLabel} Kumo Cloud ($${latest1h.cloudBottom.toFixed(2)} - $${latest1h.cloudTop.toFixed(2)}). Range-bound chop.` 
      : `Indecisive market momentum (Buy: ${total}/7, Sell: ${totalSell}/7). Stand aside and preserve capital.`;
  }

  let status: MultiTimeframeConfluenceState['alignmentStatus'] = 'CHOP_CONSOLIDATION';
  let guidance = '';

  if (dualBullish) {
    status = 'DUAL_MASTER_BUY';
    guidance = isEntryTriggered
      ? `🔥 MAXIMUM BULL CONFLUENCE & TRIGGER CONFIRMED: ${macroTfLabel} Tenkan-Kijun Golden Cross + ${entryTfLabel} All 6 Ichimoku Rules aligned (7/7 Pillars). Price ($${currentPrice.toFixed(2)}) has broken OVER last ${entryTfLabel} confluence bar close ($${lastConfluenceBarClose.toFixed(2)}). Valid long entry!`
      : `🔥 MAXIMUM BULL CONFLUENCE (AWAITING ${entryTfLabel} BREAKOUT): ${macroTfLabel} Tenkan-Kijun Golden Cross + ${entryTfLabel} All 6 Ichimoku Rules aligned (7/7 Pillars). Long entry requires price to trade strictly OVER last ${entryTfLabel} bar close ($${lastConfluenceBarClose.toFixed(2)}).`;
  } else if (dualBearish) {
    status = 'DUAL_MASTER_SELL';
    guidance = isSellEntryTriggered
      ? `🚨 MAXIMUM BEAR CONFLUENCE & TRIGGER CONFIRMED: ${macroTfLabel} Tenkan-Kijun Death Cross + ${entryTfLabel} All 6 Bearish Ichimoku Rules aligned (7/7 Pillars). Price ($${currentPrice.toFixed(2)}) has broken UNDER last ${entryTfLabel} sell bar close ($${lastSellConfluenceBarClose.toFixed(2)}). Valid short entry!`
      : `🚨 MAXIMUM BEAR CONFLUENCE (AWAITING ${entryTfLabel} BREAKDOWN): ${macroTfLabel} Tenkan-Kijun Death Cross + ${entryTfLabel} All 6 Bearish Ichimoku Rules aligned (7/7 Pillars). Short entry requires price to trade strictly UNDER last ${entryTfLabel} bar close ($${lastSellConfluenceBarClose.toFixed(2)}).`;
  } else if (dailyTkCross && p1h >= 4) {
    status = 'STRONG_BUY_SYNC';
    guidance = isEntryTriggered
      ? `⚡ STRONG ${macroTfLabel}+${entryTfLabel} BUY SYNERGY: ${macroTfLabel} TK Golden Crossover active, ${entryTfLabel} Ichimoku confirms ${p1h}/6 rules. Price is trading OVER last confluence bar close ($${lastConfluenceBarClose.toFixed(2)}).`
      : `⚡ STRONG ${macroTfLabel}+${entryTfLabel} BUY SYNERGY: ${macroTfLabel} TK Golden Crossover active, ${entryTfLabel} Ichimoku confirms ${p1h}/6 rules. Awaiting confirmation over last bar close ($${lastConfluenceBarClose.toFixed(2)}).`;
  } else if (dailyTkDeathCross && p1h_sell >= 4) {
    status = 'STRONG_SELL_SYNC';
    guidance = isSellEntryTriggered
      ? `⚡ STRONG ${macroTfLabel}+${entryTfLabel} SHORT SYNERGY: ${macroTfLabel} TK Death Crossover active, ${entryTfLabel} Ichimoku confirms ${p1h_sell}/6 bearish rules. Price is trading UNDER last sell bar close ($${lastSellConfluenceBarClose.toFixed(2)}).`
      : `⚡ STRONG ${macroTfLabel}+${entryTfLabel} SHORT SYNERGY: ${macroTfLabel} TK Death Crossover active, ${entryTfLabel} Ichimoku confirms ${p1h_sell}/6 bearish rules. Awaiting confirmation under last bar close ($${lastSellConfluenceBarClose.toFixed(2)}).`;
  } else if (p1h >= 5 && !dailyTkCross) {
    status = '5M_SCALP_LEAD';
    guidance = `⚠️ ${entryTfLabel} ICHIMOKU BUY LEAD: ${entryTfLabel} chart has broken out over last bar close ($${lastConfluenceBarClose.toFixed(2)}), but ${macroTfLabel} Tenkan-Kijun has not yet confirmed crossover. Stand by for ${macroTfLabel} TK confirmation.`;
  } else if (p1h_sell >= 5 && !dailyTkDeathCross) {
    status = '5M_SELL_LEAD';
    guidance = `⚠️ ${entryTfLabel} ICHIMOKU SELL LEAD: ${entryTfLabel} chart is breaking down below last bar close ($${lastSellConfluenceBarClose.toFixed(2)}), but ${macroTfLabel} Tenkan-Kijun has not yet confirmed death crossover. Stand by for ${macroTfLabel} TK confirmation.`;
  } else if (dailyTkCross && p1h < 4) {
    status = '30M_TREND_COILING';
    guidance = `⏳ ${macroTfLabel} TK BULLISH CROSSOVER ACTIVE: Macro trend is bullish. ${entryTfLabel} chart is currently coiling/pulling back (${p1h}/6 rules). Await ${entryTfLabel} Tenkan > Kijun cross and close over previous bar to enter.`;
  } else if (dailyTkDeathCross && p1h_sell < 4) {
    status = '30M_SELL_COILING';
    guidance = `⏳ ${macroTfLabel} TK BEARISH DEATH CROSS ACTIVE: Macro trend is bearish. ${entryTfLabel} chart is currently in a bounce (${p1h_sell}/6 sell rules). Await ${entryTfLabel} Tenkan < Kijun cross and breakdown to short.`;
  } else if (latest1h.isFullBearish) {
    status = 'BEARISH_LEAD';
    guidance = `📉 ${entryTfLabel} EXIT TRIGGER: Structure lost below Kijun support. Protect profits on active positions.`;
  } else {
    status = 'CHOP_CONSOLIDATION';
    guidance = '☁️ CONSOLIDATION / CLOUD CHOP: Market oscillating without dual timeframe trend clarity. Stand aside.';
  }

  const score = Math.round((total / 7) * 100);
  const sellScore = Math.round((totalSell / 7) * 100);

  return {
    time5m: latest1h.time,
    time15m: latest1d.time,
    timeTrend: latest1d.time,
    time1h: latest1h.time,
    time1d: latest1d.time,
    entryTimeframe: resolvedEntryTf,
    trendTimeframe: fallbackTrendTf,
    price: latest1h.close,
    marketRegime,
    regimeLabel,
    regimeReason,
    dailyTkCross,
    dailyTkDeathCross,
    dailyTkBarsAgo,
    dailyTenkan: latest1d.tenkan,
    dailyKijun: latest1d.kijun,
    dailyCloudTop: latest1d.cloudTop,
    dailyCloudBottom: latest1d.cloudBottom,
    bar1d: latest1d,
    bar1h: latest1h,
    ichimoku1hRulesPassed: p1h,
    ichimoku1hSellRulesPassed: p1h_sell,
    bar5m: latest1h, // Backwards compatible alias
    filters5mPassed: p1h,
    filters5mSellPassed: p1h_sell,
    bar15m: latest1d,
    filters15mPassed: dailyTkCross ? 1 : 0,
    filters15mSellPassed: dailyTkDeathCross ? 1 : 0,
    barTrend: latest1d,
    filtersTrendPassed: dailyTkCross ? 1 : 0,
    filtersTrendSellPassed: dailyTkDeathCross ? 1 : 0,
    totalPillarsPassed: total,
    dualBullishSync: dualBullish,
    alignmentScore: score,
    totalSellPillarsPassed: totalSell,
    dualBearishSync: dualBearish,
    sellAlignmentScore: sellScore,
    alignmentStatus: status,
    guidance,
    lastConfluenceBarClose,
    entryTriggerPrice,
    isEntryTriggered,
    entryConfirmationStatus,
    entryDiffDollar,
    lastSellConfluenceBarClose,
    sellTriggerPrice,
    isSellEntryTriggered,
    sellConfirmationStatus,
    sellDiffDollar,
    hasReversalCross,
    reversalCrossBarTime,
    reversalCrossBarClose,
    exitTriggerPrice,
    isExitTriggered,
    exitConfirmationStatus,
    exitDiffDollar,
  };
}

/**
 * Evaluate the Fast Tenkan-Kijun Cross + CCI Velocity Strategy live state on 5M bars (Buy, Sell, Consolidation)
 */
export function evaluateFastTkSignal(candles5m: Candle[]): FastTkSignalState {
  const bars5m = enrichCandlesWithIndicatorsFull(candles5m);
  if (bars5m.length === 0) {
    return {
      time: 'INITIALIZING',
      price: 2500,
      tenkan: 2500,
      kijun: 2500,
      tkCross: false,
      tkDeathCross: false,
      cci: 0,
      cciBullish: false,
      cciBearish: false,
      marketRegime: 'CONSOLIDATION',
      alignmentStatus: 'WAITING_TK_CROSS',
      alignmentScore: 0,
      guidance: 'Awaiting 5M candle data stream...',
      lastSignalBarClose: 2500,
      entryTriggerPrice: 2500,
      isEntryTriggered: false,
      entryConfirmationStatus: 'NO_SIGNAL_SETUP',
      entryDiffDollar: 0,
      lastSellSignalBarClose: 2500,
      sellTriggerPrice: 2500,
      isSellEntryTriggered: false,
      sellConfirmationStatus: 'NO_SIGNAL_SETUP',
      sellDiffDollar: 0,
      hasReversalCross: false,
      reversalCrossBarTime: '',
      reversalCrossBarClose: 2500,
      exitTriggerPrice: 2500,
      isExitTriggered: false,
      exitConfirmationStatus: 'NO_REVERSAL_CROSS',
      exitDiffDollar: 0,
    };
  }

  const latest = bars5m[bars5m.length - 1];
  const currentPrice = latest?.close ?? 2500;

  // Pure Ichimoku Fast TK: Find last 1HR bar where Tenkan was above Kijun and price above Kijun
  let lastSignalBarClose = currentPrice;
  let hasSignalSetup = false;
  for (let idx = bars5m.length - 1; idx >= 0; idx--) {
    if (bars5m[idx].f1_tkCross && bars5m[idx].f2_priceAboveCloud) {
      lastSignalBarClose = bars5m[idx].close;
      hasSignalSetup = true;
      break;
    }
  }

  // Find last 1HR bar where Tenkan was below Kijun and price below Kijun
  let lastSellSignalBarClose = currentPrice;
  let hasSellSignalSetup = false;
  for (let idx = bars5m.length - 1; idx >= 0; idx--) {
    if (bars5m[idx].sf1_tkDeathCross && bars5m[idx].sf2_priceBelowCloud) {
      lastSellSignalBarClose = bars5m[idx].close;
      hasSellSignalSetup = true;
      break;
    }
  }

  const entryTriggerPrice = Number((lastSignalBarClose ?? currentPrice).toFixed(2));
  const isEntryTriggered = hasSignalSetup && currentPrice > lastSignalBarClose;
  const entryDiffDollar = Number((currentPrice - (lastSignalBarClose ?? currentPrice)).toFixed(2));

  const sellTriggerPrice = Number((lastSellSignalBarClose ?? currentPrice).toFixed(2));
  const isSellEntryTriggered = hasSellSignalSetup && currentPrice < lastSellSignalBarClose;
  const sellDiffDollar = Number(((lastSellSignalBarClose ?? currentPrice) - currentPrice).toFixed(2));

  const isTkCross = latest?.f1_tkCross ?? false;
  const isTkDeathCross = latest?.sf1_tkDeathCross ?? false;
  const isPriceAboveKijun = latest ? latest.close >= latest.kijun : false;
  const isPriceBelowKijun = latest ? latest.close <= latest.kijun : false;

  let status: FastTkSignalState['alignmentStatus'] = 'WAITING_TK_CROSS';
  let score = 35;
  let guidance = '';
  let marketRegime: MarketRegimeType = 'CONSOLIDATION';

  if (isTkCross && isPriceAboveKijun) {
    status = 'FAST_TK_BUY';
    score = 100;
    marketRegime = 'BUY';
    guidance = isEntryTriggered
      ? `⚡ 1HR FAST TK CROSS + KIJUN SUPPORT (BUY ACTIVE): Tenkan > Kijun with price above Kijun ($${(latest?.kijun ?? 0).toFixed(2)}). Price ($${(currentPrice ?? 2500).toFixed(2)}) is trading OVER last signal candle close ($${(lastSignalBarClose ?? currentPrice ?? 2500).toFixed(2)}). Valid entry!`
      : `⚡ 1HR FAST TK CROSS DETECTED (AWAITING BREAKOUT): Tenkan > Kijun with price above Kijun. Entry requires price to trade strictly OVER signal bar close ($${(lastSignalBarClose ?? currentPrice ?? 2500).toFixed(2)}).`;
  } else if (isTkDeathCross && isPriceBelowKijun) {
    status = 'FAST_TK_SELL';
    score = 100;
    marketRegime = 'SELL';
    guidance = isSellEntryTriggered
      ? `⚡ 1HR FAST TK DEATH CROSS (SHORT ACTIVE): Tenkan < Kijun with price below Kijun ($${(latest?.kijun ?? 0).toFixed(2)}). Price ($${(currentPrice ?? 2500).toFixed(2)}) is trading UNDER last signal candle close ($${(lastSellSignalBarClose ?? currentPrice ?? 2500).toFixed(2)}). Valid short entry!`
      : `⚡ 1HR FAST TK DEATH CROSS DETECTED (AWAITING BREAKDOWN): Tenkan < Kijun with price below Kijun. Short entry requires price to trade strictly UNDER signal bar close ($${(lastSellSignalBarClose ?? currentPrice ?? 2500).toFixed(2)}).`;
  } else if (isTkCross && !isPriceAboveKijun) {
    status = 'WAITING_CCI_VELOCITY';
    score = 65;
    marketRegime = 'CONSOLIDATION';
    guidance = `⏳ TK CROSS ACTIVE, AWAITING KIJUN SUPPORT: 1HR Tenkan is above Kijun, but price is testing Kijun equilibrium ($${(latest?.kijun ?? 0).toFixed(2)}).`;
  } else if (isTkDeathCross && !isPriceBelowKijun) {
    status = 'WAITING_CCI_SELL_VELOCITY';
    score = 65;
    marketRegime = 'CONSOLIDATION';
    guidance = `⏳ TK DEATH CROSS ACTIVE, AWAITING KIJUN RESISTANCE: 1HR Tenkan is below Kijun, but price is hovering near Kijun ($${(latest?.kijun ?? 0).toFixed(2)}).`;
  } else if ((latest?.tenkan ?? 0) < (latest?.kijun ?? 0) && currentPrice < (latest?.kijun ?? 0)) {
    status = 'FAST_TK_EXIT';
    score = 15;
    marketRegime = 'SELL';
    guidance = `🚨 FAST TK EXIT: Tenkan has crossed below Kijun with price below Kijun support ($${(latest?.kijun ?? 0).toFixed(2)}). Close long positions.`;
  } else {
    status = 'WAITING_TK_CROSS';
    score = 45;
    marketRegime = 'CONSOLIDATION';
    guidance = `📊 1HR CONSOLIDATION: Tenkan ($${(latest?.tenkan ?? 0).toFixed(2)}) and Kijun ($${(latest?.kijun ?? 0).toFixed(2)}) coiling without directional crossover.`;
  }

  const entryConfirmationStatus: FastTkSignalState['entryConfirmationStatus'] = 
    !hasSignalSetup
      ? 'NO_SIGNAL_SETUP'
      : isEntryTriggered
      ? 'TRIGGERED_ABOVE_CLOSE'
      : 'WAITING_FOR_BREAKOUT';

  const sellConfirmationStatus: FastTkSignalState['sellConfirmationStatus'] = 
    !hasSellSignalSetup
      ? 'NO_SIGNAL_SETUP'
      : isSellEntryTriggered
      ? 'TRIGGERED_BELOW_CLOSE'
      : 'WAITING_FOR_BREAKDOWN';

  // Exit Signal: Below first closed bar after reversal cross
  let hasReversalCross = false;
  let reversalCrossBarTime = '';
  let reversalCrossBarClose = 0;

  for (let idx = bars5m.length - 1; idx >= 1; idx--) {
    const bCurrent = bars5m[idx];
    const bPrior = bars5m[idx - 1];
    if (bCurrent.tenkan < bCurrent.kijun && bPrior.tenkan >= bPrior.kijun) {
      hasReversalCross = true;
      reversalCrossBarTime = bCurrent.time;
      reversalCrossBarClose = bCurrent.close;
      break;
    }
    if (bCurrent.tenkan >= bCurrent.kijun && bPrior.tenkan < bPrior.kijun) {
      break;
    }
  }

  if (latest.tenkan >= latest.kijun) {
    hasReversalCross = false;
  }

  const exitTriggerPrice = Number(reversalCrossBarClose.toFixed(2));
  const isExitTriggered = hasReversalCross && currentPrice < reversalCrossBarClose;
  const exitDiffDollar = hasReversalCross ? Number((reversalCrossBarClose - currentPrice).toFixed(2)) : 0;
  const exitConfirmationStatus: FastTkSignalState['exitConfirmationStatus'] = 
    !hasReversalCross
      ? 'NO_REVERSAL_CROSS'
      : isExitTriggered
      ? 'TRIGGERED_BELOW_REVERSAL_CLOSE'
      : 'AWAITING_BREAKDOWN_BELOW_REVERSAL_CLOSE';

  return {
    time: latest.time,
    price: currentPrice,
    tenkan: latest.tenkan,
    kijun: latest.kijun,
    tkCross: isTkCross,
    tkDeathCross: isTkDeathCross,
    cci: 0,
    cciBullish: isTkCross && isPriceAboveKijun,
    cciBearish: isTkDeathCross && isPriceBelowKijun,
    marketRegime,
    alignmentStatus: status,
    alignmentScore: score,
    guidance,
    lastSignalBarClose,
    entryTriggerPrice,
    isEntryTriggered,
    entryConfirmationStatus,
    entryDiffDollar,
    lastSellSignalBarClose,
    sellTriggerPrice,
    isSellEntryTriggered,
    sellConfirmationStatus,
    sellDiffDollar,
    hasReversalCross,
    reversalCrossBarTime,
    reversalCrossBarClose,
    exitTriggerPrice,
    isExitTriggered,
    exitConfirmationStatus,
    exitDiffDollar,
  };
}

/**
 * Strategy definitions and execution (Pure Ichimoku - No Stoch, No CCI)
 */
export interface StrategyDef {
  id: string;
  name: string;
  shortName: string;
  description: string;
  indicatorsUsed: string[];
  timeframeTag: '1HR' | '1D' | 'DUAL (1HR+1D)' | '5M' | '15M' | '30M' | 'DUAL (5M+15M)' | 'DUAL (5M+30M)' | string;
  checkSignal: (
    barEntry: IndicatorBar, 
    prevEntry: IndicatorBar | undefined,
    barMacro: IndicatorBar | undefined,
    prevMacro: IndicatorBar | undefined
  ) => { shouldEnter: boolean; shouldExit: boolean; entryReason: string; exitReason: string };
}

export function getStrategyDefinitions(macroTimeframe: string = '30M', entryTimeframe: string = '1M', requireVolumeConfirmation: boolean = false): StrategyDef[] {
  return [
    {
      id: 'strat-30m-tk-1m-ichimoku',
      name: `${macroTimeframe} Reference TK Crossover + ${entryTimeframe} Full Ichimoku Rules (${macroTimeframe} Reference + ${entryTimeframe} Entry)${requireVolumeConfirmation ? ' + Volume' : ''}`,
      shortName: `${macroTimeframe} TK Cross + ${entryTimeframe} Ichimoku`,
      description: `Flagship Strategy: Requires ${macroTimeframe} Reference Tenkan >= Kijun Golden Crossover for higher-timeframe trend permission + ${entryTimeframe} closed candle satisfying all 6 Ichimoku rules (Tenkan>=Kijun, Price>Cloud, TK>Cloud, Chikou Close>Close[-26], Future Kumo Green, Kumo Clearance)${requireVolumeConfirmation ? ' + Volume Confirmation (RVOL >= 1.2x)' : ''}. Entry strictly triggers over the last closed ${entryTimeframe} bar with zero oscillators. Exit strictly triggers below the first closed bar after the Tenkan-Kijun reversal cross.`,
      indicatorsUsed: [`${macroTimeframe} Tenkan-Kijun Crossover`, `${entryTimeframe} Tenkan/Kijun`, `${entryTimeframe} Kumo Cloud`, `${entryTimeframe} Chikou Span (Close > Close[-26])`, `${entryTimeframe} Future Cloud (Senkou A>B)`, `${entryTimeframe} Kumo Clearance`, ...(requireVolumeConfirmation ? [`${entryTimeframe} Volume (RVOL >= 1.2x)`] : [])],
      timeframeTag: `DUAL (${entryTimeframe}+${macroTimeframe})`,
      checkSignal: (bEntry, prevEntry, bMacro, prevMacro) => {
        const isMacroCross = bMacro ? bMacro.tenkan >= bMacro.kijun : true;
        const isEntryAllRules = bEntry.passedFiltersCount >= 6;
        const isVolumeOk = !requireVolumeConfirmation || bEntry.volumeConfirmed !== false;
        const fresh = prevEntry 
          ? (prevEntry.passedFiltersCount < 6 && bEntry.passedFiltersCount >= 6) || 
            (prevMacro && prevMacro.tenkan < prevMacro.kijun && bMacro && bMacro.tenkan >= bMacro.kijun)
          : true;

        const shouldEnter = isMacroCross && isEntryAllRules && isVolumeOk && fresh;
        const shouldExit = false; // Evaluated dynamically via the first closed bar after reversal cross

        return {
          shouldEnter,
          shouldExit,
          entryReason: `${macroTimeframe} Reference TK Golden Cross + ${entryTimeframe} 6-Rule Pure Ichimoku Alignment${requireVolumeConfirmation ? ' + Volume Confirmed' : ''}`,
          exitReason: 'Exit Below First Closed Bar After Reversal Cross',
        };
      },
    },
    {
      id: 'strat-1m-pure-ichimoku',
      name: `Pure ${entryTimeframe} Ichimoku 6-Rule Trend Continuation`,
      shortName: `${entryTimeframe} 6-Rule Pure Ichimoku`,
      description: `Executes solely on ${entryTimeframe} timeframe when all 6 strict Ichimoku rules are simultaneously confirmed on candle close with no oscillators.`,
      indicatorsUsed: [`${entryTimeframe} Tenkan >= Kijun`, `${entryTimeframe} Price > Kumo`, `${entryTimeframe} TK > Kumo`, `${entryTimeframe} Chikou[-26] (Close > Close[-26])`, `${entryTimeframe} Future Cloud Green`, `${entryTimeframe} Kumo Clearance`],
      timeframeTag: entryTimeframe,
      checkSignal: (bEntry, prevEntry) => {
        const shouldEnter = bEntry.passedFiltersCount >= 6 && (prevEntry ? prevEntry.passedFiltersCount < 6 : true);
        const shouldExit = bEntry.close < bEntry.kijun || bEntry.close < bEntry.cloudBottom;
        return {
          shouldEnter,
          shouldExit,
          entryReason: `${entryTimeframe} Pure Ichimoku Confluence (${bEntry.passedFiltersCount}/6 rules met)`,
          exitReason: `${entryTimeframe} Kijun / Cloud Floor Broken`,
        };
      },
    },
    {
      id: 'strat-30m-tk-cross-swing',
      name: `${macroTimeframe} Reference Tenkan-Kijun Crossover Swing`,
      shortName: `${macroTimeframe} TK Crossover Swing`,
      description: `Rides higher-timeframe trend waves initiated by ${macroTimeframe} Reference Tenkan crossing above Kijun with ${entryTimeframe} price above Kumo Cloud.`,
      indicatorsUsed: [`${macroTimeframe} Reference TK Golden Cross`, `${macroTimeframe} Kumo Cloud`, `${entryTimeframe} Price > Kumo`],
      timeframeTag: `DUAL (${entryTimeframe}+${macroTimeframe})`,
      checkSignal: (bEntry, prevEntry, bMacro, prevMacro) => {
        const isMacroCross = bMacro ? bMacro.tenkan >= bMacro.kijun : false;
        const freshMacroCross = prevMacro ? (prevMacro.tenkan <= prevMacro.kijun && bMacro!.tenkan > bMacro!.kijun) : false;
        const isEntrySupport = bEntry.close > bEntry.cloudTop && bEntry.tenkan >= bEntry.kijun;
        const shouldEnter = (freshMacroCross || (isMacroCross && prevEntry && prevEntry.close <= prevEntry.cloudTop && bEntry.close > bEntry.cloudTop)) && isEntrySupport;
        const shouldExit = bMacro ? (bMacro.tenkan < bMacro.kijun) : (bEntry.close < bEntry.kijun);
        return {
          shouldEnter,
          shouldExit,
          entryReason: `${macroTimeframe} Reference Tenkan-Kijun Golden Crossover Confirmed`,
          exitReason: `${macroTimeframe} Reference TK Death Cross / Trend Exhaustion`,
        };
      },
    },
    {
      id: 'strat-1m-kumo-breakout',
      name: `${entryTimeframe} Kumo Cloud Breakout + Kijun Support`,
      shortName: `${entryTimeframe} Kumo Breakout`,
      description: `Enters when ${entryTimeframe} Gold breaks cleanly above Kumo Cloud top while maintaining Tenkan >= Kijun baseline support.`,
      indicatorsUsed: [`${entryTimeframe} Kumo Cloud Top`, `${entryTimeframe} Tenkan/Kijun`, `${entryTimeframe} Future Cloud`],
      timeframeTag: entryTimeframe,
      checkSignal: (bEntry, prevEntry) => {
        const brokeOut = prevEntry ? prevEntry.close <= prevEntry.cloudTop && bEntry.close > bEntry.cloudTop : bEntry.close > bEntry.cloudTop;
        const shouldEnter = brokeOut && bEntry.tenkan >= bEntry.kijun && bEntry.f6_kumoClearance;
        const shouldExit = bEntry.close < bEntry.cloudTop || bEntry.close < bEntry.kijun;
        return {
          shouldEnter,
          shouldExit,
          entryReason: `${entryTimeframe} Clean Kumo Cloud Breakout with TK Alignment`,
          exitReason: `${entryTimeframe} Price Re-entered Cloud / Kijun Lost`,
        };
      },
    },
    {
      id: 'strat-1m-chikou-macro',
      name: `${entryTimeframe} Chikou Span Clearance + Future Kumo`,
      shortName: `${entryTimeframe} Chikou Clearance`,
      description: `Requires ${entryTimeframe} Chikou Span to be completely clear above historical price action 26 bars ago (Close > Close[-26]) with Green Future Cloud.`,
      indicatorsUsed: [`${entryTimeframe} Chikou Span (26)`, `${entryTimeframe} Future Cloud (Senkou A > B)`, `${entryTimeframe} Tenkan-Kijun`],
      timeframeTag: entryTimeframe,
      checkSignal: (bEntry, prevEntry) => {
        const chikouFired = bEntry.f4_chikouBullish && bEntry.f5_futureCloudGreen && bEntry.f1_tkCross;
        const fresh = prevEntry ? (!prevEntry.f4_chikouBullish && bEntry.f4_chikouBullish) : true;
        const shouldEnter = chikouFired && fresh;
        const shouldExit = bEntry.close < bEntry.kijun;
        return {
          shouldEnter,
          shouldExit,
          entryReason: `${entryTimeframe} Chikou Span Breakout + Bullish Future Kumo`,
          exitReason: `${entryTimeframe} Kijun-sen Trailing Stop`,
        };
      },
    },
    {
      id: 'strat-1m-fast-tk-cross',
      name: `${entryTimeframe} Tenkan-Kijun Golden Cross`,
      shortName: `${entryTimeframe} TK Golden Cross`,
      description: `Pure Ichimoku trend catalyst triggering on ${entryTimeframe} Tenkan-sen crossing above Kijun-sen with price above Kijun baseline.`,
      indicatorsUsed: [`${entryTimeframe} Tenkan-sen (9)`, `${entryTimeframe} Kijun-sen (26)`, `${entryTimeframe} Baseline Support`],
      timeframeTag: entryTimeframe,
      checkSignal: (bEntry, prevEntry) => {
        const tkCrossed = prevEntry ? (prevEntry.tenkan <= prevEntry.kijun && bEntry.tenkan > bEntry.kijun) : (bEntry.tenkan > bEntry.kijun);
        const shouldEnter = tkCrossed && bEntry.close >= bEntry.kijun;
        const shouldExit = bEntry.tenkan < bEntry.kijun;
        return {
          shouldEnter,
          shouldExit,
          entryReason: `${entryTimeframe} Tenkan-Kijun Golden Cross with Price > Kijun`,
          exitReason: `${entryTimeframe} Tenkan-Kijun Bearish Flip`,
        };
      },
    },
  ];
}

export const STRATEGY_DEFINITIONS: StrategyDef[] = getStrategyDefinitions('30M', '1M');

/**
 * Runs backtest for a single strategy definition across the historical candle series
 */
export function runSingleStrategyBacktest(
  strat: StrategyDef,
  barsEntry: IndicatorBar[],
  barsMacro: IndicatorBar[],
  initialCapital: number = 10000,
  positionSizingMode: 'FIXED_UNITS' | 'PERCENT_OF_CAPITAL' = 'FIXED_UNITS',
  positionSizePct: number = 25
): StrategyPerformanceStats {
  const trades: BacktestTradeRecord[] = [];
  const equityCurve: Array<{ time: string; equity: number }> = [
    { time: barsEntry[0]?.time || 'Start', equity: initialCapital }
  ];

  let inPosition = false;
  let entryPrice = 0;
  let entryIndex = 0;
  let entryTime = '';
  let entryReason = '';
  let hasReversalCross = false;
  let reversalCrossBarClose = 0;

  let currentEquity = initialCapital;
  let peakEquity = initialCapital;
  let maxDrawdownPct = 0;

  // Sizing: 10 oz Gold per trade (or 1 contract)
  const positionOunces = 10; // Legacy fixed XAUUSD sizing (used when positionSizingMode === 'FIXED_UNITS')
  const spreadPerOz = 0.35; // typical spread & slippage ($0.35 on Gold)
  const pctSlippageRate = 0.0005; // 0.05% each way, used only in PERCENT_OF_CAPITAL mode
  let tradeQuantity = positionOunces;

  // Align higher-timeframe macro bars with entry timestamps: at entry index i, find latest completed macro bar
  let pMacroIdx = 0;

  const isOneMin = strat.timeframeTag.includes('1M') || strat.timeframeTag.includes('1m');
  const isHourly = strat.timeframeTag.includes('1HR') || strat.timeframeTag.includes('1D');
  const minutesPerBar = isOneMin ? 1 : isHourly ? 60 : 5;

  for (let i = 26; i < barsEntry.length - 1; i++) {
    const bEntry = barsEntry[i];
    const prevEntry = barsEntry[i - 1];

    // Find macro bar matching timestamp
    while (pMacroIdx + 1 < barsMacro.length && barsMacro[pMacroIdx + 1].timestamp <= bEntry.timestamp) {
      pMacroIdx++;
    }
    const bMacro = barsMacro[pMacroIdx];
    const prevMacro = pMacroIdx > 0 ? barsMacro[pMacroIdx - 1] : undefined;

    const { shouldEnter, shouldExit, entryReason: eReason, exitReason: xReason } = strat.checkSignal(
      bEntry, prevEntry, bMacro, prevMacro
    );

    // 1. If currently in position, check exit
    if (inPosition) {
      const currentPrice = bEntry.close;

      // User directive: "the exit signal should be below the first closed bar after the reversal cross"
      const isReversalNow = (bEntry.tenkan < bEntry.kijun && prevEntry && prevEntry.tenkan >= prevEntry.kijun) ||
        (bMacro && prevMacro && bMacro.tenkan < bMacro.kijun && prevMacro.tenkan >= prevMacro.kijun);

      if (isReversalNow && !hasReversalCross) {
        hasReversalCross = true;
        reversalCrossBarClose = bEntry.close; // First closed bar after reversal cross
      } else if (bEntry.tenkan >= bEntry.kijun && hasReversalCross && (!bMacro || bMacro.tenkan >= bMacro.kijun)) {
        // Reversal cross recovered back into bullish state
        hasReversalCross = false;
        reversalCrossBarClose = 0;
      }

      const isExitSignalBelowReversalBar = hasReversalCross && (bEntry.close < reversalCrossBarClose);
      const movePct = ((currentPrice - entryPrice) / entryPrice) * 100;
      const isEmergencyStop = movePct <= (isOneMin ? -1.0 : isHourly ? -5.0 : -3.5);
      const isTakeProfit = movePct >= (isOneMin ? 1.8 : isHourly ? 5.5 : 3.5);

      const shouldExitResolved = isExitSignalBelowReversalBar || shouldExit;

      if (shouldExitResolved || isEmergencyStop || isTakeProfit) {
        const nextBar = barsEntry[i + 1] || bEntry;
        const exitPrice = nextBar.open;
        const grossPnl = (exitPrice - entryPrice) * tradeQuantity;
        const friction = positionSizingMode === 'PERCENT_OF_CAPITAL'
          ? (entryPrice + exitPrice) * tradeQuantity * pctSlippageRate
          : spreadPerOz * tradeQuantity * 2; // entry + exit spread
        const netPnl = grossPnl - friction;
        const pnlPct = Number((((exitPrice - entryPrice) / entryPrice) * 100).toFixed(2));
        const holdingBars = i - entryIndex;

        currentEquity += netPnl;
        if (currentEquity > peakEquity) {
          peakEquity = currentEquity;
        }
        const drawdown = ((peakEquity - currentEquity) / peakEquity) * 100;
        if (drawdown > maxDrawdownPct) {
          maxDrawdownPct = drawdown;
        }

        const resolvedExitReason = isExitSignalBelowReversalBar
          ? `Exit Below 1st Closed Bar ($${reversalCrossBarClose.toFixed(2)}) After Reversal Cross`
          : isTakeProfit 
          ? 'Target Take Profit Hit (+4.5%)' 
          : isEmergencyStop 
          ? 'Emergency Stop Loss Hit (-2.5%)' 
          : xReason;

        const tradeSl = bEntry.kijun && bEntry.kijun < entryPrice ? bEntry.kijun : entryPrice * (isOneMin ? 0.996 : 0.988);
        const tradeTp = entryPrice + Math.max(3.0, (entryPrice - tradeSl) * 2);

        trades.push({
          id: `trade-${strat.id}-${trades.length + 1}`,
          strategyId: strat.id,
          entryIndex,
          entryTime,
          entryPrice: Number(entryPrice.toFixed(2)),
          stopLossPrice: Number(tradeSl.toFixed(2)),
          targetPrice: Number(tradeTp.toFixed(2)),
          quantity: tradeQuantity,
          isRunning: false,
          exitIndex: i,
          exitTime: nextBar.time,
          exitPrice: Number(exitPrice.toFixed(2)),
          direction: 'LONG',
          pnlDollar: Number(netPnl.toFixed(2)),
          pnlPct,
          holdingBars,
          holdingMinutes: holdingBars * minutesPerBar,
          isWin: netPnl > 0,
          entryReason,
          exitReason: resolvedExitReason,
        });

        equityCurve.push({
          time: nextBar.time,
          equity: Number(currentEquity.toFixed(2)),
        });

        inPosition = false;
        hasReversalCross = false;
        reversalCrossBarClose = 0;
      }
    } 
    // 2. If not in position, check entry
    else if (shouldEnter) {
      const nextBar = barsEntry[i + 1];
      // User directive: "entry should be over the last bar close with all confluences"
      const signalBarClose = bEntry.close;

      if (nextBar && nextBar.high > signalBarClose) {
        inPosition = true;
        entryPrice = Math.max(nextBar.open, signalBarClose);
        entryIndex = i + 1;
        entryTime = nextBar.time;
        entryReason = `${eReason} (Triggered > Last 1HR Bar Close $${signalBarClose.toFixed(2)})`;
        hasReversalCross = false;
        reversalCrossBarClose = 0;
        tradeQuantity = positionSizingMode === 'PERCENT_OF_CAPITAL'
          ? Math.max(0, Math.floor((currentEquity * (positionSizePct / 100)) / entryPrice))
          : positionOunces;
      }
    }
  }

  // If still in position at the end of the test period, track as an active running trade
  if (inPosition && barsEntry.length > 0) {
    const lastBar = barsEntry[barsEntry.length - 1];
    const currentPrice = lastBar.close;
    const grossPnl = (currentPrice - entryPrice) * tradeQuantity;
    const friction = positionSizingMode === 'PERCENT_OF_CAPITAL'
      ? (entryPrice + currentPrice) * tradeQuantity * pctSlippageRate
      : spreadPerOz * tradeQuantity;
    const netPnl = grossPnl - friction;
    const pnlPct = Number((((currentPrice - entryPrice) / entryPrice) * 100).toFixed(2));
    const holdingBars = barsEntry.length - 1 - entryIndex;
    const tradeSl = lastBar.kijun && lastBar.kijun < entryPrice ? lastBar.kijun : entryPrice * (isOneMin ? 0.996 : 0.988);
    const tradeTp = entryPrice + Math.max(3.0, (entryPrice - tradeSl) * 2);

    trades.push({
      id: `trade-${strat.id}-running`,
      strategyId: strat.id,
      entryIndex,
      entryTime,
      entryPrice: Number(entryPrice.toFixed(2)),
      stopLossPrice: Number(tradeSl.toFixed(2)),
      targetPrice: Number(tradeTp.toFixed(2)),
      quantity: tradeQuantity,
      isRunning: true,
      exitIndex: barsEntry.length - 1,
      exitTime: 'RUNNING (LIVE)',
      exitPrice: Number(currentPrice.toFixed(2)),
      direction: 'LONG',
      pnlDollar: Number(netPnl.toFixed(2)),
      pnlPct,
      holdingBars,
      holdingMinutes: holdingBars * minutesPerBar,
      isWin: netPnl > 0,
      entryReason,
      exitReason: 'Active Running Position (Open)',
    });
  }

  // Calculate statistics
  const totalTrades = trades.length;
  const winningTrades = trades.filter(t => t.isWin).length;
  const losingTrades = totalTrades - winningTrades;
  const winRatePct = totalTrades > 0 ? Number(((winningTrades / totalTrades) * 100).toFixed(1)) : 0;

  const grossProfits = trades.filter(t => t.pnlDollar > 0).reduce((sum, t) => sum + t.pnlDollar, 0);
  const grossLosses = Math.abs(trades.filter(t => t.pnlDollar < 0).reduce((sum, t) => sum + t.pnlDollar, 0));
  const profitFactor = grossLosses > 0 
    ? Number((grossProfits / grossLosses).toFixed(2)) 
    : grossProfits > 0 ? 9.99 : 1.0;

  const netProfitDollar = Number((currentEquity - initialCapital).toFixed(2));
  const netProfitPct = Number((((currentEquity - initialCapital) / initialCapital) * 100).toFixed(2));

  const winTradesList = trades.filter(t => t.isWin);
  const lossTradesList = trades.filter(t => !t.isWin);

  const avgWinPct = winTradesList.length > 0 
    ? Number((winTradesList.reduce((s, t) => s + t.pnlPct, 0) / winTradesList.length).toFixed(2)) 
    : 0;
  const avgLossPct = lossTradesList.length > 0 
    ? Number((lossTradesList.reduce((s, t) => s + t.pnlPct, 0) / lossTradesList.length).toFixed(2)) 
    : 0;
  const winLossRatio = Math.abs(avgLossPct) > 0 ? Number((avgWinPct / Math.abs(avgLossPct)).toFixed(2)) : avgWinPct;

  // Consecutive wins & losses
  let maxConsecutiveWins = 0;
  let maxConsecutiveLosses = 0;
  let curWins = 0;
  let curLosses = 0;

  for (const t of trades) {
    if (t.isWin) {
      curWins++;
      curLosses = 0;
      if (curWins > maxConsecutiveWins) maxConsecutiveWins = curWins;
    } else {
      curLosses++;
      curWins = 0;
      if (curLosses > maxConsecutiveLosses) maxConsecutiveLosses = curLosses;
    }
  }

  const avgHoldingBars = totalTrades > 0 
    ? Math.round(trades.reduce((s, t) => s + t.holdingBars, 0) / totalTrades) 
    : 0;
  const avgHoldingMinutes = avgHoldingBars * 5;
  const expectancyDollar = totalTrades > 0 ? Number((netProfitDollar / totalTrades).toFixed(2)) : 0;

  // Group trades by trading day for day-by-day performance analysis (Mon-Fri)
  const dayMap = new Map<string, {
    date: string;
    tradesCount: number;
    wins: number;
    losses: number;
    pnlDollar: number;
    grossProfits: number;
    grossLosses: number;
  }>();

  for (const t of trades) {
    const dateStr = t.entryTime.slice(0, 10);
    if (!dayMap.has(dateStr)) {
      dayMap.set(dateStr, {
        date: dateStr,
        tradesCount: 0,
        wins: 0,
        losses: 0,
        pnlDollar: 0,
        grossProfits: 0,
        grossLosses: 0,
      });
    }
    const day = dayMap.get(dateStr)!;
    day.tradesCount++;
    if (t.isWin) {
      day.wins++;
      day.grossProfits += t.pnlDollar;
    } else {
      day.losses++;
      day.grossLosses += Math.abs(t.pnlDollar);
    }
    day.pnlDollar += t.pnlDollar;
  }

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Month-by-month performance tracking
  const monthMap = new Map<string, {
    monthKey: string;
    monthName: string;
    tradesCount: number;
    wins: number;
    losses: number;
    pnlDollar: number;
    grossProfits: number;
    grossLosses: number;
  }>();

  for (const t of trades) {
    const monthKey = t.entryTime.slice(0, 7); // "YYYY-MM"
    if (!monthMap.has(monthKey)) {
      const dt = new Date(monthKey + '-15T12:00:00Z');
      const monthName = isNaN(dt.getTime()) ? monthKey : `${MONTH_NAMES[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
      monthMap.set(monthKey, {
        monthKey,
        monthName,
        tradesCount: 0,
        wins: 0,
        losses: 0,
        pnlDollar: 0,
        grossProfits: 0,
        grossLosses: 0,
      });
    }
    const m = monthMap.get(monthKey)!;
    m.tradesCount++;
    if (t.isWin) {
      m.wins++;
      m.grossProfits += t.pnlDollar;
    } else {
      m.losses++;
      m.grossLosses += Math.abs(t.pnlDollar);
    }
    m.pnlDollar += t.pnlDollar;
  }

  const monthlyBreakdown: MonthlyBreakdownStat[] = Array.from(monthMap.values()).map(m => {
    const winRatePct = m.tradesCount > 0 ? Number(((m.wins / m.tradesCount) * 100).toFixed(1)) : 0;
    const profitFactor = m.grossLosses > 0 
      ? Number((m.grossProfits / m.grossLosses).toFixed(2)) 
      : m.grossProfits > 0 ? 9.99 : 1.0;

    return {
      monthKey: m.monthKey,
      monthName: m.monthName,
      tradesCount: m.tradesCount,
      wins: m.wins,
      losses: m.losses,
      winRatePct,
      pnlDollar: Number(m.pnlDollar.toFixed(2)),
      profitFactor,
    };
  });

  const dailyBreakdown: DailyBreakdownStat[] = Array.from(dayMap.values()).map(d => {
    const dt = new Date(d.date + 'T12:00:00Z');
    const dayName = isNaN(dt.getTime()) ? 'Day' : DAY_NAMES[dt.getUTCDay()];
    const monthName = isNaN(dt.getTime()) ? '' : MONTH_NAMES[dt.getUTCMonth()];
    const dayNum = isNaN(dt.getTime()) ? '' : dt.getUTCDate();
    const formattedDate = `${dayName} ${monthName} ${dayNum}`;
    const winRatePct = d.tradesCount > 0 ? Number(((d.wins / d.tradesCount) * 100).toFixed(1)) : 0;
    const profitFactor = d.grossLosses > 0 
      ? Number((d.grossProfits / d.grossLosses).toFixed(2)) 
      : d.grossProfits > 0 ? 9.99 : 1.0;

    return {
      date: d.date,
      dayName,
      formattedDate,
      tradesCount: d.tradesCount,
      wins: d.wins,
      losses: d.losses,
      winRatePct,
      pnlDollar: Number(d.pnlDollar.toFixed(2)),
      profitFactor,
    };
  });

  // Composite ranking score: balances high win rate, strong profit factor, and healthy returns with drawdown safety
  // Score ~ 0 to 100
  const winRateComponent = winRatePct * 0.45; // up to 45 pts
  const pfComponent = Math.min(3.5, profitFactor) * 10; // up to 35 pts
  const returnComponent = Math.min(20, Math.max(-20, netProfitPct)) * 0.75; // up to 15 pts
  const ddPenalty = Math.min(15, maxDrawdownPct * 1.2);
  const compositeScore = Number((Math.max(0, winRateComponent + pfComponent + returnComponent - ddPenalty)).toFixed(1));

  return {
    id: strat.id,
    name: strat.name,
    shortName: strat.shortName,
    description: strat.description,
    indicatorsUsed: strat.indicatorsUsed,
    timeframeTag: strat.timeframeTag,
    totalTrades,
    winningTrades,
    losingTrades,
    winRatePct,
    profitFactor,
    netProfitDollar,
    netProfitPct,
    initialCapital,
    endingCapital: Number(currentEquity.toFixed(2)),
    avgWinPct,
    avgLossPct,
    winLossRatio,
    maxDrawdownPct: Number(maxDrawdownPct.toFixed(1)),
    maxConsecutiveWins,
    maxConsecutiveLosses,
    avgHoldingBars,
    avgHoldingMinutes,
    expectancyDollar,
    compositeScore,
    rank: 1, // updated in runner
    dailyBreakdown,
    monthlyBreakdown,
    trades,
    equityCurve,
  };
}

/**
 * Runs backtesting across ALL strategy variants and ranks them to determine
 * which strategy with those indicators has the highest statistics!
 */
export function runAllStrategiesBacktest(
  candles5m: Candle[],
  candlesTrend: Candle[],
  initialCapital: number = 10000,
  trendTimeframe: string = '30M',
  entryTimeframe: string = '1M',
  positionSizingMode: 'FIXED_UNITS' | 'PERCENT_OF_CAPITAL' = 'FIXED_UNITS',
  requireVolumeConfirmation: boolean = false,
  positionSizePct: number = 25
): BacktestSuiteResult {
  const barsEntry = enrichCandlesWithIndicatorsFull(candles5m);
  const barsMacro = enrichCandlesWithIndicatorsFull(candlesTrend);
  const strategyDefs = getStrategyDefinitions(trendTimeframe, entryTimeframe, requireVolumeConfirmation);

  const results: StrategyPerformanceStats[] = [];

  for (const strat of strategyDefs) {
    const stats = runSingleStrategyBacktest(strat, barsEntry, barsMacro, initialCapital, positionSizingMode, positionSizePct);
    results.push(stats);
  }

  // Rank by compositeScore descending (highest win rate + profit factor + safety)
  results.sort((a, b) => b.compositeScore - a.compositeScore);

  results.forEach((r, idx) => {
    r.rank = idx + 1;
  });

  const topStrategy = results[0];

  const startDate = barsEntry[0]?.time ? barsEntry[0].time.slice(0, 10) : 'Start';
  const endDate = barsEntry[barsEntry.length - 1]?.time ? barsEntry[barsEntry.length - 1].time.slice(0, 10) : 'End';

  // Determine actual elapsed calendar duration
  const startMs = barsEntry[0]?.time ? new Date(barsEntry[0].time).getTime() : 0;
  const endMs = barsEntry[barsEntry.length - 1]?.time ? new Date(barsEntry[barsEntry.length - 1].time).getTime() : 0;
  const daysDiff = (startMs && endMs && !isNaN(startMs) && !isNaN(endMs)) 
    ? Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24))) 
    : 30;

  let periodLabel = `${daysDiff} Days (${startDate} – ${endDate})`;
  if (daysDiff >= 80) {
    periodLabel = `3-Month Lookback (${daysDiff} Days: ${startDate} – ${endDate})`;
  } else if (daysDiff >= 20) {
    periodLabel = `1-Month Lookback (${daysDiff} Days: ${startDate} – ${endDate})`;
  } else if (daysDiff <= 7) {
    periodLabel = `Last Week (${startDate} – ${endDate})`;
  }

  const summary = `Tested ${strategyDefs.length} Pure Ichimoku strategies on XAUUSD for ${periodLabel} across ${barsEntry.length.toLocaleString()} ${entryTimeframe} entry candles and ${barsMacro.length.toLocaleString()} ${trendTimeframe} Reference candles (No Stoch, No CCI). Top strategy is "${topStrategy.shortName}" with ${topStrategy.winRatePct}% win rate, ${topStrategy.profitFactor}x profit factor, and +$${topStrategy.netProfitDollar.toLocaleString()} net return over ${topStrategy.totalTrades} trades.`;

  return {
    rankedStrategies: results,
    topStrategy,
    summary,
    periodLabel,
    startDate,
    endDate,
    totalBars5m: barsEntry.length,
    totalBars15m: barsMacro.length,
    totalBarsTrend: barsMacro.length,
    trendTimeframe,
  };
}
