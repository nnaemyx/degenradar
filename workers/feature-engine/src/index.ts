import { Worker } from "bullmq";
import { redis, enqueueScoreCalculation } from "@degenradar/redis";
import { db, tokens, tokenSnapshots, tokenFeatures, trades } from "@degenradar/db";
import { birdeye } from "@degenradar/birdeye";
import {
  calculateVolumeVelocity,
  calculatePriceVelocity,
  calculateBuyPressure,
} from "@degenradar/features";
import { createLogger } from "@degenradar/logger";
import { eq, desc } from "drizzle-orm";
import type { FeatureCalculationJob } from "@degenradar/types";

const log = createLogger("worker-feature-engine");

export const featureWorker = new Worker<FeatureCalculationJob>(
  "feature-calculation",
  async (job) => {
    const { tokenId } = job.data;
    log.info({ tokenId }, "Calculating token quantitative features");

    // 1. Fetch token record
    const [token] = await db.select().from(tokens).where(eq(tokens.id, tokenId)).limit(1);
    if (!token) return;

    // 2. Fetch or create a fresh token snapshot from Birdeye
    const overview = await birdeye.getTokenOverview(token.mintAddress);
    if (overview) {
      await db.insert(tokenSnapshots).values({
        tokenId: token.id,
        priceUsd: String(overview.price || 0),
        marketCap: String(overview.mc || 0),
        liquidityUsd: String(overview.liquidity || 0),
        volume5m: String(overview.v5mUSD || 0),
        volume1h: String(overview.v1hUSD || 0),
        holders: overview.holder || 0,
      });
    }

    // 3. Fetch recent snapshots for velocity calculation
    const snapshots = await db
      .select()
      .from(tokenSnapshots)
      .where(eq(tokenSnapshots.tokenId, token.id))
      .orderBy(desc(tokenSnapshots.timestamp))
      .limit(10);

    const volumeVelocity = calculateVolumeVelocity(snapshots as any);
    const priceVelocity = calculatePriceVelocity(snapshots as any);

    // 4. Fetch recent trades for buy pressure
    const recentTrades = await db
      .select()
      .from(trades)
      .where(eq(trades.tokenId, token.id))
      .orderBy(desc(trades.timestamp))
      .limit(50);

    const buyPressure = calculateBuyPressure(recentTrades);

    // 5. Insert calculated features
    await db.insert(tokenFeatures).values({
      tokenId: token.id,
      volumeVelocity: String(volumeVelocity.toFixed(4)),
      priceVelocity: String(priceVelocity.toFixed(4)),
      buyPressure: String(buyPressure.toFixed(4)),
      smartMoneyScore: "50.00",
    });

    log.info(
      { tokenId, volumeVelocity, priceVelocity, buyPressure },
      "Features calculated successfully"
    );

    // 6. Enqueue score calculation
    await enqueueScoreCalculation({
      tokenId: token.id,
      timestamp: new Date().toISOString(),
      triggerSource: "event",
    });

    return { tokenId };
  },
  {
    connection: redis,
    concurrency: 15,
  }
);

featureWorker.on("failed", (job, err) => {
  log.error({ jobId: job?.id, err }, "Feature calculation job failed");
});

log.info("Feature Engine Worker started and listening for jobs");
