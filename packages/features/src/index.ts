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
  const notTradeable = !params.isSellable;
  const highConcentration = params.top10Concentration > 35;
  const creatorRisk = params.creatorPct > 15;
  const lowLiquidity = params.liquidityUsd < 500; // Early calls allowed down to $500 liquidity

  // Instant Critical Disqualifiers (Instant Rug / Scam check)
  if (hasMint || hasFreeze || notTradeable) {
    return {
      overallRisk: 100, // Automatic maximum risk - BLOCKED
      flags: {
        mintAuthority: hasMint,
        freezeAuthority: hasFreeze,
        highHolderConcentration: highConcentration,
        creatorSelling: creatorRisk,
        suspiciousClusters: highConcentration,
        lowLiquidity,
        notTradeable,
      },
    };
  }

  // Distribution & Liquidity Penalties for mechanically safe coins
  if (highConcentration) riskScore += 35;
  if (creatorRisk) riskScore += 20;
  if (lowLiquidity) riskScore += 25;

  const flags: RiskFlags = {
    mintAuthority: false,
    freezeAuthority: false,
    highHolderConcentration: highConcentration,
    creatorSelling: creatorRisk,
    suspiciousClusters: highConcentration,
    lowLiquidity,
    notTradeable: false,
  };

  return {
    overallRisk: Math.min(100, riskScore),
    flags,
  };
}

export interface TokenLoreInfo {
  category: string;
  lore: string;
  loreScore: number;
}

/**
 * Culture Radar: Generates narrative classification and meme lore for Solana tokens
 */
export function detectTokenLore(params: {
  name?: string | null;
  symbol?: string | null;
  description?: string | null;
  marketCap?: number | null;
}): TokenLoreInfo {
  const name = (params.name || "").toLowerCase();
  const symbol = (params.symbol || "").toLowerCase();
  const combined = `${name} ${symbol}`;
  const rawDesc = params.description?.trim();
  const mc = params.marketCap || 0;

  let category = "💎 Cult Meme / Community";
  let baseLore = "Viral decentralized meme gaining organic momentum across Solana trading desks.";
  let loreScore = 65;

  // 1. AI Agents / Autonomous
  if (/ai|gpt|agent|bot|neural|intel|autonomous|cortex|deep|synthetic|mind|matrix/.test(combined)) {
    category = "🤖 AI Autonomous Agent";
    baseLore = "Decentralized AI experiment exploring autonomous machine intelligence and speculative mindshare on Solana.";
    loreScore = 85;
  }
  // 2. Animal / Mascot
  else if (/cat|dog|shib|pepe|frog|hippo|turtle|seal|penguin|monkey|ape|duck|bull|bear|floki|inu|bonk|wojak|chad/.test(combined)) {
    category = "🐾 Viral Mascot & Animal Lore";
    baseLore = "Character-driven meme coin backed by viral cultural appeal and high-velocity community meme production.";
    loreScore = 80;
  }
  // 3. TikTok / Brainrot / Internet Trends
  else if (/tiktok|viral|trend|brainrot|skibidi|rizz|sigma|hawk|tuah|chill|guy|mood/.test(combined)) {
    category = "📺 TikTok & Internet Brainrot";
    baseLore = "Mainstream short-form internet trend transitioning rapidly into decentralized DEX liquidity.";
    loreScore = 88;
  }
  // 4. Political / Macro
  else if (/trump|biden|elon|fed|powell|election|gov|usa|maga|patriot/.test(combined)) {
    category = "🏛️ Political & Macro News";
    baseLore = "Geopolitical & headline-driven attention play capturing high-frequency news volatility.";
    loreScore = 82;
  }
  // 5. Community Takeover
  else if (/cto|takeover|revive|community/.test(combined)) {
    category = "💎 Community Takeover (CTO)";
    baseLore = "100% organic decentralized takeover movement after original team departure.";
    loreScore = 78;
  }

  // Combine with raw description if available
  let finalLore = rawDesc && rawDesc.length > 10
    ? `${rawDesc.slice(0, 160)}${rawDesc.length > 160 ? "..." : ""}`
    : baseLore;

  // Add Market Cap Stage context
  if (mc >= 200_000) {
    finalLore += ` [Stage: Established Runner (~$${Math.round(mc / 1000)}K MC)]`;
  } else if (mc >= 50_000) {
    finalLore += ` [Stage: Raydium Mid-Cap (~$${Math.round(mc / 1000)}K MC)]`;
  } else if (mc > 0) {
    finalLore += ` [Stage: Early Micro-Cap (~$${Math.round(mc / 1000)}K MC)]`;
  }

  return {
    category,
    lore: finalLore,
    loreScore,
  };
}
