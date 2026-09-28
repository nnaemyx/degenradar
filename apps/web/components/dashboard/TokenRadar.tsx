import { Check, Copy, ExternalLink, Radio, Zap } from "lucide-react";
import type { LiveTokenItem } from "@/lib/store";
import { formatPrice, formatUsd, getOpportunityState, getRiskState, shortAddress, toneClasses } from "@/lib/radar";

interface TokenRadarProps {
  tokens: LiveTokenItem[];
  totalTokens: number;
  selectedMint: string | null;
  onSelect: (mint: string) => void;
  copiedMint: string | null;
  onCopy: (mint: string) => void;
  searchTerm: string;
  hasActiveFilters: boolean;
  isLoading: boolean;
  loadError: boolean;
  onRetry: () => void;
}

function ScoreCell({ value }: { value: number | null }) {
  const state = getOpportunityState(value);
  const colors = toneClasses[state.tone];
  return (
    <div className="text-right">
      <div className={`font-data text-[11px] font-semibold tabular-nums ${value === null ? "text-muted" : "text-white"}`}>
        {value === null ? "—" : value}<span className="text-muted">{value === null ? "" : "/100"}</span>
      </div>
      <div className="mt-1 flex justify-end"><span className={`rounded-sm px-1 py-[2px] font-data text-[8px] ${colors.bg} ${colors.text}`}>{state.label}</span></div>
    </div>
  );
}

function RiskCell({ value }: { value: number | null }) {
  const state = getRiskState(value);
  const colors = toneClasses[state.tone];
  return (
    <div className="text-right">
      <div className={`font-data text-[11px] font-semibold tabular-nums ${colors.text}`}>
        {value === null ? "—" : value}<span className="text-muted">{value === null ? "" : "/100"}</span>
      </div>
      <div className={`mt-1 font-data text-[8px] ${colors.text}`}>{state.label}</div>
    </div>
  );
}

function EmptyRadar({ searchTerm, hasActiveFilters, isLoading, loadError, onRetry }: Pick<TokenRadarProps, "searchTerm" | "hasActiveFilters" | "isLoading" | "loadError" | "onRetry">) {
  const title = isLoading
    ? "Loading monitored tokens"
    : loadError
      ? "Could not load tokens"
      : searchTerm
        ? "No tokens match this search"
        : hasActiveFilters
          ? "No tokens match these filters"
          : "Waiting for the first token update";
  const detail = isLoading
    ? "The radar will appear here as soon as token data is available."
    : loadError
      ? "The token service did not respond. You can retry the request."
      : searchTerm
        ? "Try another symbol or name, or paste a mint address to scan it."
        : hasActiveFilters
          ? "Try another filter or return to all tokens."
          : "New discoveries and score updates will appear here when received.";

  return (
    <div className="flex min-h-[190px] flex-col items-center justify-center px-5 py-9 text-center">
      <div className="mb-3 grid h-10 w-10 place-items-center rounded-lg border border-white/[0.08] bg-raised">
        {isLoading ? <Radio className="h-4 w-4 animate-pulse text-accent" /> : <Radio className="h-4 w-4 text-muted" />}
      </div>
      <h3 className="text-[13px] font-semibold text-slate-200">{title}</h3>
      <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-muted">{detail}</p>
      {loadError && <button type="button" onClick={onRetry} className="mt-4 min-h-10 rounded-md border border-white/10 px-3 font-data text-[10px] text-slate-200 transition hover:border-accent/40 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">Retry</button>}
    </div>
  );
}

