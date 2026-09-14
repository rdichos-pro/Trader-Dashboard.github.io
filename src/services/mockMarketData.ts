import { Candle, CatalystInfo, NewsItem, TickerQuote } from '../types/trading';

export interface StockProfile {
  symbol: string;
  name: string;
  basePrice: number;
  avgVolume: number;
  marketCap: number; // in dollars
  floatShares: number;
  sector: string;
  catalyst?: CatalystInfo;
}

export const STOCK_UNIVERSE: StockProfile[] = [
  {
    symbol: 'NVDA',
    name: 'NVIDIA Corporation',
    basePrice: 128.50,
    avgVolume: 48500000,
    marketCap: 3150000000000,
    floatShares: 24200000000,
    sector: 'Semiconductors',
    catalyst: {
      type: 'EARNINGS',
      headline: 'Q2 Data Center revenue beats expectations (+122% YoY) as Blackwell GPU ramp begins',
      date: '2026-08-28',
      impact: 'HIGH',
      details: 'Demand for Rubin & Blackwell architectures outpaces supply through next fiscal year.',
    },
  },
  {
    symbol: 'TSLA',
    name: 'Tesla, Inc.',
    basePrice: 218.40,
    avgVolume: 62100000,
    marketCap: 698000000000,
    floatShares: 2750000000,
    sector: 'Automotive & Clean Tech',
    catalyst: {
      type: 'PRODUCT_LAUNCH',
      headline: 'Autonomous Cybercab robotaxi platform road certification approved in key test markets',
      date: '2026-08-29',
      impact: 'HIGH',
      details: 'Commercial driverless ride-hailing permits granted in Nevada and Texas.',
    },
  },
  {
    symbol: 'PLTR',
    name: 'Palantir Technologies Inc.',
    basePrice: 31.85,
    avgVolume: 38200000,
    marketCap: 71200000000,
    floatShares: 2150000000,
    sector: 'Enterprise Software & AI',
    catalyst: {
      type: 'CONTRACT_NEWS',
      headline: 'Department of Defense expands Project Maven AI infrastructure deal by $480M',
      date: '2026-08-27',
      impact: 'HIGH',
      details: 'Five-year enterprise contract deployment across unified command centers.',
    },
  },
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    basePrice: 226.75,
    avgVolume: 44300000,
    marketCap: 3450000000000,
    floatShares: 15300000000,
    sector: 'Consumer Electronics',
    catalyst: {
      type: 'PRODUCT_LAUNCH',
      headline: 'Apple Intelligence iOS 18 rollout accelerates high-tier iPhone upgrade cycle',
      date: '2026-08-25',
      impact: 'MEDIUM',
    },
  },
  {
    symbol: 'AMD',
    name: 'Advanced Micro Devices, Inc.',
    basePrice: 477.50,
    avgVolume: 36800000,
    marketCap: 770000000000,
    floatShares: 1610000000,
    sector: 'Semiconductors',
    catalyst: {
      type: 'ANALYST_UPGRADE',
      headline: 'Morgan Stanley upgrades to Overweight citing MI325X server accelerator traction',
      date: '2026-08-29',
      impact: 'MEDIUM',
    },
  },
  {
    symbol: 'SMCI',
    name: 'Super Micro Computer, Inc.',
    basePrice: 42.60,
    avgVolume: 28400000,
    marketCap: 25100000000,
    floatShares: 540000000,
    sector: 'Hardware & AI Infrastructure',
    catalyst: {
      type: 'MOMENTUM_SPECULATIVE',
      headline: 'High short interest squeeze with elevated options volume in liquid-cooling rack business',
      date: '2026-08-30',
      impact: 'SPECULATIVE',
    },
  },
  {
    symbol: 'ASTS',
    name: 'AST SpaceMobile, Inc.',
    basePrice: 27.40,
    avgVolume: 19500000,
    marketCap: 7400000000,
    floatShares: 195000000,
    sector: 'Space & Telecommunications',
    catalyst: {
      type: 'PRODUCT_LAUNCH',
      headline: 'BlueBird orbital satellites successfully deploy arrays for direct-to-cell 5G broadband',
      date: '2026-08-26',
      impact: 'HIGH',
      details: 'Commercial cellular partner testing with AT&T and Verizon begins next month.',
    },
  },
  {
    symbol: 'IONQ',
    name: 'IonQ, Inc.',
    basePrice: 14.80,
    avgVolume: 12400000,
    marketCap: 3200000000,
    floatShares: 185000000,
    sector: 'Quantum Computing',
    catalyst: {
      type: 'CONTRACT_NEWS',
      headline: 'National Science Foundation quantum compute cloud allocation award',
      date: '2026-08-28',
      impact: 'MEDIUM',
    },
  },
  {
    symbol: 'COIN',
    name: 'Coinbase Global, Inc.',
    basePrice: 194.20,
    avgVolume: 8900000,
    marketCap: 47800000000,
    floatShares: 205000000,
    sector: 'Fintech & Crypto',
    catalyst: {
      type: 'SEC_FILING',
      headline: 'Base L2 network transactions hit all-time high with institutional custody expansion',
      date: '2026-08-29',
      impact: 'MEDIUM',
    },
  },
  {
    symbol: 'CRWD',
    name: 'CrowdStrike Holdings, Inc.',
    basePrice: 284.10,
    avgVolume: 5100000,
    marketCap: 69200000000,
    floatShares: 236000000,
    sector: 'Cybersecurity',
    catalyst: {
      type: 'EARNINGS',
      headline: 'Falcon platform ARR surpasses $4B with 98% gross customer retention rate',
      date: '2026-08-27',
      impact: 'HIGH',
    },
  },
  {
    symbol: 'SOFI',
    name: 'SoFi Technologies, Inc.',
    basePrice: 8.65,
    avgVolume: 31200000,
    marketCap: 8900000000,
    floatShares: 980000000,
    sector: 'Fintech & Banking',
    catalyst: {
      type: 'EARNINGS',
      headline: 'Loan origination volume surges 34% with record net deposits in Galileo tech platform',
      date: '2026-08-26',
      impact: 'MEDIUM',
    },
  },
  {
    symbol: 'HOOD',
    name: 'Robinhood Markets, Inc.',
    basePrice: 21.30,
    avgVolume: 14500000,
    marketCap: 18700000000,
    floatShares: 720000000,
    sector: 'Fintech & Brokerage',
    catalyst: {
      type: 'PRODUCT_LAUNCH',
      headline: 'Desktop trader suite and European margin trading expansion goes live',
      date: '2026-08-28',
      impact: 'MEDIUM',
    },
  },
  {
    symbol: 'LLY',
    name: 'Eli Lilly and Company',
    basePrice: 945.00,
    avgVolume: 2800000,
    marketCap: 898000000000,
    floatShares: 940000000,
    sector: 'Biopharma & Healthcare',
    catalyst: {
      type: 'FDA_BIO',
      headline: 'FDA grants priority review for next-gen oral GLP-1 orforglipron Phase 3 trial data',
      date: '2026-08-24',
      impact: 'HIGH',
    },
  },
  {
    symbol: 'META',
    name: 'Meta Platforms, Inc.',
    basePrice: 512.40,
    avgVolume: 11200000,
    marketCap: 1300000000000,
    floatShares: 2200000000,
    sector: 'Interactive Media & AI',
    catalyst: {
      type: 'PRODUCT_LAUNCH',
      headline: 'Llama 4 frontier open-weights model announcement with Ray-Ban AI smartglasses sales surge',
      date: '2026-08-28',
      impact: 'HIGH',
    },
  },
  {
    symbol: 'AMZN',
    name: 'Amazon.com, Inc.',
    basePrice: 178.60,
    avgVolume: 29500000,
    marketCap: 1860000000000,
    floatShares: 9800000000,
    sector: 'E-commerce & Cloud',
    catalyst: {
      type: 'CONTRACT_NEWS',
      headline: 'AWS lands enterprise multi-year generative AI contracts with Fortune 500 financial institutions',
      date: '2026-08-27',
      impact: 'MEDIUM',
    },
  },
  {
    symbol: 'MSFT',
    name: 'Microsoft Corporation',
    basePrice: 416.80,
    avgVolume: 17800000,
    marketCap: 3090000000000,
    floatShares: 7420000000,
    sector: 'Enterprise Software & Cloud',
    catalyst: {
      type: 'PRODUCT_LAUNCH',
      headline: 'Copilot enterprise paid seats climb above 40 million active monthly knowledge workers',
      date: '2026-08-26',
      impact: 'MEDIUM',
    },
  },
  {
    symbol: 'SPY',
    name: 'SPDR S&P 500 ETF Trust',
    basePrice: 562.80,
    avgVolume: 52000000,
    marketCap: 560000000000,
    floatShares: 990000000,
    sector: 'Index ETF',
  },
  {
    symbol: 'QQQ',
    name: 'Invesco QQQ Trust Series 1',
    basePrice: 486.20,
    avgVolume: 41000000,
    marketCap: 280000000000,
    floatShares: 580000000,
    sector: 'Index ETF',
  },
  {
    symbol: 'IWM',
    name: 'iShares Russell 2000 ETF',
    basePrice: 221.50,
    avgVolume: 27000000,
    marketCap: 68000000000,
    floatShares: 310000000,
    sector: 'Small Cap Index ETF',
  },
  {
    symbol: 'ENPH',
    name: 'Enphase Energy, Inc.',
    basePrice: 98.40,
    avgVolume: 4200000,
    marketCap: 13200000000,
    floatShares: 134000000,
    sector: 'Solar & Clean Energy',
    catalyst: {
      type: 'ANALYST_UPGRADE',
      headline: 'European residential battery installation inventory normalization signals bottom',
      date: '2026-08-29',
      impact: 'MEDIUM',
    },
  },
  {
    symbol: 'RIVN',
    name: 'Rivian Automotive, Inc.',
    basePrice: 13.75,
    avgVolume: 24500000,
    marketCap: 13900000000,
    floatShares: 950000000,
    sector: 'Automotive & EV',
    catalyst: {
      type: 'CONTRACT_NEWS',
      headline: 'Volkswagen Group joint venture software architecture milestone cash injection completed',
      date: '2026-08-28',
      impact: 'HIGH',
    },
  },
  {
    symbol: 'DKNG',
    name: 'DraftKings Inc.',
    basePrice: 38.90,
    avgVolume: 8400000,
    marketCap: 18900000000,
    floatShares: 460000000,
    sector: 'Gaming & Sports Betting',
    catalyst: {
      type: 'SEC_FILING',
      headline: 'NFL season kickoff sportsbook handle up 28% YoY with positive EBITDA guidance',
      date: '2026-08-29',
      impact: 'MEDIUM',
    },
  },
  {
    symbol: 'HIMS',
    name: 'Hims & Hers Health, Inc.',
    basePrice: 16.85,
    avgVolume: 16400000,
    marketCap: 3620000000,
    floatShares: 192000000,
    sector: 'Digital Health & Telehealth',
    catalyst: {
      type: 'EARNINGS',
      headline: 'Subscriber count crosses 2M with personalized GLP-1 weight management revenue +82% YoY',
      date: '2026-08-29',
      impact: 'HIGH',
      details: 'Full-year free cash flow raised by $45M as gross margins expand to 82%.',
    },
  },
  {
    symbol: 'SOUN',
    name: 'SoundHound AI, Inc.',
    basePrice: 5.42,
    avgVolume: 22100000,
    marketCap: 1850000000,
    floatShares: 245000000,
    sector: 'Conversational Voice AI',
    catalyst: {
      type: 'CONTRACT_NEWS',
      headline: 'Leading Tier-1 global automaker integrates SoundHound generative in-vehicle voice assistant',
      date: '2026-08-28',
      impact: 'HIGH',
    },
  },
  {
    symbol: 'BBAI',
    name: 'BigBear.ai Holdings, Inc.',
    basePrice: 2.18,
    avgVolume: 18900000,
    marketCap: 520000000,
    floatShares: 122000000,
    sector: 'Defense & National Security AI',
    catalyst: {
      type: 'CONTRACT_NEWS',
      headline: 'Awarded $165M US Army battlefield situational awareness & decision support contract',
      date: '2026-08-30',
      impact: 'HIGH',
      details: 'Sub-$3 small cap defense runner experiencing explosive institutional volume.',
    },
  },
  {
    symbol: 'RGTI',
    name: 'Rigetti Computing, Inc.',
    basePrice: 1.48,
    avgVolume: 14200000,
    marketCap: 285000000,
    floatShares: 148000000,
    sector: 'Quantum Computing Hardware',
    catalyst: {
      type: 'PRODUCT_LAUNCH',
      headline: 'Achieves 99.5% 2-qubit gate fidelity on 84-qubit Ankaa-3 quantum processor architecture',
      date: '2026-08-27',
      impact: 'MEDIUM',
    },
  },
  {
    symbol: 'JOBY',
    name: 'Joby Aviation, Inc.',
    basePrice: 5.35,
    avgVolume: 11800000,
    marketCap: 3890000000,
    floatShares: 620000000,
    sector: 'Aerospace & eVTOL Air Taxi',
    catalyst: {
      type: 'PRODUCT_LAUNCH',
      headline: 'FAA Stage 4 airworthiness certification completed; Dubai commercial passenger flights on schedule',
      date: '2026-08-29',
      impact: 'HIGH',
    },
  },
  {
    symbol: 'ACHR',
    name: 'Archer Aviation Inc.',
    basePrice: 4.18,
    avgVolume: 10500000,
    marketCap: 1420000000,
    floatShares: 260000000,
    sector: 'Aerospace & Urban Air Mobility',
    catalyst: {
      type: 'CONTRACT_NEWS',
      headline: 'Stellantis injects $55M milestone manufacturing funding for Midnight aircraft production line',
      date: '2026-08-28',
      impact: 'HIGH',
    },
  },
  {
    symbol: 'CIFR',
    name: 'Cipher Mining Inc.',
    basePrice: 3.92,
    avgVolume: 15300000,
    marketCap: 1210000000,
    floatShares: 220000000,
    sector: 'HPC Data Centers & Bitcoin Infrastructure',
    catalyst: {
      type: 'CONTRACT_NEWS',
      headline: 'Acquires 300MW Texas high-voltage interconnect site for hyperscale AI compute hosting',
      date: '2026-08-29',
      impact: 'HIGH',
    },
  },
  {
    symbol: 'POET',
    name: 'POET Technologies Inc.',
    basePrice: 3.72,
    avgVolume: 7800000,
    marketCap: 245000000,
    floatShares: 42000000,
    sector: 'Optical Interposers & Semiconductors',
    catalyst: {
      type: 'PRODUCT_LAUNCH',
      headline: 'Low-float optical interposer orders surge for 800G and 1.6T AI cluster transceivers',
      date: '2026-08-30',
      impact: 'HIGH',
      details: 'Ultra-low float under 50M shares with high squeeze potential.',
    },
  },
  {
    symbol: 'LUNR',
    name: 'Intuitive Machines, Inc.',
    basePrice: 5.88,
    avgVolume: 13500000,
    marketCap: 720000000,
    floatShares: 85000000,
    sector: 'Space Exploration & Infrastructure',
    catalyst: {
      type: 'CONTRACT_NEWS',
      headline: 'NASA selects Intuitive Machines for $4.82B Near Space Network communications architecture',
      date: '2026-08-30',
      impact: 'HIGH',
    },
  },
  {
    symbol: 'PLUG',
    name: 'Plug Power Inc.',
    basePrice: 2.28,
    avgVolume: 28400000,
    marketCap: 1980000000,
    floatShares: 740000000,
    sector: 'Hydrogen & Clean Energy',
    catalyst: {
      type: 'SEC_FILING',
      headline: 'DOE $1.66B loan guarantee conditional approval for green hydrogen generation plants',
      date: '2026-08-26',
      impact: 'MEDIUM',
    },
  },
  {
    symbol: 'XAUUSD',
    name: 'Gold / US Dollar (Spot)',
    basePrice: 2515.40,
    avgVolume: 12500000,
    marketCap: 16000000000000,
    floatShares: 1000000000,
    sector: 'Precious Metals & FX',
    catalyst: {
      type: 'MOMENTUM_SPECULATIVE',
      headline: 'Global central bank physical gold demand and rate-easing cycle support safe-haven breakout',
      date: '2026-08-30',
      impact: 'HIGH',
      details: 'Intraday gold volatility elevated around London-NY session crossover; 5m and 15m trend structure active.',
    },
  },
];

