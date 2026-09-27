import {
  pgTable,
  uuid,
  varchar,
  integer,
  numeric,
  boolean,
  bigint,
  bigserial,
  timestamp,
  jsonb,
  text,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import type { RiskFlags } from "@degenradar/types";

// ─── 1. Tokens ─────────────────────────────────────────────────────────────
export const tokens = pgTable(
  "tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    mintAddress: varchar("mint_address", { length: 64 }).notNull(),
    symbol: varchar("symbol", { length: 32 }),
    name: varchar("name", { length: 128 }),
    decimals: integer("decimals").default(9).notNull(),
    totalSupply: numeric("total_supply", { precision: 36, scale: 0 }),
    creatorAddress: varchar("creator_address", { length: 64 }),
    mintAuthority: varchar("mint_authority", { length: 64 }),
    freezeAuthority: varchar("freeze_authority", { length: 64 }),
    isVerified: boolean("is_verified").default(false).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdSlot: bigint("created_slot", { mode: "number" }),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("tokens_mint_address_idx").on(table.mintAddress),
    index("tokens_symbol_idx").on(table.symbol),
    index("tokens_created_at_idx").on(table.createdAt),
    index("tokens_is_active_idx").on(table.isActive),
  ]
);

// ─── 2. Liquidity Pools ────────────────────────────────────────────────────
export const pools = pgTable(
  "pools",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tokenId: uuid("token_id")
      .notNull()
      .references(() => tokens.id, { onDelete: "cascade" }),
    dex: varchar("dex", { length: 32 }).notNull(), // Raydium, Orca, Meteora, Pump.fun
    poolAddress: varchar("pool_address", { length: 64 }).notNull(),
    baseMint: varchar("base_mint", { length: 64 }).notNull(),
    quoteMint: varchar("quote_mint", { length: 64 }).notNull(),
    liquidityUsd: numeric("liquidity_usd", { precision: 20, scale: 4 }),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("pools_address_idx").on(table.poolAddress),
    index("pools_token_id_idx").on(table.tokenId),
    index("pools_dex_idx").on(table.dex),
  ]
);

// ─── 3. Token Snapshots (Time-series) ──────────────────────────────────────
export const tokenSnapshots = pgTable(
  "token_snapshots",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    tokenId: uuid("token_id")
      .notNull()
      .references(() => tokens.id, { onDelete: "cascade" }),
    timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
    slot: bigint("slot", { mode: "number" }),
    priceUsd: numeric("price_usd", { precision: 24, scale: 12 }),
    marketCap: numeric("market_cap", { precision: 20, scale: 2 }),
    fdv: numeric("fdv", { precision: 20, scale: 2 }),
    liquidityUsd: numeric("liquidity_usd", { precision: 20, scale: 2 }),
    volume1m: numeric("volume_1m", { precision: 20, scale: 2 }).default("0"),
    volume5m: numeric("volume_5m", { precision: 20, scale: 2 }).default("0"),
    volume15m: numeric("volume_15m", { precision: 20, scale: 2 }).default("0"),
    volume1h: numeric("volume_1h", { precision: 20, scale: 2 }).default("0"),
    buys1m: integer("buys_1m").default(0),
    sells1m: integer("sells_1m").default(0),
    uniqueBuyers1m: integer("unique_buyers_1m").default(0),
    uniqueSellers1m: integer("unique_sellers_1m").default(0),
    holders: integer("holders").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("token_snapshots_token_time_idx").on(table.tokenId, table.timestamp),
    index("token_snapshots_timestamp_idx").on(table.timestamp),
  ]
);