export function TokenRadar(props: TokenRadarProps) {
  const { tokens, totalTokens, selectedMint, onSelect, copiedMint, onCopy, searchTerm, hasActiveFilters, isLoading, loadError, onRetry } = props;

  return (
    <section aria-labelledby="radar-title" className="min-w-0">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 id="radar-title" className="font-brand text-[18px] font-semibold tracking-[-0.035em] text-white">Token radar</h1>
            <span className="rounded border border-white/[0.08] px-1.5 py-0.5 font-data text-[9px] text-muted">{tokens.length} RESULTS</span>
          </div>
          <p className="mt-1 font-data text-[10px] text-muted">Compare opportunity, risk and market context</p>
        </div>
        <div className="hidden items-center gap-1.5 pb-0.5 font-data text-[9px] text-muted sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          <span>THRESHOLD</span>
          <span className="text-slate-300">≥55</span>
        </div>
      </div>

      {tokens.length === 0 ? (
        <div className="overflow-hidden rounded-xl border border-white/[0.10] bg-surface">
          <EmptyRadar searchTerm={searchTerm} hasActiveFilters={hasActiveFilters} isLoading={isLoading} loadError={loadError} onRetry={onRetry} />
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-white/[0.10] bg-surface md:block">
            <table className="w-full min-w-[700px] text-left">
              <caption className="sr-only">Sortable Solana token radar with market, opportunity and risk data</caption>
              <thead className="border-b border-white/[0.08] bg-raised font-data text-[9px] font-medium tracking-[0.045em] text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3">TOKEN</th>
                  <th scope="col" className="px-3 py-3 text-right">PRICE</th>
                  <th scope="col" className="px-3 py-3 text-right">MARKET CAP</th>
                  <th scope="col" className="hidden px-3 py-3 text-right lg:table-cell">LIQUIDITY</th>
                  <th scope="col" className="px-3 py-3 text-right">OPPORTUNITY</th>
                  <th scope="col" className="px-4 py-3 text-right">RISK</th>
                  <th scope="col" className="px-4 py-3 text-right">QUICK LINKS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.055]">
                {tokens.map((token) => {
                  const selected = selectedMint === token.mintAddress;
                  return (
                    <tr key={token.mintAddress} aria-selected={selected} className={`group transition-colors ${selected ? "bg-[#11191a]" : "hover:bg-white/[0.025]"}`}>
                      <th scope="row" className="relative px-4 py-3 text-left font-normal">
                        {selected && <span aria-hidden="true" className="absolute inset-y-1 left-0 w-[2px] bg-accent" />}
                        <button type="button" onClick={() => onSelect(token.mintAddress)} className="flex min-h-10 min-w-0 items-center gap-2.5 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-white/10 bg-white/[0.04] font-data text-[10px] font-semibold text-slate-200">{token.symbol.slice(0, 1) || "?"}</span>
                          <span className="min-w-0">
                            <span className="block truncate text-[12px] font-semibold text-white">${token.symbol || "TOKEN"}</span>
                            <span className="block truncate text-[10px] text-muted">{token.name || shortAddress(token.mintAddress)}</span>
                          </span>
                          {selected && <span className="ml-auto hidden rounded border border-accent/15 bg-accent/[0.05] px-1.5 py-1 font-data text-[8px] tracking-wide text-[#79dfb9] xl:inline">SELECTED</span>}
                        </button>
                      </th>
                      <td className="px-3 py-3 text-right font-data text-[10px] tabular-nums text-slate-300">{formatPrice(token.priceUsd)}</td>
                      <td className="px-3 py-3 text-right font-data text-[10px] tabular-nums text-slate-300">{formatUsd(token.marketCap)}</td>
                      <td className="hidden px-3 py-3 text-right font-data text-[10px] tabular-nums text-slate-400 lg:table-cell">{formatUsd(token.liquidityUsd)}</td>
                      <td className="px-3 py-3"><ScoreCell value={token.opportunityScore} /></td>
                      <td className="px-4 py-3"><RiskCell value={token.riskScore} /></td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <a href={`https://jup.ag/swap/SOL-${token.mintAddress}`} target="_blank" rel="noopener noreferrer" aria-label={`Open ${token.symbol} in Jupiter`} className="inline-flex min-h-9 items-center gap-1 rounded border border-accent/20 bg-accent/[0.06] px-2 text-[10px] font-semibold text-accent transition hover:bg-accent hover:text-[#07120e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                            <Zap aria-hidden="true" className="h-3 w-3" />Open
                          </a>
                          <a href={`https://dexscreener.com/solana/${token.mintAddress}`} target="_blank" rel="noopener noreferrer" aria-label={`View ${token.symbol} on DexScreener`} className="grid h-9 w-9 place-items-center rounded border border-white/[0.08] text-muted transition hover:border-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                            <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-white/[0.07] bg-[#0b0f14]">
                  <td colSpan={7} className="px-4 py-3 font-data text-[9px] text-muted">Showing {tokens.length} of {totalTokens} monitored {totalTokens === 1 ? "token" : "tokens"}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <ul className="divide-y divide-white/[0.07] overflow-hidden rounded-xl border border-white/[0.10] bg-surface md:hidden" aria-label="Token radar results">
            {tokens.map((token) => {
              const selected = selectedMint === token.mintAddress;
              const opportunity = getOpportunityState(token.opportunityScore);
              const risk = getRiskState(token.riskScore);
              return (
                <li key={token.mintAddress} className={selected ? "bg-[#11191a]" : ""}>
                  <button type="button" onClick={() => onSelect(token.mintAddress)} aria-pressed={selected} className={`relative block min-h-[82px] w-full px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${selected ? "border-l-2 border-accent" : "border-l-2 border-transparent hover:bg-white/[0.025]"}`}>
                    <span className="flex min-w-0 items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-white/10 bg-white/[0.04] font-data text-[10px] font-semibold text-slate-200">{token.symbol.slice(0, 1) || "?"}</span>
                        <span className="min-w-0">
                          <span className="block truncate text-[12px] font-semibold text-white">${token.symbol || "TOKEN"}</span>
                          <span className="block truncate text-[10px] text-muted">{token.name || shortAddress(token.mintAddress)}</span>
                        </span>
                      </span>
                      <span className="shrink-0 text-right font-data text-[10px] text-slate-300">{formatPrice(token.priceUsd)}<span className="mt-1 block text-muted">{formatUsd(token.marketCap)} cap</span></span>
                    </span>
                    <span className="mt-3 grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-2 font-data text-[9px]">
                      <span className="flex min-w-0 items-center justify-between gap-1 text-muted"><span>OPPORTUNITY</span><span className={`truncate text-right ${toneClasses[opportunity.tone].text}`}>{token.opportunityScore === null ? "—" : `${token.opportunityScore} · ${opportunity.label}`}</span></span>
                      <span className="flex min-w-0 items-center justify-between gap-1 text-muted"><span>RISK</span><span className={`truncate text-right ${toneClasses[risk.tone].text}`}>{token.riskScore === null ? "—" : `${token.riskScore} · ${risk.label}`}</span></span>
                    </span>
                  </button>
                  <div className="flex justify-end px-3 pb-2">
                    <button type="button" onClick={() => onCopy(token.mintAddress)} aria-label={`Copy ${token.symbol} mint address`} className="inline-flex min-h-9 items-center gap-1.5 rounded px-2 text-[10px] text-muted transition hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                      {copiedMint === token.mintAddress ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedMint === token.mintAddress ? "Copied" : "Copy mint"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-data text-[9px] leading-relaxed text-muted">
        <span className="text-slate-400">Score key</span>
        <span><b className="font-medium text-accent">≥55</b> meets opportunity threshold</span>
        <span><b className="font-medium text-caution">31–70</b> moderate risk</span>
        <span><b className="font-medium text-risk-high">&gt;70</b> high risk · lower is better</span>
      </div>
    </section>
  );
}
