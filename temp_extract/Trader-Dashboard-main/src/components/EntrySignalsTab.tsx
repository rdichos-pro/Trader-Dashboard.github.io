import React, { useEffect, useMemo, useState } from 'react';
import { 
  Activity, 
  AlertCircle, 
  ArrowDownRight, 
  ArrowUpRight, 
  Award, 
  Bell, 
  BellRing, 
  Check, 
  CheckCircle2, 
  ChevronDown, 
  ChevronRight, 
  Cloud, 
  Eye, 
  Flame, 
  HelpCircle, 
  Info, 
  Lock, 
  Plus, 
  RotateCcw, 
  ShieldCheck, 
  Sliders, 
  Target, 
  TrendingDown, 
  TrendingUp, 
  Volume2, 
  X, 
  Zap 
} from 'lucide-react';
import { evaluateConfluenceDetails } from '../services/signalEngine';
import { marketDataService } from '../services/marketDataService';
import { getTickerConfidenceScore } from '../services/confidenceScoring';
import { SignalAccuracyStats, SignalAlert, SignalRuleConfig, TickerQuote } from '../types/trading';
import { formatCurrency } from '../utils/formatters';
import { 
  getNotificationPermission, 
  playSignalChime, 
  requestBrowserNotificationPermission, 
  sendSystemNotification 
} from '../utils/browserNotifications';

interface EntrySignalsTabProps {
  rules: SignalRuleConfig[];
  onUpdateRules: (newRules: SignalRuleConfig[]) => void;
  alerts: SignalAlert[];
  xauusdSignals: any[];
  onDismissAlert: (id: string) => void;
  accuracyStats: SignalAccuracyStats[];
  maxAlertsPerSession: number;
  onUpdateMaxAlerts: (cap: number) => void;
  onSelectTicker: (symbol: string) => void;
  onOpenNewPositionWithTicker: (symbol: string, currentPrice: number) => void;
  onNavigateToTab: (tab: string) => void;
  universe?: TickerQuote[];
}

