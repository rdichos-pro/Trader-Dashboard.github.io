import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { 
  Bell, 
  CandlestickChart, 
  CheckCircle2, 
  ChevronRight, 
  Flame, 
  Info, 
  List, 
  Plus, 
  ShieldAlert, 
  ShieldCheck, 
  Sliders, 
  Wallet, 
  X, 
  Zap 
} from 'lucide-react';

import { AlertToastContainer } from './components/AlertToast';
import { BacktestTab } from './components/BacktestTab';
import { ChartStudioTab } from './components/ChartStudioTab';
import { EntrySignalsTab } from './components/EntrySignalsTab';
import { Header } from './components/Header';
import { NewPositionModal } from './components/NewPositionModal';
import { SettingsModal } from './components/SettingsModal';
import { NewsCatalystsTab } from './components/NewsCatalystsTab';
import { PaperTradingTab } from './components/PaperTradingTab';
import { PositionsTab } from './components/PositionsTab';
import { ScannerTab } from './components/ScannerTab';
import { WatchlistTab } from './components/WatchlistTab';
import { XauusdDaytradeTab } from './components/XauusdDaytradeTab';

import { DEFAULT_GLOBAL_EXIT_STRATEGY, evaluatePositionExits } from './services/exitRuleEngine';
import { marketDataService } from './services/marketDataService';
import { moverDiscoveryService } from './services/moverDiscoveryService';
import { DEFAULT_RULES, evaluateSignals, evaluateTickerSignals, getAccuracyStats } from './services/signalEngine';
import { 
  Candle, 
  ExitStrategyConfig, 
  MarketStatus, 
  NewsItem, 
  PaperAccount, 
  Position, 
  SignalAccuracyStats, 
  SignalAlert, 
  SignalRuleConfig, 
  TickerQuote 
} from './types/trading';
import { 
  requestBrowserNotificationPermission, 
  sendSystemNotification 
} from './utils/browserNotifications';
import { safeGetStorage, safeSetStorage } from './utils/storage';
import { usePersistedState } from './utils/usePersistedState';

// Default initial positions so the user immediately sees working P&L and exit flags
const INITIAL_POSITIONS: Position[] = [
  {
    id: 'pos-1',
    ticker: 'NVDA',
    type: 'LONG',
    entryPrice: 121.50,
    currentPrice: 128.80,
    quantity: 100,
    entryDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    stopLossType: 'TRAILING',
    stopLossPrice: 122.36,
    stopLossPct: 5.0,
    takeProfitPrice: 140.00,
    takeProfitPct: 15.2,
    trailingPeakPrice: 129.20,
    technicalExitRules: {
      flagBelowEMA20: true,
      flagBelowSMA50: true,
      flagRsiOverboughtReversal: true,
    },
    maxHoldDays: 20,
    notes: '20D breakout continuation holding 20 EMA',
    status: 'OPEN',
    unrealizedPnlDollars: 730,
    unrealizedPnlPercent: 6.01,
    exitFlags: [],
  },
  {
    id: 'pos-2',
    ticker: 'AMD',
    type: 'LONG',
    entryPrice: 162.00,
    currentPrice: 154.20,
    quantity: 50,
    entryDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    stopLossType: 'FIXED',
    stopLossPrice: 153.90,
    stopLossPct: 5.0,
    takeProfitPrice: 180.00,
    takeProfitPct: 11.1,
    technicalExitRules: {
      flagBelowEMA20: true,
      flagBelowSMA50: true,
      flagRsiOverboughtReversal: false,
    },
    maxHoldDays: 14,
    notes: 'Support bounce setup',
    status: 'OPEN',
    unrealizedPnlDollars: -390,
    unrealizedPnlPercent: -4.81,
    exitFlags: [],
  },
  {
    id: 'pos-3',
    ticker: 'CRWD',
    type: 'LONG',
    entryPrice: 285.00,
    currentPrice: 318.50,
    quantity: 30,
    entryDate: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    stopLossType: 'TRAILING',
    stopLossPrice: 302.50,
    stopLossPct: 5.0,
    takeProfitPrice: 320.00,
    takeProfitPct: 12.28,
    trailingPeakPrice: 321.00,
    technicalExitRules: {
      flagBelowEMA20: true,
      flagBelowSMA50: true,
      flagRsiOverboughtReversal: true,
    },
    maxHoldDays: 10,
    notes: 'Cybersecurity earnings momentum gap',
    status: 'OPEN',
    unrealizedPnlDollars: 1005,
    unrealizedPnlPercent: 11.75,
    exitFlags: [],
  },
];

const INITIAL_CLOSED_HISTORY: Position[] = [
  {
    id: 'closed-1',
    ticker: 'PLTR',
    type: 'LONG',
    entryPrice: 24.50,
    currentPrice: 28.20,
    quantity: 200,
    entryDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
    closeDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    closePrice: 28.15,
    stopLossType: 'FIXED',
    stopLossPrice: 23.20,
    stopLossPct: 5.3,
    takeProfitPrice: 28.00,
    takeProfitPct: 14.28,
    technicalExitRules: {
      flagBelowEMA20: true,
      flagBelowSMA50: true,
      flagRsiOverboughtReversal: true,
    },
    notes: 'Hit Take-Profit Target 1 (+14.9%)',
    status: 'CLOSED',
    unrealizedPnlDollars: 0,
    unrealizedPnlPercent: 0,
    realizedPnlDollars: 730,
    realizedPnlPercent: 14.89,
    exitFlags: [],
  },
  {
    id: 'closed-2',
    ticker: 'AAPL',
    type: 'LONG',
    entryPrice: 228.00,
    currentPrice: 221.00,
    quantity: 40,
    entryDate: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
    closeDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    closePrice: 216.50,
    stopLossType: 'FIXED',
    stopLossPrice: 216.60,
    stopLossPct: 5.0,
    takeProfitPrice: 245.00,
    takeProfitPct: 7.45,
    technicalExitRules: {
      flagBelowEMA20: true,
      flagBelowSMA50: true,
      flagRsiOverboughtReversal: true,
    },
    notes: 'Stopped out cleanly at 5% risk limit',
    status: 'CLOSED',
    unrealizedPnlDollars: 0,
    unrealizedPnlPercent: 0,
    realizedPnlDollars: -460,
    realizedPnlPercent: -5.04,
    exitFlags: [],
  },
];

