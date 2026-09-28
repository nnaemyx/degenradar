import { solana, PublicKey } from "@degenradar/solana";
import { enqueueTokenDiscovery, publishWsEvent } from "@degenradar/redis";
import { createLogger } from "@degenradar/logger";
import type { TokenDiscoveredEvent } from "@degenradar/types";
import { env } from "@degenradar/config";
import { birdeye } from "@degenradar/birdeye";
import { db, tokens } from "@degenradar/db";
import { desc, eq } from "drizzle-orm";

const log = createLogger("solana-live-scanner");

// Pump.fun Program ID
const PUMP_FUN_PROGRAM = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
// Raydium Liquidity Pool v4 Program ID
const RAYDIUM_V4_PROGRAM = new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");

/**
 * 24/7 Automated Blockchain & Momentum Scanner for Solana
 * 1. Automatically captures newly created tokens (Pump.fun WebSocket & Birdeye new listings).
 * 2. Scans trending / top-performing tokens that are already established and doing well.
 * 3. Periodically re-evaluates stored database tokens to detect sudden breakouts or momentum surges.
 */
export function startSolanaLiveScanner() {
  log.info("Starting 24/7 Automated Solana Scanner (New Launches + Trending Performers + DB Momentum)...");

  // 1. Listen live to Pump.fun token creations via Helius WebSocket
  try {
    solana.connection.onLogs(
      PUMP_FUN_PROGRAM,
      async (logInfo) => {
        try {
          const isCreate = logInfo.logs.some((l) => l.includes("Instruction: Create"));
          if (!isCreate) return;

          // Fetch the parsed transaction from Helius to extract the mint
          const tx = await solana.connection.getParsedTransaction(logInfo.signature, {
            maxSupportedTransactionVersion: 0,
          });

          if (!tx || !tx.meta) return;

          // Find the new token mint address in postTokenBalances
          const newMint = tx.meta.postTokenBalances?.find(
            (b) => b.mint && b.mint !== "So11111111111111111111111111111111111111112"
          )?.mint;

          if (newMint) {
            log.info({ mint: newMint, signature: logInfo.signature }, "⚡ AUTOMATICALLY DISCOVERED NEW PUMP.FUN TOKEN!");
            
            // Instant real-time broadcast to dashboard in <100ms
            await publishWsEvent<TokenDiscoveredEvent>({
              type: "TOKEN_DISCOVERED",
              timestamp: new Date().toISOString(),
              data: {
                mintAddress: newMint,
                symbol: "SCANNING",
                name: "New Solana Launch",
                creatorAddress: null,
                firstSeenAt: new Date().toISOString(),
              },
            });

            // Queue for full enrichment, risk checks & scoring
            await enqueueTokenDiscovery({
              mintAddress: newMint,
              detectedAt: new Date().toISOString(),
              source: "helius_ws",
            });
          }
        } catch (err) {
          // Ignore transient parse drops
        }
      },
      "confirmed"
    );
    log.info("Subscribed to Pump.fun Creation WebSocket stream");
  } catch (err) {
    log.error({ err }, "Failed to attach Pump.fun WebSocket listener");
  }

  // 2. Continuous Fallback Poller for newly listed tokens via Birdeye
  async function pollNewListings() {
    try {
      if (!env.BIRDEYE_API_KEY) return;
      const res = await fetch("https://public-api.birdeye.so/defi/v2/tokens/new_listing?limit=10", {
        headers: {
          "X-API-KEY": env.BIRDEYE_API_KEY,
          "x-chain": "solana",
        },
      });

      if (!res.ok) return;
      const json = (await res.json()) as any;
      const items = json?.data?.items || [];
      for (const item of items) {
        if (item.address) {
          await enqueueTokenDiscovery({
            mintAddress: item.address,
            detectedAt: new Date().toISOString(),
            source: "birdeye_new",
          });
        }
      }
    } catch (e) {
      // Periodic poller catch
    }
  }

  // 3. Trending & High-Performing Solana Tokens Poller (Birdeye)
  async function pollTrendingTokens() {
    try {
      if (!env.BIRDEYE_API_KEY) return;
      const trending = await birdeye.getTrendingTokens(20);
      if (!trending || trending.length === 0) return;

      log.info({ count: trending.length }, "Scanned live trending & top-performing Solana tokens");

      for (const t of trending) {
        if (!t.address) continue;

        // Instant UI broadcast so dashboard shows real symbol & price immediately
        await publishWsEvent<TokenDiscoveredEvent>({
          type: "TOKEN_DISCOVERED",
          timestamp: new Date().toISOString(),
          data: {
            mintAddress: t.address,
            symbol: t.symbol || "TRENDING",
            name: t.name || "Trending Token",
            creatorAddress: null,
            firstSeenAt: new Date().toISOString(),
          },
        });

        // Queue for risk assessment & live scoring
        await enqueueTokenDiscovery({
          mintAddress: t.address,
          detectedAt: new Date().toISOString(),
          source: "birdeye_trending",
        });
      }
    } catch (e) {
      log.debug({ err: (e as Error).message }, "Trending poller iteration notice");
    }
  }

  // 4. Stored Tokens Momentum Monitor (Continually re-evaluates database tokens)
  async function pollStoredTokensForMomentum() {
    try {
      const stored = await db
        .select({ id: tokens.id, mintAddress: tokens.mintAddress, symbol: tokens.symbol })
        .from(tokens)
        .where(eq(tokens.isActive, true))
        .orderBy(desc(tokens.lastSeenAt))
        .limit(25);

      if (stored.length === 0) return;

      log.debug({ count: stored.length }, "Re-checking stored tokens for breakout momentum");

      for (const token of stored) {
        await enqueueTokenDiscovery({
          mintAddress: token.mintAddress,
          detectedAt: new Date().toISOString(),
          source: "db_momentum_recheck",
        });
      }
    } catch (e) {
      log.debug({ err: (e as Error).message }, "DB momentum monitor notice");
    }
  }

  // Run initial polls immediately on startup
  pollNewListings();
  pollTrendingTokens();

  // Polling intervals:
  // - Newly listed: every 15s
  // - Trending / top performers: every 45s
  // - Stored tokens momentum check: every 60s
  setInterval(pollNewListings, 15000);
  setInterval(pollTrendingTokens, 45000);
  setInterval(pollStoredTokensForMomentum, 60000);
}