// ─── 4. Trades ─────────────────────────────────────────────────────────────
export const trades = pgTable(
  "trades",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    signature: varchar("signature", { length: 128 }).notNull(),
    tokenId: uuid("token_id")
      .notNull()
      .references(() => tokens.id, { onDelete: "cascade" }),
    poolId: uuid("pool_id").references(() => pools.id, { onDelete: "set null" }),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    slot: bigint("slot", { mode: "number" }),
    traderAddress: varchar("trader_address", { length: 64 }).notNull(),
    side: varchar("side", { length: 8 }).notNull(), // BUY / SELL
    tokenAmount: numeric("token_amount", { precision: 36, scale: 9 }).notNull(),
    quoteAmount: numeric("quote_amount", { precision: 36, scale: 9 }).notNull(),
    priceUsd: numeric("price_usd", { precision: 24, scale: 12 }),
    usdValue: numeric("usd_value", { precision: 20, scale: 4 }),
    dex: varchar("dex", { length: 32 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("trades_signature_idx").on(table.signature),
    index("trades_token_time_idx").on(table.tokenId, table.timestamp),
    index("trades_trader_time_idx").on(table.traderAddress, table.timestamp),
  ]
);

// ─── 5. Holders ────────────────────────────────────────────────────────────
export const holders = pgTable(
  "holders",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    tokenId: uuid("token_id")
      .notNull()
      .references(() => tokens.id, { onDelete: "cascade" }),
    walletAddress: varchar("wallet_address", { length: 64 }).notNull(),
    balance: numeric("balance", { precision: 36, scale: 9 }).notNull(),
    percentage: numeric("percentage", { precision: 6, scale: 3 }),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    isCreator: boolean("is_creator").default(false).notNull(),
    isLp: boolean("is_lp").default(false).notNull(),
    isExchange: boolean("is_exchange").default(false).notNull(),
    isKnownSmartMoney: boolean("is_known_smart_money").default(false).notNull(),
  },
  (table) => [
    uniqueIndex("holders_token_wallet_idx").on(table.tokenId, table.walletAddress),
    index("holders_wallet_idx").on(table.walletAddress),
    index("holders_percentage_idx").on(table.percentage),
  ]
);

// ─── 6. Holder Snapshots ───────────────────────────────────────────────────
export const holderSnapshots = pgTable(
  "holder_snapshots",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    tokenId: uuid("token_id")
      .notNull()
      .references(() => tokens.id, { onDelete: "cascade" }),
    timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
    holderCount: integer("holder_count").notNull(),
    top1Pct: numeric("top_1_pct", { precision: 6, scale: 3 }),
    top5Pct: numeric("top_5_pct", { precision: 6, scale: 3 }),
    top10Pct: numeric("top_10_pct", { precision: 6, scale: 3 }),
    top20Pct: numeric("top_20_pct", { precision: 6, scale: 3 }),
    creatorPct: numeric("creator_pct", { precision: 6, scale: 3 }),
    insiderPct: numeric("insider_pct", { precision: 6, scale: 3 }),
  },
  (table) => [
    index("holder_snapshots_token_time_idx").on(table.tokenId, table.timestamp),
  ]
);

// ─── 7. Wallets ────────────────────────────────────────────────────────────
export const wallets = pgTable(
  "wallets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    address: varchar("address", { length: 64 }).notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
    totalTrades: integer("total_trades").default(0).notNull(),
    winningTrades: integer("winning_trades").default(0).notNull(),
    losingTrades: integer("losing_trades").default(0).notNull(),
    realizedPnl: numeric("realized_pnl", { precision: 20, scale: 4 }).default("0").notNull(),
    unrealizedPnl: numeric("unrealized_pnl", { precision: 20, scale: 4 }).default("0").notNull(),
    avgReturnPct: numeric("avg_return_pct", { precision: 10, scale: 2 }),
    earlyEntries: integer("early_entries").default(0).notNull(),
    successfulEarlyEntries: integer("successful_early_entries").default(0).notNull(),
    smartMoneyScore: numeric("smart_money_score", { precision: 5, scale: 2 }),
    classification: varchar("classification", { length: 32 }).default("UNKNOWN").notNull(),
  },
  (table) => [
    uniqueIndex("wallets_address_idx").on(table.address),
    index("wallets_smart_money_idx").on(table.smartMoneyScore),
    index("wallets_classification_idx").on(table.classification),
  ]
);

