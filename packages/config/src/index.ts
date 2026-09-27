import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";
import { z } from "zod";

// Load root .env or fallback
dotenvConfig({ path: resolve(process.cwd(), ".env") });
dotenvConfig({ path: resolve(process.cwd(), "../../.env") });

const configSchema = z.object({
  DATABASE_URL: z.string().default("postgresql://degenradar:degenradar@localhost:5432/degenradar"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  HELIUS_API_KEY: z.string().default(""),
  HELIUS_RPC_URL: z.string().default("https://mainnet.helius-rpc.com/?api-key="),
  HELIUS_WS_URL: z.string().default("wss://mainnet.helius-rpc.com/?api-key="),
  BIRDEYE_API_KEY: z.string().default(""),
  JUPITER_API_URL: z.string().default("https://quote-api.jup.ag/v6"),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  API_PORT: z.coerce.number().default(3001),
  API_HOST: z.string().default("0.0.0.0"),
  API_SECRET: z.string().default("degenradar_secret"),
  NEXT_PUBLIC_API_URL: z.string().default("http://localhost:3001"),
  NEXT_PUBLIC_WS_URL: z.string().default("ws://localhost:3001"),
  MIN_LIQUIDITY_USD: z.coerce.number().default(5000),
  MIN_MARKET_CAP_USD: z.coerce.number().default(10000),
  MAX_MARKET_CAP_USD: z.coerce.number().default(10000000),
  OPPORTUNITY_ALERT_THRESHOLD: z.coerce.number().default(75),
  RISK_BLOCK_THRESHOLD: z.coerce.number().default(80),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

export type Config = z.infer<typeof configSchema>;

export const env = configSchema.parse({
  ...process.env,
  HELIUS_RPC_URL: process.env.HELIUS_RPC_URL || (process.env.HELIUS_API_KEY ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}` : undefined),
  HELIUS_WS_URL: process.env.HELIUS_WS_URL || (process.env.HELIUS_API_KEY ? `wss://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}` : undefined),
});
