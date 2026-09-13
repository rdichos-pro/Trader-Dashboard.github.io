import React, { useMemo, useState, useEffect } from 'react';
import { 
  ArrowUpRight, 
  BarChart2, 
  Calculator,
  Check, 
  ChevronDown, 
  Columns,
  Compass, 
  ExternalLink, 
  Flame, 
  Layers, 
  Maximize2, 
  Pencil,
  Plus, 
  RefreshCw, 
  RotateCcw,
  Rows,
  Search, 
  ShieldAlert, 
  Sliders,
  Sparkles, 
  Square,
  Tag, 
  Target, 
  TrendingUp, 
  Zap 
} from 'lucide-react';
import { Candle, Position, TickerQuote } from '../types/trading';
import { formatCompactNumber, formatCurrency, formatDate, formatPercent } from '../utils/formatters';
import { usePersistedState } from '../utils/usePersistedState';
import { DEFAULT_STRATEGY_STUDIES, formatTradingViewSymbol, TradingViewWidget } from './TradingViewWidget';
import { PositionForecastDrawer } from './PositionForecastDrawer';

export interface AvailableIndicator {
  id: string;
  label: string;
  category: 'Oscillator' | 'Trend' | 'Volatility' | 'Volume' | 'MA';
  desc: string;
}

export const TECHNICAL_INDICATORS: AvailableIndicator[] = [
  { id: 'IchimokuCloud@tv-basicstudies', label: 'Ichimoku Cloud (9, 26, 52, 26)', category: 'Trend', desc: 'Tenkan, Kijun, Senkou Span A/B multi-line cloud' },
  { id: 'Stochastic@tv-basicstudies', label: 'Stochastic (14, 3, 3)', category: 'Oscillator', desc: 'Stochastic %K & %D cycle oscillator' },
  { id: 'CCI@tv-basicstudies', label: 'CCI (20)', category: 'Oscillator', desc: 'Commodity Channel Index momentum' },
  { id: 'Volume@tv-basicstudies', label: 'Volume', category: 'Volume', desc: 'Trading volume bars' },
  { id: 'RSI@tv-basicstudies', label: 'RSI (14)', category: 'Oscillator', desc: 'Relative Strength Index momentum' },
  { id: 'EMA@tv-basicstudies', label: 'EMA', category: 'MA', desc: 'Exponential Moving Average' },
  { id: 'MASimple@tv-basicstudies', label: 'SMA', category: 'MA', desc: 'Simple Moving Average' },
  { id: 'MACD@tv-basicstudies', label: 'MACD', category: 'Oscillator', desc: 'Moving Average Convergence Divergence' },
  { id: 'BB@tv-basicstudies', label: 'Bollinger Bands', category: 'Volatility', desc: 'Volatility bands (20, 2)' },
  { id: 'VWAP@tv-basicstudies', label: 'VWAP', category: 'Volume', desc: 'Volume Weighted Average Price' },
  { id: 'Supertrend@tv-basicstudies', label: 'Supertrend', category: 'Trend', desc: 'ATR trend direction system' },
  { id: 'StochasticRSI@tv-basicstudies', label: 'Stoch RSI', category: 'Oscillator', desc: 'Stochastic oscillator on RSI' },
  { id: 'ATR@tv-basicstudies', label: 'ATR', category: 'Volatility', desc: 'Average True Range stop distance' },
  { id: 'ParabolicSAR@tv-basicstudies', label: 'Parabolic SAR', category: 'Trend', desc: 'Stop and Reverse trailing points' },
];

export const INDICATOR_PRESETS = [
  { name: 'Ichimoku + Momentum Strategy (Active)', studies: ['Volume@tv-basicstudies', 'IchimokuCloud@tv-basicstudies', 'Stochastic@tv-basicstudies', 'CCI@tv-basicstudies'] },
  { name: 'Standard (RSI + EMA + Vol)', studies: ['Volume@tv-basicstudies', 'RSI@tv-basicstudies', 'EMA@tv-basicstudies'] },
  { name: 'Trend Master (EMA + SMA + Supertrend)', studies: ['Volume@tv-basicstudies', 'EMA@tv-basicstudies', 'MASimple@tv-basicstudies', 'Supertrend@tv-basicstudies'] },
  { name: 'Momentum Scalp (VWAP + MACD + RSI)', studies: ['Volume@tv-basicstudies', 'VWAP@tv-basicstudies', 'MACD@tv-basicstudies', 'RSI@tv-basicstudies'] },
  { name: 'Volatility Channel (BB + ATR + EMA)', studies: ['Volume@tv-basicstudies', 'BB@tv-basicstudies', 'ATR@tv-basicstudies', 'EMA@tv-basicstudies'] },
  { name: 'Pure Price Action (Volume Only)', studies: ['Volume@tv-basicstudies'] },
];

interface ChartStudioTabProps {
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  universe: TickerQuote[];
  candles?: Candle[];
  isLoadingCandles?: boolean;
  onRefreshCandles?: () => void;
  userPosition?: Position;
  onOpenNewPositionWithTicker: (symbol: string, currentPrice: number) => void;
  watchlistSymbols?: string[];
  openPositions?: Position[];
}

