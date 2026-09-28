// ─── Token Types ────────────────────────────────────────────────────────────

export interface Token {
  id: string;
  mintAddress: string;
  symbol: string | null;
  name: string | null;
  decimals: number;
  totalSupply: string | null;
  creatorAddress: string | null;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  isVerified: boolean;
  isActive: boolean;
  createdSlot: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  createdAt: Date;
}

export interface Pool {
  id: string;
  tokenId: string;
  dex: string;
  poolAddress: string;
  baseMint: string;
  quoteMint: string;
  liquidityUsd: string | null;
  isActive: boolean;
  createdAt: Date;
  lastSeenAt: Date;
}

export interface TokenSnapshot {
  id: string;
  tokenId: string;
  timestamp: Date;
  slot: string | null;
  priceUsd: string | null;
  marketCap: string | null;
  fdv: string | null;
  liquidityUsd: string | null;
  volume1m: string | null;
  volume5m: string | null;
  volume15m: string | null;
  volume1h: string | null;
  buys1m: number | null;
  sells1m: number | null;
  uniqueBuyers1m: number | null;
  uniqueSellers1m: number | null;
  holders: number | null;
  createdAt: Date;
}

export interface Trade {
  id: string;
  signature: string;
  tokenId: string;
  poolId: string | null;
  timestamp: Date;
  slot: string | null;
  traderAddress: string;
  side: TradeSide;
  tokenAmount: string;
  quoteAmount: string;
  priceUsd: string | null;
  usdValue: string | null;
  dex: string | null;
  createdAt: Date;
}

export type TradeSide = "BUY" | "SELL";

// ─── Holder Types ───────────────────────────────────────────────────────────

export interface Holder {
  id: string;
  tokenId: string;
  walletAddress: string;
  balance: string;
  percentage: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  isCreator: boolean;
  isLp: boolean;
  isExchange: boolean;
  isKnownSmartMoney: boolean;
}

export interface HolderSnapshot {
  id: string;
  tokenId: string;
  timestamp: Date;
  holderCount: number | null;
  top1Pct: string | null;
  top5Pct: string | null;
  top10Pct: string | null;
  top20Pct: string | null;
  creatorPct: string | null;
  insiderPct: string | null;
}

// ─── Wallet Types ───────────────────────────────────────────────────────────

export type WalletClassification =
  | "UNKNOWN"
  | "NORMAL"
  | "BOT"
  | "SNIPER"
  | "SMART_MONEY"
  | "DEV"
  | "INSIDER"
  | "MARKET_MAKER";

export interface Wallet {
  id: string;
  address: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  realizedPnl: string;
  unrealizedPnl: string;
  avgReturnPct: string | null;
  earlyEntries: number;
  successfulEarlyEntries: number;
  smartMoneyScore: string | null;
  classification: WalletClassification;
}

export interface WalletTokenPosition {
  id: string;
  walletId: string;
  tokenId: string;
  firstBuyAt: Date | null;
  lastBuyAt: Date | null;
  totalBoughtUsd: string;
  totalSoldUsd: string;
  currentBalance: string;
  realizedPnl: string;
  unrealizedPnl: string;
  maxRoiPct: string | null;
}

export interface WalletEvent {
  id: string;
  walletId: string;
  tokenId: string;
  timestamp: Date;
  eventType: string;
  amount: string | null;
  usdValue: string | null;
  signature: string | null;
}

// ─── Risk Types ─────────────────────────────────────────────────────────────

export interface RiskFlags {
  mintAuthority: boolean;
  freezeAuthority: boolean;
  highHolderConcentration: boolean;
  creatorSelling: boolean;
  suspiciousClusters: boolean;
  lowLiquidity: boolean;
  notTradeable: boolean;
}

export interface RiskAssessment {
  id: string;
  tokenId: string;
  timestamp: Date;
  mintAuthorityEnabled: boolean;
  freezeAuthorityEnabled: boolean;
  top10HolderPct: string | null;
  creatorPct: string | null;
  insiderPct: string | null;
  liquidityUsd: string | null;
  sellabilityScore: string | null;
  walletClusterScore: string | null;
  creatorRiskScore: string | null;
  overallRiskScore: string;
  riskFlags: RiskFlags;
}

// ─── Feature Types ──────────────────────────────────────────────────────────

export interface TokenFeatures {
  id: string;
  tokenId: string;
  timestamp: Date;
  volumeVelocity: string | null;
  volumeAcceleration: string | null;
  holderVelocity: string | null;
  holderAcceleration: string | null;
  priceVelocity: string | null;
  priceAcceleration: string | null;
  buyPressure: string | null;
  liquidityChange: string | null;
  uniqueBuyerVelocity: string | null;
  smartMoneyScore: string | null;
  walletConcentration: string | null;
  socialVelocity: string | null;
  socialAcceleration: string | null;
}

