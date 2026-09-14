import React, { useState } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  Bell, 
  CandlestickChart, 
  CheckCircle, 
  ChevronRight, 
  Flame, 
  HelpCircle, 
  Menu, 
  Plus, 
  Radio, 
  RefreshCw, 
  Search, 
  Settings as SettingsIcon, 
  ShieldCheck, 
  Sliders, 
  TrendingUp, 
  Wallet, 
  X, 
  Zap 
} from 'lucide-react';
import { SignalAlert, TickerQuote } from '../types/trading';
import { formatCurrency, formatPercent } from '../utils/formatters';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeMode: 'LIVE_TRACKER' | 'PAPER_TRADING';
  setActiveMode: (mode: 'LIVE_TRACKER' | 'PAPER_TRADING') => void;
  universe: TickerQuote[];
  alerts: SignalAlert[];
  unreadAlertsCount: number;
  onSelectTicker: (symbol: string) => void;
  onOpenSettings: () => void;
  onOpenNewPosition: () => void;
  onDismissAlert: (id: string) => void;
  onClearCache?: () => void;
  isResettingCache?: boolean;
  paperBalance: number;
  totalPositionsPnl: { dollars: number; percent: number };
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  activeMode,
  setActiveMode,
  universe,
  alerts,
  unreadAlertsCount,
  onSelectTicker,
  onOpenSettings,
  onOpenNewPosition,
  onDismissAlert,
  onClearCache,
  isResettingCache = false,
  paperBalance,
  totalPositionsPnl,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const filteredUniverse = searchQuery.trim()
    ? universe.filter(
        q =>
          q.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
          q.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const handleSelectSymbol = (symbol: string) => {
    onSelectTicker(symbol);
    setSearchQuery('');
    setIsSearchOpen(false);
    setIsMobileMenuOpen(false);
  };

  const navTabs = [
    { id: 'watchlist', label: 'Watchlist', badge: universe.length },
    { id: 'scanner', label: 'Scanner' },
    { id: 'signals', label: 'Entry Signals', badge: alerts.length > 0 ? alerts.length : undefined },
    { id: 'positions', label: 'Positions & Exits', badge: totalPositionsPnl.dollars !== 0 ? (totalPositionsPnl.dollars >= 0 ? `+${formatCurrency(totalPositionsPnl.dollars, 0)}` : formatCurrency(totalPositionsPnl.dollars, 0)) : undefined },
    { id: 'charts', label: 'Charts' },
    { id: 'news', label: 'News & Catalysts' },
    { id: 'backtest', label: 'Backtesting' },
    { id: 'xauusd', label: 'XAUUSD Daytrade', badge: '5m / 30m', isGold: true },
    { id: 'paper', label: 'Paper Trading' },
  ];

  // Major market indices preview
  const spyQuote = universe.find(u => u.symbol === 'SPY') || { price: 562.80, change: 4.20, changePercent: 0.75 };
  const qqqQuote = universe.find(u => u.symbol === 'QQQ') || { price: 486.20, change: 5.80, changePercent: 1.21 };
  const iwmQuote = universe.find(u => u.symbol === 'IWM') || { price: 221.50, change: -0.65, changePercent: -0.29 };

  return (
    <header className="border-b border-slate-800 bg-[#0F1219] shrink-0 z-40 sticky top-0">
      {/* Top Banner: Market Status & Indices Bar */}
      <div className="flex items-center justify-between px-3 sm:px-6 py-1.5 bg-[#0B0E14] border-b border-slate-800/60 text-[11px] font-mono">
        <div className="flex items-center space-x-3 overflow-x-auto no-scrollbar">
          <div className="flex items-center space-x-1.5 text-emerald-500 whitespace-nowrap">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse"></span>
            <span className="font-bold">FINNHUB LIVE 4H</span>
          </div>

          <div className="h-3 w-px bg-slate-700 hidden sm:block"></div>

          {/* Indices */}
          <div className="flex items-center space-x-3 text-slate-500 whitespace-nowrap">
            <div className="flex items-center space-x-1 cursor-pointer hover:text-slate-300" onClick={() => handleSelectSymbol('SPY')}>
              <span className="text-slate-400 font-semibold">SPY</span>
              <span>{formatCurrency(spyQuote.price)}</span>
              <span className={spyQuote.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {formatPercent(spyQuote.changePercent)}
              </span>
            </div>

            <div className="flex items-center space-x-1 cursor-pointer hover:text-slate-300" onClick={() => handleSelectSymbol('QQQ')}>
              <span className="text-slate-400 font-semibold">QQQ</span>
              <span>{formatCurrency(qqqQuote.price)}</span>
              <span className={qqqQuote.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {formatPercent(qqqQuote.changePercent)}
              </span>
            </div>

            <div className="hidden md:flex items-center space-x-1 cursor-pointer hover:text-slate-300" onClick={() => handleSelectSymbol('IWM')}>
              <span className="text-slate-400 font-semibold">IWM</span>
              <span>{formatCurrency(iwmQuote.price)}</span>
              <span className={iwmQuote.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {formatPercent(iwmQuote.changePercent)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pl-2">
          <div className="text-right whitespace-nowrap">
            {activeMode === 'PAPER_TRADING' ? (
              <>
                <span className="text-slate-500 uppercase text-[9px] block sm:inline sm:mr-1">Paper</span>
                <span className="text-white font-bold text-xs sm:text-sm">{formatCurrency(paperBalance, 0)}</span>
              </>
            ) : (
              <>
                <span className="text-slate-500 uppercase text-[9px] block sm:inline sm:mr-1">Live P&amp;L</span>
                <span className={`font-bold text-xs sm:text-sm ${totalPositionsPnl.dollars >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {totalPositionsPnl.dollars >= 0 ? '+' : ''}{formatCurrency(totalPositionsPnl.dollars, 0)}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-3">
        {/* Brand & Mode Switcher */}
        <div className="flex items-center space-x-3 sm:space-x-5">
          {/* Hamburger Menu Toggle on Mobile */}
          <button
            id="mobile-menu-toggle-btn"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 md:hidden text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-lg transition-colors"
            title="Toggle Navigation Menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-emerald-500 rounded flex items-center justify-center text-slate-900 font-bold text-xs">T</div>
            <span className="font-bold text-white tracking-tight">
              T-DASH <span className="text-slate-500 font-medium text-[10px] ml-1 uppercase tracking-widest hidden sm:inline">v1.0</span>
            </span>
          </div>

          {/* Mode Switcher Pill */}
          <div className="bg-[#0B0E14] p-0.5 rounded border border-slate-800 flex items-center text-[10px] uppercase font-bold tracking-wider">
            <button
              id="mode-live-tracker"
              onClick={() => setActiveMode('LIVE_TRACKER')}
              className={`px-2.5 py-1 rounded transition-colors flex items-center gap-1 ${
                activeMode === 'LIVE_TRACKER'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Live
            </button>
            <button
              id="mode-paper-trading"
              onClick={() => setActiveMode('PAPER_TRADING')}
              className={`px-2.5 py-1 rounded transition-colors flex items-center gap-1 ${
                activeMode === 'PAPER_TRADING'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Paper
            </button>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="relative flex-1 max-w-md hidden md:block">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search ticker (e.g. NVDA, TSLA, PLTR, ASTS)..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
              className="w-full bg-[#0B0E14] border border-slate-800 rounded-lg pl-9 pr-4 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Search Dropdown */}
          {isSearchOpen && filteredUniverse.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#161B22] border border-slate-800 rounded-lg shadow-xl overflow-hidden z-50 max-h-80 overflow-y-auto">
              <div className="p-2 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Matching Tickers ({filteredUniverse.length})
              </div>
              {filteredUniverse.map(quote => (
                <div
                  key={quote.symbol}
                  onClick={() => handleSelectSymbol(quote.symbol)}
                  className="px-3 py-2 hover:bg-slate-800/80 cursor-pointer flex items-center justify-between text-sm transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <span className="font-bold text-white font-mono">{quote.symbol}</span>
                    <span className="text-slate-400 text-xs truncate max-w-[160px]">{quote.name}</span>
                    {quote.catalyst && (
                      <span className="text-[10px] bg-emerald-950 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-800">
                        {quote.catalyst.type}
                      </span>
                    )}
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-slate-100 font-semibold">{formatCurrency(quote.price)}</div>
                    <div className={`text-xs ${quote.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {formatPercent(quote.changePercent)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          {/* Mobile Search Toggle */}
          <button
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className="p-2 md:hidden bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors"
            title="Search Tickers"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Quick Log Position */}
          <button
            id="quick-log-position-btn"
            onClick={onOpenNewPosition}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-md transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Log Position
          </button>

          {/* Alerts Bell */}
          <div className="relative">
            <button
              id="alerts-bell-btn"
              onClick={() => setIsAlertsOpen(!isAlertsOpen)}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg relative transition-colors"
              title="Signal Alerts"
            >
              <Bell className="w-4 h-4" />
              {unreadAlertsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 font-bold text-[10px] w-4 h-4 rounded-full flex items-center justify-center animate-pulse font-mono">
                  {unreadAlertsCount}
                </span>
              )}
            </button>

            {/* Alert Drawer Popup */}
            {isAlertsOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 sm:w-96 bg-[#161B22] border border-slate-800 rounded-lg shadow-2xl z-50 overflow-hidden">
                <div className="p-3 bg-[#0B0E14] border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Bell className="w-4 h-4 text-amber-400" />
                    <span className="font-bold text-sm text-slate-100">Active Entry Signals</span>
                  </div>
                  <button
                    onClick={() => {
                      setIsAlertsOpen(false);
                      setActiveTab('signals');
                    }}
                    className="text-xs text-emerald-400 hover:underline flex items-center"
                  >
                    View All <ChevronRight className="w-3 h-3 ml-0.5" />
                  </button>
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/60 p-1">
                  {alerts.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No active signals fired yet in this session.
                    </div>
                  ) : (
                    Array.from<SignalAlert>(new Map<string, SignalAlert>(alerts.map(a => [a.id, a])).values()).slice(0, 5).map(alert => (
                      <div key={alert.id} className="p-2.5 hover:bg-slate-800/50 rounded-lg transition-colors">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold font-mono text-emerald-400 cursor-pointer hover:underline" onClick={() => {
                            onSelectTicker(alert.ticker);
                            setIsAlertsOpen(false);
                            setActiveTab('charts');
                          }}>
                            {alert.ticker}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="text-xs font-medium text-slate-200 mb-1">{alert.ruleName}</div>
                        <p className="text-[11px] text-slate-400 leading-snug">{alert.reason}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Clear Cache / Reset Data Button */}
          {onClearCache && (
            <button
              id="header-clear-cache-btn"
              onClick={onClearCache}
              disabled={isResettingCache}
              className="p-2 bg-slate-800/90 hover:bg-rose-900/40 hover:text-rose-300 text-slate-400 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-mono disabled:opacity-50"
              title="Clear Cache & Refetch Finnhub 4H Data"
            >
              <RefreshCw className={`w-4 h-4 ${isResettingCache ? 'animate-spin text-rose-400' : ''}`} />
              <span className="hidden xl:inline text-[11px] font-sans font-medium text-slate-300">Clear Cache</span>
            </button>
          )}

          {/* Settings Button */}
          <button
            id="settings-btn"
            onClick={onOpenSettings}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
            title="Settings & Data Provider"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Search Overlay Input if active on small screen */}
      {isSearchOpen && (
        <div className="px-3 pb-3 md:hidden">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              autoFocus
              placeholder="Search ticker (e.g. NVDA, PLTR)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-[#0B0E14] border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
          {filteredUniverse.length > 0 && (
            <div className="mt-1 bg-[#161B22] border border-slate-800 rounded-lg shadow-xl overflow-hidden max-h-60 overflow-y-auto divide-y divide-slate-800/80">
              {filteredUniverse.slice(0, 6).map(quote => (
                <div
                  key={`mob-search-${quote.symbol}`}
                  onClick={() => handleSelectSymbol(quote.symbol)}
                  className="px-3 py-2.5 hover:bg-slate-800 flex items-center justify-between text-sm"
                >
                  <div>
                    <span className="font-bold text-white font-mono">{quote.symbol}</span>
                    <span className="text-slate-400 text-xs ml-2">{quote.name}</span>
                  </div>
                  <div className="text-right font-mono text-xs">
                    <span className="text-slate-100 font-semibold">{formatCurrency(quote.price)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mobile Collapsible Navigation Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-[#161B22] border-b border-slate-800 px-4 py-3 space-y-2 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-800">
            Navigation Menu
          </div>
          <div className="grid grid-cols-2 gap-1.5 pt-1">
            {navTabs.map(tab => (
              <button
                key={`mobile-nav-${tab.id}`}
                onClick={() => {
                  setActiveTab(tab.id);
                  setIsMobileMenuOpen(false);
                }}
                className={`px-3 py-2 rounded-lg text-left text-xs font-medium flex items-center justify-between transition-colors ${
                  activeTab === tab.id
                    ? (tab.isGold ? 'bg-amber-500 text-slate-950 font-black' : 'bg-emerald-600 text-white font-bold')
                    : (tab.isGold ? 'text-amber-300 hover:bg-slate-800 font-semibold' : 'text-slate-300 hover:bg-slate-800')
                }`}
              >
                <span className="flex items-center gap-1.5">
                  {tab.isGold && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
                  {tab.label}
                </span>
                {tab.badge !== undefined && (
                  <span className={`text-[10px] font-mono px-1 rounded ${
                    activeTab === tab.id 
                      ? (tab.isGold ? 'bg-slate-950/40 text-slate-900 font-bold' : 'bg-emerald-700 text-white')
                      : (tab.isGold ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400')
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
            <button
              onClick={() => {
                onOpenNewPosition();
                setIsMobileMenuOpen(false);
              }}
              className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Log Trade
            </button>
            {onClearCache && (
              <button
                onClick={() => {
                  onClearCache();
                  setIsMobileMenuOpen(false);
                }}
                disabled={isResettingCache}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-rose-950 text-rose-300 rounded-lg text-xs font-semibold flex items-center gap-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isResettingCache ? 'animate-spin' : ''}`} />
                Reset Data
              </button>
            )}
            <button
              onClick={() => {
                onOpenSettings();
                setIsMobileMenuOpen(false);
              }}
              className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1"
            >
              <SettingsIcon className="w-3.5 h-3.5" />
              Settings
            </button>
          </div>
        </div>
      )}

      {/* Mobile Horizontal Quick-Nav Bar (Visible on mobile < md) */}
      <nav className="md:hidden flex items-center space-x-1.5 px-3 py-1.5 overflow-x-auto no-scrollbar border-t border-slate-800/80 bg-[#0B0E14]/90">
        {navTabs.map(tab => (
          <button
            key={`mob-strip-${tab.id}`}
            id={`mob-nav-tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 min-h-[42px] rounded-lg text-xs whitespace-nowrap transition-all flex items-center gap-1.5 font-bold shrink-0 touch-manipulation ${
              activeTab === tab.id
                ? (tab.isGold 
                    ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20' 
                    : 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20')
                : (tab.isGold
                    ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white')
            }`}
          >
            {tab.isGold && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
            {tab.label}
            {tab.badge !== undefined && (
              <span className={`text-[9px] font-mono px-1 py-0.2 rounded ${
                activeTab === tab.id 
                  ? 'bg-slate-950/40 text-white font-bold' 
                  : (tab.isGold ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400')
              }`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Desktop Horizontal Navigation Tabs (Hidden on mobile < md) */}
      <nav className="hidden md:flex items-center space-x-6 px-6 overflow-x-auto text-[10px] uppercase font-bold tracking-widest no-scrollbar pt-2">
        {navTabs.map(tab => (
          <button
            key={tab.id}
            id={`nav-tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 whitespace-nowrap transition-colors flex items-center gap-1.5 border-b-2 ${
              activeTab === tab.id
                ? (tab.isGold ? 'text-amber-300 border-amber-400 font-black' : 'text-white border-emerald-500')
                : (tab.isGold ? 'text-amber-400/90 border-transparent hover:text-amber-300 hover:border-amber-500/50' : 'text-slate-500 border-transparent hover:text-slate-300 hover:border-slate-700')
            }`}
          >
            {tab.isGold && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
            {tab.label}
            {tab.badge !== undefined && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                tab.isGold
                  ? (activeTab === tab.id ? 'bg-amber-500 text-slate-950 font-black' : 'bg-amber-500/15 text-amber-300 border border-amber-500/30')
                  : typeof tab.badge === 'string' && tab.badge.startsWith('+') 
                  ? 'text-emerald-400' 
                  : typeof tab.badge === 'string' && tab.badge.startsWith('-')
                  ? 'text-rose-400'
                  : 'text-slate-400'
              }`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </nav>
    </header>
  );
};
