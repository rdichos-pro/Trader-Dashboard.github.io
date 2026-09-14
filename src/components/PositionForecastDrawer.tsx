import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  ShieldAlert, 
  Calculator, 
  Sliders, 
  Check, 
  X, 
  Maximize2, 
  Minimize2, 
  Layers, 
  HelpCircle,
  Zap,
  ArrowRight
} from 'lucide-react';
import { formatCurrency, formatPercent } from '../utils/formatters';

export interface PositionForecastConfig {
  type: 'LONG' | 'SHORT';
  entryPrice: number;
  targetPrice: number;
  stopLossPrice: number;
  accountSize?: number;
  riskPercent?: number; // e.g. 1%
}

export interface PositionForecastDrawerProps {
  symbol: string;
  currentPrice: number;
  isGold?: boolean;
  defaultStopLoss?: number;
  defaultTarget1?: number;
  defaultTarget2?: number;
  externalTrade?: {
    direction: 'LONG' | 'SHORT' | 'BUY' | 'SELL';
    entryPrice: number;
    stopLossPrice?: number;
    targetPrice?: number;
    quantity?: number;
    amount?: number;
    isRunning?: boolean;
    title?: string;
  } | null;
  onExecuteTrade?: (trade: {
    symbol: string;
    direction: 'BUY' | 'SELL';
    entryPrice: number;
    stopLossPrice: number;
    takeProfitPrice: number;
    quantity: number;
  }) => void;
  onClose?: () => void;
  isCompact?: boolean;
}

