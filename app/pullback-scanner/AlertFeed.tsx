"use client";

// The alert strip.
//
// Polled with `?since=<the newest event already held>`, which is deliberately subscription-free:
// the backend ring is bounded and in-process, so a client that has been away for ten minutes asks
// for ten minutes and gets exactly the events it missed. There is nothing to lose across a page
// navigation, a hot reload or a backend restart, and no socket to reconnect.
//
// WHY THE STRIP EXISTS SEPARATELY FROM THE TABLE. The table answers "what is set up right now" and
// is a state; the alerts answer "what just changed" and are events. A row that has been at the zone
// for six bars looks identical in the table on every poll, and the one thing worth knowing about it
// — that it ARRIVED there four minutes ago — is not visible in a state at all.
//
// The most useful event is `freshPullback`, and it is the earliest: it fires when price reaches the
// band, before the confirmation candle, which is the only point at which there is time to look at
// the chart before the entry is gone.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ALERT_LABEL, alertClass, istClock, TIMEFRAME_LABEL,
  type AlertEvent, type AlertFeed as Feed, type AlertKind,
} from "@/lib/pullback";

/** Alerts are events, so they are polled faster than the board's state. */
const POLL_MS = 15_000;
/** Kept in the strip. The backend ring holds far more; this is what fits on screen. */
const KEEP = 40;

export default function AlertFeed() {
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState<Set<string>>(new Set());
  // Read through a ref so the poll can use the newest cursor without the effect depending on it —
  // depending on state here would tear down and recreate the interval on every arriving event.
  const since = useRef(0);

  useEffect(() => {
    let alive = true;

    async function poll() {
      try {
        const url = since.current ? `/api/pullback/alerts?since=${since.current}` : "/api/pullback/alerts";
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok || !alive) return;
        const j = (await res.json()) as { data?: Feed };
        if (!alive || !j?.data) return;

        setError(null);
        const fresh = j.data.events;
        if (!fresh.length) return;
        since.current = Math.max(since.current, ...fresh.map((e) => e.at));
        // Newest first, deduplicated on id: the cursor is exclusive, but a restart resets the
        // backend ring and the same event can arrive twice with a new id ordering.
        setEvents((prev) => {
          const seen = new Set(prev.map((e) => e.id));
          return [...fresh.filter((e) => !seen.has(e.id)), ...prev].slice(0, KEEP);
        });
      } catch (e) {
        if (alive) setError(String((e as Error).message));
      }
    }

    void poll();
    const id = setInterval(poll, POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // `Array.from` rather than spreading the Set: this app's tsconfig has no `target`, so iterating a
  // Set needs `downlevelIteration` — and changing a shared compiler option for one dedupe is a
  // worse trade than one call.
  const kinds = useMemo<AlertKind[]>(() => Array.from(new Set(events.map((e) => e.kind))), [events]);
  const shown = events.filter((e) => !muted.has(e.kind));

  const toggle = (kind: string) =>
    setMuted((m) => {
      const next = new Set(m);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });

  return (
    <section className="panel p-4 mb-4">
      <div className="flex items-baseline gap-3 mb-3 flex-wrap">
        <h2 className="text-[15px] font-bold">Alerts</h2>
        <span className="text-[12px] text-muted">
          fresh pullbacks, resumed trends, EMA rejections, targets and stops — newest first
        </span>
        {kinds.length > 1 && (
          <div className="ml-auto flex items-center gap-1.5 flex-wrap">
            {kinds.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => toggle(k)}
                className={`rounded-full border px-2 py-[3px] text-[11px] font-bold transition-opacity ${alertClass(k)} ${
                  muted.has(k) ? "opacity-35" : ""
                }`}
                title={muted.has(k) ? "Show these again" : "Hide these"}
              >
                {ALERT_LABEL[k]}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-[12.5px] text-amber-300/90 mb-2">The alert feed is not answering: {error}</p>}

      {shown.length === 0 ? (
        // An empty feed is the normal state for much of the day and says so, because a blank strip
        // reads as "still loading" and someone waiting for an alert that is not coming will act on
        // something worse instead.
        <p className="text-[13px] text-muted">
          {events.length === 0
            ? "Nothing has fired yet. Alerts are events, not states — this fills as pullbacks arrive at the zone, turn, or fail."
            : "Every alert kind is hidden. Click a chip above to bring one back."}
        </p>
      ) : (
        <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto pr-1">
          {shown.map((e) => (
            <Link
              key={e.id}
              href={`/pullback-scanner/${encodeURIComponent(e.symbol)}?timeframe=${e.timeframe}`}
              className="flex items-start gap-3 rounded-lg border border-border bg-white/[0.02] px-3 py-2 hover:border-accent/60 transition-colors"
            >
              <span className="text-[11px] text-muted tabular-nums pt-[3px] shrink-0 w-[38px]">{istClock(e.at)}</span>
              <span
                className={`shrink-0 rounded-full border px-2 py-[2px] text-[10.5px] font-bold ${alertClass(e.kind)}`}
              >
                {ALERT_LABEL[e.kind]}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-[#e8e8ea]">{e.title}</span>
                <span className="block text-[11.5px] text-muted leading-[15px]">{e.detail}</span>
              </span>
              <span className="ml-auto shrink-0 text-[11px] text-muted tabular-nums pt-[3px]">
                {TIMEFRAME_LABEL[e.timeframe]}
                {e.score != null && <span className="text-[#c7d2dc]"> · {e.score.toFixed(0)}</span>}
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
