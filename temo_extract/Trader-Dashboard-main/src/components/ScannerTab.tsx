import React, { useMemo, useState } from 'react';
import { 
  ArrowDownRight, 
  ArrowUpRight, 
  CandlestickChart, 
  Check, 
  CheckCircle2,
  Compass,
  Filter, 
  Flame, 
  Layers, 
  Plus, 
  RefreshCw, 
  RotateCcw, 
  Search, 
  Sparkles, 
  Tag, 
  Target,
  TrendingUp,
  Zap 
} from 'lucide-react';
import { MarketCapCategory, ScannerFilterParams, TickerQuote } from '../types/trading';
import { formatCompactNumber, formatCurrency, formatPercent } from '../utils/formatters';
import { Sparkline } from './Sparkline';
import { moverDiscoveryService, GotradeMoverCandidate } from '../services/moverDiscoveryService';

interface ScannerTabProps {
  universe: TickerQuote[];
  onSelectTicker: (symbol: string) => void;
  onAddToWatchlist: (symbol: string) => void;
  onOpenNewPositionWithTicker: (symbol: string, currentPrice: number) => void;
  onNavigateToTab: (tab: string) => void;
  watchlistSymbols: Set<string>;
  autoAddMovers?: boolean;
  onToggleAutoAddMovers?: (enabled: boolean) => void;
}

const DEFAULT_FILTERS: ScannerFilterParams = {
  minAvgVolume: 500000,
  minRvol: 1.0,
  minChangePct: -100,
  maxChangePct: 100,
  changeWindow: '1D',
  priceMin: 2,
  priceMax: 2000,
  marketCapCategory: 'ALL',
  catalystRequired: false,
  searchQuery: '',
};

