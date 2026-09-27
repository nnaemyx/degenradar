import axios, { AxiosInstance } from "axios";
import { env } from "@degenradar/config";
import { createLogger } from "@degenradar/logger";

const log = createLogger("helius-client");

export interface HeliusAsset {
  id: string;
  content?: {
    metadata?: {
      name?: string;
      symbol?: string;
      description?: string;
    };
  };
  token_info?: {
    supply?: number;
    decimals?: number;
    token_program?: string;
    mint_authority?: string | null;
    freeze_authority?: string | null;
  };
  authorities?: Array<{
    address: string;
    scopes: string[];
  }>;
}

export interface HeliusParsedTransaction {
  description: string;
  type: string;
  source: string;
  fee: number;
  feePayer: string;
  signature: string;
  slot: number;
  timestamp: number;
  tokenTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    fromTokenAccount: string;
    toTokenAccount: string;
    tokenAmount: number;
    mint: string;
  }>;
  nativeTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }>;
}

export class HeliusClient {
  private apiKey: string;
  private http: AxiosInstance;
  private rpcUrl: string;

  constructor(apiKey = env.HELIUS_API_KEY) {
    this.apiKey = apiKey;
    this.rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${this.apiKey}`;
    this.http = axios.create({
      baseURL: "https://api.helius.xyz/v0",
      timeout: 10000,
      params: { "api-key": this.apiKey },
    });
  }

  /**
   * Fetch Digital Asset Standard (DAS) metadata for a token mint
   */
  async getAsset(mintAddress: string): Promise<HeliusAsset | null> {
    try {
      const response = await axios.post(
        this.rpcUrl,
        {
          jsonrpc: "2.0",
          id: "degenradar-get-asset",
          method: "getAsset",
          params: { id: mintAddress },
        },
        { timeout: 10000 }
      );

      if (response.data.error) {
        log.warn({ mintAddress, error: response.data.error }, "Helius getAsset error");
        return null;
      }

      return response.data.result as HeliusAsset;
    } catch (error) {
      log.error({ mintAddress, error }, "Failed to fetch asset from Helius");
      return null;
    }
  }

  /**
   * Parse raw transaction signatures into enriched transaction representations
   */
  async parseTransactions(signatures: string[]): Promise<HeliusParsedTransaction[]> {
    if (!signatures.length) return [];
    try {
      const response = await this.http.post<HeliusParsedTransaction[]>("/transactions", {
        transactions: signatures,
      });
      return response.data || [];
    } catch (error) {
      log.error({ count: signatures.length, error }, "Failed to parse transactions via Helius");
      return [];
    }
  }
}

export const helius = new HeliusClient();
