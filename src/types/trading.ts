export type MarketCapCategory = 'ALL' | 'MICRO' | 'SMALL' | 'MID' | 'LARGE' | 'MEGA';

export type DataProviderType = 'MOCK' | 'FINNHUB';

export interface MarketStatus {
  isOpen: boolean;
  session: 'PRE_MARKET' | 'REGULAR' | 'AFTER_HOURS' | 'CLOSED';
  nextEvent: string;
  currentTime: string;
}

export type CatalystType = 
  | 'EARNINGS' 
  | 'FDA_BIO' 
  | 'CONTRACT_NEWS' 
  | 'ANALYST_UPGRADE' 
  | 'PRODUCT_LAUNCH' 
  | 'SEC_FILING' 
  | 'MOMENTUM_SPECULATIVE';

export interface CatalystInfo {
  type: CatalystType;
  headline: string;
  date: string;
  impact: 'HIGH' | 'MEDIUM' | 'SPECULATIVE';
  details?: string;
  source?: string;
}

export interface TickerQuote {
  symbol: string;
  name: string;
  price: number;
  change: number; // 4H Change / active change
  changePercent: number; // 4H Change %
  open: number;
  high: number;
  low: number;
  fourHourHigh?: number;
  fourHourLow?: number;
  fourHourOpen?: number;
  fourHourChange?: number;
  fourHourChangePercent?: number;
  previousClose: number;
  volume: number;
  avgVolume30D: number;
  rvol: number; // relative volume e.g. 2.4x
  marketCap: number; // in dollars
  marketCapCategory: MarketCapCategory;
  floatShares?: number;
  high52W: number;
  low52W: number;
  sector: string;
  catalyst?: CatalystInfo;
  sparkline: number[]; // 20D macro daily trend closes
  sparkline4H?: number[]; // 20-period 4-Hour timeframe closes
  lastUpdated: string;
  isStale?: boolean;
}

export interface Candle {
  time: string; // ISO date or "YYYY-MM-DD" or timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  
  // Ichimoku Kinko Hyo (9, 26, 52, 26)
  tenkan?: number; // Conversion line
  kijun?: number;  // Base line
  senkouA?: number; // Leading Span A (Current Active Cloud at bar i)
  senkouB?: number; // Leading Span B (Current Active Cloud at bar i)
  futureSenkouA?: number; // Raw Senkou A calculated at bar i (projects 26 periods ahead)
  futureSenkouB?: number; // Raw Senkou B calculated at bar i (projects 26 periods ahead)
  cloudTop?: number; // Math.max(Senkou A, Senkou B)
  cloudBottom?: number; // Math.min(Senkou A, Senkou B)
  chikou?: number; // Lagging Span
  close26Ago?: number; // Closing price 26 periods ago for Chikou Span validation
  isFutureCloudBullish?: boolean; // futureSenkouA > futureSenkouB (Green/Bullish Future Cloud)
  isChikouBullish?: boolean; // close > close26Ago (Macro Trend Continuation)
  isChikouBearish?: boolean; // close < close26Ago (Macro Trend Breakdown)
  
  // Stochastic Oscillator (12, 3, 3)
  stochK?: number; // %K Line (Slow %K)
  stochD?: number; // %D Line
  
  // Commodity Channel Index (CCI 40 & CCI 20 for standard intraday charts)
  cci40?: number;
  cci20?: number;
  
  // Moving Averages & Bands (for chart & secondary indicators)
  sma20?: number;
  sma50?: number;
  sma200?: number;
  ema9?: number;
  ema20?: number;
  rsi14?: number;
  highestHigh20?: number;
  avgVolume30?: number;
  macd?: number;
  macdSignal?: number;
  macdHist?: number;
  upperBB?: number;
  lowerBB?: number;
}

export type SignalCategory = 
  | 'ichimoku_confluence'
  | 'stochastic'
  | 'cci'
  | 'breakout' 
  | 'ma_crossover' 
  | 'rsi' 
  | 'rvol_momentum' 
  | 'bollinger' 
  | 'custom';

export interface IchimokuConfluenceParams {
  tenkanPeriod: number; // default 9
  kijunPeriod: number;  // default 26
  senkouBPeriod: number; // default 52
  displacement: number; // default 26
  stochPeriodK: number; // default 12
  stochSmoothK: number; // default 3
  stochPeriodD: number; // default 3
  stochThreshold: number; // default 50
  cciPeriod: number; // default 40
  cciThreshold: number; // default 50
}

