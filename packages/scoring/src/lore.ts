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
