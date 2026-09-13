import React, { useState } from 'react';
import { 
  Activity, 
  AlertOctagon, 
  AlertTriangle, 
  ArrowDownRight, 
  ArrowUpRight, 
  Check, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  Cloud, 
  Code, 
  Cpu, 
  DollarSign, 
  Flame, 
  HelpCircle, 
  Percent, 
  Play, 
  RotateCcw, 
  ShieldAlert, 
  ShieldCheck, 
  Sliders, 
  Target, 
  TrendingDown, 
  TrendingUp, 
  Zap,
  Newspaper,
  FileText,
  Sparkles
} from 'lucide-react';
import { ExitStrategyConfig, Position, TickerQuote } from '../types/trading';
import { formatCurrency, formatPercent } from '../utils/formatters';

interface ExitStrategyDashboardProps {
  config: ExitStrategyConfig;
  onUpdateConfig: (newConfig: ExitStrategyConfig) => void;
  positions: Position[];
  universe: TickerQuote[];
  onSelectTicker?: (symbol: string) => void;
  onNavigateToTab?: (tab: string) => void;
  onQuickSellPosition?: (position: Position, reason: string) => void;
}

export const ExitStrategyDashboard: React.FC<ExitStrategyDashboardProps> = ({
  config,
  onUpdateConfig,
  positions,
  universe,
  onSelectTicker,
  onNavigateToTab,
  onQuickSellPosition,
}) => {
  const [showPseudoCode, setShowPseudoCode] = useState<boolean>(false);
  const [simulatedEntryPrice, setSimulatedEntryPrice] = useState<number>(100);

  // Helper to update specific sub-keys
  const updateDynamicKumo = (updates: Partial<ExitStrategyConfig['dynamicKumoStop']>) => {
    onUpdateConfig({
      ...config,
      dynamicKumoStop: { ...(config.dynamicKumoStop || { enabled: true, nearKumoWarningPct: 1.0 }), ...updates },
    });
  };

  const updateMomentumExit = (updates: Partial<ExitStrategyConfig['momentumLossExit']>) => {
    onUpdateConfig({
      ...config,
      momentumLossExit: { ...(config.momentumLossExit || { enabled: true, cciThreshold: 50, stochThreshold: 50, requireBoth: true }), ...updates },
    });
  };

  const updateTrailing = (updates: Partial<ExitStrategyConfig['trailingStop']>) => {
    onUpdateConfig({
      ...config,
      trailingStop: { ...config.trailingStop, ...updates },
    });
  };

  const updateTakeProfit = (updates: Partial<ExitStrategyConfig['fixedTakeProfit']>) => {
    onUpdateConfig({
      ...config,
      fixedTakeProfit: { ...config.fixedTakeProfit, ...updates },
    });
  };

  const updateNewsReversalShield = (updates: Partial<NonNullable<ExitStrategyConfig['newsReversalShield']>>) => {
    onUpdateConfig({
      ...config,
      newsReversalShield: {
        ...(config.newsReversalShield || {
          enabled: true,
          minConfidence: 'MEDIUM',
          graceBufferPct: 1.5,
          autoSuppressHardSell: true,
        }),
        ...updates,
      },
    });
  };

  const dynamicKumo = config.dynamicKumoStop || { enabled: true, nearKumoWarningPct: 1.0 };
  const momentumExit = config.momentumLossExit || { enabled: true, cciThreshold: 50, stochThreshold: 50, requireBoth: true };
  const newsShield = config.newsReversalShield || {
    enabled: true,
    minConfidence: 'MEDIUM',
    graceBufferPct: 1.5,
    autoSuppressHardSell: true,
  };

  // Preset Handlers
  const trailingPresets = [1.5, 2, 3, 5];
  const activationPresets = [1, 2, 3, 5];
  const takeProfitPresets = [5, 8, 10, 15, 20];
  const graceBufferPresets = [1.0, 1.5, 2.0, 3.0];

  // Simulation Calculations based on simulatedEntryPrice
  const simTakeProfitPrice = simulatedEntryPrice * (1 + config.fixedTakeProfit.takeProfitPct / 100);
  const simActivationPrice = simulatedEntryPrice * (1 + config.trailingStop.activationThresholdPct / 100);
  const simSimulatedPeak = simulatedEntryPrice * 1.06; // Assume a +6% peak
  const simTrailingStopPrice = simSimulatedPeak * (1 - config.trailingStop.trailingPct / 100);

  const activeRulesCount = [
    dynamicKumo.enabled,
    momentumExit.enabled,
    config.trailingStop.enabled,
    config.fixedTakeProfit.enabled,
    newsShield.enabled,
  ].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="bg-[#161B22] p-4 rounded-lg border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
        <div>
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            <h2 className="text-base font-bold text-slate-100">Strict Bearish Exit & Risk Engine</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-950 text-rose-300 border border-rose-800">
              Strict 5-Point AND Reversal
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Pure trend-riding exit strategy: Positions exit ONLY on fully confirmed 4H bearish reversals (Tenkan &lt; Cloud Bottom, Kijun &lt; Cloud Bottom, Bearish TK Cross, Stoch &lt; 50, CCI &lt; 50, Close outside Cloud).
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <span className="px-2.5 py-1 rounded-md bg-emerald-950/80 border border-emerald-800 text-emerald-300 font-mono text-xs font-semibold">
            {activeRulesCount} of 4 Modules Active
          </span>
          <button
            onClick={() => setShowPseudoCode(!showPseudoCode)}
            className="px-3 py-1 bg-[#0B0E14] hover:bg-slate-800 text-slate-300 rounded-md border border-slate-700 text-xs font-mono flex items-center gap-1.5 transition-colors"
          >
            <Code className="w-3.5 h-3.5 text-amber-400" />
            {showPseudoCode ? 'Hide Evaluation Logic' : 'View Master Exit Logic'}
            {showPseudoCode ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Pseudo-code Accordion */}
      {showPseudoCode && (
        <div className="bg-[#0B0E14] border border-slate-800 rounded-lg p-4 font-mono text-xs text-slate-300 space-y-2 shadow-inner">
          <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-2 mb-2">
            <span className="font-bold text-amber-400 flex items-center gap-1.5">
              <Cpu className="w-4 h-4" /> 4H Closed-Candle Strict Exit Logic (All 5 AND Required)
            </span>
            <span className="text-[11px] text-slate-500">Evaluates on closed candle [length - 2] to eliminate repainting</span>
          </div>
          <pre className="text-[11px] leading-relaxed text-emerald-300 overflow-x-auto p-2.5 bg-[#161B22]/50 rounded border border-slate-800/80">
{`// Master 4H Bearish Exit Logic (Strict 5-Point Confluence AND):
const closedCandle = candles[candles.length - 2];
const cloudBottom = Math.min(closedCandle.senkouA, closedCandle.senkouB);

const isStrictBearishExit = 
  closedCandle.tenkan < cloudBottom &&    // 1. Price action broke below cloud
  closedCandle.kijun < cloudBottom &&     // 2. Baseline broke below cloud
  closedCandle.tenkan < closedCandle.kijun && // 3. Bearish TK Cross active
  closedCandle.stochK < 50 &&             // 4. Bearish cycle regime
  closedCandle.cci40 < 50 &&              // 5. Bearish momentum breakdown
  closedCandle.close < cloudBottom;       // 6. No-Chop: Close definitively below cloud

if (isStrictBearishExit) {
  triggerExit({ action: 'MARKET_SELL', reason: 'Confirmed 4H Bearish Reversal Confluence' });
}

// Protective Floors & Trailing Profit Ratchets:
if (currentPrice <= cloudBottom) {
  triggerExit({ action: 'MARKET_SELL', reason: 'Dynamic Kumo Stop Floor Breached' });
}
if (trailingActivated && currentPrice <= activeTrailingStopPrice) {
  triggerExit({ action: 'TRAILING_SELL', reason: 'Trailing Stop Hit' });
}
if (currentPrice >= takeProfitPrice) {
  triggerExit({ action: 'LIMIT_SELL', reason: 'Target Reached' });
}`}
          </pre>
        </div>
      )}

      {/* Grid of 4 Exit Strategy Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* CARD 1: Strict 5-Point Bearish Reversal Confluence */}
        <div className={`bg-[#161B22] rounded-lg border p-4 transition-all ${
          momentumExit.enabled ? 'border-rose-900/60 shadow-lg shadow-rose-950/20' : 'border-slate-800/60 opacity-60'
        }`}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded font-mono bg-rose-950 text-rose-300 border border-rose-800">
                  PRIMARY RULE: STRICT 5-POINT AND
                </span>
                <span className="text-xs font-mono text-rose-400 font-semibold">BEARISH REVERSAL</span>
              </div>
              <h3 className="font-bold text-sm text-slate-100 mt-1 flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4 text-rose-400" />
                Confirmed Bearish Reversal Exit
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 leading-normal">
                Pure trend-riding: Only exits when <strong>ALL 5</strong> bearish conditions trigger on the completed 4H bar: Tenkan &lt; Cloud Bottom, Kijun &lt; Cloud Bottom, Tenkan &lt; Kijun, Stoch &lt; 50, CCI &lt; 50, and Close &lt; Cloud Bottom.
              </p>
            </div>

            <button
              id="toggle-momentum-loss-exit"
              onClick={() => updateMomentumExit({ enabled: !momentumExit.enabled })}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                momentumExit.enabled ? 'bg-rose-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  momentumExit.enabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {momentumExit.enabled && (
            <div className="space-y-3 pt-3 border-t border-slate-800/80">
              <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">CCI Cutoff (CCI &lt; X)</label>
                  <input
                    type="number"
                    value={momentumExit.cciThreshold || 50}
                    onChange={e => updateMomentumExit({ cciThreshold: Number(e.target.value) })}
                    className="w-full bg-[#0B0E14] border border-slate-800 rounded p-1.5 text-amber-400 font-bold"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Stoch Cutoff (%K &lt; X)</label>
                  <input
                    type="number"
                    value={momentumExit.stochThreshold || 50}
                    onChange={e => updateMomentumExit({ stochThreshold: Number(e.target.value) })}
                    className="w-full bg-[#0B0E14] border border-slate-800 rounded p-1.5 text-cyan-400 font-bold"
                  />
                </div>
              </div>

              <div className="bg-[#0B0E14] p-2.5 rounded border border-slate-800/80 text-xs font-mono text-slate-300">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-400">Exit Mode:</span>
                  <span className="text-rose-400 font-bold">Strict AND (All 5 Conditions Required)</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Prevents premature shakeouts during bull market pullbacks. Exits only on true structural trend reversals.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* CARD 2: Dynamic Kumo Stop Loss Floor */}
        <div className={`bg-[#161B22] rounded-lg border p-4 transition-all ${
          dynamicKumo.enabled ? 'border-amber-900/60 shadow-lg shadow-amber-950/20' : 'border-slate-800/60 opacity-60'
        }`}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded font-mono bg-amber-950 text-amber-300 border border-amber-800">
                  HARD FLOOR DEFENSE
                </span>
                <span className="text-xs font-mono text-amber-400 font-semibold">ICHIMOKU FLOOR</span>
              </div>
              <h3 className="font-bold text-sm text-slate-100 mt-1 flex items-center gap-1.5">
                <Cloud className="w-4 h-4 text-amber-400" />
                Dynamic Kumo Stop Loss Floor
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 leading-normal">
                Dynamically anchors the emergency stop price to the Ichimoku Cloud Bottom (<strong>Math.min(Senkou A, Senkou B)</strong>).
              </p>
            </div>

            <button
              id="toggle-dynamic-kumo-stop"
              onClick={() => updateDynamicKumo({ enabled: !dynamicKumo.enabled })}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                dynamicKumo.enabled ? 'bg-amber-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  dynamicKumo.enabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {dynamicKumo.enabled && (
            <div className="space-y-3 pt-3 border-t border-slate-800/80">
              <div>
                <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5 font-mono">
                  <span>Floor Proximity Warning:</span>
                  <span className="font-bold text-amber-400 text-sm">
                    Within {dynamicKumo.nearKumoWarningPct || 1.0}% of Cloud Bottom
                  </span>
                </div>
                
                <input
                  type="range"
                  min="0.5"
                  max="3.0"
                  step="0.1"
                  value={dynamicKumo.nearKumoWarningPct || 1.0}
                  onChange={e => updateDynamicKumo({ nearKumoWarningPct: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              <div className="bg-[#0B0E14] p-2.5 rounded border border-slate-800/80 text-xs font-mono text-slate-300 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Stop Price Floor:</span>
                  <span className="text-amber-400 font-bold">Cloud Bottom (Senkou Span Floor)</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                  <span>Proximity Alert:</span>
                  <span className="text-amber-300">Flags warning when price is &le; 1.0% above floor</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* CARD 3: Trailing Stop */}
        <div className={`bg-[#161B22] rounded-lg border p-4 transition-all ${
          config.trailingStop.enabled ? 'border-cyan-900/60 shadow-lg shadow-cyan-950/20' : 'border-slate-800/60 opacity-60'
        }`}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded font-mono bg-cyan-950 text-cyan-300 border border-cyan-800">
                  PROFIT RATCHET
                </span>
                <span className="text-xs font-mono text-cyan-400 font-semibold">DYNAMIC TRAIL</span>
              </div>
              <h3 className="font-bold text-sm text-slate-100 mt-1 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                Dynamic Trailing Stop
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 leading-normal">
                Activates once position gains <strong>+{config.trailingStop.activationThresholdPct}%</strong>. If price pulls back <strong>{config.trailingStop.trailingPct}%</strong> from peak, trigger exit.
              </p>
            </div>

            <button
              id="toggle-trailing-stop"
              onClick={() => updateTrailing({ enabled: !config.trailingStop.enabled })}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                config.trailingStop.enabled ? 'bg-cyan-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  config.trailingStop.enabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {config.trailingStop.enabled && (
            <div className="space-y-3 pt-3 border-t border-slate-800/80">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-300 mb-1 font-mono">
                    <span>Trailing %:</span>
                    <span className="font-bold text-cyan-400">{config.trailingStop.trailingPct}%</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="0.5"
                    value={config.trailingStop.trailingPct}
                    onChange={e => updateTrailing({ trailingPct: parseFloat(e.target.value) })}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs text-slate-300 mb-1 font-mono">
                    <span>Activation Gain:</span>
                    <span className="font-bold text-emerald-400">+{config.trailingStop.activationThresholdPct}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="10"
                    step="0.5"
                    value={config.trailingStop.activationThresholdPct}
                    onChange={e => updateTrailing({ activationThresholdPct: parseFloat(e.target.value) })}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>
              </div>

              <div className="bg-[#0B0E14] p-2.5 rounded border border-slate-800/80 text-xs font-mono text-slate-300">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-[11px]">Activation Level ($100 stock):</span>
                  <span className="text-emerald-400 font-bold">{formatCurrency(simActivationPrice)} (+{config.trailingStop.activationThresholdPct}%)</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* CARD 4: Fixed Take Profit */}
        <div className={`bg-[#161B22] rounded-lg border p-4 transition-all ${
          config.fixedTakeProfit.enabled ? 'border-emerald-900/60 shadow-lg shadow-emerald-950/20' : 'border-slate-800/60 opacity-60'
        }`}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded font-mono bg-emerald-950 text-emerald-300 border border-emerald-800">
                  TARGET LIMIT
                </span>
                <span className="text-xs font-mono text-emerald-400 font-semibold">LIMIT SELL</span>
              </div>
              <h3 className="font-bold text-sm text-slate-100 mt-1 flex items-center gap-1.5">
                <Target className="w-4 h-4 text-emerald-400" />
                Take Profit Target
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 leading-normal">
                If price reaches <strong>+{config.fixedTakeProfit.takeProfitPct}%</strong> above entry, execute a Target Limit SELL order.
              </p>
            </div>

            <button
              id="toggle-fixed-take-profit"
              onClick={() => updateTakeProfit({ enabled: !config.fixedTakeProfit.enabled })}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                config.fixedTakeProfit.enabled ? 'bg-emerald-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  config.fixedTakeProfit.enabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {config.fixedTakeProfit.enabled && (
            <div className="space-y-3 pt-3 border-t border-slate-800/80">
              <div>
                <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5 font-mono">
                  <span>Take Profit Target (% above Entry):</span>
                  <span className="font-bold text-emerald-400 text-sm">
                    +{config.fixedTakeProfit.takeProfitPct.toFixed(1)}%
                  </span>
                </div>

                <input
                  type="range"
                  min="2"
                  max="50"
                  step="1"
                  value={config.fixedTakeProfit.takeProfitPct}
                  onChange={e => updateTakeProfit({ takeProfitPct: parseFloat(e.target.value) })}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />

                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-[11px] text-slate-500 font-mono mr-1">Presets:</span>
                  {takeProfitPresets.map(preset => (
                    <button
                      key={preset}
                      onClick={() => updateTakeProfit({ takeProfitPct: preset })}
                      className={`px-2 py-0.5 rounded text-xs font-mono transition-colors ${
                        config.fixedTakeProfit.takeProfitPct === preset
                          ? 'bg-emerald-600 text-white font-bold'
                          : 'bg-[#0B0E14] text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      +{preset}%
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-[#0B0E14] p-2.5 rounded border border-slate-800/80 text-xs font-mono text-slate-300 flex items-center justify-between">
                <div>
                  <span className="text-slate-500 text-[10px]">Target Price ($100 stock):</span>
                  <div className="text-emerald-400 font-bold text-sm">
                    {formatCurrency(simTakeProfitPrice)}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 text-[10px]">Status:</span>
                  <div className="text-white font-bold text-xs">
                    Target Limit Active
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* CARD 5: News & Financial Records Reversal Shield */}
        <div className={`bg-[#161B22] rounded-lg border p-4 transition-all ${
          newsShield.enabled ? 'border-indigo-900/60 shadow-lg shadow-indigo-950/20' : 'border-slate-800/60 opacity-60'
        }`}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded font-mono bg-indigo-950 text-indigo-300 border border-indigo-800 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" /> FUNDAMENTAL DIVERGENCE
                </span>
                <span className="text-xs font-mono text-indigo-400 font-semibold">ANTI-SHAKEOUT SHIELD</span>
              </div>
              <h3 className="font-bold text-sm text-slate-100 mt-1 flex items-center gap-1.5">
                <Newspaper className="w-4 h-4 text-indigo-400" />
                News &amp; Financial Records Reversal Shield
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 leading-normal">
                If technical signals trigger a <strong>SELL</strong>, but recent news &amp; financial reports show high-impact bullish catalysts (earnings beat, FDA approval, buybacks), the shield suppresses the panic stop-out and extends a grace buffer for an anticipated reversal bounce.
              </p>
            </div>

            <button
              id="toggle-news-reversal-shield"
              onClick={() => updateNewsReversalShield({ enabled: !newsShield.enabled })}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                newsShield.enabled ? 'bg-indigo-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  newsShield.enabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {newsShield.enabled && (
            <div className="space-y-3 pt-3 border-t border-slate-800/80">
              <div>
                <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5 font-mono">
                  <span>News Grace Stop Buffer:</span>
                  <span className="font-bold text-indigo-400 text-sm">
                    {newsShield.graceBufferPct ?? 1.5}% below Cloud Floor
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {graceBufferPresets.map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => updateNewsReversalShield({ graceBufferPct: preset })}
                      className={`py-1 text-xs font-mono rounded font-semibold transition-all ${
                        (newsShield.graceBufferPct ?? 1.5) === preset
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-[#0B0E14] text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      {preset}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Confidence requirement & Auto-Suppress */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="bg-[#0B0E14] p-2 rounded border border-slate-800">
                  <div className="text-[10px] text-slate-500 mb-1">Catalyst Confidence:</div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => updateNewsReversalShield({ minConfidence: 'MEDIUM' })}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        (newsShield.minConfidence ?? 'MEDIUM') === 'MEDIUM'
                          ? 'bg-indigo-900/80 text-indigo-200 border border-indigo-700'
                          : 'text-slate-400'
                      }`}
                    >
                      MED+
                    </button>
                    <button
                      type="button"
                      onClick={() => updateNewsReversalShield({ minConfidence: 'HIGH' })}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        newsShield.minConfidence === 'HIGH'
                          ? 'bg-indigo-900/80 text-indigo-200 border border-indigo-700'
                          : 'text-slate-400'
                      }`}
                    >
                      HIGH ONLY
                    </button>
                  </div>
                </div>

                <div className="bg-[#0B0E14] p-2 rounded border border-slate-800">
                  <div className="text-[10px] text-slate-500 mb-1">Auto-Suppress Hard Sell:</div>
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                    <input
                      type="checkbox"
                      checked={newsShield.autoSuppressHardSell !== false}
                      onChange={e => updateNewsReversalShield({ autoSuppressHardSell: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-[11px]">Hold &amp; Buffer</span>
                  </label>
                </div>
              </div>

              <div className="bg-[#0B0E14] p-2.5 rounded border border-slate-800/80 text-xs font-mono text-slate-300 flex items-center justify-between">
                <div>
                  <span className="text-slate-500 text-[10px]">Shield Stop Floor ($100 stock):</span>
                  <div className="text-indigo-400 font-bold text-sm">
                    {formatCurrency(simulatedEntryPrice * (1 - (newsShield.graceBufferPct ?? 1.5) / 100))}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 text-[10px]">Protection:</span>
                  <div className="text-emerald-400 font-bold text-xs flex items-center gap-1 justify-end">
                    <ShieldCheck className="w-3.5 h-3.5" /> Reversal Active
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Live Positions Risk Monitor Table */}
      <div className="bg-[#161B22] rounded-lg border border-slate-800 overflow-hidden shadow-lg mt-6">
        <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h3 className="font-bold text-sm text-slate-100">Live Positions Exit & Stop Status ({positions.length})</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Evaluating {positions.length} open trades with Dynamic Kumo & Strict Reversal rules
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#0B0E14]/70 border-b border-slate-800 text-slate-400 font-semibold uppercase">
              <tr>
                <th className="py-2.5 px-3">Ticker</th>
                <th className="py-2.5 px-3 text-right">Entry / Current</th>
                <th className="py-2.5 px-3 text-right">Unrealized P&L</th>
                <th className="py-2.5 px-3">Dynamic Kumo Stop Floor</th>
                <th className="py-2.5 px-3">Distance to Kumo</th>
                <th className="py-2.5 px-3">Target (+{config.fixedTakeProfit.takeProfitPct}%)</th>
                <th className="py-2.5 px-3">Active Exit Warnings</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {positions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 font-sans">
                    No active positions to monitor. Log positions to see real-time distance-to-exit metrics.
                  </td>
                </tr>
              ) : (
                positions.map(pos => {
                  const isPositive = pos.unrealizedPnlDollars >= 0;
                  const kumoStop = pos.kumoStopPrice ?? pos.stopLossPrice;
                  const distanceToKumo = pos.distanceToKumoPct ?? ((pos.currentPrice - kumoStop) / pos.currentPrice * 100);
                  const isNearKumo = pos.isNearKumoStop || distanceToKumo <= (dynamicKumo.nearKumoWarningPct || 1.0);
                  const takeProfitPrice = pos.takeProfitPrice;

                  return (
                    <tr key={pos.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-bold text-white font-mono flex items-center gap-1.5">
                          {pos.ticker}
                          <span className="text-[9px] px-1 py-0.2 rounded font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                            {pos.type}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-right font-mono">
                        <div className="text-slate-200 font-bold">{formatCurrency(pos.entryPrice)}</div>
                        <div className="text-slate-400 text-[11px]">Curr: {formatCurrency(pos.currentPrice)}</div>
                      </td>

                      <td className="py-3 px-3 text-right font-mono">
                        <div className={`font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isPositive ? '+' : ''}{formatCurrency(pos.unrealizedPnlDollars)}
                        </div>
                        <div className={`text-[11px] ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {formatPercent(pos.unrealizedPnlPercent)}
                        </div>
                      </td>

                      {/* Dynamic Kumo Stop Floor */}
                      <td className="py-3 px-3 font-mono">
                        <div className="flex items-center gap-1.5">
                          <Cloud className="w-3.5 h-3.5 text-rose-400" />
                          <span className="font-bold text-slate-100">{formatCurrency(kumoStop)}</span>
                        </div>
                        <span className="text-[10px] text-slate-400">Cloud Bottom Floor</span>
                      </td>

                      {/* Distance to Kumo */}
                      <td className="py-3 px-3 font-mono">
                        <div className={`font-bold ${isNearKumo ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {distanceToKumo > 0 ? `+${distanceToKumo.toFixed(2)}%` : `${distanceToKumo.toFixed(2)}%`}
                        </div>
                        {isNearKumo && (
                          <span className="text-[10px] text-rose-400 font-sans font-semibold">
                            ⚠️ Floor in reach (&le;1%)
                          </span>
                        )}
                      </td>

                      {/* Target */}
                      <td className="py-3 px-3 font-mono">
                        <div className="font-bold text-emerald-400">{formatCurrency(takeProfitPrice)}</div>
                        <span className="text-[10px] text-slate-500">Target</span>
                      </td>

                      {/* Warnings & News Shield Status */}
                      <td className="py-3 px-3">
                        {pos.exitFlags.length === 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-900">
                            <CheckCircle2 className="w-3 h-3" /> Safe
                          </span>
                        ) : (
                          <div className="space-y-1">
                            {pos.exitFlags.map(flag => {
                              const isNewsShield = flag.type === 'NEWS_REVERSAL_SHIELD';
                              return (
                                <div
                                  key={flag.id}
                                  className={`px-2 py-1 rounded text-[11px] border flex flex-col gap-0.5 ${
                                    isNewsShield
                                      ? 'bg-indigo-950/80 border-indigo-700 text-indigo-200'
                                      : 'bg-rose-950/80 border-rose-800 text-rose-300'
                                  }`}
                                >
                                  <div className="flex items-center gap-1 font-semibold">
                                    {isNewsShield ? (
                                      <Sparkles className="w-3 h-3 text-indigo-400" />
                                    ) : (
                                      <AlertTriangle className="w-3 h-3 text-rose-400" />
                                    )}
                                    <span>{flag.title || flag.message}</span>
                                  </div>
                                  {isNewsShield && flag.newsReversalDetails && (
                                    <div className="text-[10px] text-indigo-300/80 pl-4">
                                      Catalyst: "{flag.newsReversalDetails.headline}" ({flag.newsReversalDetails.reversalProbabilityScore}% bounce prob)
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>

                      {/* Quick Sell */}
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => onQuickSellPosition && onQuickSellPosition(pos, 'Manual Quick Exit')}
                          className="px-2.5 py-1 bg-rose-600/80 hover:bg-rose-600 text-white rounded text-xs font-semibold transition-colors shadow-sm"
                        >
                          Exit Now
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