export const PositionForecastDrawer: React.FC<PositionForecastDrawerProps> = ({
  symbol,
  currentPrice,
  isGold = false,
  defaultStopLoss,
  defaultTarget1,
  defaultTarget2,
  externalTrade,
  onExecuteTrade,
  onClose,
  isCompact = false,
}) => {
  const [direction, setDirection] = useState<'LONG' | 'SHORT'>('LONG');
  const [entryPrice, setEntryPrice] = useState<number>(currentPrice || 100);
  const [stopLossPrice, setStopLossPrice] = useState<number>(
    defaultStopLoss || (currentPrice ? currentPrice * 0.98 : 98)
  );
  const [targetPrice, setTargetPrice] = useState<number>(
    defaultTarget1 || (currentPrice ? currentPrice * 1.04 : 104)
  );
  const [tradeAmount, setTradeAmount] = useState<number>(10);
  const [accountSize, setAccountSize] = useState<number>(0);
  const [riskPercent, setRiskPercent] = useState<number>(1.0); // 1% risk per trade
  const [showOnChartBox, setShowOnChartBox] = useState<boolean>(true);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  // Synchronize when an external trade is clicked/selected
  useEffect(() => {
    if (!externalTrade) return;
    const dir = (externalTrade.direction === 'SHORT' || externalTrade.direction === 'SELL') ? 'SHORT' : 'LONG';
    setDirection(dir);
    setEntryPrice(Number(externalTrade.entryPrice.toFixed(2)));
    
    if (externalTrade.stopLossPrice != null && externalTrade.stopLossPrice > 0) {
      setStopLossPrice(Number(externalTrade.stopLossPrice.toFixed(2)));
    } else {
      const defaultOffset = isGold ? 8.0 : externalTrade.entryPrice * 0.02;
      setStopLossPrice(
        Number((dir === 'LONG' ? externalTrade.entryPrice - defaultOffset : externalTrade.entryPrice + defaultOffset).toFixed(2))
      );
    }

    if (externalTrade.targetPrice != null && externalTrade.targetPrice > 0) {
      setTargetPrice(Number(externalTrade.targetPrice.toFixed(2)));
    } else {
      const defaultTargetOffset = isGold ? 16.0 : externalTrade.entryPrice * 0.04;
      setTargetPrice(
        Number((dir === 'LONG' ? externalTrade.entryPrice + defaultTargetOffset : externalTrade.entryPrice - defaultTargetOffset).toFixed(2))
      );
    }

    // Reset amount to zero for historical trades; preserve amount for running trades
    if (externalTrade.isRunning) {
      setTradeAmount(externalTrade.quantity ?? externalTrade.amount ?? 10);
    } else {
      setTradeAmount(0);
    }
  }, [externalTrade, isGold]);

  // Sync entry with currentPrice on initial mount if untouched and no external trade
  useEffect(() => {
    if (!externalTrade && currentPrice > 0 && Math.abs(entryPrice - currentPrice) / currentPrice > 0.5) {
      setEntryPrice(currentPrice);
      if (direction === 'LONG') {
        setStopLossPrice(defaultStopLoss || +(currentPrice * 0.98).toFixed(2));
        setTargetPrice(defaultTarget1 || +(currentPrice * 1.04).toFixed(2));
      } else {
        setStopLossPrice(defaultStopLoss || +(currentPrice * 1.02).toFixed(2));
        setTargetPrice(defaultTarget1 || +(currentPrice * 0.96).toFixed(2));
      }
    }
  }, [currentPrice, defaultStopLoss, defaultTarget1, direction, externalTrade]);

  // Handle switching Long / Short
  const handleSwitchDirection = (newDir: 'LONG' | 'SHORT') => {
    setDirection(newDir);
    const curr = entryPrice || currentPrice || 100;
    if (newDir === 'LONG') {
      const riskDist = isGold ? 8.0 : +(curr * 0.02).toFixed(2);
      const rewardDist = isGold ? 16.0 : +(curr * 0.04).toFixed(2);
      setStopLossPrice(+(curr - riskDist).toFixed(2));
      setTargetPrice(+(curr + rewardDist).toFixed(2));
    } else {
      const riskDist = isGold ? 8.0 : +(curr * 0.02).toFixed(2);
      const rewardDist = isGold ? 16.0 : +(curr * 0.04).toFixed(2);
      setStopLossPrice(+(curr + riskDist).toFixed(2));
      setTargetPrice(+(curr - rewardDist).toFixed(2));
    }
  };

  // Calculations
  const calculations = useMemo(() => {
    const entry = Number(entryPrice) || 1;
    const sl = Number(stopLossPrice) || 0.99 * entry;
    const tp = Number(targetPrice) || 1.02 * entry;

    let riskDist = 0;
    let rewardDist = 0;
    let riskPct = 0;
    let rewardPct = 0;

    if (direction === 'LONG') {
      riskDist = Math.max(0.001, entry - sl);
      rewardDist = Math.max(0.001, tp - entry);
      riskPct = (riskDist / entry) * 100;
      rewardPct = (rewardDist / entry) * 100;
    } else {
      riskDist = Math.max(0.001, sl - entry);
      rewardDist = Math.max(0.001, entry - tp);
      riskPct = (riskDist / entry) * 100;
      rewardPct = (rewardDist / entry) * 100;
    }

    const rrRatio = riskDist > 0 ? rewardDist / riskDist : 0;
    const riskDollarAmount = (accountSize * riskPercent) / 100;
    const formulaShares = riskDist > 0 ? +(riskDollarAmount / riskDist).toFixed(2) : 1;
    const sharesOrUnits = tradeAmount;
    const projectedProfitDollar = +(sharesOrUnits * rewardDist).toFixed(2);
    const projectedLossDollar = +(sharesOrUnits * riskDist).toFixed(2);

    return {
      entry,
      sl,
      tp,
      riskDist: +riskDist.toFixed(2),
      rewardDist: +rewardDist.toFixed(2),
      riskPct: +riskPct.toFixed(2),
      rewardPct: +rewardPct.toFixed(2),
      rrRatio: +rrRatio.toFixed(2),
      riskDollarAmount: +riskDollarAmount.toFixed(2),
      sharesOrUnits,
      formulaShares,
      projectedProfitDollar,
      projectedLossDollar,
      isFavorable: rrRatio >= 1.5,
    };
  }, [direction, entryPrice, stopLossPrice, targetPrice, accountSize, riskPercent, tradeAmount]);

  const applyRrMultiplier = (multiplier: number) => {
    const entry = Number(entryPrice) || currentPrice;
    const sl = Number(stopLossPrice);
    if (direction === 'LONG') {
      const risk = Math.max(0.1, entry - sl);
      setTargetPrice(+(entry + risk * multiplier).toFixed(2));
    } else {
      const risk = Math.max(0.1, sl - entry);
      setTargetPrice(+(entry - risk * multiplier).toFixed(2));
    }
  };

  const handleUseCurrentPrice = () => {
    if (currentPrice > 0) {
      setEntryPrice(+currentPrice.toFixed(2));
    }
  };

  const handleApplyConfluenceLevels = () => {
    if (currentPrice > 0) {
      setEntryPrice(+currentPrice.toFixed(2));
      if (defaultStopLoss) setStopLossPrice(+defaultStopLoss.toFixed(2));
      if (defaultTarget1) setTargetPrice(+defaultTarget1.toFixed(2));
    }
  };

  const handleQuickExecute = () => {
    if (onExecuteTrade) {
      onExecuteTrade({
        symbol,
        direction: direction === 'LONG' ? 'BUY' : 'SELL',
        entryPrice: calculations.entry,
        stopLossPrice: calculations.sl,
        takeProfitPrice: calculations.tp,
        quantity: tradeAmount > 0 ? tradeAmount : (calculations.formulaShares || 10),
      });
    }
  };

  return (
    <div className="bg-[#161B22] border border-slate-700/80 rounded-xl shadow-2xl p-3 sm:p-4 text-xs font-sans text-slate-200">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 gap-2">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${direction === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
            {direction === 'LONG' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm">
                {direction === 'LONG' ? 'Long Position Forecast' : 'Short Position Forecast'}
              </span>
              <span className="font-mono font-bold text-amber-400 text-xs px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30">
                {symbol}
              </span>
            </div>
            <div className="text-[10px] text-slate-400">
              TradingView Risk/Reward &amp; Target Forecast Tool
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
            title={isMinimized ? 'Expand Forecast Tool' : 'Minimize'}
          >
            {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800"
              title="Close Forecast Tool"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {!isMinimized && (
        <div className="space-y-3 pt-3">
          {/* Direction Segmented Control */}
          <div className="grid grid-cols-2 gap-1 bg-[#0B0E14] p-1 rounded-lg border border-slate-800 font-mono text-xs">
            <button
              onClick={() => handleSwitchDirection('LONG')}
              className={`py-1.5 px-3 rounded-md font-bold transition-all flex items-center justify-center gap-1.5 ${
                direction === 'LONG'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>LONG (BUY)</span>
            </button>
            <button
              onClick={() => handleSwitchDirection('SHORT')}
              className={`py-1.5 px-3 rounded-md font-bold transition-all flex items-center justify-center gap-1.5 ${
                direction === 'SHORT'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5" />
              <span>SHORT (SELL)</span>
            </button>
          </div>

          {/* Quick Setup helpers */}
          <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-400">
            <div className="flex items-center gap-1">
              <span>Quick R:R Multipliers:</span>
              {[1.5, 2.0, 2.5, 3.0].map(m => (
                <button
                  key={m}
                  onClick={() => applyRrMultiplier(m)}
                  className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-[10px] border border-slate-700"
                >
                  {m}R
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleUseCurrentPrice}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono text-[10px] border border-slate-700"
              >
                Snap to Spot (${currentPrice?.toFixed(2)})
              </button>
              {(defaultStopLoss || defaultTarget1) && (
                <button
                  onClick={handleApplyConfluenceLevels}
                  className="px-2 py-0.5 rounded bg-amber-950/80 hover:bg-amber-900/90 text-amber-300 font-mono text-[10px] border border-amber-500/40"
                >
                  Apply Strategy SL/TP
                </button>
              )}
            </div>
          </div>

          {/* Input Controls Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 font-mono">
            {/* Entry Price */}
            <div className="bg-[#0B0E14] border border-slate-800 rounded-lg p-2">
              <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                <span>Entry Price</span>
                <span className="text-slate-500">USD</span>
              </div>
              <input
                type="number"
                step="0.01"
                value={entryPrice}
                onChange={e => setEntryPrice(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-bold text-xs focus:border-cyan-400 focus:outline-none"
              />
            </div>

            {/* Target Price */}
            <div className="bg-[#0B0E14] border border-emerald-900/50 rounded-lg p-2">
              <div className="flex items-center justify-between text-[10px] text-emerald-400 mb-1">
                <span className="flex items-center gap-1">
                  <Target className="w-3 h-3" /> Target (TP)
                </span>
                <span className="font-bold">+{calculations.rewardPct}%</span>
              </div>
              <input
                type="number"
                step="0.01"
                value={targetPrice}
                onChange={e => setTargetPrice(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-900 border border-emerald-600/70 rounded px-2 py-1 text-emerald-300 font-bold text-xs focus:border-emerald-400 focus:outline-none"
              />
            </div>

            {/* Stop Loss Price */}
            <div className="bg-[#0B0E14] border border-rose-900/50 rounded-lg p-2">
              <div className="flex items-center justify-between text-[10px] text-rose-400 mb-1">
                <span className="flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3" /> Stop Loss (SL)
                </span>
                <span className="font-bold">-{calculations.riskPct}%</span>
              </div>
              <input
                type="number"
                step="0.01"
                value={stopLossPrice}
                onChange={e => setStopLossPrice(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-900 border border-rose-600/70 rounded px-2 py-1 text-rose-300 font-bold text-xs focus:border-rose-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Sizing & Account Risk Row */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-[#0B0E14] border border-slate-800/80 rounded-lg p-2.5 font-mono text-[11px]">
            <div>
              <span className="text-[10px] text-slate-500 block">Trade Amount</span>
              <div className="flex items-center gap-1 mt-0.5">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={tradeAmount}
                  onChange={e => setTradeAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-white font-bold text-xs focus:outline-none focus:border-cyan-400"
                />
                <span className="text-[10px] text-slate-400">{isGold ? 'Oz' : 'Qty'}</span>
              </div>
              {tradeAmount === 0 ? (
                <span className="text-[9px] text-amber-400 block font-sans">Reset to 0 (Historical)</span>
              ) : externalTrade?.isRunning ? (
                <span className="text-[9px] text-emerald-400 block font-sans">● Running Trade</span>
              ) : null}
            </div>

            <div>
              <span className="text-[10px] text-slate-500 block">Account Size</span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-slate-400">$</span>
                <input
                  type="number"
                  step="500"
                  value={accountSize}
                  onChange={e => setAccountSize(parseFloat(e.target.value) || 1000)}
                  className="w-20 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-white font-bold text-xs focus:outline-none"
                />
              </div>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 block">Risk Per Trade</span>
              <div className="flex items-center gap-1 mt-0.5">
                <input
                  type="number"
                  step="0.5"
                  value={riskPercent}
                  onChange={e => setRiskPercent(parseFloat(e.target.value) || 1)}
                  className="w-14 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-white font-bold text-xs focus:outline-none"
                />
                <span className="text-slate-400">%</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 block">Position Sizing</span>
              <span className="text-white font-bold text-xs block mt-0.5">
                {calculations.sharesOrUnits} {isGold ? 'Oz / Lots' : 'Shares'}
              </span>
              <span className="text-[9px] text-slate-500 block">
                (Rec: {calculations.formulaShares} oz)
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 block">Risk / Reward Ratio</span>
              <span className={`font-black text-xs block mt-0.5 ${calculations.isFavorable ? 'text-emerald-400' : 'text-amber-400'}`}>
                1 : {calculations.rrRatio} {calculations.isFavorable ? '✓ (Good)' : '⚠️ (< 1.5)'}
              </span>
            </div>
          </div>

          {/* Visual Position Box Overlay / Forecast Preview */}
          <div className="border border-slate-700 rounded-lg overflow-hidden bg-slate-950 font-mono">
            {/* Visual Risk/Reward Box Replica */}
            <div className="p-2.5 flex flex-col">
              {direction === 'LONG' ? (
                <>
                  {/* Take Profit Box (Top Green) */}
                  <div className="bg-emerald-950/70 border border-emerald-500/60 rounded-t p-2 flex items-center justify-between text-emerald-200">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <span className="font-bold">TARGET (TP): ${calculations.tp.toFixed(2)}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-emerald-400">+{calculations.rewardPct}%</span>
                      <span className="text-[10px] opacity-80 block">+${calculations.projectedProfitDollar}</span>
                    </div>
                  </div>

                  {/* Entry Line (Center) */}
                  <div className="bg-cyan-950 border-y-2 border-cyan-400 px-3 py-1 flex items-center justify-between text-cyan-200 text-xs font-black shadow">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 bg-cyan-400 rotate-45"></span>
                      <span>ENTRY PRICE: ${calculations.entry.toFixed(2)}</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-900 border border-cyan-500/50">
                      R:R 1:{calculations.rrRatio}
                    </span>
                  </div>

                  {/* Stop Loss Box (Bottom Red) */}
                  <div className="bg-rose-950/70 border border-rose-500/60 rounded-b p-2 flex items-center justify-between text-rose-200">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                      <span className="font-bold">STOP LOSS (SL): ${calculations.sl.toFixed(2)}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-rose-400">-{calculations.riskPct}%</span>
                      <span className="text-[10px] opacity-80 block">-${calculations.projectedLossDollar}</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Stop Loss Box (Top Red for Short) */}
                  <div className="bg-rose-950/70 border border-rose-500/60 rounded-t p-2 flex items-center justify-between text-rose-200">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                      <span className="font-bold">STOP LOSS (SL): ${calculations.sl.toFixed(2)}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-rose-400">-{calculations.riskPct}%</span>
                      <span className="text-[10px] opacity-80 block">-${calculations.projectedLossDollar}</span>
                    </div>
                  </div>

                  {/* Entry Line (Center) */}
                  <div className="bg-cyan-950 border-y-2 border-cyan-400 px-3 py-1 flex items-center justify-between text-cyan-200 text-xs font-black shadow">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 bg-cyan-400 rotate-45"></span>
                      <span>SHORT ENTRY: ${calculations.entry.toFixed(2)}</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-900 border border-cyan-500/50">
                      R:R 1:{calculations.rrRatio}
                    </span>
                  </div>

                  {/* Take Profit Box (Bottom Green for Short) */}
                  <div className="bg-emerald-950/70 border border-emerald-500/60 rounded-b p-2 flex items-center justify-between text-emerald-200">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <span className="font-bold">TARGET (TP): ${calculations.tp.toFixed(2)}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-emerald-400">+{calculations.rewardPct}%</span>
                      <span className="text-[10px] opacity-80 block">+${calculations.projectedProfitDollar}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Footer Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
            <div className="text-[10px] text-slate-400 flex items-center gap-1 font-sans">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
              <span>
                Tip: On the TradingView chart, enable <strong>Drawing Tools</strong> to use TradingView's native <strong>Long / Short Position</strong> interactive pencil tool.
              </span>
            </div>

            {onExecuteTrade && (
              <button
                onClick={handleQuickExecute}
                className={`px-3.5 py-1.5 rounded-lg text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow transition-colors ${
                  direction === 'LONG' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Execute {direction} in Paper Account</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
