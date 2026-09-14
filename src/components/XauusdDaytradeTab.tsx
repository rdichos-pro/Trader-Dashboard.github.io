import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { 
  Activity, 
  AlertCircle, 
  ArrowDownRight, 
  ArrowUpRight, 
  BarChart3,
  Bell, 
  Calendar,
  Check, 
  CheckCircle2, 
  ChevronDown,
  Clock, 
  Cloud, 
  Crosshair, 
  Columns,
  ExternalLink, 
  Eye, 
  Filter,
  Flame, 
  HelpCircle, 
  Layers, 
  Maximize2, 
  Minimize2,
  Pencil,
  Play, 
  Plus, 
  Radio,
  RefreshCw, 
  Rows,
  ShieldAlert, 
  ShieldCheck, 
  Sliders,
  Sparkles, 
  Square,
  Target, 
  TrendingDown, 
  TrendingUp, 
  Trophy,
  Volume2, 
  VolumeX, 
  X,
  XCircle,
  Zap 
} from 'lucide-react';
import { Candle, SignalAccuracyStats, SignalAlert, TickerQuote, PaperAccount, Position } from '../types/trading';
import { marketDataService } from '../services/marketDataService';
import { evaluateConfluenceDetails, ConfluenceEvaluationResult } from '../services/signalEngine';
import { PositionForecastDrawer } from './PositionForecastDrawer';
import { 
  evaluateMultiTimeframeConfluence, 
  runAllStrategiesBacktest, 
  StrategyPerformanceStats, 
  MultiTimeframeConfluenceState,
  FastTkSignalState,
  evaluateFastTkSignal,
  MarketRegimeType,
  BacktestTradeRecord
} from '../services/xauusdBacktestEngine';
import { TradingViewWidget } from './TradingViewWidget';
import { SignalCheckerCard } from './SignalCheckerCard';
import { formatCurrency, formatPercent } from '../utils/formatters';
import { 
  playSignalChime, 
  sendSystemNotification, 
  unlockAudio, 
  isAudioUnlocked,
  requestBrowserNotificationPermission,
  getNotificationPermission,
  createBackgroundWorkerTimer
} from '../utils/browserNotifications';

interface XauusdDaytradeTabProps {
  onOpenNewPositionWithTicker: (symbol: string, currentPrice: number) => void;
  xauusdSignals?: any[];
  onExecutePaperOrder?: (
    ticker: string,
    type: 'LONG' | 'SHORT',
    shares: number,
    price: number,
    stopPct?: number,
    targetPct?: number
  ) => void;
  onNavigateToTab?: (tab: string) => void;
  paperAccount?: PaperAccount;
  openPositions?: Position[];
}

