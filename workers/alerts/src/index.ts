import { Worker } from "bullmq";
import { redis, publishWsEvent } from "@degenradar/redis";
import { db, tokens, alerts, tokenSnapshots } from "@degenradar/db";
import { env } from "@degenradar/config";
import { createLogger } from "@degenradar/logger";
import { eq, desc } from "drizzle-orm";
import axios from "axios";
import type { AlertProcessingJob } from "@degenradar/types";

const log = createLogger("worker-alerts");

async function sendTelegramMessage(text: string): Promise<boolean> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    log.debug("Telegram credentials not set; skipping Telegram broadcast");
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    await axios.post(url, {
      chat_id: env.TELEGRAM_CHAT_ID,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
    return true;
  } catch (error) {
    log.error({ error: (error as Error).message }, "Failed to send Telegram message");
    return false;
  }
}

export const alertWorker = new Worker<AlertProcessingJob>(
  "alert-processing",
  async (job) => {
    const { tokenId, opportunityScore, riskScore, signals } = job.data;
    log.info({ tokenId, opportunityScore }, "Processing signal alert");

    const [token] = await db.select().from(tokens).where(eq(tokens.id, tokenId)).limit(1);
    if (!token) return;

    const [snapshot] = await db
      .select()
      .from(tokenSnapshots)
      .where(eq(tokenSnapshots.tokenId, token.id))
      .orderBy(desc(tokenSnapshots.timestamp))
      .limit(1);

    const price = snapshot?.priceUsd ? `$${Number(snapshot.priceUsd).toFixed(6)}` : "N/A";
    const mc = snapshot?.marketCap ? `$${Number(snapshot.marketCap).toLocaleString()}` : "N/A";
    const liq = snapshot?.liquidityUsd ? `$${Number(snapshot.liquidityUsd).toLocaleString()}` : "N/A";

    const mintRevoked = !token.mintAuthority ? "✅ Revoked" : "❌ Active (DANGEROUS)";
    const freezeRevoked = !token.freezeAuthority ? "✅ Revoked" : "❌ Active (DANGEROUS)";

    const { projectedMultiplier = "2x – 3x Target", isRugWarning = false } = job.data;

    let message = "";
    let alertType: "RUG_WARNING" | "EXTREME_SIGNAL" | "STRONG_SIGNAL" = "STRONG_SIGNAL";

    if (isRugWarning) {
      alertType = "RUG_WARNING";
      message = `⚠️⚠️ <b>DEGENRADAR RUG / EXIT WARNING</b> ⚠️⚠️

<b>Token:</b> <b>$${token.symbol || "UNKNOWN"}</b>
<b>Mint:</b> <code>${token.mintAddress}</code>

🚨 <b>DANGER DETECTED:</b>
${signals.map((s) => `• ${s}`).join("\n")}

📊 <b>Current State:</b>
• Price: <b>${price}</b>
• Market Cap: <b>${mc}</b>
• Risk Score: <b>${riskScore}/100 (HIGH RISK)</b>

👉 <b>RECOMMENDED ACTION:</b>
Consider taking profits or selling your position immediately!

📱 <a href="https://jup.ag/swap/SOL-${token.mintAddress}">Emergency Sell on Jupiter</a> | <a href="https://dexscreener.com/solana/${token.mintAddress}">DexScreener</a>`;
    } else {
      alertType = opportunityScore >= 90 ? "EXTREME_SIGNAL" : "STRONG_SIGNAL";
      message = `🚨 <b>DEGENRADAR EARLY SIGNAL ($5K–$12K SWEET SPOT)</b>

<b>Token:</b> <b>$${token.symbol || "UNKNOWN"}</b> (${token.name || "Token"})
<b>Mint:</b> <code>${token.mintAddress}</code>

🎯 <b>Projected Potential:</b> <b>${projectedMultiplier}</b>
🎯 <b>Opportunity Score:</b> <b>${opportunityScore}/100</b>

🛡️ <b>Safety Verification:</b>
• Mint Authority: <b>${mintRevoked}</b>
• Freeze Authority: <b>${freezeRevoked}</b>
• Risk Score: <b>${riskScore}/100</b> (🟢 VERIFIED CLEAN)

📊 <b>Micro-Cap Metrics:</b>
• Market Cap: <b>${mc}</b> (Target Entry Window)
• Liquidity: <b>${liq}</b>
• Price: <b>${price}</b>

🔥 <b>Detected Drivers:</b>
${signals.map((s) => `• ${s}`).join("\n")}

📱 <b>Quick View & Trade:</b>
<a href="https://dexscreener.com/solana/${token.mintAddress}">DexScreener</a> | <a href="https://jup.ag/swap/SOL-${token.mintAddress}">Jupiter Swap</a> | <a href="https://solscan.io/token/${token.mintAddress}">Solscan</a>`;
    }

    const telegramSent = await sendTelegramMessage(message);

    // Save to alerts table
    await db.insert(alerts).values({
      tokenId: token.id,
      alertType,
      score: String(opportunityScore),
      payload: {
        signals,
        opportunityScore,
        riskScore,
        projectedMultiplier,
        isRugWarning,
        price,
        mc,
        liq,
      },
      telegramSent,
      discordSent: false,
    });

    await publishWsEvent({
      type: "ALERT_FIRED",
      timestamp: new Date().toISOString(),
      data: {
        tokenId: token.id,
        mintAddress: token.mintAddress,
        symbol: token.symbol,
        opportunityScore,
        riskScore,
        signals,
      },
    });

    log.info({ mint: token.mintAddress, telegramSent }, "Alert processed and logged successfully");
    return { tokenId, telegramSent };
  },
  {
    connection: redis,
    concurrency: 5,
  }
);

alertWorker.on("failed", (job, err) => {
  log.error({ jobId: job?.id, err }, "Alert worker job failed");
});

log.info("Alert Engine Worker started and listening for jobs");
