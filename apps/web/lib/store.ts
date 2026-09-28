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
  updateTokenScore: (mint: string, opportunity: number, risk: number, symbol?: string | null) => void;
  addDiscoveredToken: (item: Partial<LiveTokenItem> & { mintAddress: string }) => void;
  addAlert: (alert: LiveAlertItem) => void;
}

export const useDegenStore = create<DegenState>((set) => ({
  tokens: new Map(),
  alerts: [],
  isConnected: false,
  setConnected: (status) => set({ isConnected: status }),

  updateTokenScore: (mint: string, opportunity: number, risk: number, symbol?: string | null) =>
    set((state) => {
      const next = new Map(state.tokens);
      const current = next.get(mint);
      if (current) {
        next.set(mint, {
          ...current,
          symbol: (symbol && symbol !== "SCANNING" && symbol !== "UNKNOWN") ? symbol : current.symbol,
          opportunityScore: opportunity,
          riskScore: risk,
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
