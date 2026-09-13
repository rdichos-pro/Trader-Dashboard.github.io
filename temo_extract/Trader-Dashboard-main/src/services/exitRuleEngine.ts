import { Candle, ExitFlag, ExitStrategyConfig, NewsItem, NewsReversalAnalysis, Position, TickerQuote } from '../types/trading';
import { enrichCandlesWithIndicators } from '../utils/indicators';
import { marketDataService } from './marketDataService';

export const DEFAULT_GLOBAL_EXIT_STRATEGY: ExitStrategyConfig = {
  kumoStopLoss: {
    enabled: true,
    bufferPct: 0.0,
  },
  dynamicKumoStop: {
    enabled: true,
    nearKumoWarningPct: 1.0,
  },
  momentumLossExit: {
    enabled: true,
    cciThreshold: 50,
    stochThreshold: 50,
    requireBoth: true, // Strict 5-point AND Confluence enforced
  },
  hardStopLoss: {
    enabled: false,
    stopLossPct: 5.0,
  },
  trailingStop: {
    enabled: true,
    trailingPct: 3.0,
    activationThresholdPct: 2.0,
  },
  fixedTakeProfit: {
    enabled: true,
    takeProfitPct: 10.0,
  },
  newsReversalShield: {
    enabled: true,
    minConfidence: 'MEDIUM',
    graceBufferPct: 1.5, // 1.5% grace buffer below dynamic Kumo stop when bullish news contradicts sell signal
    autoSuppressHardSell: true,
  },
  technicalExit: {
    enabled: true,
    momentumLossExit: false, // Replaced with strict 5-point AND confluence
    trendBreakExit: true,
    cciThreshold: 50,
    stochKThreshold: 50,
  },
};

/**
 * Analyzes news, earnings records, regulatory filings, and catalysts for a ticker
 * to detect if a technical sell signal contradicts positive fundamental news.
 * If so, flags a potential reversal / bear-trap shakeout.
 */
