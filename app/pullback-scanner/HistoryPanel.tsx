"use client";

// Signal history — what fired, and what happened to it. NOT CURRENTLY MOUNTED.
//
// Taken off the scanner page because it was not being read, not because anything broke. Nothing
// underneath it changed: `/api/pullback/history` still answers, the signal log is still written on
// every scan, outcomes are still settled on the live price, and the board's own "fired today" and
// win-rate counters still read from it. Only this panel is gone. Put it back by importing it in
// `PullbackClient.tsx` and rendering `<HistoryPanel />` — it takes no props.
//
// This is the panel that makes the rest of the board accountable. Every other view here is a
// forecast; this one is the record, and it is deliberately not filtered to the flattering subset:
// stopped-out signals sit in the same list as the winners, and an unresolved one shows as Open
// rather than being left out.
//
// THE WIN RATE IS NULL, NOT ZERO, UNTIL SOMETHING RESOLVES. A "0%" win rate on a morning where two
// signals are still running is a false statement about the strategy, and it is exactly the kind of
// number that gets screenshotted. The backend enforces the same rule.
//
// Outcomes are decided on TOUCH rather than on a bar close, because that is how the order would
// have filled — and when one poll interval contains both the stop and the target, it resolves as
// the stop. That assumption is stated on the row rather than hidden, since it is the one place the
// record could otherwise flatter itself.

import { useEffect, useState } from "react";
import Link from "next/link";
import { fmt } from "@/lib/format";
import {
  bandClass, istClock, OUTCOME_LABEL, outcomeClass, TIMEFRAME_LABEL,
  type HistoryFeed, type SignalRecord,
} from "@/lib/pullback";

/** Outcomes settle on the scan interval, so this is polled on the slow tick. */
const POLL_MS = 60_000;

/** Today in IST — the picker's default and its ceiling. */
const istToday = (): string =>
  new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);

function Row({ r }: { r: SignalRecord }) {
  const risk = Math.abs(r.entry - r.stop);
  return (
    <tr className="hover:bg-white/[0.03]">
      <td className="px-2 py-2 text-[11.5px] text-muted tabular-nums whitespace-nowrap">{istClock(r.firedAt)}</td>
      <td className="px-2 py-2">
        <Link
          href={`/pullback-scanner/${encodeURIComponent(r.symbol)}?timeframe=${r.timeframe}`}
          className="text-[13px] font-bold hover:underline"
        >
          {r.symbol}
        </Link>
        <div className="text-[10.5px] text-muted">{TIMEFRAME_LABEL[r.timeframe]}</div>
      </td>
      <td className="px-2 py-2">
        <span className={`text-[12px] font-bold ${r.direction === 1 ? "text-bull" : "text-bear"}`}>
          {r.direction === 1 ? "BUY" : "SELL"}
        </span>
      </td>
      <td className="px-2 py-2">
        <span className={`inline-block rounded-full border px-2 py-[2px] text-[10.5px] font-bold ${bandClass(r.band)}`}>
          {r.score.toFixed(0)}
        </span>
      </td>
      <td className="px-2 py-2 text-[12px] tabular-nums whitespace-nowrap">
        {fmt(r.entry)}
        <div className="text-[10.5px] text-muted">
          risk {risk.toFixed(2)}
        </div>
      </td>
      <td className="px-2 py-2 text-[12px] tabular-nums">
        {r.option ? (
          <>
            <span className="font-semibold">{r.option.label}</span>
            <div className="text-[10.5px] text-muted">₹{r.option.entryCost.toFixed(2)} · Δ{Math.abs(r.option.delta).toFixed(2)}</div>
          </>
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>
      <td className="px-2 py-2" title={r.outcome.note ?? undefined}>
        <span className={`text-[12px] font-bold ${outcomeClass(r.outcome.state)}`}>
          {OUTCOME_LABEL[r.outcome.state]}
          {r.outcome.note && <span className="text-amber-300"> ⚠</span>}
        </span>
        <div className="text-[10.5px] text-muted tabular-nums">
          {r.outcome.closedAt != null ? istClock(r.outcome.closedAt) : "running"}
        </div>
      </td>
      <td className="px-2 py-2 text-right">
        <span
          className={`text-[13px] font-bold tabular-nums ${
            r.outcome.r == null ? "text-muted" : r.outcome.r > 0 ? "text-bull" : "text-bear"
          }`}
        >
          {r.outcome.r == null ? "—" : `${r.outcome.r > 0 ? "+" : ""}${r.outcome.r.toFixed(2)}R`}
        </span>
      </td>
    </tr>
  );
}

export default function HistoryPanel() {
  const [day, setDay] = useState(istToday());
  const [feed, setFeed] = useState<HistoryFeed | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch(`/api/pullback/history?day=${day}`, { cache: "no-store" });
        if (!res.ok || !alive) return;
        const j = (await res.json()) as { data?: HistoryFeed };
        if (!alive || !j?.data) return;
        setFeed(j.data);
        setError(null);
      } catch (e) {
        if (alive) setError(String((e as Error).message));
      }
    }
    void load();
    const id = setInterval(load, POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, [day]);

  const s = feed?.summary;

  return (
    <section className="panel p-4">
      <div className="flex items-baseline gap-3 mb-3 flex-wrap">
        <h2 className="text-[15px] font-bold">Signal history</h2>
        <input
          type="date"
          value={day}
          max={istToday()}
          onChange={(e) => setDay(e.target.value)}
          className="bg-chip border border-border rounded-lg px-2 py-1 text-[12px] text-white outline-none"
        />
        {s && (
          <span className="text-[12px] text-muted ml-auto tabular-nums">
            {s.fired} fired · <span className="text-bull">{s.targetHit}</span> target ·{" "}
            <span className="text-bear">{s.stopHit}</span> stopped · {s.open} open
            {/* Null until something resolves. See the header comment. */}
            {s.winRatePct != null && <span className="text-[#c7d2dc]"> · {s.winRatePct.toFixed(0)}% hit</span>}
          </span>
        )}
      </div>

      {error && <p className="text-[12.5px] text-amber-300/90">The history endpoint is not answering: {error}</p>}

      {!feed ? (
        <p className="text-[13px] text-muted">Loading…</p>
      ) : feed.records.length === 0 ? (
        <p className="text-[13px] text-muted">
          No signal fired on {day}. On a range-bound session that is the expected outcome, not a gap — the trend gate
          and the consolidation veto are doing their job.
        </p>
      ) : (
        <div className="overflow-auto max-h-[340px]">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr>
                {["Time", "Symbol", "Side", "Score", "Entry", "Option", "Outcome", "R"].map((h, i) => (
                  <th
                    key={h}
                    className={`sticky top-0 z-10 bg-[#27272a] text-[#a1a1aa] text-[11.5px] font-semibold px-2 py-2 whitespace-nowrap ${
                      i === 7 ? "text-right" : "text-left"
                    } first:rounded-l-[5px] last:rounded-r-[5px]`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...feed.records].reverse().map((r) => <Row key={r.id} r={r} />)}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-[11px] text-muted leading-relaxed">
        Outcomes are decided on <strong className="text-[#c7d2dc]">touch</strong>, not on a bar close, because that is
        how the order would have filled. When one poll interval reached both levels it resolves as the stop — the
        assumption that cannot flatter the record — and the row says so. R is measured on the underlying against the
        recommended stop; the option's own result differs, because decay and the spread are charged whatever the stock does.
      </p>
    </section>
  );
}
