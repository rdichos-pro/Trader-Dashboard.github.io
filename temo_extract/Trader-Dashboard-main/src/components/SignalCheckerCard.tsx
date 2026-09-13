import React, { useState } from 'react';
import { 
  ArrowDownRight, 
  ArrowUpRight, 
  CheckCircle2, 
  ChevronDown,
  Clock, 
  Cloud, 
  Crosshair, 
  Filter, 
  Flame, 
  Layers, 
  LogOut,
  Shield,
  ShieldAlert, 
  Sparkles, 
  TrendingDown, 
  TrendingUp, 
  XCircle, 
  Zap,
  AlertTriangle 
} from 'lucide-react';
import { 
  MultiTimeframeConfluenceState, 
  FastTkSignalState, 
  MarketRegimeType 
} from '../services/xauusdBacktestEngine';

interface SignalCheckerCardProps {
  signalFilterMode: 'AUTO' | 'BUY' | 'SELL' | 'CONSOLIDATION';
  onSignalFilterModeChange: (mode: 'AUTO' | 'BUY' | 'SELL' | 'CONSOLIDATION') => void;
  activeSignalStrategy: 'DUAL_MASTER' | 'FAST_TK';
  onSelectStrategy: (strat: 'DUAL_MASTER' | 'FAST_TK') => void;
  mtfConfluence: MultiTimeframeConfluenceState;
  fastTkSignal: FastTkSignalState;
  currentSpotPrice: number;
  dynamicStopLoss: number;
  dynamicShortStopLoss: number;
  target1Price: number;
  target2Price: number;
  shortTarget1Price: number;
  shortTarget2Price: number;
  onQuickTrade: (direction: 'LONG' | 'SHORT') => void;
}

const safeFixed = (val: number | undefined | null, decimals = 2, fallback = '0.00'): string => {
  if (val === undefined || val === null || isNaN(Number(val))) return fallback;
  return Number(val).toFixed(decimals);
};

