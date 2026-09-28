import type { OpportunityLevel } from "@degenradar/types";
export * from "./lore";

export interface ScoringInputs {
  riskScore: number; // 0 - 100
  volumeVelocity: number;
  priceVelocity: number;
  buyPressure: number; // 0.0 - 1.0
  holderGrowthPct: number;
  smartMoneyCount: number;
  liquidityUsd: number;
  marketCap?: number;
  loreScore?: number; // 0 - 100
  // Live performance fields — coins "doing well now" regardless of age
  priceChange1h?: number;   // % price change in last 1h (from Birdeye/DexScreener)
  priceChange24h?: number;  // % price change in last 24h
  volume24h?: number;       // 24h volume in USD
}

export interface ScoringResult {
  opportunityScore: number;
  riskScore: number;
  momentumScore: number;
  smartMoneyScore: number;
  liquidityScore: number;
  holderScore: number;
  socialScore: number;
  performanceScore: number;
  opportunityLevel: OpportunityLevel;
  projectedMultiplier: string;
  isBlockedByRisk: boolean;
  modelVersion: string;
}

export function classifyOpportunityLevel(score: number): OpportunityLevel {
  if (score >= 90) return "EXTREME_SIGNAL";
  if (score >= 75) return "STRONG_SIGNAL";
  if (score >= 60) return "EARLY_SIGNAL";
  if (score >= 40) return "DEVELOPING";
  return "WATCH";
}

/**
 * Predicts realistic upside target multiple across both micro-caps and mid-caps
 */
export function estimateProjectedMultiplier(params: {
  marketCap: number;
  momentumScore: number;
  buyPressure: number;
  loreScore: number;
  performanceScore?: number;
}): string {
  const { marketCap, momentumScore, buyPressure, loreScore, performanceScore = 0 } = params;

  // 1. Established / Mid-Cap Runners ($100k - $50M)
  if (marketCap >= 1_000_000) {
    if (momentumScore >= 70 || performanceScore >= 70) return "2x – 4x Established Runner";
    if (performanceScore >= 50) return "1.5x – 2.5x Momentum Continuation";
    return "1.3x – 1.8x Safe Swing";
  }

  if (marketCap >= 100_000) {
    if (momentumScore >= 80 && buyPressure >= 0.7) return "3x – 5x Mid-Cap Runner ($500K–$1M+ Target)";
    if (performanceScore >= 60 || momentumScore >= 60) return "2x – 3x Solid Momentum Rally";
    return "1.5x – 2x Continuation Move";
  }

  // 2. Early Ground-Floor Entry ($5K - $100K)
  if (loreScore >= 75 && momentumScore >= 80) return "5x – 10x Curve Breakout ($50K–$150K Target)";
  if (momentumScore >= 75 && buyPressure >= 0.7) return "3x – 5x Initial Run ($25K–$60K Target)";
  if (momentumScore >= 60 || performanceScore >= 50) return "2x – 3x Quick Double ($15K–$30K Target)";
  return "1.5x – 2x Scalp (Take Profit Early)";
}

/**
 * Rules-v1 Transparent Scoring Engine
 *
 * Scores both early gems (velocity-based) AND established coins doing well (performance-based).
 * Every coin is judged on:
 *   Safety (20pts) + Momentum (20pts) + Performance (20pts) + Holders (10pts) + Smart Money (15pts) + Liquidity (10pts) + Social/Lore (5pts)
 */