export const EntrySignalsTab: React.FC<EntrySignalsTabProps> = ({
  rules,
  onUpdateRules,
  alerts,
  xauusdSignals,
  onDismissAlert,
  accuracyStats,
  maxAlertsPerSession,
  onUpdateMaxAlerts,
  onSelectTicker,
  onOpenNewPositionWithTicker,
  onNavigateToTab,
  universe,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'confluence' | 'feed' | 'rules' | 'accuracy'>('confluence');
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'ENTRY' | 'ALMOST_BUY' | 'EXIT' | 'ALMOST_EXIT'>('ALL');
  const [notifPermission, setNotifPermission] = useState<string>(getNotificationPermission());
  const [testedNotif, setTestedNotif] = useState(false);

  // Live universe quotes state with reactivity
  const [liveQuotes, setLiveQuotes] = useState<TickerQuote[]>(() => {
    if (universe && universe.length > 0) return universe;
    return marketDataService.getAllQuotes();
  });
  const [isSyncing4H, setIsSyncing4H] = useState<boolean>(false);
  const [candlesVersion, setCandlesVersion] = useState<number>(0);

  useEffect(() => {
    if (universe && universe.length > 0) {
      setLiveQuotes([...universe]);
    }
  }, [universe]);

  // Subscribe to market data updates to ensure real-time re-evaluations
  useEffect(() => {
    const unsub = marketDataService.subscribe(quotes => {
      setLiveQuotes([...quotes]);
      setCandlesVersion(v => v + 1);
    });
    return unsub;
  }, []);

  // Sync live 1HR candle data from server / Finnhub on mount
  const handleSyncLive1HCandles = async () => {
    setIsSyncing4H(true);
    try {
      const symbols = liveQuotes.map(q => q.symbol);
      await marketDataService.fetchWatchlistHybridData(symbols);
      setCandlesVersion(v => v + 1);
    } catch (err) {
      console.warn('Error syncing live 1HR candles:', err);
    } finally {
      setIsSyncing4H(false);
    }
  };

  useEffect(() => {
    handleSyncLive1HCandles();
  }, []);

  useEffect(() => {
    setNotifPermission(getNotificationPermission());
  }, []);

  const handleRequestPermission = async () => {
    const res = await requestBrowserNotificationPermission();
    setNotifPermission(res);
    if (res === 'granted') {
      sendSystemNotification('🚨 1HR Signal Engine: Notifications Enabled', {
        body: 'System-level alerts active for strict 1D TK Cross + 1HR Closed-Candle trend entries and 1HR reversal exits.',
        direction: 'BULLISH',
        playSound: true,
      });
      setTestedNotif(true);
      setTimeout(() => setTestedNotif(false), 4000);
    }
  };

  const handleTestAlert = () => {
    playSignalChime('BULLISH');
    sendSystemNotification('🚨 TEST: 1HR Master Long Entry (XAUUSD)', {
      body: '1D Daily Golden Cross + 1HR Tenkan ($2910) >= Kijun ($2905) > Cloud Top ($2898), Chikou Bullish, Future Cloud Green, Clearance confirmed.',
      direction: 'BULLISH',
      playSound: false,
    });
    setTestedNotif(true);
    setTimeout(() => setTestedNotif(false), 3000);
  };

  const masterRule = rules.find(r => r.category === 'ichimoku_confluence' || r.id.includes('ichimoku')) || rules[0];

  const updateRuleParam = (paramKey: string, value: any) => {
    const updated = rules.map(r => {
      if (r.id === masterRule.id || r.category === 'ichimoku_confluence') {
        return {
          ...r,
          params: {
            ...r.params,
            [paramKey]: value,
          },
        };
      }
      return r;
    });
    onUpdateRules(updated);
  };

  // Live Confluence evaluation across reactive Universe watchlist symbols with live 1HR + 1D candles
  const confluenceTableData = useMemo(() => {
    return liveQuotes.map(q => {
      const candles = marketDataService.getCachedCandles(q.symbol, '60') || marketDataService.getCachedCandles(q.symbol, '1h') || marketDataService.getCachedCandles(q.symbol) || [];
      const macroCandles = marketDataService.getCachedCandles(q.symbol, 'D') || marketDataService.getCachedCandles(q.symbol, '1d') || [];
      const evaluation = evaluateConfluenceDetails(q.symbol, candles, masterRule?.params, macroCandles);
      return {
        quote: q,
        evaluation,
      };
    });
  }, [liveQuotes, masterRule, candlesVersion]);

  const filteredData = useMemo(() => {
    if (directionFilter === 'ENTRY') {
      return confluenceTableData.filter(d => d.evaluation.isMasterEntryTriggered);
    }
    if (directionFilter === 'ALMOST_BUY') {
      return confluenceTableData.filter(d => d.evaluation.isAlmostBuy);
    }
    if (directionFilter === 'EXIT') {
      return confluenceTableData.filter(d => d.evaluation.isMasterExitTriggered);
    }
    if (directionFilter === 'ALMOST_EXIT') {
      return confluenceTableData.filter(d => d.evaluation.isAlmostExit);
    }
    return confluenceTableData;
  }, [confluenceTableData, directionFilter]);

  const totalBuySignals = confluenceTableData.filter(d => d.evaluation.isMasterEntryTriggered).length;
  const totalAlmostBuySignals = confluenceTableData.filter(d => d.evaluation.isAlmostBuy).length;
  const totalSellSignals = confluenceTableData.filter(d => d.evaluation.isMasterExitTriggered).length;
  const totalAlmostSellSignals = confluenceTableData.filter(d => d.evaluation.isAlmostExit).length;

  return (
    <div className="space-y-4">
      {/* Top Overview & Sub-tab navigation */}
      <div className="bg-[#161B22] p-4 rounded-lg border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <Cloud className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-slate-100">1HR Master Confluence Logic Engine</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
              1D TK Macro + 1HR Closed-Candle
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Strict 7-Pillar Confluence (1D Golden Cross + 6 1HR Pure Ichimoku Rules). Oscillators (Stoch &amp; CCI) removed. Exit is strictly 1HR-based below the 1st closed bar after reversal cross.
          </p>
        </div>

        {/* Action Controls & Sub Navigation */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Notification Permission Toggle */}
          <div className="flex items-center gap-1.5 bg-[#0B0E14] px-2.5 py-1.5 rounded-lg border border-slate-800 text-xs">
            {notifPermission === 'granted' ? (
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <BellRing className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Desktop Alerts Active</span>
              </span>
            ) : (
              <button
                onClick={handleRequestPermission}
                className="flex items-center gap-1 text-amber-400 hover:text-amber-300 font-semibold"
                title="Enable browser system notifications"
              >
                <Bell className="w-3.5 h-3.5" />
                Enable System Alerts
              </button>
            )}
            <button
              onClick={handleTestAlert}
              className="ml-1 px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-mono"
              title="Test notification and audio chime"
            >
              {testedNotif ? 'Pinged ✓' : 'Test Ping'}
            </button>
          </div>

          <div className="bg-[#0B0E14] p-1 rounded-lg border border-slate-800 flex items-center text-xs">
            <button
              id="subtab-confluence-scanner"
              onClick={() => setActiveSubTab('confluence')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                activeSubTab === 'confluence'
                  ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              Live 1HR Scanner
            </button>
            <button
              id="subtab-signal-feed"
              onClick={() => setActiveSubTab('feed')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                activeSubTab === 'feed'
                  ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              Active Alerts ({alerts.length})
            </button>
            <button
              id="subtab-rule-builder"
              onClick={() => setActiveSubTab('rules')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                activeSubTab === 'rules'
                  ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              Formula Parameters
            </button>
            <button
              id="subtab-signal-accuracy"
              onClick={() => setActiveSubTab('accuracy')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                activeSubTab === 'accuracy'
                  ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              Accuracy Stats
            </button>
          </div>
        </div>
      </div>

      {/* SUB-VIEW 1: Live Confluence Scanner Dashboard */}
      {activeSubTab === 'confluence' && (
        <div className="space-y-4">
          {/* Dual Strict Confluence Formula Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 1. Strict Long Entry Logic Box */}
            <div className="bg-[#161B22] p-4 rounded-lg border border-emerald-900/60 space-y-3 shadow-md">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                      7-Pillar Confluence ENTRY (1D Macro + 1HR Ichimoku)
                    </h3>
                    <span className="text-[11px] text-slate-400">Pure trend-riding • No Stoch/CCI • Evaluated on completed 1HR bar</span>
                  </div>
                </div>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded">
                  {totalBuySignals} Active BUYs
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="p-2 rounded bg-emerald-950/40 border border-emerald-800/50 flex items-center justify-between font-mono">
                  <span className="text-emerald-200">1. 1D Daily Tenkan-sen &gt;= Kijun-sen</span>
                  <span className="text-emerald-400 font-semibold text-[11px]">1D Macro Golden Cross</span>
                </div>
                <div className="p-2 rounded bg-[#0B0E14] border border-slate-800/80 flex items-center justify-between font-mono">
                  <span className="text-slate-300">2. 1HR Tenkan-sen &gt;= Kijun-sen</span>
                  <span className="text-emerald-400 font-semibold text-[11px]">1HR TK Bullish Alignment</span>
                </div>
                <div className="p-2 rounded bg-[#0B0E14] border border-slate-800/80 flex items-center justify-between font-mono">
                  <span className="text-slate-300">3. 1HR Closed Price &gt; Cloud Top</span>
                  <span className="text-emerald-400 font-semibold text-[11px]">Above Active Kumo</span>
                </div>
                <div className="p-2 rounded bg-[#0B0E14] border border-slate-800/80 flex items-center justify-between font-mono">
                  <span className="text-slate-300">4. 1HR Tenkan &amp; Kijun &gt; Cloud Top</span>
                  <span className="text-emerald-400 font-semibold text-[11px]">TK Lines Above Kumo</span>
                </div>
                <div className="p-2 rounded bg-emerald-950/30 border border-emerald-800/40 flex items-center justify-between font-mono">
                  <span className="text-emerald-300">5. 1HR Chikou: Close &gt; Close[-26]</span>
                  <span className="text-emerald-400 font-semibold text-[11px]">Free Momentum Clearance</span>
                </div>
                <div className="p-2 rounded bg-emerald-950/30 border border-emerald-800/40 flex items-center justify-between font-mono">
                  <span className="text-emerald-300">6. 1HR Future Cloud: Span A &gt; Span B</span>
                  <span className="text-emerald-400 font-semibold text-[11px]">Forward Cloud is Green</span>
                </div>
                <div className="p-2 rounded bg-purple-950/30 border border-purple-900/40 flex items-center justify-between font-mono">
                  <span className="text-purple-300">7. 1HR Clearance: Close &gt; Cloud Top</span>
                  <span className="text-purple-400 font-semibold text-[11px]">No-Chop Outside Cloud</span>
                </div>
              </div>
            </div>

            {/* 2. Strict Bearish Exit Logic Box */}
            <div className="bg-[#161B22] p-4 rounded-lg border border-rose-900/60 space-y-3 shadow-md">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                    <TrendingDown className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                      Strict 1HR Reversal EXIT (Below 1st Closed Bar)
                    </h3>
                    <span className="text-[11px] text-slate-400">Strictly on 1HR chart • Exits only if price drops below reversal bar</span>
                  </div>
                </div>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 bg-rose-950 text-rose-400 border border-rose-800 rounded">
                  {totalSellSignals} Active SELLs
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="p-2 rounded bg-rose-950/30 border border-rose-800/50 flex items-center justify-between font-mono">
                  <span className="text-rose-200">1. 1HR Tenkan-sen &lt; Kijun-sen</span>
                  <span className="text-rose-400 font-semibold text-[11px]">1HR Reversal Cross Event</span>
                </div>
                <div className="p-2 rounded bg-[#0B0E14] border border-slate-800/80 flex items-center justify-between font-mono">
                  <span className="text-slate-300">2. First Closed 1HR Bar After Cross</span>
                  <span className="text-amber-400 font-semibold text-[11px]">Benchmark Exit Level ($P_reversal)</span>
                </div>
                <div className="p-2 rounded bg-rose-950/40 border border-rose-800/60 flex items-center justify-between font-mono">
                  <span className="text-rose-300">3. Exit Signal: 1HR Price &lt; $P_reversal</span>
                  <span className="text-rose-400 font-bold text-[11px]">Confirmed Breakdown Exit</span>
                </div>
                <div className="p-2 rounded bg-[#0B0E14] border border-slate-800/80 flex items-center justify-between font-mono">
                  <span className="text-slate-300">4. Hold Protection: Price &gt;= $P_reversal</span>
                  <span className="text-emerald-400 font-semibold text-[11px]">Continues Riding While Above</span>
                </div>
                <div className="p-2 rounded bg-cyan-950/20 border border-cyan-900/30 flex items-center justify-between font-mono">
                  <span className="text-cyan-300">5. Pure Structure (No Stoch / No CCI)</span>
                  <span className="text-cyan-400 font-semibold text-[11px]">Clean Ichimoku Geometry</span>
                </div>
              </div>
            </div>
          </div>

          {/* Execution Integrity Bar */}
          <div className="bg-[#11141C] border border-slate-800 rounded-lg p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong className="text-white">1HR Closed-Candle Execution:</strong> Entry evaluated strictly on the completed 1HR closed bar (<code className="bg-slate-900 px-1 py-0.5 rounded text-emerald-400 font-mono">index [length - 2]</code>). Exit signal is strictly below the first closed 1HR bar after a reversal cross.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">Filter View:</span>
              <div className="bg-[#0B0E14] p-0.5 rounded border border-slate-800 flex flex-wrap text-[11px]">
                <button
                  onClick={() => setDirectionFilter('ALL')}
                  className={`px-2 py-0.5 rounded transition-colors ${directionFilter === 'ALL' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  All ({confluenceTableData.length})
                </button>
                <button
                  onClick={() => setDirectionFilter('ENTRY')}
                  className={`px-2 py-0.5 rounded transition-colors ${directionFilter === 'ENTRY' ? 'bg-emerald-700 text-white font-bold' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Bullish Entries ({totalBuySignals})
                </button>
                <button
                  onClick={() => setDirectionFilter('ALMOST_BUY')}
                  className={`px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${
                    directionFilter === 'ALMOST_BUY'
                      ? 'bg-amber-600 text-slate-950 font-bold shadow-sm'
                      : 'text-amber-400 hover:text-amber-300'
                  }`}
                >
                  <Zap className="w-3 h-3" />
                  Almost Buy ({totalAlmostBuySignals})
                </button>
                <button
                  onClick={() => setDirectionFilter('EXIT')}
                  className={`px-2 py-0.5 rounded transition-colors ${directionFilter === 'EXIT' ? 'bg-rose-700 text-white font-bold' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Bearish Exits ({totalSellSignals})
                </button>
                <button
                  onClick={() => setDirectionFilter('ALMOST_EXIT')}
                  className={`px-2 py-0.5 rounded transition-colors ${directionFilter === 'ALMOST_EXIT' ? 'bg-rose-900 text-rose-200 font-bold' : 'text-rose-400 hover:text-rose-300'}`}
                >
                  Near Sell ({totalAlmostSellSignals})
                </button>
              </div>
            </div>
          </div>

          {/* Live Scanner Table */}
          <div className="bg-[#161B22] rounded-lg border border-slate-800 overflow-hidden shadow-lg">
            <div className="p-3 bg-[#0B0E14]/70 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                Live 1HR Confluence Matrix (1D TK Cross + 1HR Pure Ichimoku)
              </span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                  {totalBuySignals} BUYs | <span className="text-amber-400 font-semibold">{totalAlmostBuySignals} ALMOST BUY</span> | {totalSellSignals} SELLs
                </span>
                <button
                  onClick={handleSyncLive1HCandles}
                  disabled={isSyncing4H}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-slate-200 rounded border border-slate-750 flex items-center gap-1.5 text-xs transition-colors cursor-pointer"
                  title="Force re-fetch of live 1HR & 1D exchange candles"
                >
                  <RotateCcw className={`w-3.5 h-3.5 text-emerald-400 ${isSyncing4H ? 'animate-spin' : ''}`} />
                  <span>{isSyncing4H ? 'Syncing 1HR...' : 'Sync Live 1HR'}</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#0B0E14]/40 border-b border-slate-800 text-slate-400 uppercase">
                  <tr>
                    <th className="py-3 px-4">Ticker</th>
                    <th className="py-3 px-3">Live Price</th>
                    <th className="py-3 px-3">Closed 1HR Bar</th>
                    <th className="py-3 px-3">1D TK Macro</th>
                    <th className="py-3 px-3">1HR TK Cross</th>
                    <th className="py-3 px-3">1HR Kumo Cloud</th>
                    <th className="py-3 px-3">Chikou Span</th>
                    <th className="py-3 px-3">Future Cloud</th>
                    <th className="py-3 px-3">1HR Reversal Exit</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredData.map(({ quote, evaluation }) => {
                    const isBuy = evaluation.isMasterEntryTriggered;
                    const isExitTriggered = evaluation.isExitTriggered;
                    const hasReversal = evaluation.hasReversalCross;
                    const isSell = evaluation.isMasterExitTriggered || isExitTriggered;
                    const isAlmostBuy = evaluation.isAlmostBuy;
                    const isAlmostExit = evaluation.isAlmostExit;
                    const inChop = evaluation.isInCloudConsolidation;
                    const isFresh = evaluation.isFreshTrendInception;
                    const isRiding = evaluation.isActivelyRidingTrend;

                    return (
                      <tr
                        key={quote.symbol}
                        className={`transition-colors hover:bg-slate-800/40 ${
                          isBuy
                            ? 'bg-emerald-950/20'
                            : isAlmostBuy
                            ? 'bg-amber-950/20'
                            : isExitTriggered
                            ? 'bg-rose-950/20'
                            : hasReversal
                            ? 'bg-amber-950/10'
                            : isSell
                            ? 'bg-rose-950/20'
                            : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-bold text-slate-100">
                          <button
                            onClick={() => {
                              onSelectTicker(quote.symbol);
                              onNavigateToTab('charts');
                            }}
                            className="hover:text-emerald-400 transition-colors text-left flex items-center gap-1.5"
                          >
                            <span>{quote.symbol}</span>
                            {inChop && (
                              <span className="text-[10px] px-1 py-0.2 bg-amber-950 text-amber-300 border border-amber-800 rounded font-normal">
                                Consolidation
                              </span>
                            )}
                          </button>
                          {(() => {
                            const conf = getTickerConfidenceScore(quote.symbol);
                            const styles: Record<string, string> = {
                              HIGH: 'bg-emerald-950 text-emerald-300 border-emerald-800',
                              MEDIUM: 'bg-amber-950 text-amber-300 border-amber-800',
                              LOW: 'bg-orange-950 text-orange-300 border-orange-800',
                              AVOID: 'bg-rose-950 text-rose-300 border-rose-800',
                              UNKNOWN: 'bg-slate-800 text-slate-400 border-slate-700',
                            };
                            return (
                              <span
                                title={conf.label}
                                className={`mt-1 inline-block text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold border ${styles[conf.grade]}`}
                              >
                                {conf.grade === 'UNKNOWN' ? 'N/A' : `${conf.grade} (${conf.winRatePct}%)`}
                              </span>
                            );
                          })()}
                        </td>

                        <td className="py-3 px-3 text-slate-200 font-semibold">
                          {formatCurrency(quote.price)}
                        </td>

                        <td className="py-3 px-3 text-slate-400 text-[11px]">
                          ${evaluation.closedCandleClose}
                        </td>

                        {/* 1D TK Macro Crossover */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${evaluation.entryDailyTkCross ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                            <span className={`text-[11px] font-semibold ${evaluation.entryDailyTkCross ? 'text-emerald-300' : 'text-rose-300'}`}>
                              {evaluation.entryDailyTkCross ? 'Golden Cross (T≥K)' : 'Bearish (T<K)'}
                            </span>
                          </div>
                        </td>

                        {/* 1HR Tenkan vs Kijun */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${evaluation.entry1hTkBullish ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                            <span className={evaluation.entry1hTkBullish ? 'text-emerald-300 font-semibold' : 'text-rose-300'}>
                              T:${evaluation.tenkan} {evaluation.entry1hTkBullish ? '≥' : '<'} K:${evaluation.kijun}
                            </span>
                          </div>
                        </td>

                        {/* 1HR Kumo Cloud */}
                        <td className="py-3 px-3">
                          <div className="text-[11px]">
                            <span className={evaluation.entry1hPriceAboveCloud && evaluation.entry1hTkAboveCloud ? 'text-emerald-300 font-semibold' : 'text-slate-400'}>
                              {evaluation.entry1hPriceAboveCloud && evaluation.entry1hTkAboveCloud ? 'Above Kumo' : 'Below/In Kumo'}
                            </span>
                            <div className="text-[10px] text-slate-500 font-mono">
                              Top: ${evaluation.cloudTop} | Bot: ${evaluation.cloudBottom}
                            </div>
                          </div>
                        </td>

                        {/* Chikou Span Filter */}
                        <td className="py-3 px-3">
                          <span className={`text-[11px] px-1.5 py-0.5 rounded font-mono ${
                            evaluation.entry1hChikouBullish
                              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                              : 'bg-rose-950/60 text-rose-300 border border-rose-800/60'
                          }`}>
                            {evaluation.entry1hChikouBullish ? 'Bullish (C>C[-26])' : 'Bearish (C≤C[-26])'}
                          </span>
                        </td>

                        {/* Future Cloud */}
                        <td className="py-3 px-3">
                          <span className={`text-[11px] px-1.5 py-0.5 rounded font-mono ${
                            evaluation.entry1hFutureCloudBullish
                              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                              : 'bg-rose-950/60 text-rose-300 border border-rose-800/60'
                          }`}>
                            {evaluation.entry1hFutureCloudBullish ? 'Green (A>B)' : 'Red (A≤B)'}
                          </span>
                        </td>

                        {/* 1HR Reversal Exit Status */}
                        <td className="py-3 px-3">
                          {isExitTriggered ? (
                            <div className="flex flex-col">
                              <span className="text-[11px] px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-700 font-bold font-mono">
                                EXIT &lt; ${evaluation.reversalCrossBarClose}
                              </span>
                              <span className="text-[9px] text-rose-400 font-mono mt-0.5">
                                Price ${quote.price} &lt; ${evaluation.reversalCrossBarClose}
                              </span>
                            </div>
                          ) : hasReversal ? (
                            <div className="flex flex-col">
                              <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-700 font-mono">
                                Watch: Stop &lt; ${evaluation.reversalCrossBarClose}
                              </span>
                              <span className="text-[9px] text-emerald-400 font-mono mt-0.5">
                                Holding (${quote.price} ≥ ${evaluation.reversalCrossBarClose})
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-500 font-mono">
                              Holding (No Cross)
                            </span>
                          )}
                        </td>

                        {/* Overall Status Badge */}
                        <td className="py-3 px-3 text-center">
                          {isBuy ? (
                            <span className="px-2 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-700 font-bold text-[11px] inline-flex items-center gap-1 shadow-sm">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              {isFresh ? '8/8 TREND INCEPTION' : isRiding ? '8/8 RIDING TREND' : '8/8 BUY SIGNAL'}
                            </span>
                          ) : isAlmostBuy ? (
                            <div className="flex flex-col items-center">
                              <span className="px-2 py-0.5 rounded bg-amber-950/90 text-amber-300 border border-amber-600 font-bold text-[11px] inline-flex items-center gap-1 shadow-sm whitespace-nowrap">
                                <Zap className="w-3 h-3 text-amber-400" /> ALMOST BUY ({evaluation.totalPillarsPassed ?? evaluation.entryPassedCount}/8)
                              </span>
                              <span className="text-[9px] text-amber-400/90 font-mono mt-0.5 max-w-[140px] truncate" title={evaluation.almostBuyMissingConditions.join('; ')}>
                                Awaiting: {evaluation.almostBuyMissingConditions[0] || '1 condition'}
                              </span>
                            </div>
                          ) : isExitTriggered ? (
                            <span className="px-2 py-1 rounded bg-rose-950 text-rose-300 border border-rose-700 font-bold text-[11px] inline-flex items-center gap-1 shadow-sm">
                              <TrendingDown className="w-3.5 h-3.5 text-rose-400" /> 1HR EXIT TRIGGERED
                            </span>
                          ) : hasReversal ? (
                            <div className="flex flex-col items-center">
                              <span className="px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-700/70 font-bold text-[11px] inline-flex items-center gap-1 shadow-sm whitespace-nowrap">
                                <AlertCircle className="w-3 h-3 text-amber-400" /> 1HR REVERSAL WATCH
                              </span>
                              <span className="text-[9px] text-amber-400/90 font-mono mt-0.5">
                                Stop &lt; ${evaluation.reversalCrossBarClose}
                              </span>
                            </div>
                          ) : inChop ? (
                            <span className="px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800 text-[10px]">
                              Chop Suppressed
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
                              {evaluation.totalPillarsPassed ?? evaluation.entryPassedCount}/8 Pillars
                            </span>
                          )}
                        </td>

                        {/* Action Buttons */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                onSelectTicker(quote.symbol);
                                onNavigateToTab('charts');
                              }}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition-colors flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3 text-emerald-400" /> Chart
                            </button>
                            <button
                              onClick={() => onOpenNewPositionWithTicker(quote.symbol, quote.price)}
                              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors flex items-center gap-1 ${
                                isBuy
                                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                                  : isAlmostBuy
                                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-sm'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                              }`}
                            >
                              <Plus className="w-3 h-3" /> {isAlmostBuy ? 'Prepare' : 'Trade'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: Live Alert Feed */}
      {activeSubTab === 'feed' && (
        <div className="space-y-3">
          {/* Alert Session Cap Status */}
          <div className="bg-[#161B22]/60 px-4 py-2.5 rounded-lg border border-slate-800 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center space-x-2 text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Session Alerts: <strong className="text-white">{alerts.length}</strong> / {maxAlertsPerSession} cap</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-slate-400">Max Alerts:</span>
              <select
                value={maxAlertsPerSession}
                onChange={e => onUpdateMaxAlerts(Number(e.target.value))}
                className="bg-[#0B0E14] border border-slate-700 text-slate-200 rounded px-2 py-0.5 text-xs font-mono"
              >
                <option value={5}>5 per session</option>
                <option value={10}>10 per session</option>
                <option value={15}>15 per session</option>
                <option value={25}>25 per session</option>
              </select>
            </div>
          </div>

          {alerts.length === 0 ? (
            <div className="bg-[#161B22] p-8 rounded-lg border border-slate-800 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-800/80 mx-auto flex items-center justify-center">
                <Bell className="w-6 h-6 text-slate-500" />
              </div>
              <h3 className="text-sm font-semibold text-slate-200">No Active Confluence Alerts</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                The scanner will automatically post a signal when a 4H closed candle satisfies all 5 strict confluence rules and closes definitively outside the Ichimoku Cloud.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Array.from<SignalAlert>(new Map<string, SignalAlert>(alerts.map(a => [a.id, a])).values()).map(alert => {
                const isBullish = alert.direction === 'BULLISH';
                return (
                  <div
                    key={alert.id}
                    className={`bg-[#161B22] rounded-lg border p-4 space-y-3 shadow-md transition-all ${
                      isBullish ? 'border-emerald-900/60 hover:border-emerald-700/80' : 'border-rose-900/60 hover:border-rose-700/80'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-base font-bold text-slate-100">{alert.ticker}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                            isBullish ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'
                          }`}
                        >
                          {alert.signal || (isBullish ? 'BUY' : 'SELL')} CONFLUENCE
                        </span>
                      </div>
                      <button
                        onClick={() => onDismissAlert(alert.id)}
                        className="text-slate-500 hover:text-slate-300 p-1 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed bg-[#0B0E14] p-2.5 rounded border border-slate-800 font-mono">
                      {alert.reason}
                    </p>

                    <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                      <span>Trigger Price: <strong className="text-slate-100">{formatCurrency(alert.triggerPrice)}</strong></span>
                      <span>Time: {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
                      <button
                        onClick={() => {
                          onSelectTicker(alert.ticker);
                          onNavigateToTab('charts');
                        }}
                        className="flex-1 py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5 text-emerald-400" />
                        View in Chart
                      </button>

                      <button
                        onClick={() => onOpenNewPositionWithTicker(alert.ticker, alert.triggerPrice)}
                        className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1 shadow-sm ${
                          isBullish ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-rose-600 hover:bg-rose-500 text-white'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {isBullish ? 'Open Long Position' : 'Log Reversal Exit'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-VIEW 3: Strategy Parameters Configurator */}
      {activeSubTab === 'rules' && (
        <div className="space-y-4">
          <div className="bg-[#161B22] p-4 rounded-lg border border-slate-800 space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-400" />
                Indicator Formula Parameters & Mathematical Settings
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Configure lookback windows, smoothing, and thresholds for the 4H Ichimoku Cloud, Stochastic Oscillator, and CCI.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Ichimoku Settings */}
              <div className="bg-[#0B0E14] p-4 rounded-lg border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-400 text-xs flex items-center gap-1.5">
                    <Cloud className="w-4 h-4" /> Ichimoku Kinko Hyo
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Standard (9, 26, 52, 26)</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Tenkan-sen Period (Conversion Line)</label>
                    <input
                      type="number"
                      value={masterRule.params.tenkanPeriod ?? 9}
                      onChange={e => updateRuleParam('tenkanPeriod', Number(e.target.value))}
                      className="w-full bg-[#161B22] border border-slate-800 rounded p-1.5 text-slate-100 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Kijun-sen Period (Base Line)</label>
                    <input
                      type="number"
                      value={masterRule.params.kijunPeriod ?? 26}
                      onChange={e => updateRuleParam('kijunPeriod', Number(e.target.value))}
                      className="w-full bg-[#161B22] border border-slate-800 rounded p-1.5 text-slate-100 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Senkou Span B Period (Leading Span B)</label>
                    <input
                      type="number"
                      value={masterRule.params.senkouBPeriod ?? 52}
                      onChange={e => updateRuleParam('senkouBPeriod', Number(e.target.value))}
                      className="w-full bg-[#161B22] border border-slate-800 rounded p-1.5 text-slate-100 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Stochastic Settings */}
              <div className="bg-[#0B0E14] p-4 rounded-lg border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-cyan-400 text-xs flex items-center gap-1.5">
                    <Activity className="w-4 h-4" /> Stochastic Oscillator
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Settings (12, 3, 3)</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400 block mb-1">%K Period</label>
                      <input
                        type="number"
                        value={masterRule.params.stochPeriodK ?? 12}
                        onChange={e => updateRuleParam('stochPeriodK', Number(e.target.value))}
                        className="w-full bg-[#161B22] border border-slate-800 rounded p-1.5 text-slate-100 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Smooth K (SMA)</label>
                      <input
                        type="number"
                        value={masterRule.params.stochSmoothK ?? 3}
                        onChange={e => updateRuleParam('stochSmoothK', Number(e.target.value))}
                        className="w-full bg-[#161B22] border border-slate-800 rounded p-1.5 text-slate-100 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">%D Line Period (SMA of %K)</label>
                    <input
                      type="number"
                      value={masterRule.params.stochPeriodD ?? 3}
                      onChange={e => updateRuleParam('stochPeriodD', Number(e.target.value))}
                      className="w-full bg-[#161B22] border border-slate-800 rounded p-1.5 text-slate-100 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Bullish / Bearish Center Cutoff</label>
                    <input
                      type="number"
                      value={masterRule.params.stochThreshold ?? 50}
                      onChange={e => updateRuleParam('stochThreshold', Number(e.target.value))}
                      className="w-full bg-[#161B22] border border-slate-800 rounded p-1.5 text-cyan-400 font-bold font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* CCI Settings */}
              <div className="bg-[#0B0E14] p-4 rounded-lg border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-400 text-xs flex items-center gap-1.5">
                    <Flame className="w-4 h-4" /> Commodity Channel Index
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Period 40</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">CCI Lookback Period</label>
                    <input
                      type="number"
                      value={masterRule.params.cciPeriod ?? 40}
                      onChange={e => updateRuleParam('cciPeriod', Number(e.target.value))}
                      className="w-full bg-[#161B22] border border-slate-800 rounded p-1.5 text-slate-100 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Bullish / Bearish Cutoff Threshold</label>
                    <input
                      type="number"
                      value={masterRule.params.cciThreshold ?? 50}
                      onChange={e => updateRuleParam('cciThreshold', Number(e.target.value))}
                      className="w-full bg-[#161B22] border border-slate-800 rounded p-1.5 text-amber-400 font-bold font-mono"
                    />
                  </div>

                  <div className="p-2.5 rounded bg-amber-950/20 border border-amber-900/30 text-[11px] text-amber-300/90 font-mono mt-2">
                    ✓ Evaluates Mean Deviation against 40-period typical price SMA.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 4: Accuracy & Win Rates */}
      {activeSubTab === 'accuracy' && (
        <div className="space-y-4">
          <div className="bg-[#161B22]/80 p-4 rounded-lg border border-slate-800">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-400" />
              4H Closed-Candle Trend Confluence Performance
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Historical forward performance and signal win rates (+1D, +3D, and +5D) for the strict 5-pillar confluence system.
            </p>
          </div>

          <div className="bg-[#161B22] rounded-lg border border-slate-800 overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm font-mono">
                <thead className="bg-[#0B0E14]/70 border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Strategy Rule Name</th>
                    <th className="py-3 px-3 text-center">Triggers</th>
                    <th className="py-3 px-3 text-right">1D Win Rate</th>
                    <th className="py-3 px-3 text-right">3D Win Rate</th>
                    <th className="py-3 px-3 text-right">5D Win Rate</th>
                    <th className="py-3 px-3 text-right">Avg 3D Return</th>
                    <th className="py-3 px-4 text-center">Confluence Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {accuracyStats.map((stat) => {
                    return (
                      <tr key={stat.ruleId} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-sans font-semibold text-slate-100">
                          {stat.ruleName}
                        </td>
                        <td className="py-3 px-3 text-center text-slate-300">
                          {stat.totalTriggers}
                        </td>
                        <td className="py-3 px-3 text-right text-emerald-400 font-bold">
                          {stat.winRate1D.toFixed(1)}%
                        </td>
                        <td className="py-3 px-3 text-right text-emerald-400 font-bold">
                          {stat.winRate3D.toFixed(1)}%
                        </td>
                        <td className="py-3 px-3 text-right text-emerald-400 font-bold">
                          {stat.winRate5D.toFixed(1)}%
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-emerald-400">
                          +{stat.avgReturnPct3D.toFixed(2)}%
                        </td>
                        <td className="py-3 px-4 text-center font-sans">
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded">
                            ★ High Edge
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