export interface SignalRuleConfig {
  id: string;
  name: string;
  category: SignalCategory;
  enabled: boolean;
  direction: 'BULLISH' | 'BEARISH';
  description: string;
  params: {
    // Ichimoku + Momentum Master Confluence Params:
    tenkanPeriod?: number; // 9
    kijunPeriod?: number; // 26
    senkouBPeriod?: number; // 52
    stochPeriodK?: number; // 12
    stochSmoothK?: number; // 3
    stochPeriodD?: number; // 3
    stochThreshold?: number; // 50
    cciPeriod?: number; // 40
    cciThreshold?: number; // 50
    
    // Auxiliary settings:
    timeframe?: '1M' | '5M' | '15M' | '30M' | '1H' | '1HR' | '4H' | 'D' | 'AUTO';
    macroTimeframe?: string;
    breakoutDays?: number;
    minVolumeVsAvg?: number;
    fastMA?: number;
    slowMA?: number;
    rsiThreshold?: number;
    minRvol?: number;
    minPriceMovePct?: number;
    intradayPriceMovePct?: number;
    requireVolumeConfirmation?: boolean; // 8th pillar: closed-candle volume >= minRvol x its trailing average
  };
}

export interface SignalAlert {
  id: string;
  timestamp: string;
  ticker: string;
  ruleId: string;
  ruleName: string;
  pipeline?: string; // 'Ichimoku Confluence' | 'Trend & Momentum' | 'Risk Alert'
  signal?: 'BUY' | 'SELL' | 'WARN';
  direction: 'BULLISH' | 'BEARISH';
  triggerPrice: number;
  rvol: number;
  volume: number;
  reason: string; // transparent explanation: "Master Long Entry: Tenkan ($128.4) & Kijun ($126.1) > Cloud ($124.8), Stoch %K (68.4 > 50), CCI (82.1 > 50)"
  dismissed: boolean;
  acknowledged?: boolean;
  
  // Detailed Confluence Check Metrics:
  confluenceStatus?: {
    trendMet: boolean;
    stochMet: boolean;
    cciMet: boolean;
    chikouMet?: boolean;
    futureCloudMet?: boolean;
    tenkan: number;
    kijun: number;
    cloudTop: number;
    cloudBottom: number;
    stochK: number;
    cci: number;
    close26Ago?: number;
    futureSenkouA?: number;
    futureSenkouB?: number;
  };

  // Historical tracking for accuracy scoring:
  priceAfter1D?: number;
  priceAfter3D?: number;
  priceAfter5D?: number;
  returnPct1D?: number;
  returnPct3D?: number;
  returnPct5D?: number;
  wasSuccessful?: boolean;
}

export interface SignalAccuracyStats {
  ruleId: string;
  ruleName: string;
  totalTriggers: number;
  evaluatedTriggers: number;
  winCount1D: number;
  winCount3D: number;
  winCount5D: number;
  winRate1D: number;
  winRate3D: number;
  winRate5D: number;
  avgReturnPct1D: number;
  avgReturnPct3D: number;
  avgReturnPct5D: number;
}

export type StopLossType = 'DYNAMIC_KUMO' | 'TRAILING' | 'FIXED';

export interface NewsReversalAnalysis {
  hasBullishDivergence: boolean;
  reversalProbabilityScore: number; // 0 to 100%
  headline: string;
  source?: string;
  catalystType?: CatalystType;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: 'HIGH' | 'MEDIUM' | 'SPECULATIVE';
  financialImpactSummary: string;
  actionRecommendation: 'HOLD_NEWS_SHIELD' | 'TIGHTEN_STOP' | 'CONFIRM_SELL';
  shieldBufferStopPrice?: number;
  details: string;
  detectedAt: string;
}

export interface ExitStrategyConfig {
  kumoStopLoss?: {
    enabled: boolean; // Dynamic Kumo (Cloud Bottom) Stop Loss
    bufferPct?: number; // Optional buffer below cloud bottom
  };
  dynamicKumoStop?: {
    enabled: boolean;
    nearKumoWarningPct: number;
    bufferPct?: number;
  };
  momentumLossExit?: {
    enabled: boolean;
    cciThreshold: number;
    stochThreshold: number;
    requireBoth?: boolean;
  };
  hardStopLoss?: {
    enabled: boolean;
    stopLossPct: number; // Deprecated in favor of dynamic Kumo, maintained for fallback
  };
  trailingStop: {
    enabled: boolean;
    trailingPct: number; // Default 3.0%
    activationThresholdPct: number; // Default 2.0%
  };
  fixedTakeProfit: {
    enabled: boolean;
    takeProfitPct: number; // Default 10.0%
  };
  newsReversalShield?: {
    enabled: boolean; // Analyzes news & financial records when sell signal triggers
    minConfidence: 'HIGH' | 'MEDIUM' | 'ALL';
    graceBufferPct: number; // Buffer below cloud stop (e.g. 1.5%)
    autoSuppressHardSell: boolean; // Convert hard market dump to protected reversal watch
  };
  technicalExit: {
    enabled: boolean;
    momentumLossExit: boolean; // CCI < 50 OR Stoch %K < 50
    trendBreakExit: boolean;   // Price < Cloud Bottom
    cciThreshold?: number;     // default 50
    stochKThreshold?: number;  // default 50
    // Optional compatibility
    deathCross?: boolean;
    rsiOverbought?: boolean;
    rsiThreshold?: number;
    rsiCrossUnderBelow?: number;
    suppressIfTrailingActiveInProfit?: boolean;
    trailingProfitSuppressionThresholdPct?: number;
  };
}

