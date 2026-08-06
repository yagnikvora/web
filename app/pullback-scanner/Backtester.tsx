"use client";

// The backtest panel.
//
// The backend replays the SAME services the live scanner runs — same indicators, same trend gates,
// same pullback detector, same scorer, same stop and target maths, same config. That is the only
// property that makes the numbers below worth reading: a backtest that reimplemented the rules
// would be testing a second strategy that resembles the first, and every discrepancy between them
// would land in the same direction.
//
// WHAT THE PANEL IS OBLIGED TO SAY, AND DOES. Results are in R on the UNDERLYING. There is no
// historical option chain on this API — Upstox serves the chain as of now and nothing else — so the
// contract selection, the decay and the spread are not modelled here, and a 2R stock move is not a
// 2R option result. The backend attaches that warning to every response and this renders it rather
// than tucking it behind a tooltip.
//
// The sample-size warning is the other one worth surfacing loudly: under about twenty trades a win
// rate has a confidence interval wide enough to contain almost any hypothesis, and a screenshot of
// "80% win rate" over five trades is the single most misleading artefact a tool like this produces.

import { useState } from "react";
import { fmt } from "@/lib/format";
import { bandClass, istDate, TIMEFRAMES, type BacktestResult, type Timeframe } from "@/lib/pullback";

/** Today and thirty sessions back, in IST — the default range. */
const istDay = (offsetDays = 0): string =>
  new Date(Date.now() + 330 * 60_000 - offsetDays * 86_400_000).toISOString().slice(0, 10);

function Stat({ label, value, cls = "", title }: { label: string; value: React.ReactNode; cls?: string; title?: string }) {
  return (
    <div className="flex flex-col" title={title}>
      <span className="text-[10.5px] uppercase tracking-wide text-muted">{label}</span>
      <span className={`text-[17px] font-bold tabular-nums ${cls}`}>{value}</span>
    </div>
  );
}

