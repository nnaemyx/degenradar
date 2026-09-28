"use client";

import { LoaderCircle, ScanLine, Search, X } from "lucide-react";
import type { KeyboardEvent } from "react";

export type SearchFeedback = { kind: "info" | "success" | "error"; message: string } | null;

interface MintSearchProps {
  value: string;
  onChange: (value: string) => void;
  isMint: boolean;
  isScanning: boolean;
  feedback: SearchFeedback;
  onClear: () => void;
  onScan: () => void;
  onEnter: () => void;
}

export function MintSearch({ value, onChange, isMint, isScanning, feedback, onClear, onScan, onEnter }: MintSearchProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && isMint) onEnter();
  };

  const feedbackTone = feedback?.kind === "error"
    ? "border-risk-high/25 bg-risk-high/[0.06] text-risk-high"
    : feedback?.kind === "success"
      ? "border-accent/20 bg-accent/[0.05] text-accent"
      : "border-white/[0.08] bg-white/[0.025] text-slate-300";

  return (
    <section aria-label="Search tokens" className="pt-5">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <label className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-lg border border-white/[0.12] bg-surface px-4 transition-colors focus-within:border-accent/50">
          <Search aria-hidden="true" className="h-[17px] w-[17px] shrink-0 text-muted" />
          <span className="sr-only">Search tokens or paste a Solana mint address</span>
          <input
            id="radar-search"
            type="text"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search tokens or paste a Solana mint address"
            autoComplete="off"
            spellCheck={false}
            aria-label="Search tokens or paste a Solana mint address"
            className="min-w-0 flex-1 bg-transparent py-3 font-brand text-[13px] text-white outline-none placeholder:text-muted"
          />
          {value && (
            <button
              type="button"
              onClick={onClear}
              aria-label="Clear search"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-muted transition hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {!value && <kbd className="hidden rounded border border-white/10 px-1.5 py-1 font-data text-[9px] text-muted md:inline">/</kbd>}
        </label>
        {isMint && (
          <button
            type="button"
            onClick={onScan}
            disabled={isScanning}
            className="flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-[12px] font-semibold text-[#07120e] transition hover:bg-[#25f0ae] active:scale-[0.99] disabled:cursor-wait disabled:opacity-70 sm:px-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {isScanning ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
            <span>{isScanning ? "Scanning mint…" : "Scan mint"}</span>
          </button>
        )}
      </div>
      <p className="mt-2 flex items-start gap-2 pl-1 font-data text-[10px] leading-relaxed text-muted">
        <span aria-hidden="true" className="mt-1 h-1 w-1 shrink-0 rounded-full bg-secondary" />
        Search filters the radar. A Solana mint address can be scanned on demand.
      </p>
      {feedback && (
        <div role={feedback.kind === "error" ? "alert" : "status"} aria-live={feedback.kind === "error" ? "assertive" : "polite"} className={`mt-3 rounded-md border px-3 py-2.5 text-[12px] ${feedbackTone}`}>
          {feedback.message}
        </div>
      )}
    </section>
  );
}
