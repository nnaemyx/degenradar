export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3.5">
      <div aria-hidden="true" className="relative grid h-10 w-10 shrink-0 place-items-center rounded-[11px] border border-white/10 bg-raised">
        <span className="absolute left-2 top-2 h-[7px] w-[7px] border-l-2 border-t-2 border-accent" />
        <span className="absolute right-2 top-2 h-[7px] w-[7px] border-r-2 border-t-2 border-accent" />
        <span className="absolute bottom-2 left-2 h-[7px] w-[7px] border-b-2 border-l-2 border-secondary" />
        <span className="absolute bottom-2 right-2 h-[7px] w-[7px] border-b-2 border-r-2 border-secondary" />
        <span className="h-[5px] w-[5px] rounded-full bg-accent" />
        <span className="absolute right-[5px] top-1/2 h-px w-[5px] -translate-y-1/2 bg-accent/70" />
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline gap-1.5 leading-none">
          <span className="font-brand text-[18px] font-bold tracking-[-0.055em] text-white">DEGEN</span>
          <span className="font-brand text-[18px] font-bold tracking-[-0.055em] text-accent">RADAR</span>
          <span className="ml-1 hidden rounded border border-white/10 px-1.5 py-0.5 font-data text-[9px] font-medium tracking-[0.1em] text-muted sm:inline">SOLANA</span>
        </div>
        {!compact && <div className="mt-1 font-data text-[9px] tracking-[0.13em] text-muted">TOKEN INTELLIGENCE</div>}
      </div>
    </div>
  );
}
