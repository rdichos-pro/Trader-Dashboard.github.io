import { Candle } from '../types/trading';

export interface FinnhubCandleResponse {
  c: number[]; // Close prices
  h: number[]; // High prices
  l: number[]; // Low prices
  o: number[]; // Open prices
  v: number[]; // Volume
  t: number[]; // Timestamps (seconds)
  s: string;   // Status ('ok' | 'no_data')
}

/**
 * 1. Calculates Simple Moving Average (SMA)
 * Used for 50 SMA, 20 SMA, 200 SMA, and 30-period Avg Volume
 */
export function calculateSMA(data: number[], period: number): (number | undefined)[] {
  const sma: (number | undefined)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sma.push(undefined);
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[i - j];
      }
      sma.push(sum / period);
    }
  }
  return sma;
}

/**
 * 2. Calculates Exponential Moving Average (EMA)
 * Used for 20 EMA and 9 EMA with multiplier = 2 / (period + 1)
 */
export function calculateEMA(data: number[], period: number): (number | undefined)[] {
  const ema: (number | undefined)[] = [];
  const multiplier = 2 / (period + 1);

  let initialSma = 0;
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      initialSma += data[i];
      ema.push(undefined);
    } else if (i === period - 1) {
      initialSma += data[i];
      const firstEma = initialSma / period;
      ema.push(firstEma);
    } else {
      const prevEma = ema[i - 1]!;
      const currentEma = (data[i] - prevEma) * multiplier + prevEma;
      ema.push(currentEma);
    }
  }
  return ema;
}

/**
 * 3. Calculates Relative Strength Index (RSI - 14) with Wilder's Exponential Smoothing
 */
export function calculateRSI(closes: number[], period: number = 14): (number | undefined)[] {
  const rsi: (number | undefined)[] = [];
  if (closes.length <= period) {
    return closes.map(() => undefined);
  }

  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? -diff : 0);
  }

  // First RSI value is simple arithmetic average over first `period` changes
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  // Align with original closes indices (0..period - 1 are undefined)
  for (let i = 0; i < period; i++) {
    rsi.push(undefined);
  }

  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  rsi.push(100 - (100 / (1 + rs)));

  // Wilder's smoothed averages
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;

    if (avgLoss === 0) {
      rsi.push(100);
    } else {
      rs = avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));
    }
  }

  return rsi;
}

/**
 * 4. Calculates Ichimoku Kinko Hyo (9, 26, 52, 26)
 * 
 * Strict Mathematical Rules (TradingView Standard):
 * - NO Simple Moving Averages are used for Tenkan or Kijun!
 * - Tenkan-sen (Conversion Line, 9 periods):
 *     (Highest High in 9 periods + Lowest Low in 9 periods) / 2
 * - Kijun-sen (Base Line, 26 periods):
 *     (Highest High in 26 periods + Lowest Low in 26 periods) / 2
 * - Raw Senkou Span A (Leading Span A, calculated at bar i):
 *     (Tenkan-sen + Kijun-sen) / 2
 * - Raw Senkou Span B (Leading Span B, calculated at bar i, 52 periods):
 *     (Highest High in 52 periods + Lowest Low in 52 periods) / 2
 * 
 * Displacement & Active Cloud Alignment on Candle i:
 * - Senkou Span A and Senkou Span B calculated at bar (i - 26) are projected 26 periods forward to form the cloud at candle i.
 * - Therefore, to evaluate the current candle i against the cloud, we compare price to the Senkou A and B values calculated 26 periods ago:
 *     senkouA[i] = rawSenkouA[i - displacement] (e.g., rawSenkouA[i - 26])
 *     senkouB[i] = rawSenkouB[i - displacement] (e.g., rawSenkouB[i - 26])
 * - Active Cloud Boundaries at Candle i:
 *     cloudTop[i] = Math.max(senkouA[i], senkouB[i])
 *     cloudBottom[i] = Math.min(senkouA[i], senkouB[i])
 * - Chikou Span: Close plotted 26 periods behind
 */
