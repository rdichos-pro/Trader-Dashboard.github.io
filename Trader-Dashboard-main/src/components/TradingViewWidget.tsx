import React, { useMemo, useState, memo } from 'react';

export interface TradingViewWidgetProps {
  symbol: string;
  interval?: string; // '1', '5', '15', '60', '240', 'D', 'W'
  theme?: 'dark' | 'light';
  hideSideToolbar?: boolean;
  hideTopToolbar?: boolean;
  containerHeight?: string | number;
  height?: string | number;
  containerId?: string;
  className?: string;
  studies?: string[];
}

export function formatTradingViewSymbol(symbol?: string): string {
  if (!symbol || typeof symbol !== 'string') return 'NASDAQ:NVDA';
  const clean = symbol.toUpperCase().trim();
  if (!clean) return 'NASDAQ:NVDA';
  if (clean.includes(':')) return clean;

  if (clean === 'XAUUSD' || clean === 'GOLD') return 'OANDA:XAUUSD';
  if (clean === 'EURUSD') return 'FX:EURUSD';
  if (clean === 'GBPUSD') return 'FX:GBPUSD';
  if (clean === 'USDJPY') return 'FX:USDJPY';
  if (clean === 'BTCUSD' || clean === 'BTC') return 'BINANCE:BTCUSDT';
  if (clean === 'ETHUSD' || clean === 'ETH') return 'BINANCE:ETHUSDT';

  // Specific NYSE listings
  const nyseList = new Set([
    'BBAI', 'IONQ', 'HIMS', 'JOBY', 'ACHR', 'PLTR', 'JPM', 'UNH', 'V', 'LLY', 'WMT', 'DIS', 'BA', 'BRK.A', 'BRK.B', 
    'NKE', 'KO', 'PEP', 'MCD', 'IBM', 'GE', 'XOM', 'CVX', 'PG', 'ZTS', 'AI', 'SNOW', 'UBER', 'CRM', 'ORCL',
    'CAT', 'HD', 'DE', 'RTX', 'LMT', 'GD', 'NOC', 'BAC', 'GS', 'MS', 'C', 'PFE', 'ABBV', 'MRK', 'BMY', 'T', 'VZ'
  ]);
  if (nyseList.has(clean)) return `NYSE:${clean}`;

  // Specific AMEX / ETF listings
  const amexList = new Set(['SPY', 'IWM', 'DIA', 'XLK', 'XLF', 'XLE', 'GLD', 'SLV', 'TLT']);
  if (amexList.has(clean)) return `AMEX:${clean}`;

  // Specific NASDAQ listings
  const nasdaqList = new Set([
    'NVDA', 'TSLA', 'AAPL', 'AMD', 'MSFT', 'AMZN', 'META', 'GOOGL', 'GOOG', 'SMCI', 'ASTS', 'COIN',
    'CRWD', 'SOFI', 'HOOD', 'QQQ', 'ENPH', 'RIVN', 'DKNG', 'SOUN', 'RGTI', 'CIFR', 'POET', 'LUNR', 'PLUG'
  ]);
  if (nasdaqList.has(clean)) return `NASDAQ:${clean}`;

  // For any other equity, let TradingView auto-resolve the exchange rather than guessing NASDAQ
  return clean;
}

export const DEFAULT_STRATEGY_STUDIES = [
  'Volume@tv-basicstudies',
  'IchimokuCloud@tv-basicstudies',
  'Stochastic@tv-basicstudies',
  'CCI@tv-basicstudies',
];

// Monochrome candle scheme applied to every chart in the app: light grey for bullish
// (up) candles, a darker grey for bearish (down) candles — two Tailwind grey steps
// apart (gray-300 -> gray-500) so they stay distinguishable without using red/green.
export const CANDLE_COLORS = {
  up: '#D1D5DB',   // Tailwind gray-300
  down: '#6B7280', // Tailwind gray-500
};

export const TradingViewWidget: React.FC<TradingViewWidgetProps> = memo(({
  symbol,
  interval = '240',
  theme = 'dark',
  hideSideToolbar = false, // Allow drawing tools by default so users can use native Long & Short position tools
  hideTopToolbar = false,
  containerHeight = '100%',
  height,
  containerId,
  className = '',
  studies = DEFAULT_STRATEGY_STUDIES,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const formattedSymbol = formatTradingViewSymbol(symbol);
  const effectiveHeight = height || containerHeight;

  const iframeSrc = useMemo(() => {
    const rawStudies = studies && studies.length > 0 ? studies : DEFAULT_STRATEGY_STUDIES;
    // Normalize study names (e.g. CommodityChannelIndex -> CCI for TradingView)
    const activeStudies = rawStudies.map(s => 
      s === 'CommodityChannelIndex@tv-basicstudies' ? 'CCI@tv-basicstudies' : s
    );
    const config = {
      autosize: true,
      symbol: formattedSymbol,
      interval: interval || '240',
      timezone: 'Etc/UTC',
      theme: theme,
      style: '1',
      locale: 'en',
      enable_publishing: false,
      allow_symbol_change: true,
      calendar: false,
      hide_side_toolbar: hideSideToolbar,
      hide_top_toolbar: hideTopToolbar,
      hide_legend: false,
      save_image: true,
      details: true,
      hotlist: false,
      calendar_events: false,
      studies: activeStudies,
      support_host: 'https://www.tradingview.com',
      overrides: {
        'mainSeriesProperties.candleStyle.upColor': CANDLE_COLORS.up,
        'mainSeriesProperties.candleStyle.downColor': CANDLE_COLORS.down,
        'mainSeriesProperties.candleStyle.borderUpColor': CANDLE_COLORS.up,
        'mainSeriesProperties.candleStyle.borderDownColor': CANDLE_COLORS.down,
        'mainSeriesProperties.candleStyle.wickUpColor': CANDLE_COLORS.up,
        'mainSeriesProperties.candleStyle.wickDownColor': CANDLE_COLORS.down,
      },
    };
    return `https://www.tradingview-widget.com/embed-widget/advanced-chart/?locale=en#${encodeURIComponent(JSON.stringify(config))}`;
  }, [formattedSymbol, interval, theme, hideSideToolbar, hideTopToolbar, studies]);

  return (
    <div 
      id={containerId}
      className={`tradingview-widget-container w-full rounded-xl overflow-hidden bg-[#161B22] border border-slate-800 shadow-2xl relative flex flex-col min-h-[360px] sm:min-h-[480px] ${className}`}
      style={{ height: effectiveHeight }}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-500 font-mono text-xs z-0 pointer-events-none bg-[#161B22]">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Loading TradingView Chart ({formattedSymbol})...
          </span>
        </div>
      )}
      <iframe
        key={iframeSrc}
        title={`TradingView Chart ${formattedSymbol}`}
        src={iframeSrc}
        onLoad={() => setIsLoading(false)}
        className="w-full h-full flex-1 border-0 z-10 relative"
        style={{ width: '100%', height: '100%', minHeight: '100%', border: 'none' }}
        allow="fullscreen"
      />
    </div>
  );
});
