import { Worker } from "bullmq";
import {
  redis,
  defaultWorkerOptions,
  enqueueAlertProcessing,
  enqueueOutcomeCalculation,
  publishWsEvent,
} from "@degenradar/redis";
import {
  db,
  tokens,
  riskAssessments,
  tokenFeatures,
  tokenSnapshots,
  tokenScores,
} from "@degenradar/db";
import { calculateRulesV1Score, detectTokenLore } from "@degenradar/scoring";
import { createLogger } from "@degenradar/logger";
import { eq, desc } from "drizzle-orm";
import type { ScoreCalculationJob, TokenScoreUpdatedEvent } from "@degenradar/types";

const log = createLogger("worker-scoring");

export const scoringWorker = new Worker<ScoreCalculationJob>(
  "score-calculation",
  async (job) => {
    const { tokenId } = job.data;
    log.info({ tokenId }, "Calculating token scores");

    // 1. Fetch token record
    const [token] = await db.select().from(tokens).where(eq(tokens.id, tokenId)).limit(1);
    if (!token) return;

    // 2. Fetch latest risk assessment
    const [latestRisk] = await db
      .select()
      .from(riskAssessments)
      .where(eq(riskAssessments.tokenId, token.id))
      .orderBy(desc(riskAssessments.timestamp))
      .limit(1);

    const riskScore = latestRisk ? Number(latestRisk.overallRiskScore) : 50;

    // 3. Fetch latest features
    const [features] = await db
      .select()
      .from(tokenFeatures)
      .where(eq(tokenFeatures.tokenId, token.id))
      .orderBy(desc(tokenFeatures.timestamp))
      .limit(1);

    // 4. Fetch latest snapshot
    const [snapshot] = await db
      .select()
      .from(tokenSnapshots)
      .where(eq(tokenSnapshots.tokenId, token.id))
      .orderBy(desc(tokenSnapshots.timestamp))
      .limit(1);

    const liquidityUsd = snapshot ? Number(snapshot.liquidityUsd || 0) : 0;
    const priceUsd = snapshot ? Number(snapshot.priceUsd || 0) : 0;
    const marketCap = snapshot ? Number(snapshot.marketCap || 0) : 0;

    // Detect cultural lore, narrative category & meme potential
    const loreInfo = detectTokenLore({
      name: token.name,
      symbol: token.symbol,
      marketCap,
    });

    // 5. Calculate Score
    const result = calculateRulesV1Score({
      riskScore,
      volumeVelocity: features ? Number(features.volumeVelocity || 0) : 0,
      priceVelocity: features ? Number(features.priceVelocity || 0) : 0,
      buyPressure: features ? Number(features.buyPressure || 0.5) : 0.5,
      holderGrowthPct: features ? Number(features.holderVelocity || 0) : 0,
      smartMoneyCount: 0,
      liquidityUsd,
      marketCap,
      loreScore: loreInfo.loreScore,
    });

    // 6. Insert into token_scores (always preserve historical time series for backtesting)
    const [scoreRecord] = await db
      .insert(tokenScores)
      .values({
        tokenId: token.id,
        opportunityScore: String(result.opportunityScore),
        riskScore: String(result.riskScore),
        momentumScore: String(result.momentumScore),
        smartMoneyScore: String(result.smartMoneyScore),
        liquidityScore: String(result.liquidityScore),
        holderScore: String(result.holderScore),
        socialScore: String(result.socialScore),
        modelVersion: result.modelVersion,
      })
      .returning();

    // 7. Publish WebSocket broadcast
    await publishWsEvent<TokenScoreUpdatedEvent>({
      type: "TOKEN_SCORE_UPDATED",
      timestamp: new Date().toISOString(),
      data: {
        mintAddress: token.mintAddress,
        symbol: token.symbol,
        opportunityScore: result.opportunityScore,
        riskScore: result.riskScore,
        momentumScore: result.momentumScore,
        modelVersion: result.modelVersion,
        priceUsd: priceUsd > 0 ? priceUsd : null,
        marketCap: snapshot?.marketCap ? Number(snapshot.marketCap) : null,
        liquidityUsd: liquidityUsd > 0 ? liquidityUsd : null,
      },
    });

    log.info(
      {
        tokenId,
        mint: token.mintAddress,
        opportunity: result.opportunityScore,
        level: result.opportunityLevel,
      },
      "Token scored successfully"
    );

    // 8. If strong opportunity signal, trigger Alert Engine
    if (result.opportunityScore >= 75) {
      await enqueueAlertProcessing({
        tokenId: token.id,
        scoreId: String(scoreRecord.id),
        opportunityScore: result.opportunityScore,
        riskScore: result.riskScore,
        projectedMultiplier: result.projectedMultiplier,
        lore: loreInfo.lore,
        category: loreInfo.category,
        signals: [
          ...(result.momentumScore > 70 ? ["🔥 High Buyer Momentum"] : []),
          ...(result.smartMoneyScore > 60 ? ["🔥 Quality Wallet Entry"] : []),
          ...(result.opportunityScore >= 90 ? ["⚡ Viral Narrative Breakout"] : []),
          ...(marketCap >= 100_000 ? [`📈 Strong Market Runner ($${Math.round(marketCap / 1000)}K MC)`] : []),
        ],
      });

      // 9. Enqueue outcome check (record baseline for backtesting)
      if (priceUsd > 0) {
        await enqueueOutcomeCalculation({
          tokenId: token.id,
          signalId: String(scoreRecord.id),
          signalTimestamp: new Date().toISOString(),
          priceAtSignal: priceUsd,
        });
      }
    } else if (riskScore >= 75 || (features && Number(features.priceVelocity || 0) < -25)) {
      // ⚠️ EARLY RUG / DUMP DETECTOR
      await enqueueAlertProcessing({
        tokenId: token.id,
        scoreId: String(scoreRecord.id),
        opportunityScore: result.opportunityScore,
        riskScore,
        isRugWarning: true,
        signals: [
          ...(Number(features?.priceVelocity || 0) < -25 ? ["🚨 Rapid -25% Price Plunge in 1m"] : []),
          ...(riskScore >= 80 ? ["🚨 Dev / Top Holder Massive Sell Detected"] : []),
          ...(latestRisk?.freezeAuthorityEnabled ? ["🚨 Freeze Authority Triggered (Honeypot)"] : []),
        ],
      });
    }

    return { scoreId: scoreRecord.id, opportunityScore: result.opportunityScore };
  },
  {
    ...defaultWorkerOptions,
    concurrency: 20,
  }
);

scoringWorker.on("failed", (job, err) => {
  log.error({ jobId: job?.id, err }, "Scoring worker job failed");
});

log.info("Scoring Engine Worker started and listening for jobs");