/** The cumulative-R curve, as an inline sparkline. No chart library for eight points. */
function Equity({ points }: { points: Array<{ at: number; r: number }> }) {
  if (points.length < 2) return null;
  const rs = points.map((p) => p.r);
  const lo = Math.min(0, ...rs);
  const hi = Math.max(0, ...rs);
  const span = hi - lo || 1;
  const W = 260;
  const H = 52;

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${(i / (points.length - 1)) * W},${H - ((p.r - lo) / span) * H}`)
    .join(" ");
  const zero = H - ((0 - lo) / span) * H;
  const end = rs[rs.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[52px]" preserveAspectRatio="none" aria-label="cumulative R">
      <line x1={0} y1={zero} x2={W} y2={zero} stroke="#2a3341" strokeWidth="1" strokeDasharray="3 3" />
      <path d={path} fill="none" stroke={end >= 0 ? "#2ec76a" : "#e5484d"} strokeWidth="1.8" />
    </svg>
  );
}

export default function Backtester() {
  const [symbol, setSymbol] = useState("");
  const [timeframe, setTimeframe] = useState<Timeframe>(5);
  const [from, setFrom] = useState(istDay(45));
  const [to, setTo] = useState(istDay(1));
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [issues, setIssues] = useState<string[]>([]);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (running) return;
    setRunning(true);
    setIssues([]);
    try {
      const res = await fetch("/api/pullback/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: symbol.trim().toUpperCase(), timeframe, from, to }),
      });
      const j = await res.json();
      if (!res.ok) {
        // The backend's `issues` array carries the actual validation messages. Flattening them to
        // "request failed" would turn "the range cannot exceed 180 days" into a blank error.
        setIssues(j.issues?.length ? j.issues : [j.error ?? `request failed (${res.status})`]);
        setResult(null);
      } else {
        setResult(j.data as BacktestResult);
      }
    } catch (err) {
      setIssues([String((err as Error).message)]);
      setResult(null);
    } finally {
      setRunning(false);
    }
  }

  const s = result?.stats;

  return (
    <section className="panel p-4">
      <div className="flex items-baseline gap-3 mb-3 flex-wrap">
        <h2 className="text-[15px] font-bold">Backtest</h2>
        <span className="text-[12px] text-muted">the same strategy, walked over history</span>
      </div>

      <form onSubmit={run} className="flex flex-wrap items-end gap-3 mb-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] uppercase tracking-wide text-muted">Symbol</span>
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="RELIANCE"
            required
            className="bg-chip border border-border rounded-lg px-2.5 py-1.5 text-[13px] text-white outline-none w-[130px] placeholder:text-[#5b6572]"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] uppercase tracking-wide text-muted">Timeframe</span>
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(Number(e.target.value) as Timeframe)}
            className="bg-chip border border-border rounded-lg px-2 py-1.5 text-[13px] text-white outline-none"
          >
            {TIMEFRAMES.map((tf) => <option key={tf} value={tf}>{tf} min</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] uppercase tracking-wide text-muted">From</span>
          <input
            type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)}
            className="bg-chip border border-border rounded-lg px-2 py-1.5 text-[13px] text-white outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] uppercase tracking-wide text-muted">To</span>
          <input
            type="date" value={to} min={from} max={istDay(0)} onChange={(e) => setTo(e.target.value)}
            className="bg-chip border border-border rounded-lg px-2 py-1.5 text-[13px] text-white outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={running || !symbol.trim()}
          className="rounded-lg bg-accent px-3.5 py-2 text-[13px] font-semibold text-white disabled:opacity-40"
        >
          {running ? "Replaying…" : "Run"}
        </button>
      </form>

      {issues.length > 0 && (
        <ul className="text-[12.5px] text-bear space-y-1 list-disc pl-5 mb-3">
          {issues.map((i, k) => <li key={k}>{i}</li>)}
        </ul>
      )}

      {s && (
        <>
          <div className="flex flex-wrap gap-x-7 gap-y-3 mb-3">
            <Stat label="Trades" value={s.count} />
            <Stat
              label="Win rate"
              // Null, not 0%, when nothing resolved. A win rate over an empty denominator is a
              // statement about nothing.
              value={s.winRatePct == null ? "—" : `${s.winRatePct.toFixed(0)}%`}
              cls={(s.winRatePct ?? 0) >= 50 ? "text-bull" : "text-bear"}
            />
            <Stat
              label="Average R"
              value={s.averageR == null ? "—" : `${s.averageR > 0 ? "+" : ""}${s.averageR.toFixed(2)}`}
              cls={(s.averageR ?? 0) >= 0 ? "text-bull" : "text-bear"}
            />
            <Stat
              label="Profit factor"
              value={s.profitFactor == null ? "—" : s.profitFactor.toFixed(2)}
              cls={(s.profitFactor ?? 0) >= 1.5 ? "text-bull" : (s.profitFactor ?? 0) >= 1 ? "text-amber-300" : "text-bear"}
              title={s.profitFactor == null ? "No losing trade to divide by — the ratio is undefined, not infinite." : "Σ gains ÷ Σ losses, in R."}
            />
            <Stat
              label="Max drawdown"
              value={`${s.maxDrawdownR.toFixed(2)}R`}
              cls="text-bear"
              title="Deepest peak-to-trough of the cumulative-R curve. Measured in R rather than rupees because position sizing is not part of this module."
            />
            <Stat label="Avg hold" value={s.averageHoldMin == null ? "—" : `${s.averageHoldMin}m`} />
            <Stat
              label="Expectancy"
              value={s.expectancyR == null ? "—" : `${s.expectancyR > 0 ? "+" : ""}${s.expectancyR.toFixed(2)}R`}
              cls={(s.expectancyR ?? 0) >= 0 ? "text-bull" : "text-bear"}
            />
            <Stat label="Sessions" value={result!.sessions} />
          </div>

          {result!.equity.length > 1 && (
            <div className="mb-3">
              <div className="text-[10.5px] uppercase tracking-wide text-muted mb-1">Cumulative R</div>
              <Equity points={result!.equity} />
            </div>
          )}

          {/* The only real test of the confidence score: does a higher band actually win more? A
              flat or inverted profile here means the score is not carrying information, and that is
              worth seeing rather than being averaged away in the headline. */}
          {result!.byBand.some((b) => b.count > 0) && (
            <div className="mb-3">
              <div className="text-[10.5px] uppercase tracking-wide text-muted mb-1.5">By confidence band</div>
              <div className="flex flex-wrap gap-2">
                {result!.byBand.filter((b) => b.count > 0).map((b) => (
                  <span key={b.band} className={`rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold ${bandClass(b.band)}`}>
                    {b.band} · {b.count} · {b.winRatePct == null ? "—" : `${b.winRatePct.toFixed(0)}%`}
                    <span className="text-muted"> · {b.averageR == null ? "—" : `${b.averageR.toFixed(2)}R`}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {result!.trades.length > 0 && (
            <div className="overflow-auto max-h-[200px] mb-3">
              <table className="w-full border-separate border-spacing-0">
                <thead>
                  <tr>
                    {["Date", "Side", "Entry", "Exit", "Hold", "Result", "R"].map((h, i) => (
                      <th
                        key={h}
                        className={`sticky top-0 z-10 bg-[#27272a] text-[#a1a1aa] text-[11px] font-semibold px-2 py-1.5 whitespace-nowrap ${
                          i === 6 ? "text-right" : "text-left"
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...result!.trades].reverse().map((t, i) => (
                    <tr key={i} className="hover:bg-white/[0.03]">
                      <td className="px-2 py-1.5 text-[11.5px] text-muted whitespace-nowrap">{istDate(t.entryAt)}</td>
                      <td className={`px-2 py-1.5 text-[11.5px] font-bold ${t.direction === 1 ? "text-bull" : "text-bear"}`}>
                        {t.direction === 1 ? "BUY" : "SELL"}
                      </td>
                      <td className="px-2 py-1.5 text-[11.5px] tabular-nums">{fmt(t.entry)}</td>
                      <td className="px-2 py-1.5 text-[11.5px] tabular-nums">{fmt(t.exit)}</td>
                      <td className="px-2 py-1.5 text-[11.5px] text-muted tabular-nums">{t.holdMin}m</td>
                      <td className="px-2 py-1.5 text-[11.5px]">
                        <span className={t.outcome === "target" ? "text-bull" : t.outcome === "stop" ? "text-bear" : "text-muted"}>
                          {t.outcome === "sessionEnd" ? "close" : t.outcome}
                        </span>
                      </td>
                      <td className={`px-2 py-1.5 text-right text-[12px] font-bold tabular-nums ${t.r > 0 ? "text-bull" : "text-bear"}`}>
                        {t.r > 0 ? "+" : ""}{t.r.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Rendered, not tucked behind a tooltip: these are the caveats that decide whether the
              numbers above mean anything. */}
          <ul className="text-[11px] text-muted space-y-1 list-disc pl-5">
            {result!.warnings.map((w, i) => <li key={i}>{w}</li>)}
            <li>
              Entry is the confirmation bar&apos;s close and exits are at the level, so slippage,
              brokerage and STT are not charged. On a 1.5R plan they matter.
            </li>
            <li>
              The universe is today&apos;s F&amp;O list, so a name removed from the segment is absent and its
              trades are not here.
            </li>
          </ul>
        </>
      )}

      {!s && issues.length === 0 && (
        <p className="text-[12.5px] text-muted">
          Pick a symbol and a date range. The replay walks the historical bars one at a time and calls the same trend,
          pullback, scoring and risk services the live scanner uses — which is what makes the result a test of this
          strategy rather than of a second implementation of it.
        </p>
      )}
    </section>
  );
}