export function analyzeNewsAndFinancialReversal(
  ticker: string,
  currentPrice: number,
  cloudBottom: number,
  newsList?: NewsItem[],
  quote?: TickerQuote,
  config?: ExitStrategyConfig
): NewsReversalAnalysis | null {
  const shieldConfig = config?.newsReversalShield;
  if (shieldConfig && shieldConfig.enabled === false) return null;

  const allNews = newsList && newsList.length > 0 ? newsList : marketDataService.getNews();
  const tickerNews = allNews.filter(n => n.ticker.toUpperCase() === ticker.toUpperCase());

  // Find bullish catalysts or news items
  let bestItem: NewsItem | null = null;
  for (const n of tickerNews) {
    if (n.sentiment === 'BULLISH') {
      if (!bestItem || n.catalystConfidence === 'HIGH') {
        bestItem = n;
      }
    }
  }

  // Also check ticker catalyst if available
  const quoteCat = quote?.catalyst;
  const isQuoteCatBullish = quoteCat && (
    quoteCat.type === 'EARNINGS' || 
    quoteCat.type === 'CONTRACT_NEWS' || 
    quoteCat.type === 'FDA_BIO' || 
    quoteCat.type === 'ANALYST_UPGRADE' || 
    quoteCat.type === 'PRODUCT_LAUNCH'
  );

  if (!bestItem && !isQuoteCatBullish) {
    return null;
  }

  const headline = bestItem?.headline || quoteCat?.headline || `${ticker} Positive Financial Development`;
  const catalystType = bestItem?.catalystType || quoteCat?.type || 'EARNINGS';
  const confidence = bestItem?.catalystConfidence || (quoteCat?.impact === 'HIGH' ? 'HIGH' : 'MEDIUM');
  const source = bestItem?.source || quoteCat?.source || 'Financial Filings & News Wire';
  const details = bestItem?.summary || quoteCat?.details || 'Company reports strong financial performance or catalyst expansion.';

  // Check confidence threshold
  const minConfidence = shieldConfig?.minConfidence || 'MEDIUM';
  if (minConfidence === 'HIGH' && confidence !== 'HIGH') {
    return null;
  }

  const graceBufferPct = shieldConfig?.graceBufferPct ?? 1.5;
  const shieldBufferStopPrice = Number((cloudBottom * (1 - (graceBufferPct / 100))).toFixed(2));

  // Compute reversal probability based on fundamental weight
  let reversalProbabilityScore = 72;
  if (catalystType === 'EARNINGS') reversalProbabilityScore += 10;
  if (catalystType === 'CONTRACT_NEWS' || catalystType === 'FDA_BIO') reversalProbabilityScore += 12;
  if (catalystType === 'ANALYST_UPGRADE') reversalProbabilityScore += 8;
  if (confidence === 'HIGH') reversalProbabilityScore += 6;
  if (quote && quote.rvol > 1.3) reversalProbabilityScore += 4;
  reversalProbabilityScore = Math.min(94, reversalProbabilityScore);

  const autoSuppress = shieldConfig?.autoSuppressHardSell ?? true;
  const actionRecommendation: 'HOLD_NEWS_SHIELD' | 'TIGHTEN_STOP' | 'CONFIRM_SELL' = 
    currentPrice >= shieldBufferStopPrice && autoSuppress ? 'HOLD_NEWS_SHIELD' : 'TIGHTEN_STOP';

  const financialImpactSummary = `Fundamental strength (${catalystType}) contradicts technical sell. News & financial reports show positive catalyst with ${reversalProbabilityScore}% probability of dip-buying reversal / bear-trap bounce.`;

  return {
    hasBullishDivergence: true,
    reversalProbabilityScore,
    headline,
    source,
    catalystType,
    sentiment: 'BULLISH',
    confidence,
    financialImpactSummary,
    actionRecommendation,
    shieldBufferStopPrice,
    details,
    detectedAt: new Date().toISOString(),
  };
}

/**
 * Evaluates live positions against latest price, candle indicators, and strict 5-point bearish exit confluence.
 * Adheres strictly to the 'Closed Candle' Execution Rule to prevent repainting.
 */
export function evaluatePositionExitRules(
  position: Position,
  quote: TickerQuote,
  candles?: Candle[],
  globalStrategy: ExitStrategyConfig = DEFAULT_GLOBAL_EXIT_STRATEGY,
  newsList?: NewsItem[]
): Position {
  return evaluatePositionExits(position, quote.price, candles, globalStrategy, newsList, quote);
}

/**
 * Primary exit evaluation engine (Pure Trend-Riding Strict Bearish AND Confluence):
 * 
 * Strict Bearish Reversal Exit triggers ONLY if ALL 5 conditions + No-Chop are met on the closed 4H candle:
 * 1. Tenkan-sen < Current Cloud Bottom (Price action broke below the cloud)
 * 2. Kijun-sen < Current Cloud Bottom (Baseline broke below the cloud)
 * 3. Tenkan-sen < Kijun-sen (Bearish TK Cross is active)
 * 4. Stochastic %K < 50 (Bearish cycle)
 * 5. CCI < 50 (Bearish momentum)
 * 6. No-Chop Consolidation Validation: Close < Current Cloud Bottom (definitively outside cloud)
 * 
 * In addition:
 * - Dynamic Kumo Stop Loss Floor tracking: stop price anchored to shifted Cloud Bottom
 * - Trailing Stop ratchet for profit protection
 * - Fixed Take Profit target limit
 * - News & Financial Records Reversal Shield: analyzes company filings & news when sell signal triggers
 */