/**
 * Deterministic pseudo-random number generator for reproducible historical charts
 */
function seededRandom(seed: number) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

/**
 * Generates historical candles for a stock or asset (resolution: '1' for 1-Min, '5' for 5-Min, '15' for 15-Min, '30' for 30-Min, '60', '240' for 4-Hour, 'D' for Daily)
 */
export function generateHistoricalCandles(
  symbol: string, 
  profile?: StockProfile,
  resolution: 'D' | '240' | '60' | '30' | '15' | '5' | '1' = '240'
): Candle[] {
  const stock = profile || STOCK_UNIVERSE.find(s => s.symbol === symbol) || {
    symbol,
    name: symbol,
    basePrice: symbol.toUpperCase() === 'XAUUSD' || symbol.toUpperCase() === 'GOLD' ? 2515.40 : 100,
    avgVolume: 10000000,
    marketCap: 10000000000,
    floatShares: 100000000,
    sector: 'Commodities',
  };

  const candles: Candle[] = [];
  const isIntraday = resolution === '1' || resolution === '5' || resolution === '15' || resolution === '30' || resolution === '60' || resolution === '240';
  const is1m = resolution === '1';
  const is5m = resolution === '5';
  const is15m = resolution === '15';
  const is30m = resolution === '30';
  const is60m = resolution === '60';
  const is4H = resolution === '240';

  // 32,000 1-min bars = ~22 trading days (24/5) = 1 Full Calendar Month (~30-31 calendar days)
  // 18,500 5-min bars = ~65 trading days = >3.2 months (92+ calendar days)
  // 6,500 15-min bars = ~68 trading days = >3.3 months
  // 4,500 30-min bars = ~93 trading days = >4.5 months
  // 2,400 60-min bars = ~100 trading days
  // 650 4H bars = ~108 trading days
  // 300 Daily bars = ~1.2 years
  const totalBars = is1m ? 32000 : is5m ? 18500 : is15m ? 6500 : is30m ? 4500 : is60m ? 2400 : is4H ? 650 : 300;
  const now = new Date();

  let currentPrice = stock.basePrice * (is1m || is5m || is15m || is30m ? 0.94 : is4H ? 0.85 : 0.78);
  let seed = symbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 100);
  let momentum = 0;

  const stepMs = is1m
    ? 1 * 60 * 1000
    : is5m 
    ? 5 * 60 * 1000 
    : is15m 
    ? 15 * 60 * 1000 
    : is30m 
    ? 30 * 60 * 1000 
    : is60m 
    ? 60 * 60 * 1000 
    : is4H 
    ? 4 * 60 * 60 * 1000 
    : 24 * 60 * 60 * 1000;

  for (let i = totalBars; i >= 0; i--) {
    const d = new Date(now.getTime() - i * stepMs);
    // For forex/gold, trading is 24/5; skip Saturday 00:00 to Sunday 21:00 UTC
    const utcDay = d.getUTCDay();
    const utcHour = d.getUTCHours();
    const isWeekend = utcDay === 6 || (utcDay === 0 && utcHour < 21);
    if (isWeekend) continue;

    seed += 1;
    const r1 = seededRandom(seed);
    const r2 = seededRandom(seed + 1);
    const r3 = seededRandom(seed + 2);
    const r4 = seededRandom(seed + 3);

    // Trend bias towards basePrice as we approach today
    const targetPrice = stock.basePrice;
    const pullRate = is1m ? 0.0003 : is5m ? 0.0006 : is15m ? 0.0012 : is30m ? 0.002 : is60m ? 0.0035 : is4H ? 0.008 : 0.015;
    const pull = (targetPrice - currentPrice) * pullRate;
    
    // Autocorrelated momentum to simulate authentic macro trend waves
    const noise = (r1 - 0.488);
    const momentumPersistence = is1m ? 0.78 : is5m ? 0.82 : is15m ? 0.85 : is60m ? 0.88 : is4H ? 0.90 : 0.85;
    momentum = momentum * momentumPersistence + noise * (1 - momentumPersistence);

    // Volatility
    const volatility = is1m ? 0.0009 : is5m ? 0.0016 : is15m ? 0.0026 : is60m ? 0.0045 : is4H ? 0.009 : 0.018;
    const change = (momentum * 2.2 + noise * 0.4) * volatility * currentPrice + pull;
    
    const open = currentPrice;
    const close = Math.max(1, currentPrice + change);
    const spreadMultiplier = is1m ? 0.0008 : is5m || is15m ? 0.0015 : is4H ? 0.008 : 0.015;
    const high = Math.max(open, close) + r2 * (currentPrice * spreadMultiplier);
    const low = Math.min(open, close) - r3 * (currentPrice * spreadMultiplier);

    // Volume with occasional spike
    const isSpike = r4 > 0.88;
    const volMultiplier = isSpike ? (1.8 + r1 * 2.2) : (0.7 + r1 * 0.6);
    const baseVol = is1m ? Math.floor(stock.avgVolume / 60) : is5m || is15m ? Math.floor(stock.avgVolume / 20) : is4H ? Math.floor(stock.avgVolume / 2) : stock.avgVolume;
    const volume = Math.floor(baseVol * volMultiplier);

    candles.push({
      time: isIntraday ? d.toISOString().slice(0, 16).replace('T', ' ') : d.toISOString().split('T')[0],
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume,
    });

    currentPrice = close;
  }

  // Adjust last candle close to match stock.basePrice closely
  if (candles.length > 0) {
    const last = candles[candles.length - 1];
    last.close = stock.basePrice;
    last.high = Math.max(last.high, stock.basePrice + (is4H ? 0.8 : 1.2));
    last.low = Math.min(last.low, stock.basePrice - (is4H ? 0.8 : 1.2));
  }

  return candles;
}

