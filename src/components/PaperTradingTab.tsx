import React, { useState } from 'react';
import { 
  ArrowDownRight, 
  ArrowUpRight, 
  CandlestickChart, 
  Check, 
  DollarSign, 
  Flame, 
  History, 
  PlayCircle, 
  Plus, 
  RefreshCw, 
  RotateCcw, 
  ShieldAlert, 
  Target, 
  TrendingUp, 
  Wallet 
} from 'lucide-react';
import { PaperAccount, Position, TickerQuote } from '../types/trading';
import { formatCompactNumber, formatCurrency, formatDate, formatPercent } from '../utils/formatters';

interface PaperTradingTabProps {
  account: PaperAccount;
  onExecutePaperOrder: (
    ticker: string,
    type: 'LONG' | 'SHORT',
    shares: number,
    price: number,
    stopPct?: number,
    targetPct?: number
  ) => void;
  onClosePaperPosition: (id: string, exitPrice: number) => void;
  onResetPaperAccount: (initialBalance: number) => void;
  universe: TickerQuote[];
  onSelectTicker: (symbol: string) => void;
  onNavigateToTab: (tab: string) => void;
}

export const PaperTradingTab: React.FC<PaperTradingTabProps> = ({
  account,
  onExecutePaperOrder,
  onClosePaperPosition,
  onResetPaperAccount,
  universe,
  onSelectTicker,
  onNavigateToTab,
}) => {
  const [tickerInput, setTickerInput] = useState<string>('NVDA');
  const [orderType, setOrderType] = useState<'LONG' | 'SHORT'>('LONG');
  const [sharesInput, setSharesInput] = useState<number>(50);
  const [stopLossPctInput, setStopLossPctInput] = useState<number>(5.0);
  const [takeProfitPctInput, setTakeProfitPctInput] = useState<number>(10.0);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const selectedQuote = universe.find(u => u.symbol === tickerInput.toUpperCase()) || universe[0];
  const orderPrice = selectedQuote ? selectedQuote.price : 100;
  const estimatedTotal = orderPrice * sharesInput;

  const totalPositionsValue = account.positions.reduce((sum, p) => sum + p.currentPrice * p.quantity, 0);
  const totalUnrealized = account.positions.reduce((sum, p) => sum + p.unrealizedPnlDollars, 0);
  const totalEquity = account.balance + totalPositionsValue;
  const totalGainFromStart = totalEquity - account.initialBalance;
  const totalGainPct = account.initialBalance > 0 ? (totalGainFromStart / account.initialBalance) * 100 : 0;

  const handleExecute = (e: React.FormEvent) => {
    e.preventDefault();
    if (estimatedTotal > account.balance) {
      alert(`Insufficient simulated buying power! Order requires ${formatCurrency(estimatedTotal)} but available balance is ${formatCurrency(account.balance)}.`);
      return;
    }

    onExecutePaperOrder(
      tickerInput.toUpperCase().trim(),
      orderType,
      sharesInput,
      orderPrice,
      stopLossPctInput,
      takeProfitPctInput
    );

    setSuccessMsg(`Simulated ${orderType} order filled for ${sharesInput} shares of ${tickerInput} @ ${formatCurrency(orderPrice)}!`);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  return (
    <div className="space-y-4">
      {/* Paper Balance Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Equity */}
        <div className="bg-[#161B22] p-4 rounded-lg border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-semibold uppercase tracking-wider">Simulated Net Equity</span>
            <Wallet className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white">
            {formatCurrency(totalEquity)}
          </div>
          <div className={`text-xs font-mono mt-0.5 ${totalGainFromStart >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {totalGainFromStart >= 0 ? '+' : ''}{formatCurrency(totalGainFromStart)} ({formatPercent(totalGainPct)})
          </div>
        </div>

        {/* Cash Balance / Buying Power */}
        <div className="bg-[#161B22] p-4 rounded-lg border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-semibold uppercase tracking-wider">Available Cash</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400">
            {formatCurrency(account.balance)}
          </div>
          <div className="text-xs text-slate-500 font-mono mt-0.5">
            Initial: {formatCurrency(account.initialBalance)}
          </div>
        </div>

        {/* Active Paper Positions P&L */}
        <div className="bg-[#161B22] p-4 rounded-lg border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-semibold uppercase tracking-wider">Unrealized P&L</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className={`text-xl font-bold font-mono ${totalUnrealized >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {totalUnrealized >= 0 ? '+' : ''}{formatCurrency(totalUnrealized)}
          </div>
          <div className="text-xs text-slate-500 font-mono mt-0.5">
            {account.positions.length} open paper trades
          </div>
        </div>

        {/* Win / Loss Record */}
        <div className="bg-[#161B22] p-4 rounded-lg border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-semibold uppercase tracking-wider">Win / Loss Record</span>
            <Target className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white">
            {account.winCount}W / {account.lossCount}L
          </div>
          <div className="text-xs text-slate-500 font-mono mt-0.5">
            Win Rate: {account.history.length > 0 ? ((account.winCount / account.history.length) * 100).toFixed(1) : '0.0'}%
          </div>
        </div>
      </div>

      {/* Main Paper Trading Desk: Order Entry + Active Positions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Order Execution Widget */}
        <div className="bg-[#161B22] p-5 rounded-lg border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <PlayCircle className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Simulated Order Desk</h3>
            </div>
            <button
              onClick={() => onResetPaperAccount(0)}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
              title="Reset balance to $0"
            >
              <RotateCcw className="w-3 h-3" /> Reset to $0
            </button>
          </div>

          {successMsg && (
            <div className="p-3 bg-emerald-950/90 border border-emerald-700 text-emerald-300 rounded-lg text-xs font-semibold flex items-center gap-2 animate-fadeIn">
              <Check className="w-4 h-4 shrink-0 text-emerald-400" />
              {successMsg}
            </div>
          )}

          <form onSubmit={handleExecute} className="space-y-3 text-xs">
            {/* Long / Short Toggle */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-[#0B0E14] rounded-lg border border-slate-800 font-bold">
              <button
                type="button"
                onClick={() => setOrderType('LONG')}
                className={`py-2 rounded-md transition-colors ${
                  orderType === 'LONG' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                BUY (LONG)
              </button>
              <button
                type="button"
                onClick={() => setOrderType('SHORT')}
                className={`py-2 rounded-md transition-colors ${
                  orderType === 'SHORT' ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                SELL (SHORT)
              </button>
            </div>

            {/* Symbol & Price Display */}
            <div>
              <label className="text-slate-400 block mb-1 font-medium">Select Ticker</label>
              <select
                value={tickerInput}
                onChange={e => setTickerInput(e.target.value)}
                className="w-full bg-[#0B0E14] border border-slate-800 rounded-lg p-2 text-white font-mono font-bold text-sm focus:border-amber-500"
              >
                {universe.map(u => (
                  <option key={u.symbol} value={u.symbol}>
                    {u.symbol} - {formatCurrency(u.price)} ({formatPercent(u.changePercent)})
                  </option>
                ))}
              </select>
            </div>

            {/* Shares Quantity */}
            <div className="grid grid-cols-2 gap-3 font-mono">
              <div>
                <label className="text-slate-400 font-sans block mb-1 font-medium">Shares</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={sharesInput}
                  onChange={e => setSharesInput(Number(e.target.value))}
                  className="w-full bg-[#0B0E14] border border-slate-800 rounded-lg p-2 text-slate-100 font-bold"
                />
              </div>
              <div>
                <label className="text-slate-400 font-sans block mb-1 font-medium">Market Price</label>
                <div className="p-2 bg-[#0B0E14] border border-slate-800 rounded-lg text-slate-200 font-bold">
                  {formatCurrency(orderPrice)}
                </div>
              </div>
            </div>

            {/* Quick Stop Loss & Take Profit % */}
            <div className="grid grid-cols-2 gap-3 font-mono">
              <div>
                <label className="text-slate-400 font-sans block mb-1 font-medium">Stop-Loss (%)</label>
                <input
                  type="number"
                  step="0.5"
                  value={stopLossPctInput}
                  onChange={e => setStopLossPctInput(Number(e.target.value))}
                  className="w-full bg-[#0B0E14] border border-slate-800 rounded-lg p-2 text-rose-400 font-bold"
                />
              </div>
              <div>
                <label className="text-slate-400 font-sans block mb-1 font-medium">Take-Profit (%)</label>
                <input
                  type="number"
                  step="0.5"
                  value={takeProfitPctInput}
                  onChange={e => setTakeProfitPctInput(Number(e.target.value))}
                  className="w-full bg-[#0B0E14] border border-slate-800 rounded-lg p-2 text-emerald-400 font-bold"
                />
              </div>
            </div>

            {/* Total Order Cost Summary */}
            <div className="bg-[#0B0E14] p-3 rounded-lg border border-slate-800 font-mono space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Estimated Order Value:</span>
                <strong className="text-white">{formatCurrency(estimatedTotal)}</strong>
              </div>
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>Simulated Commission / Fees:</span>
                <span>$0.00 (Zero Fee)</span>
              </div>
            </div>

            <button
              type="submit"
              className={`w-full py-2.5 rounded-lg font-bold text-sm text-white shadow-lg transition-colors flex items-center justify-center gap-1.5 ${
                orderType === 'LONG' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'
              }`}
            >
              <PlayCircle className="w-4 h-4" />
              Execute Simulated {orderType} Order
            </button>
          </form>
        </div>

        {/* Paper Positions & Orders Table */}
        <div className="lg:col-span-2 bg-[#161B22] rounded-lg border border-slate-800 overflow-hidden shadow-xl flex flex-col justify-between">
          <div>
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-400" />
                Active Paper Positions ({account.positions.length})
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                Live simulated fills & stops
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm font-mono">
                <thead className="bg-[#0B0E14]/70 border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-4">Ticker</th>
                    <th className="py-2.5 px-3 text-right">Entry / Qty</th>
                    <th className="py-2.5 px-3 text-right">Current Price</th>
                    <th className="py-2.5 px-3 text-right">P&L ($ / %)</th>
                    <th className="py-2.5 px-3">Exit Rules</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {account.positions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500 text-xs font-sans">
                        No paper positions open. Use the Simulated Order Desk on the left to test a strategy.
                      </td>
                    </tr>
                  ) : (
                    account.positions.map(pos => {
                      const isWin = pos.unrealizedPnlDollars >= 0;
                      return (
                        <tr key={pos.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-bold text-white text-base">{pos.ticker}</span>
                            <span className="text-[10px] text-slate-400 block font-sans">{pos.type}</span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="text-slate-200 font-semibold">{formatCurrency(pos.entryPrice)}</div>
                            <div className="text-xs text-slate-500">{pos.quantity} shs</div>
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-white">
                            {formatCurrency(pos.currentPrice)}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className={`font-bold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {isWin ? '+' : ''}{formatCurrency(pos.unrealizedPnlDollars)}
                            </div>
                            <div className={`text-xs ${isWin ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {formatPercent(pos.unrealizedPnlPercent)}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-xs font-sans">
                            <div className="text-rose-400 font-mono">Stop: {formatCurrency(pos.stopLossPrice)}</div>
                            <div className="text-emerald-400 font-mono">Target: {formatCurrency(pos.takeProfitPrice)}</div>
                          </td>
                          <td className="py-3 px-4 text-right font-sans">
                            <button
                              onClick={() => onClosePaperPosition(pos.id, pos.currentPrice)}
                              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-bold transition-colors"
                            >
                              Close Market
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
      </div>
    </div>
  );
};