export interface ExitFlag {
  id: string;
  type: 
    | 'KUMO_STOP_LOSS' 
    | 'MOMENTUM_LOSS_CCI' 
    | 'MOMENTUM_LOSS_STOCH' 
    | 'TREND_BREAK_KUMO' 
    | 'STOP_LOSS' 
    | 'TRAILING_STOP' 
    | 'TAKE_PROFIT' 
    | 'NEWS_REVERSAL_SHIELD'
    | 'REVERSAL_WATCH'
    | 'TECH_DEATH_CROSS' 
    | 'TECH_RSI_OVERBOUGHT' 
    | 'TECH_MA_BREAK' 
    | 'TECH_RSI_REVERSAL' 
    | 'TECH_RSI_CROSS_UNDER' 
    | 'PRIORITY_ROUTING_INFO' 
    | 'TIME_STALE' 
    | 'INFO';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  message: string;
  orderAction?: 'MARKET_SELL' | 'LIMIT_SELL' | 'TRAILING_SELL' | 'HOLD_NEWS_SHIELD';
  triggeredAt: string;
  triggerPrice?: number;
  label?: string;
  newsReversalDetails?: NewsReversalAnalysis;
}

export interface Position {
  id: string;
  ticker: string;
  type: 'LONG' | 'SHORT';
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  entryDate: string; // YYYY-MM-DD
  
  // Exit Rules & Dynamic Kumo Stop Loss Configuration:
  stopLossType: StopLossType;
  stopLossPrice: number; // Dynamically updated to current candle's Cloud Bottom
  stopLossPct: number;
  kumoStopPrice?: number; // Current active Cloud Bottom stop price
  kumoCloudBottom?: number; // Current active Cloud Bottom: Math.min(Senkou A, Senkou B)
  kumoCloudTop?: number;    // Current active Cloud Top: Math.max(Senkou A, Senkou B)
  isNearKumoStop?: boolean; // True if currentPrice is within 1% of Kumo Stop floor
  distanceToKumoPct?: number; // exact distance to Kumo Stop in %
  nearKumoDistancePct?: number; // exact distance to Kumo Stop in %
  
  // Live Indicator Snapshots on Position:
  currentTenkan?: number;
  currentKijun?: number;
  currentStochK?: number;
  currentCci?: number;

  trailingPeakPrice?: number; // Highest price reached since entry for trailing stop
  trailingActivated?: boolean; // True once activation threshold is reached
  trailingActivationThresholdPct?: number; // e.g. 2%
  trailingDistancePct?: number; // e.g. 3%

  // RSI / Momentum tracking
  rsiOverboughtArmed?: boolean;
  rsiPeakValue?: number;
  
  takeProfitPrice: number;
  takeProfitPct: number;
  takeProfitTier2Price?: number;
  
  technicalExitRules: {
    flagBelowEMA20?: boolean;
    flagBelowSMA50?: boolean;
    flagRsiOverboughtReversal?: boolean;
    flagMomentumLossCci?: boolean;
    flagMomentumLossStoch?: boolean;
    flagPriceBelowKumo?: boolean;
    deathCross?: boolean;
    rsiOverbought?: boolean;
    rsiThreshold?: number;
    rsiCrossUnderBelow?: number;
    suppressIfTrailingActiveInProfit?: boolean;
  };

  exitStrategyConfig?: ExitStrategyConfig;
  
  // Trend-Riding Engine status:
  trendRidingStatus?: {
    stage: 'TREND_INCEPTION' | 'RIDING_TREND' | 'PULLBACK_TEST' | 'TREND_BROKEN';
    trendStrengthScore: number; // 0-100%
    barsInTrend: number;
    advice: string;
    supportFloor: number;
    kijunFloor: number;
  };