export function calculateIchimoku(
  highs: number[],
  lows: number[],
  closes: number[],
  tenkanPeriod: number = 9,
  kijunPeriod: number = 26,
  senkouBPeriod: number = 52,
  displacement: number = 26
) {
  const len = closes.length;
  const tenkan: (number | undefined)[] = [];
  const kijun: (number | undefined)[] = [];
  const rawSenkouA: (number | undefined)[] = [];
  const rawSenkouB: (number | undefined)[] = [];
  const senkouA: (number | undefined)[] = [];
  const senkouB: (number | undefined)[] = [];
  const cloudTop: (number | undefined)[] = [];
  const cloudBottom: (number | undefined)[] = [];
  const chikou: (number | undefined)[] = [];

  // Helper: Exact (Highest High + Lowest Low) / 2 over period P looking back from index idx
  const getPeriodMidpoint = (hArr: number[], lArr: number[], idx: number, p: number): number | undefined => {
    if (idx < p - 1) {
      if (idx >= 0) {
        let maxH = -Infinity;
        let minL = Infinity;
        for (let j = 0; j <= idx; j++) {
          if (hArr[j] > maxH) maxH = hArr[j];
          if (lArr[j] < minL) minL = lArr[j];
        }
        return (maxH + minL) / 2;
      }
      return undefined;
    }
    let maxH = -Infinity;
    let minL = Infinity;
    for (let j = 0; j < p; j++) {
      const h = hArr[idx - j];
      const l = lArr[idx - j];
      if (h > maxH) maxH = h;
      if (l < minL) minL = l;
    }
    return (maxH + minL) / 2;
  };

  // 1. Calculate raw Tenkan, Kijun, raw Senkou A and raw Senkou B at each bar i
  for (let i = 0; i < len; i++) {
    const t = getPeriodMidpoint(highs, lows, i, tenkanPeriod);
    const k = getPeriodMidpoint(highs, lows, i, kijunPeriod);
    tenkan.push(t);
    kijun.push(k);

    const tVal = t ?? closes[i];
    const kVal = k ?? closes[i];
    const spanA = (tVal + kVal) / 2;
    rawSenkouA.push(spanA);

    const b = getPeriodMidpoint(highs, lows, i, senkouBPeriod);
    const spanB = b ?? kVal;
    rawSenkouB.push(spanB);
  }

  // 2. Align active Cloud on Candle i using the 26-period displacement
  // The cloud covering candle i was generated by the raw spans calculated 26 periods ago (i - displacement)
  for (let i = 0; i < len; i++) {
    const pastIndex = i - displacement;
    let spanAAtCandle: number;
    let spanBAtCandle: number;

    if (pastIndex >= 0) {
      spanAAtCandle = rawSenkouA[pastIndex] ?? rawSenkouA[0] ?? closes[i];
      spanBAtCandle = rawSenkouB[pastIndex] ?? rawSenkouB[0] ?? closes[i];
    } else {
      // For the first 26 bars before full historical displacement is available,
      // fallback to the earliest calculated span so values are smooth and defined
      spanAAtCandle = rawSenkouA[0] ?? closes[i];
      spanBAtCandle = rawSenkouB[0] ?? closes[i];
    }

    senkouA.push(spanAAtCandle);
    senkouB.push(spanBAtCandle);

    cloudTop.push(Math.max(spanAAtCandle, spanBAtCandle));
    cloudBottom.push(Math.min(spanAAtCandle, spanBAtCandle));

    // Chikou is close plotted 26 periods behind
    chikou.push(i + displacement < len ? closes[i + displacement] : undefined);
  }

  return {
    tenkan,
    kijun,
    rawSenkouA,
    rawSenkouB,
    senkouA,
    senkouB,
    cloudTop,
    cloudBottom,
    chikou,
  };
}

/**
 * 5. Calculates Stochastic Oscillator (12, 3, 3)
 * - Fast %K = (Close - LowestLow_12) / (HighestHigh_12 - LowestLow_12) * 100
 * - Slow %K (%K line) = 3-period SMA of Fast %K
 * - %D line = 3-period SMA of Slow %K
 */