export const ChartStudioTab: React.FC<ChartStudioTabProps> = ({
  selectedSymbol,
  onSelectSymbol,
  universe,
  candles = [],
  isLoadingCandles = false,
  onRefreshCandles,
  userPosition,
  onOpenNewPositionWithTicker,
  watchlistSymbols = [],
  openPositions = [],
}) => {
  const [activeInterval, setActiveInterval] = useState<string>('240'); // Default to '240' (4 Hours)
  const [chartHeight, setChartHeight] = useState<string>('calc(100vh - 195px)'); // Occupy full tab height by default
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showIndicatorModal, setShowIndicatorModal] = useState(false);

  // Multi-chart split layout options: single, 2-split vertical (top/bottom), 2-split horizontal (side-by-side)
  const [chartLayout, setChartLayout] = usePersistedState<'single' | 'split-vertical' | 'split-horizontal'>(
    'chart_studio_layout',
    'single'
  );
  const [secondSymbol, setSecondSymbol] = usePersistedState<string>('chart_studio_symbol_2', 'SPY');
  const [secondInterval, setSecondInterval] = usePersistedState<string>('chart_studio_interval_2', '15');
  const [showDrawingTools, setShowDrawingTools] = usePersistedState<boolean>('chart_show_drawing_tools', true);
  const [showForecastTool, setShowForecastTool] = useState<boolean>(false);

  // Active Pane Target for ticker selection: 1 (Top/Left) or 2 (Bottom/Right)
  const [activePane, setActivePane] = useState<1 | 2>(1);
  // When Link Both Panes is enabled, selecting a ticker updates both Pane 1 and Pane 2 simultaneously
  const [linkPanes, setLinkPanes] = usePersistedState<boolean>('chart_studio_link_panes', false);

  // Persistent strategy indicator settings across all stocks and sessions
  const [defaultStudies, setDefaultStudies] = usePersistedState<string[]>('tv_default_studies', DEFAULT_STRATEGY_STUDIES);

  // Auto-migrate legacy CCI study ID from stored local state if present
  useEffect(() => {
    if (Array.isArray(defaultStudies) && defaultStudies.includes('CommodityChannelIndex@tv-basicstudies')) {
      setDefaultStudies(prev => prev.map(id => id === 'CommodityChannelIndex@tv-basicstudies' ? 'CCI@tv-basicstudies' : id));
    }
  }, [defaultStudies, setDefaultStudies]);

  const toggleStudy = (studyId: string) => {
    setDefaultStudies(prev => {
      const current = Array.isArray(prev) ? prev : [];
      if (current.includes(studyId)) {
        return current.filter(id => id !== studyId);
      } else {
        return [...current, studyId];
      }
    });
  };

  const applyPreset = (presetStudies: string[]) => {
    setDefaultStudies(presetStudies);
  };

  const resetToDefault = () => {
    setDefaultStudies(DEFAULT_STRATEGY_STUDIES);
  };

  // Quick lookup for quote stats
  const safeSelectedSymbol = selectedSymbol || 'NVDA';
  const quote = universe.find(u => u?.symbol && u.symbol.toUpperCase() === safeSelectedSymbol.toUpperCase()) || {
    symbol: safeSelectedSymbol,
    name: `${safeSelectedSymbol} Asset`,
    price: 100,
    change: 0,
    changePercent: 0,
    open: 100,
    high: 100,
    low: 100,
    previousClose: 100,
    volume: 1000000,
    avgVolume30D: 1000000,
    rvol: 1.0,
    marketCap: 1000000000,
    marketCapCategory: 'LARGE' as const,
    high52W: 120,
    low52W: 80,
    sector: 'Technology',
    sparkline: [98, 100],
    lastUpdated: new Date().toISOString(),
  };

  // Search filtered symbols from universe
  const filteredSymbols = useMemo(() => {
    if (!searchQuery.trim()) return universe.slice(0, 10);
    const q = searchQuery.toUpperCase().trim();
    return universe.filter(u => 
      (u?.symbol && u.symbol.toUpperCase().includes(q)) || 
      (u?.name && u.name.toUpperCase().includes(q))
    ).slice(0, 10);
  }, [universe, searchQuery]);

  const handleSelectTicker = (sym: string, forceTarget?: 1 | 2) => {
    if (!sym) return;
    const cleanSym = sym.toUpperCase().trim();
    
    if (chartLayout !== 'single' && linkPanes && !forceTarget) {
      // Linked mode: update both panes to this symbol simultaneously
      onSelectSymbol(cleanSym);
      setSecondSymbol(cleanSym);
    } else if (forceTarget === 2 || (chartLayout !== 'single' && activePane === 2 && !forceTarget)) {
      // Update Pane 2
      setSecondSymbol(cleanSym);
    } else {
      // Update Pane 1
      onSelectSymbol(cleanSym);
    }

    setSearchQuery('');
    setIsSearchFocused(false);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      handleSelectTicker(searchQuery.trim());
    }
  };

  const formattedTvSymbol = formatTradingViewSymbol(safeSelectedSymbol);

  // Second chart lookup for 2-split layout
  const safeSecondSymbol = secondSymbol || 'SPY';
  const secondQuote = universe.find(u => u?.symbol && u.symbol.toUpperCase() === safeSecondSymbol.toUpperCase()) || {
    symbol: safeSecondSymbol,
    name: `${safeSecondSymbol} Asset`,
    price: 100,
    change: 0,
    changePercent: 0,
  };
  const formattedSecondTvSymbol = formatTradingViewSymbol(safeSecondSymbol);

  // Timeframe presets for quick switching
  const intervals = [
    { label: '1m', value: '1', desc: '1 Minute' },
    { label: '5m', value: '5', desc: '5 Minutes' },
    { label: '15m', value: '15', desc: '15 Minutes' },
    { label: '1H', value: '60', desc: '1 Hour' },
    { label: '4H', value: '240', desc: '4 Hours (Swing)' },
    { label: '1D', value: 'D', desc: '1 Day (Standard)' },
    { label: '1W', value: 'W', desc: '1 Week (Macro)' },
  ];

  // Latest calculated indicators from candle data (for info badge)
  const latestCandle = candles && candles.length > 0 ? candles[candles.length - 1] : undefined;

  return (
    <div className="space-y-4">
      {/* Top Controls & Navigation Bar */}
      <div className="bg-[#161B22] p-4 rounded-xl border border-slate-800 shadow-lg space-y-3">
        {/* Row 1: Search Bar, Dropdown, Live Quote & Action */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          {/* Left: Interactive Search & Symbol Dropdown */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Dynamic Search Autocomplete Input */}
            <div className="relative min-w-[240px] sm:min-w-[280px]">
              <form onSubmit={handleSearchSubmit} className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search ticker (e.g. NVDA, AAPL, XAUUSD)..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                  className="w-full bg-[#0B0E14] border border-slate-700 text-white text-xs rounded-lg pl-9 pr-8 py-2 focus:border-emerald-500 focus:outline-none placeholder-slate-500 font-mono"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                  >
                    ×
                  </button>
                )}
              </form>

              {/* Autocomplete Dropdown */}
              {isSearchFocused && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#0D1117] border border-slate-700 rounded-lg shadow-2xl z-50 max-h-64 overflow-y-auto divide-y divide-slate-800">
                  {filteredSymbols.map(s => (
                    <button
                      key={s.symbol}
                      onMouseDown={() => handleSelectTicker(s.symbol)}
                      className="w-full px-3 py-2 text-left hover:bg-slate-800/80 flex items-center justify-between text-xs transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-white text-sm">{s.symbol}</span>
                        <span className="text-slate-400 text-[11px] truncate max-w-[140px]">{s.name}</span>
                      </div>
                      <span className="font-mono font-semibold text-slate-300">
                        {formatCurrency(s.price)}
                      </span>
                    </button>
                  ))}
                  {searchQuery && !filteredSymbols.some(s => s.symbol.toUpperCase() === searchQuery.toUpperCase()) && (
                    <button
                      onMouseDown={() => handleSelectTicker(searchQuery)}
                      className="w-full px-3 py-2 text-left hover:bg-emerald-950/40 text-emerald-400 font-semibold text-xs flex items-center justify-between"
                    >
                      <span>Load custom symbol <strong>"{searchQuery.toUpperCase()}"</strong></span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Quick Universe Select Dropdown */}
            <div className="relative">
              <select
                value={activePane === 2 && !linkPanes ? secondSymbol : selectedSymbol}
                onChange={e => handleSelectTicker(e.target.value)}
                className="bg-[#0B0E14] border border-slate-700 text-white font-mono font-bold text-sm rounded-lg px-3 py-1.5 focus:border-emerald-500 focus:outline-none cursor-pointer"
                title={`Selecting will update ${linkPanes ? 'Both Panes' : activePane === 2 ? 'Pane 2' : 'Pane 1'}`}
              >
                {universe.map(u => (
                  <option key={u.symbol} value={u.symbol}>
                    {u.symbol} - {u.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Live Price & Day Change */}
            <div className="flex items-center space-x-2.5 font-mono">
              <span className="text-xl font-extrabold text-white">
                {formatCurrency(quote.price)}
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
                quote.change >= 0 
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' 
                  : 'bg-rose-950 text-rose-300 border border-rose-800'
              }`}>
                {quote.change >= 0 ? '+' : ''}{formatCurrency(quote.change)} ({formatPercent(quote.changePercent)})
              </span>
            </div>

            {/* TradingView Formatted Symbol Badge */}
            <div className="hidden md:flex items-center gap-1.5 px-2 py-1 bg-[#0B0E14] border border-slate-800 rounded text-[11px] font-mono text-slate-400">
              <span className="text-slate-500">TV ID:</span>
              <span className="text-emerald-400 font-semibold">{formattedTvSymbol}</span>
            </div>
          </div>

          {/* Right: Layout Switcher, Target Switcher, Timeframe, Height, Forecast, Drawing Tools & Action */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Multi-Chart Layout Setup Controls: Single vs 2 Split Vertical vs 2 Split Columns */}
            <div className="bg-[#0B0E14] p-1 rounded-lg border border-slate-800 flex items-center text-xs font-mono">
              <span className="text-slate-500 px-2 text-[11px] hidden sm:inline">Layout:</span>
              <button
                onClick={() => setChartLayout('single')}
                title="Single Full View"
                className={`px-2 py-1 rounded font-medium text-[11px] transition-colors flex items-center gap-1 ${
                  chartLayout === 'single' 
                    ? 'bg-emerald-600 text-white font-bold shadow' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Square className="w-3 h-3" />
                <span>1x Single</span>
              </button>
              <button
                onClick={() => setChartLayout('split-vertical')}
                title="2-Split Vertical Layout (Stacked Top & Bottom)"
                className={`px-2.5 py-1 rounded font-medium text-[11px] transition-colors flex items-center gap-1 ${
                  chartLayout === 'split-vertical' 
                    ? 'bg-emerald-600 text-white font-bold shadow' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Rows className="w-3 h-3" />
                <span>2 Split Vertical</span>
              </button>
              <button
                onClick={() => setChartLayout('split-horizontal')}
                title="2-Split Columns Layout (Side-by-Side)"
                className={`px-2 py-1 rounded font-medium text-[11px] transition-colors flex items-center gap-1 hidden sm:flex ${
                  chartLayout === 'split-horizontal' 
                    ? 'bg-emerald-600 text-white font-bold shadow' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Columns className="w-3 h-3" />
                <span>2 Split Columns</span>
              </button>
            </div>

            {/* Split Mode Target Selector: Controls which pane updates when clicking a chart or ticker */}
            {chartLayout !== 'single' && (
              <div className="bg-[#0B0E14] p-1 rounded-lg border border-slate-800 flex items-center text-xs font-mono">
                <span className="text-slate-500 px-1.5 text-[10px] uppercase font-bold">Target:</span>
                <button
                  onClick={() => { setActivePane(1); setLinkPanes(false); }}
                  title="Clicking any chart/ticker updates Pane 1"
                  className={`px-2 py-1 rounded text-[11px] font-bold transition-all flex items-center gap-1 ${
                    activePane === 1 && !linkPanes
                      ? 'bg-emerald-600 text-white shadow ring-1 ring-emerald-400 font-black'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Pane 1 ({safeSelectedSymbol})</span>
                </button>
                <button
                  onClick={() => { setActivePane(2); setLinkPanes(false); }}
                  title="Clicking any chart/ticker updates Pane 2"
                  className={`px-2 py-1 rounded text-[11px] font-bold transition-all flex items-center gap-1 ${
                    activePane === 2 && !linkPanes
                      ? 'bg-cyan-600 text-white shadow ring-1 ring-cyan-400 font-black'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  <span>Pane 2 ({safeSecondSymbol})</span>
                </button>
                <button
                  onClick={() => setLinkPanes(!linkPanes)}
                  title="Link both panes: selecting any ticker updates both Pane 1 and Pane 2 simultaneously"
                  className={`px-2 py-1 rounded text-[11px] font-bold transition-all flex items-center gap-1 ${
                    linkPanes
                      ? 'bg-amber-500 text-slate-950 font-black shadow ring-1 ring-amber-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>🔗 Link Both ({linkPanes ? 'ON' : 'OFF'})</span>
                </button>
              </div>
            )}

            {/* Timeframe Presets */}
            <div className="bg-[#0B0E14] p-1 rounded-lg border border-slate-800 flex items-center text-xs font-mono">
              <span className="text-slate-500 px-1.5 text-[10px] hidden md:inline">
                {chartLayout !== 'single' ? 'TF 1:' : ''}
              </span>
              {intervals.map(int => (
                <button
                  key={int.value}
                  onClick={() => setActiveInterval(int.value)}
                  title={int.desc}
                  className={`px-2 py-1 rounded font-medium transition-colors ${
                    activeInterval === int.value 
                      ? 'bg-emerald-600 text-white font-bold shadow' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {int.label}
                </button>
              ))}
            </div>

            {/* Long & Short Position Forecast Tool Toggle */}
            <button
              onClick={() => setShowForecastTool(!showForecastTool)}
              title="Open Long & Short Position Forecast Planner and Risk/Reward Box"
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow ${
                showForecastTool
                  ? 'bg-cyan-500 text-slate-950 ring-2 ring-cyan-300 font-black'
                  : 'bg-slate-800 text-cyan-300 border border-cyan-500/40 hover:bg-slate-700'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              <span>Forecast Tool</span>
            </button>

            {/* Native TradingView Drawing Tools Toolbar Toggle */}
            <button
              onClick={() => setShowDrawingTools(!showDrawingTools)}
              title="Toggle TradingView's left drawing toolbar (includes native Long Position and Short Position tools, Fibonacci, Trendlines)"
              className={`px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors flex items-center gap-1.5 ${
                showDrawingTools
                  ? 'bg-amber-950/80 border border-amber-500/60 text-amber-300 font-bold'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Drawing Bar: {showDrawingTools ? 'ON' : 'OFF'}</span>
            </button>

            {/* Chart Height / Canvas Size Controls (when in single view) */}
            {chartLayout === 'single' && (
              <div className="hidden lg:flex bg-[#0B0E14] p-1 rounded-lg border border-slate-800 items-center text-xs font-mono">
                <span className="text-slate-500 px-2 text-[11px]">Height:</span>
                {[
                  { label: 'Fit Tab', value: 'calc(100vh - 195px)' },
                  { label: '900px', value: '900px' },
                  { label: '1200px', value: '1200px' },
                ].map(h => (
                  <button
                    key={h.value}
                    onClick={() => setChartHeight(h.value)}
                    title={`Set chart canvas height to ${h.label}`}
                    className={`px-2.5 py-1 rounded font-medium text-[11px] transition-colors ${
                      chartHeight === h.value 
                        ? 'bg-slate-700 text-emerald-300 font-bold border border-emerald-500/40 shadow-sm' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
            )}

            {/* Log Position / Trade Button */}
            <button
              onClick={() => onOpenNewPositionWithTicker(selectedSymbol, quote.price)}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-md"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Position</span>
            </button>
          </div>
        </div>

        {/* Row 2: Quick-Switch Ticker Chips (Open Positions & Watchlist) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px] mr-1">Quick Select:</span>
            
            {/* Open Positions Chips */}
            {openPositions && openPositions.length > 0 && (
              <>
                {openPositions
                  .filter(pos => Boolean(pos && (pos.ticker || (pos as any).symbol)))
                  .map(pos => {
                    const posTicker = (pos.ticker || (pos as any).symbol || '').toUpperCase();
                    const isSelected = posTicker === (activePane === 2 && !linkPanes ? safeSecondSymbol.toUpperCase() : safeSelectedSymbol.toUpperCase());
                    const isGain = (pos.unrealizedPnlDollars || 0) >= 0;
                    return (
                      <button
                        key={pos.id}
                        onClick={() => handleSelectTicker(posTicker)}
                        title={`Load ${posTicker} into ${linkPanes ? 'Both Panes' : activePane === 2 ? 'Pane 2' : 'Pane 1'}`}
                        className={`px-2 py-1 rounded border text-[11px] font-mono flex items-center space-x-1.5 transition-all ${
                          isSelected
                            ? 'bg-cyan-950/90 border-cyan-400 text-cyan-200 font-bold shadow'
                            : 'bg-[#0B0E14] border-slate-700/80 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                        <span>{posTicker}</span>
                        <span className={isGain ? 'text-emerald-400' : 'text-rose-400'}>
                          {isGain ? '+' : ''}{formatPercent(pos.unrealizedPnlPercent || 0)}
                        </span>
                      </button>
                    );
                  })}
                <span className="text-slate-600 px-1">|</span>
              </>
            )}

            {/* Watchlist Chips */}
            {watchlistSymbols && watchlistSymbols
              .filter(sym => typeof sym === 'string' && sym.trim().length > 0)
              .slice(0, 8)
              .map(sym => {
                const cleanSym = sym.toUpperCase().trim();
                const isSelected = cleanSym === (activePane === 2 && !linkPanes ? safeSecondSymbol.toUpperCase() : safeSelectedSymbol.toUpperCase());
                return (
                  <button
                    key={cleanSym}
                    onClick={() => handleSelectTicker(cleanSym)}
                    title={`Load ${cleanSym} into ${linkPanes ? 'Both Panes' : activePane === 2 ? 'Pane 2' : 'Pane 1'}`}
                    className={`px-2 py-0.5 rounded border text-[11px] font-mono transition-all ${
                      isSelected
                        ? 'bg-emerald-950/90 border-emerald-500 text-emerald-200 font-bold shadow'
                        : 'bg-[#0B0E14] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    {cleanSym}
                  </button>
                );
              })}

            {/* Popular Gold / Forex Chip */}
            <button
              onClick={() => handleSelectTicker('XAUUSD')}
              title={`Load XAUUSD into ${linkPanes ? 'Both Panes' : activePane === 2 ? 'Pane 2' : 'Pane 1'}`}
              className={`px-2 py-0.5 rounded border text-[11px] font-mono transition-all ${
                (activePane === 2 && !linkPanes ? safeSecondSymbol.toUpperCase() : safeSelectedSymbol.toUpperCase()) === 'XAUUSD'
                  ? 'bg-amber-950/90 border-amber-500 text-amber-200 font-bold'
                  : 'bg-[#0B0E14] border-slate-800 text-amber-400 hover:border-amber-700'
              }`}
            >
              ★ XAUUSD (Gold)
            </button>
          </div>

          {/* User Open Position Banner if active */}
          {userPosition && (
            <div className="flex items-center gap-2 px-2.5 py-1 bg-[#0B0E14] border border-emerald-800/80 rounded-lg text-[11px] font-mono text-slate-300">
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <Target className="w-3 h-3" /> ACTIVE POSITION:
              </span>
              <span>Entry <strong className="text-white">{formatCurrency(userPosition.entryPrice)}</strong></span>
              <span className="text-rose-400">Stop {formatCurrency(userPosition.stopLossPrice)} (-{userPosition.stopLossPct}%)</span>
              <span className="text-emerald-400">Target {formatCurrency(userPosition.takeProfitPrice)} (+{userPosition.takeProfitPct}%)</span>
            </div>
          )}
        </div>

        {/* Row 3: Global Default Indicators Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-emerald-400 font-semibold uppercase tracking-wider text-[10px] mr-1 flex items-center gap-1">
              <Sliders className="w-3 h-3 text-emerald-400" /> Default Indicators:
            </span>

            {/* Quick Toggle Pills for Popular Indicators */}
            {TECHNICAL_INDICATORS.slice(0, 8).map(ind => {
              const isActive = defaultStudies.includes(ind.id);
              return (
                <button
                  key={ind.id}
                  onClick={() => toggleStudy(ind.id)}
                  title={`${isActive ? 'Remove' : 'Add'} ${ind.label} (${ind.desc})`}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono transition-all flex items-center gap-1 ${
                    isActive
                      ? 'bg-emerald-950/90 border border-emerald-500 text-emerald-200 font-bold shadow-sm'
                      : 'bg-[#0B0E14] border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-slate-600'}`}></span>
                  <span>{ind.label}</span>
                </button>
              );
            })}

            {/* Indicator Presets & Catalog Modal Trigger */}
            <button
              onClick={() => setShowIndicatorModal(true)}
              className="px-2.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono text-[11px] rounded border border-cyan-500/30 flex items-center gap-1 transition-colors"
            >
              <span>+ More / Presets ({defaultStudies.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2 font-mono text-[10px] text-slate-400">
            <span className="text-emerald-400/90 flex items-center gap-1">
              <Check className="w-3 h-3 text-emerald-400" /> Defaults auto-apply to all stocks
            </span>
            <button
              onClick={resetToDefault}
              title="Reset default indicators to Volume + RSI + EMA"
              className="text-slate-500 hover:text-slate-300 underline text-[10px] flex items-center gap-0.5"
            >
              <RotateCcw className="w-2.5 h-2.5" /> Reset
            </button>
          </div>
        </div>
      </div>

      {/* Position Forecast Drawer (Long & Short Risk/Reward Calculator & Drawing Tool) */}
      {showForecastTool && (
        <PositionForecastDrawer
          symbol={selectedSymbol}
          currentPrice={quote.price}
          isGold={safeSelectedSymbol.toUpperCase() === 'XAUUSD'}
          defaultStopLoss={userPosition?.stopLossPrice}
          defaultTarget1={userPosition?.takeProfitPrice}
          externalTrade={userPosition ? {
            direction: userPosition.type,
            entryPrice: userPosition.entryPrice,
            stopLossPrice: userPosition.stopLossPrice,
            targetPrice: userPosition.takeProfitPrice,
            quantity: userPosition.quantity,
            isRunning: true,
          } : null}
          onExecuteTrade={(trade) => {
            onOpenNewPositionWithTicker(trade.symbol, trade.entryPrice);
          }}
          onClose={() => setShowForecastTool(false)}
        />
      )}

      {/* Main Interactive TradingView Advanced Chart Canvas Layouts */}
      {chartLayout === 'single' && (
        <div className="w-full relative">
          <TradingViewWidget
            symbol={selectedSymbol}
            interval={activeInterval}
            theme="dark"
            hideSideToolbar={!showDrawingTools} // Uses Drawing Bar state so users can use native Long/Short position tool
            hideTopToolbar={false}
            containerHeight={chartHeight}
            studies={defaultStudies}
          />
        </div>
      )}

      {/* 2-Split Vertical Layout: Stacked Top & Bottom */}
      {chartLayout === 'split-vertical' && (
        <div className="w-full space-y-4">
          {/* Top Chart Pane */}
          <div 
            onClick={() => setActivePane(1)}
            className={`bg-[#161B22] border rounded-xl overflow-hidden shadow-xl transition-all cursor-pointer ${
              activePane === 1 && !linkPanes 
                ? 'border-emerald-500/80 ring-2 ring-emerald-500/30' 
                : 'border-slate-800'
            }`}
          >
            <div className="p-2.5 bg-[#0D1117] border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); setActivePane(1); setLinkPanes(false); }}
                  className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold border transition-all ${
                    activePane === 1 && !linkPanes
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow'
                      : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                  }`}
                  title="Click to direct all chart and quick-ticker clicks into Top Pane (1)"
                >
                  TOP PANE (1) {activePane === 1 && !linkPanes ? '● ACTIVE' : '○ TARGET'}
                </button>
                <span className="font-mono font-black text-white text-sm">{safeSelectedSymbol}</span>
                <span className="font-mono text-xs text-slate-300 font-semibold">${quote.price.toFixed(2)}</span>
                <span className={`font-mono text-[11px] font-bold ${quote.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {quote.change >= 0 ? '+' : ''}{quote.changePercent.toFixed(2)}%
                </span>
              </div>

              {/* Timeframe for Top Pane */}
              <div className="flex items-center gap-1 bg-[#0B0E14] p-1 rounded border border-slate-800 font-mono text-xs">
                <span className="text-slate-500 text-[10px] px-1">TF:</span>
                {intervals.map(int => (
                  <button
                    key={int.value}
                    onClick={(e) => { e.stopPropagation(); setActiveInterval(int.value); }}
                    className={`px-2 py-0.5 rounded text-[11px] ${
                      activeInterval === int.value 
                        ? 'bg-emerald-600 text-white font-bold' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {int.label}
                  </button>
                ))}
              </div>
            </div>
            <TradingViewWidget
              key={`tv_vsplit_top_${selectedSymbol}_${activeInterval}`}
              containerId="tv_chart_studio_pane_top"
              symbol={selectedSymbol}
              interval={activeInterval}
              theme="dark"
              hideSideToolbar={!showDrawingTools}
              hideTopToolbar={false}
              containerHeight="520px"
              studies={defaultStudies}
            />
          </div>

          {/* Bottom Chart Pane */}
          <div 
            onClick={() => setActivePane(2)}
            className={`bg-[#161B22] border rounded-xl overflow-hidden shadow-xl transition-all cursor-pointer ${
              activePane === 2 && !linkPanes 
                ? 'border-cyan-500/80 ring-2 ring-cyan-500/30' 
                : 'border-slate-800'
            }`}
          >
            <div className="p-2.5 bg-[#0D1117] border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); setActivePane(2); setLinkPanes(false); }}
                  className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold border transition-all ${
                    activePane === 2 && !linkPanes
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-black shadow'
                      : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/20'
                  }`}
                  title="Click to direct all chart and quick-ticker clicks into Bottom Pane (2)"
                >
                  BOTTOM PANE (2) {activePane === 2 && !linkPanes ? '● ACTIVE' : '○ TARGET'}
                </button>

                {/* Symbol Selector for Pane 2 */}
                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <span className="text-slate-400 text-xs font-mono">Symbol:</span>
                  <input
                    type="text"
                    value={secondSymbol}
                    onChange={e => setSecondSymbol(e.target.value.toUpperCase())}
                    className="w-20 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-white font-mono text-xs font-bold uppercase focus:outline-none focus:border-cyan-400"
                  />
                  <span className="font-mono text-xs text-slate-300 font-semibold">${secondQuote.price.toFixed(2)}</span>
                  
                  {/* Quick Sync & Popular switchers */}
                  <button
                    onClick={() => setSecondSymbol(selectedSymbol)}
                    title="Sync with Pane 1 symbol to compare multiple timeframes"
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono text-[10px] border border-slate-700"
                  >
                    Sync {safeSelectedSymbol}
                  </button>
                  {['SPY', 'QQQ', 'NVDA', 'XAUUSD'].map(s => (
                    <button
                      key={s}
                      onClick={() => setSecondSymbol(s)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                        secondSymbol === s 
                          ? 'bg-cyan-950 border-cyan-500 text-cyan-200 font-bold' 
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Timeframe for Bottom Pane */}
              <div className="flex items-center gap-1 bg-[#0B0E14] p-1 rounded border border-slate-800 font-mono text-xs" onClick={(e) => e.stopPropagation()}>
                <span className="text-slate-500 text-[10px] px-1">TF:</span>
                {intervals.map(int => (
                  <button
                    key={int.value}
                    onClick={() => setSecondInterval(int.value)}
                    className={`px-2 py-0.5 rounded text-[11px] ${
                      secondInterval === int.value 
                        ? 'bg-cyan-600 text-white font-bold' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {int.label}
                  </button>
                ))}
              </div>
            </div>
            <TradingViewWidget
              key={`tv_vsplit_bottom_${secondSymbol}_${secondInterval}`}
              containerId="tv_chart_studio_pane_bottom"
              symbol={secondSymbol}
              interval={secondInterval}
              theme="dark"
              hideSideToolbar={!showDrawingTools}
              hideTopToolbar={false}
              containerHeight="520px"
              studies={defaultStudies}
            />
          </div>
        </div>
      )}

      {/* 2-Split Columns Layout: Side-by-Side */}
      {chartLayout === 'split-horizontal' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 w-full">
          {/* Left Column Pane */}
          <div 
            onClick={() => setActivePane(1)}
            className={`bg-[#161B22] border rounded-xl overflow-hidden shadow-xl transition-all cursor-pointer ${
              activePane === 1 && !linkPanes 
                ? 'border-emerald-500/80 ring-2 ring-emerald-500/30' 
                : 'border-slate-800'
            }`}
          >
            <div className="p-2.5 bg-[#0D1117] border-b border-slate-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); setActivePane(1); setLinkPanes(false); }}
                  className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold border transition-all ${
                    activePane === 1 && !linkPanes
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow'
                      : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                  }`}
                >
                  PANE 1 {activePane === 1 && !linkPanes ? '● ACTIVE' : '○ TARGET'}
                </button>
                <span className="font-mono font-black text-white text-sm">{safeSelectedSymbol}</span>
                <span className="font-mono text-xs text-slate-300 font-semibold">${quote.price.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-1 bg-[#0B0E14] p-1 rounded border border-slate-800 font-mono text-xs" onClick={(e) => e.stopPropagation()}>
                {intervals.map(int => (
                  <button
                    key={int.value}
                    onClick={() => setActiveInterval(int.value)}
                    className={`px-1.5 py-0.5 rounded text-[10px] ${
                      activeInterval === int.value 
                        ? 'bg-emerald-600 text-white font-bold' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {int.label}
                  </button>
                ))}
              </div>
            </div>
            <TradingViewWidget
              key={`tv_hsplit_left_${selectedSymbol}_${activeInterval}`}
              containerId="tv_chart_studio_pane_left"
              symbol={selectedSymbol}
              interval={activeInterval}
              theme="dark"
              hideSideToolbar={!showDrawingTools}
              hideTopToolbar={false}
              containerHeight="680px"
              studies={defaultStudies}
            />
          </div>

          {/* Right Column Pane */}
          <div 
            onClick={() => setActivePane(2)}
            className={`bg-[#161B22] border rounded-xl overflow-hidden shadow-xl transition-all cursor-pointer ${
              activePane === 2 && !linkPanes 
                ? 'border-cyan-500/80 ring-2 ring-cyan-500/30' 
                : 'border-slate-800'
            }`}
          >
            <div className="p-2.5 bg-[#0D1117] border-b border-slate-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => { setActivePane(2); setLinkPanes(false); }}
                  className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold border transition-all ${
                    activePane === 2 && !linkPanes
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-black shadow'
                      : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/20'
                  }`}
                >
                  PANE 2 {activePane === 2 && !linkPanes ? '● ACTIVE' : '○ TARGET'}
                </button>
                <input
                  type="text"
                  value={secondSymbol}
                  onChange={e => setSecondSymbol(e.target.value.toUpperCase())}
                  className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-white font-mono text-xs font-bold uppercase focus:outline-none focus:border-cyan-400"
                />
                <button
                  onClick={() => setSecondSymbol(selectedSymbol)}
                  className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono text-[10px]"
                >
                  Sync
                </button>
              </div>
              <div className="flex items-center gap-1 bg-[#0B0E14] p-1 rounded border border-slate-800 font-mono text-xs" onClick={(e) => e.stopPropagation()}>
                {intervals.map(int => (
                  <button
                    key={int.value}
                    onClick={() => setSecondInterval(int.value)}
                    className={`px-1.5 py-0.5 rounded text-[10px] ${
                      secondInterval === int.value 
                        ? 'bg-cyan-600 text-white font-bold' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {int.label}
                  </button>
                ))}
              </div>
            </div>
            <TradingViewWidget
              key={`tv_hsplit_right_${secondSymbol}_${secondInterval}`}
              containerId="tv_chart_studio_pane_right"
              symbol={secondSymbol}
              interval={secondInterval}
              theme="dark"
              hideSideToolbar={!showDrawingTools}
              hideTopToolbar={false}
              containerHeight="680px"
              studies={defaultStudies}
            />
          </div>
        </div>
      )}

      {/* Indicator Presets & Full Catalog Modal */}
      {showIndicatorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#161B22] border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-white font-bold text-sm">Default Technical Indicators</h3>
                  <p className="text-slate-400 text-xs">These indicators will automatically load on every stock you select.</p>
                </div>
              </div>
              <button
                onClick={() => setShowIndicatorModal(false)}
                className="text-slate-400 hover:text-white text-base p-1 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Presets */}
              <div>
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Strategy Presets</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {INDICATOR_PRESETS.map(preset => (
                    <button
                      key={preset.name}
                      onClick={() => applyPreset(preset.studies)}
                      className="text-left p-2.5 rounded-lg bg-[#0B0E14] border border-slate-800 hover:border-emerald-500 hover:bg-emerald-950/20 transition-all text-xs group"
                    >
                      <div className="text-white font-semibold group-hover:text-emerald-300">{preset.name}</div>
                      <div className="text-slate-500 text-[10px] font-mono mt-0.5 truncate">
                        {preset.studies.map(s => s.replace('@tv-basicstudies', '')).join(', ')}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Complete Indicators List */}
              <div>
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  All Indicators ({TECHNICAL_INDICATORS.length})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {TECHNICAL_INDICATORS.map(ind => {
                    const isSelected = defaultStudies.includes(ind.id);
                    return (
                      <div
                        key={ind.id}
                        onClick={() => toggleStudy(ind.id)}
                        className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-start justify-between ${
                          isSelected
                            ? 'bg-emerald-950/40 border-emerald-500/80 text-emerald-200'
                            : 'bg-[#0B0E14] border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-xs flex items-center gap-1.5">
                            <span className="text-white">{ind.label}</span>
                            <span className="text-[9px] px-1.5 py-0.2 bg-slate-800 text-slate-400 rounded">
                              {ind.category}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">{ind.desc}</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="mt-1 rounded accent-emerald-500 cursor-pointer"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-[#0B0E14] flex items-center justify-between">
              <span className="text-xs font-mono text-emerald-400">
                {defaultStudies.length} default indicator{defaultStudies.length === 1 ? '' : 's'} active
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={resetToDefault}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white font-medium"
                >
                  Reset Defaults
                </button>
                <button
                  onClick={() => setShowIndicatorModal(false)}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chart Footer with MT5-Style Indicator Instructions & Finnhub Math Confirmation */}
      <div className="bg-[#161B22] p-3.5 rounded-xl border border-slate-800 text-xs text-slate-400 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>
            <strong>TradingView Advanced UI:</strong> Click the <strong className="text-white">"Indicators"</strong> or <strong className="text-white">"fx"</strong> icon on the chart's top toolbar to add RSI, Bollinger Bands, Moving Averages, MACD, or any MT5-style indicator.
          </span>
        </div>

        {latestCandle && (
          <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] bg-[#0B0E14] px-2.5 py-1 rounded-lg border border-slate-800 text-slate-300">
            <span className="text-slate-500">Pipeline Math:</span>
            {latestCandle.rsi14 && <span>RSI-14: <strong className={latestCandle.rsi14 <= 32 ? 'text-emerald-400' : 'text-slate-200'}>{latestCandle.rsi14.toFixed(1)}</strong></span>}
            {latestCandle.ema20 && <span>EMA-20: <strong className="text-amber-400">{formatCurrency(latestCandle.ema20)}</strong></span>}
            {latestCandle.sma50 && <span>SMA-50: <strong className="text-indigo-400">{formatCurrency(latestCandle.sma50)}</strong></span>}
            {latestCandle.highestHigh20 && <span>20-High: <strong className="text-cyan-400">{formatCurrency(latestCandle.highestHigh20)}</strong></span>}
          </div>
        )}
      </div>
    </div>
  );
};
