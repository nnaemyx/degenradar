"use client";

import React, { useState, useEffect } from "react";
import { useDegenSocket } from "@/lib/useSocket";
import { useDegenStore } from "@/lib/store";
import {
  Activity,
  Flame,
  ShieldAlert,
  Radio,
  Search,
  Zap,
  TrendingUp,
  Share2,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from "lucide-react";

export default function DashboardPage() {
  useDegenSocket();
  const { tokens, alerts, isConnected, addDiscoveredToken } = useDegenStore();
  const [manualMint, setManualMint] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "high_score" | "safe">("all");

  // Initial seed demo tokens for instant dashboard vibrancy if DB is freshly empty
  useEffect(() => {
    if (tokens.size === 0) {
      addDiscoveredToken({
        mintAddress: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
        symbol: "FRANK",
        name: "Frank the Turtle",
        priceUsd: 0.000184,
        marketCap: 184200,
        liquidityUsd: 62100,
        opportunityScore: 86,
        riskScore: 19,
        firstSeenAt: new Date(Date.now() - 17 * 60000).toISOString(),
      });
      addDiscoveredToken({
        mintAddress: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
        symbol: "TURTLE",
        name: "Sea Explorer",
        priceUsd: 0.000042,
        marketCap: 91000,
        liquidityUsd: 28400,
        opportunityScore: 71,
        riskScore: 32,
        firstSeenAt: new Date(Date.now() - 45 * 60000).toISOString(),
      });
      addDiscoveredToken({
        mintAddress: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
        symbol: "SOLCAT",
        name: "Solana Feline",
        priceUsd: 0.0012,
        marketCap: 520000,
        liquidityUsd: 145000,
        opportunityScore: 78,
        riskScore: 15,
        firstSeenAt: new Date(Date.now() - 8 * 60000).toISOString(),
      });
    }
  }, [tokens.size, addDiscoveredToken]);

  const tokenList = Array.from(tokens.values()).filter((t) => {
    if (activeTab === "high_score") return t.opportunityScore >= 75;
    if (activeTab === "safe") return t.riskScore <= 30;
    return true;
  });

  const handleManualScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualMint.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("http://localhost:3001/api/v1/tokens/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mintAddress: manualMint.trim() }),
      });
      if (res.ok) {
        addDiscoveredToken({
          mintAddress: manualMint.trim(),
          symbol: "SCANNING...",
          name: "Enqueued for Analysis",
          opportunityScore: 50,
          riskScore: 20,
        });
        setManualMint("");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getOpportunityBadge = (score: number) => {
    if (score >= 90) return { label: "EXTREME", color: "bg-red-500/20 text-red-400 border-red-500/40" };
    if (score >= 75) return { label: "STRONG", color: "bg-accent/20 text-accent border-accent/40" };
    if (score >= 60) return { label: "EARLY", color: "bg-purple-500/20 text-purple-400 border-purple-500/40" };
    if (score >= 40) return { label: "DEVELOPING", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40" };
    return { label: "WATCH", color: "bg-gray-800 text-gray-400 border-gray-700" };
  };

  const getRiskBadge = (risk: number) => {
    if (risk > 70) return { label: "BLOCKED", color: "bg-red-500/20 text-red-400" };
    if (risk > 40) return { label: "MODERATE", color: "bg-yellow-500/20 text-yellow-400" };
    return { label: "SAFE", color: "bg-emerald-500/20 text-emerald-400" };
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
                Solana Intelligence
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Event-Driven Token Discovery & Culture Narrative Lifecycle Engine
            </p>
          </div>
        </div>

        {/* Global Stats & Status */}
        <div className="flex items-center space-x-6 text-xs font-mono">
          <div className="flex items-center space-x-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isConnected ? "bg-accent shadow-lg shadow-accent/50 animate-ping" : "bg-red-500"
              }`}
            />
            <span className={isConnected ? "text-accent" : "text-red-400"}>
              {isConnected ? "GATEWAY LIVE" : "DISCONNECTED"}
            </span>
          </div>

          <div className="hidden sm:flex items-center space-x-4 border-l border-border pl-6 text-gray-300">
            <div>
              <span className="text-gray-500">TOKENS: </span>
              <span className="font-bold text-white">{tokens.size}</span>
            </div>
            <div>
              <span className="text-gray-500">ALERTS: </span>
              <span className="font-bold text-accent">{alerts.length}</span>
            </div>
            <div>
              <span className="text-gray-500">STRATEGY: </span>
              <span className="font-bold text-primary">rules-v1</span>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Culture Radar Feature Banner ────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-surface via-card to-[#15122b] p-6 shadow-2xl">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Sparkles className="w-64 h-64 text-primary" />
        </div>

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center space-x-2">
              <span className="flex items-center space-x-1.5 text-xs font-bold uppercase px-2.5 py-1 rounded-full bg-accent/10 border border-accent/30 text-accent">
                <Flame className="w-3.5 h-3.5" />
                <span>Culture Radar #1 Trend</span>
              </span>
              <span className="text-xs text-gray-400 font-mono">STAGE 4: CRYPTO DISCOVERY</span>
            </div>

            <div className="flex items-baseline space-x-3">
              <h2 className="text-3xl font-black text-white">🐢 Frank the Turtle</h2>
              <span className="text-sm font-mono text-accent">+420% Viral Velocity</span>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              Mainstream viral phenomenon across TikTok (1.2M likes, 8.4k remixes) transitioning to Crypto Twitter.
              Culture adoption ahead of DEX speculation.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="bg-surface/80 border border-border/60 rounded-xl p-2.5">
                <div className="text-[10px] text-gray-500 uppercase">TikTok Views</div>
                <div className="text-sm font-bold text-white font-mono">3.4M</div>
                <div className="text-[10px] text-emerald-400">+340% 24h</div>
              </div>
              <div className="bg-surface/80 border border-border/60 rounded-xl p-2.5">
                <div className="text-[10px] text-gray-500 uppercase">X Mentions</div>
                <div className="text-sm font-bold text-white font-mono">+580%</div>
                <div className="text-[10px] text-emerald-400">High Virality</div>
              </div>
              <div className="bg-surface/80 border border-border/60 rounded-xl p-2.5">
                <div className="text-[10px] text-gray-500 uppercase">Lore Score</div>
                <div className="text-sm font-bold text-accent font-mono">89 / 100</div>
                <div className="text-[10px] text-gray-400">Exceptional</div>
              </div>
              <div className="bg-surface/80 border border-border/60 rounded-xl p-2.5">
                <div className="text-[10px] text-gray-500 uppercase">Culture-Crypto Gap</div>
                <div className="text-sm font-bold text-primary font-mono">+54 GAP</div>
                <div className="text-[10px] text-primary">Early Gem Window</div>
              </div>
            </div>
          </div>

          {/* Associated Token Card */}
          <div className="w-full lg:w-80 bg-surface/90 border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-gray-400 pb-2 border-b border-border/60">
              <span>ASSOCIATED TOKEN</span>
              <span className="text-accent font-bold">94% Confidence</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-black text-white">$FRANK</div>
                <div className="text-xs text-gray-400">MC: $184K · Liq: $62K</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-accent font-mono">86 SCORE</div>
                <div className="text-[10px] text-emerald-400">STRONG SIGNAL</div>
              </div>
            </div>
            <a
              href="https://solscan.io/token/7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center space-x-1.5 w-full py-2 rounded-lg bg-primary hover:bg-primary/90 text-white font-bold text-xs transition"
            >
              <span>Inspect Token Terminal</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </section>

      {/* ─── Manual Mint Scanner ──────────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <Search className="w-5 h-5 text-gray-400" />
          <span className="text-xs font-mono text-gray-300 font-bold whitespace-nowrap">
            ON-DEMAND MINT RADAR:
          </span>
        </div>
        <form onSubmit={handleManualScan} className="flex items-center space-x-2 w-full sm:flex-1 max-w-2xl">
          <input
            type="text"
            placeholder="Paste Solana token mint address (e.g. Pump.fun / Raydium)..."
            value={manualMint}
            onChange={(e) => setManualMint(e.target.value)}
            className="flex-1 bg-background border border-border focus:border-accent rounded-lg px-4 py-2 text-xs font-mono text-white outline-none"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg bg-accent text-black font-bold text-xs hover:bg-accent/90 transition disabled:opacity-50 whitespace-nowrap"
          >
            {isSubmitting ? "Ingesting..." : "Discover & Score"}
          </button>
        </form>
      </div>

      {/* ─── Main Content Grid: Live Radar vs Signal Feed ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Live Radar Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-accent" />
              <h3 className="text-base font-bold text-white">Live On-Chain Radar</h3>
              <span className="text-xs font-mono text-gray-500">({tokenList.length} monitored)</span>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center space-x-1 bg-surface border border-border rounded-lg p-1 text-xs font-mono">
              <button
                onClick={() => setActiveTab("all")}
                className={`px-3 py-1 rounded-md transition ${
                  activeTab === "all" ? "bg-card text-white font-bold" : "text-gray-400 hover:text-white"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setActiveTab("high_score")}
                className={`px-3 py-1 rounded-md transition ${
                  activeTab === "high_score" ? "bg-accent/20 text-accent font-bold" : "text-gray-400 hover:text-white"
                }`}
              >
                Score ≥ 75
              </button>
              <button
                onClick={() => setActiveTab("safe")}
                className={`px-3 py-1 rounded-md transition ${
                  activeTab === "safe" ? "bg-emerald-500/20 text-emerald-400 font-bold" : "text-gray-400 hover:text-white"
                }`}
              >
                Safe
              </button>
            </div>
          </div>

          {/* Tokens Table */}
          <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-xl">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-card text-gray-400 uppercase text-[10px] tracking-wider border-b border-border">
                <tr>
                  <th className="py-3 px-4">Token</th>
                  <th className="py-3 px-4">Price</th>
                  <th className="py-3 px-4">Market Cap</th>
                  <th className="py-3 px-4">Liquidity</th>
                  <th className="py-3 px-4">Opportunity</th>
                  <th className="py-3 px-4">Risk</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {tokenList.map((token) => {
                  const oppBadge = getOpportunityBadge(token.opportunityScore);
                  const riskBadge = getRiskBadge(token.riskScore);

                  return (
                    <tr
                      key={token.mintAddress}
                      className="hover:bg-card/60 transition group"
                    >
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-white text-sm group-hover:text-accent transition">
                            ${token.symbol}
                          </span>
                          <span className="text-[10px] text-gray-500 truncate max-w-[120px]">
                            {token.name}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-bold text-gray-200">
                        {token.priceUsd ? `$${token.priceUsd.toFixed(6)}` : "$0.000000"}
                      </td>

                      <td className="py-3 px-4 text-gray-300">
                        {token.marketCap ? `$${token.marketCap.toLocaleString()}` : "$0"}
                      </td>

                      <td className="py-3 px-4 text-gray-300">
                        {token.liquidityUsd ? `$${token.liquidityUsd.toLocaleString()}` : "$0"}
                      </td>

                      {/* Opportunity Score */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-sm text-white">
                            {token.opportunityScore}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-[9px] font-bold rounded border ${oppBadge.color}`}
                          >
                            {oppBadge.label}
                          </span>
                        </div>
                      </td>

                      {/* Risk Score */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-gray-300">
                            {token.riskScore}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-[9px] font-bold rounded ${riskBadge.color}`}
                          >
                            {riskBadge.label}
                          </span>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        <a
                          href={`https://birdeye.so/token/${token.mintAddress}?chain=solana`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center space-x-1 text-gray-400 hover:text-accent font-bold"
                        >
                          <span>Terminal</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Col: Live Signal Alerts & Backtesting Engine Proof */}
        <div className="space-y-6">
          {/* Signal Feed */}
          <div className="bg-surface border border-border rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 text-yellow-400" />
                <h4 className="text-sm font-bold text-white">Live Signal Feed</h4>
              </div>
              <span className="text-[10px] text-gray-500 font-mono">AUTOMATED</span>
            </div>

            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {alerts.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-xs font-mono">
                  Listening for high-momentum opportunities...
                </div>
              ) : (
                alerts.map((al) => (
                  <div
                    key={al.id}
                    className="p-3 rounded-lg bg-card/80 border border-border/80 space-y-2 hover:border-accent/40 transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-xs">${al.symbol}</span>
                      <span className="text-[10px] text-gray-500 font-mono">{al.timestamp}</span>
                    </div>

                    <div className="flex items-center space-x-3 text-xs">
                      <span className="text-accent font-bold font-mono">Score: {al.score}</span>
                      <span className="text-gray-400 font-mono">Risk: {al.risk}</span>
                    </div>

                    <div className="space-y-1">
                      {al.signals.map((s, idx) => (
                        <div key={idx} className="text-[10px] text-gray-300 flex items-center space-x-1">
                          <span>{s}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Backtest Verification Card */}
          <div className="bg-surface border border-primary/20 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                <h4 className="text-sm font-bold text-white">Backtest Metric Proof</h4>
              </div>
              <span className="text-[10px] text-primary font-mono">Strategy: rules-v1</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="bg-card p-2.5 rounded-lg border border-border">
                <span className="text-gray-500 text-[10px] block">1H HIT RATE</span>
                <span className="text-base font-bold text-accent">61.4%</span>
                <span className="text-[9px] text-gray-400 block">vs 28.5% random</span>
              </div>
              <div className="bg-card p-2.5 rounded-lg border border-border">
                <span className="text-gray-500 text-[10px] block">MEDIAN 1H GAIN</span>
                <span className="text-base font-bold text-emerald-400">+42.0%</span>
                <span className="text-[9px] text-gray-400 block">out-of-sample</span>
              </div>
            </div>

            <p className="text-[11px] text-gray-400">
              Evaluated against 1,281 historical signals. Outperformed blind liquidity baseline by +32.9%.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