export function calculateStochastic(
  highs: number[],
  lows: number[],
  closes: number[],
  periodK: number = 12,
  smoothK: number = 3,
  periodD: number = 3
) {
  const len = closes.length;
  const rawFastK: (number | undefined)[] = [];

  for (let i = 0; i < len; i++) {
    if (i < periodK - 1) {
      rawFastK.push(undefined);
    } else {
      let highestHigh = -Infinity;
      let lowestLow = Infinity;
      for (let j = 0; j < periodK; j++) {
        const h = highs[i - j];
        const l = lows[i - j];
        if (h > highestHigh) highestHigh = h;
        if (l < lowestLow) lowestLow = l;
      }
      const range = highestHigh - lowestLow;
      const kVal = range === 0 ? 50 : ((closes[i] - lowestLow) / range) * 100;
      rawFastK.push(Math.max(0, Math.min(100, kVal)));
    }
  }

  // Smooth Fast %K with SMA of smoothK -> Slow %K
  const stochK: (number | undefined)[] = [];
  for (let i = 0; i < len; i++) {
    if (i < periodK - 1 + smoothK - 1) {
      stochK.push(undefined);
    } else {
      let sum = 0;
      let count = 0;
      for (let j = 0; j < smoothK; j++) {
        const val = rawFastK[i - j];
        if (val !== undefined) {
          sum += val;
          count++;
        }
      }
      stochK.push(count > 0 ? sum / count : undefined);
    }
  }

  // Smooth Slow %K with SMA of periodD -> %D Line
  const stochD: (number | undefined)[] = [];
  for (let i = 0; i < len; i++) {
    if (i < periodK - 1 + smoothK - 1 + periodD - 1) {
      stochD.push(undefined);
    } else {
      let sum = 0;
      let count = 0;
      for (let j = 0; j < periodD; j++) {
        const val = stochK[i - j];
        if (val !== undefined) {
          sum += val;
          count++;
        }
      }
      stochD.push(count > 0 ? sum / count : undefined);
    }
  }

  return { stochK, stochD };
}

/**
 * 6. Calculates Commodity Channel Index (CCI) - Period 40
 * - Typical Price (TP) = (High + Low + Close) / 3
 * - SMA_TP = 40-period SMA of TP
 * - Mean Deviation (MD) = sum(|TP_j - SMA_TP|) / 40
 * - CCI = (TP - SMA_TP) / (0.015 * MD)
 */
export function calculateCCI(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 40
): (number | undefined)[] {
  const len = closes.length;
  const tp: number[] = [];
  for (let i = 0; i < len; i++) {
    tp.push((highs[i] + lows[i] + closes[i]) / 3);
  }

  const cci: (number | undefined)[] = [];

  for (let i = 0; i < len; i++) {
    if (i < period - 1) {
      // For early bars, compute on available window if >= 5 bars
      if (i >= 4) {
        const subWindow = i + 1;
        let subSum = 0;
        for (let j = 0; j < subWindow; j++) subSum += tp[i - j];
        const subSma = subSum / subWindow;
        let subDev = 0;
        for (let j = 0; j < subWindow; j++) subDev += Math.abs(tp[i - j] - subSma);
        const md = subDev / subWindow;
        cci.push(md === 0 ? 0 : (tp[i] - subSma) / (0.015 * md));
      } else {
        cci.push(undefined);
      }
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += tp[i - j];
      }
      const smaTp = sum / period;

      let devSum = 0;
      for (let j = 0; j < period; j++) {
        devSum += Math.abs(tp[i - j] - smaTp);
      }
      const meanDev = devSum / period;

      if (meanDev === 0) {
        cci.push(0);
      } else {
        const val = (tp[i] - smaTp) / (0.015 * meanDev);
        cci.push(Number(val.toFixed(2)));
      }
    }
  }

  return cci;
}

/**
 * 7. Calculates 20-period Highest High
 * For each bar i, computes the highest high over the preceding lookback period (excluding current bar if strict breakout)
 */