// ─── 8. Wallet Token Positions ─────────────────────────────────────────────
export const walletTokenPositions = pgTable(
  "wallet_token_positions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => wallets.id, { onDelete: "cascade" }),
    tokenId: uuid("token_id")
      .notNull()
      .references(() => tokens.id, { onDelete: "cascade" }),
    firstBuyAt: timestamp("first_buy_at", { withTimezone: true }),
    lastBuyAt: timestamp("last_buy_at", { withTimezone: true }),
    totalBoughtUsd: numeric("total_bought_usd", { precision: 20, scale: 4 }).default("0").notNull(),
    totalSoldUsd: numeric("total_sold_usd", { precision: 20, scale: 4 }).default("0").notNull(),
    currentBalance: numeric("current_balance", { precision: 36, scale: 9 }).default("0").notNull(),
    realizedPnl: numeric("realized_pnl", { precision: 20, scale: 4 }).default("0").notNull(),
    unrealizedPnl: numeric("unrealized_pnl", { precision: 20, scale: 4 }).default("0").notNull(),
    maxRoiPct: numeric("max_roi_pct", { precision: 10, scale: 2 }),
  },
  (table) => [
    uniqueIndex("wtp_wallet_token_idx").on(table.walletId, table.tokenId),
    index("wtp_token_idx").on(table.tokenId),
  ]
);

// ─── 9. Wallet Events ──────────────────────────────────────────────────────
export const walletEvents = pgTable(
  "wallet_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => wallets.id, { onDelete: "cascade" }),
    tokenId: uuid("token_id")
      .notNull()
      .references(() => tokens.id, { onDelete: "cascade" }),
    timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
    eventType: varchar("event_type", { length: 32 }).notNull(), // BUY, SELL, TRANSFER, LP_ADD, LP_REMOVE
    amount: numeric("amount", { precision: 36, scale: 9 }),
    usdValue: numeric("usd_value", { precision: 20, scale: 4 }),
    signature: varchar("signature", { length: 128 }),
  },
  (table) => [
    index("wallet_events_wallet_idx").on(table.walletId, table.timestamp),
    index("wallet_events_token_idx").on(table.tokenId, table.timestamp),
  ]
);

// ─── 10. Risk Assessments ──────────────────────────────────────────────────
export const riskAssessments = pgTable(
  "risk_assessments",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    tokenId: uuid("token_id")
      .notNull()
      .references(() => tokens.id, { onDelete: "cascade" }),
    timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
    mintAuthorityEnabled: boolean("mint_authority_enabled").notNull(),
    freezeAuthorityEnabled: boolean("freeze_authority_enabled").notNull(),
    top10HolderPct: numeric("top10_holder_pct", { precision: 6, scale: 3 }),
    creatorPct: numeric("creator_pct", { precision: 6, scale: 3 }),
    insiderPct: numeric("insider_pct", { precision: 6, scale: 3 }),
    liquidityUsd: numeric("liquidity_usd", { precision: 20, scale: 2 }),
    sellabilityScore: numeric("sellability_score", { precision: 5, scale: 2 }),
    walletClusterScore: numeric("wallet_cluster_score", { precision: 5, scale: 2 }),
    creatorRiskScore: numeric("creator_risk_score", { precision: 5, scale: 2 }),
    overallRiskScore: numeric("overall_risk_score", { precision: 5, scale: 2 }).notNull(),
    riskFlags: jsonb("risk_flags").$type<RiskFlags>().notNull(),
  },
  (table) => [
    index("risk_assessments_token_idx").on(table.tokenId, table.timestamp),
  ]
);

// ─── 11. Token Features ────────────────────────────────────────────────────
export const tokenFeatures = pgTable(
  "token_features",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    tokenId: uuid("token_id")
      .notNull()
      .references(() => tokens.id, { onDelete: "cascade" }),
    timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
    volumeVelocity: numeric("volume_velocity", { precision: 12, scale: 4 }),
    volumeAcceleration: numeric("volume_acceleration", { precision: 12, scale: 4 }),
    holderVelocity: numeric("holder_velocity", { precision: 12, scale: 4 }),
    holderAcceleration: numeric("holder_acceleration", { precision: 12, scale: 4 }),
    priceVelocity: numeric("price_velocity", { precision: 12, scale: 4 }),
    priceAcceleration: numeric("price_acceleration", { precision: 12, scale: 4 }),
    buyPressure: numeric("buy_pressure", { precision: 5, scale: 4 }), // 0.0000 - 1.0000
    liquidityChange: numeric("liquidity_change", { precision: 12, scale: 4 }),
    uniqueBuyerVelocity: numeric("unique_buyer_velocity", { precision: 12, scale: 4 }),
    smartMoneyScore: numeric("smart_money_score", { precision: 5, scale: 2 }),
    walletConcentration: numeric("wallet_concentration", { precision: 5, scale: 2 }),
    socialVelocity: numeric("social_velocity", { precision: 12, scale: 4 }),
    socialAcceleration: numeric("social_acceleration", { precision: 12, scale: 4 }),
  },
  (table) => [
    index("token_features_token_time_idx").on(table.tokenId, table.timestamp),
  ]
);

