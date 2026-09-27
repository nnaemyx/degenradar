import { Connection, PublicKey } from "@solana/web3.js";
import { env } from "@degenradar/config";
import { createLogger } from "@degenradar/logger";

const log = createLogger("solana-client");

export class SolanaService {
  public connection: Connection;

  constructor() {
    this.connection = new Connection(env.HELIUS_RPC_URL, {
      wsEndpoint: env.HELIUS_WS_URL,
      commitment: "confirmed",
    });
  }

  /**
   * Fetch token supply and decimals directly from chain
   */
  async getTokenSupply(mintAddress: string) {
    try {
      const pubkey = new PublicKey(mintAddress);
      const res = await this.connection.getTokenSupply(pubkey);
      return res.value;
    } catch (error) {
      log.debug({ mintAddress, error: (error as Error).message }, "Error fetching token supply");
      return null;
    }
  }

  /**
   * Fetch largest token holders directly on-chain
   */
  async getTokenLargestAccounts(mintAddress: string) {
    try {
      const pubkey = new PublicKey(mintAddress);
      const res = await this.connection.getTokenLargestAccounts(pubkey);
      return res.value;
    } catch (error) {
      log.debug({ mintAddress, error: (error as Error).message }, "Error fetching largest token accounts");
      return [];
    }
  }

  /**
   * Check account info
   */
  async getAccountInfo(address: string) {
    try {
      const pubkey = new PublicKey(address);
      return await this.connection.getAccountInfo(pubkey);
    } catch (error) {
      log.debug({ address, error: (error as Error).message }, "Error fetching account info");
      return null;
    }
  }

  /**
   * Program Subscribe helper for listening to DEX events (Raydium, Pump.fun)
   */
  onProgramLogs(programId: string, callback: (logs: { signature: string; logs: string[] }) => void) {
    try {
      const pubkey = new PublicKey(programId);
      return this.connection.onLogs(
        pubkey,
        (logs) => {
          callback({
            signature: logs.signature,
            logs: logs.logs,
          });
        },
        "confirmed"
      );
    } catch (error) {
      log.error({ programId, error }, "Failed to subscribe to program logs");
      return -1;
    }
  }
}

export const solana = new SolanaService();
