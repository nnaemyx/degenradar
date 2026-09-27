import { Worker } from "bullmq";
import { redis, enqueueRiskAnalysis, publishWsEvent } from "@degenradar/redis";
import { db, tokens, pools } from "@degenradar/db";
import { helius } from "@degenradar/helius";
import { birdeye } from "@degenradar/birdeye";
import { createLogger } from "@degenradar/logger";
import { eq } from "drizzle-orm";
import type { TokenDiscoveryJob, TokenDiscoveredEvent } from "@degenradar/types";

const log = createLogger("worker-token-discovery");

export const tokenDiscoveryWorker = new Worker<TokenDiscoveryJob>(
  "token-discovery",
  async (job) => {
    const { mintAddress, detectedAt, source } = job.data;
    log.info({ mintAddress, source }, "Processing discovered token");

    // 1. Idempotency check: see if token exists in DB
    const existing = await db
      .select({ id: tokens.id })
      .from(tokens)
      .where(eq(tokens.mintAddress, mintAddress))
      .limit(1);

    if (existing.length > 0) {
      log.debug({ mintAddress }, "Token already exists in DB. Skipping discovery creation.");
      return { tokenId: existing[0].id, skipped: true };
    }

    // 2. Fetch metadata from Helius DAS
    const asset = await helius.getAsset(mintAddress);
    const birdeyeOverview = await birdeye.getTokenOverview(mintAddress);

    const name = asset?.content?.metadata?.name || birdeyeOverview?.name || "Unknown Token";
    const symbol = asset?.content?.metadata?.symbol || birdeyeOverview?.symbol || "TOKEN";
    const decimals = asset?.token_info?.decimals ?? birdeyeOverview?.decimals ?? 9;
    const supply = asset?.token_info?.supply ? String(asset.token_info.supply) : null;
    const mintAuthority = asset?.token_info?.mint_authority || null;
    const freezeAuthority = asset?.token_info?.freeze_authority || null;

    // 3. Insert into tokens table (idempotent ON CONFLICT)
    const inserted = await db
      .insert(tokens)
      .values({
        mintAddress,
        name,
        symbol,
        decimals,
        totalSupply: supply,
        mintAuthority,
        freezeAuthority,
        firstSeenAt: new Date(detectedAt || Date.now()),
        lastSeenAt: new Date(),
      })
      .onConflictDoNothing({ target: tokens.mintAddress })
      .returning();

    const tokenRecord = inserted[0] || (
      await db.select().from(tokens).where(eq(tokens.mintAddress, mintAddress)).limit(1)
    )[0];

    if (!tokenRecord) {
      log.warn({ mintAddress }, "Failed to find or insert token");
      return;
    }

    // 4. Create initial default pool record if liquidity exists
    if (birdeyeOverview?.liquidity) {
      await db
        .insert(pools)
        .values({
          tokenId: tokenRecord.id,
          dex: "Raydium",
          poolAddress: `pool_${mintAddress}`,
          baseMint: mintAddress,
          quoteMint: "So11111111111111111111111111111111111111112",
          liquidityUsd: String(birdeyeOverview.liquidity),
        })
        .onConflictDoNothing();
    }

    // 5. Broadcast live WebSocket event
    await publishWsEvent<TokenDiscoveredEvent>({
      type: "TOKEN_DISCOVERED",
      timestamp: new Date().toISOString(),
      data: {
        mintAddress,
        symbol: tokenRecord.symbol,
        name: tokenRecord.name,
        creatorAddress: tokenRecord.creatorAddress,
        firstSeenAt: tokenRecord.firstSeenAt.toISOString(),
      },
    });

    // 6. Enqueue immediate risk assessment (Stage 1 Safety Gate)
    await enqueueRiskAnalysis({
      tokenId: tokenRecord.id,
      mintAddress: tokenRecord.mintAddress,
    });

    log.info({ mintAddress, symbol: tokenRecord.symbol, tokenId: tokenRecord.id }, "Token successfully indexed and queued for risk analysis");
    return { tokenId: tokenRecord.id, mintAddress };
  },
  {
    connection: redis,
    concurrency: 15,
  }
);

tokenDiscoveryWorker.on("failed", (job, err) => {
  log.error({ jobId: job?.id, err }, "Token discovery worker job failed");
});

log.info("Token Discovery Worker started and listening for jobs");
