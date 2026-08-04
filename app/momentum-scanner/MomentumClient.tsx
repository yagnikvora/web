"use client";

// The scanner board.
//
// Built on the app's one table (`components/table`) so row padding, the sort caret and the
// green/red chips are the same here as on Market Pulse — a second table implementation is
// exactly what that component exists to prevent.
//
// Two presentation decisions are load-bearing rather than cosmetic:
//
//   A missing reading renders as an em dash, never as 0. A stock outside the enrichment
//   shortlist has no Greeks; showing "0.00" would read as "delta is flat", which is a
//   different and wrong statement.
//
//   The COVERAGE ring next to the score says how much of the model was computable for that
//   row. An 80 on 100% coverage and an 80 on 60% coverage are not the same claim, and the
//   ring is the only thing on the row that says so.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLiveData } from "@/lib/live";
import { fmt } from "@/lib/format";
import { DataTable, Num, PctChip, SymbolCell, TableCard, type Col } from "@/components/table";
import { SourceBadge } from "@/components/ui";
import {
  actionClass, activityClass, ageStr, buildUpClass, directionClass, ENRICHMENT_LABEL, entryBand,
  gradeClass, IV_BASIS_LABEL, moneynessClass, pctStr, rupees, scoreBand, stateClass, STATE_HELP,
  tradeClass, xStr,
  type Confidence, type Direction, type MomentumBoard, type MomentumRow, type MomentumSignal,
  type SignalState, type TradeType,
} from "@/lib/momentum";

/** The timing layer moves in minutes, so the board is polled in tens of seconds. */
const SCANNER_REFRESH_MS = 20_000;

/* ------------------------------------------------------------------------ pieces --- */