  maxHoldDays?: number; // Flag if held > X days with no progress
  
  notes?: string;
  status: 'OPEN' | 'CLOSED';
  closePrice?: number;
  closeDate?: string;
  realizedPnlDollars?: number;
  realizedPnlPercent?: number;
  
  // Computed live:
  unrealizedPnlDollars: number;
  unrealizedPnlPercent: number;
  exitFlags: ExitFlag[];
  newsReversalAnalysis?: NewsReversalAnalysis;
}

export interface GotradeMoverCandidate {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  rvol: number;
  volume: number;
  marketCap: number;
  sector: string;
  isCheapGem: boolean; // price < $25
  isLowFloat: boolean; // float < 100M
  confluenceScore: number; // 0 - 100%
  confluencePassedCount: number; // e.g. 7 out of 8
  confluenceStage: string;
  catalystHeadline?: string;
  catalystType?: CatalystType;
  inWatchlist: boolean;
  discoveredAt: string;
  reason: string;
}

export interface ScannerFilterParams {
  minAvgVolume: number; // e.g. 500000
  minRvol: number; // e.g. 1.5
  minChangePct: number; // e.g. -100
  maxChangePct: number; // e.g. +100
  changeWindow: '1D' | '5D' | '1M';
  priceMin: number;
  priceMax: number;
  marketCapCategory: MarketCapCategory;
  maxFloat?: number; // in shares, e.g. 50M
  catalystRequired: boolean;
  catalystType?: CatalystType | 'ANY';
  searchQuery: string;
  sector?: string;
}

export interface PaperAccount {
  balance: number;
  initialBalance: number;
  positions: Position[];
  history: Position[]; // Closed trades
  winCount: number;
  lossCount: number;
}

export interface BacktestRuleConfig {
  entryRuleIds: string[];
  requireAllEntryRules: boolean;
  stopLossPct: number; // e.g. 5%
  takeProfitPct: number; // e.g. 10%
  trailingStopPct?: number; // e.g. 4%
  maxHoldDays: number; // e.g. 15 days
  positionSizePct: number; // e.g. 20% of account per trade
}

export interface BacktestParams {
  strategyId: string;
  stopLossPct: number;
  takeProfitPct: number;
  maxHoldDays: number;
  universeScope: 'ALL' | 'SINGLE';
  specificTicker?: string;
  commissionPerTrade?: number;
  slippagePct?: number;
  holdoutDays?: number;
}

export interface BacktestTrade {
  id: string;
  ticker: string;
  entryDate: string;
  entryPrice: number;
  exitDate: string;
  exitPrice: number;
  quantity: number;
  pnlDollars: number;
  pnlPercent: number;
  entryReason: string;
  exitReason: string; // e.g. "Take Profit (+10.2%)", "Stop Loss (-4.9%)", "Max Hold Days Reached"
  holdingPeriodDays: number;
  returnPct: number; // convenience alias
}

export interface BacktestResult {
  ticker: string;
  period: string;
  initialCapital: number;
  endingCapital: number;
  netProfit: number;
  totalReturnPct: number;
  benchmarkReturnPct: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRatePct: number;
  winRate: number; // convenience alias
  profitFactor: number;
  maxDrawdownPct: number;
  avgTradeReturnPct: number;
  avgWinPct: number;
  avgLossPct: number;
  equityCurve: {
    date: string;
    equity: number;
    benchmark: number;
  }[];
  trades: BacktestTrade[];
  // Optional walk-forward validation fields (populated by the dual-timeframe
  // single-ticker backtest; absent/undefined for the legacy universe backtest).
  strategyName?: string;
  isWalkForward?: boolean;
  inSample?: { trades: number; winRatePct: number; profitFactor: number; netReturnPct: number };
  outOfSample?: { trades: number; winRatePct: number; profitFactor: number; netReturnPct: number };
  overfittingWarning?: string;
}

export interface NewsItem {
  id: string;
  ticker: string;
  headline: string;
  source: string;
  publishedAt: string;
  url?: string;
  summary: string;
  catalystType: CatalystType;
  catalystConfidence: 'HIGH' | 'MEDIUM' | 'SPECULATIVE';
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  isTaggedCatalyst?: boolean;
}

export interface AppSettings {
  dataProvider: 'DEFAULT_SIMULATED' | 'FINNHUB';
  finnhubApiKey?: string;
  maxAlertsPerSession: number;
  soundAlertsEnabled: boolean;
  refreshIntervalSec: number;
  activeMode: 'LIVE_TRACKER' | 'PAPER_TRADING';
  defaultWatchlist: string[];
}