export const ScannerTab: React.FC<ScannerTabProps> = ({
  universe = [],
  onSelectTicker,
  onAddToWatchlist,
  onOpenNewPositionWithTicker,
  onNavigateToTab,
  watchlistSymbols = new Set<string>(),
  autoAddMovers,
  onToggleAutoAddMovers,
}) => {
  const [filters, setFilters] = useState<ScannerFilterParams>(DEFAULT_FILTERS);
  const [selectedPreset, setSelectedPreset] = useState<string>('all');

  // Gotrade Auto-Discovery & Confluence Scanner state
  const [moverMaxPrice, setMoverMaxPrice] = useState<number>(25);
  const [moverOnlyNonWatchlist, setMoverOnlyNonWatchlist] = useState<boolean>(false);
  const [lastMoverScanTime, setLastMoverScanTime] = useState<Date>(new Date());
  const [isScanningMovers, setIsScanningMovers] = useState<boolean>(false);

  const discoveredMovers = useMemo(() => {
    return moverDiscoveryService.discoverGotradeMovers({
      watchlistSymbols: Array.from<string>(watchlistSymbols),
      maxPrice: moverMaxPrice,
      onlyNonWatchlist: moverOnlyNonWatchlist,
      minConfluencePct: 50,
    });
  }, [watchlistSymbols, moverMaxPrice, moverOnlyNonWatchlist, lastMoverScanTime]);

  const handleScanMoversNow = () => {
    setIsScanningMovers(true);
    setTimeout(() => {
      setLastMoverScanTime(new Date());
      setIsScanningMovers(false);
    }, 400);
  };

  const applyPreset = (presetKey: string) => {
    setSelectedPreset(presetKey);
    if (presetKey === 'all') {
      setFilters(DEFAULT_FILTERS);
    } else if (presetKey === 'gotrade_movers') {
      setFilters({
        ...DEFAULT_FILTERS,
        priceMax: 25,
        minRvol: 1.2,
      });
    } else if (presetKey === 'high_rvol_gainers') {
      setFilters({
        ...DEFAULT_FILTERS,
        minRvol: 1.8,
        minChangePct: 2.0,
        minAvgVolume: 1000000,
      });
    } else if (presetKey === 'oversold_bounce') {
      setFilters({
        ...DEFAULT_FILTERS,
        minChangePct: 0.5,
        minAvgVolume: 500000,
      });
    } else if (presetKey === 'low_float_movers') {
      setFilters({
        ...DEFAULT_FILTERS,
        maxFloat: 100000000, // 100M float
        minRvol: 1.5,
        minChangePct: 3.0,
      });
    } else if (presetKey === 'catalyst_only') {
      setFilters({
        ...DEFAULT_FILTERS,
        catalystRequired: true,
      });
    } else if (presetKey === 'large_cap_breakout') {
      setFilters({
        ...DEFAULT_FILTERS,
        marketCapCategory: 'LARGE',
        minChangePct: 1.5,
        minRvol: 1.2,
      });
    }
  };

  // Filter the universe
  const filteredQuotes = universe.filter(quote => {
    // 1. Min avg daily volume
    if (quote.avgVolume30D < filters.minAvgVolume) return false;

    // 2. Relative Volume
    if (quote.rvol < filters.minRvol) return false;

    // 3. Price bounds
    if (quote.price < filters.priceMin || quote.price > filters.priceMax) return false;

    // 4. Change %
    if (quote.changePercent < filters.minChangePct || quote.changePercent > filters.maxChangePct) return false;

    // 5. Market Cap
    if (filters.marketCapCategory !== 'ALL' && quote.marketCapCategory !== filters.marketCapCategory) {
      return false;
    }

    // 6. Max Float
    if (filters.maxFloat && quote.floatShares && quote.floatShares > filters.maxFloat) {
      return false;
    }

    // 7. Catalyst
    if (filters.catalystRequired && !quote.catalyst) {
      return false;
    }

    // 8. Search query
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      if (!quote.symbol.toLowerCase().includes(q) && !quote.name.toLowerCase().includes(q) && !quote.sector.toLowerCase().includes(q)) {
        return false;
      }
    }

    return true;
  });

  return (
    <div className="space-y-4">
      {/* Scanner Header & Quick Strategy Presets */}
      <div className="bg-[#161B22] p-4 rounded-lg border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-bold text-slate-100">Stock Scanner & Liquid Universe</h2>
              <p className="text-xs text-slate-400">Filter liquid names by Volume, Relative Volume (RVOL), Price Move, Market Cap & Catalysts</p>
            </div>
          </div>
          <button
            onClick={() => applyPreset('all')}
            className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 self-start sm:self-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Filters
          </button>
        </div>

        {/* Strategy Presets */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-500 font-semibold uppercase tracking-wider text-[11px] shrink-0">Presets:</span>
          {[
            { key: 'all', label: 'All Liquid Stocks' },
            { key: 'gotrade_movers', label: '🎯 Gotrade Cheap Movers (<$25)' },
            { key: 'high_rvol_gainers', label: '🔥 High RVOL Gainers (>1.8x, +2%)' },
            { key: 'catalyst_only', label: '📰 Confirmed Catalyst Movers' },
            { key: 'low_float_movers', label: '⚡ Low Float Momentum (<100M Float)' },
            { key: 'large_cap_breakout', label: '🏛️ Large Cap Trend Movers' },
          ].map(preset => (
            <button
              key={preset.key}
              onClick={() => applyPreset(preset.key)}
              className={`px-3 py-1.5 rounded-lg border font-medium whitespace-nowrap transition-colors ${
                selectedPreset === preset.key
                  ? 'bg-emerald-950 border-emerald-700 text-emerald-300 font-semibold'
                  : 'bg-[#0B0E14]/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filter Parameters Grid */}
      <div className="bg-[#161B22]/60 p-4 rounded-lg border border-slate-800 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
        {/* Min Avg Volume */}
        <div>
          <label className="text-slate-400 font-medium block mb-1">Min 30D Avg Volume</label>
          <select
            value={filters.minAvgVolume}
            onChange={e => setFilters({ ...filters, minAvgVolume: Number(e.target.value) })}
            className="w-full bg-[#0B0E14] border border-slate-800 rounded-lg p-2 text-slate-200 focus:border-emerald-500 font-mono"
          >
            <option value={100000}>100K+ (All)</option>
            <option value={500000}>500K+ (Liquid)</option>
            <option value={1000000}>1M+ (Standard)</option>
            <option value={5000000}>5M+ (High Liquidity)</option>
            <option value={20000000}>20M+ (Mega Liquid)</option>
          </select>
        </div>

        {/* Min Relative Volume (RVOL) */}
        <div>
          <label className="text-slate-400 font-medium block mb-1">Min RVOL (Today vs 30D)</label>
          <select
            value={filters.minRvol}
            onChange={e => setFilters({ ...filters, minRvol: Number(e.target.value) })}
            className="w-full bg-[#0B0E14] border border-slate-800 rounded-lg p-2 text-slate-200 focus:border-emerald-500 font-mono"
          >
            <option value={0}>Any RVOL</option>
            <option value={1.2}>1.2x+ (Active)</option>
            <option value={1.5}>1.5x+ (Elevated)</option>
            <option value={2.0}>2.0x+ (Surge / In Play)</option>
            <option value={3.0}>3.0x+ (Extreme Vol)</option>
          </select>
        </div>

        {/* % Price Change */}
        <div>
          <label className="text-slate-400 font-medium block mb-1">Min % Price Move</label>
          <select
            value={filters.minChangePct}
            onChange={e => setFilters({ ...filters, minChangePct: Number(e.target.value) })}
            className="w-full bg-[#0B0E14] border border-slate-800 rounded-lg p-2 text-slate-200 focus:border-emerald-500 font-mono"
          >
            <option value={-100}>Any Change</option>
            <option value={0}>Green (&gt; 0%)</option>
            <option value={2}>+2% or higher</option>
            <option value={4}>+4% or higher</option>
            <option value={8}>+8% or higher</option>
            <option value={-100}>Oversold / Red</option>
          </select>
        </div>

        {/* Market Cap */}
        <div>
          <label className="text-slate-400 font-medium block mb-1">Market Cap Range</label>
          <select
            value={filters.marketCapCategory}
            onChange={e => setFilters({ ...filters, marketCapCategory: e.target.value as MarketCapCategory })}
            className="w-full bg-[#0B0E14] border border-slate-800 rounded-lg p-2 text-slate-200 focus:border-emerald-500 font-mono"
          >
            <option value="ALL">All Market Caps</option>
            <option value="MICRO">Micro (&lt; $300M)</option>
            <option value="SMALL">Small ($300M - $2B)</option>
            <option value="MID">Mid ($2B - $10B)</option>
            <option value="LARGE">Large ($10B - $200B)</option>
            <option value="MEGA">Mega (&gt; $200B)</option>
          </select>
        </div>

        {/* Price Range */}
        <div>
          <label className="text-slate-400 font-medium block mb-1">Price Min / Max</label>
          <div className="flex items-center gap-1 font-mono">
            <input
              type="number"
              placeholder="Min $"
              value={filters.priceMin}
              onChange={e => setFilters({ ...filters, priceMin: Number(e.target.value) })}
              className="w-1/2 bg-[#0B0E14] border border-slate-800 rounded-lg p-2 text-slate-200 text-xs"
            />
            <input
              type="number"
              placeholder="Max $"
              value={filters.priceMax}
              onChange={e => setFilters({ ...filters, priceMax: Number(e.target.value) })}
              className="w-1/2 bg-[#0B0E14] border border-slate-800 rounded-lg p-2 text-slate-200 text-xs"
            />
          </div>
        </div>

        {/* Catalyst Flag */}
        <div>
          <label className="text-slate-400 font-medium block mb-1">Catalysts Only</label>
          <button
            onClick={() => setFilters({ ...filters, catalystRequired: !filters.catalystRequired })}
            className={`w-full py-2 px-3 rounded-lg border font-medium flex items-center justify-center gap-1.5 transition-colors ${
              filters.catalystRequired
                ? 'bg-emerald-900/60 border-emerald-600 text-emerald-300 font-semibold'
                : 'bg-[#0B0E14] border-slate-800 text-slate-400'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            {filters.catalystRequired ? 'Catalyst Active' : 'Any Stocks'}
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* GOTRADE MOVER AUTO-DISCOVERY & CONFLUENCE SCANNER */}
      {/* ========================================================================= */}
      <div className="bg-[#161B22] p-4 rounded-lg border border-indigo-900/60 shadow-xl space-y-3 relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-80 h-32 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header and Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 relative z-10">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-indigo-950/80 border border-indigo-800 rounded-lg text-indigo-400 mt-0.5">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                  Gotrade Mover Auto-Discovery & Confluence
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-750">
                  Cheaper Entry Points
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Surfaces high-momentum, low-priced stocks even if they are not in your watchlist yet, verifying 4H technical confluence so you can catch early breakouts at lower costs.
              </p>
            </div>
          </div>

          {/* Controls: Price Filter, Non-Watchlist toggle, Auto-Add toggle & Refresh */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Price filter */}
            <div className="flex items-center bg-[#0B0E14] border border-slate-800 rounded-lg p-0.5">
              <button
                onClick={() => setMoverMaxPrice(10)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                  moverMaxPrice === 10
                    ? 'bg-indigo-900/80 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                &lt; $10
              </button>
              <button
                onClick={() => setMoverMaxPrice(25)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                  moverMaxPrice === 25
                    ? 'bg-indigo-900/80 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                &lt; $25
              </button>
              <button
                onClick={() => setMoverMaxPrice(100)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                  moverMaxPrice === 100
                    ? 'bg-indigo-900/80 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All
              </button>
            </div>

            {/* Non-watchlist only toggle */}
            <button
              onClick={() => setMoverOnlyNonWatchlist(!moverOnlyNonWatchlist)}
              className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                moverOnlyNonWatchlist
                  ? 'bg-indigo-950 border-indigo-700 text-indigo-300'
                  : 'bg-[#0B0E14] border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              Non-Watchlist Only
            </button>

            {/* Auto-Add Confluence Movers Toggle */}
            {onToggleAutoAddMovers && (
              <button
                onClick={() => onToggleAutoAddMovers(!autoAddMovers)}
                className={`px-2.5 py-1 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  autoAddMovers
                    ? 'bg-emerald-950 border-emerald-700 text-emerald-300'
                    : 'bg-[#0B0E14] border-slate-800 text-slate-400'
                }`}
                title="Automatically adds any non-watchlist stock that achieves >=75% confluence to your watchlist"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Auto-Add Confluence: {autoAddMovers ? 'ON' : 'OFF'}</span>
              </button>
            )}

            {/* Manual Scan Button */}
            <button
              onClick={handleScanMoversNow}
              disabled={isScanningMovers}
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanningMovers ? 'animate-spin' : ''}`} />
              <span>Scan Movers</span>
            </button>
          </div>
        </div>

        {/* Discovered Mover Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
          {discoveredMovers.length === 0 ? (
            <div className="col-span-full py-8 text-center text-slate-500 text-xs bg-[#0B0E14]/60 rounded-lg border border-slate-800/80">
              No movers matching current price filters. Click "All" or uncheck "Non-Watchlist Only" to broaden discovery.
            </div>
          ) : (
            discoveredMovers.slice(0, 6).map(mover => {
              const inWatchlist = watchlistSymbols.has(mover.symbol);
              const isHighConfluence = mover.confluenceScore >= 75;
              const isGoodConfluence = mover.confluenceScore >= 60;

              return (
                <div
                  key={mover.symbol}
                  className={`bg-[#0B0E14] p-3.5 rounded-lg border transition-all flex flex-col justify-between gap-2.5 ${
                    isHighConfluence
                      ? 'border-emerald-800/80 hover:border-emerald-600 shadow-md'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Top: Symbol, Price, Cheaper Badge & In Watchlist */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 font-mono">
                        <button
                          onClick={() => {
                            onSelectTicker(mover.symbol);
                            onNavigateToTab('charts');
                          }}
                          className="text-base font-bold text-white hover:text-emerald-400 transition-colors"
                        >
                          {mover.symbol}
                        </button>
                        <span className="text-[10px] font-sans px-1.5 py-0.2 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded font-semibold">
                          ${mover.price.toFixed(2)}
                        </span>
                        {mover.price <= 10 && (
                          <span className="text-[9px] font-sans px-1 py-0.2 bg-indigo-950 text-indigo-300 border border-indigo-800 rounded font-bold">
                            &lt; $10 Entry
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                        {mover.name}
                      </div>
                    </div>

                    <div className="text-right font-mono">
                      <div className={`text-xs font-bold ${mover.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {mover.changePercent >= 0 ? '+' : ''}{mover.changePercent.toFixed(2)}%
                      </div>
                      <div className="text-[10px] text-amber-400 flex items-center justify-end gap-0.5">
                        <Flame className="w-2.5 h-2.5" />
                        <span>{mover.rvol.toFixed(1)}x RVOL</span>
                      </div>
                    </div>
                  </div>

                  {/* Confluence Score Bar */}
                  <div className="space-y-1 bg-[#121620] p-2 rounded border border-slate-800/80">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-medium flex items-center gap-1">
                        <Target className="w-3 h-3 text-indigo-400" />
                        <span>Technical Confluence:</span>
                      </span>
                      <span className={`font-mono font-bold ${
                        isHighConfluence ? 'text-emerald-400' : isGoodConfluence ? 'text-amber-400' : 'text-slate-300'
                      }`}>
                        {mover.confluenceScore}% ({mover.confluencePassedCount}/8 rules)
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isHighConfluence
                            ? 'bg-emerald-500'
                            : isGoodConfluence
                            ? 'bg-amber-500'
                            : 'bg-indigo-500'
                        }`}
                        style={{ width: `${mover.confluenceScore}%` }}
                      />
                    </div>

                    {/* Confluence Highlights */}
                    <div className="text-[10px] text-slate-400 line-clamp-1 font-mono pt-0.5">
                      {mover.reason}
                    </div>
                  </div>

                  {/* Actions: Add to Watchlist / Trade / Chart */}
                  <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-800/60">
                    {inWatchlist ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-950/60 px-2 py-1 rounded border border-emerald-900 font-medium">
                        <Check className="w-3 h-3" /> In Watchlist
                      </span>
                    ) : (
                      <button
                        onClick={() => onAddToWatchlist(mover.symbol)}
                        className="px-2.5 py-1 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 rounded text-xs font-semibold flex items-center gap-1 transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Add to Watchlist
                      </button>
                    )}

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          onSelectTicker(mover.symbol);
                          onNavigateToTab('charts');
                        }}
                        className="px-2 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded text-xs font-medium transition-colors"
                        title="View 4H Chart"
                      >
                        Chart
                      </button>
                      <button
                        onClick={() => onOpenNewPositionWithTicker(mover.symbol, mover.price)}
                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold transition-colors"
                      >
                        Trade
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Results Count & Table */}
      <div className="bg-[#161B22] rounded-lg border border-slate-800 overflow-hidden shadow-lg">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <span>Scanner Results</span>
            <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono">
              {filteredQuotes.length} matches
            </span>
          </div>
          <div className="text-xs text-slate-500 font-mono">
            Sorted by Relative Volume & Price Momentum
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm font-mono">
            <thead className="bg-[#0B0E14]/70 border-b border-slate-800 text-xs text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Ticker</th>
                <th className="py-3 px-3 text-right">Price</th>
                <th className="py-3 px-3 text-right">% Change</th>
                <th className="py-3 px-3 text-center">RVOL</th>
                <th className="py-3 px-3 text-right">Volume</th>
                <th className="py-3 px-3 text-right">Market Cap</th>
                <th className="py-3 px-3 text-center">20D Trend</th>
                <th className="py-3 px-3">Catalyst / Reason</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredQuotes.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500 text-xs">
                    No stocks matching these criteria. Try lowering the RVOL threshold or broadening market cap.
                  </td>
                </tr>
              ) : (
                filteredQuotes.map(quote => {
                  const isPositive = quote.change >= 0;
                  const inWatchlist = (watchlistSymbols instanceof Set) ? watchlistSymbols.has(quote.symbol) : false;

                  return (
                    <tr 
                      key={quote.symbol} 
                      className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                      onClick={() => onSelectTicker(quote.symbol)}
                    >
                      {/* Ticker & Name */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-white text-base flex items-center gap-1.5">
                          {quote.symbol}
                          {quote.rvol >= 2.0 && (
                            <span className="text-[10px] font-sans px-1 py-0.2 bg-amber-950 text-amber-400 border border-amber-800 rounded font-semibold flex items-center gap-0.5">
                              <Flame className="w-2.5 h-2.5" /> High RVOL
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-sans text-slate-400 truncate max-w-[140px]">
                          {quote.name}
                        </div>
                      </td>

                      {/* Price */}
                      <td className="py-3 px-3 text-right font-bold text-slate-100">
                        {formatCurrency(quote.price)}
                      </td>

                      {/* % Change */}
                      <td className="py-3 px-3 text-right">
                        <div className={`inline-flex items-center font-bold text-sm ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isPositive ? <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> : <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />}
                          {formatPercent(quote.changePercent)}
                        </div>
                      </td>

                      {/* RVOL */}
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          quote.rvol >= 2.0
                            ? 'bg-amber-950 text-amber-300 border border-amber-700'
                            : quote.rvol >= 1.3
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {quote.rvol.toFixed(2)}x
                        </span>
                      </td>

                      {/* Volume */}
                      <td className="py-3 px-3 text-right">
                        <div className="text-slate-200 text-xs font-medium">
                          {formatCompactNumber(quote.volume)}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Avg: {formatCompactNumber(quote.avgVolume30D)}
                        </div>
                      </td>

                      {/* Market Cap */}
                      <td className="py-3 px-3 text-right text-slate-300 text-xs">
                        {formatCompactNumber(quote.marketCap)}
                        <span className="text-[10px] text-slate-500 block font-sans">{quote.marketCapCategory}</span>
                      </td>

                      {/* Sparkline */}
                      <td className="py-3 px-3 text-center">
                        <Sparkline data={quote.sparkline} isPositive={isPositive} width={75} />
                      </td>

                      {/* Catalyst / Sector */}
                      <td className="py-3 px-3 font-sans">
                        {quote.catalyst ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800 w-fit">
                              <Tag className="w-2.5 h-2.5" />
                              {quote.catalyst.type.replace('_', ' ')}
                            </span>
                            <span className="text-[10px] text-slate-400 truncate max-w-[170px]" title={quote.catalyst.headline}>
                              {quote.catalyst.headline}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">
                            {quote.sector}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right font-sans" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            id={`scanner-chart-${quote.symbol}`}
                            onClick={() => {
                              onSelectTicker(quote.symbol);
                              onNavigateToTab('charts');
                            }}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors"
                            title="Open Candlestick Chart"
                          >
                            <CandlestickChart className="w-3.5 h-3.5 text-emerald-400" />
                          </button>
                          
                          <button
                            id={`scanner-trade-${quote.symbol}`}
                            onClick={() => onOpenNewPositionWithTicker(quote.symbol, quote.price)}
                            className="p-1.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 rounded transition-colors"
                            title="Log Position / Paper Trade"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>

                          {!inWatchlist ? (
                            <button
                              id={`scanner-add-wl-${quote.symbol}`}
                              onClick={() => onAddToWatchlist(quote.symbol)}
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs flex items-center gap-1 transition-colors"
                              title="Add to Watchlist"
                            >
                              + Watch
                            </button>
                          ) : (
                            <span className="text-[10px] text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-900 flex items-center gap-0.5">
                              <Check className="w-3 h-3" /> Watching
                            </span>
                          )}
                        </div>
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