export const SignalCheckerCard: React.FC<SignalCheckerCardProps> = ({
  signalFilterMode,
  onSignalFilterModeChange,
  activeSignalStrategy,
  onSelectStrategy,
  mtfConfluence,
  fastTkSignal,
  currentSpotPrice,
  dynamicStopLoss,
  dynamicShortStopLoss,
  target1Price,
  target2Price,
  shortTarget1Price,
  shortTarget2Price,
  onQuickTrade,
}) => {
  // Mobile timeframe tab toggle: 'ALL' (Both 1HR & 1D) | '1HR' | '1D'
  const [mobilePillarView, setMobilePillarView] = useState<'ALL' | '1HR' | '1D'>('ALL');

  // Effective regime for display: 'BUY' | 'SELL' | 'CONSOLIDATION'
  const effectiveRegime: MarketRegimeType = 
    signalFilterMode === 'AUTO' ? mtfConfluence.marketRegime : signalFilterMode;

  const isDual = activeSignalStrategy === 'DUAL_MASTER';
  const entryTf = mtfConfluence?.entryTimeframe || '1M';
  const trendTf = mtfConfluence?.trendTimeframe || '30M';
  const bar1h = mtfConfluence?.bar1h || mtfConfluence?.bar5m;
  const bar1d = mtfConfluence?.bar1d || mtfConfluence?.barTrend || mtfConfluence?.bar15m;
  
  const rules1hBuyPassed = mtfConfluence?.ichimoku1hRulesPassed ?? bar1h?.passedFiltersCount ?? 0;
  const rules1hSellPassed = mtfConfluence?.ichimoku1hSellRulesPassed ?? bar1h?.passedSellFiltersCount ?? 0;
  
  const dailyCrossBuy = mtfConfluence?.dailyTkCross ?? (bar1d?.tenkan >= bar1d?.kijun);
  const dailyCrossSell = mtfConfluence?.dailyTkDeathCross ?? (bar1d?.tenkan <= bar1d?.kijun);

  const totalBuyPillars = mtfConfluence?.totalPillarsPassed ?? ((dailyCrossBuy ? 1 : 0) + rules1hBuyPassed);
  const totalSellPillars = mtfConfluence?.totalSellPillarsPassed ?? ((dailyCrossSell ? 1 : 0) + rules1hSellPassed);

  return (
    <div className="bg-[#161B22] border border-slate-800 rounded-xl p-3.5 sm:p-5 shadow-xl relative overflow-hidden">
      
      {/* 1. SIGNAL REGIME DROPDOWN & SELECTOR BAR */}
      <div className="bg-slate-950/95 border border-slate-800 rounded-xl p-2.5 mb-3 flex flex-col md:flex-row items-center justify-between gap-3 shadow-inner">
        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
            <Filter className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <label htmlFor="signal-regime-dropdown" className="text-xs font-bold text-white uppercase tracking-wider">
                Pure Ichimoku Signal Filter:
              </label>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border flex items-center gap-1 ${
                mtfConfluence.marketRegime === 'BUY'
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                  : mtfConfluence.marketRegime === 'SELL'
                  ? 'bg-rose-950 text-rose-300 border-rose-700'
                  : 'bg-amber-950 text-amber-300 border-amber-700'
              }`}>
                <span>Market:</span>
                <strong>{mtfConfluence.regimeLabel || mtfConfluence.marketRegime}</strong>
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {trendTf} Tenkan-Kijun Crossover Gate + {entryTf} 6-Rule Ichimoku Breakout (Zero Stoch, Zero CCI).
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
          {/* Dropdown Selection */}
          <div className="relative w-full sm:w-56">
            <select
              id="signal-regime-dropdown"
              value={signalFilterMode}
              onChange={(e) => onSignalFilterModeChange(e.target.value as any)}
              className="w-full appearance-none bg-slate-900 border border-slate-700 text-white text-xs font-bold rounded-lg px-3 py-2 pr-8 shadow-sm focus:outline-none focus:border-amber-500 cursor-pointer min-h-[38px]"
            >
              <option value="AUTO">🌐 Auto Live ({mtfConfluence.marketRegime})</option>
              <option value="BUY">🟢 Buy Signals (1D TK Cross + 1HR Bull)</option>
              <option value="SELL">🔴 Sell Signals (1D Death Cross + 1HR Bear)</option>
              <option value="CONSOLIDATION">🟡 Consolidation / Kumo Chop Only</option>
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Quick-select pills */}
          <div className="flex items-center gap-1 w-full sm:w-auto">
            <button
              id="btn-filter-auto"
              onClick={() => onSignalFilterModeChange('AUTO')}
              className={`flex-1 sm:flex-initial px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all min-h-[38px] ${
                signalFilterMode === 'AUTO' 
                  ? 'bg-slate-200 text-slate-950 font-black' 
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Auto
            </button>
            <button
              id="btn-filter-buy"
              onClick={() => onSignalFilterModeChange('BUY')}
              className={`flex-1 sm:flex-initial px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 min-h-[38px] ${
                signalFilterMode === 'BUY' 
                  ? 'bg-emerald-500 text-slate-950 font-black' 
                  : 'bg-slate-900 text-emerald-400 hover:bg-emerald-950/40 border border-slate-800'
              }`}
            >
              <span>Buy</span>
              <span className="text-[10px] font-mono opacity-80">({totalBuyPillars}/7)</span>
            </button>
            <button
              id="btn-filter-sell"
              onClick={() => onSignalFilterModeChange('SELL')}
              className={`flex-1 sm:flex-initial px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 min-h-[38px] ${
                signalFilterMode === 'SELL' 
                  ? 'bg-rose-500 text-slate-950 font-black' 
                  : 'bg-slate-900 text-rose-400 hover:bg-rose-950/40 border border-slate-800'
              }`}
            >
              <span>Sell</span>
              <span className="text-[10px] font-mono opacity-80">({totalSellPillars}/7)</span>
            </button>
            <button
              id="btn-filter-chop"
              onClick={() => onSignalFilterModeChange('CONSOLIDATION')}
              className={`flex-1 sm:flex-initial px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all min-h-[38px] ${
                signalFilterMode === 'CONSOLIDATION' 
                  ? 'bg-amber-500 text-slate-950 font-black' 
                  : 'bg-slate-900 text-amber-400 hover:bg-amber-950/40 border border-slate-800'
              }`}
            >
              Chop
            </button>
          </div>
        </div>
      </div>

      {/* 2. STRATEGY CHOOSER BAR */}
      <div className="bg-slate-950/95 border border-slate-800 rounded-xl p-2.5 mb-3.5 flex flex-col sm:flex-row items-center justify-between gap-2.5 shadow-inner">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">
            Active Strategy:
          </span>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            id="select-strat-dual-mtf"
            onClick={() => onSelectStrategy('DUAL_MASTER')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all touch-manipulation min-h-[38px] ${
              activeSignalStrategy === 'DUAL_MASTER'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span>1D TK Cross + 1HR Ichimoku</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
              activeSignalStrategy === 'DUAL_MASTER' ? 'bg-slate-950 text-amber-300' : 'bg-slate-800 text-slate-400'
            }`}>
              7 Pillars
            </span>
          </button>

          <button
            id="select-strat-fast-tk"
            onClick={() => onSelectStrategy('FAST_TK')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all touch-manipulation min-h-[38px] ${
              activeSignalStrategy === 'FAST_TK'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Zap className="w-3.5 h-3.5 shrink-0" />
            <span>1HR Fast TK Cross (Pure Ichimoku)</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
              activeSignalStrategy === 'FAST_TK' ? 'bg-slate-950 text-emerald-300' : 'bg-slate-800 text-slate-400'
            }`}>
              Rank #1
            </span>
          </button>
        </div>
      </div>

      {/* 3. HEADER ROW: CONFLUENCE METER & STATUS BADGE */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800 pb-3 mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl border shrink-0 ${
            effectiveRegime === 'BUY'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : effectiveRegime === 'SELL'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
          }`}>
            {effectiveRegime === 'BUY' ? (
              <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
            ) : effectiveRegime === 'SELL' ? (
              <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6" />
            ) : (
              <Cloud className="w-5 h-5 sm:w-6 sm:h-6" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
                {isDual ? '1D Macro TK Crossover + 1HR Ichimoku Engine' : '1HR Fast Tenkan-Kijun Scalp Trigger'}
              </span>
              <span className={`text-[9px] sm:text-[10px] font-mono px-1.5 py-0.5 rounded border font-bold ${
                effectiveRegime === 'BUY' 
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/40' 
                  : effectiveRegime === 'SELL'
                  ? 'bg-rose-950/60 text-rose-300 border-rose-800/40'
                  : 'bg-amber-950/60 text-amber-300 border-amber-800/40'
              }`}>
                {effectiveRegime === 'BUY' ? 'BUY REGIME' : effectiveRegime === 'SELL' ? 'SELL REGIME' : 'CHOP / KUMO CLOUD'}
              </span>
            </div>

            <h2 className="text-base sm:text-xl font-black text-white tracking-tight flex items-center gap-2 mt-0.5">
              {effectiveRegime === 'BUY' ? (
                <>
                  <span>Pure Ichimoku Confluence:</span>
                  <span className={`font-mono ${
                    totalBuyPillars >= 7 
                      ? 'text-emerald-400' 
                      : totalBuyPillars >= 5 
                      ? 'text-amber-400' 
                      : 'text-slate-300'
                  }`}>
                    {totalBuyPillars} / 7 ({mtfConfluence.alignmentScore}%)
                  </span>
                </>
              ) : effectiveRegime === 'SELL' ? (
                <>
                  <span>Sell Breakdown Confluence:</span>
                  <span className={`font-mono ${
                    totalSellPillars >= 7 
                      ? 'text-rose-400' 
                      : totalSellPillars >= 5 
                      ? 'text-amber-400' 
                      : 'text-slate-300'
                  }`}>
                    {totalSellPillars} / 7 ({mtfConfluence.sellAlignmentScore}%)
                  </span>
                </>
              ) : (
                <>
                  <span>1HR Kumo Cloud Chop Bounds:</span>
                  <span className="font-mono text-amber-300">
                    ${safeFixed(bar1h?.cloudBottom, 1)} – ${safeFixed(bar1h?.cloudTop, 1)}
                  </span>
                </>
              )}
            </h2>
          </div>
        </div>

        {/* Visual Alignment Badge */}
        <div className="flex items-center">
          {effectiveRegime === 'BUY' ? (
            <div className={`w-full sm:w-auto px-3 sm:px-4 py-2 rounded-xl border flex items-center justify-center gap-2 font-black text-xs sm:text-sm shadow-md ${
              mtfConfluence.alignmentStatus === 'DUAL_MASTER_BUY'
                ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                : mtfConfluence.alignmentStatus === 'STRONG_BUY_SYNC'
                ? 'bg-emerald-900/60 border-emerald-500/50 text-emerald-200'
                : 'bg-slate-900 border-slate-700 text-slate-300'
            }`}>
              {mtfConfluence.alignmentStatus === 'DUAL_MASTER_BUY' && <Flame className="w-4 h-4 text-emerald-400 animate-pulse shrink-0" />}
              {mtfConfluence.alignmentStatus === 'STRONG_BUY_SYNC' && <Zap className="w-4 h-4 text-emerald-400 shrink-0" />}
              <span>{mtfConfluence.alignmentStatus === 'DUAL_MASTER_BUY' ? '🔥 1D TK CROSS + 1HR ICHIMOKU (7/7)' : '🟢 BULLISH ICHIMOKU ALIGNMENT'}</span>
            </div>
          ) : effectiveRegime === 'SELL' ? (
            <div className={`w-full sm:w-auto px-3 sm:px-4 py-2 rounded-xl border flex items-center justify-center gap-2 font-black text-xs sm:text-sm shadow-md ${
              totalSellPillars >= 7
                ? 'bg-rose-950/80 border-rose-500 text-rose-300 shadow-[0_0_20px_rgba(244,63,94,0.25)]'
                : totalSellPillars >= 5
                ? 'bg-rose-900/60 border-rose-500/50 text-rose-200'
                : 'bg-slate-900 border-slate-700 text-slate-300'
            }`}>
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{totalSellPillars >= 7 ? '🚨 1D TK DEATH CROSS + 1HR ICHIMOKU SHORT' : '🔴 BEARISH ICHIMOKU ALIGNMENT'}</span>
            </div>
          ) : (
            <div className="w-full sm:w-auto px-3 sm:px-4 py-2 rounded-xl border border-amber-500/50 bg-amber-950/70 text-amber-300 flex items-center justify-center gap-2 font-black text-xs sm:text-sm shadow-md">
              <Cloud className="w-4 h-4 text-amber-400 shrink-0" />
              <span>☁️ 1HR KUMO CHOP / STAND ASIDE</span>
            </div>
          )}
        </div>
      </div>

      {/* Guidance banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 sm:p-3 text-xs text-slate-300 mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2">
        <div className="flex items-start sm:items-center gap-1.5">
          <span className="font-bold text-amber-400 shrink-0">Ichimoku Guidance:</span>
          <span className="text-[11px] sm:text-xs">
            {effectiveRegime === 'BUY'
              ? (isDual ? mtfConfluence.guidance : fastTkSignal.guidance)
              : effectiveRegime === 'SELL'
              ? 'Bearish regime detected. Confirm sell breakdown trigger strictly below last 1HR signal bar close before entering short.'
              : 'Market is inside 1HR Kumo Cloud chop or awaiting 1D Daily Tenkan-Kijun crossover. Stand aside until breakout above Cloud Top or breakdown below Cloud Floor.'}
          </span>
        </div>
        <div className="text-[10px] sm:text-[11px] font-mono text-slate-400 shrink-0">
          {effectiveRegime === 'BUY' && (
            <>Pure Ichimoku: <strong className="text-emerald-400 font-bold">1HR Entry + 1D TK Cross</strong></>
          )}
          {effectiveRegime === 'SELL' && (
            <>Short Model: <strong className="text-rose-400 font-bold">1HR Breakdown + 1D TK Death Cross</strong></>
          )}
          {effectiveRegime === 'CONSOLIDATION' && (
            <span className="text-amber-400 font-bold">⚠️ Stand Aside in 1HR Cloud Chop</span>
          )}
        </div>
      </div>

      {/* 4. BREAKOUT / BREAKDOWN / RANGE ENTRY CONFIRMATION CARD */}
      {effectiveRegime === 'BUY' && (() => {
        const signalBarClose = isDual ? mtfConfluence?.lastConfluenceBarClose : fastTkSignal?.lastSignalBarClose;
        const triggerPrice = isDual ? mtfConfluence?.entryTriggerPrice : fastTkSignal?.entryTriggerPrice;
        const isTriggered = isDual ? mtfConfluence?.isEntryTriggered : fastTkSignal?.isEntryTriggered;
        const diffDollar = isDual ? mtfConfluence?.entryDiffDollar : fastTkSignal?.entryDiffDollar;

        return (
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-amber-500/40 rounded-xl p-3 sm:p-4 mb-3 shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-lg shrink-0 border ${
                  isTriggered
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                }`}>
                  <Crosshair className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm font-black text-white">
                      Buy Trigger: Over Last 1HR Signal Bar Close
                    </span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {isDual ? '1D TK Cross + 1HR 6-Rule Breakout' : '1HR Fast TK Cross Breakout'}
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                    Orders execute strictly when 1HR Gold trades over the close of the candle with all pure Ichimoku confluences.
                  </p>
                </div>
              </div>

              {/* Status Pill */}
              <div className="flex items-center gap-2 shrink-0">
                <div className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold flex items-center gap-2 ${
                  isTriggered
                    ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                    : 'bg-amber-950/60 border-amber-500/50 text-amber-300'
                }`}>
                  {isTriggered ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>TRIGGER CONFIRMED (&gt; ${safeFixed(signalBarClose, 2)})</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                      <span>AWAITING 1HR BREAKOUT (&gt; ${safeFixed(signalBarClose, 2)})</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Metric Comparison Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-slate-800/80 font-mono text-center">
              <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-2">
                <span className="text-[10px] text-slate-400 block font-sans">1HR Signal Bar Close</span>
                <span className="text-xs sm:text-sm font-bold text-white">${safeFixed(signalBarClose, 2)}</span>
              </div>
              <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-2">
                <span className="text-[10px] text-slate-400 block font-sans">Required Trigger</span>
                <span className="text-xs sm:text-sm font-bold text-amber-300">&gt; ${safeFixed(triggerPrice, 2)}</span>
              </div>
              <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-2">
                <span className="text-[10px] text-slate-400 block font-sans">Current Spot</span>
                <span className="text-xs sm:text-sm font-bold text-emerald-400">${safeFixed(currentSpotPrice, 2)}</span>
              </div>
              <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-2">
                <span className="text-[10px] text-slate-400 block font-sans">Breakout Delta</span>
                <span className={`text-xs sm:text-sm font-bold ${(diffDollar ?? 0) > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {(diffDollar ?? 0) > 0 ? `+$${safeFixed(diffDollar, 2)}` : `-$${safeFixed(Math.abs(diffDollar ?? 0), 2)}`}
                </span>
              </div>
            </div>
          </div>
        );
      })()}

      {effectiveRegime === 'SELL' && (() => {
        const sellSignalBarClose = isDual ? mtfConfluence?.lastSellConfluenceBarClose : fastTkSignal?.lastSellSignalBarClose;
        const sellTriggerPrice = isDual ? mtfConfluence?.sellTriggerPrice : fastTkSignal?.sellTriggerPrice;
        const isSellTriggered = isDual ? mtfConfluence?.isSellEntryTriggered : fastTkSignal?.isSellEntryTriggered;
        const sellDiff = isDual ? mtfConfluence?.sellDiffDollar : fastTkSignal?.sellDiffDollar;

        return (
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-rose-500/40 rounded-xl p-3 sm:p-4 mb-3 shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-lg shrink-0 border ${
                  isSellTriggered
                    ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                }`}>
                  <Crosshair className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm font-black text-white">
                      Sell Breakdown Trigger: Under Last 1HR Signal Bar Close
                    </span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      {isDual ? '1D TK Death Cross + 1HR Bearish Ichimoku' : '1HR Fast TK Death Cross'}
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                    Orders execute strictly when 1HR Gold trades under the close of the candle with all bearish confluences.
                  </p>
                </div>
              </div>

              {/* Status Pill */}
              <div className="flex items-center gap-2 shrink-0">
                <div className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold flex items-center gap-2 ${
                  isSellTriggered
                    ? 'bg-rose-950/80 border-rose-500 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.2)]'
                    : 'bg-amber-950/60 border-amber-500/50 text-amber-300'
                }`}>
                  {isSellTriggered ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-rose-400" />
                      <span>BREAKDOWN TRIGGERED (&lt; ${safeFixed(sellSignalBarClose, 2)})</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                      <span>AWAITING 1HR BREAKDOWN (&lt; ${safeFixed(sellSignalBarClose, 2)})</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Metric Comparison Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-slate-800/80 font-mono text-center">
              <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-2">
                <span className="text-[10px] text-slate-400 block font-sans">1HR Signal Bar Close</span>
                <span className="text-xs sm:text-sm font-bold text-white">${safeFixed(sellSignalBarClose, 2)}</span>
              </div>
              <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-2">
                <span className="text-[10px] text-slate-400 block font-sans">Required Breakdown</span>
                <span className="text-xs sm:text-sm font-bold text-amber-300">&lt; ${safeFixed(sellTriggerPrice, 2)}</span>
              </div>
              <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-2">
                <span className="text-[10px] text-slate-400 block font-sans">Current Spot</span>
                <span className="text-xs sm:text-sm font-bold text-rose-400">${safeFixed(currentSpotPrice, 2)}</span>
              </div>
              <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-2">
                <span className="text-[10px] text-slate-400 block font-sans">Breakdown Delta</span>
                <span className={`text-xs sm:text-sm font-bold ${(sellDiff ?? 0) > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {(sellDiff ?? 0) > 0 ? `-$${safeFixed(sellDiff, 2)}` : `+$${safeFixed(Math.abs(sellDiff ?? 0), 2)}`}
                </span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* DEDICATED LIVE EXIT SIGNAL CARD: Strictly below first closed bar after reversal cross */}
      {(() => {
        const hasReversal = isDual ? mtfConfluence?.hasReversalCross : fastTkSignal?.hasReversalCross;
        const reversalBarClose = isDual ? mtfConfluence?.reversalCrossBarClose : fastTkSignal?.reversalCrossBarClose;
        const reversalBarTime = isDual ? mtfConfluence?.reversalCrossBarTime : fastTkSignal?.reversalCrossBarTime;
        const exitTriggerPrice = isDual ? mtfConfluence?.exitTriggerPrice : fastTkSignal?.exitTriggerPrice;
        const isExitTriggered = isDual ? mtfConfluence?.isExitTriggered : fastTkSignal?.isExitTriggered;
        const exitDiff = isDual ? mtfConfluence?.exitDiffDollar : fastTkSignal?.exitDiffDollar;

        return (
          <div className={`rounded-xl p-3 sm:p-4 mb-3 shadow-lg border transition-all ${
            isExitTriggered
              ? 'bg-rose-950/40 border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.25)]'
              : hasReversal
              ? 'bg-amber-950/30 border-amber-500/60'
              : 'bg-slate-950/80 border-slate-800'
          }`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-lg shrink-0 border ${
                  isExitTriggered
                    ? 'bg-rose-500/20 border-rose-500/50 text-rose-400'
                    : hasReversal
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300'
                }`}>
                  <LogOut className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm font-black text-white">
                      Exit Signal Rule: Below First Closed Bar After Reversal Cross
                    </span>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                      isExitTriggered
                        ? 'bg-rose-900/60 text-rose-200 border-rose-700'
                        : hasReversal
                        ? 'bg-amber-900/60 text-amber-200 border-amber-700'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}>
                      {entryTf} Tenkan &lt; Kijun Cross
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                    {hasReversal
                      ? isExitTriggered
                        ? `🚨 REVERSAL EXIT TRIGGERED: Price has broken below the first closed ${entryTf} bar ($${safeFixed(reversalBarClose, 2)}) after the Tenkan-Kijun reversal cross. Exit long position immediately!`
                        : `⏳ REVERSAL CROSS FORMED: ${entryTf} Tenkan crossed below Kijun on bar ${reversalBarTime ? `[${reversalBarTime}]` : ''}. Long position remains protected until price trades strictly below its close of $${safeFixed(reversalBarClose, 2)}.`
                      : `🛡️ NO REVERSAL CROSS ACTIVE: ${entryTf} Tenkan remains above or equal to Kijun. Position is protected. Exit level calibrates once a reversal cross candle closes.`}
                  </p>
                </div>
              </div>

              {/* Status Pill */}
              <div className="flex items-center gap-2 shrink-0">
                <div className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold flex items-center gap-2 ${
                  isExitTriggered
                    ? 'bg-rose-950/90 border-rose-500 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.3)] animate-pulse'
                    : hasReversal
                    ? 'bg-amber-950/70 border-amber-500 text-amber-300'
                    : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                }`}>
                  {isExitTriggered ? (
                    <>
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>EXIT TRIGGERED (&lt; ${safeFixed(reversalBarClose, 2)})</span>
                    </>
                  ) : hasReversal ? (
                    <>
                      <Clock className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
                      <span>HOLDING: AWAITING BREAKDOWN (&lt; ${safeFixed(reversalBarClose, 2)})</span>
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>NO REVERSAL CROSS (HOLD LONG)</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Metric Comparison Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-slate-800/80 font-mono text-center">
              <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-2">
                <span className="text-[10px] text-slate-400 block font-sans">Reversal Cross Status</span>
                <span className={`text-xs sm:text-sm font-bold ${hasReversal ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {hasReversal ? 'Death Cross Active' : 'Tenkan ≥ Kijun (Safe)'}
                </span>
              </div>
              <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-2">
                <span className="text-[10px] text-slate-400 block font-sans">1st Reversal Bar Close</span>
                <span className="text-xs sm:text-sm font-bold text-white">
                  {hasReversal ? `$${safeFixed(reversalBarClose, 2)}` : 'N/A (No Cross)'}
                </span>
              </div>
              <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-2">
                <span className="text-[10px] text-slate-400 block font-sans">Required Exit Trigger</span>
                <span className={`text-xs sm:text-sm font-bold ${hasReversal ? 'text-rose-400' : 'text-slate-400'}`}>
                  {hasReversal ? `< $${safeFixed(exitTriggerPrice, 2)}` : 'Awaiting Cross'}
                </span>
              </div>
              <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-2">
                <span className="text-[10px] text-slate-400 block font-sans">Exit Delta / Buffer</span>
                <span className={`text-xs sm:text-sm font-bold ${
                  !hasReversal 
                    ? 'text-emerald-400' 
                    : isExitTriggered 
                    ? 'text-rose-400' 
                    : 'text-amber-400'
                }`}>
                  {!hasReversal 
                    ? `+$${safeFixed((currentSpotPrice - (bar1h?.kijun ?? currentSpotPrice)), 1)} to Kijun`
                    : isExitTriggered 
                    ? `-$${safeFixed(exitDiff, 2)} Below Bar`
                    : `+$${safeFixed(Math.abs(exitDiff ?? 0), 2)} Buffer`}
                </span>
              </div>
            </div>
          </div>
        );
      })()}

      {effectiveRegime === 'CONSOLIDATION' && (
        <div className="bg-slate-950 border border-amber-500/30 rounded-xl p-3 sm:p-4 mb-3 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg shrink-0 border bg-amber-500/10 border-amber-500/30 text-amber-400">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs sm:text-sm font-black text-white">
                  1HR Kumo Cloud Consolidation Range Boundaries
                </span>
                <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                  Gold is currently coiling inside the 1HR Ichimoku Kumo Cloud. Stand aside or wait for 1D TK Crossover.
                </p>
              </div>
            </div>
            <div className="px-3 py-1.5 rounded-lg border border-amber-500/50 bg-amber-950/60 text-amber-300 text-xs font-mono font-bold flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>STAND ASIDE (NO DIRECTIONAL EDGE)</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-slate-800/80 font-mono text-center">
            <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-2">
              <span className="text-[10px] text-slate-400 block font-sans">1HR Kumo Resistance</span>
              <span className="text-xs sm:text-sm font-bold text-rose-300">${safeFixed(bar1h?.cloudTop, 2)}</span>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-2">
              <span className="text-[10px] text-slate-400 block font-sans">1HR Kijun Equilibrium Magnet</span>
              <span className="text-xs sm:text-sm font-bold text-amber-300">${safeFixed(bar1h?.kijun, 2)}</span>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-2">
              <span className="text-[10px] text-slate-400 block font-sans">1HR Kumo Floor Support</span>
              <span className="text-xs sm:text-sm font-bold text-emerald-300">${safeFixed(bar1h?.cloudBottom, 2)}</span>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-2">
              <span className="text-[10px] text-slate-400 block font-sans">1HR Kumo Cloud Thickness</span>
              <span className="text-xs sm:text-sm font-bold text-white">
                ${safeFixed(Math.abs((bar1h?.cloudTop ?? 0) - (bar1h?.cloudBottom ?? 0)), 2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 5. FAST TK CHECKLIST CARD (Shown when Fast TK is selected) */}
      {!isDual && (
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 mb-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              1HR Pure Tenkan-Kijun Cross Trigger Checklist
            </span>
            <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
              {effectiveRegime === 'BUY'
                ? (fastTkSignal?.tkCross ? 'BULLISH TK CROSS ACTIVE' : 'AWAITING TK GOLDEN CROSS')
                : (fastTkSignal?.tkDeathCross ? 'BEARISH TK CROSS ACTIVE' : 'AWAITING TK DEATH CROSS')}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
            {effectiveRegime === 'BUY' ? (
              <>
                <div className={`flex items-center justify-between p-2 rounded-lg border ${
                  fastTkSignal?.tkCross ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200' : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}>
                  <span className="flex items-center gap-1.5">
                    {fastTkSignal?.tkCross ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                    1. 1HR Tenkan &gt;= Kijun (Golden Cross)
                  </span>
                  <span>{safeFixed(fastTkSignal?.tenkan, 2)} &gt;= {safeFixed(fastTkSignal?.kijun, 2)}</span>
                </div>
                <div className={`flex items-center justify-between p-2 rounded-lg border ${
                  (currentSpotPrice >= (fastTkSignal?.kijun ?? 0)) ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200' : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}>
                  <span className="flex items-center gap-1.5">
                    {(currentSpotPrice >= (fastTkSignal?.kijun ?? 0)) ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                    2. 1HR Price &gt;= Kijun-sen Support
                  </span>
                  <span>${safeFixed(currentSpotPrice, 2)} &gt;= ${safeFixed(fastTkSignal?.kijun, 2)}</span>
                </div>
              </>
            ) : (
              <>
                <div className={`flex items-center justify-between p-2 rounded-lg border ${
                  fastTkSignal?.tkDeathCross ? 'bg-rose-950/30 border-rose-500/30 text-rose-200' : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}>
                  <span className="flex items-center gap-1.5">
                    {fastTkSignal?.tkDeathCross ? <CheckCircle2 className="w-3.5 h-3.5 text-rose-400 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                    1. 1HR Tenkan &lt;= Kijun (Death Cross)
                  </span>
                  <span>{safeFixed(fastTkSignal?.tenkan, 2)} &lt;= {safeFixed(fastTkSignal?.kijun, 2)}</span>
                </div>
                <div className={`flex items-center justify-between p-2 rounded-lg border ${
                  (currentSpotPrice <= (fastTkSignal?.kijun ?? 0)) ? 'bg-rose-950/30 border-rose-500/30 text-rose-200' : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}>
                  <span className="flex items-center gap-1.5">
                    {(currentSpotPrice <= (fastTkSignal?.kijun ?? 0)) ? <CheckCircle2 className="w-3.5 h-3.5 text-rose-400 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                    2. 1HR Price &lt;= Kijun-sen Resistance
                  </span>
                  <span>${safeFixed(currentSpotPrice, 2)} &lt;= ${safeFixed(fastTkSignal?.kijun, 2)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 6. MOBILE TIMEFRAME SELECTOR */}
      <div className="md:hidden flex items-center justify-between bg-slate-950 rounded-lg p-1 border border-slate-800 mb-3">
        <span className="text-[10px] font-mono text-slate-500 pl-2">TIMEFRAME:</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMobilePillarView('ALL')}
            className={`px-2.5 py-1.5 rounded text-xs font-bold transition-colors touch-manipulation ${
              mobilePillarView === 'ALL' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400'
            }`}
          >
            Both (7)
          </button>
          <button
            onClick={() => setMobilePillarView('1HR')}
            className={`px-2.5 py-1.5 rounded text-xs font-bold transition-colors touch-manipulation ${
              mobilePillarView === '1HR' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400'
            }`}
          >
            {entryTf} ({effectiveRegime === 'BUY' ? rules1hBuyPassed : rules1hSellPassed}/6)
          </button>
          <button
            onClick={() => setMobilePillarView('1D')}
            className={`px-2.5 py-1.5 rounded text-xs font-bold transition-colors touch-manipulation ${
              mobilePillarView === '1D' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400'
            }`}
          >
            {trendTf} ({effectiveRegime === 'BUY' ? (dailyCrossBuy ? 1 : 0) : (dailyCrossSell ? 1 : 0)}/1)
          </button>
        </div>
      </div>

      {/* 7. DUAL CONFLUENCE MATRIX: Entry (6 Rules) vs Trend Macro (TK Crossover) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        {/* LEFT COLUMN: ENTRY TIMEFRAME (6 PURE ICHIMOKU RULES) */}
        {(mobilePillarView === 'ALL' || mobilePillarView === '1HR') && (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 sm:p-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs sm:text-sm font-black text-white">
                  {entryTf} Entry Timeframe {effectiveRegime === 'BUY' ? '(All 6 Ichimoku Rules)' : effectiveRegime === 'SELL' ? '(All 6 Bearish Rules)' : '(Range Matrix)'}
                </span>
              </div>
              <span className={`text-[11px] sm:text-xs font-mono font-bold px-2 py-0.5 rounded ${
                effectiveRegime === 'BUY'
                  ? (rules1hBuyPassed >= 6 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-300')
                  : effectiveRegime === 'SELL'
                  ? (rules1hSellPassed >= 6 ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-slate-800 text-slate-300')
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                {effectiveRegime === 'BUY'
                  ? `${rules1hBuyPassed} / 6 Rules Met`
                  : effectiveRegime === 'SELL'
                  ? `${rules1hSellPassed} / 6 Rules Met`
                  : 'Kumo Range'}
              </span>
            </div>

            {/* Entry Metric Chips */}
            <div className="grid grid-cols-3 gap-1.5 text-[10px] sm:text-[11px] font-mono mb-2.5">
              <div className="p-1 sm:p-1.5 rounded bg-slate-950/60 border border-slate-800/80 text-center">
                <span className="text-slate-500 block text-[8px] sm:text-[9px]">{entryTf} Tenkan / Kijun</span>
                <span className="text-slate-200 font-bold">${safeFixed(bar1h?.tenkan, 1)} / ${safeFixed(bar1h?.kijun, 1)}</span>
              </div>
              <div className="p-1 sm:p-1.5 rounded bg-slate-950/60 border border-slate-800/80 text-center">
                <span className="text-slate-500 block text-[8px] sm:text-[9px]">{entryTf} Kumo Cloud Bounds</span>
                <span className="text-slate-200 font-bold">${safeFixed(bar1h?.cloudBottom, 1)} - ${safeFixed(bar1h?.cloudTop, 1)}</span>
              </div>
              <div className="p-1 sm:p-1.5 rounded bg-slate-950/60 border border-slate-800/80 text-center">
                <span className="text-slate-500 block text-[8px] sm:text-[9px]">{entryTf} Chikou vs Close[-26]</span>
                <span className={`font-bold ${bar1h?.f4_chikouBullish ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {bar1h?.f4_chikouBullish ? 'UPTREND' : 'RESIST'}
                </span>
              </div>
            </div>

            {/* 1HR Checklist Items */}
            <div className="space-y-1.5 text-xs">
              {effectiveRegime === 'BUY' ? (
                <>
                  <div className={`flex items-center justify-between p-2 rounded-lg border min-h-[38px] ${
                    bar1h?.f1_tkCross ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200' : 'bg-slate-950/40 border-slate-800 text-slate-400'
                  }`}>
                    <span className="flex items-center gap-1.5">
                      {bar1h?.f1_tkCross ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                      1. Tenkan &gt;= Kijun Golden Cross
                    </span>
                    <span className="font-mono text-[10px]">{bar1h?.f1_tkCross ? 'BULLISH' : 'BEARISH'}</span>
                  </div>

                  <div className={`flex items-center justify-between p-2 rounded-lg border min-h-[38px] ${
                    bar1h?.f2_priceAboveCloud ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200' : 'bg-slate-950/40 border-slate-800 text-slate-400'
                  }`}>
                    <span className="flex items-center gap-1.5">
                      {bar1h?.f2_priceAboveCloud ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                      2. Price (Close) &gt; Cloud Top (Above Kumo)
                    </span>
                    <span className="font-mono text-[10px]">{bar1h?.f2_priceAboveCloud ? 'ABOVE KUMO' : 'INSIDE/BELOW'}</span>
                  </div>

                  <div className={`flex items-center justify-between p-2 rounded-lg border min-h-[38px] ${
                    bar1h?.f3_tkAboveCloud ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200' : 'bg-slate-950/40 border-slate-800 text-slate-400'
                  }`}>
                    <span className="flex items-center gap-1.5">
                      {bar1h?.f3_tkAboveCloud ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                      3. Tenkan &amp; Kijun Both &gt; Cloud Top
                    </span>
                    <span className="font-mono text-[10px]">{bar1h?.f3_tkAboveCloud ? 'BULLISH ZONE' : 'SUB-CLOUD'}</span>
                  </div>

                  <div className={`flex items-center justify-between p-2 rounded-lg border min-h-[38px] ${
                    bar1h?.f4_chikouBullish ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200' : 'bg-slate-950/40 border-slate-800 text-slate-400'
                  }`}>
                    <span className="flex items-center gap-1.5">
                      {bar1h?.f4_chikouBullish ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                      4. Chikou Macro Uptrend (Close &gt; Close[-26])
                    </span>
                    <span className="font-mono text-[10px]">{bar1h?.f4_chikouBullish ? 'CLEAR' : 'RESISTANCE'}</span>
                  </div>

                  <div className={`flex items-center justify-between p-2 rounded-lg border min-h-[38px] ${
                    bar1h?.f5_futureCloudGreen ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200' : 'bg-slate-950/40 border-slate-800 text-slate-400'
                  }`}>
                    <span className="flex items-center gap-1.5">
                      {bar1h?.f5_futureCloudGreen ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                      5. Future Kumo Bullish Green (Span A &gt;= B)
                    </span>
                    <span className="font-mono text-[10px]">{bar1h?.f5_futureCloudGreen ? 'GREEN' : 'RED'}</span>
                  </div>

                  <div className={`flex items-center justify-between p-2 rounded-lg border min-h-[38px] ${
                    bar1h?.f6_kumoClearance ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200' : 'bg-slate-950/40 border-slate-800 text-slate-400'
                  }`}>
                    <span className="flex items-center gap-1.5">
                      {bar1h?.f6_kumoClearance ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                      6. Clean Kumo Clearance (Low &gt;= Cloud Bottom)
                    </span>
                    <span className="font-mono text-[10px]">{bar1h?.f6_kumoClearance ? 'CLEAR' : 'CHOPPY'}</span>
                  </div>
                </>
              ) : effectiveRegime === 'SELL' ? (
                <>
                  <div className={`flex items-center justify-between p-2 rounded-lg border min-h-[38px] ${
                    bar1h?.sf1_tkDeathCross ? 'bg-rose-950/30 border-rose-500/30 text-rose-200' : 'bg-slate-950/40 border-slate-800 text-slate-400'
                  }`}>
                    <span className="flex items-center gap-1.5">
                      {bar1h?.sf1_tkDeathCross ? <CheckCircle2 className="w-3.5 h-3.5 text-rose-400 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                      1. Tenkan &lt;= Kijun Death Cross
                    </span>
                    <span className="font-mono text-[10px]">{bar1h?.sf1_tkDeathCross ? 'DEATH CROSS' : 'BULLISH'}</span>
                  </div>

                  <div className={`flex items-center justify-between p-2 rounded-lg border min-h-[38px] ${
                    bar1h?.sf2_priceBelowCloud ? 'bg-rose-950/30 border-rose-500/30 text-rose-200' : 'bg-slate-950/40 border-slate-800 text-slate-400'
                  }`}>
                    <span className="flex items-center gap-1.5">
                      {bar1h?.sf2_priceBelowCloud ? <CheckCircle2 className="w-3.5 h-3.5 text-rose-400 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                      2. Price (Close) &lt; Cloud Bottom (Below Kumo)
                    </span>
                    <span className="font-mono text-[10px]">{bar1h?.sf2_priceBelowCloud ? 'BELOW KUMO' : 'INSIDE/ABOVE'}</span>
                  </div>

                  <div className={`flex items-center justify-between p-2 rounded-lg border min-h-[38px] ${
                    bar1h?.sf3_tkBelowCloud ? 'bg-rose-950/30 border-rose-500/30 text-rose-200' : 'bg-slate-950/40 border-slate-800 text-slate-400'
                  }`}>
                    <span className="flex items-center gap-1.5">
                      {bar1h?.sf3_tkBelowCloud ? <CheckCircle2 className="w-3.5 h-3.5 text-rose-400 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                      3. Tenkan &amp; Kijun Both &lt; Cloud Bottom
                    </span>
                    <span className="font-mono text-[10px]">{bar1h?.sf3_tkBelowCloud ? 'BEARISH ZONE' : 'SUPER-CLOUD'}</span>
                  </div>

                  <div className={`flex items-center justify-between p-2 rounded-lg border min-h-[38px] ${
                    bar1h?.sf4_chikouBearish ? 'bg-rose-950/30 border-rose-500/30 text-rose-200' : 'bg-slate-950/40 border-slate-800 text-slate-400'
                  }`}>
                    <span className="flex items-center gap-1.5">
                      {bar1h?.sf4_chikouBearish ? <CheckCircle2 className="w-3.5 h-3.5 text-rose-400 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                      4. Chikou Macro Downtrend (Close &lt; Close[-26])
                    </span>
                    <span className="font-mono text-[10px]">{bar1h?.sf4_chikouBearish ? 'DOWNTREND' : 'UPTREND'}</span>
                  </div>

                  <div className={`flex items-center justify-between p-2 rounded-lg border min-h-[38px] ${
                    bar1h?.sf5_futureCloudRed ? 'bg-rose-950/30 border-rose-500/30 text-rose-200' : 'bg-slate-950/40 border-slate-800 text-slate-400'
                  }`}>
                    <span className="flex items-center gap-1.5">
                      {bar1h?.sf5_futureCloudRed ? <CheckCircle2 className="w-3.5 h-3.5 text-rose-400 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                      5. Future Kumo Bearish Red (Span A &lt; B)
                    </span>
                    <span className="font-mono text-[10px]">{bar1h?.sf5_futureCloudRed ? 'RED' : 'GREEN'}</span>
                  </div>

                  <div className={`flex items-center justify-between p-2 rounded-lg border min-h-[38px] ${
                    bar1h?.sf6_kumoClearance ? 'bg-rose-950/30 border-rose-500/30 text-rose-200' : 'bg-slate-950/40 border-slate-800 text-slate-400'
                  }`}>
                    <span className="flex items-center gap-1.5">
                      {bar1h?.sf6_kumoClearance ? <CheckCircle2 className="w-3.5 h-3.5 text-rose-400 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                      6. Clean Kumo Clearance Below (High &lt;= Cloud Top)
                    </span>
                    <span className="font-mono text-[10px]">{bar1h?.sf6_kumoClearance ? 'CLEAR' : 'CHOPPY'}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between p-2 rounded-lg border bg-amber-950/20 border-amber-500/30 text-amber-200 min-h-[38px]">
                    <span className="flex items-center gap-1.5">
                      <Cloud className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      1. Price in 1HR Kumo Chop Zone
                    </span>
                    <span className="font-mono text-[10px]">${safeFixed(bar1h?.close, 2)}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg border bg-slate-900 border-slate-800 text-slate-300 min-h-[38px]">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      2. Kumo Cloud Span
                    </span>
                    <span className="font-mono text-[10px]">${safeFixed(bar1h?.cloudBottom, 1)} - ${safeFixed(bar1h?.cloudTop, 1)}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg border bg-slate-900 border-slate-800 text-slate-300 min-h-[38px]">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      3. Tenkan / Kijun Equilibrium
                    </span>
                    <span className="font-mono text-[10px]">Δ ${safeFixed((bar1h?.tenkan ?? 0) - (bar1h?.kijun ?? 0), 2)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* RIGHT COLUMN: REFERENCE MACRO TIMEFRAME (TENKAN-KIJUN CROSSOVER REQUIREMENT) */}
        {(mobilePillarView === 'ALL' || mobilePillarView === '1D') && (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 sm:p-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
                <span className="text-xs sm:text-sm font-black text-white">
                  {trendTf} Reference Macro Timeframe {effectiveRegime === 'BUY' ? '(Tenkan-Kijun Crossover)' : effectiveRegime === 'SELL' ? '(Tenkan-Kijun Death Cross)' : '(Macro Filter)'}
                </span>
              </div>
              <span className={`text-[11px] sm:text-xs font-mono font-bold px-2 py-0.5 rounded ${
                effectiveRegime === 'BUY'
                  ? (dailyCrossBuy ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-300')
                  : effectiveRegime === 'SELL'
                  ? (dailyCrossSell ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-slate-800 text-slate-300')
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                {effectiveRegime === 'BUY'
                  ? (dailyCrossBuy ? `${trendTf} TK Cross: ACTIVE` : `${trendTf} TK Cross: PENDING`)
                  : effectiveRegime === 'SELL'
                  ? (dailyCrossSell ? `${trendTf} Death Cross: ACTIVE` : `${trendTf} Death Cross: PENDING`)
                  : `${trendTf} Trend Gate`}
              </span>
            </div>

            {/* Reference Macro Metric Chips */}
            <div className="grid grid-cols-3 gap-1.5 text-[10px] sm:text-[11px] font-mono mb-2.5">
              <div className="p-1 sm:p-1.5 rounded bg-slate-950/60 border border-slate-800/80 text-center">
                <span className="text-slate-500 block text-[8px] sm:text-[9px]">{trendTf} Tenkan / Kijun</span>
                <span className="text-slate-200 font-bold">${safeFixed(bar1d?.tenkan, 1)} / ${safeFixed(bar1d?.kijun, 1)}</span>
              </div>
              <div className="p-1 sm:p-1.5 rounded bg-slate-950/60 border border-slate-800/80 text-center">
                <span className="text-slate-500 block text-[8px] sm:text-[9px]">{trendTf} Kumo Bounds</span>
                <span className="text-slate-200 font-bold">${safeFixed(bar1d?.cloudBottom, 1)} - ${safeFixed(bar1d?.cloudTop, 1)}</span>
              </div>
              <div className="p-1 sm:p-1.5 rounded bg-slate-950/60 border border-slate-800/80 text-center">
                <span className="text-slate-500 block text-[8px] sm:text-[9px]">{trendTf} TK Spread</span>
                <span className={`font-bold ${(bar1d?.tenkan ?? 0) >= (bar1d?.kijun ?? 0) ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {(bar1d?.tenkan ?? 0) >= (bar1d?.kijun ?? 0) ? `+${safeFixed((bar1d?.tenkan ?? 0) - (bar1d?.kijun ?? 0), 1)}` : `-${safeFixed(Math.abs((bar1d?.tenkan ?? 0) - (bar1d?.kijun ?? 0)), 1)}`}
                </span>
              </div>
            </div>

            {/* 1D Macro Checklist Items */}
            <div className="space-y-1.5 text-xs">
              {effectiveRegime === 'BUY' ? (
                <>
                  <div className={`flex items-center justify-between p-2 rounded-lg border min-h-[38px] ${
                    dailyCrossBuy ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200' : 'bg-slate-950/40 border-slate-800 text-slate-400'
                  }`}>
                    <span className="flex items-center gap-1.5">
                      {dailyCrossBuy ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                      1. 1D Daily Tenkan &gt;= Kijun Golden Crossover (Primary Gate)
                    </span>
                    <span className="font-mono text-[10px]">{dailyCrossBuy ? 'CROSSOVER CONFIRMED' : 'NO CROSSOVER'}</span>
                  </div>

                  <div className={`flex items-center justify-between p-2 rounded-lg border min-h-[38px] ${
                    bar1d?.f2_priceAboveCloud ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200' : 'bg-slate-950/40 border-slate-800 text-slate-400'
                  }`}>
                    <span className="flex items-center gap-1.5">
                      {bar1d?.f2_priceAboveCloud ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                      2. 1D Price &gt; Daily Kumo Cloud Support
                    </span>
                    <span className="font-mono text-[10px]">{bar1d?.f2_priceAboveCloud ? 'MACRO BULL' : 'SUB-CLOUD'}</span>
                  </div>

                  <div className={`flex items-center justify-between p-2 rounded-lg border min-h-[38px] ${
                    bar1d?.f4_chikouBullish ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200' : 'bg-slate-950/40 border-slate-800 text-slate-400'
                  }`}>
                    <span className="flex items-center gap-1.5">
                      {bar1d?.f4_chikouBullish ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                      3. 1D Chikou Span Macro Uptrend (Clearance)
                    </span>
                    <span className="font-mono text-[10px]">{bar1d?.f4_chikouBullish ? 'CLEAR' : 'RESTRICTED'}</span>
                  </div>

                  <div className={`flex items-center justify-between p-2 rounded-lg border min-h-[38px] ${
                    bar1d?.f5_futureCloudGreen ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200' : 'bg-slate-950/40 border-slate-800 text-slate-400'
                  }`}>
                    <span className="flex items-center gap-1.5">
                      {bar1d?.f5_futureCloudGreen ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                      4. 1D Future Kumo Bullish Green (Span A &gt;= B)
                    </span>
                    <span className="font-mono text-[10px]">{bar1d?.f5_futureCloudGreen ? 'GREEN' : 'RED'}</span>
                  </div>
                </>
              ) : effectiveRegime === 'SELL' ? (
                <>
                  <div className={`flex items-center justify-between p-2 rounded-lg border min-h-[38px] ${
                    dailyCrossSell ? 'bg-rose-950/30 border-rose-500/30 text-rose-200' : 'bg-slate-950/40 border-slate-800 text-slate-400'
                  }`}>
                    <span className="flex items-center gap-1.5">
                      {dailyCrossSell ? <CheckCircle2 className="w-3.5 h-3.5 text-rose-400 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                      1. 1D Daily Tenkan &lt;= Kijun Death Crossover (Primary Gate)
                    </span>
                    <span className="font-mono text-[10px]">{dailyCrossSell ? 'DEATH CROSS CONFIRMED' : 'NO CROSSOVER'}</span>
                  </div>

                  <div className={`flex items-center justify-between p-2 rounded-lg border min-h-[38px] ${
                    bar1d?.sf2_priceBelowCloud ? 'bg-rose-950/30 border-rose-500/30 text-rose-200' : 'bg-slate-950/40 border-slate-800 text-slate-400'
                  }`}>
                    <span className="flex items-center gap-1.5">
                      {bar1d?.sf2_priceBelowCloud ? <CheckCircle2 className="w-3.5 h-3.5 text-rose-400 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                      2. 1D Price &lt; Daily Kumo Cloud Floor
                    </span>
                    <span className="font-mono text-[10px]">{bar1d?.sf2_priceBelowCloud ? 'MACRO BEAR' : 'ABOVE CLOUD'}</span>
                  </div>

                  <div className={`flex items-center justify-between p-2 rounded-lg border min-h-[38px] ${
                    bar1d?.sf4_chikouBearish ? 'bg-rose-950/30 border-rose-500/30 text-rose-200' : 'bg-slate-950/40 border-slate-800 text-slate-400'
                  }`}>
                    <span className="flex items-center gap-1.5">
                      {bar1d?.sf4_chikouBearish ? <CheckCircle2 className="w-3.5 h-3.5 text-rose-400 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                      3. 1D Chikou Span Macro Downtrend
                    </span>
                    <span className="font-mono text-[10px]">{bar1d?.sf4_chikouBearish ? 'DOWNTREND' : 'RESTRICTED'}</span>
                  </div>

                  <div className={`flex items-center justify-between p-2 rounded-lg border min-h-[38px] ${
                    bar1d?.sf5_futureCloudRed ? 'bg-rose-950/30 border-rose-500/30 text-rose-200' : 'bg-slate-950/40 border-slate-800 text-slate-400'
                  }`}>
                    <span className="flex items-center gap-1.5">
                      {bar1d?.sf5_futureCloudRed ? <CheckCircle2 className="w-3.5 h-3.5 text-rose-400 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                      4. 1D Future Kumo Bearish Red (Span A &lt; B)
                    </span>
                    <span className="font-mono text-[10px]">{bar1d?.sf5_futureCloudRed ? 'RED' : 'GREEN'}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between p-2 rounded-lg border bg-amber-950/20 border-amber-500/30 text-amber-200 min-h-[38px]">
                    <span className="flex items-center gap-1.5">
                      <Cloud className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      1. 1D Macro Cloud Coiling
                    </span>
                    <span className="font-mono text-[10px]">${safeFixed(bar1d?.close, 2)}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg border bg-slate-900 border-slate-800 text-slate-300 min-h-[38px]">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      2. 1D Tenkan vs Kijun
                    </span>
                    <span className="font-mono text-[10px]">${safeFixed(bar1d?.tenkan, 1)} / ${safeFixed(bar1d?.kijun, 1)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 8. QUICK DAYTRADE ORDER BUTTONS WITH DYNAMIC SL/TP */}
      <div className="mt-3 pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] sm:text-xs font-mono text-slate-400">
          <span>
            {effectiveRegime === 'SELL' ? 'Short Stop: ' : 'Stop Loss: '}
            <strong className="text-rose-400">
              ${safeFixed(effectiveRegime === 'SELL' ? dynamicShortStopLoss : dynamicStopLoss, 2)}
            </strong>
          </span>
          <span>•</span>
          <span>
            TP 1: <strong className="text-emerald-400">
              ${safeFixed(effectiveRegime === 'SELL' ? shortTarget1Price : target1Price, 2)}
            </strong>
          </span>
          <span>•</span>
          <span>
            TP 2: <strong className="text-emerald-400">
              ${safeFixed(effectiveRegime === 'SELL' ? shortTarget2Price : target2Price, 2)}
            </strong>
          </span>
          <span>•</span>
          {(() => {
            const gateLevel = effectiveRegime === 'SELL'
              ? (isDual ? mtfConfluence?.lastSellConfluenceBarClose : fastTkSignal?.lastSellSignalBarClose)
              : (isDual ? mtfConfluence?.lastConfluenceBarClose : fastTkSignal?.lastSignalBarClose);
            const isTriggered = effectiveRegime === 'SELL'
              ? (isDual ? mtfConfluence?.isSellEntryTriggered : fastTkSignal?.isSellEntryTriggered)
              : (isDual ? mtfConfluence?.isEntryTriggered : fastTkSignal?.isEntryTriggered);
            const op = effectiveRegime === 'SELL' ? '<' : '>';

            return (
              <span>
                Gate ({isDual ? '1D TK + 1HR' : 'Fast TK'}):{' '}
                <strong className={isTriggered ? (effectiveRegime === 'SELL' ? 'text-rose-400' : 'text-emerald-400') : 'text-amber-400'}>
                  {op} ${safeFixed(gateLevel ?? currentSpotPrice, 2)} ({isTriggered ? 'CONFIRMED' : 'WAITING'})
                </strong>
              </span>
            );
          })()}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            id="xauusd-quick-buy-btn"
            onClick={() => onQuickTrade('LONG')}
            className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-lg text-xs font-black shadow-md transition-colors flex items-center justify-center gap-1.5 touch-manipulation min-h-[42px] ${
              effectiveRegime === 'BUY'
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-400/40'
                : 'bg-emerald-900/80 hover:bg-emerald-800 text-slate-200'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Buy Gold (Long)</span>
          </button>

          <button
            id="xauusd-quick-sell-btn"
            onClick={() => onQuickTrade('SHORT')}
            className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-lg text-xs font-black shadow-md transition-colors flex items-center justify-center gap-1.5 touch-manipulation min-h-[42px] ${
              effectiveRegime === 'SELL'
                ? 'bg-rose-600 hover:bg-rose-500 text-white ring-2 ring-rose-400/40'
                : 'bg-rose-900/80 hover:bg-rose-800 text-slate-200'
            }`}
          >
            <ArrowDownRight className="w-4 h-4" />
            <span>Sell Gold (Short)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
