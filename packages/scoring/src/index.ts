import type { OpportunityLevel } from "@degenradar/types";

export interface ScoringInputs {
  riskScore: number; // 0 - 100
  volumeVelocity: number;
  priceVelocity: number;
  buyPressure: number; // 0.0 - 1.0
  holderGrowthPct: number;
  smartMoneyCount: number;
  liquidityUsd: number;
  loreScore?: number; // 0 - 100
}

export interface ScoringResult {
  opportunityScore: number;
  riskScore: number;
  momentumScore: number;
  smartMoneyScore: number;
  liquidityScore: number;
  holderScore: number;
  socialScore: number;
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
 * Predicts realistic short-term upside target multiple based on MC headroom & momentum
 */
export function estimateProjectedMultiplier(params: {
  marketCap: number;
  momentumScore: number;
  buyPressure: number;
  loreScore: number;
}): string {
  const { marketCap, momentumScore, buyPressure, loreScore } = params;

  // Pump.fun / initial DEX curve target is usually $65k-$80k graduation
  // If entry is $5k - $12k:
  if (loreScore >= 75 && momentumScore >= 80) {
    return "5x – 10x Target ($40K–$70K Curve Breakout)";
  }
  if (momentumScore >= 75 && buyPressure >= 0.7) {
    return "3x – 5x Target ($20K–$35K Initial Run)";
  }
  if (momentumScore >= 60) {
    return "2x – 3x Target ($12K–$18K Quick Double)";
  }
  return "1.5x – 2x Target (Scalp / Take Profit Early)";
}

/**
 * Rules-v1 Transparent Scoring Engine
 */
export function calculateRulesV1Score(inputs: ScoringInputs): ScoringResult {
  const modelVersion = "rules-v1";
  const {
    riskScore,
    volumeVelocity,
    priceVelocity,
    buyPressure,
    holderGrowthPct,
    smartMoneyCount,
    liquidityUsd,
    loreScore = 0,
  } = inputs;

  // 1. Safety Score component (max 20)
  // Higher risk means lower safety
  const safetyScore = Math.max(0, 20 * (1 - riskScore / 100));

  // 2. Momentum Score (0 - 100)
  // Normalizing components
  const normVolVel = Math.min(100, volumeVelocity * 10);
  const normPriceVel = Math.min(100, Math.max(0, priceVelocity * 2));
  const normBuyPressure = buyPressure * 100;

  const rawMomentum = 0.4 * normVolVel + 0.3 * normPriceVel + 0.3 * normBuyPressure;
  const momentumScore = Math.min(100, Math.max(0, rawMomentum));
  const momentumComponent = (momentumScore / 100) * 25; // max 25

  // 3. Holder Growth Score (max 15)
  const normHolder = Math.min(100, Math.max(0, holderGrowthPct * 5));
  const holderScore = normHolder;
  const holderComponent = (holderScore / 100) * 15;

  // 4. Smart Money Score (max 20)
  const normSmartMoney = Math.min(100, smartMoneyCount * 25);
  const smartMoneyScore = normSmartMoney;
  const smartMoneyComponent = (smartMoneyScore / 100) * 20;

  // 5. Liquidity Score (max 10)
  // Scaled for early gem discovery (healthy between $500 - $25k)
  let liquidityScore = 0;
  if (liquidityUsd >= 500) {
    liquidityScore = Math.min(100, (liquidityUsd / 10000) * 100);
  }
  const liquidityComponent = (liquidityScore / 100) * 10;

  // 6. Social / Culture Lore Score (max 10)
  const socialScore = loreScore;
  const socialComponent = (socialScore / 100) * 10;

  // Total Unblocked Opportunity Score
  let rawOpportunity =
    safetyScore +
    momentumComponent +
    holderComponent +
    smartMoneyComponent +
    liquidityComponent +
    socialComponent;

  // Safety Gate: If risk > 70, opportunty score is strictly capped
  const isBlockedByRisk = riskScore > 70;
  if (isBlockedByRisk) {
    rawOpportunity = Math.min(rawOpportunity, 35); // Capped to WATCH level
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
    opportunityLevel: classifyOpportunityLevel(finalOpportunity),
    projectedMultiplier: estimateProjectedMultiplier({
      marketCap: 0,
      momentumScore: Math.round(momentumScore),
      buyPressure,
      loreScore,
    }),
    isBlockedByRisk,
    modelVersion,
  };
}