export function calculateHighestHigh(highs: number[], period: number = 20): (number | undefined)[] {
  const highestHighs: (number | undefined)[] = [];
  for (let i = 0; i < highs.length; i++) {
    if (i < period) {
      highestHighs.push(undefined);
    } else {
      let maxVal = -Infinity;
      // Look back across the preceding `period` candles (from i-period to i-1)
      for (let j = 1; j <= period; j++) {
        const val = highs[i - j];
        if (val > maxVal) maxVal = val;
      }
      highestHighs.push(maxVal);
    }
  }
  return highestHighs;
}

/**
 * 8. Calculates 30-period Average Volume (for RVOL calculation)
 */
export function calculateAverageVolume(volumes: number[], period: number = 30): (number | undefined)[] {
  return calculateSMA(volumes, period);
}

/**
 * 9. Calculates Relative Volume (RVOL)
 */
export function calculateRVOL(currentVolume: number, avgVolume30: number | undefined): number {
  if (!avgVolume30 || avgVolume30 <= 0) return 1.0;
  return Number((currentVolume / avgVolume30).toFixed(2));
}

/**
 * Calculates MACD (12, 26, 9)
 */
export function calculateMACD(
  closes: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
) {
  const fastEma = calculateEMA(closes, fastPeriod);
  const slowEma = calculateEMA(closes, slowPeriod);

  const macdLine: (number | undefined)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (fastEma[i] !== undefined && slowEma[i] !== undefined) {
      macdLine.push(fastEma[i]! - slowEma[i]!);
    } else {
      macdLine.push(undefined);
    }
  }

  // Filter valid macdLine values for signal EMA calculation
  const validMacdIndices = macdLine.map((val, idx) => (val !== undefined ? idx : -1)).filter(i => i !== -1);
  const validMacdValues = validMacdIndices.map(i => macdLine[i]!);
  const signalValues = calculateEMA(validMacdValues, signalPeriod);

  const signalLine: (number | undefined)[] = closes.map(() => undefined);
  const histogram: (number | undefined)[] = closes.map(() => undefined);

  validMacdIndices.forEach((origIdx, validIdx) => {
    const sig = signalValues[validIdx];
    if (sig !== undefined) {
      signalLine[origIdx] = sig;
      histogram[origIdx] = macdLine[origIdx]! - sig;
    }
  });

  return { macdLine, signalLine, histogram };
}

/**
 * Calculates Bollinger Bands (20, 2 std)
 */
export function calculateBollingerBands(closes: number[], period: number = 20, multiplier: number = 2) {
  const sma = calculateSMA(closes, period);
  const upper: (number | undefined)[] = [];
  const lower: (number | undefined)[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (sma[i] === undefined) {
      upper.push(undefined);
      lower.push(undefined);
    } else {
      let varianceSum = 0;
      for (let j = 0; j < period; j++) {
        varianceSum += Math.pow(closes[i - j] - sma[i]!, 2);
      }
      const stdDev = Math.sqrt(varianceSum / period);
      upper.push(sma[i]! + multiplier * stdDev);
      lower.push(sma[i]! - multiplier * stdDev);
    }
  }

  return { middle: sma, upper, lower };
}

/**
 * Enriches candles with all required technical indicators:
 * - Ichimoku Kinko Hyo (Tenkan, Kijun, Senkou A, Senkou B, Cloud Top, Cloud Bottom)
 * - Stochastic Oscillator (12, 3, 3) (%K, %D)
 * - Commodity Channel Index (CCI 40)
 * - RSI (14-period)
 * - 20 EMA & 50 SMA
 * - 20-period Highest High
 * - 30-period Average Volume
 * - MACD & Bollinger Bands
 */
