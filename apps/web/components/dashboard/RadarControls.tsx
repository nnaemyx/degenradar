import { ArrowDownWideNarrow } from "lucide-react";
import type { RadarFilter, RadarSort } from "@/lib/radar";

const filters: { key: RadarFilter; label: string }[] = [
  { key: "all", label: "All tokens" },
  { key: "opportunity", label: "Opportunity ≥55" },
  { key: "market_cap", label: "Market cap ≥$100K" },
  { key: "lower_risk", label: "Lower risk ≤30" },
  { key: "micro_cap", label: "Micro cap <$100K" },
];

interface RadarControlsProps {
  activeFilter: RadarFilter;
  onFilterChange: (filter: RadarFilter) => void;
  sortBy: RadarSort;
  onSortChange: (sort: RadarSort) => void;
  totalTokens: number;
}

export function RadarControls({ activeFilter, onFilterChange, sortBy, onSortChange, totalTokens }: RadarControlsProps) {
  return (
    <section aria-label="Radar filters and sorting" className="mt-4 flex flex-col gap-3 border-b border-white/[0.08] pb-4 lg:flex-row lg:items-center lg:justify-between">
      <div role="group" aria-label="Filter tokens" className="flex flex-wrap items-center gap-1.5">
        {filters.map((filter) => {
          const selected = activeFilter === filter.key;
          return (
            <button
              key={filter.key}
              type="button"
              aria-pressed={selected}
              onClick={() => onFilterChange(filter.key)}
              className={`min-h-10 rounded-md px-3 py-2 text-left text-[11px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${selected ? "bg-[#18221f] font-semibold text-[#8ff3ce] ring-1 ring-inset ring-accent/20" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"}`}
            >
              {filter.label}
              {filter.key === "all" && <span className="ml-1.5 font-data text-[10px] text-[#8ff3ce]/70">{totalTokens}</span>}
            </button>
          );
        })}
      </div>
      <label className="flex w-full items-center gap-2 font-data text-[10px] text-slate-400 lg:w-auto">
        <ArrowDownWideNarrow aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted" />
        <span className="shrink-0">Sort by</span>
        <select
          value={sortBy}
          onChange={(event) => onSortChange(event.target.value as RadarSort)}
          className="min-h-10 min-w-0 flex-1 rounded-md border border-white/[0.09] bg-surface px-3 py-2 font-data text-[10px] text-slate-200 outline-none transition hover:border-white/20 focus-visible:ring-2 focus-visible:ring-accent lg:w-[190px] lg:flex-none"
        >
          <option value="score">Opportunity score</option>
          <option value="market_cap">Market cap (highest)</option>
          <option value="price">Price (highest)</option>
          <option value="newest">Recently discovered</option>
        </select>
      </label>
    </section>
  );
}
