import React from 'react';
import { AlertTriangle, CheckCircle, ChevronRight, TrendingUp, X } from 'lucide-react';
import { SignalAlert } from '../types/trading';
import { formatCurrency } from '../utils/formatters';

interface AlertToastProps {
  toasts: SignalAlert[];
  onDismiss: (id: string) => void;
  onSelectTicker: (symbol: string) => void;
}

export const AlertToastContainer: React.FC<AlertToastProps> = ({
  toasts,
  onDismiss,
  onSelectTicker,
}) => {
  if (!toasts || toasts.length === 0) return null;

  // Guarantee key uniqueness across updates
  const uniqueToasts = Array.from<SignalAlert>(new Map<string, SignalAlert>(toasts.map(t => [t.id, t])).values());

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {uniqueToasts.slice(0, 3).map(toast => {
        const isBullish = toast.direction === 'BULLISH';
        const isWarn = toast.signal === 'WARN';
        const pipelineName = toast.pipeline || (toast.ruleName.includes('Group 1') ? 'Trend & Momentum' : 'Mean Reversion');

        const cardStyle = isWarn
          ? 'bg-[#241B0D]/95 border-amber-500/60 shadow-amber-950/40 text-amber-100'
          : isBullish
          ? 'bg-[#121E19]/95 border-emerald-500/50 shadow-emerald-950/40 text-emerald-100'
          : 'bg-[#221516]/95 border-rose-500/50 shadow-rose-950/40 text-rose-100';

        const dotStyle = isWarn
          ? 'bg-amber-400'
          : isBullish
          ? 'bg-emerald-400'
          : 'bg-rose-400';

        const badgeLabel = isWarn
          ? (isBullish ? 'ALMOST BUY' : 'WARN SELL')
          : toast.signal || (isBullish ? 'BUY' : 'SELL');

        const badgeStyle = isWarn
          ? 'bg-amber-500 text-slate-950'
          : isBullish
          ? 'bg-emerald-500 text-slate-950'
          : 'bg-rose-500 text-slate-950';

        return (
          <div
            key={toast.id}
            id={`toast-${toast.id}`}
            className={`pointer-events-auto flex flex-col p-3.5 rounded-xl border shadow-2xl backdrop-blur-md transition-all duration-300 transform translate-y-0 opacity-100 ${cardStyle}`}
          >
            {/* Header Row */}
            <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
              <div className="flex items-center space-x-2">
                <span className={`w-2 h-2 rounded-full ${dotStyle} animate-ping`}></span>
                <span className="font-mono font-bold text-sm text-white tracking-wider">
                  {toast.ticker}
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${badgeStyle}`}>
                  {badgeLabel}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-slate-700 font-medium">
                  {pipelineName}
                </span>
              </div>

              <div className="flex items-center space-x-1">
                <span className="font-mono text-xs font-bold text-slate-200">
                  {formatCurrency(toast.triggerPrice)}
                </span>
                <button
                  onClick={() => onDismiss(toast.id)}
                  className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/10 transition-colors"
                  title="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Reason Body */}
            <div className="py-2 text-xs text-slate-300 line-clamp-2 leading-relaxed">
              {toast.reason}
            </div>

            {/* Footer Action */}
            <div className="flex items-center justify-between pt-1 text-[11px]">
              <span className="text-[10px] text-slate-400 font-mono">
                {new Date(toast.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <button
                onClick={() => {
                  onSelectTicker(toast.ticker);
                  onDismiss(toast.id);
                }}
                className={`flex items-center space-x-1 font-semibold hover:underline ${
                  isWarn ? 'text-amber-400 hover:text-amber-300' : 'text-emerald-400 hover:text-emerald-300'
                }`}
              >
                <span>Inspect Chart</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