export function enrichCandlesWithIndicators(candles: Candle[]): Candle[] {
  if (!candles || candles.length === 0) return [];

  // Guarantee strictly sorted chronologically: Oldest (earliest timestamp) -> Newest
  const sorted = [...candles].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  const closes = sorted.map(c => c.close);
  const highs = sorted.map(c => c.high);
  const lows = sorted.map(c => c.low);
  const volumes = sorted.map(c => c.volume);

  const ichimoku = calculateIchimoku(highs, lows, closes, 9, 26, 52, 26);
  // Stoch 14,3,3 standardizes with TradingView's default oscillator settings
  const stochastic = calculateStochastic(highs, lows, closes, 14, 3, 3);
  const cci40 = calculateCCI(highs, lows, closes, 40);
  const cci20 = calculateCCI(highs, lows, closes, 20);

  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);
  const sma200 = calculateSMA(closes, 200);
  const ema9 = calculateEMA(closes, 9);
  const ema20 = calculateEMA(closes, 20);
  const rsi14 = calculateRSI(closes, 14);
  const highestHigh20 = calculateHighestHigh(highs, 20);
  const avgVolume30 = calculateAverageVolume(volumes, 30);
  const { macdLine, signalLine, histogram } = calculateMACD(closes);
  const { upper, lower } = calculateBollingerBands(closes, 20, 2);

  return sorted.map((c, i) => {
    const rawA = ichimoku.rawSenkouA[i];
    const rawB = ichimoku.rawSenkouB[i];
    const pastClose = i >= 26 ? closes[i - 26] : undefined;
    const isFutureGreen = rawA !== undefined && rawB !== undefined ? rawA > rawB : false;
    const isChikouBull = pastClose !== undefined ? c.close > pastClose : false;
    const isChikouBear = pastClose !== undefined ? c.close < pastClose : false;

    return {
      ...c,
      tenkan: ichimoku.tenkan[i],
      kijun: ichimoku.kijun[i],
      senkouA: ichimoku.senkouA[i],
      senkouB: ichimoku.senkouB[i],
      futureSenkouA: rawA,
      futureSenkouB: rawB,
      cloudTop: ichimoku.cloudTop[i],
      cloudBottom: ichimoku.cloudBottom[i],
      chikou: ichimoku.chikou[i],
      close26Ago: pastClose,
      isFutureCloudBullish: isFutureGreen,
      isChikouBullish: isChikouBull,
      isChikouBearish: isChikouBear,
      stochK: stochastic.stochK[i],
      stochD: stochastic.stochD[i],
      cci40: cci40[i],
      cci20: cci20[i],
      sma20: sma20[i],
      sma50: sma50[i],
      sma200: sma200[i],
      ema9: ema9[i],
      ema20: ema20[i],
      rsi14: rsi14[i],
      highestHigh20: highestHigh20[i],
      avgVolume30: avgVolume30[i],
      macd: macdLine[i],
      macdSignal: signalLine[i],
      macdHist: histogram[i],
      upperBB: upper[i],
      lowerBB: lower[i],
    };
  });
}

/**
 * Parses raw Finnhub OHLCV JSON response and returns indicator-enriched candles
 * Guarantees that raw data arrays are sorted chronologically (oldest to newest) before running calculations.
 */
export function parseFinnhubCandles(raw: FinnhubCandleResponse): Candle[] {
  if (!raw || raw.s !== 'ok' || !raw.c || raw.c.length === 0) {
    return [];
  }

  const rawCandles: Array<{ time: string; timestampMs: number; open: number; high: number; low: number; close: number; volume: number }> = [];
  const count = raw.c.length;

  for (let i = 0; i < count; i++) {
    const timeSec = raw.t[i] || 0;
    const timestampMs = timeSec * 1000;
    const timeStr = timeSec ? new Date(timestampMs).toISOString() : new Date().toISOString();
    rawCandles.push({
      time: timeStr,
      timestampMs,
      open: raw.o[i] ?? raw.c[i],
      high: raw.h[i] ?? raw.c[i],
      low: raw.l[i] ?? raw.c[i],
      close: raw.c[i],
      volume: raw.v[i] ?? 0,
    });
  }

  // Strictly sort chronologically: Oldest -> Newest
  rawCandles.sort((a, b) => a.timestampMs - b.timestampMs);

  const sortedCandles: Candle[] = rawCandles.map(({ time, open, high, low, close, volume }) => ({
    time,
    open,
    high,
    low,
    close,
    volume,
  }));

  return enrichCandlesWithIndicators(sortedCandles);
}