export function evaluatePositionExits(
  position: Position,
  currentPrice: number,
  rawCandles?: Candle[],
  globalStrategy: ExitStrategyConfig = DEFAULT_GLOBAL_EXIT_STRATEGY,
  newsList?: NewsItem[],
  quote?: TickerQuote
): Position {
  const isLong = position.type === 'LONG';
  const config = position.exitStrategyConfig || globalStrategy;
  
  // Calculate Live P&L
  const priceDiff = isLong ? (currentPrice - position.entryPrice) : (position.entryPrice - currentPrice);
  const unrealizedPnlDollars = priceDiff * position.quantity;
  const unrealizedPnlPercent = position.entryPrice > 0 ? (priceDiff / position.entryPrice) * 100 : 0;

  // Enrich candles if available
  const candles = rawCandles && rawCandles.length > 0 ? enrichCandlesWithIndicators(rawCandles) : [];
  
  // =========================================================================
  // CLOSED CANDLE EXECUTION RULE:
  // Evaluate indicators strictly on the last fully completed candle (length - 2)
  // =========================================================================
  const closedCandle = candles.length >= 2 
    ? candles[candles.length - 2] 
    : (candles.length > 0 ? candles[candles.length - 1] : undefined);

  // Extract Ichimoku & Momentum values from the closed candle
  let cloudBottom = position.kumoCloudBottom ?? (position.entryPrice * 0.95);
  let cloudTop = position.kumoCloudTop ?? (position.entryPrice * 1.02);
  let closedTenkan = position.currentTenkan;
  let closedKijun = position.currentKijun;
  let closedStochK = position.currentStochK;
  let closedCci = position.currentCci;
  let closedClose = position.entryPrice;

  if (closedCandle) {
    closedClose = closedCandle.close;
    
    if (closedCandle.cloudBottom !== undefined) {
      cloudBottom = closedCandle.cloudBottom;
    } else if (closedCandle.senkouA !== undefined && closedCandle.senkouB !== undefined) {
      cloudBottom = Math.min(closedCandle.senkouA, closedCandle.senkouB);
    }
    
    if (closedCandle.cloudTop !== undefined) {
      cloudTop = closedCandle.cloudTop;
    } else if (closedCandle.senkouA !== undefined && closedCandle.senkouB !== undefined) {
      cloudTop = Math.max(closedCandle.senkouA, closedCandle.senkouB);
    }

    closedTenkan = closedCandle.tenkan ?? closedClose;
    closedKijun = closedCandle.kijun ?? closedClose;
    closedStochK = closedCandle.stochK ?? 50;
    closedCci = closedCandle.cci40 ?? 0;
  }

  // 1. Trailing Stop Peak State
  let trailingPeakPrice = position.trailingPeakPrice || position.entryPrice;
  if (isLong) {
    if (currentPrice > trailingPeakPrice) {
      trailingPeakPrice = currentPrice;
    }
  } else {
    if (currentPrice < trailingPeakPrice) {
      trailingPeakPrice = currentPrice;
    }
  }

  const maxGainPct = isLong
    ? ((trailingPeakPrice - position.entryPrice) / position.entryPrice) * 100
    : ((position.entryPrice - trailingPeakPrice) / position.entryPrice) * 100;

  const activationThreshold = config.trailingStop?.activationThresholdPct ?? 2.0;
  const trailingDistance = config.trailingStop?.trailingPct ?? 3.0;
  const isTrailingActivated = position.trailingActivated || (maxGainPct >= activationThreshold);

  let activeTrailingStopPrice = 0;
  if (isTrailingActivated) {
    activeTrailingStopPrice = isLong
      ? trailingPeakPrice * (1 - trailingDistance / 100)
      : trailingPeakPrice * (1 + trailingDistance / 100);
  }

  // Fixed Take Profit Level
  const takeProfitPct = config.fixedTakeProfit?.takeProfitPct ?? position.takeProfitPct ?? 10.0;
  const activeTakeProfitPrice = isLong
    ? position.entryPrice * (1 + takeProfitPct / 100)
    : position.entryPrice * (1 - takeProfitPct / 100);

  const exitFlags: ExitFlag[] = [];

  // =========================================================================
  // 1. STRICT 5-POINT + CHIKOU BEARISH REVERSAL EXIT (STRICT AND LOGIC - NO CHOP)
  // ALL conditions + outside cloud MUST be met on the closed candle:
  // 1. Tenkan < Cloud Bottom
  // 2. Kijun < Cloud Bottom
  // 3. Tenkan < Kijun (Bearish TK Cross)
  // 4. Chikou: Close < Close[-26] (Macro Downtrend Confirmed)
  // 5. Stoch %K < 50
  // 6. CCI < 50
  // 7. No-Chop Check: Close < Cloud Bottom (definitively outside cloud)
  // =========================================================================
  if (closedCandle && closedTenkan !== undefined && closedKijun !== undefined && closedStochK !== undefined && closedCci !== undefined) {
    const exitTenkanBelow = closedTenkan < cloudBottom;
    const exitKijunBelow = closedKijun < cloudBottom;
    const exitTkBearCross = closedTenkan < closedKijun;
    const exitChikouBear = closedCandle.close26Ago !== undefined ? closedClose < closedCandle.close26Ago : true;
    const exitStochBear = closedStochK < 50;
    const exitCciBear = closedCci < 50;
    const exitNoChopBelow = closedClose < cloudBottom;

    const isStrictBearishExitTriggered =
      exitTenkanBelow &&
      exitKijunBelow &&
      exitTkBearCross &&
      exitChikouBear &&
      exitStochBear &&
      exitCciBear &&
      exitNoChopBelow;

    if (isStrictBearishExitTriggered) {
      exitFlags.push({
        id: `${position.id}-strict-bearish-confluence-exit`,
        type: 'KUMO_STOP_LOSS',
        severity: 'CRITICAL',
        title: '🚨 Confirmed 4H Bearish Confluence Exit (Strict Confluence + Chikou Breakdown)',
        orderAction: 'MARKET_SELL',
        triggerPrice: currentPrice,
        message: `All strict bearish reversal conditions confirmed on closed 4H candle: Tenkan ($${closedTenkan.toFixed(2)}) & Kijun ($${closedKijun.toFixed(2)}) < Cloud Bottom ($${cloudBottom.toFixed(2)}), Bearish TK Cross, Chikou breakdown (Close < Close[-26]), Stoch %K (${closedStochK.toFixed(1)} < 50), CCI (${closedCci.toFixed(1)} < 50), Close ($${closedClose.toFixed(2)}) below Cloud. Trigger MARKET SELL.`,
        triggeredAt: new Date().toISOString(),
      });
    }
  }

  // =========================================================================
  // 2. DYNAMIC KUMO STOP LOSS FLOOR (Ultimate Trend Breakdown Defense)
  // =========================================================================
  const isKumoStopEnabled = config.kumoStopLoss?.enabled !== false;
  let isNearKumoStop = false;
  let nearKumoDistancePct = 0;

  if (isKumoStopEnabled && cloudBottom > 0) {
    const distanceToKumo = currentPrice - cloudBottom;
    const distancePct = (distanceToKumo / currentPrice) * 100;
    nearKumoDistancePct = Number(distancePct.toFixed(2));

    // Near Kumo Warning: Within 1.0% of the Cloud Bottom Stop Loss
    if (distancePct > 0 && distancePct <= 1.0) {
      isNearKumoStop = true;
      exitFlags.push({
        id: `${position.id}-near-kumo-warning`,
        type: 'KUMO_STOP_LOSS',
        severity: 'WARNING',
        title: '⚠️ Approaching Dynamic Kumo Stop Loss Floor',
        triggerPrice: currentPrice,
        message: `Current price ($${currentPrice.toFixed(2)}) is within ${distancePct.toFixed(2)}% of the dynamic Ichimoku Cloud Bottom floor ($${cloudBottom.toFixed(2)}).`,
        triggeredAt: new Date().toISOString(),
      });
    }

    // Hard Breach: Live Price fell below Cloud Bottom
    if (currentPrice < cloudBottom) {
      const alreadyFlagged = exitFlags.some(f => f.id.includes('strict-bearish-confluence-exit'));
      if (!alreadyFlagged) {
        exitFlags.push({
          id: `${position.id}-kumo-stop-breached`,
          type: 'KUMO_STOP_LOSS',
          severity: 'CRITICAL',
          title: 'Dynamic Kumo Stop Loss Floor Breached',
          orderAction: 'MARKET_SELL',
          triggerPrice: currentPrice,
          message: `Live price ($${currentPrice.toFixed(2)}) breached below dynamic Ichimoku Cloud Bottom ($${cloudBottom.toFixed(2)}). Trend defense floor broken. Trigger defensive MARKET SELL.`,
          triggeredAt: new Date().toISOString(),
        });
      }
    }
  }

  // =========================================================================
  // 3. TRAILING STOP (Secondary Profit Protection)
  // =========================================================================
  if (config.trailingStop?.enabled && isTrailingActivated && activeTrailingStopPrice > 0) {
    const isTrailingHit = isLong ? currentPrice <= activeTrailingStopPrice : currentPrice >= activeTrailingStopPrice;
    if (isTrailingHit) {
      exitFlags.push({
        id: `${position.id}-trailing-stop`,
        type: 'TRAILING_STOP',
        severity: 'CRITICAL',
        title: 'Trailing Stop Triggered',
        orderAction: 'TRAILING_SELL',
        triggerPrice: currentPrice,
        message: `Price pulled back ${trailingDistance}% from peak of $${trailingPeakPrice.toFixed(2)} (Stop: $${activeTrailingStopPrice.toFixed(2)}). Lock in profit via SELL.`,
        triggeredAt: new Date().toISOString(),
      });
    }
  }

  // =========================================================================
  // 4. FIXED TAKE PROFIT (Target Price Limit Sell)
  // =========================================================================
  if (config.fixedTakeProfit?.enabled) {
    const isTargetHit = isLong ? currentPrice >= activeTakeProfitPrice : currentPrice <= activeTakeProfitPrice;
    if (isTargetHit) {
      exitFlags.push({
        id: `${position.id}-take-profit`,
        type: 'TAKE_PROFIT',
        severity: 'INFO',
        title: 'Take Profit Target Reached',
        orderAction: 'LIMIT_SELL',
        triggerPrice: currentPrice,
        message: `Target price $${activeTakeProfitPrice.toFixed(2)} (+${takeProfitPct.toFixed(1)}%) reached. Unrealized gain: +$${unrealizedPnlDollars.toFixed(2)}.`,
        triggeredAt: new Date().toISOString(),
      });
    }
  }

  // =========================================================================
  // 5. NEWS & FINANCIAL RECORDS REVERSAL SHIELD (Bullish Fundamental Divergence)
  // Check if technical signals triggered a SELL, but positive news/financials
  // suggest an institutional bear trap / dip-buying reversal opportunity
  // =========================================================================
  const technicalSellTriggered = exitFlags.some(
    f => f.orderAction === 'MARKET_SELL' || f.id.includes('kumo-stop-breached') || f.id.includes('strict-bearish-confluence-exit')
  );

  const newsReversal = analyzeNewsAndFinancialReversal(
    position.ticker,
    currentPrice,
    cloudBottom,
    newsList,
    quote,
    config
  );

  const shieldConfig = config.newsReversalShield;
  const isShieldEnabled = shieldConfig?.enabled !== false;

  if (isShieldEnabled && newsReversal && newsReversal.hasBullishDivergence) {
    const shieldBufferStop = newsReversal.shieldBufferStopPrice ?? Number((cloudBottom * 0.985).toFixed(2));
    const isWithinShieldBuffer = currentPrice >= shieldBufferStop;

    if (technicalSellTriggered) {
      if (isWithinShieldBuffer) {
        // Technicals say sell, but price is still safely within the News Grace Buffer!
        // Apply Reversal Shield: suppress or convert the critical hard market sell
        if (shieldConfig?.autoSuppressHardSell !== false) {
          for (let i = exitFlags.length - 1; i >= 0; i--) {
            if (
              exitFlags[i].orderAction === 'MARKET_SELL' || 
              exitFlags[i].id.includes('kumo-stop-breached') || 
              exitFlags[i].id.includes('strict-bearish-confluence-exit')
            ) {
              exitFlags.splice(i, 1);
            }
          }
        }

        exitFlags.push({
          id: `${position.id}-news-reversal-shield`,
          type: 'NEWS_REVERSAL_SHIELD',
          severity: 'WARNING',
          title: `🛡️ News Reversal Shield: ${newsReversal.catalystType} Catalyst Active`,
          label: 'News Reversal Shield Active',
          orderAction: 'HOLD_NEWS_SHIELD',
          triggerPrice: currentPrice,
          message: `Technical SELL condition triggered at $${currentPrice.toFixed(2)}, but recent financial records & news ("${newsReversal.headline}") indicate high-impact fundamental catalyst with ${newsReversal.reversalProbabilityScore}% probability of dip-buying reversal. Stop loss floor extended to $${shieldBufferStop.toFixed(2)} (${shieldConfig?.graceBufferPct ?? 1.5}% buffer) to prevent premature stop-out.`,
          triggeredAt: new Date().toISOString(),
          newsReversalDetails: newsReversal,
        });
      } else {
        // Price fell even below the News Shield buffer!
        exitFlags.push({
          id: `${position.id}-news-shield-breached`,
          type: 'KUMO_STOP_LOSS',
          severity: 'CRITICAL',
          title: '🚨 News Shield Stop Floor Breached',
          label: 'Shield Stop Breached',
          orderAction: 'MARKET_SELL',
          triggerPrice: currentPrice,
          message: `Price ($${currentPrice.toFixed(2)}) broke below both Cloud Bottom ($${cloudBottom.toFixed(2)}) and the News Shield floor ($${shieldBufferStop.toFixed(2)}). Bullish news catalyst ("${newsReversal.headline}") failed to hold price. Defensive MARKET SELL required.`,
          triggeredAt: new Date().toISOString(),
          newsReversalDetails: newsReversal,
        });
      }
    } else if (isNearKumoStop) {
      // Near stop: attach informative news reversal reassurance
      const existingNearWarning = exitFlags.find(f => f.id.includes('near-kumo-warning'));
      if (existingNearWarning) {
        existingNearWarning.message += ` (News Shield Active: Bullish financial records support anticipated reversal above $${shieldBufferStop.toFixed(2)}).`;
        existingNearWarning.newsReversalDetails = newsReversal;
      }
    }
  }

  // Effective display stop loss price (Dynamic Kumo floor unless trailing stop is higher)
  let displayStopPrice = isTrailingActivated && activeTrailingStopPrice > cloudBottom
    ? activeTrailingStopPrice
    : cloudBottom;

  // If News Shield is active and holding, stop price displays the grace buffer stop
  if (isShieldEnabled && newsReversal && exitFlags.some(f => f.id.includes('news-reversal-shield')) && (newsReversal.shieldBufferStopPrice ?? 0) > 0) {
    displayStopPrice = newsReversal.shieldBufferStopPrice!;
  }

  const dynamicStopLossPct = position.entryPrice > 0
    ? Math.abs(((position.entryPrice - displayStopPrice) / position.entryPrice) * 100)
    : 5.0;

  // Compute Active Trend-Riding Status
  let trendStage: 'TREND_INCEPTION' | 'RIDING_TREND' | 'PULLBACK_TEST' | 'TREND_BROKEN' = 'RIDING_TREND';
  let trendStrengthScore = 75;
  let advice = `RIDE THE TREND: Bullish structure intact. Let profits run above Kumo floor ($${cloudBottom.toFixed(2)}).`;

  if (exitFlags.some(f => f.id.includes('news-reversal-shield'))) {
    trendStage = 'PULLBACK_TEST';
    advice = `🛡️ NEWS REVERSAL SHIELD: Technical sell overridden by ${newsReversal?.catalystType} catalyst ("${newsReversal?.headline}"). Holding above $${newsReversal?.shieldBufferStopPrice?.toFixed(2)} for reversal bounce (${newsReversal?.reversalProbabilityScore}% prob).`;
    trendStrengthScore = Math.max(55, newsReversal?.reversalProbabilityScore ?? 65);
  } else if (exitFlags.some(f => f.severity === 'CRITICAL')) {
    trendStage = 'TREND_BROKEN';
    advice = 'STRUCTURAL EXIT: Stop level breached. Close position to preserve capital.';
    trendStrengthScore = 20;
  } else if (closedKijun !== undefined && currentPrice < closedKijun && currentPrice >= cloudBottom) {
    trendStage = 'PULLBACK_TEST';
    advice = `HOLD & RIDE PULLBACK: Testing Kijun support ($${closedKijun.toFixed(2)}). Kumo floor ($${cloudBottom.toFixed(2)}) intact — let trade work.`;
    trendStrengthScore = 60;
  } else {
    trendStage = 'RIDING_TREND';
    trendStrengthScore = Math.min(100, 60 + (unrealizedPnlPercent > 0 ? 20 : 0) + ((closedCci ?? 0) > 50 ? 20 : 0));
    advice = `RIDE THE TREND (+${unrealizedPnlPercent.toFixed(1)}%): Strong trend alignment above Kumo ($${cloudBottom.toFixed(2)}) & Kijun ($${(closedKijun ?? cloudBottom).toFixed(2)}).`;
  }

  return {
    ...position,
    currentPrice,
    stopLossType: isTrailingActivated && activeTrailingStopPrice > cloudBottom ? 'TRAILING' : 'DYNAMIC_KUMO',
    stopLossPrice: Number(displayStopPrice.toFixed(2)),
    stopLossPct: Number(dynamicStopLossPct.toFixed(1)),
    kumoCloudBottom: Number(cloudBottom.toFixed(2)),
    kumoCloudTop: Number(cloudTop.toFixed(2)),
    isNearKumoStop,
    nearKumoDistancePct,
    currentTenkan: closedTenkan !== undefined ? Number(closedTenkan.toFixed(2)) : undefined,
    currentKijun: closedKijun !== undefined ? Number(closedKijun.toFixed(2)) : undefined,
    currentStochK: closedStochK !== undefined ? Number(closedStochK.toFixed(1)) : undefined,
    currentCci: closedCci !== undefined ? Number(closedCci.toFixed(1)) : undefined,
    trailingPeakPrice,
    trailingActivated: isTrailingActivated,
    trailingActivationThresholdPct: activationThreshold,
    trailingDistancePct: trailingDistance,
    takeProfitPrice: Number(activeTakeProfitPrice.toFixed(2)),
    takeProfitPct: takeProfitPct,
    unrealizedPnlDollars: Number(unrealizedPnlDollars.toFixed(2)),
    unrealizedPnlPercent: Number(unrealizedPnlPercent.toFixed(2)),
    exitFlags,
    newsReversalAnalysis: newsReversal || undefined,
    trendRidingStatus: {
      stage: trendStage,
      trendStrengthScore,
      barsInTrend: (position.trendRidingStatus?.barsInTrend || 0) + 1,
      advice,
      supportFloor: Number(cloudBottom.toFixed(2)),
      kijunFloor: Number((closedKijun ?? cloudBottom).toFixed(2)),
    },
  };
}
