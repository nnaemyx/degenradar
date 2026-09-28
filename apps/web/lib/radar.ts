export const OPPORTUNITY_THRESHOLD = 55;

export type RadarFilter = "all" | "opportunity" | "market_cap" | "lower_risk" | "micro_cap";
export type RadarSort = "score" | "market_cap" | "price" | "newest";
export type RadarEventType = "token_discovered" | "score_updated" | "alert_received";
export type ScoreTone = "positive" | "caution" | "danger" | "muted";

export interface RadarEventItem {
  id: string;
  type: RadarEventType;
  mintAddress: string;
  symbol: string;
  timestamp: string;
  opportunityScore: number | null;
  riskScore: number | null;
  signals: string[];
}

export function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (value >= 1) return `$${value.toFixed(2)}`;
  return `$${value.toLocaleString("en-US", { maximumSignificantDigits: 8, useGrouping: false })}`;
}

export function shortAddress(address: string): string {
  if (address.length < 12) return address;
  return `${address.slice(0, 5)}…${address.slice(-5)}`;
}

export function getOpportunityState(score: number | null | undefined): { label: string; tone: ScoreTone; meetsThreshold: boolean } {
  if (score === null || score === undefined || !Number.isFinite(score)) {
    return { label: "Not scored", tone: "muted", meetsThreshold: false };
  }
  if (score >= OPPORTUNITY_THRESHOLD) {
    return { label: "Meets threshold", tone: "positive", meetsThreshold: true };
  }
  return { label: "Below 55", tone: "muted", meetsThreshold: false };
}

export function getRiskState(score: number | null | undefined): { label: string; tone: ScoreTone } {
  if (score === null || score === undefined || !Number.isFinite(score)) {
    return { label: "Unknown", tone: "muted" };
  }
  if (score > 70) return { label: "High risk", tone: "danger" };
  if (score > 30) return { label: "Moderate risk", tone: "caution" };
  return { label: "Lower observed risk", tone: "positive" };
}

export function formatEventTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(date);
}

export const toneClasses: Record<ScoreTone, { text: string; bg: string; border: string; bar: string }> = {
  positive: {
    text: "text-accent",
    bg: "bg-accent/10",
    border: "border-accent/20",
    bar: "bg-accent",
  },
  caution: {
    text: "text-caution",
    bg: "bg-caution/10",
    border: "border-caution/20",
    bar: "bg-caution",
  },
  danger: {
    text: "text-risk-high",
    bg: "bg-risk-high/10",
    border: "border-risk-high/20",
    bar: "bg-risk-high",
  },
  muted: {
    text: "text-muted",
    bg: "bg-white/[0.045]",
    border: "border-white/[0.08]",
    bar: "bg-muted",
  },
};