// ─── 12. Token Scores ──────────────────────────────────────────────────────
export const tokenScores = pgTable(
  "token_scores",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    tokenId: uuid("token_id")
      .notNull()
      .references(() => tokens.id, { onDelete: "cascade" }),
    timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
    opportunityScore: numeric("opportunity_score", { precision: 5, scale: 2 }).notNull(),
    riskScore: numeric("risk_score", { precision: 5, scale: 2 }).notNull(),
    momentumScore: numeric("momentum_score", { precision: 5, scale: 2 }),
    smartMoneyScore: numeric("smart_money_score", { precision: 5, scale: 2 }),
    liquidityScore: numeric("liquidity_score", { precision: 5, scale: 2 }),
    holderScore: numeric("holder_score", { precision: 5, scale: 2 }),
    socialScore: numeric("social_score", { precision: 5, scale: 2 }),
    modelVersion: varchar("model_version", { length: 32 }).notNull(), // rules-v1, xgb-v1, etc.
  },
  (table) => [
    index("token_scores_token_time_idx").on(table.tokenId, table.timestamp),
    index("token_scores_opportunity_idx").on(table.opportunityScore),
  ]
);

// ─── 13. Alerts ────────────────────────────────────────────────────────────
export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tokenId: uuid("token_id")
      .notNull()
      .references(() => tokens.id, { onDelete: "cascade" }),
    alertType: varchar("alert_type", { length: 48 }).notNull(),
    score: numeric("score", { precision: 5, scale: 2 }),
    triggeredAt: timestamp("triggered_at", { withTimezone: true }).defaultNow().notNull(),
    payload: jsonb("payload").default({}).notNull(),
    telegramSent: boolean("telegram_sent").default(false).notNull(),
    discordSent: boolean("discord_sent").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("alerts_token_idx").on(table.tokenId),
    index("alerts_triggered_at_idx").on(table.triggeredAt),
  ]
);

// ─── 14. Outcomes (for Backtesting & ML Supervised Training) ────────────────
export const tokenOutcomes = pgTable(
  "token_outcomes",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    tokenId: uuid("token_id")
      .notNull()
      .references(() => tokens.id, { onDelete: "cascade" }),
    signalId: uuid("signal_id"),
    signalTimestamp: timestamp("signal_timestamp", { withTimezone: true }).notNull(),
    priceAtSignal: numeric("price_at_signal", { precision: 24, scale: 12 }).notNull(),
    price5m: numeric("price_5m", { precision: 24, scale: 12 }),
    price15m: numeric("price_15m", { precision: 24, scale: 12 }),
    price30m: numeric("price_30m", { precision: 24, scale: 12 }),
    price1h: numeric("price_1h", { precision: 24, scale: 12 }),
    price6h: numeric("price_6h", { precision: 24, scale: 12 }),
    price24h: numeric("price_24h", { precision: 24, scale: 12 }),
    maxGain1h: numeric("max_gain_1h", { precision: 10, scale: 4 }),
    maxDrawdown1h: numeric("max_drawdown_1h", { precision: 10, scale: 4 }),
    maxGain24h: numeric("max_gain_24h", { precision: 10, scale: 4 }),
    maxDrawdown24h: numeric("max_drawdown_24h", { precision: 10, scale: 4 }),
  },
  (table) => [
    index("token_outcomes_token_idx").on(table.tokenId),
    index("token_outcomes_signal_idx").on(table.signalTimestamp),
  ]
);

// ─── 15. Narratives (Culture Radar) ─────────────────────────────────────────
export const narratives = pgTable(
  "narratives",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 128 }).notNull(),
    slug: varchar("slug", { length: 128 }).notNull(),
    description: text("description"),
    firstDetectedAt: timestamp("first_detected_at", { withTimezone: true }).defaultNow().notNull(),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }).defaultNow().notNull(),
    status: varchar("status", { length: 32 }).default("EMERGING").notNull(),
    loreScore: numeric("lore_score", { precision: 5, scale: 2 }).default("0").notNull(),
    viralScore: numeric("viral_score", { precision: 5, scale: 2 }).default("0").notNull(),
    spreadScore: numeric("spread_score", { precision: 5, scale: 2 }).default("0").notNull(),
    cryptoAdoptionScore: numeric("crypto_adoption_score", { precision: 5, scale: 2 }).default("0").notNull(),
  },
  (table) => [
    uniqueIndex("narratives_slug_idx").on(table.slug),
    index("narratives_lore_score_idx").on(table.loreScore),
  ]
);

