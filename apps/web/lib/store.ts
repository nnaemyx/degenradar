import { create } from "zustand";

export interface LiveTokenItem {
  mintAddress: string;
  symbol: string;
  name: string;
  priceUsd: number;
  marketCap: number;
  liquidityUsd: number;
  opportunityScore: number;
  riskScore: number;
  firstSeenAt: string;
  isNew?: boolean;
  volume24h?: number;
  priceChange24h?: number;
}

export interface LiveAlertItem {
  id: string;
  symbol: string;
  mintAddress: string;
  score: number;
  risk: number;
  signals: string[];
  timestamp: string;
}

interface DegenState {
  tokens: Map<string, LiveTokenItem>;
  alerts: LiveAlertItem[];
  isConnected: boolean;
  setConnected: (status: boolean) => void;
  updateTokenScore: (
    mint: string,
    opportunity: number,
    risk: number,
    symbol?: string | null,
    priceUsd?: number | null,
    marketCap?: number | null,
    liquidityUsd?: number | null
  ) => void;
  enrichToken: (mint: string, data: Partial<LiveTokenItem>) => void;
  addDiscoveredToken: (item: Partial<LiveTokenItem> & { mintAddress: string }) => void;
  addAlert: (alert: LiveAlertItem) => void;
}

export const useDegenStore = create<DegenState>((set) => ({
  tokens: new Map(),
  alerts: [],
  isConnected: false,
  setConnected: (status) => set({ isConnected: status }),

  updateTokenScore: (
    mint: string,
    opportunity: number,
    risk: number,
    symbol?: string | null,
    priceUsd?: number | null,
    marketCap?: number | null,
    liquidityUsd?: number | null
  ) =>
    set((state) => {
      const next = new Map(state.tokens);
      const current = next.get(mint);
      if (current) {
        next.set(mint, {
          ...current,
          symbol: (symbol && symbol !== "SCANNING" && symbol !== "UNKNOWN") ? symbol : current.symbol,
          opportunityScore: opportunity,
          riskScore: risk,
          priceUsd: (priceUsd !== undefined && priceUsd !== null && priceUsd > 0) ? priceUsd : current.priceUsd,
          marketCap: (marketCap !== undefined && marketCap !== null && marketCap > 0) ? marketCap : current.marketCap,
          liquidityUsd: (liquidityUsd !== undefined && liquidityUsd !== null && liquidityUsd > 0) ? liquidityUsd : current.liquidityUsd,
        });
      }
      return { tokens: next };
    }),

  enrichToken: (mint, data) =>
    set((state) => {
      const next = new Map(state.tokens);
      const current = next.get(mint);
      if (current) {
        next.set(mint, {
          ...current,
          ...data,
          symbol: data.symbol && data.symbol !== "TOKEN" && data.symbol !== "SCANNING" ? data.symbol : current.symbol,
          name: data.name && data.name !== "New Token" && data.name !== "New Solana Launch" ? data.name : current.name,
          priceUsd: data.priceUsd && data.priceUsd > 0 ? data.priceUsd : current.priceUsd,
          marketCap: data.marketCap && data.marketCap > 0 ? data.marketCap : current.marketCap,
          liquidityUsd: data.liquidityUsd && data.liquidityUsd > 0 ? data.liquidityUsd : current.liquidityUsd,
        });
      }
      return { tokens: next };
    }),

  addDiscoveredToken: (item) =>
    set((state) => {
      const next = new Map(state.tokens);
      const existing = next.get(item.mintAddress);
      const realSymbol = item.symbol && item.symbol !== "SCANNING" && item.symbol !== "UNKNOWN"
        ? item.symbol
        : existing?.symbol && existing.symbol !== "SCANNING" && existing.symbol !== "UNKNOWN"
          ? existing.symbol
          : (item.symbol || "TOKEN");

      const realName = item.name && item.name !== "New Solana Launch"
        ? item.name
        : existing?.name || item.name || "Token";

      next.set(item.mintAddress, {
        mintAddress: item.mintAddress,
        symbol: realSymbol,
        name: realName,
        priceUsd: item.priceUsd ?? existing?.priceUsd ?? 0,
        marketCap: item.marketCap ?? existing?.marketCap ?? 0,
        liquidityUsd: item.liquidityUsd ?? existing?.liquidityUsd ?? 0,
        opportunityScore: item.opportunityScore ?? existing?.opportunityScore ?? 50,
        riskScore: item.riskScore ?? existing?.riskScore ?? 20,
        firstSeenAt: item.firstSeenAt || existing?.firstSeenAt || new Date().toISOString(),
        isNew: true,
      });
      return { tokens: next };
    }),

  addAlert: (alert) =>
    set((state) => ({
      alerts: [alert, ...state.alerts.slice(0, 49)],
    })),
}));
