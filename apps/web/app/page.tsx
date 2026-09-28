"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { useDegenSocket } from "@/lib/useSocket";
import { useDegenStore } from "@/lib/store";
import { OPPORTUNITY_THRESHOLD, toNullableNumber, type RadarFilter, type RadarSort } from "@/lib/radar";
import { BrandMark } from "@/components/dashboard/BrandMark";
import { EventFeed } from "@/components/dashboard/EventFeed";
import { InspectionPanel } from "@/components/dashboard/InspectionPanel";
import { MintSearch, type SearchFeedback } from "@/components/dashboard/MintSearch";
import { RadarControls } from "@/components/dashboard/RadarControls";
import { TokenRadar } from "@/components/dashboard/TokenRadar";

type TokenLoadStatus = "loading" | "loaded" | "error";
const MINT_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export default function DashboardPage() {
  useDegenSocket();
  const { tokens, alerts, recentEvents, isConnected, addDiscoveredToken, enrichToken } = useDegenStore();

  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<RadarFilter>("all");
  const [sortBy, setSortBy] = useState<RadarSort>("score");
  const [selectedMint, setSelectedMint] = useState<string | null>(null);
  const [copiedMint, setCopiedMint] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [feedback, setFeedback] = useState<SearchFeedback>(null);
  const [tokenLoadStatus, setTokenLoadStatus] = useState<TokenLoadStatus>("loading");
  const [retryCount, setRetryCount] = useState(0);
  const enrichedMintsRef = useRef<Set<string>>(new Set());

  const selectedToken = selectedMint ? tokens.get(selectedMint) || null : null;
  const isSearchMint = MINT_ADDRESS_PATTERN.test(searchTerm.trim());

  const loadTokens = useCallback(async (signal: AbortSignal) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const response = await fetch(`${apiUrl}/api/v1/tokens?limit=60`, { signal });
      if (!response.ok) throw new Error(`Token request failed (${response.status})`);
      const json = await response.json();
      if (Array.isArray(json.data)) {
        for (const item of json.data) {
          if (typeof item?.mintAddress !== "string") continue;
          addDiscoveredToken({
            mintAddress: item.mintAddress,
            symbol: item.symbol || "TOKEN",
            name: item.name || "Solana token",
            priceUsd: toNullableNumber(item.priceUsd),
            marketCap: toNullableNumber(item.marketCap),
            liquidityUsd: toNullableNumber(item.liquidityUsd),
            opportunityScore: toNullableNumber(item.latestScore),
            riskScore: toNullableNumber(item.riskScore),
            firstSeenAt: item.firstSeenAt || new Date().toISOString(),
          }, false);
        }
      }
      setTokenLoadStatus("loaded");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setTokenLoadStatus("error");
    }
  }, [addDiscoveredToken]);

  useEffect(() => {
    const controller = new AbortController();
    setTokenLoadStatus("loading");
    void loadTokens(controller.signal);
    return () => controller.abort();
  }, [loadTokens, retryCount]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      event.preventDefault();
      document.getElementById("radar-search")?.focus();
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    const tokensArray = Array.from(tokens.values());
    const needsEnrichment = tokensArray.filter(
      (token) =>
        (token.priceUsd === null || token.marketCap === null || token.symbol === "SCANNING" || token.symbol === "TOKEN") &&
        !enrichedMintsRef.current.has(token.mintAddress)
    ).slice(0, 5);

    for (const token of needsEnrichment) {
      enrichedMintsRef.current.add(token.mintAddress);
      fetch(`https://api.dexscreener.com/latest/dex/tokens/${token.mintAddress}`)
        .then((response) => response.ok ? response.json() : null)
        .then((data) => {
          const pair = data?.pairs?.[0];
          if (!pair) return;
          enrichToken(token.mintAddress, {
            symbol: pair.baseToken?.symbol || token.symbol,
            name: pair.baseToken?.name || token.name,
            priceUsd: toNullableNumber(pair.priceUsd),
            marketCap: toNullableNumber(pair.marketCap),
            liquidityUsd: toNullableNumber(pair.liquidity?.usd),
            priceChange24h: toNullableNumber(pair.priceChange?.h24),
            volume24h: toNullableNumber(pair.volume?.h24),
          });
        })
        .catch(() => {
          // Market enrichment is optional; absent values remain unavailable.
        });
    }
  }, [tokens, selectedMint, enrichToken]);

  const filteredTokens = useMemo(() => {
    let list = Array.from(tokens.values());
    const query = searchTerm.trim().toLowerCase();
    if (query && !MINT_ADDRESS_PATTERN.test(searchTerm.trim())) {
      list = list.filter((token) => token.symbol.toLowerCase().includes(query) || token.name.toLowerCase().includes(query) || token.mintAddress.toLowerCase().includes(query));
    } else if (query) {
      list = list.filter((token) => token.mintAddress.toLowerCase() === query);
    }

    if (activeFilter === "opportunity") list = list.filter((token) => token.opportunityScore !== null && token.opportunityScore >= OPPORTUNITY_THRESHOLD);
    if (activeFilter === "market_cap") list = list.filter((token) => token.marketCap !== null && token.marketCap >= 100_000);
    if (activeFilter === "lower_risk") list = list.filter((token) => token.riskScore !== null && token.riskScore <= 30);
    if (activeFilter === "micro_cap") list = list.filter((token) => token.marketCap !== null && token.marketCap > 0 && token.marketCap < 100_000);

    const compareNullable = (a: number | null, b: number | null, direction: "asc" | "desc") => {
      if (a === null && b === null) return 0;
      if (a === null) return 1;
      if (b === null) return -1;
      return direction === "desc" ? b - a : a - b;
    };

    return list.sort((a, b) => {
      if (sortBy === "score") return compareNullable(a.opportunityScore, b.opportunityScore, "desc");
      if (sortBy === "market_cap") return compareNullable(a.marketCap, b.marketCap, "desc");
      if (sortBy === "price") return compareNullable(a.priceUsd, b.priceUsd, "desc");
      return new Date(b.firstSeenAt).getTime() - new Date(a.firstSeenAt).getTime();
    });
  }, [tokens, searchTerm, activeFilter, sortBy]);

  useEffect(() => {
    if (selectedMint && filteredTokens.some((token) => token.mintAddress === selectedMint)) return;
    if (filteredTokens[0]) {
      setSelectedMint(filteredTokens[0].mintAddress);
    } else if (searchTerm || activeFilter !== "all") {
      setSelectedMint(null);
    }
  }, [filteredTokens, selectedMint, searchTerm, activeFilter]);

  const handleCopyMint = useCallback(async (mint: string) => {
    try {
      await navigator.clipboard.writeText(mint);
      setCopiedMint(mint);
      window.setTimeout(() => setCopiedMint((current) => current === mint ? null : current), 1800);
    } catch {
      setFeedback({ kind: "error", message: "Could not copy the mint address. Select and copy it directly." });
    }
  }, []);

  const handleIngestMint = useCallback(async () => {
    const mint = searchTerm.trim();
    if (!MINT_ADDRESS_PATTERN.test(mint) || isScanning) return;

    setIsScanning(true);
    setFeedback({ kind: "info", message: "Scanning mint…" });
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const response = await fetch(`${apiUrl}/api/v1/tokens/discover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mintAddress: mint }),
      });

      if (response.ok) {
        const json = await response.json();
        const token = json.token;
        if (token && typeof token.mintAddress === "string") {
          addDiscoveredToken({
            mintAddress: token.mintAddress,
            symbol: token.symbol || "TOKEN",
            name: token.name || "Solana token",
            priceUsd: toNullableNumber(token.priceUsd),
            marketCap: toNullableNumber(token.marketCap),
            liquidityUsd: toNullableNumber(token.liquidityUsd),
            opportunityScore: toNullableNumber(token.opportunityScore),
            riskScore: toNullableNumber(token.riskScore),
          });
          setSelectedMint(token.mintAddress);
          setFeedback({ kind: "success", message: token.opportunityScore == null || token.riskScore == null ? "Token added. Evaluation is pending." : `Token $${token.symbol || "TOKEN"} added to the radar.` });
        } else {
          setFeedback({ kind: "info", message: "Scan queued for analysis. This mint stays in the search field." });
        }
      } else {
        const dexResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
        if (!dexResponse.ok) throw new Error("Could not resolve this mint");
        const dexData = await dexResponse.json();
        const pair = dexData?.pairs?.[0];
        if (!pair) {
          setFeedback({ kind: "error", message: "No market pair was found. This mint stays in the search field." });
          return;
        }
        addDiscoveredToken({
          mintAddress: mint,
          symbol: pair.baseToken?.symbol || "TOKEN",
          name: pair.baseToken?.name || "Solana token",
          priceUsd: toNullableNumber(pair.priceUsd),
          marketCap: toNullableNumber(pair.marketCap),
          liquidityUsd: toNullableNumber(pair.liquidity?.usd),
          opportunityScore: null,
          riskScore: null,
        });
        setSelectedMint(mint);
        setFeedback({ kind: "success", message: "Token found through market data. Evaluation is pending; this is not a safety review." });
      }
    } catch {
      setFeedback({ kind: "error", message: "Could not scan this mint. Check the address and try again." });
    } finally {
      setIsScanning(false);
    }
  }, [searchTerm, isScanning, addDiscoveredToken]);

  const handleSelectEventToken = (mint: string) => {
    if (!tokens.has(mint)) return;
    if (!filteredTokens.some((token) => token.mintAddress === mint)) {
      setSearchTerm("");
      setActiveFilter("all");
    }
    setSelectedMint(mint);
  };

  return (
    <main className="min-h-[100dvh] bg-background text-slate-100">
      <div className="mx-auto w-full max-w-[1500px] px-4 pb-8 sm:px-6 lg:px-10">
        <header className="flex min-h-[74px] flex-col justify-center gap-3 border-b border-white/[0.08] py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <BrandMark />
          <div className="flex items-center justify-between gap-4 sm:justify-end sm:gap-6">
            <div className="flex items-center gap-2 font-data text-[10px] text-slate-300" role="status" aria-live="polite">
              <span className={`h-2 w-2 rounded-full ${isConnected ? "bg-accent" : "bg-muted"}`} />
              <span>{isConnected ? "Updates connected" : "Disconnected"}</span>
            </div>
            <div className="h-7 w-px bg-white/10" />
            <div className="flex items-center gap-4 font-data text-[9px] sm:gap-6">
              <div><span className="text-muted">MONITORED</span><div className="mt-0.5 text-[13px] font-semibold tabular-nums text-white">{tokens.size}</div></div>
              <div><span className="text-muted">ALERTS</span><div className="mt-0.5 text-[13px] font-semibold tabular-nums text-white">{alerts.length}</div></div>
            </div>
          </div>
        </header>

        <MintSearch
          value={searchTerm}
          onChange={(value) => { setSearchTerm(value); setFeedback(null); }}
          isMint={isSearchMint}
          isScanning={isScanning}
          feedback={feedback}
          onClear={() => { setSearchTerm(""); setFeedback(null); }}
          onScan={handleIngestMint}
          onEnter={handleIngestMint}
        />

        <RadarControls
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          sortBy={sortBy}
          onSortChange={setSortBy}
          totalTokens={tokens.size}
        />

        <div className="mt-5 grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_326px] xl:gap-6">
          <TokenRadar
            tokens={filteredTokens}
            totalTokens={tokens.size}
            selectedMint={selectedMint}
            onSelect={setSelectedMint}
            copiedMint={copiedMint}
            onCopy={handleCopyMint}
            searchTerm={searchTerm}
            hasActiveFilters={activeFilter !== "all"}
            isLoading={tokenLoadStatus === "loading" && tokens.size === 0}
            loadError={tokenLoadStatus === "error" && tokens.size === 0}
            onRetry={() => setRetryCount((count) => count + 1)}
          />

          <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-4">
            <InspectionPanel token={selectedToken} alerts={alerts} copiedMint={copiedMint} onCopy={handleCopyMint} />
            <EventFeed events={recentEvents} isConnected={isConnected} onSelectToken={handleSelectEventToken} />
          </aside>
        </div>

        <footer className="mt-7 flex flex-col gap-2 border-t border-white/[0.07] pt-3 font-data text-[9px] leading-relaxed text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>Market figures and scores reflect available upstream data, not a guarantee of safety or returns.</span>
          <a href="https://solscan.io" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1.5 text-slate-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            Solana token intelligence <ExternalLink aria-hidden="true" className="h-3 w-3" />
          </a>
        </footer>
      </div>
    </main>
  );
}
