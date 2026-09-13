import React, { useEffect, useState } from 'react';
import { 
  AlertTriangle, 
  Check, 
  DollarSign, 
  HelpCircle, 
  Loader2, 
  Percent, 
  Plus, 
  RefreshCw, 
  ShieldCheck, 
  Sliders, 
  Sparkles, 
  Target, 
  X 
} from 'lucide-react';
import { Position, StopLossType, TickerQuote } from '../types/trading';
import { formatCurrency, formatPercent } from '../utils/formatters';
import { marketDataService } from '../services/marketDataService';

interface NewPositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSavePosition: (position: Omit<Position, 'id' | 'unrealizedPnlDollars' | 'unrealizedPnlPercent' | 'exitFlags'>) => void;
  initialTicker?: string;
  initialPrice?: number;
  universe: TickerQuote[];
}

export const NewPositionModal: React.FC<NewPositionModalProps> = ({
  isOpen,
  onClose,
  onSavePosition,
  initialTicker = 'NVDA',
  initialPrice = 128.50,
  universe,
}) => {
  const [ticker, setTicker] = useState(initialTicker);
  const [type, setType] = useState<'LONG' | 'SHORT'>('LONG');
  const [entryPrice, setEntryPrice] = useState<number>(initialPrice);
  const [quantity, setQuantity] = useState<number>(100);
  const [entryDate, setEntryDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Live Market Quote state
  const [liveQuote, setLiveQuote] = useState<TickerQuote | null>(null);
  const [isFetchingQuote, setIsFetchingQuote] = useState(false);

  // Stop Loss
  const [stopLossType, setStopLossType] = useState<StopLossType>('FIXED');
  const [stopLossPct, setStopLossPct] = useState<number>(5.0); // 5% default
  const [customStopPrice, setCustomStopPrice] = useState<number>(
    Number((initialPrice * (1 - 0.05)).toFixed(2))
  );

  // Take Profit
  const [takeProfitPct, setTakeProfitPct] = useState<number>(10.0); // 10% default
  const [customTakeProfitPrice, setCustomTakeProfitPrice] = useState<number>(
    Number((initialPrice * (1 + 0.10)).toFixed(2))
  );

  // Technical Exit Rules
  const [flagBelowEMA20, setFlagBelowEMA20] = useState<boolean>(true);
  const [flagBelowSMA50, setFlagBelowSMA50] = useState<boolean>(true);
  const [flagRsiOverboughtReversal, setFlagRsiOverboughtReversal] = useState<boolean>(false);

  // Time-based exit
  const [maxHoldDays, setMaxHoldDays] = useState<number>(15);

  const [notes, setNotes] = useState<string>('');

  // Resync the form to the requested ticker/price every time the modal is opened.
  // This component stays mounted for the app's lifetime (see App.tsx), so the
  // useState(initialTicker) / useState(initialPrice) above only ever apply on the
  // very first mount. Without this effect, every subsequent "Trade" click would
  // keep showing whichever ticker happened to be set first (NVDA, from App's
  // initial default), regardless of which stock's button was actually clicked.
  useEffect(() => {
    if (!isOpen) return;
    const sym = (initialTicker || 'NVDA').toUpperCase().trim();
    setTicker(sym);
    setType('LONG');
    setEntryPrice(initialPrice);
    setQuantity(100);
    setEntryDate(new Date().toISOString().split('T')[0]);
    setStopLossPct(5.0);
    setCustomStopPrice(Number((initialPrice * (1 - 0.05)).toFixed(2)));
    setTakeProfitPct(10.0);
    setCustomTakeProfitPrice(Number((initialPrice * (1 + 0.10)).toFixed(2)));
    setNotes('');
    setLiveQuote(null);
    // Only re-run when the modal opens or a new ticker/price is requested —
    // not on every keystroke while the user is editing the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialTicker, initialPrice]);

  // Fetch live price whenever modal opens or ticker changes
  useEffect(() => {
    if (!isOpen) return;

    const sym = (ticker || initialTicker || 'NVDA').toUpperCase().trim();
    if (!sym) return;

    let isMounted = true;
    setIsFetchingQuote(true);

    // First check universe cache for instant response
    const cached = universe.find(u => u.symbol.toUpperCase() === sym);
    if (cached) {
      setLiveQuote(cached);
    }

    // Always fetch live market data from service / backend API
    marketDataService.getQuote(sym)
      .then(q => {
        if (!isMounted) return;
        setLiveQuote(q);
        // If entry price wasn't manually customized or was default, auto-populate live price
        if (q.price > 0 && (entryPrice === initialPrice || entryPrice === 100)) {
          setEntryPrice(q.price);
          setCustomStopPrice(Number((q.price * (1 - stopLossPct / 100)).toFixed(2)));
          setCustomTakeProfitPrice(Number((q.price * (1 + takeProfitPct / 100)).toFixed(2)));
        }
      })
      .catch(err => console.warn('Live quote fetch failed:', err))
      .finally(() => {
        if (isMounted) setIsFetchingQuote(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, ticker]);

  if (!isOpen) return null;

  const handleTickerChange = (newSym: string) => {
    const sym = newSym.toUpperCase().trim();
    setTicker(sym);
    if (!sym) return;

    const found = universe.find(u => u.symbol === sym);
    if (found) {
      setLiveQuote(found);
      setEntryPrice(found.price);
      setCustomStopPrice(Number((found.price * (1 - stopLossPct / 100)).toFixed(2)));
      setCustomTakeProfitPrice(Number((found.price * (1 + takeProfitPct / 100)).toFixed(2)));
    }
  };

  const handleApplyLivePrice = () => {
    if (!liveQuote || liveQuote.price <= 0) return;
    handleEntryPriceChange(liveQuote.price);
  };

  const handleEntryPriceChange = (price: number) => {
    setEntryPrice(price);
    if (type === 'LONG') {
      setCustomStopPrice(Number((price * (1 - stopLossPct / 100)).toFixed(2)));
      setCustomTakeProfitPrice(Number((price * (1 + takeProfitPct / 100)).toFixed(2)));
    } else {
      setCustomStopPrice(Number((price * (1 + stopLossPct / 100)).toFixed(2)));
      setCustomTakeProfitPrice(Number((price * (1 - takeProfitPct / 100)).toFixed(2)));
    }
  };

  const handleStopPctChange = (pct: number) => {
    setStopLossPct(pct);
    if (type === 'LONG') {
      setCustomStopPrice(Number((entryPrice * (1 - pct / 100)).toFixed(2)));
    } else {
      setCustomStopPrice(Number((entryPrice * (1 + pct / 100)).toFixed(2)));
    }
  };

  const handleTakeProfitPctChange = (pct: number) => {
    setTakeProfitPct(pct);
    if (type === 'LONG') {
      setCustomTakeProfitPrice(Number((entryPrice * (1 + pct / 100)).toFixed(2)));
    } else {
      setCustomTakeProfitPrice(Number((entryPrice * (1 - pct / 100)).toFixed(2)));
    }
  };

  const totalCost = entryPrice * quantity;
  const maxRiskDollars = Math.abs(entryPrice - customStopPrice) * quantity;
  const potentialRewardDollars = Math.abs(customTakeProfitPrice - entryPrice) * quantity;
  const riskRewardRatio = maxRiskDollars > 0 ? (potentialRewardDollars / maxRiskDollars).toFixed(2) : 'N/A';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker.trim() || entryPrice <= 0 || quantity <= 0) return;

    onSavePosition({
      ticker: ticker.toUpperCase().trim(),
      type,
      entryPrice,
      currentPrice: liveQuote?.price || entryPrice,
      quantity,
      entryDate,
      stopLossType,
      stopLossPrice: customStopPrice,
      stopLossPct,
      takeProfitPrice: customTakeProfitPrice,
      takeProfitPct,
      technicalExitRules: {
        flagBelowEMA20,
        flagBelowSMA50,
        flagRsiOverboughtReversal,
      },
      maxHoldDays: maxHoldDays > 0 ? maxHoldDays : undefined,
      notes,
      status: 'OPEN',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#161B22] border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Log Position & Exit Rules</h3>
              <p className="text-xs text-slate-400">Track entry price, live market quotes, risk parameters, and automatic exit flags.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Live Market Price Status Banner */}
          {liveQuote && (
            <div className="bg-[#0B0E14] p-3 rounded-lg border border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <div>
                  <div className="font-mono font-bold text-white flex items-center gap-2">
                    <span>{liveQuote.symbol}</span>
                    <span className="text-slate-400 text-xs font-normal font-sans">({liveQuote.name})</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
                    <span>Live Price: <strong className="text-white">{formatCurrency(liveQuote.price)}</strong></span>
                    <span className={liveQuote.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {liveQuote.change >= 0 ? '+' : ''}{formatCurrency(liveQuote.change)} ({formatPercent(liveQuote.changePercent)})
                    </span>
                  </div>
                </div>
              </div>

              {entryPrice !== liveQuote.price && (
                <button
                  type="button"
                  onClick={handleApplyLivePrice}
                  className="px-2.5 py-1 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700 text-emerald-300 rounded font-semibold text-[11px] flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  Use Live Price ({formatCurrency(liveQuote.price)})
                </button>
              )}
            </div>
          )}

          {/* Position Basics Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
            {/* Ticker */}
            <div>
              <label className="text-slate-400 font-sans block mb-1 font-medium flex items-center justify-between">
                <span>Symbol</span>
                {isFetchingQuote && <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />}
              </label>
              <input
                type="text"
                required
                value={ticker}
                onChange={e => handleTickerChange(e.target.value)}
                className="w-full bg-[#0B0E14] border border-slate-800 rounded-lg p-2 text-slate-100 font-bold uppercase focus:border-emerald-500"
                placeholder="e.g. ZTS, NVDA"
              />
            </div>

            {/* Type */}
            <div>
              <label className="text-slate-400 font-sans block mb-1 font-medium">Type</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as 'LONG' | 'SHORT')}
                className="w-full bg-[#0B0E14] border border-slate-800 rounded-lg p-2 text-slate-100 font-bold focus:border-emerald-500"
              >
                <option value="LONG">LONG (Buy)</option>
                <option value="SHORT">SHORT (Sell)</option>
              </select>
            </div>

            {/* Entry Price */}
            <div>
              <label className="text-slate-400 font-sans block mb-1 font-medium">Entry Price ($)</label>
              <input
                type="number"
                step="0.01"
                required
                value={entryPrice}
                onChange={e => handleEntryPriceChange(Number(e.target.value))}
                className="w-full bg-[#0B0E14] border border-slate-800 rounded-lg p-2 text-slate-100 focus:border-emerald-500 font-bold"
              />
            </div>

            {/* Shares / Qty */}
            <div>
              <label className="text-slate-400 font-sans block mb-1 font-medium">Quantity (Shares)</label>
              <input
                type="number"
                step="any"
                required
                value={quantity}
                onChange={e => setQuantity(Number(e.target.value))}
                className="w-full bg-[#0B0E14] border border-slate-800 rounded-lg p-2 text-slate-100 focus:border-emerald-500 font-bold"
              />
            </div>
          </div>

          {/* Capital & Risk/Reward Calculation Preview Bar */}
          <div className="bg-[#0B0E14] p-3 rounded-lg border border-slate-800 grid grid-cols-4 gap-2 font-mono text-center">
            <div>
              <span className="text-[10px] text-slate-500 font-sans block">Total Investment</span>
              <strong className="text-white text-xs">{formatCurrency(totalCost)}</strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-sans block">Max Risk ($)</span>
              <strong className="text-rose-400 text-xs">-{formatCurrency(maxRiskDollars)}</strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-sans block">Target Gain ($)</span>
              <strong className="text-emerald-400 text-xs">+{formatCurrency(potentialRewardDollars)}</strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-sans block">Risk/Reward</span>
              <strong className="text-amber-400 text-xs">1 : {riskRewardRatio}</strong>
            </div>
          </div>

          {/* Section: Stop-Loss Rules */}
          <div className="bg-[#0B0E14]/60 p-3.5 rounded-lg border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200 flex items-center gap-1.5 font-sans">
                <ShieldCheck className="w-4 h-4 text-rose-400" />
                1. Stop-Loss Configuration
              </span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setStopLossType('FIXED')}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                    stopLossType === 'FIXED' ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'text-slate-400 bg-[#161B22]'
                  }`}
                >
                  Fixed Price / %
                </button>
                <button
                  type="button"
                  onClick={() => setStopLossType('TRAILING')}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                    stopLossType === 'TRAILING' ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'text-slate-400 bg-[#161B22]'
                  }`}
                >
                  Trailing Stop
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 font-mono">
              <div>
                <label className="text-slate-400 font-sans block mb-1">Stop Loss (% Below Entry)</label>
                <input
                  type="number"
                  step="0.5"
                  value={stopLossPct}
                  onChange={e => handleStopPctChange(Number(e.target.value))}
                  className="w-full bg-[#0B0E14] border border-slate-800 rounded p-2 text-rose-400 font-bold"
                />
              </div>
              <div>
                <label className="text-slate-400 font-sans block mb-1">Trigger Price Level ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={customStopPrice}
                  onChange={e => setCustomStopPrice(Number(e.target.value))}
                  className="w-full bg-[#0B0E14] border border-slate-800 rounded p-2 text-slate-100 font-bold"
                />
              </div>
            </div>
          </div>

          {/* Section: Take-Profit Rules */}
          <div className="bg-[#0B0E14]/60 p-3.5 rounded-lg border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200 flex items-center gap-1.5 font-sans">
                <Target className="w-4 h-4 text-emerald-400" />
                2. Take-Profit Target
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 font-mono">
              <div>
                <label className="text-slate-400 font-sans block mb-1">Take-Profit Target (% Gain)</label>
                <input
                  type="number"
                  step="0.5"
                  value={takeProfitPct}
                  onChange={e => handleTakeProfitPctChange(Number(e.target.value))}
                  className="w-full bg-[#0B0E14] border border-slate-800 rounded p-2 text-emerald-400 font-bold"
                />
              </div>
              <div>
                <label className="text-slate-400 font-sans block mb-1">Target Price Level ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={customTakeProfitPrice}
                  onChange={e => setCustomTakeProfitPrice(Number(e.target.value))}
                  className="w-full bg-[#0B0E14] border border-slate-800 rounded p-2 text-slate-100 font-bold"
                />
              </div>
            </div>
          </div>

          {/* Section: Technical & Time Rules */}
          <div className="bg-[#0B0E14]/60 p-3.5 rounded-lg border border-slate-800 space-y-2.5">
            <span className="font-bold text-slate-200 block font-sans">
              3. Technical Exit & Stagnation Flags
            </span>

            <div className="space-y-2 font-sans">
              <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={flagBelowEMA20}
                  onChange={e => setFlagBelowEMA20(e.target.checked)}
                  className="rounded border-slate-700 text-emerald-600 bg-[#0B0E14] focus:ring-0"
                />
                <span>Flag exit if daily close breaks below 20 EMA (Short-term trend failure)</span>
              </label>

              <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={flagBelowSMA50}
                  onChange={e => setFlagBelowSMA50(e.target.checked)}
                  className="rounded border-slate-700 text-emerald-600 bg-[#0B0E14] focus:ring-0"
                />
                <span>Flag exit if price breaks below 50 SMA (Institutional support breakdown)</span>
              </label>

              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-400">Time-based stagnation flag (Days with no move):</span>
                <div className="flex items-center space-x-1 font-mono">
                  <input
                    type="number"
                    value={maxHoldDays}
                    onChange={e => setMaxHoldDays(Number(e.target.value))}
                    className="w-16 bg-[#0B0E14] border border-slate-800 rounded p-1 text-center text-slate-100"
                  />
                  <span className="text-slate-500 text-xs">days</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-slate-400 block mb-1 font-medium font-sans">Trade Notes / Strategy Thesis</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. 20D Breakout retest holding 20 EMA, targeting prior swing high"
              className="w-full bg-[#0B0E14] border border-slate-800 rounded-lg p-2 text-slate-100 font-sans focus:border-emerald-500"
            />
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium font-sans"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow-lg flex items-center gap-1.5 font-sans"
            >
              <Check className="w-4 h-4" />
              Save Position & Enable Exit Tracking
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
