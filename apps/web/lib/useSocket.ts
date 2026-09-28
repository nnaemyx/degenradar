"use client";

import { useEffect, useRef } from "react";
import { useDegenStore } from "./store";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001";

export function useDegenSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const { setConnected, updateTokenScore, addDiscoveredToken, addAlert } = useDegenStore();

  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout;

    function connect() {
      try {
        const ws = new WebSocket(`${WS_URL}/ws`);
        wsRef.current = ws;

        ws.onopen = () => {
          setConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            switch (payload.type) {
              case "TOKEN_DISCOVERED":
                addDiscoveredToken({
                  mintAddress: payload.data.mintAddress,
                  symbol: payload.data.symbol,
                  name: payload.data.name,
                  firstSeenAt: payload.data.firstSeenAt,
                  priceUsd: payload.data.priceUsd,
                  marketCap: payload.data.marketCap,
                  liquidityUsd: payload.data.liquidityUsd,
                });
                break;

              case "TOKEN_SCORE_UPDATED":
                updateTokenScore(
                  payload.data.mintAddress,
                  payload.data.opportunityScore,
                  payload.data.riskScore,
                  payload.data.symbol,
                  payload.data.priceUsd,
                  payload.data.marketCap,
                  payload.data.liquidityUsd
                );
                break;

              case "ALERT_FIRED":
                addAlert({
                  id: String(Date.now()),
                  symbol: payload.data.symbol || "UNKNOWN",
                  mintAddress: payload.data.mintAddress,
                  score: payload.data.opportunityScore,
                  risk: payload.data.riskScore,
                  signals: payload.data.signals || [],
                  timestamp: new Date().toLocaleTimeString(),
                });
                break;

              default:
                break;
            }
          } catch (e) {
            // Ignore parse errors for keepalives
          }
        };

        ws.onclose = () => {
          setConnected(false);
          reconnectTimeout = setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch (e) {
        reconnectTimeout = setTimeout(connect, 3000);
      }
    }

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [setConnected, updateTokenScore, addDiscoveredToken, addAlert]);
}
