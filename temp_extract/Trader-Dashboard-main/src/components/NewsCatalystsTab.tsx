import React, { useState } from 'react';
import { 
  ArrowUpRight, 
  CandlestickChart, 
  Check, 
  FileText, 
  Filter, 
  Flame, 
  Globe, 
  Newspaper, 
  Plus, 
  Search, 
  Sparkles, 
  Tag 
} from 'lucide-react';
import { CatalystType, NewsItem, TickerQuote } from '../types/trading';
import { formatDateTime } from '../utils/formatters';

interface NewsCatalystsTabProps {
  news: NewsItem[];
  universe: TickerQuote[];
  onSelectTicker: (symbol: string) => void;
  onAddToWatchlist: (symbol: string) => void;
  onNavigateToTab: (tab: string) => void;
  onAddCustomNews: (item: NewsItem) => void;
}

export const NewsCatalystsTab: React.FC<NewsCatalystsTabProps> = ({
  news,
  universe,
  onSelectTicker,
  onAddToWatchlist,
  onNavigateToTab,
  onAddCustomNews,
}) => {
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // New Custom Tag Form state
  const [customTicker, setCustomTicker] = useState<string>('NVDA');
  const [customHeadline, setCustomHeadline] = useState<string>('');
  const [customSummary, setCustomSummary] = useState<string>('');
  const [customCatalystType, setCustomCatalystType] = useState<CatalystType>('EARNINGS');
  const [customImpact, setCustomImpact] = useState<'HIGH' | 'MEDIUM' | 'SPECULATIVE'>('HIGH');

  const filteredNews = news.filter(item => {
    if (selectedType !== 'ALL' && item.catalystType !== selectedType) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        item.ticker.toLowerCase().includes(q) ||
        item.headline.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleCreateCatalyst = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customHeadline.trim()) return;

    onAddCustomNews({
      id: `custom-news-${Date.now()}`,
      ticker: customTicker.toUpperCase().trim(),
      headline: customHeadline.trim(),
      source: 'Trader Desk Note',
      publishedAt: new Date().toISOString(),
      summary: customSummary.trim() || customHeadline.trim(),
      catalystType: customCatalystType,
      catalystConfidence: customImpact,
      sentiment: 'BULLISH',
      isTaggedCatalyst: true,
    });

    setIsModalOpen(false);
    setCustomHeadline('');
    setCustomSummary('');
  };

  return (
    <div className="space-y-4">
      {/* Header & Filter Controls */}
      <div className="bg-[#161B22] p-4 rounded-lg border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Newspaper className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-bold text-slate-100">News & Catalyst Identification Feed</h2>
              <p className="text-xs text-slate-400">Classify market movers by verified catalyst (Earnings, SEC filings, FDA, Contracts) vs. speculative flows.</p>
            </div>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-md self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            Tag Catalyst
          </button>
        </div>

        {/* Catalyst Filter Tags */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800 text-xs">
          <span className="text-slate-500 font-semibold uppercase tracking-wider text-[11px]">Filter Type:</span>
          {[
            { key: 'ALL', label: 'All Feeds' },
            { key: 'EARNINGS', label: 'Earnings Beat / Guidance' },
            { key: 'FDA_BIO', label: 'FDA / Clinical Approvals' },
            { key: 'CONTRACT_NEWS', label: 'Defense / Enterprise Contracts' },
            { key: 'PRODUCT_LAUNCH', label: 'Product & AI Rollouts' },
            { key: 'SEC_FILING', label: 'SEC Edgar Filings' },
            { key: 'MOMENTUM_SPECULATIVE', label: 'Unexplained / Speculative Squeezes' },
          ].map(tag => (
            <button
              key={tag.key}
              onClick={() => setSelectedType(tag.key)}
              className={`px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                selectedType === tag.key
                  ? 'bg-emerald-950 border-emerald-700 text-emerald-300 font-bold'
                  : 'bg-[#0B0E14] border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {tag.label}
            </button>
          ))}
        </div>
      </div>

      {/* News Feed Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredNews.map(item => {
          const matchingQuote = universe.find(u => u.symbol === item.ticker);
          return (
            <div
              key={item.id}
              className="bg-[#161B22] border border-slate-800 rounded-lg p-4 shadow-md hover:border-slate-700 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center space-x-2">
                    <span 
                      className="font-bold text-white font-mono text-base cursor-pointer hover:underline"
                      onClick={() => {
                        onSelectTicker(item.ticker);
                        onNavigateToTab('charts');
                      }}
                    >
                      {item.ticker}
                    </span>
                    {matchingQuote && (
                      <span className={`text-xs font-mono font-bold ${matchingQuote.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {matchingQuote.change >= 0 ? '+' : ''}{matchingQuote.changePercent.toFixed(2)}%
                      </span>
                    )}
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono">
                      {item.catalystType.replace('_', ' ')}
                    </span>
                  </div>

                  <span className="text-[11px] text-slate-500 font-mono">
                    {formatDateTime(item.publishedAt)}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-100 mb-1.5 leading-snug">
                  {item.headline}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-3">
                  {item.summary}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Source: {item.source}</span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onAddToWatchlist(item.ticker)}
                    className="text-slate-400 hover:text-white flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3 text-emerald-400" /> Watchlist
                  </button>
                  <button
                    onClick={() => {
                      onSelectTicker(item.ticker);
                      onNavigateToTab('charts');
                    }}
                    className="text-emerald-400 hover:underline font-semibold flex items-center gap-1"
                  >
                    <CandlestickChart className="w-3.5 h-3.5" /> Chart
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Manual Tag Catalyst Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#161B22] border border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Tag className="w-5 h-5 text-emerald-400" />
                Tag Stock Catalyst
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCatalyst} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 font-mono">
                <div>
                  <label className="text-slate-400 block mb-1 font-sans">Ticker Symbol</label>
                  <input
                    type="text"
                    required
                    value={customTicker}
                    onChange={e => setCustomTicker(e.target.value)}
                    className="w-full bg-[#0B0E14] border border-slate-800 rounded-lg p-2 text-slate-100 uppercase font-bold"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1 font-sans">Catalyst Type</label>
                  <select
                    value={customCatalystType}
                    onChange={e => setCustomCatalystType(e.target.value as CatalystType)}
                    className="w-full bg-[#0B0E14] border border-slate-800 rounded-lg p-2 text-slate-100 font-sans"
                  >
                    <option value="EARNINGS">Earnings Beat / Guidance</option>
                    <option value="FDA_BIO">FDA / Clinical Trial</option>
                    <option value="CONTRACT_NEWS">Defense / Major Contract</option>
                    <option value="PRODUCT_LAUNCH">Product / AI Launch</option>
                    <option value="SEC_FILING">SEC Filing</option>
                    <option value="MOMENTUM_SPECULATIVE">Unexplained / Speculative Mover</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-sans">Headline / Catalyst Event</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q2 Revenue beat by 25% with $500M share buyback"
                  value={customHeadline}
                  onChange={e => setCustomHeadline(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-slate-800 rounded-lg p-2 text-slate-100 font-sans"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-sans">Context / Notes</label>
                <textarea
                  rows={2}
                  placeholder="Why this catalyst matters for intermediate price momentum..."
                  value={customSummary}
                  onChange={e => setCustomSummary(e.target.value)}
                  className="w-full bg-[#0B0E14] border border-slate-800 rounded-lg p-2 text-slate-100 font-sans"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow-md"
                >
                  Save Catalyst Tag
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