/** The score, with a ring whose fill is the row's coverage. */
function ScoreCell({ row }: { row: MomentumRow }) {
  const band = scoreBand(row.score);
  const pct = Math.round(row.coverage * 100);
  return (
    <div className="flex items-center gap-2.5" title={`${band.label} · ${pct}% of the model computable for this row`}>
      <span
        className="inline-block min-w-[46px] text-center rounded-[8px] px-2 py-[6px] text-[15px] leading-[13px] font-black tabular-nums"
        style={{ background: band.bg, color: band.fg }}
      >
        {row.score.toFixed(0)}
      </span>
      <span className="relative w-[18px] h-[18px] shrink-0" aria-label={`${pct}% coverage`}>
        <svg viewBox="0 0 20 20" className="w-[18px] h-[18px] -rotate-90">
          <circle cx="10" cy="10" r="8" fill="none" stroke="#2a3341" strokeWidth="3" />
          <circle
            cx="10" cy="10" r="8" fill="none" stroke={band.ring} strokeWidth="3" strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * 50.27} 50.27`}
          />
        </svg>
      </span>
    </div>
  );
}

const Pill = ({ children, cls }: { children: React.ReactNode; cls: string }) => (
  <span className={`inline-block rounded-full border px-2.5 py-[5px] text-[12px] font-bold whitespace-nowrap ${cls}`}>
    {children}
  </span>
);

const CONF_CLASS: Record<Confidence, string> = {
  High: "text-bull border-emerald-800 bg-emerald-500/10",
  Medium: "text-amber-300 border-amber-700/60 bg-amber-500/10",
  Low: "text-muted border-border bg-white/[0.03]",
};

/* ---------------------------------------------------------------- timing pieces --- */

/**
 * The state, the trigger and how old it is.
 *
 * This column is deliberately placed next to the score rather than at the end of the row,
 * because the two have to be read TOGETHER or the score is misleading. An 88 next to
 * "Extended · range break 34m ago" is a different statement from an 88 next to "Igniting ·
 * VWAP reclaim just now", and until this column existed the board printed both as "88".
 */
function SignalCell({ signal }: { signal: MomentumSignal | null }) {
  if (!signal) return <span className="text-muted text-[13px]">—</span>;

  const stale = signal.trigger != null && (signal.freshness ?? 0) <= 0;
  return (
    <div className="flex flex-col gap-1 min-w-[150px]">
      <span
        className={`inline-block self-start rounded-full border px-2 py-[3px] text-[11.5px] font-bold ${stateClass(signal.state)}`}
        title={STATE_HELP[signal.state]}
      >
        {signal.state}
      </span>
      {signal.trigger ? (
        <span className={`text-[11.5px] leading-[14px] ${stale ? "text-[#7d8895]" : "text-[#c7d2dc]"}`}>
          {signal.trigger.direction === 1 ? "▲" : "▼"} {signal.trigger.label}
          <span className="text-muted"> · {ageStr(signal.trigger.ageMin)}</span>
        </span>
      ) : (
        <span className="text-[11.5px] text-muted">no trigger</span>
      )}
      {signal.freshness != null && (
        // The bar is the only thing on the row that decays. That is the point: a signal is
        // an event with an age, not a condition that stays true.
        <span className="h-[3px] w-[70px] rounded-full bg-[#2a3341] overflow-hidden" aria-hidden>
          <span
            className="block h-full"
            style={{
              width: `${signal.freshness}%`,
              background: signal.freshness > 50 ? "#2ec76a" : signal.freshness > 20 ? "#e2c15c" : "#8a5c5c",
            }}
          />
        </span>
      )}
    </div>
  );
}

/**
 * The contract to buy.
 *
 * Deliberately shows the ASK and the cost of one lot rather than the last traded premium: an
 * option quoted 1.00 × 1.10 is a ₹1.10 purchase, and a row that printed 1.05 would be quietly
 * optimistic about every trade taken from this board. A warning triangle is a real book
 * problem — wide spread, no open interest, heavy decay — hover for which.
 */
function StrikeCell({ signal }: { signal: MomentumSignal | null }) {
  const k = signal?.strike;
  if (!k)
    return (
      <span className="text-muted text-[12px]" title="No option chain for this row this cycle — only the shortlist gets enriched.">
        —
      </span>
    );

  return (
    <div className="flex flex-col gap-[3px] min-w-[132px]" title={`${k.reason}${k.warnings.length ? `\n\n⚠ ${k.warnings.join("\n⚠ ")}` : ""}`}>
      <span className="text-[13px] font-bold">
        <span className={k.type === "CE" ? "text-bull" : "text-bear"}>{k.label}</span>
        <span className={`ml-1.5 text-[10px] font-semibold ${moneynessClass(k.moneyness)}`}>{k.moneyness}</span>
        {k.warnings.length > 0 && <span className="ml-1 text-amber-300" aria-label="see warnings">⚠</span>}
      </span>
      <span className="text-[11.5px] text-muted tabular-nums">
        ₹{k.entryCost.toFixed(2)}
        {k.costPerLot != null && <span> · {rupees(k.costPerLot)}/lot</span>}
      </span>
      <span className="text-[11px] text-muted tabular-nums">
        Δ{Math.abs(k.delta).toFixed(2)}
        {k.gainPctAtTarget != null && (
          <span className={k.gainPctAtTarget >= 30 ? " text-bull" : ""}>
            {" "}· {k.gainPctAtTarget >= 0 ? "+" : ""}{k.gainPctAtTarget.toFixed(0)}% at target
          </span>
        )}
      </span>
    </div>
  );
}

/** Entry quality — the score's counterpart, and never to be confused with it. */
function EntryCell({ signal }: { signal: MomentumSignal | null }) {
  if (!signal) return <span className="text-muted text-[13px]">—</span>;
  const band = entryBand(signal.entryQuality);
  const p = signal.plan;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span
          className="inline-block min-w-[38px] text-center rounded-[7px] px-1.5 py-[4px] text-[13.5px] leading-[12px] font-black tabular-nums"
          style={{ background: band.bg, color: band.fg }}
          title="How good the ENTRY is right now — freshness, pulse, room left and liquidity. Not the score."
        >
          {signal.entryQuality}
        </span>
        <span className={`inline-block rounded-full border px-2 py-[3px] text-[11px] font-bold ${actionClass(signal.action)}`}>
          {signal.action}
        </span>
      </div>
      {p && (
        <span
          className="text-[11px] text-muted tabular-nums"
          title={
            p.underlyingMovePctForTargetOption != null
              ? `The stock needs ${p.underlyingMovePctForTargetOption.toFixed(2)}% for the option gain being targeted; this plan has ${p.targetPct.toFixed(2)}% of room.`
              : "Priced from ATR only — no option chain for this row this cycle."
          }
        >
          {p.optionMovePctAtTarget != null
            ? `≈${p.optionMovePctAtTarget.toFixed(0)}% on the option`
            : `target ${pctStr(p.targetPct)}`}
          {p.meetsOptionTarget === false && <span className="text-amber-300/80"> · short of target</span>}
        </span>
      )}
    </div>
  );
}

/** The ✓/✗ list, capped. The full one is on the detail page. */
function Reasons({ row, max = 4 }: { row: MomentumRow; max?: number }) {
  const shown = row.reasons.slice(0, max);
  const rest = row.reasons.length - shown.length;
  return (
    <div className="flex flex-col gap-[3px] min-w-[240px]">
      {shown.map((r, i) => (
        <span key={i} className={`text-[12.5px] leading-[15px] ${r.ok ? "text-[#c7d2dc]" : "text-[#7d8895]"}`}>
          <span className={r.ok ? "text-bull" : "text-bear"}>{r.ok ? "✓" : "✗"}</span> {r.text}
        </span>
      ))}
      {rest > 0 && <span className="text-[12px] text-muted">+{rest} more</span>}
    </div>
  );
}

/* -------------------------------------------------------------------- the market --- */

function MarketBar({ board }: { board: MomentumBoard }) {
  const m = board.market;
  const b = m.breadth;
  const total = b.advances + b.declines || 1;
  const advPct = (b.advances / total) * 100;

  const Stat = ({ label, value, cls = "" }: { label: string; value: React.ReactNode; cls?: string }) => (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-wide text-muted">{label}</span>
      <span className={`text-[15px] font-bold tabular-nums ${cls}`}>{value}</span>
    </div>
  );

  return (
    <section className="panel p-4 mb-4">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
        <Stat
          label="Nifty 50"
          value={m.nifty ? `${fmt(m.nifty.level)} (${pctStr(m.nifty.changePct)})` : "—"}
          cls={m.nifty && m.nifty.changePct >= 0 ? "text-bull" : "text-bear"}
        />
        <Stat
          label="Nifty vs VWAP"
          value={m.nifty?.aboveVwap == null ? "—" : m.nifty.aboveVwap ? "Above" : "Below"}
          cls={m.nifty?.aboveVwap == null ? "text-muted" : m.nifty.aboveVwap ? "text-bull" : "text-bear"}
        />
        <Stat label="India VIX" value={m.indiaVix ? `${fmt(m.indiaVix.level)} (${pctStr(m.indiaVix.changePct)})` : "—"} />
        <div className="flex flex-col min-w-[190px]">
          <span className="text-[11px] uppercase tracking-wide text-muted">Advance / Decline</span>
          <span className="text-[15px] font-bold tabular-nums">
            <span className="text-bull">{b.advances}</span>
            <span className="text-muted"> / </span>
            <span className="text-bear">{b.declines}</span>
            {b.advanceDeclineRatio != null && <span className="text-muted text-[13px]"> · {b.advanceDeclineRatio.toFixed(2)}</span>}
          </span>
          <span className="mt-1 h-[5px] w-full rounded-full bg-bear/60 overflow-hidden">
            <span className="block h-full bg-bull" style={{ width: `${advPct}%` }} />
          </span>
        </div>
        <Stat
          label="Above own VWAP"
          value={b.pctAboveVwap == null ? "—" : `${b.pctAboveVwap.toFixed(0)}%`}
          cls={(b.pctAboveVwap ?? 50) >= 50 ? "text-bull" : "text-bear"}
        />
        <Stat label="Sectors up" value={`${b.sectorsPositive} / ${b.sectorsTracked}`} />
        <Stat
          label="Session"
          value={m.marketOpen ? `${m.minuteOfSession} / 375 min` : "Closed"}
          cls={m.marketOpen ? "text-bull" : "text-muted"}
        />
        <div className="ml-auto text-right">
          <div className="text-[11px] uppercase tracking-wide text-muted">Scanned</div>
          <div className="text-[15px] font-bold tabular-nums">
            {board.scored} / {board.universeSize}
            <span className="text-muted text-[13px]"> · {board.shortlisted} enriched</span>
          </div>
        </div>
      </div>

      {m.nifty?.vwapSource && (
        // Stated on the page rather than buried in a tooltip: this is the one number on the
        // board that is a substitution, and a reader comparing it against a Nifty chart
        // deserves to know it came from the future.
        <p className="mt-3 text-[11.5px] text-muted">
          Nifty VWAP is read from {m.nifty.vwapSource}.
        </p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ live entries --- */

/**
 * The strip at the top: what could be entered RIGHT NOW, freshest first.
 *
 * Separate from the table because it answers a different question. The table is "what is
 * strong today" and is browsed; this is "what has just started" and is glanced at. Ordering
 * this by score would defeat it — the highest score on the board is routinely the stock with
 * the least left to give, which is the whole reason the timing layer was built.
 *
 * An empty strip is a real and common answer. It says so in words rather than rendering
 * nothing, because a blank space reads as "still loading" and a reader waiting for a signal
 * that is not there will take a worse one instead.
 */
function LiveEntries({ rows, igniting, entrable }: { rows: MomentumRow[]; igniting: number; entrable: number }) {
  return (
    <section className="panel p-4 mb-4">
      <div className="flex items-baseline gap-3 mb-3 flex-wrap">
        <h2 className="text-[15px] font-bold">Entries live now</h2>
        <span className="text-[12px] text-muted">
          {entrable} entrable · {igniting} igniting — ranked by entry quality, not by score
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="text-[13px] text-muted">
          Nothing is entrable this minute. Every strong row on the board has either already made its move, stalled, or
          turned against the day — which is a finding, not a gap. The board below still shows what is strong; the
          Timing column says why none of it is an entry.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2.5">
          {rows.map((r) => {
            const s = r.signal!;
            const band = entryBand(s.entryQuality);
            return (
              <Link
                key={r.symbol}
                href={`/momentum-scanner/${encodeURIComponent(r.symbol)}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-white/[0.02] px-3 py-2.5 hover:border-accent/60 transition-colors"
              >
                <span
                  className="inline-block min-w-[36px] text-center rounded-[7px] px-1.5 py-[5px] text-[14px] leading-[12px] font-black tabular-nums"
                  style={{ background: band.bg, color: band.fg }}
                >
                  {s.entryQuality}
                </span>
                <span className="flex flex-col">
                  <span className="text-[13.5px] font-bold">
                    {r.symbol}
                    {/* The contract, not just the direction. This is the line somebody types
                        into a terminal, so it carries the strike and what a lot costs. */}
                    {s.strike ? (
                      <span className={`ml-2 text-[12px] font-bold ${s.strike.type === "CE" ? "text-bull" : "text-bear"}`}>
                        {s.strike.label}
                        {s.strike.warnings.length > 0 && <span className="text-amber-300"> ⚠</span>}
                      </span>
                    ) : (
                      <span className={`ml-2 text-[11.5px] font-bold ${s.action === "Buy Call" ? "text-bull" : "text-bear"}`}>
                        {s.action}
                      </span>
                    )}
                  </span>
                  <span className="text-[11.5px] text-muted">
                    {s.strike
                      ? `₹${s.strike.entryCost.toFixed(2)}${s.strike.costPerLot != null ? ` · ${rupees(s.strike.costPerLot)}/lot` : ""}`
                      : s.trigger
                        ? `${s.trigger.label} · ${ageStr(s.trigger.ageMin)}`
                        : s.state}
                    {s.plan?.optionMovePctAtTarget != null && ` · ≈${s.plan.optionMovePctAtTarget.toFixed(0)}%`}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* --------------------------------------------------------------------- the board --- */

type DirFilter = "All" | Direction;
type TradeFilter = "All" | TradeType;
type StateFilter = "All" | "Entries only" | SignalState;

const DIRECTIONS: DirFilter[] = ["All", "Bullish", "Bearish", "Neutral"];
const TRADES: TradeFilter[] = ["All", "Momentum Buy", "Momentum Sell", "Watch", "Avoid"];
const STATES: StateFilter[] = ["All", "Entries only", "Igniting", "Extending", "Extended", "Reversing"];

function Segmented<T extends string>({ options, value, onChange, label }: {
  options: T[]; value: T; onChange: (v: T) => void; label: string;
}) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
            o === value ? "bg-accent text-white" : "text-muted hover:bg-chip hover:text-white"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export default function MomentumClient({ initial, source }: { initial: MomentumBoard; source?: string }) {
  // The backend scans every 15 seconds and the timing layer dates a signal from when it
  // fired, so this polls in tens of seconds rather than on the app-wide minute: a signal that
  // is only good for twelve minutes cannot be shown on a one-minute delay and still be early.
  // `useLiveData` stops polling once the market closes.
  const { data: board, updatedAt } = useLiveData<MomentumBoard>(
    initial,
    "/api/momentum?includeFactors=false",
    SCANNER_REFRESH_MS,
  );

  const [search, setSearch] = useState("");
  const [dir, setDir] = useState<DirFilter>("All");
  const [trade, setTrade] = useState<TradeFilter>("All");
  const [state, setState] = useState<StateFilter>("All");
  const [minScore, setMinScore] = useState(0);

  const rows = useMemo(() => {
    const q = search.trim().toUpperCase();
    return board.rows.filter((r) => {
      if (r.score < minScore) return false;
      if (dir !== "All" && r.direction !== dir) return false;
      if (trade !== "All" && r.tradeType !== trade) return false;
      if (state === "Entries only" && r.signal?.action !== "Buy Call" && r.signal?.action !== "Buy Put") return false;
      if (state !== "All" && state !== "Entries only" && r.signal?.state !== state) return false;
      if (q && !r.symbol.includes(q) && !(r.sector ?? "").includes(q)) return false;
      return true;
    });
  }, [board.rows, search, dir, trade, state, minScore]);

  // Sorted by entry quality, not by score — the strip exists to answer "what can I take
  // right now", and sorting it by score would put the most extended stock at the top.
  const live = useMemo(
    () =>
      board.rows
        .filter((r) => r.signal?.action === "Buy Call" || r.signal?.action === "Buy Put")
        .sort((a, b) => (b.signal?.entryQuality ?? 0) - (a.signal?.entryQuality ?? 0))
        .slice(0, 6),
    [board.rows],
  );

  const cols: Col<MomentumRow>[] = [
    { h: "#", val: (r) => r.rank, render: (r) => <Num cls="text-muted">{r.rank}</Num> },
    {
      h: "Stock",
      val: (r) => r.symbol,
      render: (r) => (
        <div className="flex items-center gap-2">
          <SymbolCell sym={r.symbol} />
          {r.enrichment !== "full" && (
            <span
              className="text-[10px] font-bold text-amber-300/80 border border-amber-700/50 rounded px-1 py-[1px]"
              title={ENRICHMENT_LABEL[r.enrichment]}
            >
              {r.enrichment === "quote" ? "Q" : "P"}
            </span>
          )}
        </div>
      ),
    },
    { h: "Price", val: (r) => r.price, render: (r) => <Num>{fmt(r.price)}</Num> },
    { h: "Chg %", val: (r) => r.changePct, render: (r) => <PctChip v={r.changePct} /> },
    { h: "Score", val: (r) => r.score, render: (r) => <ScoreCell row={r} /> },
    {
      h: "Timing",
      val: (r) => r.signal?.freshness ?? -1,
      render: (r) => <SignalCell signal={r.signal} />,
    },
    {
      h: "Entry",
      val: (r) => r.signal?.entryQuality ?? -1,
      render: (r) => <EntryCell signal={r.signal} />,
    },
    {
      h: "Option to buy",
      val: (r) => r.signal?.strike?.gainPctAtTarget ?? -999,
      render: (r) => <StrikeCell signal={r.signal} />,
    },
    {
      h: "Confidence",
      val: (r) => ({ High: 3, Medium: 2, Low: 1 })[r.confidence],
      render: (r) => <Pill cls={CONF_CLASS[r.confidence]}>{r.confidence}</Pill>,
    },
    {
      h: "Trend",
      val: (r) => r.direction,
      render: (r) => (
        <div className={`text-[14px] font-bold ${directionClass(r.direction)}`}>
          {r.direction === "Bullish" ? "▲" : r.direction === "Bearish" ? "▼" : "■"} {r.direction}
          {r.trend?.breakout && (
            <div className="text-[11px] font-semibold text-muted">
              {r.trend.breakout === "up" ? "20d breakout" : "20d breakdown"}
            </div>
          )}
        </div>
      ),
    },
    {
      h: "Liquidity",
      val: (r) => r.liquidity.score ?? -1,
      render: (r) => (
        <div>
          <span className={`text-[14px] font-bold ${gradeClass(r.liquidity.grade)}`}>{r.liquidity.grade ?? "—"}</span>
          <div className="text-[11px] text-muted tabular-nums">{r.liquidity.score?.toFixed(0) ?? "—"}</div>
        </div>
      ),
    },
    {
      h: "RVOL",
      val: (r) => r.rvol.value ?? -1,
      render: (r) => <Num cls={gradeClass(r.rvol.grade)}>{xStr(r.rvol.value)}</Num>,
    },
    {
      h: "VWAP",
      val: (r) => r.vwap.distancePct ?? -999,
      render: (r) => (
        <div>
          <Num cls={(r.vwap.distancePct ?? 0) >= 0 ? "text-bull" : "text-bear"}>{pctStr(r.vwap.distancePct)}</Num>
          <div className="text-[11px] text-muted">
            {r.vwap.rising == null ? "slope —" : r.vwap.rising ? "rising" : "falling"}
          </div>
        </div>
      ),
    },
    {
      h: "Sector",
      val: (r) => r.sectorStrengthPct ?? -999,
      render: (r) => (
        <div>
          <Num cls={(r.sectorStrengthPct ?? 0) >= 0 ? "text-bull" : "text-bear"}>{pctStr(r.sectorStrengthPct)}</Num>
          <div className="text-[11px] text-muted">{r.sector ?? "—"}</div>
        </div>
      ),
    },
    {
      h: "OI Build-up",
      val: (r) => r.oiBuildUp ?? "",
      render: (r) => <span className={`text-[13px] font-bold ${buildUpClass(r.oiBuildUp)}`}>{r.oiBuildUp ?? "—"}</span>,
    },
    {
      h: "Greeks",
      val: (r) => r.greeksSummary?.deltaShift ?? -999,
      render: (r) =>
        r.greeksSummary ? (
          <div className="text-[12px] leading-[15px] tabular-nums">
            <div>
              Δ {r.greeksSummary.delta?.toFixed(2) ?? "—"}
              <span className={(r.greeksSummary.deltaShift ?? 0) >= 0 ? " text-bull" : " text-bear"}>
                {" "}
                {r.greeksSummary.deltaShift == null
                  ? ""
                  : `${r.greeksSummary.deltaShift >= 0 ? "+" : ""}${r.greeksSummary.deltaShift.toFixed(3)}`}
              </span>
            </div>
            <div className="text-muted">
              Γ {r.greeksSummary.gamma?.toFixed(3) ?? "—"} · Θ {r.greeksSummary.thetaBurnPct?.toFixed(1) ?? "—"}%
            </div>
          </div>
        ) : (
          <span className="text-muted text-[13px]">—</span>
        ),
    },
    {
      h: "IV",
      val: (r) => r.ivSummary?.atmIv ?? -1,
      render: (r) =>
        r.ivSummary ? (
          <div className="text-[12px] leading-[15px] tabular-nums" title={`Rank basis: ${IV_BASIS_LABEL[r.ivSummary.basis]}`}>
            <div>{r.ivSummary.atmIv?.toFixed(1) ?? "—"}%</div>
            <div className="text-muted">
              rank {r.ivSummary.ivRank?.toFixed(0) ?? "—"}
              {r.ivSummary.basis === "hv-proxy" && <span className="text-amber-300/80"> *</span>}
            </div>
          </div>
        ) : (
          <span className="text-muted text-[13px]">—</span>
        ),
    },
    {
      h: "Expected move",
      val: (r) => r.expectedMove?.pct ?? -1,
      render: (r) =>
        r.expectedMove ? (
          <div className="text-[12px] leading-[15px] tabular-nums">
            <div>±{r.expectedMove.pct.toFixed(1)}%</div>
            <div className="text-muted">₹{r.expectedMove.rupees.toFixed(0)} · {r.expectedMove.days}d</div>
          </div>
        ) : (
          <span className="text-muted text-[13px]">—</span>
        ),
    },
    {
      h: "Institutional",
      val: (r) => ({ High: 3, Medium: 2, Low: 1 })[r.institutionalActivity],
      render: (r) => <span className={`text-[13px] font-bold ${activityClass(r.institutionalActivity)}`}>{r.institutionalActivity}</span>,
    },
    { h: "Why", render: (r) => <Reasons row={r} /> },
    {
      h: "Action",
      val: (r) => r.tradeType,
      render: (r) => (
        <div className="flex flex-col gap-1.5 items-start">
          <Pill cls={tradeClass(r.tradeType)}>{r.tradeType}</Pill>
          <Link href={`/momentum-scanner/${encodeURIComponent(r.symbol)}`} className="text-[12px] text-accent hover:underline">
            Full analysis →
          </Link>
        </div>
      ),
    },
  ];

  return (
    <main className="p-5">
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <h1 className="text-3xl font-extrabold tracking-tight">Momentum Scanner</h1>
        <SourceBadge source={source} />
        {/* The timestamp is client-only. Formatting `Date.now()` during render gives the
            server one second and the browser another, which hydrates as a text mismatch —
            and a scanner header is the last place to spend a re-render on. */}
        <span className="text-[12px] text-muted">
          config v{board.configVersion}
          {updatedAt !== null && ` · updated ${new Date(updatedAt).toLocaleTimeString("en-IN", { hour12: false })}`}
        </span>
      </div>

      <MarketBar board={board} />

      <LiveEntries rows={live} igniting={board.igniting} entrable={board.entrable} />

      {board.warnings.length > 0 && (
        <div className="panel p-3.5 mb-4 border-amber-800/50">
          <div className="text-[12px] font-bold uppercase tracking-wide text-amber-300 mb-1.5">
            What this board could not compute
          </div>
          <ul className="text-[13px] text-muted space-y-1 list-disc pl-5">
            {board.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      <TableCard
        title={`Top momentum — ${rows.length} of ${board.scored}`}
        desc="Twelve weighted factors scored 0–100. Score is how strong the move is; Timing and Entry are whether there is any of it left to buy — read them together, because the highest scores on this board are routinely moves that have already happened."
        live
        search={{ value: search, onChange: setSearch }}
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-[15px] py-3">
          <Segmented options={STATES} value={state} onChange={setState} label="Timing state" />
          <Segmented options={DIRECTIONS} value={dir} onChange={setDir} label="Direction" />
          <Segmented options={TRADES} value={trade} onChange={setTrade} label="Trade type" />
          <label className="flex items-center gap-2 text-[12.5px] text-muted">
            Min score
            <input
              type="range" min={0} max={100} step={5} value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-[120px] accent-[#4c8dff]"
            />
            <span className="tabular-nums font-bold text-white w-[24px]">{minScore}</span>
          </label>
        </div>

        <DataTable
          cols={cols}
          rows={rows}
          rowKey={(r) => r.symbol}
          height={720}
          initialSort={4}
          empty="No stock clears these filters right now."
        />
      </TableCard>

      <p className="mt-4 text-[11.5px] text-muted max-w-4xl leading-relaxed">
        Scores are a ranking of measurable momentum evidence, not advice. <strong className="text-[#c7d2dc]">Score and
        Timing measure different things</strong>: eleven of the twelve factors are cumulative for the session, so they
        peak once a move is finished — the Timing column is the only one that reads the last few minutes, and it is what
        says whether an entry is still there. The option percentage is a first-order estimate from the ATM delta, gamma
        and premium quoted on the chain; it ignores decay and any change in implied volatility over the hold. An
        asterisk on an IV rank means it is standing in from realised volatility — Upstox publishes no
        implied-volatility history, so a true IV rank accumulates from the day this module was deployed. Weights,
        thresholds and every timing gate are configurable at <code className="text-[11px]">PUT /momentum/config</code>.
      </p>
    </main>
  );
}
