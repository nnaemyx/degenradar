import { Worker } from "bullmq";
import { redis, defaultWorkerOptions, enqueueScoreCalculation } from "@degenradar/redis";
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

    // 2. Fetch or create a fresh token snapshot from Birdeye (with DexScreener fallback)
    let price = 0;
    let mc = 0;
    let liquidity = 0;
    let v5m = 0;
    let v1h = 0;
    let holders = 0;
    let priceChange1h = 0;
    let priceChange24h = 0;
    let volume24h = 0;

    const overview = await birdeye.getTokenOverview(token.mintAddress);
    if (overview && (overview.price || overview.mc || overview.liquidity)) {
      price = overview.price || 0;
      mc = overview.mc || 0;
      liquidity = overview.liquidity || 0;
      v5m = overview.v5mUSD || 0;
      v1h = overview.v1hUSD || 0;
      holders = overview.holder || 0;
      priceChange24h = overview.v24hChangePercent || 0;
      volume24h = overview.v24hUSD || 0;
    } else {
      // Fallback to DexScreener for newly launched tokens & Pump.fun bonding curves
      try {
        const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${token.mintAddress}`);
        if (dexRes.ok) {
          const dexData = (await dexRes.json()) as any;
          const pair = dexData?.pairs?.[0];
          if (pair) {
            price = Number(pair.priceUsd) || 0;
            mc = Number(pair.marketCap || pair.fdv) || 0;
            liquidity = Number(pair.liquidity?.usd) || 0;
            v5m = Number(pair.volume?.m5) || 0;
            v1h = Number(pair.volume?.h1) || 0;
            priceChange1h = Number(pair.priceChange?.h1) || 0;
            priceChange24h = Number(pair.priceChange?.h24) || 0;
            volume24h = Number(pair.volume?.h24) || 0;
          }
        }
      } catch (e) {}
    }

    if (price > 0 || mc > 0 || liquidity > 0) {
      await db.insert(tokenSnapshots).values({
        tokenId: token.id,
        priceUsd: String(price),
        marketCap: String(mc),
        liquidityUsd: String(liquidity),
        volume5m: String(v5m),
        volume1h: String(v1h),
        holders,
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
      { tokenId, volumeVelocity, priceVelocity, buyPressure, priceChange24h, volume24h },
      "Features calculated successfully"
    );

    // 6. Enqueue score calculation (pass live performance data for established-coin scoring)
    await enqueueScoreCalculation({
      tokenId: token.id,
      timestamp: new Date().toISOString(),
      triggerSource: "event",
      priceChange1h,
      priceChange24h,
      volume24h,
    });

    return { tokenId };
  },
  {
    ...defaultWorkerOptions,
    concurrency: 15,
  }
);

featureWorker.on("failed", (job, err) => {
  log.error({ jobId: job?.id, err }, "Feature calculation job failed");
});

log.info("Feature Engine Worker started and listening for jobs");
