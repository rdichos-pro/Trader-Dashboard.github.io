import React, { useState } from 'react';
import { 
  Activity, 
  AlertCircle, 
  AlertOctagon, 
  AlertTriangle, 
  ArrowDownRight, 
  ArrowUpRight, 
  CandlestickChart, 
  CheckCircle2, 
  Clock, 
  Cloud, 
  Code, 
  DollarSign, 
  Edit3, 
  Eye, 
  Flame, 
  History, 
  Info, 
  Percent, 
  RotateCcw, 
  Plus, 
  RefreshCw, 
  ShieldAlert, 
  ShieldCheck, 
  Sliders, 
  Target, 
  Trash2, 
  TrendingDown, 
  TrendingUp, 
  Wallet, 
  X, 
  Zap,
  Sparkles,
  Newspaper
} from 'lucide-react';
import { ExitFlag, ExitStrategyConfig, Position, TickerQuote } from '../types/trading';
import { formatCompactNumber, formatCurrency, formatDate, formatPercent } from '../utils/formatters';
import { ExitStrategyDashboard } from './ExitStrategyDashboard';

interface PositionsTabProps {
  positions: Position[];
  closedHistory: Position[];
  onClosePosition: (id: string, exitPrice: number, notes?: string) => void;
  onResetRealizedPnl?: () => void;
  onOpenNewPositionModal: () => void;
  onSelectTicker: (symbol: string) => void;
  onNavigateToTab: (tab: string) => void;
  quotesMap: Map<string, TickerQuote>;
  universe: TickerQuote[];
  exitStrategyConfig: ExitStrategyConfig;
  onUpdateExitStrategyConfig: (newConfig: ExitStrategyConfig) => void;
  onRefreshPrices?: () => Promise<void>;
  onUpdatePosition?: (updatedPos: Position) => void;
}

