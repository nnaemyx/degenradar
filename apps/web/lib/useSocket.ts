"use client";

import { useEffect, useRef } from "react";
import { toNullableNumber } from "./radar";
import { useDegenStore } from "./store";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001";

export function useDegenSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const { setConnected, updateTokenScore, addDiscoveredToken, addAlert } = useDegenStore();

  useEffect(() => {
    let reconnectTimeout: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    function connect() {
      if (disposed) return;
      try {
        const ws = new WebSocket(`${WS_URL}/ws`);
        wsRef.current = ws;

        ws.onopen = () => setConnected(true);

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            const data = payload?.data;
            if (!data) return;

            switch (payload.type) {
              case "TOKEN_DISCOVERED":
                if (typeof data.mintAddress !== "string") return;
                addDiscoveredToken({
                  mintAddress: data.mintAddress,
                  symbol: data.symbol || "TOKEN",
                  name: data.name || "Solana token",
                  firstSeenAt: data.firstSeenAt || payload.timestamp || new Date().toISOString(),
                  priceUsd: data.priceUsd === undefined ? undefined : toNullableNumber(data.priceUsd),
                  marketCap: data.marketCap === undefined ? undefined : toNullableNumber(data.marketCap),
                  liquidityUsd: data.liquidityUsd === undefined ? undefined : toNullableNumber(data.liquidityUsd),
                  opportunityScore: data.opportunityScore === undefined ? undefined : toNullableNumber(data.opportunityScore),
                  riskScore: data.riskScore === undefined ? undefined : toNullableNumber(data.riskScore),
                });
                break;

              case "TOKEN_SCORE_UPDATED":
              case "TOKEN_RISK_UPDATED":
                if (typeof data.mintAddress !== "string") return;
                updateTokenScore(
                  data.mintAddress,
                  data.opportunityScore === undefined ? undefined : toNullableNumber(data.opportunityScore),
                  data.riskScore === undefined ? undefined : toNullableNumber(data.riskScore),
                  data.symbol,
                  data.priceUsd === undefined ? undefined : toNullableNumber(data.priceUsd),
                  data.marketCap === undefined ? undefined : toNullableNumber(data.marketCap),
                  data.liquidityUsd === undefined ? undefined : toNullableNumber(data.liquidityUsd)
                );
                break;

              case "ALERT_FIRED":
                if (typeof data.mintAddress !== "string") return;
                addAlert({
                  id: `${Date.now()}`,
                  symbol: data.symbol || "UNKNOWN",
                  mintAddress: data.mintAddress,
                  score: toNullableNumber(data.opportunityScore),
                  risk: toNullableNumber(data.riskScore),
                  signals: Array.isArray(data.signals) ? data.signals.filter((signal: unknown): signal is string => typeof signal === "string") : [],
                  timestamp: payload.timestamp || new Date().toISOString(),
                });
                break;

              default:
                break;
            }
          } catch {
            // Ignore invalid JSON and WebSocket keepalive frames.
          }
        };

        ws.onclose = () => {
          setConnected(false);
          if (!disposed) reconnectTimeout = setTimeout(connect, 3000);
        };

        ws.onerror = () => ws.close();
      } catch {
        setConnected(false);
        if (!disposed) reconnectTimeout = setTimeout(connect, 3000);
      }
    }

    connect();
    return () => {
      disposed = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      wsRef.current?.close();
      wsRef.current = null;
      setConnected(false);
    };
  }, [setConnected, updateTokenScore, addDiscoveredToken, addAlert]);
}
