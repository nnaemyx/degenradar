import { solana, PublicKey } from "@degenradar/solana";
import { enqueueTokenDiscovery, publishWsEvent } from "@degenradar/redis";
import { createLogger } from "@degenradar/logger";
import type { TokenDiscoveredEvent } from "@degenradar/types";
import { env } from "@degenradar/config";

const log = createLogger("solana-live-scanner");

// Pump.fun Program ID
const PUMP_FUN_PROGRAM = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
// Raydium Liquidity Pool v4 Program ID
const RAYDIUM_V4_PROGRAM = new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");

/**
 * 24/7 Automated Blockchain Scanner for Solana
 * Automatically captures every newly created token without any manual human input.
 */
export function startSolanaLiveScanner() {
  log.info("Starting 24/7 Automated Solana Mainnet Token Scanner...");

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
            
            // 1. Instant real-time broadcast to dashboard in <100ms
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

            // 2. Queue for full enrichment, risk checks & scoring
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

  // Poll every 15 seconds as a redundancy safety net
  setInterval(pollNewListings, 15000);
}