// ─── 16. Narrative Mentions ────────────────────────────────────────────────
export const narrativeMentions = pgTable(
  "narrative_mentions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    narrativeId: uuid("narrative_id")
      .notNull()
      .references(() => narratives.id, { onDelete: "cascade" }),
    platform: varchar("platform", { length: 32 }).notNull(), // TIKTOK, X, REDDIT, YOUTUBE, TELEGRAM
    contentId: varchar("content_id", { length: 128 }).notNull(),
    authorId: varchar("author_id", { length: 128 }),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    views: bigint("views", { mode: "number" }).default(0),
    likes: bigint("likes", { mode: "number" }).default(0),
    comments: bigint("comments", { mode: "number" }).default(0),
    shares: bigint("shares", { mode: "number" }).default(0),
    engagementRate: numeric("engagement_rate", { precision: 8, scale: 4 }),
  },
  (table) => [
    index("narrative_mentions_narrative_idx").on(table.narrativeId, table.timestamp),
    index("narrative_mentions_platform_idx").on(table.platform),
  ]
);

// ─── 17. Narrative Snapshots ───────────────────────────────────────────────
export const narrativeSnapshots = pgTable(
  "narrative_snapshots",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    narrativeId: uuid("narrative_id")
      .notNull()
      .references(() => narratives.id, { onDelete: "cascade" }),
    timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
    mentions: integer("mentions").default(0).notNull(),
    views: bigint("views", { mode: "number" }).default(0),
    likes: bigint("likes", { mode: "number" }).default(0),
    shares: bigint("shares", { mode: "number" }).default(0),
    newPosts: integer("new_posts").default(0),
    velocity: numeric("velocity", { precision: 12, scale: 4 }),
    acceleration: numeric("acceleration", { precision: 12, scale: 4 }),
    platformCount: integer("platform_count").default(1),
    cryptoMentions: integer("crypto_mentions").default(0),
  },
  (table) => [
    index("narrative_snapshots_narrative_idx").on(table.narrativeId, table.timestamp),
  ]
);

// ─── 18. Narrative Tokens (Links Culture to Coins) ─────────────────────────
export const narrativeTokens = pgTable(
  "narrative_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    narrativeId: uuid("narrative_id")
      .notNull()
      .references(() => narratives.id, { onDelete: "cascade" }),
    tokenId: uuid("token_id")
      .notNull()
      .references(() => tokens.id, { onDelete: "cascade" }),
    confidence: numeric("confidence", { precision: 5, scale: 4 }).notNull(), // 0.0000 - 1.0000
    firstDetectedAt: timestamp("first_detected_at", { withTimezone: true }).defaultNow().notNull(),
    associationType: varchar("association_type", { length: 32 }).default("DIRECT").notNull(),
  },
  (table) => [
    uniqueIndex("narrative_tokens_unique_idx").on(table.narrativeId, table.tokenId),
    index("narrative_tokens_token_idx").on(table.tokenId),
  ]
);

// ─── Relations ─────────────────────────────────────────────────────────────
export const tokensRelations = relations(tokens, ({ many, one }) => ({
  pools: many(pools),
  snapshots: many(tokenSnapshots),
  trades: many(trades),
  holders: many(holders),
  holderSnapshots: many(holderSnapshots),
  riskAssessments: many(riskAssessments),
  features: many(tokenFeatures),
  scores: many(tokenScores),
  alerts: many(alerts),
  outcomes: many(tokenOutcomes),
  narrativeLinks: many(narrativeTokens),
}));

export const poolsRelations = relations(pools, ({ one, many }) => ({
  token: one(tokens, {
    fields: [pools.tokenId],
    references: [tokens.id],
  }),
  trades: many(trades),
}));

export const walletsRelations = relations(wallets, ({ many }) => ({
  positions: many(walletTokenPositions),
  events: many(walletEvents),
}));
