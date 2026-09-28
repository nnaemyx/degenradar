import axios, { AxiosInstance } from "axios";
import { env } from "@degenradar/config";
import { createLogger } from "@degenradar/logger";

const log = createLogger("birdeye-client");

export interface BirdeyeTokenOverview {
  address: string;
  decimals: number;
  symbol: string;
  name: string;
  price: number;
  liquidity: number;
  v24hUSD: number;
  v24hChangePercent: number;
  mc: number;
  holder: number;
  v5mUSD?: number;
  v1hUSD?: number;
}

export interface BirdeyeTradeItem {
  txHash: string;
  blockUnixTime: number;
  source: string;
  side: "buy" | "sell";
  from: {
    address: string;
    amount: number;
    symbol: string;
  };
  to: {
    address: string;
    amount: number;
    symbol: string;
  };
  owner: string;
  volumeUSD: number;
}

export interface BirdeyeHolder {
  owner: string;
  amount: number;
  ui_amount: number;
  decimals: number;
  pct: number;
}

export interface BirdeyeTrendingToken {
  address: string;
  decimals: number;
  symbol: string;
  name: string;
  price: number;
  liquidity: number;
  marketcap: number;
  fdv: number;
  rank: number;
  volume24hUSD: number;
  volume24hChangePercent: number;
  price24hChangePercent: number;
}

export class BirdeyeClient {
  private http: AxiosInstance;

  constructor(apiKey = env.BIRDEYE_API_KEY) {
    this.http = axios.create({
      baseURL: "https://public-api.birdeye.so",
      timeout: 10000,
      headers: {
        "X-API-KEY": apiKey,
        "x-chain": "solana",
      },
    });
  }

  /**
   * Get token market overview (price, liquidity, volume, holders)
   */
  async getTokenOverview(mintAddress: string): Promise<BirdeyeTokenOverview | null> {
    try {
      const response = await this.http.get("/defi/token_overview", {
        params: { address: mintAddress },
      });
      if (response.data?.success && response.data?.data) {
        return response.data.data as BirdeyeTokenOverview;
      }
      return null;
    } catch (error) {
      log.debug({ mintAddress, error: (error as Error).message }, "Birdeye getTokenOverview request failed");
      return null;
    }
  }

  /**
   * Get recent trades for a token
   */
  async getTokenTrades(mintAddress: string, limit = 50): Promise<BirdeyeTradeItem[]> {
    try {
      const response = await this.http.get("/defi/txs/token", {
        params: { address: mintAddress, limit, tx_type: "swap" },
      });
      if (response.data?.success && response.data?.data?.items) {
        return response.data.data.items as BirdeyeTradeItem[];
      }
      return [];
    } catch (error) {
      log.debug({ mintAddress, error: (error as Error).message }, "Birdeye getTokenTrades request failed");
      return [];
    }
  }

  /**
   * Get token holder distribution
   */
  async getTokenHolders(mintAddress: string, limit = 20): Promise<BirdeyeHolder[]> {
    try {
      const response = await this.http.get("/defi/v3/token/holder", {
        params: { address: mintAddress, limit },
      });
      if (response.data?.success && response.data?.data?.items) {
        return response.data.data.items as BirdeyeHolder[];
      }
      return [];
    } catch (error) {
      log.debug({ mintAddress, error: (error as Error).message }, "Birdeye getTokenHolders request failed");
      return [];
    }
  }

  /**
   * Get trending Solana tokens sorted by rank
   */
  async getTrendingTokens(limit = 20): Promise<BirdeyeTrendingToken[]> {
    try {
      const response = await this.http.get("/defi/token_trending", {
        params: { sort_by: "rank", sort_type: "asc", offset: 0, limit },
      });
      if (response.data?.success && response.data?.data?.tokens) {
        return response.data.data.tokens as BirdeyeTrendingToken[];
      }
      return [];
    } catch (error) {
      log.debug({ error: (error as Error).message }, "Birdeye getTrendingTokens request failed");
      return [];
    }
  }

  /**
   * Get top gainers on Solana — tokens doing well right now sorted by 24h volume.
   * This is the most reliable signal for "coins performing well" regardless of age.
   */
  async getTopGainers(limit = 20, minLiquidityUsd = 5000): Promise<BirdeyeTrendingToken[]> {
    try {
      const response = await this.http.get("/defi/v2/tokens/list", {
        params: {
          sort_by: "v24hUSD",
          sort_type: "desc",
          offset: 0,
          limit,
          min_liquidity: minLiquidityUsd,
        },
      });
      if (response.data?.success && response.data?.data?.tokens) {
        return response.data.data.tokens as BirdeyeTrendingToken[];
      }
      return [];
    } catch (error) {
      log.debug({ error: (error as Error).message }, "Birdeye getTopGainers request failed");
      return [];
    }
  }

  /**
   * Get tokens sorted by 24h price change — catches breakout movers early
   */
  async getTopPriceMovers(limit = 20, minLiquidityUsd = 5000): Promise<BirdeyeTrendingToken[]> {
    try {
      const response = await this.http.get("/defi/v2/tokens/list", {
        params: {
          sort_by: "priceChange24hPercent",
          sort_type: "desc",
          offset: 0,
          limit,
          min_liquidity: minLiquidityUsd,
        },
      });
      if (response.data?.success && response.data?.data?.tokens) {
        return response.data.data.tokens as BirdeyeTrendingToken[];
      }
      return [];
    } catch (error) {
      log.debug({ error: (error as Error).message }, "Birdeye getTopPriceMovers request failed");
      return [];
    }
  }
}

export const birdeye = new BirdeyeClient();
