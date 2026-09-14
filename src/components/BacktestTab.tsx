import React, { useState } from 'react';
import { 
  Activity, 
  ArrowDownRight, 
  ArrowUpRight, 
  Award, 
  BarChart3, 
  Check, 
  CheckCircle2, 
  ChevronRight, 
  Cpu, 
  DollarSign, 
  Flame, 
  History, 
  Play, 
  RotateCcw, 
  Sliders, 
  Target, 
  TrendingUp, 
  Zap 
} from 'lucide-react';
import { runBacktest, runStockWalkForwardBacktest } from '../services/backtester';
import { generateExtendedHistoricalCandles } from '../services/mockMarketData';
import { BacktestParams, BacktestResult, TickerQuote } from '../types/trading';
import { formatCompactNumber, formatCurrency, formatDate, formatPercent } from '../utils/formatters';

interface BacktestTabProps {
  universe: TickerQuote[];
  onSelectTicker: (symbol: string) => void;
  onNavigateToTab: (tab: string) => void;
}

export const BacktestTab: React.FC<BacktestTabProps> = ({
  universe,
  onSelectTicker,
  onNavigateToTab,
}) => {
  const [params, setParams] = useState<BacktestParams>({
    strategyId: 'rule-breakout-vol',
    stopLossPct: 5.0,
    takeProfitPct: 10.0,
    maxHoldDays: 15,
    universeScope: 'ALL',
    specificTicker: 'NVDA',
    commissionPerTrade: 1.0,
    slippagePct: 0.1,
    holdoutDays: 30,
  });

  const runSelectedBacktest = (p: BacktestParams): BacktestResult => {
    if (p.universeScope === 'SINGLE' && p.specificTicker) {
      // Real dual-timeframe (1HR entry + 1D macro) 8-pillar strategy, walk-forward validated.
      const candles1h = generateExtendedHistoricalCandles(p.specificTicker, '60', 365 * 24);
      const candlesD = generateExtendedHistoricalCandles(p.specificTicker, 'D', 400);
      return runStockWalkForwardBacktest(p.specificTicker, candles1h, candlesD, 10000, p.holdoutDays || 30, 25);
    }
    // Legacy single-timeframe (4H) engine for whole-universe scans.
    return runBacktest(p);
  };

  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(() => runSelectedBacktest(params));

  const handleRunTest = (e: React.FormEvent) => {
    e.preventDefault();
    setIsRunning(true);
    setTimeout(() => {
      const res = runSelectedBacktest(params);
      setResult(res);
      setIsRunning(false);
    }, 250);
  };

  return (
    <div className="space-y-4">
      {/* Overview Banner */}
      <div className="bg-[#161B22] p-4 rounded-lg border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <Cpu className="w-5 h-5 text-emerald-400" />
          <div>
            <h2 className="text-base font-bold text-slate-100">Algorithmic Rule Backtester</h2>
            <p className="text-xs text-slate-400">
              Simulate rule triggers against historical price action with stop-loss and profit target execution.
            </p>
          </div>
        </div>

        <div className="text-xs font-mono text-emerald-400 bg-[#0B0E14] px-3 py-1.5 rounded-lg border border-slate-800">
          {params.universeScope === 'SINGLE' ? '1HR+1D Walk-Forward (1Yr Dataset)' : '6-Month Lookback Dataset'}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Parameters Form */}
        <div className="bg-[#161B22] p-5 rounded-lg border border-slate-800 space-y-4 shadow-xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
            <Sliders className="w-4 h-4 text-emerald-400" />
            Strategy Parameters
          </h3>

          <form onSubmit={handleRunTest} className="space-y-3.5 text-xs">
            {/* Strategy Selection - legacy engine only; the single-ticker engine below auto-selects via walk-forward */}
            {params.universeScope !== 'SINGLE' && (
              <div>
                <label className="text-slate-400 block mb-1 font-medium">Strategy Trigger Template</label>
                <select
                  value={params.strategyId}
                  onChange={e => setParams({ ...params, strategyId: e.target.value })}
                  className="w-full bg-[#0B0E14] border border-slate-800 rounded-lg p-2.5 text-white font-medium focus:border-emerald-500"
                >
                  <option value="rule-breakout-vol">20-Day Breakout + 1.5x Volume Spike</option>
                  <option value="rule-ma-crossover">20 EMA / 50 SMA Golden Cross</option>
                  <option value="rule-rsi-oversold">RSI(14) Oversold Bounce (&lt; 32)</option>
                  <option value="rule-rvol-momentum">RVOL Spike (&gt; 2.0x) + &gt;3.5% Move</option>
                </select>
              </div>
            )}


            {/* Universe Scope */}
            <div>
              <label className="text-slate-400 block mb-1 font-medium">Test Scope</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setParams({ ...params, universeScope: 'ALL' })}
                  className={`p-2 rounded-lg border font-medium text-xs transition-colors ${
                    params.universeScope === 'ALL'
                      ? 'bg-emerald-950 border-emerald-600 text-emerald-300 font-bold'
                      : 'bg-[#0B0E14] border-slate-800 text-slate-400'
                  }`}
                >
                  Entire Universe ({universe.length} Stocks)
                </button>
                <button
                  type="button"
                  onClick={() => setParams({ ...params, universeScope: 'SINGLE' })}
                  className={`p-2 rounded-lg border font-medium text-xs transition-colors ${
                    params.universeScope === 'SINGLE'
                      ? 'bg-emerald-950 border-emerald-600 text-emerald-300 font-bold'
                      : 'bg-[#0B0E14] border-slate-800 text-slate-400'
                  }`}
                >
                  Single Ticker
                </button>
              </div>
            </div>

            {params.universeScope === 'SINGLE' && (
              <div>
                <label className="text-slate-400 block mb-1 font-medium">Selected Ticker</label>
                <select
                  value={params.specificTicker || 'NVDA'}
                  onChange={e => setParams({ ...params, specificTicker: e.target.value })}
                  className="w-full bg-[#0B0E14] border border-slate-800 rounded-lg p-2 text-white font-mono font-bold"
                >
                  {universe.map(u => (
                    <option key={u.symbol} value={u.symbol}>
                      {u.symbol} - {u.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {params.universeScope === 'SINGLE' ? (
              <div className="bg-emerald-950/30 border border-emerald-900/50 p-2.5 rounded-lg flex items-start gap-2">
                <Cpu className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-emerald-200/80 leading-snug">
                  Tests all 6 real 1D+1HR 8-pillar Ichimoku variants (volume-confirmed) and auto-selects the best performer on in-sample data — exits (stop/target) are managed internally per-strategy, not user-set here.
                </p>
              </div>
            ) : (
              <>
                {/* Risk / Exit Thresholds */}
                <div className="grid grid-cols-2 gap-3 font-mono">
                  <div>
                    <label className="text-slate-400 font-sans block mb-1 font-medium">Stop-Loss (%)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={params.stopLossPct}
                      onChange={e => setParams({ ...params, stopLossPct: Number(e.target.value) })}
                      className="w-full bg-[#0B0E14] border border-slate-800 rounded-lg p-2 text-rose-400 font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 font-sans block mb-1 font-medium">Take-Profit (%)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={params.takeProfitPct}
                      onChange={e => setParams({ ...params, takeProfitPct: Number(e.target.value) })}
                      className="w-full bg-[#0B0E14] border border-slate-800 rounded-lg p-2 text-emerald-400 font-bold"
                    />
                  </div>
                </div>

                {/* Max Hold Duration */}
                <div>
                  <label className="text-slate-400 block mb-1 font-medium">Max Holding Window</label>
                  <div className="flex items-center space-x-2 font-mono">
                    <input
                      type="number"
                      value={params.maxHoldDays}
                      onChange={e => setParams({ ...params, maxHoldDays: Number(e.target.value) })}
                      className="w-full bg-[#0B0E14] border border-slate-800 rounded-lg p-2 text-slate-100 font-bold"
                    />
                    <span className="text-slate-400 font-sans text-xs">Days</span>
                  </div>
                </div>

                {/* Realism Parameters */}
                <div className="grid grid-cols-2 gap-3 font-mono">
                  <div>
                    <label className="text-slate-400 font-sans block mb-1 font-medium">Slippage (%)</label>
                    <input
                      type="number"
                      step="0.05"
                      value={params.slippagePct}
                      onChange={e => setParams({ ...params, slippagePct: Number(e.target.value) })}
                      className="w-full bg-[#0B0E14] border border-slate-800 rounded-lg p-2 text-amber-400 font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 font-sans block mb-1 font-medium">Commission ($)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={params.commissionPerTrade}
                      onChange={e => setParams({ ...params, commissionPerTrade: Number(e.target.value) })}
                      className="w-full bg-[#0B0E14] border border-slate-800 rounded-lg p-2 text-slate-300 font-bold"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Out of Sample Holdout */}
            <div>
              <label className="text-slate-400 block mb-1 font-medium">
                {params.universeScope === 'SINGLE' ? 'Walk-Forward Holdout Window' : 'OOS Holdout Window (To catch overfitting)'}
              </label>
              <div className="flex items-center space-x-2 font-mono">
                <input
                  type="number"
                  value={params.holdoutDays}
                  onChange={e => setParams({ ...params, holdoutDays: Number(e.target.value) })}
                  className="w-full bg-[#0B0E14] border border-slate-800 rounded-lg p-2 text-slate-100 font-bold"
                />
                <span className="text-slate-400 font-sans text-xs">Days (Untouched)</span>
              </div>
              {params.universeScope === 'SINGLE' && (
                <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                  Strategy is selected on data before this window only, then validated on this window untouched. Results below are the out-of-sample numbers.
                </p>
              )}
            </div>

            {params.universeScope === 'ALL' && (
              <div className="bg-amber-950/40 border border-amber-900/50 p-2.5 rounded-lg flex items-start gap-2">
                <Activity className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-200/80 leading-snug">
                  <strong>Survivorship Bias Flag:</strong> Running against the current active universe may inflate returns, as stocks that delisted or went bankrupt are not included.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isRunning}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <Play className="w-4 h-4" />
              {isRunning ? 'Simulating Historical Data...' : 'Run Historical Backtest'}
            </button>
          </form>
        </div>

        {/* Backtest Results Display */}
        <div className="lg:col-span-2 space-y-4">
          {result && (
            <>
              {result.isWalkForward && (
                <div className="bg-[#161B22] p-4 rounded-lg border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h4 className="font-bold text-xs text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-emerald-400" />
                      Walk-Forward Validation
                    </h4>
                    {result.strategyName && (
                      <span className="text-[11px] font-mono text-emerald-300 bg-emerald-950/50 border border-emerald-800 px-2 py-0.5 rounded">
                        Selected: {result.strategyName}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-[#0B0E14] p-3 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-500 uppercase font-medium block mb-1">In-Sample (Selection Data)</span>
                      {result.inSample ? (
                        <div className="font-mono space-y-0.5">
                          <div className="text-slate-300">{result.inSample.trades} trades</div>
                          <div className="text-slate-300">{result.inSample.winRatePct}% WR &middot; {result.inSample.profitFactor}x PF</div>
                          <div className={result.inSample.netReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {result.inSample.netReturnPct >= 0 ? '+' : ''}{result.inSample.netReturnPct}%
                          </div>
                        </div>
                      ) : <span className="text-slate-500">N/A</span>}
                    </div>
                    <div className="bg-[#0B0E14] p-3 rounded-lg border border-emerald-900/60">
                      <span className="text-[10px] text-emerald-500 uppercase font-medium block mb-1">Out-of-Sample (Real Test)</span>
                      {result.outOfSample ? (
                        <div className="font-mono space-y-0.5">
                          <div className="text-slate-300">{result.outOfSample.trades} trades</div>
                          <div className="text-slate-300">{result.outOfSample.winRatePct}% WR &middot; {result.outOfSample.profitFactor}x PF</div>
                          <div className={result.outOfSample.netReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {result.outOfSample.netReturnPct >= 0 ? '+' : ''}{result.outOfSample.netReturnPct}%
                          </div>
                        </div>
                      ) : <span className="text-slate-500">N/A</span>}
                    </div>
                  </div>

                  {result.overfittingWarning && (
                    <div className="bg-amber-950/40 border border-amber-900/50 p-2.5 rounded-lg flex items-start gap-2">
                      <Activity className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-amber-200/80 leading-snug">{result.overfittingWarning}</p>
                    </div>
                  )}

                  <p className="text-[10px] text-slate-500 leading-snug">
                    The KPI cards and trade log below reflect the <strong>out-of-sample</strong> result only — the strategy was picked using the in-sample data above, so its own numbers aren't a fair test of forward performance.
                  </p>
                </div>
              )}

              {/* Top Result KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Win Rate */}
                <div className="bg-[#161B22] p-3.5 rounded-lg border border-slate-800">
                  <span className="text-[11px] text-slate-400 block font-medium">Win Rate</span>
                  <div className={`text-xl font-bold font-mono ${result.winRate >= 50 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {result.winRate.toFixed(1)}%
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {result.winningTrades}W / {result.losingTrades}L
                  </span>
                </div>

                {/* Net Return */}
                <div className="bg-[#161B22] p-3.5 rounded-lg border border-slate-800">
                  <span className="text-[11px] text-slate-400 block font-medium">Cumulative Return</span>
                  <div className={`text-xl font-bold font-mono ${result.totalReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {result.totalReturnPct >= 0 ? '+' : ''}{result.totalReturnPct.toFixed(1)}%
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Across {result.totalTrades} signals
                  </span>
                </div>

                {/* Profit Factor */}
                <div className="bg-[#161B22] p-3.5 rounded-lg border border-slate-800">
                  <span className="text-[11px] text-slate-400 block font-medium">Profit Factor</span>
                  <div className={`text-xl font-bold font-mono ${result.profitFactor >= 1.5 ? 'text-emerald-400' : 'text-slate-200'}`}>
                    {result.profitFactor.toFixed(2)}
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Gross Win/Loss Ratio
                  </span>
                </div>

                {/* Max Drawdown */}
                <div className="bg-[#161B22] p-3.5 rounded-lg border border-slate-800">
                  <span className="text-[11px] text-slate-400 block font-medium">Max Drawdown</span>
                  <div className="text-xl font-bold font-mono text-rose-400">
                    -{result.maxDrawdownPct.toFixed(1)}%
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Peak-to-trough risk
                  </span>
                </div>
              </div>

              {/* Detailed Simulated Trades Table */}
              <div className="bg-[#161B22] rounded-lg border border-slate-800 overflow-hidden shadow-lg">
                <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <History className="w-4 h-4 text-emerald-400" />
                    Simulated Historical Trade Log ({result.trades.length})
                  </h4>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Avg Trade: {result.totalTrades > 0 ? (result.totalReturnPct / result.totalTrades).toFixed(2) : 0}%
                  </span>
                </div>

                <div className="overflow-x-auto max-h-80 overflow-y-auto">
                  <table className="w-full text-left text-sm font-mono">
                    <thead className="bg-[#0B0E14]/70 border-b border-slate-800 text-[11px] text-slate-400 uppercase tracking-wider sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">Ticker</th>
                        <th className="py-2.5 px-3">Entry Date</th>
                        <th className="py-2.5 px-3 text-right">Entry $</th>
                        <th className="py-2.5 px-3">Exit Date</th>
                        <th className="py-2.5 px-3 text-right">Exit $</th>
                        <th className="py-2.5 px-3 text-right">Return %</th>
                        <th className="py-2.5 px-3">Exit Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-xs">
                      {result.trades.map(trade => {
                        const isWin = trade.returnPct >= 0;
                        return (
                          <tr key={trade.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-2.5 px-3 font-bold text-white">
                              {trade.ticker}
                            </td>
                            <td className="py-2.5 px-3 text-slate-400">
                              {formatDate(trade.entryDate)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-200">
                              {formatCurrency(trade.entryPrice)}
                            </td>
                            <td className="py-2.5 px-3 text-slate-400">
                              {formatDate(trade.exitDate)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-200">
                              {formatCurrency(trade.exitPrice)}
                            </td>
                            <td className={`py-2.5 px-3 text-right font-bold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {isWin ? '+' : ''}{trade.returnPct.toFixed(2)}%
                            </td>
                            <td className="py-2.5 px-3 font-sans text-[11px]">
                              <span className={`px-2 py-0.5 rounded font-medium ${
                                trade.exitReason === 'TAKE_PROFIT'
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                  : trade.exitReason === 'STOP_LOSS'
                                  ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                  : 'bg-slate-800 text-slate-400'
                              }`}>
                                {trade.exitReason.replace('_', ' ')}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