export function calculateRulesV1Score(inputs: ScoringInputs): ScoringResult {
  const modelVersion = "rules-v1.1";
  const {
    riskScore,
    volumeVelocity,
    priceVelocity,
    buyPressure,
    holderGrowthPct,
    smartMoneyCount,
    liquidityUsd,
    marketCap = 0,
    loreScore = 0,
    priceChange1h = 0,
    priceChange24h = 0,
    volume24h = 0,
  } = inputs;

  // 1. Safety Score (max 20pts) — lower risk = higher safety
  const safetyScore = Math.max(0, 20 * (1 - riskScore / 100));

  // 2. Momentum Score (max 20pts) — velocity-based, rewards early breakouts
  const normVolVel = Math.min(100, volumeVelocity * 10);
  const normPriceVel = Math.min(100, Math.max(0, priceVelocity * 2));
  const normBuyPressure = buyPressure * 100;
  const rawMomentum = 0.4 * normVolVel + 0.3 * normPriceVel + 0.3 * normBuyPressure;
  const momentumScore = Math.min(100, Math.max(0, rawMomentum));
  const momentumComponent = (momentumScore / 100) * 20;

  // 3. Performance Score (max 20pts) — rewards coins ALREADY doing well:
  //    Strong 24h price change, high absolute volume, recovering after dip.
  //    This is the key signal for "established coins doing well".
  let rawPerformance = 0;

  // a) 24h price change (up to 12pts): +50% = 6pts, +100% = 10pts, +200%+ = 12pts
  if (priceChange24h > 0) {
    rawPerformance += Math.min(12, (priceChange24h / 200) * 12);
  } else if (priceChange24h < -20) {
    // Penalize heavy 24h losers
    rawPerformance -= 4;
  }

  // b) 1h price change (up to 5pts): quick momentum confirmation
  if (priceChange1h > 0) {
    rawPerformance += Math.min(5, (priceChange1h / 20) * 5);
  }

  // c) Absolute 24h volume (up to 8pts): $50K = 2pts, $500K = 5pts, $2M+ = 8pts
  if (volume24h > 0) {
    rawPerformance += Math.min(8, Math.log10(Math.max(1, volume24h / 1000)) * 2.5);
  }

  // Also boost performance if velocity metrics are strong (new token doing well)
  if (normVolVel > 60) rawPerformance += 3;
  if (normPriceVel > 60) rawPerformance += 2;

  const performanceScore = Math.min(100, Math.max(0, rawPerformance * 3.3)); // normalize to 0-100
  const performanceComponent = (performanceScore / 100) * 20;

  // 4. Holder Growth Score (max 10pts)
  const normHolder = Math.min(100, Math.max(0, holderGrowthPct * 5));
  const holderScore = normHolder;
  const holderComponent = (holderScore / 100) * 10;

  // 5. Smart Money Score (max 15pts)
  const normSmartMoney = Math.min(100, smartMoneyCount * 25);
  const smartMoneyScore = normSmartMoney;
  const smartMoneyComponent = (smartMoneyScore / 100) * 15;

  // 6. Liquidity Score (max 10pts) — healthy across micro ($1k) to mid-cap ($1M+)
  let liquidityScore = 0;
  if (liquidityUsd >= 1000) {
    liquidityScore = Math.min(100, Math.log10(liquidityUsd / 1000) * 40);
  }
  const liquidityComponent = (liquidityScore / 100) * 10;

  // 7. Social / Culture Lore Score (max 5pts)
  const socialScore = loreScore;
  const socialComponent = (socialScore / 100) * 5;

  // Total raw opportunity
  let rawOpportunity =
    safetyScore +
    momentumComponent +
    performanceComponent +
    holderComponent +
    smartMoneyComponent +
    liquidityComponent +
    socialComponent;

  // Safety Gate: if risk > 70, cap hard at 35 (WATCH level)
  const isBlockedByRisk = riskScore > 70;
  if (isBlockedByRisk) {
    rawOpportunity = Math.min(rawOpportunity, 35);
  }

  const finalOpportunity = Math.round(Math.min(100, Math.max(0, rawOpportunity)));

  return {
    opportunityScore: finalOpportunity,
    riskScore: Math.round(riskScore),
    momentumScore: Math.round(momentumScore),
    smartMoneyScore: Math.round(smartMoneyScore),
    liquidityScore: Math.round(liquidityScore),
    holderScore: Math.round(holderScore),
    socialScore: Math.round(socialScore),
    performanceScore: Math.round(performanceScore),
    opportunityLevel: classifyOpportunityLevel(finalOpportunity),
    projectedMultiplier: estimateProjectedMultiplier({
      marketCap: marketCap || 0,
      momentumScore: Math.round(momentumScore),
      buyPressure,
      loreScore,
      performanceScore: Math.round(performanceScore),
    }),
    isBlockedByRisk,
    modelVersion,
  };
}
