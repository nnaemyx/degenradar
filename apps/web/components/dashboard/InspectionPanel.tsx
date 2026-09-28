import { ArrowUpRight, Copy, ExternalLink, Info, ShieldAlert } from "lucide-react";
import type { LiveAlertItem, LiveTokenItem } from "@/lib/store";
import { formatPrice, formatUsd, getOpportunityState, getRiskState, shortAddress, toneClasses } from "@/lib/radar";

interface InspectionPanelProps {
  token: LiveTokenItem | null;
  alerts: LiveAlertItem[];
  copiedMint: string | null;
  onCopy: (mint: string) => void;
}

function ScoreBar({ label, value, explanation, isRisk = false }: { label: string; value: number | null; explanation: string; isRisk?: boolean }) {
  const state = isRisk ? getRiskState(value) : getOpportunityState(value);
  const colors = toneClasses[state.tone];
  return (
    <div className="py-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-data text-[9px] tracking-[0.09em] text-muted">{label}</span>
        <span className={`font-data text-[11px] font-semibold tabular-nums ${value === null ? "text-muted" : colors.text}`}>{value === null ? "Not scored" : `${value} / 100`}</span>
      </div>
      <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-white/[0.08]">
        {value !== null && <div className={`h-full rounded-full ${colors.bar}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />}
      </div>
      <div className="mt-1.5 flex items-start justify-between gap-2 font-data text-[9px]">
        <span className={value === null ? "text-muted" : colors.text}>{value === null ? "Awaiting evaluation" : state.label}</span>
        <span className="text-right text-muted">{explanation}</span>
      </div>
    </div>
  );
}

export function InspectionPanel({ token, alerts, copiedMint, onCopy }: InspectionPanelProps) {
  if (!token) {
    return (
      <section aria-labelledby="inspection-heading" className="overflow-hidden rounded-xl border border-white/[0.10] bg-surface">
        <div className="border-b border-white/[0.08] px-4 py-3">
          <h2 id="inspection-heading" className="font-data text-[9px] font-medium tracking-[0.13em] text-slate-400">TOKEN INSPECTION</h2>
        </div>
        <div className="flex min-h-[248px] flex-col items-center justify-center px-6 py-9 text-center">
          <div aria-hidden="true" className="relative mb-4 grid h-11 w-11 place-items-center rounded-lg border border-white/[0.09] bg-raised">
            <span className="absolute left-2 top-2 h-2 w-2 border-l border-t border-accent" />
            <span className="absolute right-2 top-2 h-2 w-2 border-r border-t border-secondary" />
            <span className="absolute bottom-2 left-2 h-2 w-2 border-b border-l border-secondary" />
            <span className="absolute bottom-2 right-2 h-2 w-2 border-b border-r border-accent" />
            <span className="h-1 w-1 rounded-full bg-accent" />
          </div>
          <h3 className="text-[13px] font-semibold text-white">Select a token to inspect</h3>
          <p className="mt-1 max-w-[240px] text-[12px] leading-relaxed text-muted">Choose a row from the radar to compare its evaluation, market figures and related events.</p>
        </div>
      </section>
    );
  }

  const opportunity = getOpportunityState(token.opportunityScore);
  const risk = getRiskState(token.riskScore);
  const tokenAlerts = alerts.filter((alert) => alert.mintAddress === token.mintAddress).slice(0, 3);

  return (
    <section aria-labelledby="inspection-heading" className="overflow-hidden rounded-xl border border-white/[0.10] bg-surface">
      <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
        <h2 id="inspection-heading" className="font-data text-[9px] font-medium tracking-[0.13em] text-slate-400">TOKEN INSPECTION</h2>
        <span className="font-data text-[9px] text-muted">SELECTED</span>
      </div>

      <div className="px-4 pt-4">
        <div className="flex min-w-0 items-center gap-3">
          <div aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] font-data text-[12px] font-semibold text-slate-200">{token.symbol.slice(0, 1) || "?"}</div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-brand text-[18px] font-semibold tracking-[-0.04em] text-white">${token.symbol || "TOKEN"}</h3>
            <p className="truncate text-[11px] text-slate-400">{token.name || "Solana token"} · Solana</p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 border-b border-white/[0.07] pb-3">
          <span className="min-w-0 truncate font-data text-[9px] text-muted" title={token.mintAddress}>{shortAddress(token.mintAddress)}</span>
          <button type="button" onClick={() => onCopy(token.mintAddress)} className="flex min-h-9 shrink-0 items-center gap-1.5 rounded px-2 font-data text-[9px] text-slate-400 transition hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label={`Copy ${token.symbol} mint address`}>
            <Copy className="h-3 w-3" />{copiedMint === token.mintAddress ? "Copied" : "Copy address"}
          </button>
        </div>

        <div className="divide-y divide-white/[0.07]">
          <ScoreBar label="OPPORTUNITY" value={token.opportunityScore} explanation={token.opportunityScore === null ? "No evaluation available" : `Threshold ≥55 · ${opportunity.label}`} />
          <ScoreBar label="RISK" value={token.riskScore} explanation={token.riskScore === null ? "Risk is unknown" : "Lower is better"} isRisk />
        </div>

        {token.riskScore !== null && token.riskScore > 70 && (
          <div className="mb-3 flex items-start gap-2 rounded-md border border-risk-high/20 bg-risk-high/[0.05] px-3 py-2.5 text-[11px] leading-relaxed text-slate-300">
            <ShieldAlert aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-risk-high" />
            <span>Elevated risk score. This automated indicator is not a contract audit or a guarantee of safety.</span>
          </div>
        )}

        <div className="grid grid-cols-2 border-t border-white/[0.07] py-3.5">
          <MarketMetric label="PRICE · USD" value={formatPrice(token.priceUsd)} className="border-r border-white/[0.07] pr-3" />
          <MarketMetric label="MARKET CAP" value={formatUsd(token.marketCap)} className="pl-3" />
        </div>
        <div className="grid grid-cols-2 border-t border-white/[0.07] py-3.5">
          <MarketMetric label="LIQUIDITY" value={formatUsd(token.liquidityUsd)} className="border-r border-white/[0.07] pr-3" />
          <MarketMetric
            label="EVALUATION"
            value={token.opportunityScore === null && token.riskScore === null ? "Pending" : token.opportunityScore === null ? "Opportunity pending" : token.riskScore === null ? "Risk pending" : "Scores available"}
            className="pl-3"
          />
        </div>

        <div className="border-t border-white/[0.07] py-3">
          <div className="flex items-start gap-2 font-data text-[9px] leading-relaxed text-muted">
            <Info aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0" />
            <span>Market enrichment does not certify a token&apos;s on-chain safety. Figures may be unavailable.</span>
          </div>
        </div>

        <div className="border-t border-white/[0.07] py-3.5">
          <a href={`https://jup.ag/swap/SOL-${token.mintAddress}`} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent text-[11px] font-semibold text-[#07120e] transition hover:bg-[#25f0ae] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-surface">
            Open in Jupiter <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
          </a>
          <div className="mt-2 grid grid-cols-2 gap-2 font-data text-[9px]">
            <a href={`https://dexscreener.com/solana/${token.mintAddress}`} target="_blank" rel="noopener noreferrer" className="flex min-h-10 items-center justify-center gap-1 rounded border border-white/[0.08] text-slate-400 transition hover:border-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">View on DexScreener <ExternalLink aria-hidden="true" className="h-3 w-3 shrink-0" /></a>
            <a href={`https://solscan.io/token/${token.mintAddress}`} target="_blank" rel="noopener noreferrer" className="flex min-h-10 items-center justify-center gap-1 rounded border border-white/[0.08] text-slate-400 transition hover:border-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">Verify on Solscan <ExternalLink aria-hidden="true" className="h-3 w-3 shrink-0" /></a>
          </div>
        </div>
      </div>

      <div className="border-t border-white/[0.08] bg-[#0b0f14]">
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="text-[11px] font-semibold text-slate-200">Related alerts</h3>
          <span className="font-data text-[9px] text-muted">{tokenAlerts.length}</span>
        </div>
        {tokenAlerts.length > 0 ? tokenAlerts.map((alert) => (
          <div key={alert.id} className="border-t border-white/[0.055] px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <span className="text-[11px] font-medium text-slate-200">Alert received</span>
              <span className="shrink-0 font-data text-[9px] text-muted">{alert.timestamp}</span>
            </div>
            <p className="mt-1 font-data text-[9px] leading-relaxed text-muted">{alert.signals.length ? alert.signals.join(" · ") : "No alert details supplied"}</p>
            <p className="mt-1 font-data text-[9px] text-slate-400">Opportunity {alert.score === null ? "—" : `${alert.score}/100`} · Risk {alert.risk === null ? "—" : `${alert.risk}/100`}</p>
          </div>
        )) : (
          <p className="border-t border-white/[0.055] px-4 py-3 font-data text-[10px] leading-relaxed text-muted">No alerts for this token in the current session.</p>
        )}
      </div>
    </section>
  );
}

function MarketMetric({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <div className="font-data text-[9px] text-muted">{label}</div>
      <div className={`mt-1 font-data text-[13px] font-medium tabular-nums ${value === "—" ? "text-muted" : "text-slate-100"}`}>{value}</div>
    </div>
  );
}