export const PositionsTab: React.FC<PositionsTabProps> = ({
  positions,
  closedHistory,
  onClosePosition,
  onResetRealizedPnl,
  onOpenNewPositionModal,
  onSelectTicker,
  onNavigateToTab,
  quotesMap,
  universe,
  exitStrategyConfig,
  onUpdateExitStrategyConfig,
  onRefreshPrices,
  onUpdatePosition,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'open' | 'exit_rules' | 'alerts' | 'history'>('open');
  const [closingPosition, setClosingPosition] = useState<Position | null>(null);
  const [exitPriceInput, setExitPriceInput] = useState<number>(0);
  const [exitNotesInput, setExitNotesInput] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Edit Position Modal State
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [editEntryPrice, setEditEntryPrice] = useState<number>(0);
  const [editQuantity, setEditQuantity] = useState<number>(0);
  const [editStopLossPrice, setEditStopLossPrice] = useState<number>(0);
  const [editTakeProfitPrice, setEditTakeProfitPrice] = useState<number>(0);
  const [editNotes, setEditNotes] = useState<string>('');
  const [isFetchingEditQuote, setIsFetchingEditQuote] = useState(false);

  // Portfolio calculations
  const totalCostBasis = positions.reduce((sum, p) => sum + p.entryPrice * p.quantity, 0);
  const totalMarketValue = positions.reduce((sum, p) => sum + p.currentPrice * p.quantity, 0);
  const totalUnrealizedPnl = positions.reduce((sum, p) => sum + p.unrealizedPnlDollars, 0);
  const totalUnrealizedPnlPct = totalCostBasis > 0 ? (totalUnrealizedPnl / totalCostBasis) * 100 : 0;
  const totalRealizedPnl = closedHistory.reduce((sum, p) => sum + (p.realizedPnlDollars || 0), 0);

  // All triggered exit flags across all positions
  const allExitAlerts = positions.flatMap(p => p.exitFlags.map(f => ({ ...f, position: p })));
  const activeWarningsCount = allExitAlerts.length;

  const handleManualRefresh = async () => {
    if (!onRefreshPrices) return;
    setIsRefreshing(true);
    try {
      await onRefreshPrices();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const handleStartEdit = (pos: Position) => {
    setEditingPosition(pos);
    setEditEntryPrice(pos.entryPrice);
    setEditQuantity(pos.quantity);
    setEditStopLossPrice(pos.kumoStopPrice || pos.stopLossPrice);
    setEditTakeProfitPrice(pos.takeProfitPrice);
    setEditNotes(pos.notes || '');
  };

  const handleFetchEditLiveQuote = async () => {
    if (!editingPosition) return;
    setIsFetchingEditQuote(true);
    try {
      const res = await fetch(`/api/market/quote/${editingPosition.ticker}`);
      if (res.ok) {
        const q = await res.json();
        if (q && q.price > 0) {
          setEditEntryPrice(q.price);
          const isLong = editingPosition.type === 'LONG';
          const tpPct = editingPosition.takeProfitPct || 10;
          setEditTakeProfitPrice(Number((isLong ? q.price * (1 + tpPct / 100) : q.price * (1 - tpPct / 100)).toFixed(2)));
        }
      }
    } catch (err) {
      console.warn('Fetch edit quote error:', err);
    } finally {
      setIsFetchingEditQuote(false);
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPosition || !onUpdatePosition) return;
    const isLong = editingPosition.type === 'LONG';
    const pnlDollars = isLong
      ? (editingPosition.currentPrice - editEntryPrice) * editQuantity
      : (editEntryPrice - editingPosition.currentPrice) * editQuantity;
    const pnlPct = editEntryPrice > 0
      ? (isLong ? (editingPosition.currentPrice - editEntryPrice) / editEntryPrice : (editEntryPrice - editingPosition.currentPrice) / editEntryPrice) * 100
      : 0;

    const updated: Position = {
      ...editingPosition,
      entryPrice: editEntryPrice,
      quantity: editQuantity,
      stopLossPrice: editStopLossPrice,
      kumoStopPrice: editStopLossPrice,
      takeProfitPrice: editTakeProfitPrice,
      notes: editNotes,
      unrealizedPnlDollars: pnlDollars,
      unrealizedPnlPercent: pnlPct,
    };
    onUpdatePosition(updated);
    setEditingPosition(null);
  };

  const handleStartClose = (pos: Position, suggestedReason?: string) => {
    setClosingPosition(pos);
    setExitPriceInput(pos.currentPrice);
    setExitNotesInput(suggestedReason || 'Closed via Exit Dashboard');
  };

  const handleConfirmClose = (e: React.FormEvent) => {
    e.preventDefault();
    if (!closingPosition) return;
    onClosePosition(closingPosition.id, exitPriceInput, exitNotesInput);
    setClosingPosition(null);
  };

  return (
    <div className="space-y-4">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Metric 1: Total Market Value */}
        <div className="bg-[#161B22] p-4 rounded-lg border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-semibold uppercase tracking-wider">Market Value</span>
            <Wallet className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-100">
            {formatCurrency(totalMarketValue)}
          </div>
          <div className="text-xs text-slate-400 mt-1 font-mono">
            Basis: {formatCurrency(totalCostBasis)}
          </div>
        </div>

        {/* Metric 2: Unrealized P&L */}
        <div className="bg-[#161B22] p-4 rounded-lg border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-semibold uppercase tracking-wider">Unrealized P&L</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className={`text-xl font-bold font-mono ${totalUnrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {totalUnrealizedPnl >= 0 ? '+' : ''}{formatCurrency(totalUnrealizedPnl)}
          </div>
          <div className={`text-xs mt-1 font-mono ${totalUnrealizedPnlPct >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {formatPercent(totalUnrealizedPnlPct)} total return
          </div>
        </div>

        {/* Metric 3: Realized P&L */}
        <div className="bg-[#161B22] p-4 rounded-lg border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-semibold uppercase tracking-wider">Realized P&L</span>
            <div className="flex items-center gap-1.5">
              {onResetRealizedPnl && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Reset your realized P&L log? This clears your closed-trade history and win/loss record. Open positions and balance are not affected. This cannot be undone.')) {
                      onResetRealizedPnl();
                    }
                  }}
                  title="Reset realized P&L log (clears closed trade history, keeps open positions & balance)"
                  className="text-slate-500 hover:text-rose-400 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              <History className="w-4 h-4 text-cyan-400" />
            </div>
          </div>
          <div className={`text-xl font-bold font-mono ${totalRealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {totalRealizedPnl >= 0 ? '+' : ''}{formatCurrency(totalRealizedPnl)}
          </div>
          <div className="text-xs text-slate-400 mt-1 font-mono">
            {closedHistory.length} closed trades
          </div>
        </div>

        {/* Metric 4: Active Exit Warnings */}
        <div className="bg-[#161B22] p-4 rounded-lg border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-semibold uppercase tracking-wider">Risk / Exit Warnings</span>
            <ShieldAlert className={`w-4 h-4 ${activeWarningsCount > 0 ? 'text-rose-400' : 'text-slate-500'}`} />
          </div>
          <div className={`text-xl font-bold font-mono ${activeWarningsCount > 0 ? 'text-rose-400' : 'text-slate-100'}`}>
            {activeWarningsCount} Active
          </div>
          <div className="text-xs text-slate-400 mt-1 font-mono">
            {positions.length} open position{positions.length === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      {/* Action Header & Sub-tab navigation */}
      <div className="bg-[#161B22] p-3 rounded-lg border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="bg-[#0B0E14] p-1 rounded-lg border border-slate-800 flex items-center text-xs overflow-x-auto">
          <button
            id="view-open-positions-btn"
            onClick={() => setActiveSubTab('open')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1.5 ${
              activeSubTab === 'open'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Open Positions ({positions.length})
          </button>

          <button
            id="view-exit-strategy-btn"
            onClick={() => setActiveSubTab('exit_rules')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1.5 ${
              activeSubTab === 'exit_rules'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            Exit Rules & Risk Strategy
          </button>

          <button
            id="view-exit-alerts-btn"
            onClick={() => setActiveSubTab('alerts')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1.5 ${
              activeSubTab === 'alerts'
                ? 'bg-rose-600 text-white shadow-sm'
                : activeWarningsCount > 0
                  ? 'text-rose-400 font-bold bg-rose-950/40 border border-rose-900'
                  : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlertOctagon className="w-3.5 h-3.5" />
            Exit Signals & Alerts ({activeWarningsCount})
          </button>

          <button
            id="view-trade-history-btn"
            onClick={() => setActiveSubTab('history')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1.5 ${
              activeSubTab === 'history'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Trade Journal ({closedHistory.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          {onRefreshPrices && (
            <button
              id="refresh-positions-btn"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="px-3 py-1.5 bg-[#161B22] hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm shrink-0"
              title="Sync latest market prices for all open positions"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Syncing Live...' : 'Sync Market Prices'}</span>
            </button>
          )}

          <button
            id="log-new-trade-btn"
            onClick={onOpenNewPositionModal}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-md shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Log New Position
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-VIEW 1: Open Positions Table with Dynamic Kumo & Momentum Status */}
      {/* ========================================================================= */}
      {activeSubTab === 'open' && (
        <div className="bg-[#161B22] rounded-lg border border-slate-800 overflow-hidden shadow-lg">
          {/* Desktop Table View (Hidden on mobile < md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm font-mono">
              <thead className="bg-[#0B0E14]/70 border-b border-slate-800 text-xs text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Position</th>
                  <th className="py-3 px-3 text-right">Entry / Qty</th>
                  <th className="py-3 px-3 text-right">Current Price</th>
                  <th className="py-3 px-3 text-right">Unrealized P&L</th>
                  <th className="py-3 px-3">Dynamic Kumo Stop</th>
                  <th className="py-3 px-3">Distance to Floor</th>
                  <th className="py-3 px-3">Exit Status & Warnings</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {positions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-500 text-xs font-sans">
                      <Wallet className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                      No open positions logged. Click "Log New Position" above to track your trades with rule-based exits.
                    </td>
                  </tr>
                ) : (
                  positions.map(pos => {
                    const isPositive = pos.unrealizedPnlDollars >= 0;
                    const kumoStop = pos.kumoStopPrice ?? pos.stopLossPrice;
                    const distanceToKumo = pos.distanceToKumoPct ?? ((pos.currentPrice - kumoStop) / pos.currentPrice * 100);
                    const isNearKumo = pos.isNearKumoStop || distanceToKumo <= (exitStrategyConfig.dynamicKumoStop?.nearKumoWarningPct || 1.0);

                    return (
                      <tr 
                        key={pos.id} 
                        className={`hover:bg-slate-800/40 transition-colors ${
                          pos.exitFlags.length > 0 || isNearKumo ? 'bg-rose-950/20' : ''
                        }`}
                      >
                        {/* Position Ticker & Type */}
                        <td className="py-3.5 px-4 font-sans">
                          <div className="flex items-center space-x-2">
                            <div>
                              <div className="font-bold text-white text-base font-mono flex items-center gap-1.5">
                                <button
                                  onClick={() => {
                                    onSelectTicker(pos.ticker);
                                    onNavigateToTab('charts');
                                  }}
                                  className="hover:text-emerald-400 transition-colors"
                                >
                                  {pos.ticker}
                                </button>
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                                  {pos.type}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {formatDate(pos.entryDate)}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Entry Price & Qty */}
                        <td className="py-3.5 px-3 text-right font-mono">
                          <div className="font-bold text-slate-200">
                            {formatCurrency(pos.entryPrice)}
                          </div>
                          <div className="text-xs text-slate-400">
                            {pos.quantity} shares ({formatCurrency(pos.entryPrice * pos.quantity, 0)})
                          </div>
                        </td>

                        {/* Current Price */}
                        <td className="py-3.5 px-3 text-right font-mono">
                          <div className="font-bold text-white text-sm">
                            {formatCurrency(pos.currentPrice)}
                          </div>
                          {pos.trailingPeakPrice && (
                            <div className="text-[10px] text-slate-500">
                              Peak: {formatCurrency(pos.trailingPeakPrice)}
                            </div>
                          )}
                        </td>

                        {/* Unrealized P&L */}
                        <td className="py-3.5 px-3 text-right font-mono">
                          <div className={`font-bold text-sm ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isPositive ? '+' : ''}{formatCurrency(pos.unrealizedPnlDollars)}
                          </div>
                          <div className={`text-xs ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {formatPercent(pos.unrealizedPnlPercent)}
                          </div>
                        </td>

                        {/* Dynamic Kumo Stop Floor */}
                        <td className="py-3.5 px-3 font-mono text-xs">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-slate-100 font-bold">
                              <Cloud className="w-3.5 h-3.5 text-rose-400" />
                              <span>{formatCurrency(kumoStop)}</span>
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Target: {formatCurrency(pos.takeProfitPrice)}
                            </div>
                          </div>
                        </td>

                        {/* Distance to Kumo Floor */}
                        <td className="py-3.5 px-3 font-mono text-xs">
                          <div className={`font-bold ${isNearKumo ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {distanceToKumo > 0 ? `+${distanceToKumo.toFixed(2)}%` : `${distanceToKumo.toFixed(2)}%`}
                          </div>
                          {isNearKumo && (
                            <span className="text-[10px] text-rose-400 font-sans font-semibold block">
                              ⚠️ &le; 1% to floor
                            </span>
                          )}
                        </td>

                        {/* Active Exit Flags */}
                        <td className="py-3.5 px-3 font-sans">
                          {pos.exitFlags.length === 0 && !isNearKumo ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-900">
                              <CheckCircle2 className="w-3 h-3" /> Safe
                            </span>
                          ) : (
                            <div className="space-y-1">
                              {isNearKumo && (
                                <div className="px-2 py-0.5 rounded text-[10px] font-mono border flex items-center gap-1 bg-amber-950/80 border-amber-800 text-amber-300">
                                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                                  <span>Near Kumo Floor</span>
                                </div>
                              )}
                              {pos.exitFlags.map(flag => {
                                const isShield = flag.type === 'NEWS_REVERSAL_SHIELD';
                                return (
                                  <div
                                    key={flag.id}
                                    className={`px-2 py-0.5 rounded text-[10px] font-mono border flex items-center gap-1 ${
                                      isShield
                                        ? 'bg-indigo-950/80 border-indigo-700 text-indigo-200'
                                        : 'bg-rose-950/80 border-rose-800 text-rose-300'
                                    }`}
                                    title={flag.message}
                                  >
                                    {isShield ? (
                                      <Sparkles className="w-3 h-3 text-indigo-400 shrink-0" />
                                    ) : (
                                      <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                                    )}
                                    <span>{flag.label || flag.title}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </td>

                        {/* Action Buttons */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              onClick={() => {
                                onSelectTicker(pos.ticker);
                                onNavigateToTab('charts');
                              }}
                              className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors"
                              title="View Chart Studio"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleStartEdit(pos)}
                              className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded transition-colors"
                              title="Edit position parameters"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleStartClose(pos)}
                              className="px-2.5 py-1 bg-rose-600/80 hover:bg-rose-600 text-white rounded text-xs font-semibold transition-colors shadow-sm"
                            >
                              Close
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Responsive Card View (Visible only on mobile < md) */}
          <div className="block md:hidden divide-y divide-slate-800/80 bg-[#0B0E14]">
            {positions.length === 0 ? (
              <div className="py-8 px-4 text-center text-slate-500 text-xs font-sans">
                <Wallet className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                No open positions logged.
              </div>
            ) : (
              positions.map(pos => {
                const isPositive = pos.unrealizedPnlDollars >= 0;
                const kumoStop = pos.kumoStopPrice ?? pos.stopLossPrice;
                const distanceToKumo = pos.distanceToKumoPct ?? ((pos.currentPrice - kumoStop) / pos.currentPrice * 100);
                const isNearKumo = pos.isNearKumoStop || distanceToKumo <= (exitStrategyConfig.dynamicKumoStop?.nearKumoWarningPct || 1.0);

                return (
                  <div key={`mob-pos-${pos.id}`} className="p-3.5 space-y-3">
                    {/* Top Row: Ticker, Type, Date & Action icons */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5 font-mono">
                          <span className="text-base font-bold text-white">
                            {pos.ticker}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                            {pos.type}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-sans">
                          {formatDate(pos.entryDate)} • {pos.quantity} shares
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            onSelectTicker(pos.ticker);
                            onNavigateToTab('charts');
                          }}
                          className="p-1.5 text-slate-400 hover:text-cyan-400 bg-slate-800/80 rounded"
                          title="View Chart"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleStartEdit(pos)}
                          className="p-1.5 text-slate-400 hover:text-blue-400 bg-slate-800/80 rounded"
                          title="Edit Position"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleStartClose(pos)}
                          className="px-2.5 py-1 bg-rose-600/80 hover:bg-rose-600 text-white rounded text-xs font-semibold"
                        >
                          Close
                        </button>
                      </div>
                    </div>

                    {/* Price & PnL Metrics Grid */}
                    <div className="grid grid-cols-2 gap-2 bg-[#121620] p-2.5 rounded-lg border border-slate-800 font-mono">
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase">Current / Entry</div>
                        <div className="text-sm font-bold text-white">{formatCurrency(pos.currentPrice)}</div>
                        <div className="text-[11px] text-slate-400">Entry: {formatCurrency(pos.entryPrice)}</div>
                      </div>

                      <div className="text-right">
                        <div className="text-[10px] text-slate-500 uppercase">Unrealized P&L</div>
                        <div className={`text-sm font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isPositive ? '+' : ''}{formatCurrency(pos.unrealizedPnlDollars)}
                        </div>
                        <div className={`text-xs ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {formatPercent(pos.unrealizedPnlPercent)}
                        </div>
                      </div>
                    </div>

                    {/* Dynamic Kumo Stop Floor & Distance */}
                    <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800/80 flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-1.5">
                        <Cloud className="w-4 h-4 text-rose-400 shrink-0" />
                        <div>
                          <div className="text-[10px] text-slate-400">Kumo Stop Floor</div>
                          <div className="font-bold text-slate-100">{formatCurrency(kumoStop)}</div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[10px] text-slate-400">Distance to Floor</div>
                        <div className={`font-bold ${isNearKumo ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {distanceToKumo > 0 ? `+${distanceToKumo.toFixed(2)}%` : `${distanceToKumo.toFixed(2)}%`}
                        </div>
                      </div>
                    </div>

                    {/* Exit Warnings */}
                    {(pos.exitFlags.length > 0 || isNearKumo) && (
                      <div className="space-y-1">
                        {isNearKumo && (
                          <div className="px-2 py-1 rounded text-[11px] font-mono border flex items-center gap-1.5 bg-amber-950/80 border-amber-800 text-amber-300">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>Warning: Price is &le; 1% to Kumo Stop floor!</span>
                          </div>
                        )}
                        {pos.exitFlags.map(flag => {
                          const isShield = flag.type === 'NEWS_REVERSAL_SHIELD';
                          return (
                            <div
                              key={flag.id}
                              className={`px-2 py-1 rounded text-[11px] font-mono border flex items-center gap-1.5 ${
                                isShield
                                  ? 'bg-indigo-950/80 border-indigo-700 text-indigo-200'
                                  : 'bg-rose-950/80 border-rose-800 text-rose-300'
                              }`}
                            >
                              {isShield ? (
                                <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                              ) : (
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                              )}
                              <span>{flag.title || (flag as any).label || flag.message}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-VIEW 2: Exit Rules & Risk Strategy Dashboard */}
      {/* ========================================================================= */}
      {activeSubTab === 'exit_rules' && (
        <ExitStrategyDashboard
          config={exitStrategyConfig}
          onUpdateConfig={onUpdateExitStrategyConfig}
          positions={positions}
          universe={universe}
          onSelectTicker={onSelectTicker}
          onNavigateToTab={onNavigateToTab}
          onQuickSellPosition={pos => handleStartClose(pos, 'Triggered via Quick Sell')}
        />
      )}

      {/* ========================================================================= */}
      {/* SUB-VIEW 3: Exit Signals & Active Alerts Feed */}
      {/* ========================================================================= */}
      {activeSubTab === 'alerts' && (
        <div className="space-y-3">
          {allExitAlerts.length === 0 ? (
            <div className="bg-[#161B22] p-8 rounded-lg border border-slate-800 text-center space-y-2">
              <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto" />
              <h4 className="text-sm font-semibold text-slate-200">All Positions Currently Safe</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                No active positions have violated the Dynamic Kumo Cloud Bottom stop floor or triggered Momentum Loss exits (CCI &lt; 50 or Stoch &lt; 50).
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {allExitAlerts.map(alert => {
                const isCrit = alert.type === 'CRITICAL';
                return (
                  <div
                    key={`${alert.position.id}-${alert.id}`}
                    className="bg-[#161B22] border border-rose-900/80 rounded-lg p-4 space-y-3 shadow-lg"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-base font-bold text-white font-mono">{alert.position.ticker}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-950 text-rose-300 border border-rose-800 font-mono">
                          {alert.label}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-slate-400">
                        {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="bg-[#0B0E14] p-2.5 rounded border border-slate-800 text-xs text-slate-300 font-mono leading-relaxed">
                      <p className="text-rose-300 font-semibold">{alert.message}</p>
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono text-slate-400 pt-2 border-t border-slate-800/80">
                      <div>
                        Entry: <strong className="text-slate-200">{formatCurrency(alert.position.entryPrice)}</strong>
                      </div>
                      <div>
                        P&L: <strong className={alert.position.unrealizedPnlDollars >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {formatCurrency(alert.position.unrealizedPnlDollars)} ({formatPercent(alert.position.unrealizedPnlPercent)})
                        </strong>
                      </div>
                    </div>

                    <button
                      onClick={() => handleStartClose(alert.position, alert.message)}
                      className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white rounded font-bold text-xs transition-colors shadow-md flex items-center justify-center gap-1.5"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      Execute Exit Order ({alert.orderAction || 'MARKET SELL'})
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-VIEW 4: Closed Trades History */}
      {/* ========================================================================= */}
      {activeSubTab === 'history' && (
        <div className="bg-[#161B22] rounded-lg border border-slate-800 overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm font-mono">
              <thead className="bg-[#0B0E14]/70 border-b border-slate-800 text-xs text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Ticker</th>
                  <th className="py-3 px-3">Entry Date / Price</th>
                  <th className="py-3 px-3">Exit Date / Price</th>
                  <th className="py-3 px-3 text-right">Shares</th>
                  <th className="py-3 px-3 text-right">Realized P&L ($)</th>
                  <th className="py-3 px-3 text-right">Return (%)</th>
                  <th className="py-3 px-4">Exit Reason / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {closedHistory.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-500 text-xs font-sans">
                      No closed trades logged yet. When you close open positions, they will be archived here in your trade journal.
                    </td>
                  </tr>
                ) : (
                  closedHistory.map(pos => {
                    const pnl = pos.realizedPnlDollars || 0;
                    const pnlPct = pos.realizedPnlPercent || 0;
                    const isWin = pnl >= 0;

                    return (
                      <tr key={pos.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-bold text-white text-base">{pos.ticker}</span>
                          <span className={`ml-2 text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                            pos.ticker.toUpperCase() === 'XAUUSD'
                              ? 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                              : 'bg-slate-800/60 text-slate-400 border-slate-700'
                          }`}>
                            {pos.ticker.toUpperCase() === 'XAUUSD' ? '5M/30M' : '1HR/1D'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-300 text-xs">
                          {formatDate(pos.entryDate)} @ {formatCurrency(pos.entryPrice)}
                        </td>
                        <td className="py-3 px-3 text-slate-300 text-xs">
                          {pos.closeDate ? formatDate(pos.closeDate) : 'Recently'} @ {formatCurrency(pos.closePrice || pos.entryPrice)}
                        </td>
                        <td className="py-3 px-3 text-right text-slate-300">
                          {pos.quantity}
                        </td>
                        <td className={`py-3 px-3 text-right font-bold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isWin ? '+' : ''}{formatCurrency(pnl)}
                        </td>
                        <td className={`py-3 px-3 text-right font-bold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {formatPercent(pnlPct)}
                        </td>
                        <td className="py-3 px-4 font-sans text-xs text-slate-400">
                          {pos.notes || 'Target / Stop achieved'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Close Position Modal Dialog */}
      {closingPosition && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#161B22] border border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                Close Position: {closingPosition.ticker}
              </h3>
              <button onClick={() => setClosingPosition(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmClose} className="space-y-3 text-xs">
              <div className="bg-[#0B0E14] p-3 rounded-lg border border-slate-800 space-y-1 font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Entry Price:</span>
                  <span className="text-slate-200">{formatCurrency(closingPosition.entryPrice)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Quantity:</span>
                  <span className="text-slate-200">{closingPosition.quantity} shares</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Estimated P&L:</span>
                  <span className={exitPriceInput >= closingPosition.entryPrice ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                    {formatCurrency((exitPriceInput - closingPosition.entryPrice) * closingPosition.quantity)}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-medium">Actual Exit Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={exitPriceInput}
                  onChange={e => setExitPriceInput(Number(e.target.value))}
                  className="w-full bg-[#0B0E14] border border-slate-800 rounded-lg p-2.5 text-slate-100 font-mono text-sm focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-medium">Exit Reason & Notes (Journaling)</label>
                <textarea
                  rows={2}
                  value={exitNotesInput}
                  onChange={e => setExitNotesInput(e.target.value)}
                  placeholder="e.g. Hit target, or dynamic Kumo stop floor reached, or CCI dropped < 50..."
                  className="w-full bg-[#0B0E14] border border-slate-800 rounded-lg p-2 text-slate-100 font-sans focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setClosingPosition(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold shadow-md"
                >
                  Confirm Exit & Log to Journal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Position Modal Dialog */}
      {editingPosition && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#161B22] border border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Sliders className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold text-white">
                  Edit Position: {editingPosition.ticker}
                </h3>
              </div>
              <button onClick={() => setEditingPosition(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              <div className="bg-[#0B0E14] p-3 rounded-lg border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-sans font-bold block">Current Market Price</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">{formatCurrency(editingPosition.currentPrice)}</span>
                </div>
                <button
                  type="button"
                  onClick={handleFetchEditLiveQuote}
                  disabled={isFetchingEditQuote}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded font-semibold text-[11px] flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className={`w-3 h-3 text-emerald-400 ${isFetchingEditQuote ? 'animate-spin' : ''}`} />
                  Fetch Live Quote
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 font-mono">
                <div>
                  <label className="text-slate-400 font-sans block mb-1 font-medium">Entry Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editEntryPrice}
                    onChange={e => setEditEntryPrice(Number(e.target.value))}
                    className="w-full bg-[#0B0E14] border border-slate-800 rounded-lg p-2 text-slate-100 font-bold focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-sans block mb-1 font-medium">Quantity (Shares)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={editQuantity}
                    onChange={e => setEditQuantity(Number(e.target.value))}
                    className="w-full bg-[#0B0E14] border border-slate-800 rounded-lg p-2 text-slate-100 font-bold focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 font-mono">
                <div>
                  <label className="text-slate-400 font-sans block mb-1 font-medium">Kumo Stop Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editStopLossPrice}
                    onChange={e => setEditStopLossPrice(Number(e.target.value))}
                    className="w-full bg-[#0B0E14] border border-slate-800 rounded-lg p-2 text-rose-300 font-bold focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-sans block mb-1 font-medium">Take Profit Target ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editTakeProfitPrice}
                    onChange={e => setEditTakeProfitPrice(Number(e.target.value))}
                    className="w-full bg-[#0B0E14] border border-slate-800 rounded-lg p-2 text-emerald-300 font-bold focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-medium font-sans">Notes</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  placeholder="Notes, trade thesis, entry triggers..."
                  className="w-full bg-[#0B0E14] border border-slate-800 rounded-lg p-2 text-slate-100 font-sans focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPosition(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold shadow-md"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
