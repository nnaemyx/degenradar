import axios, { AxiosInstance } from "axios";
import { env } from "@degenradar/config";
import { createLogger } from "@degenradar/logger";

const log = createLogger("jupiter-client");

export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export interface JupiterQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      feeAmount: string;
    };
    percent: number;
  }>;
}

export class JupiterClient {
  private http: AxiosInstance;

  constructor(baseUrl = env.JUPITER_API_URL) {
    this.http = axios.create({
      baseURL: baseUrl,
      timeout: 8000,
    });
  }

  /**
   * Check if a token has a valid routing quote to SOL/USDC
   * Used as a sellability & liquidity check
   */
  async getQuote(
    inputMint: string,
    outputMint = SOL_MINT,
    amountLamports = 1000000000 // 1 unit in decimals (approx)
  ): Promise<JupiterQuoteResponse | null> {
    try {
      const response = await this.http.get<JupiterQuoteResponse>("/quote", {
        params: {
          inputMint,
          outputMint,
          amount: amountLamports.toString(),
          slippageBps: 1000, // 10%
        },
      });
      return response.data;
    } catch (error) {
      log.debug({ inputMint, outputMint, error: (error as Error).message }, "Jupiter quote unavailable");
      return null;
    }
  }

  /**
   * Determine sellability score (0 - 100) based on route availability and price impact
   */
  async assessSellability(mintAddress: string): Promise<{ isSellable: boolean; score: number; impact: number }> {
    const quote = await this.getQuote(mintAddress, SOL_MINT);
    if (!quote || !quote.routePlan?.length) {
      return { isSellable: false, score: 0, impact: 100 };
    }

    const impact = Math.abs(parseFloat(quote.priceImpactPct || "0"));
    let score = 100;
    if (impact > 20) score = 20;
    else if (impact > 10) score = 50;
    else if (impact > 5) score = 80;

    return { isSellable: true, score, impact };
  }
}

export const jupiter = new JupiterClient();
