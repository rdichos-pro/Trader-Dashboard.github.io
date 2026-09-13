import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Database, 
  Globe, 
  HelpCircle, 
  Info, 
  Layers, 
  RefreshCw, 
  RotateCcw, 
  Server, 
  ShieldCheck, 
  Trash2, 
  X, 
  Zap 
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClearCache: () => Promise<void>;
  isResettingCache: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onClearCache,
  isResettingCache,
}) => {
  const [resetSuccess, setResetSuccess] = useState(false);

  if (!isOpen) return null;

  const handleClear = async () => {
    try {
      await onClearCache();
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 4000);
    } catch (e) {
      console.error('Failed to clear cache:', e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#11141C] border border-slate-800 rounded-xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-[#0B0E14] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">System & Data Settings</h2>
              <p className="text-xs text-slate-400">Manage data providers, cache persistence, and calculation engine</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-sm">
          {/* Data Feed & Indicator Status */}
          <div className="bg-[#161B24] border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                Active Market Data Provider
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/80">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Finnhub 4-Hour (240 / 60 Agg)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs pt-1">
              <div className="bg-[#0D1117] p-2.5 rounded border border-slate-800">
                <div className="text-slate-400">Primary Intraday Timeframe</div>
                <div className="font-mono font-bold text-slate-200 mt-0.5">4-Hour (240m) Candles</div>
              </div>
              <div className="bg-[#0D1117] p-2.5 rounded border border-slate-800">
                <div className="text-slate-400">Trend Verification Timeframe</div>
                <div className="font-mono font-bold text-slate-200 mt-0.5">Daily (1D) Candles</div>
              </div>
            </div>
          </div>

          {/* Mathematical Engine Rules */}
          <div className="bg-[#161B24] border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              Indicator Math & Displacement Verification
            </div>

            <ul className="space-y-2 text-xs text-slate-300">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Tenkan & Kijun Midpoint Math:</strong> Calculated strictly via <code className="bg-slate-900 px-1 py-0.5 rounded text-emerald-400 font-mono">(Highest High + Lowest Low) / 2</code> over 9 and 26 periods (zero moving averages).
                </div>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">26-Period Cloud Displacement:</strong> Current candle cloud boundaries (<code className="bg-slate-900 px-1 py-0.5 rounded text-emerald-400 font-mono">cloudTop</code> & <code className="bg-slate-900 px-1 py-0.5 rounded text-emerald-400 font-mono">cloudBottom</code>) strictly reference Senkou Span A and B calculated 26 periods ago.
                </div>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Chronological Sorting:</strong> All Finnhub raw arrays are verified and sorted strictly oldest-to-newest before calculating indicators.
                </div>
              </li>
            </ul>
          </div>

          {/* Clear Cache & Reset Data Section */}
          <div className="bg-rose-950/20 border border-rose-900/40 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-rose-300 flex items-center gap-1.5">
                  <Trash2 className="w-4 h-4 text-rose-400" />
                  Purge Cache & Refetch Live Data
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Wipes stored localStorage, purges server cache, and immediately fetches fresh 4-Hour Finnhub candle data.
                </p>
              </div>
            </div>

            {resetSuccess && (
              <div className="p-2.5 rounded bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                Cache cleared successfully! Refetched fresh Finnhub 4H data and recomputed indicators.
              </div>
            )}

            <div className="pt-2 flex items-center gap-3">
              <button
                id="modal-clear-cache-reset-btn"
                onClick={handleClear}
                disabled={isResettingCache}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-semibold text-xs rounded-lg flex items-center gap-2 shadow-lg transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isResettingCache ? 'animate-spin' : ''}`} />
                {isResettingCache ? 'Purging & Refetching...' : 'Clear Cache / Reset Data'}
              </button>
              <span className="text-[11px] text-slate-500">
                Safe to run anytime to resolve stale data.
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#0B0E14] border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors"
          >
            Close Settings
          </button>
        </div>
      </div>
    </div>
  );
};
