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
  updateTokenScore: (mint: string, opportunity: number, risk: number) => void;
  addDiscoveredToken: (item: Partial<LiveTokenItem> & { mintAddress: string }) => void;
  addAlert: (alert: LiveAlertItem) => void;
}

export const useDegenStore = create<DegenState>((set) => ({
  tokens: new Map(),
  alerts: [],
  isConnected: false,
  setConnected: (status) => set({ isConnected: status }),

  updateTokenScore: (mint, opportunity, risk) =>
    set((state) => {
      const next = new Map(state.tokens);
      const current = next.get(mint);
      if (current) {
        next.set(mint, {
          ...current,
          opportunityScore: opportunity,
          riskScore: risk,
        });
      }
      return { tokens: next };
    }),

  addDiscoveredToken: (item) =>
    set((state) => {
      const next = new Map(state.tokens);
      next.set(item.mintAddress, {
        mintAddress: item.mintAddress,
        symbol: item.symbol || "UNKNOWN",
        name: item.name || "Token",
        priceUsd: item.priceUsd || 0,
        marketCap: item.marketCap || 0,
        liquidityUsd: item.liquidityUsd || 0,
        opportunityScore: item.opportunityScore || 50,
        riskScore: item.riskScore || 20,
        firstSeenAt: item.firstSeenAt || new Date().toISOString(),
        isNew: true,
      });
      return { tokens: next };
    }),

  addAlert: (alert) =>
    set((state) => ({
      alerts: [alert, ...state.alerts.slice(0, 49)],
    })),
}));