// ─── Score Types ─────────────────────────────────────────────────────────────

export type OpportunityLevel =
  | "WATCH"
  | "DEVELOPING"
  | "EARLY_SIGNAL"
  | "STRONG_SIGNAL"
  | "EXTREME_SIGNAL";

export interface TokenScore {
  id: string;
  tokenId: string;
  timestamp: Date;
  opportunityScore: string;
  riskScore: string;
  momentumScore: string | null;
  smartMoneyScore: string | null;
  liquidityScore: string | null;
  holderScore: string | null;
  socialScore: string | null;
  modelVersion: string;
}

// ─── Alert Types ─────────────────────────────────────────────────────────────

export type AlertType =
  | "STRONG_SIGNAL"
  | "EXTREME_SIGNAL"
  | "SMART_MONEY_ENTRY"
  | "VOLUME_ACCELERATION"
  | "HOLDER_SURGE"
  | "RISK_ELEVATED"
  | "RUG_WARNING";

export interface Alert {
  id: string;
  tokenId: string;
  alertType: AlertType;
  score: string | null;
  triggeredAt: Date;
  payload: Record<string, unknown>;
  telegramSent: boolean;
  discordSent: boolean;
  createdAt: Date;
}

// ─── Outcome Types ───────────────────────────────────────────────────────────

export interface TokenOutcome {
  id: string;
  tokenId: string;
  signalId: string | null;
  signalTimestamp: Date;
  priceAtSignal: string;
  price5m: string | null;
  price15m: string | null;
  price30m: string | null;
  price1h: string | null;
  price6h: string | null;
  price24h: string | null;
  maxGain1h: string | null;
  maxDrawdown1h: string | null;
  maxGain24h: string | null;
  maxDrawdown24h: string | null;
}

// ─── Queue Job Types ─────────────────────────────────────────────────────────

export interface TokenDiscoveryJob {
  mintAddress: string;
  detectedAt: string;
  source: "helius_ws" | "birdeye_new" | "birdeye_trending" | "birdeye_top_gainers" | "birdeye_price_mover" | "db_momentum_recheck" | "manual";
}

export interface TradeProcessingJob {
  tokenId: string;
  signature: string;
  mintAddress: string;
}

export interface HolderAnalysisJob {
  tokenId: string;
  mintAddress: string;
  priority?: "low" | "normal" | "high";
}

export interface RiskAnalysisJob {
  tokenId: string;
  mintAddress: string;
}

export interface FeatureCalculationJob {
  tokenId: string;
  timestamp: string;
}

export interface ScoreCalculationJob {
  tokenId: string;
  timestamp: string;
  triggerSource: "scheduled" | "event" | "backfill";
  // Live market performance data (passed from feature engine to avoid extra DB reads)
  priceChange1h?: number;   // % price change in last 1h
  priceChange24h?: number;  // % price change in last 24h
  volume24h?: number;       // 24h volume in USD
}

export interface AlertProcessingJob {
  tokenId: string;
  scoreId: string;
  opportunityScore: number;
  riskScore: number;
  signals: string[];
  projectedMultiplier?: string;
  isRugWarning?: boolean;
  lore?: string;
  category?: string;
}

export interface OutcomeCalculationJob {
  tokenId: string;
  signalId: string;
  signalTimestamp: string;
  priceAtSignal: number;
}

// ─── WebSocket Event Types ───────────────────────────────────────────────────

export type WsEventType =
  | "TOKEN_DISCOVERED"
  | "TOKEN_SCORE_UPDATED"
  | "TOKEN_RISK_UPDATED"
  | "SMART_MONEY_ENTRY"
  | "VOLUME_SPIKE"
  | "HOLDER_SURGE"
  | "ALERT_FIRED";

export interface WsEvent<T = unknown> {
  type: WsEventType;
  timestamp: string;
  data: T;
}

export interface TokenScoreUpdatedEvent {
  mintAddress: string;
  symbol: string | null;
  opportunityScore: number;
  riskScore: number;
  momentumScore: number | null;
  modelVersion: string;
  priceUsd?: number | null;
  marketCap?: number | null;
  liquidityUsd?: number | null;
}

export interface TokenDiscoveredEvent {
  mintAddress: string;
  symbol: string | null;
  name: string | null;
  creatorAddress: string | null;
  firstSeenAt: string;
  priceUsd?: number | null;
  marketCap?: number | null;
  liquidityUsd?: number | null;
}

// ─── API Response Types ───────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

export interface TokenDetailResponse {
  token: Token;
  pool: Pool | null;
  latestSnapshot: TokenSnapshot | null;
  latestScore: TokenScore | null;
  latestRisk: RiskAssessment | null;
  latestFeatures: TokenFeatures | null;
}