/**
 * Builds live quote from stock profile, 4H candles, and daily candles
 */
export function buildTickerQuote(
  profile: StockProfile, 
  fourHourCandles?: Candle[],
  dailyCandles?: Candle[]
): TickerQuote {
  const candles4H = fourHourCandles || generateHistoricalCandles(profile.symbol, profile, '240');
  const candlesD = dailyCandles || generateHistoricalCandles(profile.symbol, profile, 'D');

  const last4HCandle = candles4H[candles4H.length - 1];
  const prev4HCandle = candles4H[candles4H.length - 2] || last4HCandle;

  const price = last4HCandle.close;
  const previousClose = prev4HCandle.close;
  
  // 4-Hour change metrics
  const fourHourOpen = last4HCandle.open;
  const fourHourHigh = last4HCandle.high;
  const fourHourLow = last4HCandle.low;
  const fourHourChange = Number((price - fourHourOpen).toFixed(2));
  const fourHourChangePercent = fourHourOpen > 0 
    ? Number(((fourHourChange / fourHourOpen) * 100).toFixed(2)) 
    : 0;

  const dailyCloses = candlesD.map(bar => bar.close);
  const high52W = Math.max(...dailyCloses, price);
  const low52W = Math.min(...dailyCloses, price);

  // 20D macro trend sparkline strictly from daily candles
  const sparkline = dailyCloses.slice(-20);
  // 20-period 4H trend sparkline from 4H candles
  const closes4H = candles4H.map(bar => bar.close);
  const sparkline4H = closes4H.slice(-20);
  const rvol = profile.avgVolume > 0 ? Number((last4HCandle.volume / (profile.avgVolume / 2)).toFixed(2)) : 1.0;

  let marketCapCategory: TickerQuote['marketCapCategory'] = 'MID';
  if (profile.marketCap >= 200000000000) marketCapCategory = 'MEGA';
  else if (profile.marketCap >= 10000000000) marketCapCategory = 'LARGE';
  else if (profile.marketCap >= 2000000000) marketCapCategory = 'MID';
  else if (profile.marketCap >= 300000000) marketCapCategory = 'SMALL';
  else marketCapCategory = 'MICRO';

  return {
    symbol: profile.symbol,
    name: profile.name,
    price: Number(price.toFixed(2)),
    change: fourHourChange,
    changePercent: fourHourChangePercent,
    open: fourHourOpen,
    high: fourHourHigh,
    low: fourHourLow,
    fourHourHigh,
    fourHourLow,
    fourHourOpen,
    fourHourChange,
    fourHourChangePercent,
    previousClose: Number(previousClose.toFixed(2)),
    volume: last4HCandle.volume,
    avgVolume30D: profile.avgVolume,
    rvol,
    marketCap: profile.marketCap,
    marketCapCategory,
    floatShares: profile.floatShares,
    high52W: Number(high52W.toFixed(2)),
    low52W: Number(low52W.toFixed(2)),
    sector: profile.sector,
    catalyst: profile.catalyst,
    sparkline,
    sparkline4H,
    lastUpdated: new Date().toISOString(),
    isStale: false,
  };
}

