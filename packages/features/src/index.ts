import type { Trade, TokenSnapshot, Holder, RiskFlags } from "@degenradar/types";

/**
 * Calculates buy pressure: buyVolume / totalVolume (0.0 to 1.0)
 */
export function calculateBuyPressure(trades: Array<{ side: string; usdValue?: string | number | null }>): number {
  if (!trades.length) return 0.5;

  let buyVolume = 0;
  let totalVolume = 0;

  for (const t of trades) {
    const val = Number(t.usdValue) || 1;
    totalVolume += val;
    if (t.side.toUpperCase() === "BUY") {
      buyVolume += val;
    }
  }

  if (totalVolume === 0) return 0.5;
  return buyVolume / totalVolume;
}

/**
 * Calculates volume velocity between snapshots ($/sec)
 */
export function calculateVolumeVelocity(snapshots: TokenSnapshot[]): number {
  if (snapshots.length < 2) return 0;
  const sorted = [...snapshots].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const prev = sorted[sorted.length - 2];
  const curr = sorted[sorted.length - 1];

  const timeDiffSec = Math.max(1, (new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 1000);
  const vCurr = Number(curr.volume5m || curr.volume1m || 0);
  const vPrev = Number(prev.volume5m || prev.volume1m || 0);

  return Math.max(0, (vCurr - vPrev) / timeDiffSec);
}

/**
 * Calculates price velocity (% change per minute)
 */
export function calculatePriceVelocity(snapshots: TokenSnapshot[]): number {
  if (snapshots.length < 2) return 0;
  const sorted = [...snapshots].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const prev = sorted[sorted.length - 2];
  const curr = sorted[sorted.length - 1];

  const pPrev = Number(prev.priceUsd || 0);
  const pCurr = Number(curr.priceUsd || 0);

  if (pPrev <= 0) return 0;

  const timeDiffMin = Math.max(0.1, (new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 60000);
  const pctChange = ((pCurr - pPrev) / pPrev) * 100;

  return pctChange / timeDiffMin;
}

/**
 * Calculates holder growth rate (% per minute)
 */
export function calculateHolderVelocity(snapshots: TokenSnapshot[]): number {
  if (snapshots.length < 2) return 0;
  const sorted = [...snapshots].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const prev = sorted[sorted.length - 2];
  const curr = sorted[sorted.length - 1];

  const hPrev = prev.holders || 0;
  const hCurr = curr.holders || 0;

  if (hPrev <= 0) return 0;

  const timeDiffMin = Math.max(0.1, (new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 60000);
  return (((hCurr - hPrev) / hPrev) * 100) / timeDiffMin;
}

/**
 * Calculates Top 10 holder concentration percentage (0 to 100)
 */
export function calculateTop10Concentration(holders: Holder[]): number {
  if (!holders.length) return 0;
  const sorted = [...holders].sort((a, b) => Number(b.percentage || 0) - Number(a.percentage || 0));
  const top10 = sorted.slice(0, 10);
  return top10.reduce((acc, h) => acc + Number(h.percentage || 0), 0);
}

/**
 * Assess overall risk indicators
 */
export function evaluateRiskFlags(params: {
  mintAuthority: string | null;
  freezeAuthority: string | null;
  top10Concentration: number;
  creatorPct: number;
  liquidityUsd: number;
  isSellable: boolean;
}): { overallRisk: number; flags: RiskFlags } {
  let riskScore = 0;

  const hasMint = Boolean(params.mintAuthority);
  const hasFreeze = Boolean(params.freezeAuthority);
  const highConcentration = params.top10Concentration > 40;
  const creatorRisk = params.creatorPct > 15;
  const lowLiquidity = params.liquidityUsd < 5000;
  const notTradeable = !params.isSellable;

  if (hasMint) riskScore += 25;
  if (hasFreeze) riskScore += 30;
  if (highConcentration) riskScore += 20;
  if (creatorRisk) riskScore += 15;
  if (lowLiquidity) riskScore += 20;
  if (notTradeable) riskScore += 50;

  const flags: RiskFlags = {
    mintAuthority: hasMint,
    freezeAuthority: hasFreeze,
    highHolderConcentration: highConcentration,
    creatorSelling: false,
    suspiciousClusters: highConcentration,
    lowLiquidity,
    notTradeable,
  };

  return {
    overallRisk: Math.min(100, riskScore),
    flags,
  };
}
