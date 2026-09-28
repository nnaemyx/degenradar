import { Worker } from "bullmq";
import {
  redis,
  defaultWorkerOptions,
  enqueueFeatureCalculation,
  publishWsEvent,
} from "@degenradar/redis";
import { db, tokens, riskAssessments, pools } from "@degenradar/db";
import { jupiter } from "@degenradar/jupiter";
import { birdeye } from "@degenradar/birdeye";
import { evaluateRiskFlags } from "@degenradar/features";
import { createLogger } from "@degenradar/logger";
import { eq } from "drizzle-orm";
import type { RiskAnalysisJob } from "@degenradar/types";

const log = createLogger("worker-risk-engine");

export const riskWorker = new Worker<RiskAnalysisJob>(
  "risk-analysis",
  async (job) => {
    const { tokenId, mintAddress } = job.data;
    log.info({ tokenId, mintAddress }, "Assessing token risk");

    // 1. Fetch token record
    const [token] = await db.select().from(tokens).where(eq(tokens.id, tokenId)).limit(1);
    if (!token) {
      log.warn({ tokenId }, "Token not found for risk assessment");
      return;
    }

    // 2. Fetch market/liquidity stats
    const overview = await birdeye.getTokenOverview(mintAddress);
    const liquidityUsd = overview?.liquidity || 0;

    // 3. Check Sellability with Jupiter
    const { isSellable, score: sellScore } = await jupiter.assessSellability(mintAddress);

    // 4. Fetch Top Holders for concentration analysis
    const topHolders = await birdeye.getTokenHolders(mintAddress, 10);
    const top10Concentration = topHolders.reduce((sum, h) => sum + (h.pct || 0), 0);

    // 5. Evaluate overall risk flags
    const { overallRisk, flags } = evaluateRiskFlags({
      mintAuthority: token.mintAuthority,
      freezeAuthority: token.freezeAuthority,
      top10Concentration,
      creatorPct: 0,
      liquidityUsd,
      isSellable,
    });

    // 6. Record risk assessment
    const [assessment] = await db
      .insert(riskAssessments)
      .values({
        tokenId: token.id,
        mintAuthorityEnabled: Boolean(token.mintAuthority),
        freezeAuthorityEnabled: Boolean(token.freezeAuthority),
        top10HolderPct: String(top10Concentration),
        liquidityUsd: String(liquidityUsd),
        sellabilityScore: String(sellScore),
        overallRiskScore: String(overallRisk),
        riskFlags: flags,
      })
      .returning();

    log.info(
      { tokenId, mintAddress, overallRisk, isBlocked: overallRisk > 80 },
      "Risk assessment complete"
    );

    // 7. Progressive Enrichment Gate
    // If the token is not an extreme scam/honeypot (overallRisk <= 80), proceed to Feature & Momentum calculations
    if (overallRisk <= 80) {
      await enqueueFeatureCalculation({
        tokenId: token.id,
        timestamp: new Date().toISOString(),
      });
    } else {
      log.warn({ tokenId, mintAddress, overallRisk }, "Token blocked by Safety Gate: skipping feature calculations");
    }

    // Broadcast risk update via WebSocket
    await publishWsEvent({
      type: "TOKEN_RISK_UPDATED",
      timestamp: new Date().toISOString(),
      data: {
        tokenId: token.id,
        mintAddress: token.mintAddress,
        overallRisk,
        flags,
      },
    });

    return { assessmentId: assessment.id, overallRisk };
  },
  {
    ...defaultWorkerOptions,
    concurrency: 10,
  }
);

riskWorker.on("failed", (job, err) => {
  log.error({ jobId: job?.id, err }, "Risk worker job failed");
});

log.info("Risk Engine Worker started and listening for jobs");