export const XauusdDaytradeTab: React.FC<XauusdDaytradeTabProps> = ({
  onOpenNewPositionWithTicker,
  xauusdSignals = [],
  onExecutePaperOrder,
  onNavigateToTab,
  paperAccount,
  openPositions,
}) => {
  // Main view mode: 'live' (Live Dual Confluence + TV Chart) | 'backtest' (Strategy Optimizer & Accuracy Stats) | 'split' (Chart + Stats)
  const [viewMode, setViewMode] = useState<'live' | 'backtest' | 'split'>('live');

  // Mobile timeframe tab toggle: 'ALL' (Both 5M & 15M) | '5M' | '15M'
  const [mobilePillarView, setMobilePillarView] = useState<'ALL' | '5M' | '15M'>('ALL');

  // Timeframe selection for chart: '1', '5', '15', '30'
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1' | '5' | '15' | '30'>('1');
  const [chartInterval, setChartInterval] = useState<string>('1');
  const [isChartFullscreen, setIsChartFullscreen] = useState<boolean>(false);

  // Multi-chart split layout options: single, 2-split vertical (top/bottom), 2-split horizontal (side-by-side)
  const [chartLayout, setChartLayout] = useState<'single' | 'split-vertical' | 'split-horizontal'>('split-vertical');
  const [trendTimeframe, setTrendTimeframe] = useState<'30M' | '15M' | '1D'>('30M'); // Default to 30M reference as requested
  const [entryTimeframe, setEntryTimeframe] = useState<'1M' | '5M' | '1HR'>('1M'); // Default to 1M entry as requested
  const [chartIntervalTop, setChartIntervalTop] = useState<string>('30'); // 30M Macro Trend on top by default
  const [chartIntervalBottom, setChartIntervalBottom] = useState<string>('1'); // 1M Scalp Trigger on bottom by default
  const [showDrawingTools, setShowDrawingTools] = useState<boolean>(true);
  const [showForecastTool, setShowForecastTool] = useState<boolean>(false);

  // Selected trade state (from historical backtest or running paper positions)
  const [selectedTrade, setSelectedTrade] = useState<{
    id: string;
    direction: 'LONG' | 'SHORT' | 'BUY' | 'SELL';
    entryPrice: number;
    stopLossPrice?: number;
    targetPrice?: number;
    quantity?: number;
    amount?: number;
    isRunning?: boolean;
    exitPrice?: number;
    pnlDollar?: number;
    pnlPct?: number;
    isWin?: boolean;
    exitTime?: string;
    entryTime?: string;
  } | null>(null);

  const [customEntryPrice, setCustomEntryPrice] = useState<number | null>(null);
  const [customStopLossPrice, setCustomStopLossPrice] = useState<number | null>(null);
  const [customTargetPrice, setCustomTargetPrice] = useState<number | null>(null);
  const [tradeAmount, setTradeAmount] = useState<number>(10);
  
  // Market data state
  const [goldQuote, setGoldQuote] = useState<TickerQuote | null>(null);
  const [candles1m, setCandles1m] = useState<Candle[]>([]);
  const [candles5m, setCandles5m] = useState<Candle[]>([]);
  const [candles15m, setCandles15m] = useState<Candle[]>([]);
  const [candles30m, setCandles30m] = useState<Candle[]>([]);
  const [candles1h, setCandles1h] = useState<Candle[]>([]);
  const [candles1d, setCandles1d] = useState<Candle[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  // Audio chime & background notification states
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [showNotificationModal, setShowNotificationModal] = useState<boolean>(false);
  const [quickOrderNotice, setQuickOrderNotice] = useState<string | null>(null);

  // User Signal Checker Display Filter: 'AUTO' | 'BUY' | 'SELL' | 'CONSOLIDATION'
  const [signalFilterMode, setSignalFilterMode] = useState<'AUTO' | 'BUY' | 'SELL' | 'CONSOLIDATION'>('AUTO');
  const lastFiredAlertSignatureRef = useRef<string>('');
  const isInitialMountRef = useRef<boolean>(true);
  const [inTabSignalToast, setInTabSignalToast] = useState<{
    title: string;
    body: string;
    direction: 'BULLISH' | 'BEARISH';
    timestamp: number;
  } | null>(null);

  // Active Signal Strategy Model: 'DUAL_MASTER' (30M TK Cross + 1M Ichimoku) or 'FAST_TK' (1M Fast TK Cross)
  const [activeSignalStrategy, setActiveSignalStrategy] = useState<'DUAL_MASTER' | 'FAST_TK'>('DUAL_MASTER');

  // Strategy Optimizer & Backtest state
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>('strat-30m-tk-1m-ichimoku');
  const [tradeFilter, setTradeFilter] = useState<'ALL' | 'WINS' | 'LOSSES'>('ALL');
  const [isBacktesting, setIsBacktesting] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'SCORE' | 'WINRATE' | 'PROFIT_FACTOR' | 'NET_PROFIT'>('SCORE');

  // Check notification permission on mount
  useEffect(() => {
    setNotificationPermission(getNotificationPermission());
  }, []);

  // Sync chart interval when timeframe button is clicked
  const handleSelectTimeframe = (tf: '1' | '5' | '15' | '30') => {
    setSelectedTimeframe(tf);
    setChartInterval(tf);
  };

  // Fetch Gold quotes and candles across timeframes (1m 1-month, 5m, 15m, 30m 1-month, 1h, and 1D)
  const fetchGoldData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    setIsRefreshing(true);

    try {
      // 1. Fetch live quote for XAUUSD
      const quote = await marketDataService.getQuote('XAUUSD');
      setGoldQuote(quote);

      // 2. Parallel fetch candles across timeframes: 1-Month of 1M bars (32,000 candles), 1-Month of 30M bars, etc.
      const [c1, c5, c15, c30, c1h, c1d] = await Promise.all([
        marketDataService.getCandles('XAUUSD', '1M', '1', !isSilent),
        marketDataService.getCandles('XAUUSD', '1M', '5', !isSilent),
        marketDataService.getCandles('XAUUSD', '1M', '15', !isSilent),
        marketDataService.getCandles('XAUUSD', '1M', '30', !isSilent),
        marketDataService.getCandles('XAUUSD', '3M', '60', !isSilent),
        marketDataService.getCandles('XAUUSD', '1Y', 'D', !isSilent),
      ]);

      setCandles1m(c1);
      setCandles5m(c5);
      setCandles15m(c15);
      setCandles30m(c30);
      setCandles1h(c1h);
      setCandles1d(c1d);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching XAUUSD daytrade data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Use unthrottled Web Worker heartbeat timer for background updates
  useEffect(() => {
    fetchGoldData();
    // createBackgroundWorkerTimer is NOT throttled to 1 minute by browsers when the tab is in the background!
    const cleanupWorkerTimer = createBackgroundWorkerTimer(() => {
      fetchGoldData(true);
    }, 10000); // 10-second polling for active daytrading

    return () => {
      cleanupWorkerTimer();
    };
  }, [fetchGoldData]);

  // 1. Evaluate Individual Timeframe Confluences
  const confluence5m: ConfluenceEvaluationResult = useMemo(() => {
    if (!candles5m || candles5m.length === 0) {
      return evaluateConfluenceDetails('XAUUSD', []);
    }
    return evaluateConfluenceDetails('XAUUSD', candles5m);
  }, [candles5m]);

  const confluence15m: ConfluenceEvaluationResult = useMemo(() => {
    if (!candles15m || candles15m.length === 0) {
      return evaluateConfluenceDetails('XAUUSD', []);
    }
    return evaluateConfluenceDetails('XAUUSD', candles15m);
  }, [candles15m]);

  // Trend candles based on selected trend timeframe (30M or 15M or 1D) for chart displays
  const trendCandles = useMemo(() => {
    if (trendTimeframe === '30M') {
      return candles30m && candles30m.length > 0 ? candles30m : candles15m;
    }
    if (trendTimeframe === '15M') {
      return candles15m && candles15m.length > 0 ? candles15m : candles30m;
    }
    return candles1d && candles1d.length > 0 ? candles1d : candles30m;
  }, [trendTimeframe, candles30m, candles15m, candles1d]);

  // 2. Evaluate Multi-Timeframe Combined Confluence (1M Entry + 30M Reference TK Crossover)
  // Zero Stoch, Zero CCI: 30M TK Crossover (1 Pillar) + 1M 6-Rule Ichimoku (6 Pillars) = 7 Pillars Total
  const mtfConfluence: MultiTimeframeConfluenceState = useMemo(() => {
    const entryCandles = entryTimeframe === '1M' && candles1m.length > 0
      ? candles1m
      : (entryTimeframe === '5M' && candles5m.length > 0 ? candles5m : (candles1h && candles1h.length > 0 ? candles1h : candles30m));
    const macroCandles = trendTimeframe === '30M' && candles30m.length > 0
      ? candles30m
      : (trendTimeframe === '15M' && candles15m.length > 0 ? candles15m : (candles1d && candles1d.length > 0 ? candles1d : candles30m));
    return evaluateMultiTimeframeConfluence(entryCandles, macroCandles, entryTimeframe, trendTimeframe);
  }, [candles1m, candles5m, candles1h, candles30m, candles15m, candles1d, entryTimeframe, trendTimeframe]);

  // 2b. Evaluate Fast Tenkan-Kijun Cross strategy (Fast Scalper on 1M / 5M)
  const fastTkSignal: FastTkSignalState = useMemo(() => {
    const entryCandles = entryTimeframe === '1M' && candles1m.length > 0 
      ? candles1m 
      : (entryTimeframe === '5M' && candles5m.length > 0 ? candles5m : candles1h);
    return evaluateFastTkSignal(entryCandles);
  }, [candles1m, candles5m, candles1h, entryTimeframe]);

  // 3. Run Strategy Optimizer & Accuracy Stats Backtest over 1 Month of 1M entry bars + 30M reference bars
  const backtestResults = useMemo(() => {
    const entryCandles = entryTimeframe === '1M' && candles1m.length > 0 
      ? candles1m 
      : (entryTimeframe === '5M' && candles5m.length > 0 ? candles5m : (candles1h && candles1h.length > 0 ? candles1h : candles30m));
    const macroCandles = trendTimeframe === '30M' && candles30m.length > 0 
      ? candles30m 
      : (trendTimeframe === '15M' && candles15m.length > 0 ? candles15m : (candles1d && candles1d.length > 0 ? candles1d : candles30m));
    return runAllStrategiesBacktest(entryCandles, macroCandles, 10000, trendTimeframe, entryTimeframe);
  }, [candles1m, candles5m, candles1h, candles30m, candles15m, candles1d, trendTimeframe, entryTimeframe]);

  // Sorted strategy list based on user filter
  const sortedStrategies = useMemo(() => {
    const list = [...backtestResults.rankedStrategies];
    if (sortBy === 'WINRATE') {
      list.sort((a, b) => b.winRatePct - a.winRatePct);
    } else if (sortBy === 'PROFIT_FACTOR') {
      list.sort((a, b) => b.profitFactor - a.profitFactor);
    } else if (sortBy === 'NET_PROFIT') {
      list.sort((a, b) => b.netProfitDollar - a.netProfitDollar);
    } else {
      list.sort((a, b) => b.compositeScore - a.compositeScore);
    }
    return list;
  }, [backtestResults, sortBy]);

  // Selected Strategy for Deep Dive
  const currentSelectedStrategy: StrategyPerformanceStats = useMemo(() => {
    return (
      backtestResults.rankedStrategies.find(s => s.id === selectedStrategyId) ||
      backtestResults.topStrategy
    );
  }, [backtestResults, selectedStrategyId]);

  // Filtered trades for the selected strategy
  const filteredTrades = useMemo(() => {
    if (!currentSelectedStrategy) return [];
    if (tradeFilter === 'WINS') {
      return currentSelectedStrategy.trades.filter(t => t.isWin);
    }
    if (tradeFilter === 'LOSSES') {
      return currentSelectedStrategy.trades.filter(t => !t.isWin);
    }
    return currentSelectedStrategy.trades;
  }, [currentSelectedStrategy, tradeFilter]);

  // Active confluence based on selected single timeframe (for quick reference)
  const activeConfluence = selectedTimeframe === '5' ? confluence5m : confluence15m;

  // Effective regime for display and alert (respects user dropdown selection)
  const effectiveRegime: MarketRegimeType = 
    signalFilterMode === 'AUTO' ? mtfConfluence.marketRegime : signalFilterMode;

  // Auto-dismiss in-tab signal toast after 8 seconds
  useEffect(() => {
    if (!inTabSignalToast) return;
    const timer = setTimeout(() => {
      setInTabSignalToast(null);
    }, 8000);
    return () => clearTimeout(timer);
  }, [inTabSignalToast]);

  // Sound chime & background notification trigger on signal changes (respects activeSignalStrategy)
  // FIX: Uses lastFiredAlertSignatureRef, isInitialMountRef, and filters alerts by signalFilterMode
  useEffect(() => {
    if (!soundEnabled) return;
    if (candles5m.length === 0 || candles15m.length === 0 || isLoading) return;

    let alertSignature = '';
    let shouldChime: 'BULLISH' | 'BEARISH' | 'WARNING' | null = null;
    let notifTitle = '';
    let notifBody = '';
    let notifDir: 'BULLISH' | 'BEARISH' = 'BULLISH';

    if (activeSignalStrategy === 'DUAL_MASTER') {
      if (!mtfConfluence || mtfConfluence.time5m === 'INITIALIZING') return;
      const status = mtfConfluence.alignmentStatus;
      const trig = mtfConfluence.isEntryTriggered ? 'TRIG_BUY' : mtfConfluence.isSellEntryTriggered ? 'TRIG_SELL' : 'WAIT';
      // Unique alert signature tied to strategy, status, trigger condition, and bar timestamp
      alertSignature = `DUAL_${status}_${trig}_${mtfConfluence.time5m}`;

      if (status === 'DUAL_MASTER_BUY') {
        shouldChime = 'BULLISH';
        notifDir = 'BULLISH';
        notifTitle = '🚨 XAUUSD 1D TK CROSS + 1HR ICHIMOKU BUY';
        notifBody = `All 7/7 Confluences confirmed (1D TK Golden Cross + 1HR Ichimoku)! Gold: $${(mtfConfluence.price ?? currentSpotPrice ?? 0).toFixed(2)}. ${mtfConfluence.isEntryTriggered ? 'Trigger confirmed over last 1HR close.' : 'Awaiting breakout.'}`;
      } else if (status === 'DUAL_MASTER_SELL' || status === 'STRONG_SELL_SYNC') {
        shouldChime = 'BEARISH';
        notifDir = 'BEARISH';
        notifTitle = '🚨 XAUUSD 1D TK DEATH CROSS + 1HR ICHIMOKU SHORT';
        notifBody = `Bearish Confluence confirmed (${mtfConfluence.totalSellPillarsPassed}/7)! Gold: $${(mtfConfluence.price ?? currentSpotPrice ?? 0).toFixed(2)}. ${mtfConfluence.isSellEntryTriggered ? 'Trigger confirmed under last 1HR close.' : 'Awaiting breakdown.'}`;
      } else if (mtfConfluence.isExitTriggered || status === 'DUAL_MASTER_EXIT') {
        shouldChime = 'BEARISH';
        notifDir = 'BEARISH';
        notifTitle = '🚨 XAUUSD 1HR REVERSAL EXIT TRIGGERED';
        notifBody = `Price dropped below 1st closed bar ($${(mtfConfluence.reversalCrossBarClose || 0).toFixed(2)}) after Tenkan-Kijun reversal cross! Gold: $${(mtfConfluence.price ?? currentSpotPrice ?? 0).toFixed(2)}. Exit long.`;
      }
    } else {
      // FAST_TK Strategy
      if (!fastTkSignal || fastTkSignal.time === 'INITIALIZING') return;
      const status = fastTkSignal.alignmentStatus;
      const trig = fastTkSignal.isEntryTriggered ? 'TRIG_BUY' : fastTkSignal.isSellEntryTriggered ? 'TRIG_SELL' : 'WAIT';
      alertSignature = `FAST_${status}_${trig}_${fastTkSignal.time}`;

      if (status === 'FAST_TK_BUY') {
        shouldChime = 'BULLISH';
        notifDir = 'BULLISH';
        notifTitle = '⚡ XAUUSD 1HR FAST TK CROSS BUY';
        notifBody = `1HR Tenkan > Kijun with price above Kijun confirmed! Trigger > $${(fastTkSignal.lastSignalBarClose ?? currentSpotPrice ?? 0).toFixed(2)}`;
      } else if (status === 'FAST_TK_SELL') {
        shouldChime = 'BEARISH';
        notifDir = 'BEARISH';
        notifTitle = '⚡ XAUUSD 1HR FAST TK DEATH CROSS SHORT';
        notifBody = `1HR Tenkan < Kijun with price below Kijun confirmed! Trigger < $${(fastTkSignal.lastSellSignalBarClose ?? currentSpotPrice ?? 0).toFixed(2)}`;
      } else if (fastTkSignal.isExitTriggered || status === 'FAST_TK_EXIT') {
        shouldChime = 'BEARISH';
        notifDir = 'BEARISH';
        notifTitle = '🚨 XAUUSD 1HR FAST TK REVERSAL EXIT';
        notifBody = `Price dropped below 1st closed bar ($${(fastTkSignal.reversalCrossBarClose || 0).toFixed(2)}) after reversal cross! Gold: $${(fastTkSignal.price ?? currentSpotPrice ?? 0).toFixed(2)}. Exit long.`;
      }
    }

    // Suppress alerts that conflict with user's explicit filter mode
    if (signalFilterMode === 'BUY' && (shouldChime === 'BEARISH' || notifDir === 'BEARISH')) {
      shouldChime = null;
      notifTitle = '';
    } else if (signalFilterMode === 'SELL' && (shouldChime === 'BULLISH' || notifDir === 'BULLISH')) {
      shouldChime = null;
      notifTitle = '';
    } else if (signalFilterMode === 'CONSOLIDATION') {
      shouldChime = null;
      notifTitle = '';
    }

    // Initial mount check: do not chime on initial tab load or historical bar
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      lastFiredAlertSignatureRef.current = alertSignature;
      return;
    }

    // Only fire chime and notification when signature actually changes (eliminates repeated pings)
    if (alertSignature && alertSignature !== lastFiredAlertSignatureRef.current) {
      lastFiredAlertSignatureRef.current = alertSignature;
      if (shouldChime && notifTitle) {
        playSignalChime(shouldChime);
        setInTabSignalToast({
          title: notifTitle,
          body: notifBody,
          direction: notifDir,
          timestamp: Date.now(),
        });
        sendSystemNotification(notifTitle, {
          body: notifBody,
          direction: notifDir,
          playSound: false, // Prevents duplicate browser notification audio
        });
      }
    }
  }, [
    activeSignalStrategy,
    soundEnabled,
    signalFilterMode,
    isLoading,
    candles5m.length,
    candles15m.length,
    mtfConfluence?.alignmentStatus,
    mtfConfluence?.isEntryTriggered,
    mtfConfluence?.isSellEntryTriggered,
    mtfConfluence?.time5m,
    fastTkSignal?.alignmentStatus,
    fastTkSignal?.isEntryTriggered,
    fastTkSignal?.isSellEntryTriggered,
    fastTkSignal?.time,
  ]);

  // Current Price & 24h stats
  const currentSpotPrice = goldQuote?.price || mtfConfluence.price || 2515.40;
  const dayChange = goldQuote?.change ?? 0;
  const dayChangePct = goldQuote?.changePercent ?? 0;

  // Dynamic Stop Loss based on Kijun-sen or Cloud bottom (Long)
  const dynamicStopLoss = useMemo(() => {
    const kijunVal = activeConfluence.kijun;
    const cloudBotVal = activeConfluence.cloudBottom;
    if (kijunVal > 0 && cloudBotVal > 0) {
      return Number(Math.min(kijunVal, cloudBotVal).toFixed(2));
    }
    return Number((currentSpotPrice * 0.995).toFixed(2));
  }, [activeConfluence, currentSpotPrice]);

  // Dynamic Stop Loss based on Kijun-sen or Cloud top (Short)
  const dynamicShortStopLoss = useMemo(() => {
    const kijunVal = activeConfluence.kijun;
    const cloudTopVal = activeConfluence.cloudTop;
    if (kijunVal > 0 && cloudTopVal > 0) {
      return Number(Math.max(kijunVal, cloudTopVal).toFixed(2));
    }
    return Number((currentSpotPrice * 1.005).toFixed(2));
  }, [activeConfluence, currentSpotPrice]);

  const riskPerOunce = Math.max(2.0, currentSpotPrice - dynamicStopLoss);
  const target1Price = Number((currentSpotPrice + riskPerOunce * 1.5).toFixed(2));
  const target2Price = Number((currentSpotPrice + riskPerOunce * 2.5).toFixed(2));

  const shortRiskPerOunce = Math.max(2.0, dynamicShortStopLoss - currentSpotPrice);
  const shortTarget1Price = Number((currentSpotPrice - shortRiskPerOunce * 1.5).toFixed(2));
  const shortTarget2Price = Number((currentSpotPrice - shortRiskPerOunce * 2.5).toFixed(2));

  // Active running paper trades on XAUUSD
  const runningPaperTrades = useMemo(() => {
    if (!paperAccount?.positions) return [];
    return paperAccount.positions.filter(p => p.ticker.toUpperCase() === 'XAUUSD');
  }, [paperAccount?.positions]);

  // Closed gold trade log — kept separate from the stock Trade Journal (Positions & Exits)
  // since XAUUSD trades reference a different timeframe pair (5M entry / 30M trend) than
  // stocks (1HR entry / 1D macro), and mixing them in one list obscures that distinction.
  const closedGoldTrades = useMemo(() => {
    if (!paperAccount?.history) return [];
    return paperAccount.history
      .filter(p => p.ticker.toUpperCase() === 'XAUUSD')
      .sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime());
  }, [paperAccount?.history]);

  // Handle selecting/clicking a trade (from historical backtest or running paper positions)
  const handleSelectTrade = (trade: BacktestTradeRecord | Position | any) => {
    const isRunning = Boolean(
      trade.isRunning ||
      trade.status === 'RUNNING' ||
      trade.exitTime === 'RUNNING (LIVE)' ||
      trade.unrealizedPnlDollars !== undefined
    );
    
    const dir = trade.direction || (trade.type === 'SHORT' ? 'SHORT' : 'LONG');
    const isShort = dir === 'SHORT' || dir === 'SELL';
    const entry = Number(trade.entryPrice.toFixed(2));
    
    // Automatically update stop loss price
    const sl = trade.stopLossPrice != null && trade.stopLossPrice > 0
      ? Number(trade.stopLossPrice.toFixed(2))
      : Number((isShort ? entry + 8.0 : entry - 8.0).toFixed(2));
      
    // Target price
    const tp = trade.targetPrice != null && trade.targetPrice > 0
      ? Number(trade.targetPrice.toFixed(2))
      : Number((isShort ? entry - 16.0 : entry + 16.0).toFixed(2));

    // Reset amount to zero, except for running trades!
    const resolvedAmount = isRunning ? (trade.quantity ?? trade.amount ?? 10) : 0;

    setSelectedTrade({
      id: trade.id || `trade-${Date.now()}`,
      direction: dir,
      entryPrice: entry,
      stopLossPrice: sl,
      targetPrice: tp,
      quantity: resolvedAmount,
      amount: resolvedAmount,
      isRunning,
      exitPrice: trade.exitPrice,
      pnlDollar: trade.pnlDollar ?? trade.unrealizedPnlDollars,
      pnlPct: trade.pnlPct ?? trade.unrealizedPnlPercent,
      isWin: trade.isWin,
      exitTime: trade.exitTime,
      entryTime: trade.entryTime,
    });

    // Automatically update entry and stop loss price
    setCustomEntryPrice(entry);
    setCustomStopLossPrice(sl);
    setCustomTargetPrice(tp);
    setTradeAmount(resolvedAmount);

    // Reflect on chart: automatically open & sync forecast tool and chart HUD
    setShowForecastTool(true);
  };

  const handleClearSelectedTrade = () => {
    setSelectedTrade(null);
    setCustomEntryPrice(null);
    setCustomStopLossPrice(null);
    setCustomTargetPrice(null);
    setTradeAmount(10);
  };

  // Quick trade execution via Paper Trading
  const handleQuickTrade = (
    direction: 'LONG' | 'SHORT',
    overrideEntry?: number,
    overrideSl?: number,
    overrideAmount?: number
  ) => {
    const entry = overrideEntry ?? customEntryPrice ?? currentSpotPrice;
    const sl = overrideSl ?? (direction === 'LONG' ? (customStopLossPrice ?? dynamicStopLoss) : (customStopLossPrice ?? dynamicShortStopLoss));
    const risk = Math.max(1.0, Math.abs(entry - sl));
    const tp = direction === 'LONG' ? entry + risk * 2 : entry - risk * 2;
    const riskPct = Number(((risk / entry) * 100).toFixed(2));
    const targetPct = Number(((Math.abs(tp - entry) / entry) * 100).toFixed(2));
    const finalAmount = overrideAmount !== undefined && overrideAmount > 0 
      ? overrideAmount 
      : tradeAmount > 0 
      ? tradeAmount 
      : 10;

    const orderCost = finalAmount * entry;
    if (paperAccount && orderCost > paperAccount.balance) {
      setQuickOrderNotice(
        `Insufficient paper balance! This ${finalAmount}oz order requires ${formatCurrency(orderCost)} but available balance is ${formatCurrency(paperAccount.balance)}.`
      );
      setTimeout(() => setQuickOrderNotice(null), 6000);
      return;
    }
    
    if (onExecutePaperOrder) {
      onExecutePaperOrder('XAUUSD', direction, finalAmount, entry, riskPct, targetPct);
      setQuickOrderNotice(
        `Executed ${finalAmount} oz Gold ${direction} order at $${entry.toFixed(2)} with stop loss at $${sl.toFixed(2)}.`
      );
      setTimeout(() => setQuickOrderNotice(null), 6000);
    } else {
      onOpenNewPositionWithTicker('XAUUSD', entry);
    }
  };

  // Re-run backtest button handler
  const handleTriggerBacktest = () => {
    setIsBacktesting(true);
    setTimeout(() => {
      fetchGoldData(true);
      setIsBacktesting(false);
    }, 600);
  };

  // Request browser notification permissions
  const handleRequestNotifications = async () => {
    await unlockAudio();
    const perm = await requestBrowserNotificationPermission();
    setNotificationPermission(perm);
    if (perm === 'granted') {
      sendSystemNotification('XAUUSD Background Alerts Activated', {
        body: 'Audio chimes and system notifications will alert you even if this tab is running in the background or minimized.',
        direction: 'BULLISH',
        playSound: true,
      });
    }
  };

  // Test sound chime
  const handleTestAudio = async () => {
    await unlockAudio();
    playSignalChime('BULLISH');
  };

  return (
    <div className="space-y-4 max-w-full pb-20 sm:pb-4">
      {/* Toast Notice for Quick Paper Execution */}
      {quickOrderNotice && (
        <div className="bg-emerald-900/90 border border-emerald-500 text-emerald-100 px-4 py-2.5 rounded-xl shadow-lg flex items-center justify-between text-xs sm:text-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
            <span>{quickOrderNotice}</span>
          </div>
          {onNavigateToTab && (
            <button
              onClick={() => onNavigateToTab('paper')}
              className="text-xs underline hover:text-white font-mono"
            >
              View in Paper Account →
            </button>
          )}
        </div>
      )}

      {/* Visible In-App Notification Toast for Signal Pings */}
      {inTabSignalToast && (
        <div
          id="xauusd-live-signal-toast"
          className={`px-4 py-3 rounded-xl border flex items-center justify-between gap-3 shadow-xl animate-in fade-in slide-in-from-top-2 duration-300 ${
            inTabSignalToast.direction === 'BULLISH'
              ? 'bg-emerald-950/95 border-emerald-500/60 text-emerald-100'
              : 'bg-rose-950/95 border-rose-500/60 text-rose-100'
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`w-3.5 h-3.5 rounded-full shrink-0 animate-ping ${
                inTabSignalToast.direction === 'BULLISH' ? 'bg-emerald-400' : 'bg-rose-400'
              }`}
            />
            <div>
              <div className="font-bold text-xs sm:text-sm text-white flex items-center gap-2">
                <span>{inTabSignalToast.title}</span>
                <span className="text-[10px] font-mono opacity-70">
                  {new Date(inTabSignalToast.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
              <div className="text-[11px] sm:text-xs opacity-90 mt-0.5">{inTabSignalToast.body}</div>
            </div>
          </div>
          <button
            id="dismiss-xauusd-signal-toast-btn"
            onClick={() => setInTabSignalToast(null)}
            className="text-xs px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-200 shrink-0 font-medium transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* BACKGROUND ALERTS & AUDIO CONTROL BANNER */}
      {/* ========================================================================= */}
      <div className="bg-[#121620] border border-slate-800 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
            <Radio className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-bold text-white">
                Background Audio &amp; System Alerts
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/40 font-bold">
                ⚡ Unthrottled Worker Active
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
              Notification sounds and lockscreen alerts trigger reliably even when this tab is in the background or minimized.
            </p>
          </div>
        </div>

        {/* Action Controls for Audio & Notifications */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleTestAudio}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors touch-manipulation min-h-[38px]"
            title="Play sample chime to confirm audio is active"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Test Sound</span>
          </button>

          {notificationPermission !== 'granted' ? (
            <button
              onClick={handleRequestNotifications}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow transition-colors touch-manipulation min-h-[38px]"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Enable Background Alerts</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Background Alerts Active</span>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TOP HEADER CARD: Asset Info, Live Quote & View Switcher */}
      {/* ========================================================================= */}
      <div className="bg-[#161B22] border border-slate-800 rounded-xl p-3.5 sm:p-5 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="flex flex-col gap-3 sm:gap-4 relative z-10">
          {/* Row 1: Asset Info & Live Price */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-600/10 border border-amber-500/30 flex items-center justify-center text-amber-300 font-black text-base sm:text-lg shadow-inner">
                AU
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-2xl font-black text-white tracking-tight flex items-center gap-1.5 sm:gap-2">
                    XAU/USD
                    <span className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 tracking-normal">
                      Gold Daytrade
                    </span>
                  </h1>
                </div>
                <div className="text-[11px] sm:text-xs text-slate-400 flex items-center gap-1.5 sm:gap-2 mt-0.5 flex-wrap">
                  <span className="text-amber-300 font-semibold">{entryTimeframe} Entry + {trendTimeframe} Reference TK Cross (Pure Ichimoku)</span>
                  <span>•</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-0.5">
                    <Check className="w-3 h-3" /> 1-Month Optimizer
                  </span>
                  <span>•</span>
                  <span className="font-mono text-[10px] sm:text-[11px] text-slate-500">
                    {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>

            {/* Price Pill */}
            <div className="flex items-baseline gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800">
              <span className="text-xl sm:text-3xl font-black text-white font-mono tracking-tight">
                ${(currentSpotPrice ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className={`text-[11px] sm:text-xs font-bold font-mono flex items-center ${(dayChange ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {(dayChange ?? 0) >= 0 ? <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> : <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />}
                {(dayChange ?? 0) >= 0 ? `+${(dayChange ?? 0).toFixed(2)}` : (dayChange ?? 0).toFixed(2)} ({formatPercent(dayChangePct)})
              </span>
            </div>
          </div>

          {/* Row 2: View Switcher Tabs & Trend/Entry Timeframe Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-800/80">
            {/* View Mode Switcher: Mobile Segmented Control */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="grid grid-cols-2 sm:flex sm:items-center bg-slate-900 rounded-xl p-1 border border-slate-800 w-full sm:w-auto">
                <button
                  onClick={() => setViewMode('live')}
                  className={`py-2 px-3 sm:px-3.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 touch-manipulation min-h-[42px] ${
                    viewMode === 'live'
                      ? 'bg-amber-500 text-slate-950 shadow font-black'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Live {entryTimeframe}+{trendTimeframe}</span>
                </button>
                <button
                  onClick={() => setViewMode('backtest')}
                  className={`py-2 px-3 sm:px-3.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 touch-manipulation min-h-[42px] ${
                    viewMode === 'backtest'
                      ? 'bg-amber-500 text-slate-950 shadow font-black'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Trophy className="w-3.5 h-3.5 text-amber-300" />
                  <span>Strategy Optimizer</span>
                </button>
                <button
                  onClick={() => setViewMode('split')}
                  className={`hidden md:flex py-2 px-3.5 rounded-lg text-xs font-bold transition-all items-center justify-center gap-1.5 ${
                    viewMode === 'split'
                      ? 'bg-amber-500 text-slate-950 shadow font-black'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Split View</span>
                </button>
              </div>

              {/* Entry Timeframe Controls */}
              <div className="flex items-center bg-slate-900 rounded-xl p-1 border border-slate-800 text-xs font-mono">
                <span className="text-cyan-400 px-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">
                  Entry:
                </span>
                {(['1M', '5M', '1HR'] as const).map(tf => (
                  <button
                    key={tf}
                    onClick={() => {
                      setEntryTimeframe(tf);
                      setChartIntervalBottom(tf === '1M' ? '1' : tf === '5M' ? '5' : '60');
                      if (chartLayout === 'single') {
                        setChartInterval(tf === '1M' ? '1' : tf === '5M' ? '5' : '60');
                      }
                    }}
                    className={`py-1 px-2.5 rounded-lg text-xs font-bold transition-all min-h-[36px] ${
                      entryTimeframe === tf
                        ? 'bg-cyan-500 text-slate-950 shadow font-black'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>

              {/* Reference / Trend Timeframe Selection */}
              <div className="flex items-center bg-slate-900 rounded-xl p-1 border border-slate-800 text-xs font-mono">
                <span className="text-amber-400 px-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">
                  Ref Trend:
                </span>
                {(['30M', '15M', '1D'] as const).map(tf => (
                  <button
                    key={tf}
                    onClick={() => {
                      setTrendTimeframe(tf);
                      setChartIntervalTop(tf === '30M' ? '30' : tf === '15M' ? '15' : 'D');
                    }}
                    className={`py-1 px-2.5 rounded-lg text-xs font-bold transition-all min-h-[36px] ${
                      trendTimeframe === tf
                        ? 'bg-amber-500 text-slate-950 shadow font-black'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center justify-between sm:justify-end gap-2">
              {/* Sound Toggle */}
              <button
                onClick={() => {
                  unlockAudio();
                  setSoundEnabled(!soundEnabled);
                }}
                title={soundEnabled ? 'Mute Signal Audio Chimes' : 'Enable Signal Audio Chimes'}
                className={`p-2.5 rounded-lg border transition-colors touch-manipulation min-h-[42px] min-w-[42px] flex items-center justify-center ${
                  soundEnabled 
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' 
                    : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                }`}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>

              {/* Refresh Button */}
              <button
                onClick={() => fetchGoldData(false)}
                disabled={isRefreshing}
                title="Refresh Quotes and Candles"
                className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50 touch-manipulation min-h-[42px] min-w-[42px] flex items-center justify-center"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
              </button>

              {/* Quick Log Trade */}
              <button
                onClick={() => onOpenNewPositionWithTicker('XAUUSD', currentSpotPrice)}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md transition-colors touch-manipulation min-h-[42px]"
              >
                <Plus className="w-4 h-4" />
                <span>Log Trade</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. DUAL 5M + 15M CONFLUENCE BANNER (SHOWN IN LIVE & SPLIT VIEWS) */}
      {/* ========================================================================= */}
      {(viewMode === 'live' || viewMode === 'split') && (
        <SignalCheckerCard
          signalFilterMode={signalFilterMode}
          onSignalFilterModeChange={setSignalFilterMode}
          activeSignalStrategy={activeSignalStrategy}
          onSelectStrategy={setActiveSignalStrategy}
          mtfConfluence={mtfConfluence}
          fastTkSignal={fastTkSignal}
          currentSpotPrice={currentSpotPrice}
          dynamicStopLoss={dynamicStopLoss}
          dynamicShortStopLoss={dynamicShortStopLoss}
          target1Price={target1Price}
          target2Price={target2Price}
          shortTarget1Price={shortTarget1Price}
          shortTarget2Price={shortTarget2Price}
          onQuickTrade={handleQuickTrade}
        />
      )}

      {/* ========================================================================= */}
      {/* 2. STRATEGY OPTIMIZER & ACCURACY STATS ("WHAT STRATEGY HAS THE MOST STATS") */}
      {/* ========================================================================= */}
      {(viewMode === 'backtest' || viewMode === 'split') && (
        <div className="space-y-4">
          {/* Winner Banner: Declares the strategy with the most stats */}
          <div className="bg-gradient-to-r from-amber-950/90 via-[#1C180A] to-slate-900 border-2 border-amber-500/60 rounded-xl p-3.5 sm:p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
              <div className="flex items-start gap-3 sm:gap-3.5">
                <div className="p-2.5 sm:p-3 rounded-2xl bg-amber-500/20 border border-amber-500/50 text-amber-300 shadow-inner shrink-0">
                  <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-amber-400 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] sm:text-xs font-black px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 uppercase tracking-wide">
                      #1 Top Performing Strategy
                    </span>
                    <span className="text-[10px] sm:text-xs text-amber-300/90 font-mono flex items-center gap-1.5 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                      <Calendar className="w-3 h-3 text-amber-400" />
                      {backtestResults.periodLabel || 'Last Week (Aug 31 – Sep 5, 2026)'}
                    </span>
                  </div>
                  <h2 className="text-base sm:text-2xl font-black text-white tracking-tight mt-1">
                    {backtestResults.topStrategy.name}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl leading-relaxed">
                    All strategies strictly enforce that <strong>entries must trade over the last candle close with all confluences</strong> (Buy Stop breakout confirmation). Requiring higher-timeframe trend alignment plus candle breakout verification protects against false reversals and gap-down traps.
                  </p>
                </div>
              </div>

              {/* Top Stats Highlight Cards */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3 shrink-0">
                <div className="bg-slate-950/80 border border-amber-500/40 rounded-xl p-2 sm:p-3 text-center">
                  <span className="text-[9px] sm:text-[10px] text-slate-400 block font-semibold uppercase">Win Rate</span>
                  <span className="text-lg sm:text-2xl font-black text-emerald-400 font-mono">
                    {backtestResults.topStrategy.winRatePct}%
                  </span>
                  <span className="text-[9px] sm:text-[10px] text-slate-500 block font-mono">
                    {backtestResults.topStrategy.winningTrades}W / {backtestResults.topStrategy.losingTrades}L
                  </span>
                </div>

                <div className="bg-slate-950/80 border border-amber-500/40 rounded-xl p-2 sm:p-3 text-center">
                  <span className="text-[9px] sm:text-[10px] text-slate-400 block font-semibold uppercase">Profit Factor</span>
                  <span className="text-lg sm:text-2xl font-black text-amber-300 font-mono">
                    {backtestResults.topStrategy.profitFactor}x
                  </span>
                  <span className="text-[9px] sm:text-[10px] text-slate-500 block font-mono">
                    {backtestResults.topStrategy.winLossRatio}x R:R
                  </span>
                </div>

                <div className="bg-slate-950/80 border border-amber-500/40 rounded-xl p-2 sm:p-3 text-center">
                  <span className="text-[9px] sm:text-[10px] text-slate-400 block font-semibold uppercase">Net Profit</span>
                  <span className={`text-lg sm:text-2xl font-black font-mono ${backtestResults.topStrategy.netProfitDollar >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {backtestResults.topStrategy.netProfitDollar >= 0 
                      ? `+$${backtestResults.topStrategy.netProfitDollar.toLocaleString()}` 
                      : `-$${Math.abs(backtestResults.topStrategy.netProfitDollar).toLocaleString()}`}
                  </span>
                  <span className={`text-[9px] sm:text-[10px] block font-mono ${backtestResults.topStrategy.netProfitPct >= 0 ? 'text-emerald-400/80' : 'text-rose-400/80'}`}>
                    {backtestResults.topStrategy.netProfitPct >= 0 
                      ? `+${backtestResults.topStrategy.netProfitPct}%` 
                      : `${backtestResults.topStrategy.netProfitPct}%`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Strategy Optimizer Leaderboard Table */}
          <div className="bg-[#161B22] border border-slate-800 rounded-xl shadow-xl overflow-hidden">
            <div className="p-3.5 sm:p-4 bg-slate-900/80 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-amber-400" />
                  Strategy Leaderboard (Ranked by Stats)
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-400">
                  Click any strategy below to inspect its equity curve, entry/exit blueprint, and trade log.
                </p>
              </div>

              {/* Sort controls, Entry & Trend Timeframes & Re-run button */}
              <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-end">
                {/* Entry Timeframe toggle for backtest */}
                <div className="flex items-center bg-slate-950 rounded-lg p-1 border border-slate-800 text-xs">
                  <span className="text-cyan-400 px-1.5 font-mono text-[9px] sm:text-[10px]">ENTRY:</span>
                  {(['1M', '5M', '1HR'] as const).map(tf => (
                    <button
                      key={tf}
                      onClick={() => {
                        setEntryTimeframe(tf);
                        setChartIntervalBottom(tf === '1M' ? '1' : tf === '5M' ? '5' : '60');
                      }}
                      className={`px-2 py-1 rounded font-semibold text-[11px] touch-manipulation ${entryTimeframe === tf ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>

                {/* Reference Trend Timeframe toggle for backtest */}
                <div className="flex items-center bg-slate-950 rounded-lg p-1 border border-slate-800 text-xs">
                  <span className="text-amber-400 px-1.5 font-mono text-[9px] sm:text-[10px]">REF:</span>
                  {(['30M', '15M', '1D'] as const).map(tf => (
                    <button
                      key={tf}
                      onClick={() => {
                        setTrendTimeframe(tf);
                        setChartIntervalTop(tf === '30M' ? '30' : tf === '15M' ? '15' : 'D');
                      }}
                      className={`px-2 py-1 rounded font-semibold text-[11px] touch-manipulation ${trendTimeframe === tf ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>

                <div className="flex items-center bg-slate-950 rounded-lg p-1 border border-slate-800 text-xs">
                  <span className="text-slate-500 px-1.5 font-mono text-[9px] sm:text-[10px]">SORT:</span>
                  <button
                    onClick={() => setSortBy('SCORE')}
                    className={`px-2 py-1 rounded font-semibold text-[11px] touch-manipulation ${sortBy === 'SCORE' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
                  >
                    Score
                  </button>
                  <button
                    onClick={() => setSortBy('WINRATE')}
                    className={`px-2 py-1 rounded font-semibold text-[11px] touch-manipulation ${sortBy === 'WINRATE' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
                  >
                    Win%
                  </button>
                  <button
                    onClick={() => setSortBy('PROFIT_FACTOR')}
                    className={`px-2 py-1 rounded font-semibold text-[11px] touch-manipulation ${sortBy === 'PROFIT_FACTOR' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'}`}
                  >
                    PF
                  </button>
                </div>

                <button
                  onClick={handleTriggerBacktest}
                  disabled={isBacktesting}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50 touch-manipulation min-h-[36px]"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isBacktesting ? 'animate-spin' : ''}`} />
                  <span>Re-Run</span>
                </button>
              </div>
            </div>

            {/* Mobile View: High-Density Strategy Cards (< md) */}
            <div className="md:hidden p-3 space-y-2.5">
              {sortedStrategies.map((strat, idx) => {
                const isSelected = strat.id === selectedStrategyId;
                const isTop = strat.id === backtestResults.topStrategy.id;

                return (
                  <div
                    key={`mob-strat-${strat.id}`}
                    onClick={() => setSelectedStrategyId(strat.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500/50 shadow-md'
                        : 'bg-slate-900/50 border-slate-800/80 hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full font-black text-[10px] ${
                          idx === 0 
                            ? 'bg-amber-500 text-slate-950' 
                            : idx === 1 
                            ? 'bg-slate-300 text-slate-950' 
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {idx + 1}
                        </span>
                        <div>
                          <span className="font-bold text-white text-xs block">{strat.name}</span>
                          <span className="text-[9px] font-mono text-amber-400/90">{strat.timeframeTag}</span>
                        </div>
                      </div>

                      {isTop && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-black flex items-center gap-0.5">
                          <Trophy className="w-2.5 h-2.5" /> TOP
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 mt-2.5 pt-2 border-t border-slate-800/60 font-mono text-center">
                      <div className="bg-slate-950/60 p-1 rounded">
                        <span className="text-[8px] text-slate-500 block">Win Rate</span>
                        <span className="text-xs font-black text-emerald-400">{strat.winRatePct}%</span>
                      </div>
                      <div className="bg-slate-950/60 p-1 rounded">
                        <span className="text-[8px] text-slate-500 block">Profit Factor</span>
                        <span className="text-xs font-black text-amber-300">{strat.profitFactor}x</span>
                      </div>
                      <div className="bg-slate-950/60 p-1 rounded">
                        <span className="text-[8px] text-slate-500 block">Trades</span>
                        <span className="text-xs font-bold text-slate-300">{strat.totalTrades}</span>
                      </div>
                      <div className="bg-slate-950/60 p-1 rounded">
                        <span className="text-[8px] text-slate-500 block">Net PnL</span>
                        <span className={`text-xs font-black ${strat.netProfitDollar >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {strat.netProfitDollar >= 0 ? `+$${strat.netProfitDollar}` : `-$${Math.abs(strat.netProfitDollar)}`}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop View: Full Leaderboard Table (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-mono border-b border-slate-800 text-[10px]">
                    <th className="py-2.5 px-4">Rank</th>
                    <th className="py-2.5 px-4">Strategy &amp; Indicator Combo</th>
                    <th className="py-2.5 px-4 text-center">Timeframe</th>
                    <th className="py-2.5 px-4 text-right">Win Rate</th>
                    <th className="py-2.5 px-4 text-right">Profit Factor</th>
                    <th className="py-2.5 px-4 text-right">Trades (W/L)</th>
                    <th className="py-2.5 px-4 text-right">Net Profit ($)</th>
                    <th className="py-2.5 px-4 text-right">Max Drawdown</th>
                    <th className="py-2.5 px-4 text-center">Score</th>
                    <th className="py-2.5 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {sortedStrategies.map((strat, idx) => {
                    const isSelected = strat.id === selectedStrategyId;
                    const isTop = strat.id === backtestResults.topStrategy.id;

                    return (
                      <tr
                        key={strat.id}
                        onClick={() => setSelectedStrategyId(strat.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected 
                            ? 'bg-amber-500/10 hover:bg-amber-500/15' 
                            : 'hover:bg-slate-800/40'
                        }`}
                      >
                        {/* Rank */}
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-black text-xs ${
                            idx === 0 
                              ? 'bg-amber-500 text-slate-950' 
                              : idx === 1 
                              ? 'bg-slate-300 text-slate-950' 
                              : idx === 2 
                              ? 'bg-amber-800 text-amber-200' 
                              : 'bg-slate-800 text-slate-400'
                          }`}>
                            {idx + 1}
                          </span>
                        </td>

                        {/* Strategy Name & Details */}
                        <td className="py-3 px-4 font-sans">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">{strat.name}</span>
                            {isTop && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-black flex items-center gap-0.5">
                                <Trophy className="w-2.5 h-2.5" /> TOP
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 flex flex-wrap gap-1">
                            {strat.indicatorsUsed.map((ind, i) => (
                              <span key={i} className="px-1.5 py-0.2 rounded bg-slate-900 text-slate-400 border border-slate-800 text-[10px]">
                                {ind}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Timeframe */}
                        <td className="py-3 px-4 text-center">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                            strat.timeframeTag.includes('DUAL') 
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                              : 'bg-slate-800 text-slate-300'
                          }`}>
                            {strat.timeframeTag}
                          </span>
                        </td>

                        {/* Win Rate */}
                        <td className="py-3 px-4 text-right">
                          <span className={`font-black text-sm px-2 py-0.5 rounded ${
                            strat.winRatePct >= 75 
                              ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-800/60' 
                              : strat.winRatePct >= 60 
                              ? 'text-emerald-300' 
                              : 'text-amber-300'
                          }`}>
                            {strat.winRatePct}%
                          </span>
                        </td>

                        {/* Profit Factor */}
                        <td className="py-3 px-4 text-right font-black text-slate-200">
                          {strat.profitFactor}x
                        </td>

                        {/* Trades */}
                        <td className="py-3 px-4 text-right text-slate-300">
                          <span>{strat.totalTrades}</span>
                          <span className="text-slate-500 text-[11px] ml-1">
                            ({strat.winningTrades}W / {strat.losingTrades}L)
                          </span>
                        </td>

                        {/* Net Profit */}
                        <td className="py-3 px-4 text-right">
                          <span className={`font-black ${strat.netProfitDollar >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {strat.netProfitDollar >= 0 ? `+$${strat.netProfitDollar.toLocaleString()}` : `-$${Math.abs(strat.netProfitDollar).toLocaleString()}`}
                          </span>
                        </td>

                        {/* Max Drawdown */}
                        <td className="py-3 px-4 text-right text-rose-300 font-bold">
                          {strat.maxDrawdownPct}%
                        </td>

                        {/* Composite Score */}
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 font-black text-amber-300">
                            {strat.compositeScore}
                          </span>
                        </td>

                        {/* Action */}
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedStrategyId(strat.id);
                            }}
                            className={`px-2.5 py-1 rounded text-xs font-bold transition-colors ${
                              isSelected 
                                ? 'bg-amber-500 text-slate-950 font-black' 
                                : 'bg-slate-800 text-slate-300 hover:text-white'
                            }`}
                          >
                            {isSelected ? 'Selected' : 'Inspect'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* DEEP DIVE INSPECTOR FOR SELECTED STRATEGY */}
          {currentSelectedStrategy && (
            <div className="bg-[#161B22] border border-slate-800 rounded-xl p-3.5 sm:p-6 shadow-xl space-y-4 sm:space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] sm:text-xs font-mono text-amber-400 uppercase tracking-wider">
                      Strategy Deep-Dive Analysis
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800 font-bold">
                      {currentSelectedStrategy.timeframeTag}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-xl font-black text-white tracking-tight mt-0.5">
                    {currentSelectedStrategy.name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                    {currentSelectedStrategy.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                  <span>Starting Capital: $10,000</span>
                </div>
              </div>

              {/* 8 Metric Cards Grid (Responsive 2x4 on mobile, 8 on desktop) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 text-center">
                  <span className="text-[9px] text-slate-500 block uppercase font-semibold">Win Rate</span>
                  <span className="text-base sm:text-lg font-black text-emerald-400 font-mono">
                    {currentSelectedStrategy.winRatePct}%
                  </span>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 text-center">
                  <span className="text-[9px] text-slate-500 block uppercase font-semibold">Profit Factor</span>
                  <span className="text-base sm:text-lg font-black text-amber-300 font-mono">
                    {currentSelectedStrategy.profitFactor}x
                  </span>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 text-center">
                  <span className="text-[9px] text-slate-500 block uppercase font-semibold">Net PnL</span>
                  <span className={`text-base sm:text-lg font-black font-mono ${currentSelectedStrategy.netProfitDollar >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    +${currentSelectedStrategy.netProfitDollar.toLocaleString()}
                  </span>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 text-center">
                  <span className="text-[9px] text-slate-500 block uppercase font-semibold">Total Trades</span>
                  <span className="text-base sm:text-lg font-black text-white font-mono">
                    {currentSelectedStrategy.totalTrades}
                  </span>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 text-center">
                  <span className="text-[9px] text-slate-500 block uppercase font-semibold">R:R Ratio</span>
                  <span className="text-base sm:text-lg font-black text-slate-200 font-mono">
                    {currentSelectedStrategy.winLossRatio}x
                  </span>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 text-center">
                  <span className="text-[9px] text-slate-500 block uppercase font-semibold">Drawdown</span>
                  <span className="text-base sm:text-lg font-black text-rose-400 font-mono">
                    {currentSelectedStrategy.maxDrawdownPct}%
                  </span>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 text-center">
                  <span className="text-[9px] text-slate-500 block uppercase font-semibold">Streak</span>
                  <span className="text-base sm:text-lg font-black text-emerald-400 font-mono">
                    {currentSelectedStrategy.maxConsecutiveWins}W
                  </span>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 text-center">
                  <span className="text-[9px] text-slate-500 block uppercase font-semibold">Avg Hold</span>
                  <span className="text-base sm:text-lg font-black text-slate-300 font-mono">
                    {currentSelectedStrategy.avgHoldingMinutes}m
                  </span>
                </div>
              </div>

              {/* Visual Interactive Equity Curve Chart (SVG Vector) */}
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 sm:p-5">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs sm:text-sm font-bold text-white">Simulated Account Equity Curve</span>
                  </div>
                  <div className="text-[10px] sm:text-xs font-mono text-slate-400">
                    Ending: <strong className="text-emerald-400">${currentSelectedStrategy.endingCapital.toLocaleString()}</strong>
                  </div>
                </div>

                {/* SVG Line Chart */}
                <div className="h-36 sm:h-44 w-full relative">
                  {currentSelectedStrategy.equityCurve && currentSelectedStrategy.equityCurve.length > 1 ? (
                    (() => {
                      const curve = currentSelectedStrategy.equityCurve;
                      const equities = curve.map(p => p.equity);
                      const minEq = Math.min(...equities) * 0.98;
                      const maxEq = Math.max(...equities) * 1.02;
                      const range = maxEq - minEq || 1;
                      const width = 1000;
                      const height = 160;

                      const points = curve.map((pt, idx) => {
                        const x = (idx / (curve.length - 1)) * width;
                        const y = height - ((pt.equity - minEq) / range) * height;
                        return `${x.toFixed(1)},${y.toFixed(1)}`;
                      }).join(' ');

                      const areaPoints = `${points} ${width},${height} 0,${height}`;

                      return (
                        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
                          <defs>
                            <linearGradient id="eqGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>

                          {/* Horizontal Grid lines */}
                          <line x1="0" y1={height * 0.25} x2={width} y2={height * 0.25} stroke="#334155" strokeDasharray="4 4" strokeWidth="0.8" />
                          <line x1="0" y1={height * 0.50} x2={width} y2={height * 0.50} stroke="#334155" strokeDasharray="4 4" strokeWidth="0.8" />
                          <line x1="0" y1={height * 0.75} x2={width} y2={height * 0.75} stroke="#334155" strokeDasharray="4 4" strokeWidth="0.8" />

                          {/* Shaded Area */}
                          <polygon points={areaPoints} fill="url(#eqGradient)" />

                          {/* Stroke Line */}
                          <polyline
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={points}
                          />

                          {/* Starting point & Ending point circles */}
                          <circle cx="0" cy={height - ((curve[0].equity - minEq) / range) * height} r="4" fill="#10b981" />
                          <circle cx={width} cy={height - ((curve[curve.length - 1].equity - minEq) / range) * height} r="5" fill="#34d399" stroke="#ffffff" strokeWidth="1.5" />
                        </svg>
                      );
                    })()
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                      No trades triggered yet for this strategy.
                    </div>
                  )}
                </div>
              </div>

              {/* Day-by-Day Performance Breakdown for Last Week */}
              {currentSelectedStrategy.dailyBreakdown && currentSelectedStrategy.dailyBreakdown.length > 0 && (
                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 sm:p-4">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-amber-400" />
                      <span className="text-xs sm:text-sm font-bold text-white">
                        Last Week Daily Performance Breakdown
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      {backtestResults.periodLabel || 'Last Week'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                    {currentSelectedStrategy.dailyBreakdown.map((day) => (
                      <div
                        key={day.date}
                        className="bg-slate-950/80 border border-slate-800/90 rounded-lg p-2.5 text-center hover:border-slate-700 transition-colors"
                      >
                        <div className="text-[11px] font-bold text-slate-200 font-mono">
                          {day.formattedDate}
                        </div>
                        <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                          {day.tradesCount} Trade{day.tradesCount !== 1 ? 's' : ''} ({day.wins}W / {day.losses}L)
                        </div>
                        <div className="mt-1.5 flex items-center justify-center">
                          <span
                            className={`text-xs font-black font-mono ${
                              day.pnlDollar > 0
                                ? 'text-emerald-400'
                                : day.pnlDollar < 0
                                ? 'text-rose-400'
                                : 'text-slate-400'
                            }`}
                          >
                            {day.pnlDollar > 0 ? `+$${day.pnlDollar.toFixed(1)}` : day.pnlDollar < 0 ? `-$${Math.abs(day.pnlDollar).toFixed(1)}` : '$0.00'}
                          </span>
                        </div>
                        <div className="mt-1">
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-bold font-mono ${
                              day.winRatePct >= 60
                                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/40'
                                : day.winRatePct >= 40
                                ? 'bg-amber-950/80 text-amber-300 border border-amber-800/40'
                                : 'bg-rose-950/80 text-rose-300 border border-rose-800/40'
                            }`}
                          >
                            {day.winRatePct}% Win Rate
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Trade-by-Trade Accuracy Log */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-2.5">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <h4 className="text-xs sm:text-sm font-bold text-white">
                      Historical Trade Accuracy Log ({filteredTrades.length} Trades)
                    </h4>
                  </div>

                  {/* Filter Trades: All / Wins / Losses */}
                  <div className="flex items-center bg-slate-900 rounded-lg p-1 border border-slate-800 text-xs self-start sm:self-auto">
                    <button
                      onClick={() => setTradeFilter('ALL')}
                      className={`px-2.5 py-1 rounded font-bold touch-manipulation min-h-[34px] ${tradeFilter === 'ALL' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                    >
                      All ({currentSelectedStrategy.totalTrades})
                    </button>
                    <button
                      onClick={() => setTradeFilter('WINS')}
                      className={`px-2.5 py-1 rounded font-bold touch-manipulation min-h-[34px] ${tradeFilter === 'WINS' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      Wins ({currentSelectedStrategy.winningTrades})
                    </button>
                    <button
                      onClick={() => setTradeFilter('LOSSES')}
                      className={`px-2.5 py-1 rounded font-bold touch-manipulation min-h-[34px] ${tradeFilter === 'LOSSES' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      Losses ({currentSelectedStrategy.losingTrades})
                    </button>
                  </div>
                </div>

                {/* Click-to-Chart Instruction & Selection Banner */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs font-mono">
                  <div className="flex items-center gap-2 text-amber-300">
                    <Target className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="font-sans text-[11px] sm:text-xs">
                      <strong>Click any trade below</strong> to automatically update <strong>Entry</strong> &amp; <strong>Stop Loss</strong> and reflect it on the chart.
                      <span className="text-amber-200/90 ml-1">Amount is reset to <strong>0</strong> for historical trades, but preserved for running trades.</span>
                    </span>
                  </div>
                  {selectedTrade && (
                    <button
                      onClick={handleClearSelectedTrade}
                      className="ml-auto px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-bold border border-slate-700 flex items-center gap-1 transition-colors"
                    >
                      <X className="w-3 h-3" />
                      <span>Clear Selected Trade</span>
                    </button>
                  )}
                </div>

                {/* Active Running Trades (Live / Open Positions) */}
                {(runningPaperTrades.length > 0 || (currentSelectedStrategy?.trades && currentSelectedStrategy.trades.some(t => t.isRunning))) && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-400 font-bold">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      <span>Active Running Trades ({runningPaperTrades.length + (currentSelectedStrategy?.trades.filter(t => t.isRunning).length || 0)})</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {/* Live Paper Running Positions */}
                      {runningPaperTrades.map(pos => {
                        const isShort = pos.type === 'SHORT';
                        const isSelected = selectedTrade?.id === pos.id;
                        return (
                          <div
                            key={pos.id}
                            onClick={() => handleSelectTrade({
                              id: pos.id,
                              direction: pos.type,
                              entryPrice: pos.entryPrice,
                              stopLossPrice: pos.stopLossPrice,
                              targetPrice: pos.takeProfitPrice,
                              quantity: pos.quantity,
                              amount: pos.quantity,
                              isRunning: true,
                              pnlDollar: pos.unrealizedPnlDollars,
                              pnlPct: pos.unrealizedPnlPercent,
                            })}
                            className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center justify-between gap-2 ${
                              isSelected
                                ? 'bg-emerald-950/70 border-emerald-400 ring-2 ring-emerald-400/80 shadow-lg'
                                : 'bg-[#0D1117] border-emerald-600/50 hover:border-emerald-400'
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-1.5 font-mono text-xs">
                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-black text-[10px]">
                                  {pos.type}
                                </span>
                                <span className="font-bold text-white">XAUUSD</span>
                                <span className="text-[10px] text-emerald-400 font-bold">
                                  ● {pos.quantity} Oz (Running)
                                </span>
                              </div>
                              <div className="text-[11px] font-mono text-slate-400 mt-1">
                                Entry: <strong className="text-white">${pos.entryPrice.toFixed(2)}</strong> | SL: <span className="text-rose-400">${(pos.stopLossPrice ?? (isShort ? pos.entryPrice + 8 : pos.entryPrice - 8)).toFixed(2)}</span>
                              </div>
                            </div>

                            <div className="text-right">
                              <span className={`text-xs font-black font-mono block ${pos.unrealizedPnlDollars >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {pos.unrealizedPnlDollars >= 0 ? `+$${pos.unrealizedPnlDollars.toFixed(2)}` : `-$${Math.abs(pos.unrealizedPnlDollars).toFixed(2)}`}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                Click to reflect
                              </span>
                            </div>
                          </div>
                        );
                      })}

                      {/* Engine Running Trades */}
                      {currentSelectedStrategy?.trades.filter(t => t.isRunning).map(t => {
                        const isSelected = selectedTrade?.id === t.id;
                        return (
                          <div
                            key={`run-${t.id}`}
                            onClick={() => handleSelectTrade(t)}
                            className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center justify-between gap-2 ${
                              isSelected
                                ? 'bg-emerald-950/70 border-emerald-400 ring-2 ring-emerald-400/80 shadow-lg'
                                : 'bg-[#0D1117] border-emerald-600/50 hover:border-emerald-400'
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-1.5 font-mono text-xs">
                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-black text-[10px]">
                                  {t.direction}
                                </span>
                                <span className="font-bold text-white">XAUUSD</span>
                                <span className="text-[10px] text-emerald-400 font-bold">
                                  ● {t.quantity ?? 10} Oz (Running)
                                </span>
                              </div>
                              <div className="text-[11px] font-mono text-slate-400 mt-1">
                                Entry: <strong className="text-white">${t.entryPrice.toFixed(2)}</strong> | SL: <span className="text-rose-400">${(t.stopLossPrice ?? (t.direction === 'SHORT' ? t.entryPrice + 8 : t.entryPrice - 8)).toFixed(2)}</span>
                              </div>
                            </div>

                            <div className="text-right">
                              <span className="text-xs font-black font-mono text-emerald-400 block">
                                RUNNING
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                Click to reflect
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Closed Gold Trade Log — separate from the stock Trade Journal in Positions & Exits */}
                {closedGoldTrades.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-mono text-slate-300 font-bold">
                        <Calendar className="w-3.5 h-3.5 text-amber-400" />
                        <span>XAUUSD Closed Trade Log ({closedGoldTrades.length})</span>
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/60">
                        5M Entry / 30M Trend
                      </span>
                    </div>

                    <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                      {closedGoldTrades.map(pos => {
                        const isWin = (pos.realizedPnlDollars ?? 0) >= 0;
                        return (
                          <div
                            key={pos.id}
                            className="p-2.5 rounded-lg border border-slate-800 bg-[#0D1117] flex items-center justify-between gap-2"
                          >
                            <div>
                              <div className="flex items-center gap-1.5 font-mono text-xs">
                                <span className={`px-1.5 py-0.5 rounded font-black text-[10px] ${
                                  pos.type === 'LONG' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                                }`}>
                                  {pos.type}
                                </span>
                                <span className="font-bold text-white">XAUUSD</span>
                                <span className="text-[10px] text-slate-500">{pos.quantity} Oz</span>
                              </div>
                              <div className="text-[11px] font-mono text-slate-400 mt-1">
                                Entry: <strong className="text-white">${pos.entryPrice.toFixed(2)}</strong>
                                {pos.closePrice != null && <> {'->'} Exit: <strong className="text-white">${pos.closePrice.toFixed(2)}</strong></>}
                                <span className="text-slate-600 ml-1.5">{pos.closeDate ? new Date(pos.closeDate).toLocaleDateString() : pos.entryDate}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className={`text-xs font-black font-mono block ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {isWin ? '+' : ''}{formatCurrency(pos.realizedPnlDollars ?? 0)}
                              </span>
                              <span className={`text-[10px] font-mono ${isWin ? 'text-emerald-500/80' : 'text-rose-500/80'}`}>
                                {(pos.realizedPnlPercent ?? 0).toFixed(2)}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Mobile Trade Cards (< md) */}
                <div className="md:hidden space-y-2 max-h-80 overflow-y-auto pr-1">
                  {filteredTrades.length > 0 ? (
                    filteredTrades.map((t, idx) => {
                      const isSelected = selectedTrade?.id === t.id;
                      return (
                        <div
                          key={`mob-t-${t.id}`}
                          onClick={() => handleSelectTrade(t)}
                          className={`rounded-lg p-2.5 text-xs cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-amber-500/15 border-2 border-amber-400 ring-2 ring-amber-400/50 shadow-lg'
                              : 'bg-slate-900/70 border border-slate-800 hover:bg-slate-800/80'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-slate-500 text-[10px]">#{idx + 1}</span>
                              <span className="px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 font-bold text-[10px]">
                                {t.direction}
                              </span>
                              <span className="font-mono text-[10px] text-slate-400">{new Date(t.entryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              {isSelected && (
                                <span className="px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 font-black text-[9px] uppercase">
                                  Selected
                                </span>
                              )}
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                              t.isWin ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                            }`}>
                              {t.isWin ? `+$${t.pnlDollar.toFixed(1)} (+${t.pnlPct.toFixed(1)}%)` : `-$${Math.abs(t.pnlDollar).toFixed(1)} (${t.pnlPct.toFixed(1)}%)`}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] font-mono text-slate-300 mt-1.5 pt-1.5 border-t border-slate-800/60">
                            <span>Entry: <strong className="text-cyan-300">${t.entryPrice.toFixed(2)}</strong></span>
                            <span>Stop Loss: <strong className="text-rose-300">${(t.stopLossPrice ?? (t.direction === 'SHORT' ? t.entryPrice + 8 : t.entryPrice - 8)).toFixed(2)}</strong></span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-1">
                            <span>Out: ${t.exitPrice.toFixed(2)} ({t.holdingMinutes}m)</span>
                            <span className="text-amber-400/90 font-sans">Amt: 0 oz (Reset)</span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center text-slate-500 text-xs">No trades matching filter.</div>
                  )}
                </div>

                {/* Desktop Trades Table (>= md) */}
                <div className="hidden md:block overflow-x-auto border border-slate-800 rounded-xl max-h-80 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-[#0B0E14] z-10 border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Direction</th>
                        <th className="py-2.5 px-3">Entry Time</th>
                        <th className="py-2.5 px-3">Entry Price</th>
                        <th className="py-2.5 px-3">Stop Loss</th>
                        <th className="py-2.5 px-3">Target TP</th>
                        <th className="py-2.5 px-3">Exit Price</th>
                        <th className="py-2.5 px-3">Duration</th>
                        <th className="py-2.5 px-3">Exit Reason</th>
                        <th className="py-2.5 px-3 text-right">PnL ($)</th>
                        <th className="py-2.5 px-3 text-right">PnL (%)</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                      {filteredTrades.length > 0 ? (
                        filteredTrades.map((t, idx) => {
                          const isSelected = selectedTrade?.id === t.id;
                          const slVal = t.stopLossPrice ?? (t.direction === 'SHORT' ? t.entryPrice + 8 : t.entryPrice - 8);
                          const tpVal = t.targetPrice ?? (t.direction === 'SHORT' ? t.entryPrice - 16 : t.entryPrice + 16);
                          return (
                            <tr
                              key={t.id}
                              onClick={() => handleSelectTrade(t)}
                              title="Click to reflect on chart, update Entry & Stop Loss, and reset amount to 0"
                              className={`cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-amber-500/20 text-white font-bold ring-1 ring-inset ring-amber-400'
                                  : 'hover:bg-slate-800/60'
                              }`}
                            >
                              <td className="py-2 px-3 text-slate-500">
                                {isSelected ? '👉 ' : ''}{idx + 1}
                              </td>
                              <td className="py-2 px-3">
                                <span className={`px-1.5 py-0.5 rounded font-black text-[9px] ${
                                  t.direction === 'SHORT'
                                    ? 'bg-rose-950 text-rose-300 border border-rose-800/60'
                                    : 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                                }`}>
                                  {t.direction}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-slate-300">{new Date(t.entryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                              <td className="py-2 px-3 text-cyan-300 font-bold">${t.entryPrice.toFixed(2)}</td>
                              <td className="py-2 px-3 text-rose-300 font-semibold">${slVal.toFixed(2)}</td>
                              <td className="py-2 px-3 text-emerald-300 font-semibold">${tpVal.toFixed(2)}</td>
                              <td className="py-2 px-3 text-white font-bold">${t.exitPrice.toFixed(2)}</td>
                              <td className="py-2 px-3 text-slate-400">{t.holdingMinutes}m ({t.holdingBars} bars)</td>
                              <td className="py-2 px-3 text-slate-300 font-sans text-xs">{t.exitReason}</td>
                              <td className={`py-2 px-3 text-right font-black ${t.isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {t.pnlDollar >= 0 ? `+$${t.pnlDollar.toFixed(2)}` : `-$${Math.abs(t.pnlDollar).toFixed(2)}`}
                              </td>
                              <td className={`py-2 px-3 text-right font-bold ${t.isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {t.pnlPct >= 0 ? `+${t.pnlPct.toFixed(2)}%` : `${t.pnlPct.toFixed(2)}%`}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                  t.isWin ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                }`}>
                                  {t.isWin ? 'WIN' : 'LOSS'}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={12} className="py-6 text-center text-slate-500 font-sans text-xs">
                            No trades matching filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. INTERACTIVE TRADINGVIEW CHART (SHOWN IN LIVE & SPLIT VIEWS) */}
      {/* ========================================================================= */}
      {(viewMode === 'live' || viewMode === 'split') && (
        <div className="space-y-3">
          {/* Long & Short Position Forecast Drawer Tool */}
          {showForecastTool && (
            <PositionForecastDrawer
              symbol="XAUUSD"
              currentPrice={currentSpotPrice ?? 2500}
              isGold={true}
              defaultStopLoss={customStopLossPrice ?? dynamicStopLoss}
              defaultTarget1={customTargetPrice ?? target1Price}
              defaultTarget2={target2Price}
              externalTrade={selectedTrade ? {
                direction: selectedTrade.direction,
                entryPrice: selectedTrade.entryPrice,
                stopLossPrice: selectedTrade.stopLossPrice,
                targetPrice: selectedTrade.targetPrice,
                quantity: selectedTrade.quantity,
                amount: selectedTrade.amount,
                isRunning: selectedTrade.isRunning,
                title: selectedTrade.id,
              } : null}
              onExecuteTrade={(trade) => {
                handleQuickTrade(
                  trade.direction === 'BUY' ? 'LONG' : 'SHORT',
                  trade.entryPrice,
                  trade.stopLossPrice,
                  trade.quantity
                );
              }}
              onClose={() => setShowForecastTool(false)}
            />
          )}

          <div className={`relative bg-[#161B22] border border-slate-800 rounded-xl shadow-2xl overflow-hidden ${
            isChartFullscreen ? 'fixed inset-0 z-50 rounded-none bg-[#0B0E14]' : ''
          }`}>
            {/* Interactive On-Chart Trade Reflection & Levels Overlay HUD */}
            {selectedTrade && (
              <div className="bg-gradient-to-r from-[#0B0E14] via-[#161B22] to-[#0B0E14] border-b border-amber-500/40 p-2.5 sm:px-4 flex flex-wrap items-center justify-between gap-2 shadow-inner">
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase flex items-center gap-1.5 shadow-sm ${
                    selectedTrade.isRunning
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 animate-pulse'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${selectedTrade.isRunning ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    {selectedTrade.isRunning ? 'Running Trade on Chart' : 'Selected Trade on Chart'}
                  </span>

                  <span className="font-bold text-white uppercase px-1.5 py-0.5 rounded bg-slate-800">
                    {selectedTrade.direction}
                  </span>

                  {/* Entry Price Tag */}
                  <span className="text-cyan-300 bg-cyan-950/80 border border-cyan-500/60 px-2 py-0.5 rounded font-black flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    Entry: ${selectedTrade.entryPrice.toFixed(2)}
                  </span>

                  {/* Stop Loss Price Tag */}
                  <span className="text-rose-300 bg-rose-950/80 border border-rose-500/60 px-2 py-0.5 rounded font-black flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                    Stop Loss: ${(selectedTrade.stopLossPrice ?? customStopLossPrice ?? dynamicStopLoss).toFixed(2)}
                  </span>

                  {/* Target Price Tag */}
                  <span className="text-emerald-300 bg-emerald-950/80 border border-emerald-500/60 px-2 py-0.5 rounded font-black hidden sm:flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Target TP: ${(selectedTrade.targetPrice ?? customTargetPrice ?? target1Price).toFixed(2)}
                  </span>

                  {/* Amount Tag */}
                  <span className={`px-2 py-0.5 rounded font-black text-[11px] ${
                    tradeAmount > 0
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-600/60'
                      : 'bg-slate-900 text-amber-400 border border-amber-500/40'
                  }`}>
                    Amount: {tradeAmount} Oz {tradeAmount === 0 ? '(Reset to 0 for historical trade)' : '(Active Running Position)'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 ml-auto">
                  <button
                    onClick={() => setShowForecastTool(!showForecastTool)}
                    className="px-2.5 py-1 rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-200 text-[11px] font-bold border border-cyan-500/50 flex items-center gap-1 transition-colors"
                  >
                    <Target className="w-3 h-3 text-cyan-400" />
                    <span>{showForecastTool ? 'Hide Forecast Tool' : 'Forecast Tool'}</span>
                  </button>
                  <button
                    onClick={handleClearSelectedTrade}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-mono border border-slate-700 flex items-center gap-1 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Snap Live Spot (${(currentSpotPrice ?? 0).toFixed(2)})</span>
                  </button>
                </div>
              </div>
            )}

            {/* Visual Floating On-Chart Price Tag Overlay */}
            {selectedTrade && (
              <div className="pointer-events-none absolute right-4 top-16 z-20 hidden sm:flex flex-col items-end gap-1 font-mono text-[10px]">
                <div className="bg-cyan-950/90 text-cyan-300 border border-cyan-400/80 px-2 py-0.5 rounded shadow-lg flex items-center gap-1.5 backdrop-blur font-black">
                  <span className="w-1.5 h-1.5 bg-cyan-400 rotate-45" />
                  <span>CHART ENTRY: ${selectedTrade.entryPrice.toFixed(2)}</span>
                </div>
                <div className="bg-rose-950/90 text-rose-300 border border-rose-400/80 px-2 py-0.5 rounded shadow-lg flex items-center gap-1.5 backdrop-blur font-black">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                  <span>CHART STOP LOSS: ${(selectedTrade.stopLossPrice ?? customStopLossPrice ?? dynamicStopLoss).toFixed(2)}</span>
                </div>
                <div className="bg-emerald-950/90 text-emerald-300 border border-emerald-400/80 px-2 py-0.5 rounded shadow-lg flex items-center gap-1.5 backdrop-blur font-black">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>CHART TARGET: ${(selectedTrade.targetPrice ?? customTargetPrice ?? target1Price).toFixed(2)}</span>
                </div>
                <div className="bg-slate-900/90 text-slate-300 border border-slate-700 px-2 py-0.5 rounded shadow backdrop-blur font-sans text-[9px]">
                  Amount: <strong className={tradeAmount > 0 ? "text-emerald-400" : "text-amber-400"}>{tradeAmount} oz</strong> ({tradeAmount === 0 ? "Reset to 0" : "Running Trade"})
                </div>
              </div>
            )}

            {/* Chart Header Bar with Layout Switcher, Timeframe, Forecast & Drawing Tools */}
            <div className="p-2.5 sm:p-4 bg-[#0B0E14] border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="font-black text-xs sm:text-sm text-white tracking-wide flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  Live Gold Chart
                </span>
                <span className="text-[11px] sm:text-xs text-slate-400 font-mono">
                  OANDA:XAUUSD
                </span>
                <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                  ${(currentSpotPrice ?? 0).toFixed(2)}
                </span>
              </div>

              {/* Layout controls & Tools Toolbar */}
              <div className="flex flex-wrap items-center gap-2">
                {/* 2-Split Layout Setup Switcher */}
                <div className="bg-slate-900 rounded-lg p-0.5 border border-slate-800 flex items-center text-xs font-mono">
                  <button
                    onClick={() => setChartLayout('single')}
                    title="Single Full View"
                    className={`px-2 py-1 rounded text-[11px] font-bold transition-colors flex items-center gap-1 ${
                      chartLayout === 'single'
                        ? 'bg-amber-500 text-slate-950 shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Square className="w-3 h-3" />
                    <span>1x Single</span>
                  </button>
                  <button
                    onClick={() => setChartLayout('split-vertical')}
                    title={`2-Split Vertical Layout (${trendTimeframe} Trend Top / 5M Entry Bottom)`}
                    className={`px-2 py-1 rounded text-[11px] font-bold transition-colors flex items-center gap-1 ${
                      chartLayout === 'split-vertical'
                        ? 'bg-amber-500 text-slate-950 shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Rows className="w-3 h-3" />
                    <span>2 Split Vertical</span>
                  </button>
                  <button
                    onClick={() => setChartLayout('split-horizontal')}
                    title="2-Split Columns Layout (Side-by-Side)"
                    className={`px-2 py-1 rounded text-[11px] font-bold transition-colors flex items-center gap-1 hidden sm:flex ${
                      chartLayout === 'split-horizontal'
                        ? 'bg-amber-500 text-slate-950 shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Columns className="w-3 h-3" />
                    <span>2 Split Columns</span>
                  </button>
                </div>

                {/* Long/Short Position Forecast Drawer Toggle */}
                <button
                  onClick={() => setShowForecastTool(!showForecastTool)}
                  title="Open Long & Short Position Forecast Planner and Risk/Reward Box"
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow ${
                    showForecastTool
                      ? 'bg-cyan-500 text-slate-950 ring-2 ring-cyan-300 font-black'
                      : 'bg-slate-900 text-cyan-300 border border-cyan-500/40 hover:bg-slate-800'
                  }`}
                >
                  <Target className="w-3.5 h-3.5" />
                  <span>Forecast Tool</span>
                </button>

                {/* Native TradingView Drawing Tools Toolbar Toggle */}
                <button
                  onClick={() => setShowDrawingTools(!showDrawingTools)}
                  title="Toggle TradingView's left drawing toolbar (includes native Long Position and Short Position tools, Fibonacci, Trendlines)"
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors flex items-center gap-1.5 ${
                    showDrawingTools
                      ? 'bg-amber-950/80 border border-amber-500/60 text-amber-300 font-bold'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Drawing Bar: {showDrawingTools ? 'ON' : 'OFF'}</span>
                </button>

                {/* Quick Single-Chart Interval Selector (shown when in single view) */}
                {chartLayout === 'single' && (
                  <div className="flex items-center gap-0.5 bg-slate-900 rounded-lg p-0.5 border border-slate-800">
                    {[
                      { val: '1', label: '1m' },
                      { val: '5', label: '5m' },
                      { val: '15', label: '15m' },
                      { val: '30', label: '30m' },
                      { val: '60', label: '1h' },
                      { val: '240', label: '4h' },
                      { val: 'D', label: '1D' },
                    ].map(({ val, label }) => (
                      <button
                        key={val}
                        onClick={() => setChartInterval(val)}
                        className={`px-2 py-1 rounded text-[11px] font-mono font-bold transition-colors touch-manipulation min-h-[32px] ${
                          chartInterval === val
                            ? 'bg-amber-500 text-slate-950 shadow'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Fullscreen Button */}
                <button
                  onClick={() => setIsChartFullscreen(!isChartFullscreen)}
                  className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-colors touch-manipulation min-h-[34px] min-w-[34px] flex items-center justify-center"
                  title={isChartFullscreen ? 'Exit Fullscreen' : 'Expand Chart to Full Screen'}
                >
                  {isChartFullscreen ? <Minimize2 className="w-4 h-4 text-amber-400" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Embedded TradingView Widget Layouts */}
            {chartLayout === 'single' && (
              <div className={`${isChartFullscreen ? 'h-[calc(100vh-50px)]' : 'h-[380px] sm:h-[500px] md:h-[650px]'} w-full bg-[#0B0E14]`}>
                <TradingViewWidget
                  key={`xauusd_single_${chartInterval}`}
                  symbol="OANDA:XAUUSD"
                  interval={chartInterval}
                  theme="dark"
                  hideSideToolbar={!showDrawingTools}
                  studies={[
                    'IchimokuCloud@tv-basicstudies',
                    'Volume@tv-basicstudies',
                  ]}
                  containerId="xauusd_tradingview_widget"
                  height="100%"
                />
              </div>
            )}

            {/* 2-Split Vertical Layout: Stacked Top (30M Reference Trend) & Bottom (1M Scalp Trigger/Entry) */}
            {chartLayout === 'split-vertical' && (
              <div className="w-full space-y-3 p-3 bg-[#0B0E14]">
                {/* Top Pane: 30M Reference Trend */}
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-[#161B22]">
                  <div className="p-2 bg-[#0D1117] border-b border-slate-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold border border-amber-500/40">
                        PANE 1 (REFERENCE)
                      </span>
                      <span className="font-mono font-bold text-white text-xs">
                        XAUUSD {chartIntervalTop === '30' ? '30M' : chartIntervalTop === '15' ? '15M' : `${chartIntervalTop}m`} Reference Trend &amp; Ichimoku Cloud
                      </span>
                    </div>
                    <div className="flex items-center gap-1 bg-[#0B0E14] p-0.5 rounded border border-slate-800 font-mono text-xs">
                      {[
                        { val: '5', label: '5m' },
                        { val: '15', label: '15m' },
                        { val: '30', label: '30m' },
                        { val: '60', label: '1h' },
                        { val: '240', label: '4h' },
                        { val: 'D', label: '1D' },
                      ].map(({ val, label }) => (
                        <button
                          key={val}
                          onClick={() => setChartIntervalTop(val)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            chartIntervalTop === val
                              ? 'bg-amber-500 text-slate-950'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <TradingViewWidget
                    key={`xauusd_chart_top_${chartIntervalTop}`}
                    symbol="OANDA:XAUUSD"
                    interval={chartIntervalTop}
                    theme="dark"
                    hideSideToolbar={!showDrawingTools}
                    studies={[
                      'IchimokuCloud@tv-basicstudies',
                      'Volume@tv-basicstudies',
                    ]}
                    containerId="xauusd_chart_top"
                    containerHeight="500px"
                  />
                </div>

                {/* Bottom Pane: 1M Scalp Trigger & Execution */}
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-[#161B22]">
                  <div className="p-2 bg-[#0D1117] border-b border-slate-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[10px] font-bold border border-cyan-500/40">
                        PANE 2 (ENTRY)
                      </span>
                      <span className="font-mono font-bold text-white text-xs">
                        XAUUSD {chartIntervalBottom === '1' ? '1M' : `${chartIntervalBottom}M`} Entry, TK Cross &amp; Execution
                      </span>
                    </div>
                    <div className="flex items-center gap-1 bg-[#0B0E14] p-0.5 rounded border border-slate-800 font-mono text-xs">
                      {[
                        { val: '1', label: '1m' },
                        { val: '3', label: '3m' },
                        { val: '5', label: '5m' },
                        { val: '15', label: '15m' },
                        { val: '30', label: '30m' },
                        { val: '60', label: '1h' },
                      ].map(({ val, label }) => (
                        <button
                          key={val}
                          onClick={() => setChartIntervalBottom(val)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            chartIntervalBottom === val
                              ? 'bg-cyan-500 text-slate-950'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <TradingViewWidget
                    key={`xauusd_chart_bottom_${chartIntervalBottom}`}
                    symbol="OANDA:XAUUSD"
                    interval={chartIntervalBottom}
                    theme="dark"
                    hideSideToolbar={!showDrawingTools}
                    studies={[
                      'IchimokuCloud@tv-basicstudies',
                      'Volume@tv-basicstudies',
                    ]}
                    containerId="xauusd_chart_bottom"
                    containerHeight="500px"
                  />
                </div>
              </div>
            )}

            {/* 2-Split Columns Layout: Side-by-Side (30M Left, 1M Right) */}
            {chartLayout === 'split-horizontal' && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 p-3 bg-[#0B0E14]">
                {/* Left Column Pane: 30M Reference Trend */}
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-[#161B22]">
                  <div className="p-2 bg-[#0D1117] border-b border-slate-800 flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-amber-400 text-xs">{trendTimeframe} Reference Trend</span>
                    <div className="flex items-center gap-1 bg-[#0B0E14] p-0.5 rounded border border-slate-800 font-mono text-xs">
                      {['5', '15', '30', '60', '240'].map(interval => (
                        <button
                          key={interval}
                          onClick={() => setChartIntervalTop(interval)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            chartIntervalTop === interval
                              ? 'bg-amber-500 text-slate-950'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {interval}m
                        </button>
                      ))}
                    </div>
                  </div>
                  <TradingViewWidget
                    key={`xauusd_chart_col_left_${chartIntervalTop}`}
                    symbol="OANDA:XAUUSD"
                    interval={chartIntervalTop}
                    theme="dark"
                    hideSideToolbar={!showDrawingTools}
                    studies={['IchimokuCloud@tv-basicstudies', 'Volume@tv-basicstudies']}
                    containerId="xauusd_chart_col_left"
                    containerHeight="640px"
                  />
                </div>

                {/* Right Column Pane: 1M Execution */}
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-[#161B22]">
                  <div className="p-2 bg-[#0D1117] border-b border-slate-800 flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-cyan-400 text-xs">1M Scalp Execution</span>
                    <div className="flex items-center gap-1 bg-[#0B0E14] p-0.5 rounded border border-slate-800 font-mono text-xs">
                      {['1', '3', '5', '15', '60'].map(interval => (
                        <button
                          key={interval}
                          onClick={() => setChartIntervalBottom(interval)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            chartIntervalBottom === interval
                              ? 'bg-cyan-500 text-slate-950'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {interval}m
                        </button>
                      ))}
                    </div>
                  </div>
                  <TradingViewWidget
                    key={`xauusd_chart_col_right_${chartIntervalBottom}`}
                    symbol="OANDA:XAUUSD"
                    interval={chartIntervalBottom}
                    theme="dark"
                    hideSideToolbar={!showDrawingTools}
                    studies={['IchimokuCloud@tv-basicstudies', 'Volume@tv-basicstudies']}
                    containerId="xauusd_chart_col_right"
                    containerHeight="640px"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MOBILE STICKY QUICK TRADE EXECUTION BAR (VISIBLE ONLY ON MOBILE < sm) */}
      {/* ========================================================================= */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0B0E14]/95 border-t border-slate-800/90 px-3 py-2.5 backdrop-blur shadow-2xl flex items-center justify-between gap-2.5">
        <div className="flex flex-col">
          <span className="text-[9px] text-slate-400 font-mono">
            {selectedTrade ? `${selectedTrade.direction} (Reflected)` : 'XAUUSD Spot'}
          </span>
          <span className="text-sm font-black text-white font-mono leading-none">
            ${(customEntryPrice ?? currentSpotPrice ?? 0).toFixed(2)}
          </span>
          <span className="text-[9px] text-rose-400 font-semibold font-mono">
            SL: ${(customStopLossPrice ?? dynamicStopLoss ?? 0).toFixed(2)}
            <span className="text-slate-400 ml-1">| {tradeAmount} oz</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-1 justify-end max-w-[240px]">
          <button
            onClick={() => handleQuickTrade('LONG')}
            className="flex-1 py-2.5 px-2.5 bg-emerald-600 active:bg-emerald-700 text-white rounded-lg text-xs font-black shadow-md flex items-center justify-center gap-1 touch-manipulation min-h-[44px]"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Buy Long</span>
          </button>
          <button
            onClick={() => handleQuickTrade('SHORT')}
            className="flex-1 py-2.5 px-2.5 bg-rose-600 active:bg-rose-700 text-white rounded-lg text-xs font-black shadow-md flex items-center justify-center gap-1 touch-manipulation min-h-[44px]"
          >
            <ArrowDownRight className="w-4 h-4" />
            <span>Sell Short</span>
          </button>
        </div>
      </div>
    </div>
  );
};