const INITIAL_PAPER_ACCOUNT: PaperAccount = {
  balance: 0,
  initialBalance: 0,
  positions: [
    {
      id: 'paper-pos-1',
      ticker: 'TSLA',
      type: 'LONG',
      entryPrice: 212.00,
      currentPrice: 226.50,
      quantity: 50,
      entryDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      stopLossType: 'FIXED',
      stopLossPrice: 201.40,
      stopLossPct: 5.0,
      takeProfitPrice: 235.00,
      takeProfitPct: 10.8,
      technicalExitRules: {
        flagBelowEMA20: true,
        flagBelowSMA50: false,
        flagRsiOverboughtReversal: true,
      },
      status: 'OPEN',
      unrealizedPnlDollars: 725,
      unrealizedPnlPercent: 6.84,
      exitFlags: [],
    },
  ],
  history: [],
  winCount: 4,
  lossCount: 1,
};

export default function App() {
  // Navigation & Mode State
  const [activeTab, setActiveTab] = useState<string>('watchlist');
  const [tradingMode, setTradingMode] = useState<'LIVE' | 'PAPER'>('LIVE');
  const [marketStatus, setMarketStatus] = useState<MarketStatus>({
    isOpen: true,
    session: 'REGULAR',
    nextEvent: 'Market closes in 3h 45m',
    currentTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  });

  // Universe & Watchlist State
  const [universe, setUniverse] = useState<TickerQuote[]>(() => marketDataService.getAllQuotes());
  const [watchlistSymbols, setWatchlistSymbols] = usePersistedState<string[]>('trader_watchlist', [
    'NVDA', 'AAPL', 'AMD', 'TSLA', 'MSFT', 'PLTR', 'AMZN', 'META', 'CRWD', 'ARM'
  ]);

  // Selected Stock for Deep Analysis & Charting
  const [selectedSymbol, setSelectedSymbol] = useState<string>('NVDA');
  const [chartCandles, setChartCandles] = useState<Candle[]>([]);
  const [isLoadingCandles, setIsLoadingCandles] = useState<boolean>(false);

  // Entry Signal Rules & Alerts
  const [rules, setRules] = usePersistedState<SignalRuleConfig[]>('trader_rules', DEFAULT_RULES);
  const [alerts, setAlerts] = useState<SignalAlert[]>([]);
  const [xauusdSignals, setXauusdSignals] = useState<any[]>([]);
  const [maxAlertsPerSession, setMaxAlertsPerSession] = usePersistedState<number>('trader_max_alerts', 15);
  const [accuracyStats, setAccuracyStats] = useState<SignalAccuracyStats[]>(() => getAccuracyStats());

  // Positions & Trade Journal State (Persisted in localStorage)
  const [positions, setPositions] = usePersistedState<Position[]>('trader_positions', INITIAL_POSITIONS);
  const [closedHistory, setClosedHistory] = usePersistedState<Position[]>('trader_closed_history', INITIAL_CLOSED_HISTORY);

  // Gotrade Auto-Discovery & Confluence Settings
  const [autoAddGotradeMovers, setAutoAddGotradeMovers] = usePersistedState<boolean>('trader_auto_add_movers', true);

  // Exit Strategy & Risk Parameters
  const [exitStrategyConfig, setExitStrategyConfig] = usePersistedState<ExitStrategyConfig>(
    'trader_exit_strategy',
    DEFAULT_GLOBAL_EXIT_STRATEGY
  );

  const handleUpdateExitStrategyConfig = (newConfig: ExitStrategyConfig) => {
    setExitStrategyConfig(newConfig);
    // Immediately re-evaluate existing positions with new parameters, news, and financial records
    setPositions(prevPositions => {
      return prevPositions.map(pos => {
        const quote = quotesMap.get(pos.ticker);
        const currentPrice = quote ? quote.price : pos.currentPrice;
        const candles = marketDataService.getCachedCandles(pos.ticker) || [];
        return evaluatePositionExits(pos, currentPrice, candles, newConfig, news, quote);
      });
    });
  };

  // Paper Account State (Persisted in localStorage)
  const [paperAccount, setPaperAccount] = usePersistedState<PaperAccount>('trader_paper_account', INITIAL_PAPER_ACCOUNT);

  // News & Catalysts Feed
  const [news, setNews] = useState<NewsItem[]>([]);

  // Modals & Toast State
  const [isNewPositionModalOpen, setIsNewPositionModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isResettingCache, setIsResettingCache] = useState(false);
  const [modalInitialTicker, setModalInitialTicker] = useState('NVDA');
  const [modalInitialPrice, setModalInitialPrice] = useState(128.50);
  const [modalInitialStopPrice, setModalInitialStopPrice] = useState<number | undefined>(undefined);
  const [toastAlerts, setToastAlerts] = useState<SignalAlert[]>([]);
  const [isScanningWatchlist, setIsScanningWatchlist] = useState(false);
  const [lastScanTimestamp, setLastScanTimestamp] = useState<number>(Date.now());
  const seenAlertIdsRef = useRef<Set<string>>(new Set());
  const isInitialScanRef = useRef<boolean>(true);

  // Quotes Map for fast O(1) lookup
  const quotesMap = useMemo(() => {
    const map = new Map<string, TickerQuote>();
    universe.forEach(q => map.set(q.symbol, q));
    return map;
  }, [universe]);

  // Derived Watchlist Quotes
  const watchlistQuotes = useMemo(() => {
    return watchlistSymbols
      .map(sym => quotesMap.get(sym) || universe.find(u => u.symbol === sym))
      .filter((q): q is TickerQuote => Boolean(q));
  }, [watchlistSymbols, quotesMap, universe]);

  // Dismiss Toast helper
  const handleDismissToast = useCallback((id: string) => {
    setToastAlerts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ---------------------------------------------------------------------------
  // 5-Minute Watchlist Alert Engine (Rate Limit Protected Finnhub 4H/1D Hybrid Scanner)
  // ---------------------------------------------------------------------------
  const runThrottledWatchlistScan = useCallback(async () => {
    if (isScanningWatchlist) return;
    setIsScanningWatchlist(true);

    const generatedAlerts: SignalAlert[] = [];

    try {
      // Ensure clean, unique watchlist symbols
      const uniqueWatchlist = Array.from(new Set(watchlistSymbols.map(s => s.toUpperCase().trim())));

      // Parallel batch fetching for 4H candles and Daily sparklines
      const hybridData = await marketDataService.fetchWatchlistHybridData(uniqueWatchlist);

      uniqueWatchlist.forEach(sym => {
        const cleanSym = sym.toUpperCase().trim();
        const data = hybridData.get(cleanSym);
        const candles4H = data?.candles4H || marketDataService.getCachedCandles(cleanSym, '240') || [];
        const quote = quotesMap.get(cleanSym) || universe.find(u => u.symbol === cleanSym);

        if (candles4H && candles4H.length >= 3 && quote) {
          // Pass calculated 4H indicators into Entry Confluence & Signal logic
          const tickerSignals = evaluateTickerSignals(quote, candles4H, rules);
          if (tickerSignals.length > 0) {
            generatedAlerts.push(...tickerSignals);
          }
        }
      });

      // Gotrade Auto-Discovery: Check if any non-watchlist stocks are in high confluence
      if (autoAddGotradeMovers) {
        const qualifyingMovers = moverDiscoveryService.findQualifyingAutoAddMovers(uniqueWatchlist, 75);
        if (qualifyingMovers.length > 0) {
          // Filter to movers that have not yet been discovered/alerted in this session
          const genuinelyNewMovers = qualifyingMovers.filter(
            m => !seenAlertIdsRef.current.has(`mover-${m.symbol}`) && !uniqueWatchlist.includes(m.symbol)
          );
          const toAdd = genuinelyNewMovers.slice(0, 2);
          if (toAdd.length > 0) {
            const newSymbols = toAdd.map(m => m.symbol);
            setWatchlistSymbols(prev => [...new Set([...prev, ...newSymbols])]);

            toAdd.forEach((m) => {
              const moverAlertId = `mover-${m.symbol}`;
              seenAlertIdsRef.current.add(moverAlertId);
              const moverAlert: SignalAlert = {
                id: moverAlertId,
                timestamp: new Date().toISOString(),
                ticker: m.symbol,
                ruleId: 'gotrade_auto_mover',
                ruleName: 'Gotrade Confluence Auto-Discovery',
                pipeline: 'Auto-Scanner',
                signal: 'BUY',
                direction: 'BULLISH',
                triggerPrice: m.price,
                rvol: m.rvol,
                volume: m.volume,
                reason: `${m.reason} Met ${m.confluenceScore}% 4H technical confluence (${m.confluencePassedCount}/8 rules). Auto-added to your active watchlist!`,
                dismissed: false,
              };
              generatedAlerts.push(moverAlert);
            });
          }
        }
      }
    } catch (err) {
      console.warn('Watchlist hybrid scan error:', err);
    }

    if (generatedAlerts.length > 0) {
      // 1. Strictly deduplicate newly generated alerts by ID
      const uniqueGeneratedMap = new Map<string, SignalAlert>();
      generatedAlerts.forEach(a => {
        if (!uniqueGeneratedMap.has(a.id)) {
          uniqueGeneratedMap.set(a.id, a);
        }
      });
      const uniqueGenerated = Array.from(uniqueGeneratedMap.values());

      // 2. Initial scan check: Seed alerts and mark seen on startup without phantom pings
      if (isInitialScanRef.current) {
        isInitialScanRef.current = false;
        uniqueGenerated.forEach(a => seenAlertIdsRef.current.add(a.id));
        setAlerts(uniqueGenerated.slice(0, maxAlertsPerSession));
        setLastScanTimestamp(Date.now());
        setIsScanningWatchlist(false);
        return;
      }

      // 3. Identify brand-new alerts that have genuinely not been seen in this session
      const freshlyFired = uniqueGenerated.filter(a => !seenAlertIdsRef.current.has(a.id));

      if (freshlyFired.length > 0) {
        // Mark as seen immediately
        freshlyFired.forEach(a => seenAlertIdsRef.current.add(a.id));

        // Push new alerts to UI Toast notification queue (pure state update)
        setToastAlerts(curr => {
          const toastMap = new Map<string, SignalAlert>();
          freshlyFired.slice(0, 3).forEach(a => toastMap.set(a.id, a));
          curr.forEach(a => {
            if (!toastMap.has(a.id)) toastMap.set(a.id, a);
          });
          return Array.from(toastMap.values()).slice(0, 5);
        });

        // Push to main alerts list (pure state update)
        setAlerts(prevAlerts => {
          const alertMap = new Map<string, SignalAlert>();
          freshlyFired.forEach(a => alertMap.set(a.id, a));
          prevAlerts.forEach(a => {
            if (!alertMap.has(a.id)) alertMap.set(a.id, a);
          });
          return Array.from(alertMap.values()).slice(0, maxAlertsPerSession);
        });

        // 4. Dispatch native system notifications & audio alerts (OUTSIDE state updaters)
        freshlyFired.forEach(alert => {
          const isBuy = alert.signal === 'BUY';
          const isWarn = alert.signal === 'WARN';
          const title = isBuy
            ? `🚨 LONG ENTRY CONFIRMED: ${alert.ticker} (4H Closed Candle)`
            : isWarn
            ? (alert.direction === 'BULLISH'
                ? `⚡ ALMOST A BUY: ${alert.ticker} (4H Setup Coiling)`
                : `⚠️ APPROACHING SELL: ${alert.ticker} (4H Breakdown Warning)`)
            : `🔻 BEARISH EXIT CONFIRMED: ${alert.ticker} (4H Closed Candle)`;

          sendSystemNotification(title, {
            body: alert.reason,
            tag: `signal-${alert.ticker}-${alert.id}`,
            direction: alert.direction,
            playSound: true,
            onClick: () => {
              setSelectedSymbol(alert.ticker);
              setActiveTab('charts');
            },
          });
        });

        // 5. Set 7-second auto-dismiss for newly triggered toasts
        const freshlyFiredIds = new Set(freshlyFired.map(f => f.id));
        setTimeout(() => {
          setToastAlerts(curr => curr.filter(t => !freshlyFiredIds.has(t.id)));
        }, 7000);
      }
    }

    setLastScanTimestamp(Date.now());
    setIsScanningWatchlist(false);
  }, [watchlistSymbols, quotesMap, rules, maxAlertsPerSession, isScanningWatchlist, autoAddGotradeMovers, universe]);

  // ---------------------------------------------------------------------------
  // Clear Cache & Reset Data Handler
  // ---------------------------------------------------------------------------
  const handleClearCacheAndResetData = useCallback(async () => {
    setIsResettingCache(true);
    try {
      // 1. Clear trader state in localStorage
      const keysToClear = [
        'trader_positions',
        'trader_closed_history',
        'trader_exit_strategy',
        'trader_paper_account',
        'trader_rules',
        'trader_watchlist',
        'trader_max_alerts',
        'tv_default_studies',
      ];
      keysToClear.forEach(key => localStorage.removeItem(key));

      // 2. Clear in-memory service caches and trigger backend cache wipe
      await marketDataService.clearAllCacheAndReset();

      // 3. Reset application state
      setUniverse(marketDataService.getAllQuotes());

      // 4. Fetch fresh hybrid 4H & daily data for watchlist and selectedSymbol
      await runThrottledWatchlistScan();
      const freshCandles = await marketDataService.getCandles(selectedSymbol, '1Y', '240');
      setChartCandles(freshCandles);

      // 5. Trigger notification toast
      setToastAlerts(prev => [
        {
          id: `reset-${Date.now()}`,
          timestamp: new Date().toISOString(),
          ticker: 'SYSTEM',
          ruleId: 'cache_reset',
          ruleName: 'Cache Purged & 4H Live Data Refetched',
          pipeline: 'Cache Management',
          signal: 'BUY',
          direction: 'BULLISH',
          triggerPrice: 0,
          rvol: 1,
          volume: 0,
          reason: 'All local & backend caches purged. Fresh Finnhub 4H candles and Ichimoku math recomputed.',
          dismissed: false,
        },
        ...prev.slice(0, 4),
      ]);
    } catch (e) {
      console.error('Error resetting cache and data:', e);
    } finally {
      setIsResettingCache(false);
    }
  }, [runThrottledWatchlistScan, selectedSymbol]);

  // Execute 5-minute polling interval for Finnhub Watchlist scanning (300,000 ms)
  useEffect(() => {
    // Request notification permission if not yet decided
    requestBrowserNotificationPermission().catch(() => {});

    // Immediate initial scan
    runThrottledWatchlistScan();

    // 5-minute interval (Finnhub rate-limit protection)
    const FIVE_MINUTES_MS = 5 * 60 * 1000;
    const scannerInterval = setInterval(() => {
      runThrottledWatchlistScan();
    }, FIVE_MINUTES_MS);

    return () => clearInterval(scannerInterval);
  }, [watchlistSymbols, rules]);

  // Save changes to LocalStorage
  useEffect(() => {
    localStorage.setItem('trader_watchlist', JSON.stringify(watchlistSymbols));
  }, [watchlistSymbols]);

  useEffect(() => {
    localStorage.setItem('trader_positions', JSON.stringify(positions));
  }, [positions]);

  useEffect(() => {
    localStorage.setItem('trader_closed_history', JSON.stringify(closedHistory));
  }, [closedHistory]);

  useEffect(() => {
    localStorage.setItem('trader_rules', JSON.stringify(rules));
  }, [rules]);

  useEffect(() => {
    localStorage.setItem('trader_paper_account', JSON.stringify(paperAccount));
  }, [paperAccount]);

  // Subscribe to Market Data Stream
  useEffect(() => {
    // Initial fetch of news & status
    marketDataService.getMarketNews().then(setNews);
    marketDataService.getMarketStatus().then(setMarketStatus);

    // Poll for XAUUSD Webhook Signals
    const pollXauusd = async () => {
      try {
        const res = await fetch('/api/signals/xauusd');
        if (res.ok) {
          const data = await res.json();
          setXauusdSignals(data);
        }
      } catch (err) {
        // ignore
      }
    };
    pollXauusd();
    const xauInterval = setInterval(pollXauusd, 5000); // Check every 5s

    const unsubscribe = marketDataService.subscribe(quotes => {
      setUniverse([...quotes]);

      // Re-evaluate entry signals against current quotes
      setAlerts(prevAlerts => {
        const newAlerts = evaluateSignals(quotes, rules, maxAlertsPerSession);
        
        // Find truly new alerts
        const prevIds = new Set(prevAlerts.map(a => a.id));
        const freshlyFired = newAlerts.filter(a => !prevIds.has(a.id));
        
        // Preserve dismissed state for existing alerts
        return newAlerts.map(na => {
          const existing = prevAlerts.find(pa => pa.id === na.id);
          return existing ? { ...na, dismissed: existing.dismissed } : na;
        });
      });

      // Re-evaluate open positions for live P&L, exit warnings, and News Reversal Shield
      setPositions(prevPositions => {
        return prevPositions.map(pos => {
          const currentQuote = quotes.find(q => q.symbol === pos.ticker);
          const currentPrice = currentQuote ? currentQuote.price : pos.currentPrice;
          const candles = marketDataService.getCachedCandles(pos.ticker) || [];
          
          const updatedPos = evaluatePositionExits(pos, currentPrice, candles, exitStrategyConfig, news, currentQuote);
          
          return updatedPos;
        });
      });

      // Update paper trading open positions
      setPaperAccount(prevAcc => {
        const updatedPos = prevAcc.positions.map(p => {
          const quote = quotes.find(q => q.symbol === p.ticker);
          const currentPrice = quote ? quote.price : p.currentPrice;
          const isLong = p.type === 'LONG';
          const pnlDollars = isLong
            ? (currentPrice - p.entryPrice) * p.quantity
            : (p.entryPrice - currentPrice) * p.quantity;
          const pnlPct = isLong
            ? ((currentPrice - p.entryPrice) / p.entryPrice) * 100
            : ((p.entryPrice - currentPrice) / p.entryPrice) * 100;

          return {
            ...p,
            currentPrice,
            unrealizedPnlDollars: pnlDollars,
            unrealizedPnlPercent: pnlPct,
          };
        });
        return {
          ...prevAcc,
          positions: updatedPos,
        };
      });
    });

    return () => {
      unsubscribe();
      clearInterval(xauInterval);
    };
  }, [rules, maxAlertsPerSession]);

  // Load Candlestick data for selected chart symbol
  useEffect(() => {
    setIsLoadingCandles(true);
    marketDataService.getCandles(selectedSymbol, '1Y').then(data => {
      setChartCandles(data);
      setIsLoadingCandles(false);
    });
  }, [selectedSymbol]);

  // Handler: Add to Watchlist
  const handleAddToWatchlist = (symbol: string) => {
    if (!symbol || typeof symbol !== 'string') return;
    const sym = symbol.toUpperCase().trim();
    if (sym && !watchlistSymbols.includes(sym)) {
      setWatchlistSymbols([...watchlistSymbols, sym]);
    }
  };

  // Handler: Remove from Watchlist
  const handleRemoveFromWatchlist = (symbol: string) => {
    setWatchlistSymbols(watchlistSymbols.filter(s => s !== symbol));
  };

  // Handler: Dismiss Entry Alert
  const handleDismissAlert = (id: string) => {
    setAlerts(alerts.filter(a => a.id !== id));
  };

  // Handler: Open Trade Dialog with Pre-filled Stock
  const handleOpenNewPositionWithTicker = (symbol: string, currentPrice: number, stopLossPrice?: number) => {
    setModalInitialTicker(symbol);
    setModalInitialPrice(currentPrice);
    setModalInitialStopPrice(stopLossPrice && stopLossPrice > 0 && stopLossPrice < currentPrice ? stopLossPrice : undefined);
    setIsNewPositionModalOpen(true);
  };

  // Handler: Save New Position
  const handleSavePosition = async (newPosData: any) => {
    const sym = (newPosData.ticker || 'NVDA').toUpperCase().trim();
    let currentLivePrice = newPosData.currentPrice || newPosData.entryPrice;

    try {
      const q = await marketDataService.getQuote(sym);
      if (q && q.price > 0) {
        currentLivePrice = q.price;
      }
    } catch {
      // Use provided price
    }

    const basePosition: Position = {
      ...newPosData,
      ticker: sym,
      currentPrice: currentLivePrice,
      id: `pos-${Date.now()}`,
      unrealizedPnlDollars: 0,
      unrealizedPnlPercent: 0,
      exitFlags: [],
    };

    const evaluated = evaluatePositionExits(basePosition, currentLivePrice, undefined, exitStrategyConfig);
    setPositions([evaluated, ...positions]);
    setActiveTab('positions');
  };

  // Handler: Update Existing Position Parameters
  const handleUpdatePosition = (updatedPos: Position) => {
    const evaluated = evaluatePositionExits(updatedPos, updatedPos.currentPrice, undefined, exitStrategyConfig);
    setPositions(positions.map(p => p.id === updatedPos.id ? evaluated : p));
  };

  // Handler: Real-time Live Price Synchronization for Open Positions
  const handleSyncPositionPrices = async () => {
    if (positions.length === 0) return;
    const tickers = positions.map(p => p.ticker);
    try {
      const syncedQuotes = await marketDataService.syncQuotesForSymbols(tickers);
      setPositions(prev =>
        prev.map(pos => {
          const sym = (pos.ticker || '').toUpperCase().trim();
          const liveQ = syncedQuotes.get(sym);
          const livePrice = liveQ?.price && liveQ.price > 0 ? liveQ.price : pos.currentPrice;
          return evaluatePositionExits(pos, livePrice, undefined, exitStrategyConfig);
        })
      );
    } catch (err) {
      console.warn('Failed to sync position prices:', err);
    }
  };

  // Periodic background synchronization of open position prices every 30s
  useEffect(() => {
    if (positions.length === 0) return;
    handleSyncPositionPrices();
    const interval = setInterval(() => {
      handleSyncPositionPrices();
    }, 30000);
    return () => clearInterval(interval);
  }, [positions.length, exitStrategyConfig]);

  // Handler: Close Open Position & Log to Journal
  const handleClosePosition = (id: string, exitPrice: number, notes?: string) => {
    const target = positions.find(p => p.id === id);
    if (!target) return;

    const isLong = target.type === 'LONG';
    const realizedPnl = isLong
      ? (exitPrice - target.entryPrice) * target.quantity
      : (target.entryPrice - exitPrice) * target.quantity;
    const realizedPct = isLong
      ? ((exitPrice - target.entryPrice) / target.entryPrice) * 100
      : ((target.entryPrice - exitPrice) / target.entryPrice) * 100;

    const closedItem: Position = {
      ...target,
      status: 'CLOSED',
      closePrice: exitPrice,
      closeDate: new Date().toISOString(),
      realizedPnlDollars: realizedPnl,
      realizedPnlPercent: realizedPct,
      notes: notes || target.notes || 'Closed manually',
      unrealizedPnlDollars: 0,
      unrealizedPnlPercent: 0,
      exitFlags: [],
    };

    setPositions(positions.filter(p => p.id !== id));
    setClosedHistory([closedItem, ...closedHistory]);
  };

  // Handler: Paper Trading Order Execution
  const handleExecutePaperOrder = (
    ticker: string,
    type: 'LONG' | 'SHORT',
    shares: number,
    price: number,
    stopPct: number = 5,
    targetPct: number = 10
  ) => {
    const orderCost = price * shares;
    const stopPrice = type === 'LONG' ? price * (1 - stopPct / 100) : price * (1 + stopPct / 100);
    const targetPrice = type === 'LONG' ? price * (1 + targetPct / 100) : price * (1 - targetPct / 100);

    const newPaperPos: Position = {
      id: `paper-${Date.now()}`,
      ticker,
      type,
      entryPrice: price,
      currentPrice: price,
      quantity: shares,
      entryDate: new Date().toISOString(),
      stopLossType: 'FIXED',
      stopLossPrice: Number(stopPrice.toFixed(2)),
      stopLossPct: stopPct,
      takeProfitPrice: Number(targetPrice.toFixed(2)),
      takeProfitPct: targetPct,
      technicalExitRules: {
        flagBelowEMA20: true,
        flagBelowSMA50: false,
        flagRsiOverboughtReversal: true,
      },
      status: 'OPEN',
      unrealizedPnlDollars: 0,
      unrealizedPnlPercent: 0,
      exitFlags: [],
    };

    setPaperAccount(prev => ({
      ...prev,
      balance: prev.balance - orderCost,
      positions: [newPaperPos, ...prev.positions],
    }));
  };

  // Handler: Close Paper Position
  const handleClosePaperPosition = (id: string, exitPrice: number) => {
    const pos = paperAccount.positions.find(p => p.id === id);
    if (!pos) return;

    const isLong = pos.type === 'LONG';
    const pnl = isLong
      ? (exitPrice - pos.entryPrice) * pos.quantity
      : (pos.entryPrice - exitPrice) * pos.quantity;
    const returnedCash = pos.entryPrice * pos.quantity + pnl;
    const isWin = pnl >= 0;

    setPaperAccount(prev => ({
      ...prev,
      balance: prev.balance + returnedCash,
      positions: prev.positions.filter(p => p.id !== id),
      history: [
        {
          ...pos,
          status: 'CLOSED',
          closePrice: exitPrice,
          closeDate: new Date().toISOString(),
          realizedPnlDollars: pnl,
          realizedPnlPercent: ((exitPrice - pos.entryPrice) / pos.entryPrice) * 100,
        },
        ...prev.history,
      ],
      winCount: isWin ? prev.winCount + 1 : prev.winCount,
      lossCount: !isWin ? prev.lossCount + 1 : prev.lossCount,
    }));
  };

  // Handler: Reset Paper Account
  const handleResetPaperAccount = (initialBalance: number) => {
    setPaperAccount({
      balance: initialBalance,
      initialBalance,
      positions: [],
      history: [],
      winCount: 0,
      lossCount: 0,
    });
  };

  // Handler: Add Custom Catalyst News
  const handleAddCustomNews = (item: NewsItem) => {
    setNews([item, ...news]);
  };

  // Find user's active position in selected symbol for chart overlay
  const userPositionForSelected = positions.find(p => p.ticker === selectedSymbol);

  // Total exit alerts count across all open positions
  const exitAlertsCount = positions.reduce((sum, p) => sum + p.exitFlags.length, 0);

  return (
    <div className="flex flex-col h-full w-full bg-[#0B0E14] text-slate-300 font-sans overflow-hidden selection:bg-emerald-500/30">
      {/* Universal Trading Dashboard Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeMode={tradingMode === 'LIVE' ? 'LIVE_TRACKER' : 'PAPER_TRADING'}
        setActiveMode={(m) => setTradingMode(m === 'LIVE_TRACKER' ? 'LIVE' : 'PAPER')}
        universe={universe}
        alerts={alerts}
        unreadAlertsCount={alerts.filter(a => !a.dismissed).length}
        onSelectTicker={(sym) => {
          setSelectedSymbol(sym);
          setActiveTab('charts');
        }}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenNewPosition={() => handleOpenNewPositionWithTicker(selectedSymbol, quotesMap.get(selectedSymbol)?.price || 100)}
        onDismissAlert={handleDismissAlert}
        onClearCache={handleClearCacheAndResetData}
        isResettingCache={isResettingCache}
        paperBalance={paperAccount.balance}
        totalPositionsPnl={tradingMode === 'LIVE' ? {
          dollars: positions.reduce((acc, p) => acc + (p.unrealizedPnlDollars || 0), 0),
          percent: 0,
        } : {
          dollars: paperAccount.positions.reduce((acc, p) => {
            const quote = quotesMap.get(p.ticker);
            const currentPrice = quote ? quote.price : p.currentPrice;
            const pnl = p.type === 'LONG' ? (currentPrice - p.entryPrice) * p.quantity : (p.entryPrice - currentPrice) * p.quantity;
            return acc + pnl;
          }, 0),
          percent: 0
        }}
      />

      {/* Main Dashboard Canvas Container */}
      <main className={`flex-1 w-full mx-auto overflow-y-auto space-y-3 pb-20 md:pb-6 ${
        activeTab === 'charts' || activeTab === 'xauusd' ? 'max-w-full px-2 sm:px-4 py-2' : 'max-w-7xl p-3 sm:p-6'
      }`}>
        {/* Watchlist Tab */}
        {activeTab === 'watchlist' && (
          <WatchlistTab
            watchlistQuotes={watchlistQuotes}
            allQuotes={universe}
            onSelectTicker={sym => {
              setSelectedSymbol(sym);
              setActiveTab('charts');
            }}
            onOpenNewPositionWithTicker={handleOpenNewPositionWithTicker}
            onAddToWatchlist={handleAddToWatchlist}
            onRemoveFromWatchlist={handleRemoveFromWatchlist}
            onNavigateToTab={setActiveTab}
            autoAddMovers={autoAddGotradeMovers}
            onToggleAutoAddMovers={setAutoAddGotradeMovers}
          />
        )}

        {/* Scanner Tab */}
        {activeTab === 'scanner' && (
          <ScannerTab
            universe={universe}
            onSelectTicker={sym => {
              setSelectedSymbol(sym);
              setActiveTab('charts');
            }}
            onAddToWatchlist={handleAddToWatchlist}
            onOpenNewPositionWithTicker={handleOpenNewPositionWithTicker}
            onNavigateToTab={setActiveTab}
            watchlistSymbols={new Set(watchlistSymbols)}
            autoAddMovers={autoAddGotradeMovers}
            onToggleAutoAddMovers={setAutoAddGotradeMovers}
          />
        )}

        {/* XAUUSD Daytrade Tab (5m and 15m Signal & Chart in one tab) */}
        {activeTab === 'xauusd' && (
          <XauusdDaytradeTab
            onOpenNewPositionWithTicker={handleOpenNewPositionWithTicker}
            xauusdSignals={xauusdSignals}
            onExecutePaperOrder={handleExecutePaperOrder}
            onNavigateToTab={setActiveTab}
            paperAccount={paperAccount}
            openPositions={positions}
          />
        )}

        {/* Entry Signals Tab */}
        {activeTab === 'signals' && (
          <EntrySignalsTab
            rules={rules}
            onUpdateRules={setRules}
            alerts={alerts}
            xauusdSignals={xauusdSignals}
            onDismissAlert={handleDismissAlert}
            accuracyStats={accuracyStats}
            maxAlertsPerSession={maxAlertsPerSession}
            onUpdateMaxAlerts={setMaxAlertsPerSession}
            onSelectTicker={sym => {
              setSelectedSymbol(sym);
              setActiveTab('charts');
            }}
            onOpenNewPositionWithTicker={handleOpenNewPositionWithTicker}
            onNavigateToTab={setActiveTab}
            universe={universe}
          />
        )}

        {/* Positions & Exit Alerts Tab */}
        {activeTab === 'positions' && (
          <PositionsTab
            positions={tradingMode === 'LIVE' ? positions : paperAccount.positions}
            closedHistory={tradingMode === 'LIVE' ? closedHistory : paperAccount.history}
            onClosePosition={tradingMode === 'LIVE' ? handleClosePosition : handleClosePaperPosition}
            onOpenNewPositionModal={() => {
              setModalInitialTicker(selectedSymbol);
              setModalInitialPrice(quotesMap.get(selectedSymbol)?.price || 100);
              setIsNewPositionModalOpen(true);
            }}
            onSelectTicker={sym => {
              setSelectedSymbol(sym);
              setActiveTab('charts');
            }}
            onNavigateToTab={setActiveTab}
            quotesMap={quotesMap}
            universe={universe}
            exitStrategyConfig={exitStrategyConfig}
            onUpdateExitStrategyConfig={handleUpdateExitStrategyConfig}
            onRefreshPrices={handleSyncPositionPrices}
            onUpdatePosition={handleUpdatePosition}
          />
        )}

        {/* Candlestick Charts Studio */}
        {activeTab === 'charts' && (
          <ChartStudioTab
            selectedSymbol={selectedSymbol}
            onSelectSymbol={setSelectedSymbol}
            universe={universe}
            candles={chartCandles}
            isLoadingCandles={isLoadingCandles}
            onRefreshCandles={() => {
              marketDataService.getCandles(selectedSymbol, '1Y').then(setChartCandles);
            }}
            userPosition={userPositionForSelected}
            onOpenNewPositionWithTicker={handleOpenNewPositionWithTicker}
            watchlistSymbols={watchlistSymbols}
            openPositions={positions}
          />
        )}

        {/* News & Catalysts Feed Tab */}
        {activeTab === 'news' && (
          <NewsCatalystsTab
            news={news}
            universe={universe}
            onSelectTicker={sym => {
              setSelectedSymbol(sym);
              setActiveTab('charts');
            }}
            onAddToWatchlist={handleAddToWatchlist}
            onNavigateToTab={setActiveTab}
            onAddCustomNews={handleAddCustomNews}
          />
        )}

        {/* Paper Trading Mode Tab */}
        {activeTab === 'paper' && (
          <PaperTradingTab
            account={paperAccount}
            onExecutePaperOrder={handleExecutePaperOrder}
            onClosePaperPosition={handleClosePaperPosition}
            onResetPaperAccount={handleResetPaperAccount}
            universe={universe}
            onSelectTicker={sym => {
              setSelectedSymbol(sym);
              setActiveTab('charts');
            }}
            onNavigateToTab={setActiveTab}
          />
        )}

        {/* Backtester Tab */}
        {activeTab === 'backtest' && (
          <BacktestTab
            universe={universe}
            onSelectTicker={sym => {
              setSelectedSymbol(sym);
              setActiveTab('charts');
            }}
            onNavigateToTab={setActiveTab}
          />
        )}
      </main>

      {/* Log New Position Modal */}
      <NewPositionModal
        isOpen={isNewPositionModalOpen}
        onClose={() => setIsNewPositionModalOpen(false)}
        onSavePosition={handleSavePosition}
        initialTicker={modalInitialTicker}
        initialPrice={modalInitialPrice}
        initialStopLossPrice={modalInitialStopPrice}
        universe={universe}
      />

      {/* System Settings & Data Reset Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onClearCache={handleClearCacheAndResetData}
        isResettingCache={isResettingCache}
      />

      {/* Floating Active Alerts Toast Notifications */}
      <AlertToastContainer
        toasts={toastAlerts}
        onDismiss={handleDismissToast}
        onSelectTicker={sym => {
          setSelectedSymbol(sym);
          setActiveTab('charts');
        }}
      />

      {/* Sticky Mobile Bottom Navigation Bar (< md) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0F1219]/95 backdrop-blur-md border-t border-slate-800 flex justify-around items-center px-1 py-1.5 shadow-2xl">
        <button
          id="mobile-bottom-nav-watchlist"
          onClick={() => setActiveTab('watchlist')}
          className={`flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-medium transition-colors ${
            activeTab === 'watchlist' ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <List className="w-4 h-4 mb-0.5" />
          <span>Watchlist</span>
        </button>

        <button
          id="mobile-bottom-nav-signals"
          onClick={() => setActiveTab('signals')}
          className={`flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-medium transition-colors relative ${
            activeTab === 'signals' ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="w-4 h-4 mb-0.5" />
          <span>Signals</span>
          {alerts.length > 0 && (
            <span className="absolute top-0 right-1/4 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-[#0F1219]"></span>
          )}
        </button>

        <button
          id="mobile-bottom-nav-positions"
          onClick={() => setActiveTab('positions')}
          className={`flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-medium transition-colors relative ${
            activeTab === 'positions' ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4 mb-0.5" />
          <span>Positions</span>
          {positions.length > 0 && (
            <span className="absolute top-0 right-1/4 w-2 h-2 rounded-full bg-cyan-500 ring-2 ring-[#0F1219]"></span>
          )}
        </button>

        <button
          id="mobile-bottom-nav-charts"
          onClick={() => setActiveTab('charts')}
          className={`flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-medium transition-colors ${
            activeTab === 'charts' ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <CandlestickChart className="w-4 h-4 mb-0.5" />
          <span>Charts</span>
        </button>

        <button
          id="mobile-bottom-nav-scanner"
          onClick={() => setActiveTab('scanner')}
          className={`flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-medium transition-colors ${
            activeTab === 'scanner' ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="w-4 h-4 mb-0.5" />
          <span>Scanner</span>
        </button>
      </nav>
    </div>
  );
}