export const INITIAL_NEWS_FEED: NewsItem[] = [
  {
    id: 'news-1',
    ticker: 'NVDA',
    headline: 'NVIDIA Expands Custom Silicon & Blackwell Ultra Platform Deliveries for Hyperscalers',
    source: 'Bloomberg Technology',
    publishedAt: '2026-08-30T18:30:00Z',
    summary: 'Cloud providers increase FY26 capital expenditure commitments to secure next-gen compute nodes.',
    catalystType: 'EARNINGS',
    catalystConfidence: 'HIGH',
    sentiment: 'BULLISH',
    isTaggedCatalyst: true,
  },
  {
    id: 'news-2',
    ticker: 'PLTR',
    headline: 'Defense Innovation Unit Awards Palantir Enterprise Edge AI Modernization Contract',
    source: 'Defense One',
    publishedAt: '2026-08-30T17:15:00Z',
    summary: 'Tactical edge deployments expand real-time sensor fusion across allied naval task forces.',
    catalystType: 'CONTRACT_NEWS',
    catalystConfidence: 'HIGH',
    sentiment: 'BULLISH',
    isTaggedCatalyst: true,
  },
  {
    id: 'news-3',
    ticker: 'ASTS',
    headline: 'FCC Authorizes Final Telecommunications Orbital Spectrum for SpaceMobile 5G Gateway',
    source: 'Reuters Markets',
    publishedAt: '2026-08-30T15:45:00Z',
    summary: 'Direct smartphone satellite cellular coverage moves into unrestricted nationwide commercial phase.',
    catalystType: 'PRODUCT_LAUNCH',
    catalystConfidence: 'HIGH',
    sentiment: 'BULLISH',
    isTaggedCatalyst: true,
  },
  {
    id: 'news-4',
    ticker: 'LLY',
    headline: 'Eli Lilly Phase 3 Weight-Loss & Cardiovascular Outcomes Trial Exceeds Primary Endpoint',
    source: 'BioWorld',
    publishedAt: '2026-08-30T14:20:00Z',
    summary: 'Oral small-molecule therapy shows 18.2% mean body weight reduction with favorable tolerability profile.',
    catalystType: 'FDA_BIO',
    catalystConfidence: 'HIGH',
    sentiment: 'BULLISH',
    isTaggedCatalyst: true,
  },
  {
    id: 'news-5',
    ticker: 'SMCI',
    headline: 'Super Micro Closes $1.5B Convertible Senior Note Offering for Liquid-Cooled AI Expansion',
    source: 'SEC Filing Edgar',
    publishedAt: '2026-08-30T12:00:00Z',
    summary: 'Proceeds to fund high-capacity manufacturing facilities in Silicon Valley and Taiwan.',
    catalystType: 'SEC_FILING',
    catalystConfidence: 'MEDIUM',
    sentiment: 'NEUTRAL',
    isTaggedCatalyst: true,
  },
  {
    id: 'news-6',
    ticker: 'TSLA',
    headline: 'Tesla Energy Megapack Deployments Grow 85% in Asia-Pacific Grid Balancing Projects',
    source: 'Clean Energy Wire',
    publishedAt: '2026-08-30T10:30:00Z',
    summary: 'High-margin stationary storage revenue offsets automotive margin cyclicality.',
    catalystType: 'PRODUCT_LAUNCH',
    catalystConfidence: 'MEDIUM',
    sentiment: 'BULLISH',
    isTaggedCatalyst: false,
  },
  {
    id: 'news-7',
    ticker: 'AMD',
    headline: 'Morgan Stanley Upgrades AMD to $210 Overweight Citing $3.5B Enterprise AI Cluster Deal & MI325X Ramps',
    source: 'Wall Street Journal Markets',
    publishedAt: '2026-08-30T09:15:00Z',
    summary: 'Analyst note projects massive Q3 data center acceleration and margins reversal, noting current price dip is an aggressive institutional buying opportunity.',
    catalystType: 'ANALYST_UPGRADE',
    catalystConfidence: 'HIGH',
    sentiment: 'BULLISH',
    isTaggedCatalyst: true,
  },
  {
    id: 'news-8',
    ticker: 'BBAI',
    headline: 'BigBear.ai Signs Multi-Year Prime Contractor Agreement for Pentagon Global Command Center',
    source: 'Defense Daily',
    publishedAt: '2026-08-30T08:45:00Z',
    summary: 'Sub-$3 small cap surges as DoD commits $165M to operational AI edge deployments across five naval fleets.',
    catalystType: 'CONTRACT_NEWS',
    catalystConfidence: 'HIGH',
    sentiment: 'BULLISH',
    isTaggedCatalyst: true,
  },
  {
    id: 'news-9',
    ticker: 'HIMS',
    headline: 'Hims & Hers Q2 Financial Beat: Revenue +73% YoY to $315M with Raised FY Guidance and High FCF',
    source: 'Barron’s Healthcare',
    publishedAt: '2026-08-29T20:10:00Z',
    summary: 'Direct-to-consumer healthcare provider reports record gross margins of 82% and initiates $100M share buyback.',
    catalystType: 'EARNINGS',
    catalystConfidence: 'HIGH',
    sentiment: 'BULLISH',
    isTaggedCatalyst: true,
  },
  {
    id: 'news-10',
    ticker: 'JOBY',
    headline: 'Joby Aviation Secures Final Airworthiness In-Flight Clearance for Commercial Passenger Transit',
    source: 'Aviation Week',
    publishedAt: '2026-08-29T16:20:00Z',
    summary: 'Major regulatory clearance allows first commercial air taxi routes between Manhattan and JFK International.',
    catalystType: 'PRODUCT_LAUNCH',
    catalystConfidence: 'HIGH',
    sentiment: 'BULLISH',
    isTaggedCatalyst: true,
  },
];

