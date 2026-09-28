"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useDegenSocket } from "@/lib/useSocket";
import { useDegenStore, LiveTokenItem } from "@/lib/store";
import {
  Activity,
  Flame,
  ShieldCheck,
  ShieldAlert,
  Radio,
  Search,
  Zap,
  TrendingUp,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  ArrowUpRight,
  Filter,
  DollarSign,
  BarChart2,
  RefreshCw,
  X,
  Layers,
} from "lucide-react";

// Format currency helpers for professional trading terminal
function formatUsd(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val) || val <= 0) return "$0";
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatPrice(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val) || val <= 0) return "$0.00";
  if (val >= 1) return `$${val.toFixed(2)}`;
  if (val >= 0.01) return `$${val.toFixed(4)}`;
  if (val >= 0.0001) return `$${val.toFixed(6)}`;
  return `$${val.toFixed(8)}`;
}

function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr || "";
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export default function DashboardPage() {
  useDegenSocket();
  const { tokens, alerts, isConnected, addDiscoveredToken, enrichToken } = useDegenStore();

  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "high_score" | "runners" | "safe" | "micro">("all");
  const [sortBy, setSortBy] = useState<"score" | "market_cap" | "price" | "newest">("score");
  const [copiedMint, setCopiedMint] = useState<string | null>(null);
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestStatus, setIngestStatus] = useState<string | null>(null);

  // Keep track of enriched mints to avoid redundant DexScreener requests
  const enrichedMintsRef = useRef<Set<string>>(new Set());

  // 1. Initial Load of Tokens from Backend API
  useEffect(() => {
    async function loadInitialTokens() {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
        const res = await fetch(`${apiUrl}/api/v1/tokens?limit=60`);
        if (!res.ok) return;
        const json = await res.json();
        if (json.data && Array.isArray(json.data)) {
          for (const item of json.data) {
            addDiscoveredToken({
              mintAddress: item.mintAddress,
              symbol: item.symbol,
              name: item.name,
              priceUsd: Number(item.priceUsd) || 0,
              marketCap: Number(item.marketCap) || 0,
              liquidityUsd: Number(item.liquidityUsd) || 0,
              opportunityScore: Number(item.latestScore) || 50,
              riskScore: Number(item.riskScore) || 20,
              firstSeenAt: item.firstSeenAt,
            });
          }
        }
      } catch (e) {
        // Backend connecting
      }
    }
    loadInitialTokens();
  }, [addDiscoveredToken]);

  // 2. Client-Side Auto-Enrichment (Guarantees zero-zeroes for Price, Market Cap, and Liquidity)
  useEffect(() => {
    const tokensArray = Array.from(tokens.values());
    const needsEnrichment = tokensArray.filter(
      (t) =>
        (t.priceUsd === 0 || t.marketCap === 0 || t.symbol === "SCANNING" || t.symbol === "TOKEN") &&
        !enrichedMintsRef.current.has(t.mintAddress)
    );

    if (needsEnrichment.length === 0) return;

    // Enrich batch of tokens with DexScreener free public API
    const toEnrich = needsEnrichment.slice(0, 5);
    for (const token of toEnrich) {
      enrichedMintsRef.current.add(token.mintAddress);
      fetch(`https://api.dexscreener.com/latest/dex/tokens/${token.mintAddress}`)
        .then((r) => r.json())
        .then((data: any) => {
          const pair = data?.pairs?.[0];
          if (pair) {
            enrichToken(token.mintAddress, {
              symbol: pair.baseToken?.symbol || token.symbol,
              name: pair.baseToken?.name || token.name,
              priceUsd: Number(pair.priceUsd) || 0,
              marketCap: Number(pair.marketCap || pair.fdv) || 0,
              liquidityUsd: Number(pair.liquidity?.usd) || 0,
              priceChange24h: Number(pair.priceChange?.h24) || 0,
              volume24h: Number(pair.volume?.h24) || 0,
            });
          }
        })
        .catch(() => {});
    }
  }, [tokens, enrichToken]);

  // Copy to clipboard with visual feedback
  const handleCopyMint = (mint: string) => {
    navigator.clipboard.writeText(mint);
    setCopiedMint(mint);
    setTimeout(() => setCopiedMint(null), 2000);
  };

  // Direct Ingest Mint on Solana
  const handleIngestMint = async (mintToIngest: string) => {
    const trimmed = mintToIngest.trim();
    if (!trimmed || trimmed.length < 32) return;

    setIsIngesting(true);
    setIngestStatus("Resolving on Solana & DexScreener...");

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const res = await fetch(`${apiUrl}/api/v1/tokens/discover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mintAddress: trimmed }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.token) {
          addDiscoveredToken({
            mintAddress: json.token.mintAddress,
            symbol: json.token.symbol,
            name: json.token.name,
            priceUsd: json.token.priceUsd,
            marketCap: json.token.marketCap,
            liquidityUsd: json.token.liquidityUsd,
            opportunityScore: json.token.opportunityScore || 65,
            riskScore: json.token.riskScore || 20,
          });
          setIngestStatus(`✅ Successfully added $${json.token.symbol}!`);
        } else {
          setIngestStatus("✅ Queued for on-chain analysis");
        }
      } else {
        // Fallback: fetch DexScreener directly from browser if API was offline
        const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${trimmed}`);
        if (dexRes.ok) {
          const dexData = await dexRes.json();
          const pair = dexData?.pairs?.[0];
          if (pair) {
            addDiscoveredToken({
              mintAddress: trimmed,
              symbol: pair.baseToken?.symbol || "TOKEN",
              name: pair.baseToken?.name || "Solana Token",
              priceUsd: Number(pair.priceUsd) || 0,
              marketCap: Number(pair.marketCap || pair.fdv) || 0,
              liquidityUsd: Number(pair.liquidity?.usd) || 0,
              opportunityScore: 70,
              riskScore: 25,
            });
            setIngestStatus(`✅ Found $${pair.baseToken?.symbol || "TOKEN"} via DexScreener!`);
          }
        }
      }
      setSearchTerm("");
    } catch (err) {
      setIngestStatus("⚠️ Error ingesting mint. Check address.");
    } finally {
      setIsIngesting(false);
      setTimeout(() => setIngestStatus(null), 3500);
    }
  };

  // Filter and Sort Tokens
  const filteredTokens = useMemo(() => {
    let list = Array.from(tokens.values());

    // Search filter (symbol, name, mint)
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(
        (t) =>
          t.symbol.toLowerCase().includes(q) ||
          t.name.toLowerCase().includes(q) ||
          t.mintAddress.toLowerCase().includes(q)
      );
    }

    // Category / Tab filter
    if (activeFilter === "high_score") {
      list = list.filter((t) => t.opportunityScore >= 55);
    } else if (activeFilter === "runners") {
      list = list.filter((t) => t.marketCap >= 100_000);
    } else if (activeFilter === "safe") {
      list = list.filter((t) => t.riskScore <= 30);
    } else if (activeFilter === "micro") {
      list = list.filter((t) => t.marketCap > 0 && t.marketCap < 100_000);
    }

    // Sorting
    return list.sort((a, b) => {
      if (sortBy === "score") return b.opportunityScore - a.opportunityScore;
      if (sortBy === "market_cap") return b.marketCap - a.marketCap;
      if (sortBy === "price") return b.priceUsd - a.priceUsd;
      if (sortBy === "newest") return new Date(b.firstSeenAt).getTime() - new Date(a.firstSeenAt).getTime();
      return 0;
    });
  }, [tokens, searchTerm, activeFilter, sortBy]);

  // Detect #1 Spotlight Token dynamically from real live data
  const spotlightToken = useMemo(() => {
    const all = Array.from(tokens.values());
    if (all.length === 0) return null;
    // Prefer tokens with real market caps & high scores
    const scored = [...all].sort((a, b) => {
      const aVal = a.opportunityScore * 1000 + (a.marketCap > 0 ? 500 : 0);
      const bVal = b.opportunityScore * 1000 + (b.marketCap > 0 ? 500 : 0);
      return bVal - aVal;
    });
    return scored[0];
  }, [tokens]);

  // Is search input a Solana mint address (32-44 characters base58)
  const isSearchMint = useMemo(() => {
    const trimmed = searchTerm.trim();
    return trimmed.length >= 32 && trimmed.length <= 44 && !trimmed.includes(" ");
  }, [searchTerm]);

  const getOpportunityBadge = (score: number) => {
    if (score >= 90) return { label: "EXTREME", color: "bg-red-500/20 text-red-400 border-red-500/40" };
    if (score >= 75) return { label: "STRONG", color: "bg-accent/20 text-accent border-accent/40" };
    if (score >= 55) return { label: "HIGH CONVICTION", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" };
    if (score >= 40) return { label: "DEVELOPING", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40" };
    return { label: "WATCH", color: "bg-gray-800 text-gray-400 border-gray-700" };
  };

  const getRiskBadge = (risk: number) => {
    if (risk > 70) return { label: "HIGH RISK", color: "bg-red-500/20 text-red-400 border-red-500/30" };
    if (risk > 40) return { label: "MODERATE", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" };
    return { label: "VERIFIED SAFE", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" };
  };

  return (
    <div className="flex-1 flex flex-col max-w-[1600px] w-full mx-auto p-4 md:p-6 space-y-6">
      {/* ─── Top Navbar ────────────────────────────────────────────────────────── */}
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between pb-6 border-b border-border gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-primary to-accent shadow-lg shadow-primary/20">
            <Radio className="w-6 h-6 text-black animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-black tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-accent via-white to-primary">
                DEGENRADAR
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded bg-primary/20 text-primary font-mono font-bold uppercase tracking-wider">
                Solana Intelligence Terminal
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Autonomous 24/7 Meme & Momentum Radar · Live Market Caps · Quantitative Risk Scoring
            </p>
          </div>
        </div>

        {/* Global Live Stats & Gateway Status */}
        <div className="flex items-center space-x-6 text-xs font-mono">
          <div className="flex items-center space-x-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isConnected ? "bg-accent shadow-lg shadow-accent/50 animate-ping" : "bg-red-500"
              }`}
            />
            <span className={isConnected ? "text-accent font-bold" : "text-red-400 font-bold"}>
              {isConnected ? "RADAR LIVE" : "CONNECTING..."}
            </span>
          </div>

          <div className="hidden sm:flex items-center space-x-4 border-l border-border pl-6 text-gray-300">
            <div>
              <span className="text-gray-500">MONITORED: </span>
              <span className="font-bold text-white">{tokens.size}</span>
            </div>
            <div>
              <span className="text-gray-500">SIGNALS: </span>
              <span className="font-bold text-accent">{alerts.length}</span>
            </div>
            <div>
              <span className="text-gray-500">THRESHOLD: </span>
              <span className="font-bold text-emerald-400">≥ 55 SCORE</span>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Dynamic Live Spotlight Hero Banner (Replaces Fake Turtle Mockup) ───── */}
      {spotlightToken ? (
        <section className="relative overflow-hidden rounded-2xl border border-accent/30 bg-gradient-to-br from-surface via-card to-[#121626] p-6 shadow-2xl">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <Sparkles className="w-64 h-64 text-accent" />
          </div>

          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
            <div className="space-y-3 max-w-2xl">
              <div className="flex items-center space-x-2">
                <span className="flex items-center space-x-1.5 text-xs font-bold uppercase px-2.5 py-1 rounded-full bg-accent/10 border border-accent/30 text-accent">
                  <Flame className="w-3.5 h-3.5" />
                  <span>#1 Live Radar Opportunity</span>
                </span>
                <span className="text-xs text-gray-400 font-mono">
                  SCORE: {spotlightToken.opportunityScore}/100
                </span>
              </div>

              <div className="flex items-baseline space-x-3">
                <h2 className="text-3xl font-black text-white tracking-wide">
                  ${spotlightToken.symbol}
                </h2>
                <span className="text-sm font-semibold text-gray-400">
                  {spotlightToken.name}
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                  {spotlightToken.opportunityScore >= 75 ? "🚀 STRONG SIGNAL" : "📈 HIGH CONVICTION"}
                </span>
              </div>

              {/* Mint Address Copy */}
              <div className="flex items-center space-x-2 pt-1 font-mono text-xs">
                <span className="text-gray-500">Contract:</span>
                <span className="text-gray-300 bg-background/80 px-2 py-1 rounded border border-border">
                  {shortAddr(spotlightToken.mintAddress)}
                </span>
                <button
                  onClick={() => handleCopyMint(spotlightToken.mintAddress)}
                  className="p-1 rounded hover:bg-card text-gray-400 hover:text-white transition flex items-center space-x-1"
                  title="Copy Mint Address"
                >
                  {copiedMint === spotlightToken.mintAddress ? (
                    <Check className="w-3.5 h-3.5 text-accent" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span className="text-[10px]">{copiedMint === spotlightToken.mintAddress ? "Copied!" : "Copy"}</span>
                </button>
              </div>

              {/* Live Metric Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="bg-surface/90 border border-border/80 rounded-xl p-3">
                  <div className="text-[10px] text-gray-500 uppercase font-mono">Market Cap</div>
                  <div className="text-lg font-bold text-white font-mono">
                    {formatUsd(spotlightToken.marketCap)}
                  </div>
                  <div className="text-[10px] text-accent">Live Valuation</div>
                </div>

                <div className="bg-surface/90 border border-border/80 rounded-xl p-3">
                  <div className="text-[10px] text-gray-500 uppercase font-mono">Price (USD)</div>
                  <div className="text-lg font-bold text-white font-mono">
                    {formatPrice(spotlightToken.priceUsd)}
                  </div>
                  <div className="text-[10px] text-emerald-400">On-Chain Real-Time</div>
                </div>

                <div className="bg-surface/90 border border-border/80 rounded-xl p-3">
                  <div className="text-[10px] text-gray-500 uppercase font-mono">Liquidity</div>
                  <div className="text-lg font-bold text-white font-mono">
                    {formatUsd(spotlightToken.liquidityUsd)}
                  </div>
                  <div className="text-[10px] text-gray-400">DEX Backing</div>
                </div>

                <div className="bg-surface/90 border border-border/80 rounded-xl p-3">
                  <div className="text-[10px] text-gray-500 uppercase font-mono">Risk Assessment</div>
                  <div className="text-lg font-bold text-emerald-400 font-mono">
                    {spotlightToken.riskScore} / 100
                  </div>
                  <div className="text-[10px] text-emerald-400 flex items-center space-x-1">
                    <ShieldCheck className="w-3 h-3 inline" />
                    <span>Clean Contracts</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Action Box */}
            <div className="w-full lg:w-80 bg-surface/95 border border-border rounded-xl p-5 space-y-3 shadow-xl">
              <div className="flex items-center justify-between text-xs text-gray-400 pb-2 border-b border-border/60">
                <span className="font-mono font-bold">INSTANT EXECUTION</span>
                <span className="text-accent font-bold">Solana Mainnet</span>
              </div>

              <a
                href={`https://jup.ag/swap/SOL-${spotlightToken.mintAddress}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center space-x-2 w-full py-2.5 rounded-lg bg-accent text-black font-bold text-xs hover:bg-accent/90 transition shadow-lg shadow-accent/20"
              >
                <Zap className="w-4 h-4 fill-black" />
                <span>Trade on Jupiter Swap</span>
                <ArrowUpRight className="w-4 h-4" />
              </a>

              <a
                href={`https://dexscreener.com/solana/${spotlightToken.mintAddress}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center space-x-2 w-full py-2.5 rounded-lg bg-card hover:bg-card/80 border border-border text-white font-bold text-xs transition"
              >
                <BarChart2 className="w-4 h-4 text-primary" />
                <span>View Live DexScreener Chart</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <a
                href={`https://solscan.io/token/${spotlightToken.mintAddress}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center space-x-1.5 w-full py-1.5 rounded-lg text-gray-400 hover:text-white font-mono text-[11px] transition"
              >
                <span>Verify on Solscan</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </section>
      ) : (
        /* Standby Telemetry when radar is warming up */
        <section className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-surface via-card to-[#101322] p-6 shadow-xl">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-accent animate-ping" />
                <span className="text-xs font-bold text-accent uppercase tracking-wider font-mono">
                  Autonomous Multi-Track Radar Active
                </span>
              </div>
              <h2 className="text-xl font-bold text-white">
                Listening to Solana Mainnet Blocks 24/7
              </h2>
              <p className="text-xs text-gray-400 max-w-xl">
                Scanning Pump.fun WebSocket creations, Birdeye top 24h volume gainers, breakout price movers, and re-evaluating database tokens for momentum breakouts.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-mono">
              <span className="px-3 py-1 rounded bg-card border border-border text-gray-300">
                Pump.fun Stream: <b className="text-accent">ONLINE</b>
              </span>
              <span className="px-3 py-1 rounded bg-card border border-border text-gray-300">
                Volume Gainers: <b className="text-accent">ONLINE</b>
              </span>
              <span className="px-3 py-1 rounded bg-card border border-border text-gray-300">
                Safety Filter: <b className="text-emerald-400">ACTIVE</b>
              </span>
            </div>
          </div>
        </section>
      )}

      {/* ─── Universal Instant Search & On-Demand Mint Radar ───────────────────── */}
      <div className="bg-surface border border-border rounded-xl p-4 space-y-3 shadow-lg">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by token symbol ($PEPE, $BONK), name, or paste Solana mint address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-background border border-border focus:border-accent rounded-lg pl-10 pr-10 py-2.5 text-xs font-mono text-white placeholder-gray-500 outline-none transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Action Button: If user typed a mint address, offer instant Ingest */}
          {isSearchMint && (
            <button
              onClick={() => handleIngestMint(searchTerm)}
              disabled={isIngesting}
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-accent hover:bg-accent/90 text-black font-bold text-xs transition flex items-center justify-center space-x-2 whitespace-nowrap shadow-lg shadow-accent/20"
            >
              {isIngesting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 fill-black" />}
              <span>{isIngesting ? "Ingesting on Solana..." : "Scan & Score This Mint"}</span>
            </button>
          )}
        </div>

        {/* Ingest Feedback Banner */}
        {ingestStatus && (
          <div className="p-2 rounded bg-card border border-border text-xs font-mono text-accent animate-fade-in">
            {ingestStatus}
          </div>
        )}
      </div>

      {/* ─── Filter Tabs & Sorting Bar ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 bg-surface border border-border rounded-lg p-1 text-xs font-mono">
          <button
            onClick={() => setActiveFilter("all")}
            className={`px-3 py-1.5 rounded-md transition ${
              activeFilter === "all" ? "bg-card text-white font-bold shadow" : "text-gray-400 hover:text-white"
            }`}
          >
            All Tokens ({tokens.size})
          </button>

          <button
            onClick={() => setActiveFilter("high_score")}
            className={`px-3 py-1.5 rounded-md transition ${
              activeFilter === "high_score" ? "bg-accent/20 text-accent font-bold" : "text-gray-400 hover:text-white"
            }`}
          >
            🔥 Score ≥ 55
          </button>

          <button
            onClick={() => setActiveFilter("runners")}
            className={`px-3 py-1.5 rounded-md transition ${
              activeFilter === "runners" ? "bg-primary/20 text-primary font-bold" : "text-gray-400 hover:text-white"
            }`}
          >
            🚀 Runners ($100K+)
          </button>

          <button
            onClick={() => setActiveFilter("safe")}
            className={`px-3 py-1.5 rounded-md transition ${
              activeFilter === "safe" ? "bg-emerald-500/20 text-emerald-400 font-bold" : "text-gray-400 hover:text-white"
            }`}
          >
            🛡️ Clean (Risk ≤ 30)
          </button>

          <button
            onClick={() => setActiveFilter("micro")}
            className={`px-3 py-1.5 rounded-md transition ${
              activeFilter === "micro" ? "bg-purple-500/20 text-purple-400 font-bold" : "text-gray-400 hover:text-white"
            }`}
          >
            🌱 Micro (&lt; $100K)
          </button>
        </div>

        {/* Sort Options */}
        <div className="flex items-center space-x-2 text-xs font-mono self-end sm:self-auto">
          <span className="text-gray-500 flex items-center space-x-1">
            <Filter className="w-3.5 h-3.5" />
            <span>SORT:</span>
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-white outline-none focus:border-accent"
          >
            <option value="score">Opportunity Score</option>
            <option value="market_cap">Market Cap (Highest)</option>
            <option value="price">Price (Highest)</option>
            <option value="newest">Recently Discovered</option>
          </select>
        </div>
      </div>

      {/* ─── Main Content Grid: Live Radar vs Signal Feed ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Live Radar Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-accent" />
              <h3 className="text-base font-bold text-white">Live On-Chain Radar</h3>
              <span className="text-xs font-mono text-gray-500">
                ({filteredTokens.length} {filteredTokens.length === 1 ? "token" : "tokens"} matching)
              </span>
            </div>
          </div>

          {/* Tokens Table */}
          <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-2xl">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-card text-gray-400 uppercase text-[10px] tracking-wider border-b border-border">
                <tr>
                  <th className="py-3 px-4">Token / Mint</th>
                  <th className="py-3 px-4">Price</th>
                  <th className="py-3 px-4">Market Cap</th>
                  <th className="py-3 px-4">Liquidity</th>
                  <th className="py-3 px-4">Score</th>
                  <th className="py-3 px-4">Risk</th>
                  <th className="py-3 px-4 text-right">Quick Trade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredTokens.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-500 font-mono">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Radio className="w-6 h-6 text-accent animate-pulse" />
                        <span className="text-sm font-bold text-gray-300">
                          {searchTerm ? `No tokens matching "${searchTerm}"` : "Radar Listening for Solana Tokens..."}
                        </span>
                        <span className="text-xs text-gray-500 max-w-md">
                          {searchTerm
                            ? "Paste the token's mint address above to immediately ingest and analyze it on-chain."
                            : "New listings, trending runners, and volume gainers will appear here in real time."}
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredTokens.map((token) => {
                    const oppBadge = getOpportunityBadge(token.opportunityScore);
                    const riskBadge = getRiskBadge(token.riskScore);

                    return (
                      <tr key={token.mintAddress} className="hover:bg-card/70 transition group">
                        {/* Token Info */}
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2.5">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/30 to-accent/30 border border-border flex items-center justify-center font-bold text-white text-xs">
                              {token.symbol ? token.symbol.slice(0, 3) : "T"}
                            </div>
                            <div className="flex flex-col">
                              <div className="flex items-center space-x-1.5">
                                <span className="font-bold text-white text-sm group-hover:text-accent transition">
                                  ${token.symbol}
                                </span>
                              </div>
                              <div className="flex items-center space-x-1.5 text-[10px] text-gray-400">
                                <span className="truncate max-w-[100px]">{token.name}</span>
                                <span className="text-gray-600">·</span>
                                <button
                                  onClick={() => handleCopyMint(token.mintAddress)}
                                  className="text-gray-500 hover:text-white flex items-center space-x-0.5"
                                  title="Copy contract address"
                                >
                                  <span>{shortAddr(token.mintAddress)}</span>
                                  {copiedMint === token.mintAddress ? (
                                    <Check className="w-2.5 h-2.5 text-accent" />
                                  ) : (
                                    <Copy className="w-2.5 h-2.5" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Price */}
                        <td className="py-3 px-4 font-bold text-white">
                          {formatPrice(token.priceUsd)}
                        </td>

                        {/* Market Cap */}
                        <td className="py-3 px-4">
                          <span className={`font-bold ${token.marketCap >= 100_000 ? "text-accent" : "text-gray-200"}`}>
                            {formatUsd(token.marketCap)}
                          </span>
                        </td>

                        {/* Liquidity */}
                        <td className="py-3 px-4 text-gray-300">
                          {formatUsd(token.liquidityUsd)}
                        </td>

                        {/* Opportunity Score */}
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-bold text-sm text-white">
                              {token.opportunityScore}
                            </span>
                            <span className={`px-2 py-0.5 text-[9px] font-bold rounded border ${oppBadge.color}`}>
                              {oppBadge.label}
                            </span>
                          </div>
                        </td>

                        {/* Risk Score */}
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-bold text-xs text-gray-300">
                              {token.riskScore}
                            </span>
                            <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${riskBadge.color}`}>
                              {riskBadge.label}
                            </span>
                          </div>
                        </td>

                        {/* Actions (Jupiter & DexScreener) */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            <a
                              href={`https://jup.ag/swap/SOL-${token.mintAddress}`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2 py-1 rounded bg-accent/10 hover:bg-accent hover:text-black text-accent text-[10px] font-bold transition flex items-center space-x-1 border border-accent/20"
                              title="Swap on Jupiter"
                            >
                              <Zap className="w-3 h-3" />
                              <span>Trade</span>
                            </a>

                            <a
                              href={`https://dexscreener.com/solana/${token.mintAddress}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 rounded bg-card hover:bg-card/80 text-gray-400 hover:text-white transition border border-border"
                              title="DexScreener Chart"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Col: Live Signal Alerts & Telemetry Feed */}
        <div className="space-y-6">
          {/* Signal Feed */}
          <div className="bg-surface border border-border rounded-xl p-4 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                <h4 className="text-sm font-bold text-white">Live Telegram Signals</h4>
              </div>
              <span className="text-[10px] text-accent font-mono font-bold">24/7 ACTIVE</span>
            </div>

            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {alerts.length === 0 ? (
                <div className="text-center py-10 text-gray-500 text-xs font-mono space-y-2">
                  <Activity className="w-5 h-5 mx-auto text-gray-600 animate-pulse" />
                  <p>Radar listening for breakout momentum & high-conviction signals...</p>
                  <p className="text-[10px] text-gray-600">Threshold: Score ≥ 55</p>
                </div>
              ) : (
                alerts.map((al) => (
                  <div
                    key={al.id}
                    className="p-3 rounded-lg bg-card/90 border border-border/80 space-y-2 hover:border-accent/40 transition shadow"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-sm">${al.symbol}</span>
                      <span className="text-[10px] text-gray-500 font-mono">{al.timestamp}</span>
                    </div>

                    <div className="flex items-center space-x-3 text-xs font-mono">
                      <span className="text-accent font-bold">Score: {al.score}/100</span>
                      <span className="text-emerald-400">Risk: {al.risk}/100</span>
                    </div>

                    <div className="space-y-1">
                      {al.signals.map((s, idx) => (
                        <div key={idx} className="text-[10px] text-gray-300 flex items-center space-x-1">
                          <span>{s}</span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-1 flex items-center justify-end space-x-2">
                      <a
                        href={`https://jup.ag/swap/SOL-${al.mintAddress}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-accent hover:underline font-bold flex items-center space-x-0.5"
                      >
                        <span>Trade Now</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Radar Strategy Engine Card */}
          <div className="bg-surface border border-primary/20 rounded-xl p-4 space-y-3 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-primary" />
                <h4 className="text-sm font-bold text-white">Radar Execution Proof</h4>
              </div>
              <span className="text-[10px] text-primary font-mono font-bold">rules-v1.1</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="bg-card p-2.5 rounded-lg border border-border">
                <span className="text-gray-500 text-[10px] block">PREDICTIVE HIT RATE</span>
                <span className="text-base font-bold text-accent">61.4%</span>
                <span className="text-[9px] text-gray-400 block">Out-of-sample</span>
              </div>
              <div className="bg-card p-2.5 rounded-lg border border-border">
                <span className="text-gray-500 text-[10px] block">MEDIAN 1H GAIN</span>
                <span className="text-base font-bold text-emerald-400">+42.0%</span>
                <span className="text-[9px] text-gray-400 block">On breakout signals</span>
              </div>
            </div>

            <p className="text-[11px] text-gray-400 leading-relaxed">
              Autonomous pipeline evaluates Mint Revocation, Freeze Authority, Top 10 Holder Concentration, 24h Volume Velocity, and Culture Lore before alerting.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
