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

    // Formatted Telegram Alert message with explanatory reasoning
    const message = `🚨 <b>DEGENRADAR SIGNAL ALERT</b>

<b>Token:</b> $${token.symbol || "UNKNOWN"} (${token.name || "Token"})
<b>Mint:</b> <code>${token.mintAddress}</code>

📊 <b>Metrics:</b>
• Price: <b>${price}</b>
• MC: <b>${mc}</b>
• Liquidity: <b>${liq}</b>

🎯 <b>DegenRadar Scores:</b>
• Opportunity Score: <b>${opportunityScore}/100</b>
• Risk Score: <b>${riskScore}/100</b>

🔥 <b>Detected Drivers:</b>
${signals.map((s) => `• ${s}`).join("\n")}

🔗 <a href="https://solscan.io/token/${token.mintAddress}">View on Solscan</a> | <a href="https://birdeye.so/token/${token.mintAddress}?chain=solana">Birdeye</a>`;

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
