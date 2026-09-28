import { Activity, CircleDot, ShieldAlert, Sparkles } from "lucide-react";
import type { RadarEventItem } from "@/lib/radar";
import { formatEventTime } from "@/lib/radar";

interface EventFeedProps {
  events: RadarEventItem[];
  isConnected: boolean;
  onSelectToken: (mint: string) => void;
}

const eventMeta = {
  token_discovered: { label: "TOKEN DISCOVERED", Icon: Sparkles, color: "text-accent" },
  score_updated: { label: "SCORE UPDATED", Icon: Activity, color: "text-secondary" },
  alert_received: { label: "ALERT RECEIVED", Icon: ShieldAlert, color: "text-caution" },
};

export function EventFeed({ events, isConnected, onSelectToken }: EventFeedProps) {
  return (
    <section aria-labelledby="events-heading" className="overflow-hidden rounded-xl border border-white/[0.10] bg-surface">
      <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
        <div>
          <h2 id="events-heading" className="text-[12px] font-semibold text-white">Recent events</h2>
          <p className="mt-0.5 font-data text-[9px] text-muted">Updates observed in this session</p>
        </div>
        <span className="font-data text-[9px] text-muted">{events.length}</span>
      </div>
      {events.length ? (
        <ol className="max-h-[360px] divide-y divide-white/[0.055] overflow-y-auto">
          {events.map((event) => {
            const meta = eventMeta[event.type];
            const Icon = meta.Icon;
            return (
              <li key={event.id}>
                <button type="button" onClick={() => onSelectToken(event.mintAddress)} className="flex min-h-[68px] w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent">
                  <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded border border-white/[0.08] bg-raised ${meta.color}`}><Icon aria-hidden="true" className="h-3.5 w-3.5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-data text-[9px] tracking-[0.06em] text-muted">{meta.label}</span>
                      <time dateTime={event.timestamp} className="shrink-0 font-data text-[9px] text-muted">{formatEventTime(event.timestamp)}</time>
                    </span>
                    <span className="mt-1 block truncate text-[11px] font-medium text-slate-200">${event.symbol}</span>
                    <span className="mt-0.5 block truncate font-data text-[9px] leading-relaxed text-slate-400">{event.type === "token_discovered" ? "Token added to radar" : event.type === "score_updated" ? `Opportunity ${event.opportunityScore === null ? "—" : `${event.opportunityScore}/100`} · Risk ${event.riskScore === null ? "—" : `${event.riskScore}/100`}` : event.signals.length ? event.signals.join(" · ") : "Alert received"}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="flex min-h-[118px] items-center gap-3 px-4 py-6">
          <CircleDot aria-hidden="true" className="h-4 w-4 shrink-0 text-muted" />
          <p className="text-[11px] leading-relaxed text-muted">{isConnected ? "Waiting for the first token update." : "Updates are disconnected. Reconnecting…"}</p>
        </div>
      )}
      <div className="border-t border-white/[0.07] px-4 py-2.5 font-data text-[9px] text-muted">Alerts record observed events; they are not trade recommendations.</div>
    </section>
  );
}
