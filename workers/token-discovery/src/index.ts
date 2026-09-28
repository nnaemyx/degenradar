import { Worker } from "bullmq";
import {
  redis,
  defaultWorkerOptions,
  enqueueRiskAnalysis,
  publishWsEvent,
} from "@degenradar/redis";
import { db, tokens, pools } from "@degenradar/db";
import { helius } from "@degenradar/helius";
import { birdeye } from "@degenradar/birdeye";
import { createLogger } from "@degenradar/logger";
import { eq } from "drizzle-orm";
import type { TokenDiscoveryJob, TokenDiscoveredEvent } from "@degenradar/types";
import { startSolanaLiveScanner } from "./scanner";

const log = createLogger("worker-token-discovery");

export const tokenDiscoveryWorker = new Worker<TokenDiscoveryJob>(
  "token-discovery",
  async (job) => {
    const { mintAddress, detectedAt, source } = job.data;
    log.info({ mintAddress, source }, "Processing discovered token");

    // 1. Check if token already exists in DB
    const existing = await db
      .select({ id: tokens.id, symbol: tokens.symbol, name: tokens.name })
      .from(tokens)
      .where(eq(tokens.mintAddress, mintAddress))
      .limit(1);

    if (existing.length > 0) {
      log.info(
        { mintAddress, symbol: existing[0].symbol, tokenId: existing[0].id },
        "Existing stored token re-analyzed for live momentum & performance"
      );

      // Refresh last seen timestamp
      await db
        .update(tokens)
        .set({ lastSeenAt: new Date() })
        .where(eq(tokens.id, existing[0].id));

      // Re-trigger live safety gate and momentum recalculations
      await enqueueRiskAnalysis({
        tokenId: existing[0].id,
        mintAddress,
      });

      return { tokenId: existing[0].id, reevaluated: true };
    }

    // 2. Fetch metadata (DexScreener -> Birdeye -> Helius DAS only if needed)
    let name = "New Token";
    let symbol = "TOKEN";
    let decimals = 9;
    let supply: string | null = null;
    let mintAuthority: string | null = null;
    let freezeAuthority: string | null = null;

    // A. Check DexScreener first (100% FREE, 0 DAS credits used)
    try {
      const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`);
      if (dexRes.ok) {
        const dexData = (await dexRes.json()) as any;
        const pair = dexData?.pairs?.[0];
        if (pair?.baseToken?.symbol) {
          symbol = pair.baseToken.symbol;
          name = pair.baseToken.name || symbol;
        }
      }
    } catch (e) {}

    // B. Check Birdeye
    const birdeyeOverview = await birdeye.getTokenOverview(mintAddress);
    if (birdeyeOverview?.name && name === "New Token") name = birdeyeOverview.name;
    if (birdeyeOverview?.symbol && symbol === "TOKEN") symbol = birdeyeOverview.symbol;
    decimals = birdeyeOverview?.decimals ?? decimals;

    // C. Check Pump.fun direct fallback
    if (symbol === "TOKEN") {
      try {
        const pRes = await fetch(`https://frontend-api-v2.pump.fun/coins/${mintAddress}`);
        if (pRes.ok) {
          const pData = (await pRes.json()) as any;
          if (pData?.symbol) symbol = pData.symbol;
          if (pData?.name) name = pData.name;
        }
      } catch (e) {}
    }

    // D. ONLY query Helius DAS if metadata is still missing (Saves >90% of monthly DAS credits!)
    if (symbol === "TOKEN" || name === "New Token") {
      const asset = await helius.getAsset(mintAddress);
      if (asset?.content?.metadata?.name) name = asset.content.metadata.name;
      if (asset?.content?.metadata?.symbol) symbol = asset.content.metadata.symbol;
      decimals = asset?.token_info?.decimals ?? decimals;
      supply = asset?.token_info?.supply ? String(asset.token_info.supply) : null;
      mintAuthority = asset?.token_info?.mint_authority || null;
      freezeAuthority = asset?.token_info?.freeze_authority || null;
    }

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
        priceUsd: birdeyeOverview?.price || 0,
        marketCap: birdeyeOverview?.mc || 0,
        liquidityUsd: birdeyeOverview?.liquidity || 0,
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
    ...defaultWorkerOptions,
    concurrency: 15,
  }
);

tokenDiscoveryWorker.on("failed", (job, err) => {
  log.error({ jobId: job?.id, err }, "Token discovery worker job failed");
});

log.info("Token Discovery Worker started and listening for jobs");

// Launch the 24/7 Automated Blockchain Scanner
startSolanaLiveScanner();
