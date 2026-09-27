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

    // Formatted Telegram Alert message with explanatory reasoning & instant mobile links
    const message = `🚨 <b>DEGENRADAR EARLY SIGNAL</b>

<b>Token:</b> <b>$${token.symbol || "UNKNOWN"}</b> (${token.name || "Token"})
<b>Mint:</b> <code>${token.mintAddress}</code>

🛡️ <b>Safety Verification:</b>
• Mint Authority: <b>${mintRevoked}</b>
• Freeze Authority: <b>${freezeRevoked}</b>
• Risk Score: <b>${riskScore}/100</b> (${riskScore <= 30 ? "🟢 LOW RISK" : "🟡 MODERATE"})

📊 <b>Micro-Cap Metrics:</b>
• Market Cap: <b>${mc}</b>
• Liquidity: <b>${liq}</b>
• Price: <b>${price}</b>

🎯 <b>Opportunity Score:</b> <b>${opportunityScore}/100</b>

🔥 <b>Detected Catalysts:</b>
${signals.map((s) => `• ${s}`).join("\n")}

📱 <b>Quick View:</b>
<a href="https://dexscreener.com/solana/${token.mintAddress}">DexScreener</a> | <a href="https://solscan.io/token/${token.mintAddress}">Solscan</a> | <a href="https://birdeye.so/token/${token.mintAddress}?chain=solana">Birdeye</a>`;

    const telegramSent = await sendTelegramMessage(message);

    // Save to alerts table
    await db.insert(alerts).values({
      tokenId: token.id,
      alertType: opportunityScore >= 90 ? "EXTREME_SIGNAL" : "STRONG_SIGNAL",
      score: String(opportunityScore),
      payload: {
        signals,
        opportunityScore,
        riskScore,
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
