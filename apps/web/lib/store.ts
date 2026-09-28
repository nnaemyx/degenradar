import { create } from "zustand";
import { toNullableNumber, type RadarEventItem } from "./radar";

export interface LiveTokenItem {
  mintAddress: string;
  symbol: string;
  name: string;
  priceUsd: number | null;
  marketCap: number | null;
  liquidityUsd: number | null;
  opportunityScore: number | null;
  riskScore: number | null;
  firstSeenAt: string;
  isNew?: boolean;
  volume24h?: number | null;
  priceChange24h?: number | null;
}

export interface LiveAlertItem {
  id: string;
  symbol: string;
  mintAddress: string;
  score: number | null;
  risk: number | null;
  signals: string[];
  timestamp: string;
}

interface DegenState {
  tokens: Map<string, LiveTokenItem>;
  alerts: LiveAlertItem[];
  recentEvents: RadarEventItem[];
  isConnected: boolean;
  setConnected: (status: boolean) => void;
  updateTokenScore: (
    mint: string,
    opportunity: number | null | undefined,
    risk: number | null | undefined,
    symbol?: string | null,
    priceUsd?: number | null,
    marketCap?: number | null,
    liquidityUsd?: number | null
  ) => void;
  enrichToken: (mint: string, data: Partial<LiveTokenItem>) => void;
  addDiscoveredToken: (item: Partial<LiveTokenItem> & { mintAddress: string }, recordEvent?: boolean) => void;
  addAlert: (alert: LiveAlertItem) => void;
}

const MAX_RECENT_EVENTS = 50;

function newestFirst(events: RadarEventItem[], event: RadarEventItem): RadarEventItem[] {
  return [event, ...events].slice(0, MAX_RECENT_EVENTS);
}

export const useDegenStore = create<DegenState>((set) => ({
  tokens: new Map(),
  alerts: [],
  recentEvents: [],
  isConnected: false,
  setConnected: (status) => set({ isConnected: status }),

  updateTokenScore: (mint, opportunity, risk, symbol, priceUsd, marketCap, liquidityUsd) =>
    set((state) => {
      const current = state.tokens.get(mint);
      if (!current) return state;

      const next = new Map(state.tokens);
      next.set(mint, {
        ...current,
        symbol: symbol && symbol !== "SCANNING" && symbol !== "UNKNOWN" ? symbol : current.symbol,
        opportunityScore: opportunity === undefined ? current.opportunityScore : toNullableNumber(opportunity),
        riskScore: risk === undefined ? current.riskScore : toNullableNumber(risk),
        priceUsd: priceUsd === undefined ? current.priceUsd : toNullableNumber(priceUsd),
        marketCap: marketCap === undefined ? current.marketCap : toNullableNumber(marketCap),
        liquidityUsd: liquidityUsd === undefined ? current.liquidityUsd : toNullableNumber(liquidityUsd),
      });

      const opportunityScore = opportunity === undefined ? current.opportunityScore : toNullableNumber(opportunity);
      const riskScore = risk === undefined ? current.riskScore : toNullableNumber(risk);
      const changed = current.opportunityScore !== opportunityScore || current.riskScore !== riskScore;
      const events = changed
        ? newestFirst(state.recentEvents, {
            id: `${mint}:score:${Date.now()}`,
            type: "score_updated",
            mintAddress: mint,
            symbol: (symbol && symbol !== "UNKNOWN" ? symbol : current.symbol) || "TOKEN",
            timestamp: new Date().toISOString(),
            opportunityScore,
            riskScore,
            signals: [],
          })
        : state.recentEvents;

      return { tokens: next, recentEvents: events };
    }),

  enrichToken: (mint, data) =>
    set((state) => {
      const current = state.tokens.get(mint);
      if (!current) return state;
      const next = new Map(state.tokens);
      next.set(mint, {
        ...current,
        ...data,
        symbol: data.symbol && !["TOKEN", "SCANNING", "UNKNOWN"].includes(data.symbol) ? data.symbol : current.symbol,
        name: data.name && !["New Token", "New Solana Launch"].includes(data.name) ? data.name : current.name,
        priceUsd: data.priceUsd === undefined ? current.priceUsd : toNullableNumber(data.priceUsd),
        marketCap: data.marketCap === undefined ? current.marketCap : toNullableNumber(data.marketCap),
        liquidityUsd: data.liquidityUsd === undefined ? current.liquidityUsd : toNullableNumber(data.liquidityUsd),
      });
      return { tokens: next };
    }),

  addDiscoveredToken: (item, recordEvent = true) =>
    set((state) => {
      const next = new Map(state.tokens);
      const existing = next.get(item.mintAddress);
      const realSymbol = item.symbol && !["SCANNING", "UNKNOWN"].includes(item.symbol)
        ? item.symbol
        : existing?.symbol || item.symbol || "TOKEN";
      const realName = item.name && item.name !== "New Solana Launch"
        ? item.name
        : existing?.name || item.name || "Token";
      const updated: LiveTokenItem = {
        mintAddress: item.mintAddress,
        symbol: realSymbol,
        name: realName,
        priceUsd: item.priceUsd === undefined ? existing?.priceUsd ?? null : toNullableNumber(item.priceUsd),
        marketCap: item.marketCap === undefined ? existing?.marketCap ?? null : toNullableNumber(item.marketCap),
        liquidityUsd: item.liquidityUsd === undefined ? existing?.liquidityUsd ?? null : toNullableNumber(item.liquidityUsd),
        opportunityScore: item.opportunityScore === undefined ? existing?.opportunityScore ?? null : toNullableNumber(item.opportunityScore),
        riskScore: item.riskScore === undefined ? existing?.riskScore ?? null : toNullableNumber(item.riskScore),
        firstSeenAt: item.firstSeenAt || existing?.firstSeenAt || new Date().toISOString(),
        isNew: !existing,
        volume24h: item.volume24h === undefined ? existing?.volume24h ?? null : toNullableNumber(item.volume24h),
        priceChange24h: item.priceChange24h === undefined ? existing?.priceChange24h ?? null : toNullableNumber(item.priceChange24h),
      };
      next.set(item.mintAddress, updated);

      const events = recordEvent && !existing
        ? newestFirst(state.recentEvents, {
            id: `${item.mintAddress}:discovered:${Date.now()}`,
            type: "token_discovered",
            mintAddress: item.mintAddress,
            symbol: realSymbol,
            timestamp: new Date().toISOString(),
            opportunityScore: updated.opportunityScore,
            riskScore: updated.riskScore,
            signals: [],
          })
        : state.recentEvents;
      return { tokens: next, recentEvents: events };
    }),

  addAlert: (alert) =>
    set((state) => ({
      alerts: [alert, ...state.alerts].slice(0, MAX_RECENT_EVENTS),
      recentEvents: newestFirst(state.recentEvents, {
        id: `${alert.id}:event`,
        type: "alert_received",
        mintAddress: alert.mintAddress,
        symbol: alert.symbol,
        timestamp: alert.timestamp,
        opportunityScore: alert.score,
        riskScore: alert.risk,
        signals: alert.signals,
      }),
    })),
}));