/**
 * Same price-simulation algorithm as generateHistoricalCandles, but with a caller-supplied
 * bar count instead of the fixed ~100-trading-day (intraday) / ~1.2yr (daily) defaults.
 * Used by the walk-forward backtester to get a full year+ of 1HR history without changing
 * the bar counts every other live view relies on from generateHistoricalCandles().
 */
export function generateExtendedHistoricalCandles(
  symbol: string,
  resolution: 'D' | '240' | '60' | '30' | '15' | '5' | '1',
  totalBars: number,
  profile?: StockProfile
): Candle[] {
  const stock = profile || STOCK_UNIVERSE.find(s => s.symbol === symbol) || {
    symbol,
    name: symbol,
    basePrice: symbol.toUpperCase() === 'XAUUSD' || symbol.toUpperCase() === 'GOLD' ? 2515.40 : 100,
    avgVolume: 10000000,
    marketCap: 10000000000,
    floatShares: 100000000,
    sector: 'Commodities',
  };

  const candles: Candle[] = [];
  const is1m = resolution === '1';
  const is5m = resolution === '5';
  const is15m = resolution === '15';
  const is30m = resolution === '30';
  const is60m = resolution === '60';
  const is4H = resolution === '240';
  const isIntraday = is1m || is5m || is15m || is30m || is60m || is4H;

  const now = new Date();
  let currentPrice = stock.basePrice * (is1m || is5m || is15m || is30m ? 0.94 : is4H ? 0.85 : 0.78);
  let seed = symbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 100);
  let momentum = 0;

  const stepMs = is1m ? 60000 : is5m ? 300000 : is15m ? 900000 : is30m ? 1800000 : is60m ? 3600000 : is4H ? 14400000 : 86400000;

  for (let i = totalBars; i >= 0; i--) {
    const d = new Date(now.getTime() - i * stepMs);
    const utcDay = d.getUTCDay();
    const utcHour = d.getUTCHours();
    const isWeekend = utcDay === 6 || (utcDay === 0 && utcHour < 21);
    if (isWeekend) continue;

    seed += 1;
    const r1 = seededRandom(seed);
    const r2 = seededRandom(seed + 1);
    const r3 = seededRandom(seed + 2);
    const r4 = seededRandom(seed + 3);

    const targetPrice = stock.basePrice;
    const pullRate = is1m ? 0.0003 : is5m ? 0.0006 : is15m ? 0.0012 : is30m ? 0.002 : is60m ? 0.0035 : is4H ? 0.008 : 0.015;
    const pull = (targetPrice - currentPrice) * pullRate;

    const noise = (r1 - 0.488);
    const momentumPersistence = is1m ? 0.78 : is5m ? 0.82 : is15m ? 0.85 : is60m ? 0.88 : is4H ? 0.90 : 0.85;
    momentum = momentum * momentumPersistence + noise * (1 - momentumPersistence);

    const volatility = is1m ? 0.0009 : is5m ? 0.0016 : is15m ? 0.0026 : is60m ? 0.0045 : is4H ? 0.009 : 0.018;
    const change = (momentum * 2.2 + noise * 0.4) * volatility * currentPrice + pull;

    const open = currentPrice;
    const close = Math.max(1, currentPrice + change);
    const spreadMultiplier = is1m ? 0.0008 : is5m || is15m ? 0.0015 : is4H ? 0.008 : 0.015;
    const high = Math.max(open, close) + r2 * (currentPrice * spreadMultiplier);
    const low = Math.min(open, close) - r3 * (currentPrice * spreadMultiplier);

    const isSpike = r4 > 0.88;
    const volMultiplier = isSpike ? (1.8 + r1 * 2.2) : (0.7 + r1 * 0.6);
    const baseVol = is1m ? Math.floor(stock.avgVolume / 60) : is5m || is15m ? Math.floor(stock.avgVolume / 20) : is4H ? Math.floor(stock.avgVolume / 2) : stock.avgVolume;
    const volume = Math.floor(baseVol * volMultiplier);

    candles.push({
      time: isIntraday ? d.toISOString().slice(0, 16).replace('T', ' ') : d.toISOString().split('T')[0],
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume,
    });

    currentPrice = close;
  }

  if (candles.length > 0) {
    const last = candles[candles.length - 1];
    last.close = stock.basePrice;
    last.high = Math.max(last.high, stock.basePrice + (is4H ? 0.8 : 1.2));
    last.low = Math.min(last.low, stock.basePrice - (is4H ? 0.8 : 1.2));
  }

  return candles;
}
