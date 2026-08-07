"use client";

// The pullback board.
//
// Built on the app's one table (`components/table`) so row padding, the sort caret and the
// green/red chips are the same here as on Market Pulse — a second table implementation is exactly
// what that component exists to prevent.
//
// THREE PRESENTATION DECISIONS ARE LOAD-BEARING RATHER THAN COSMETIC.
//
//   A missing reading renders as an em dash, never as 0. A 200 EMA that has not seeded has no
//   value; showing "0.00" would read as "price is 0.00 above the 200 EMA", which is a different and
//   wrong statement — and this board is dark on long averages for the first minutes after a deploy.
//
//   THE WATCHLIST OUTRANKS THE SIGNAL LIST IN USEFULNESS, and the layout says so. "Upcoming
//   Pullbacks" sits above the table because by the time a confirmation candle has closed, the entry
//   is already a bar old — anything that only ever showed fired signals would be showing history.
//
//   AN EMPTY BOARD IS A FINDING AND SAYS SO IN WORDS. A pullback setup needs a trend, a
//   retracement, a candle and a volume expansion to line up, and on a chopping day none of them do.
//   A blank space reads as "still loading", and a reader waiting for a signal that is not there
//   will take a worse one instead.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLiveData } from "@/lib/live";
import { fmt, istClock } from "@/lib/format";
import { DataTable, Num, PctChip, SymbolCell, TableCard, type Col } from "@/components/table";
import { SourceBadge } from "@/components/ui";
import AlertFeed from "./AlertFeed";
import Backtester from "./Backtester";
import HistoryPanel from "./HistoryPanel";
import {
  ageStr, atrStr, bandColours, bestOf, confidenceOf, ENTRY_KIND_HELP,
  liquidityClass, moneynessClass, PATTERN_LABEL, PHASE_HELP, PHASE_SHORT, phaseClass, pctStr,
  rupees, TIMEFRAME_LABEL, TIMEFRAMES, trendClass, xStr,
  type ConfidenceBand, type PullbackBoard, type PullbackRow, type PullbackSignal, type Timeframe,
  type TrendState,
} from "@/lib/pullback";

/**
 * A pullback confirmation is dated from the bar that closed, so the board is polled in tens of
 * seconds. `useLiveData` stops polling once the market closes.
 */
const REFRESH_MS = 20_000;

/* ------------------------------------------------------------------------- pieces --- */

const Dash = ({ title }: { title?: string }) => (
  <span className="text-muted text-[13px]" title={title}>—</span>
);

/** The confidence chip, with a ring whose fill is how much of the model was measurable. */
function ConfidenceCell({ row }: { row: PullbackRow }) {
  const s = bestOf(row);
  if (!s) return <Dash title="No setup on this row — it is on the board for its trend, not for an entry." />;

  const c = bandColours(s.score.band);
  const pct = Math.round(s.score.coverage * 100);
  return (
    <div
      className="flex items-center gap-2.5"
      title={`${s.score.band} · ${pct}% of the 100-point model was measurable for this row`}
    >
      <span
        className="inline-block min-w-[44px] text-center rounded-[8px] px-2 py-[6px] text-[15px] leading-[13px] font-black tabular-nums"
        style={{ background: c.bg, color: c.fg }}
      >
        {s.score.total.toFixed(0)}
      </span>
      <span className="relative w-[18px] h-[18px] shrink-0" aria-label={`${pct}% coverage`}>
        <svg viewBox="0 0 20 20" className="w-[18px] h-[18px] -rotate-90">
          <circle cx="10" cy="10" r="8" fill="none" stroke="#2a3341" strokeWidth="3" />
          <circle
            cx="10" cy="10" r="8" fill="none" stroke={c.ring} strokeWidth="3" strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * 50.27} 50.27`}
          />
        </svg>
      </span>
    </div>
  );
}

/**
 * The setup's state and its age.
 *
 * Deliberately next to the confidence rather than at the end of the row, because the two have to be
 * read TOGETHER. An 82 beside "Resuming · just now" and an 82 beside "At zone · waiting" are
 * different rows: the first is an order and the second is an alarm to set.
 */
function SignalCell({ row }: { row: PullbackRow }) {
  const s = bestOf(row);
  if (!s) return <Dash />;
  const pb = s.pullback;

  return (
    <div className="flex flex-col gap-1 min-w-[164px]">
      <div className="flex items-center gap-1.5">
        <span
          className={`inline-block rounded-full border px-2 py-[3px] text-[11.5px] font-bold ${phaseClass(pb.phase)}`}
          title={PHASE_HELP[pb.phase]}
        >
          {PHASE_SHORT[pb.phase]}
        </span>
        <span className="text-[11px] text-muted font-semibold">{TIMEFRAME_LABEL[s.timeframe]}</span>
      </div>

      {pb.touch.nearest && (
        <span className="text-[11.5px] leading-[14px] text-[#c7d2dc]">
          {s.direction === 1 ? "▲" : "▼"} to the{" "}
          {pb.touch.nearest === "vwap" ? "VWAP" : pb.touch.nearest === "ema9" ? "9 EMA" : "20 EMA"}
          <span className="text-muted">
            {" "}· {((pb.retracement ?? 0) * 100).toFixed(0)}% of the leg
          </span>
        </span>
      )}

      {row.signal ? (
        <span className="text-[11px] text-muted tabular-nums" title={pb.confirmation ? pb.confirmation.reasons.join(" · ") : undefined}>
          {pb.confirmation ? PATTERN_LABEL[pb.confirmation.pattern] : "confirmed"} · {ageStr(s.ageMin)}
        </span>
      ) : (
        // The first blocker only. A watch row typically has one thing missing, and listing all of
        // them in a table cell turns the useful case into a wall of text.
        <span className="text-[11px] text-[#7d8895] leading-[14px]">{s.blockers[0] ?? "waiting"}</span>
      )}

      {s.alignedWith.length > 0 && (
        <span className="text-[10.5px] text-accent">
          {s.alignedWith.map((tf) => `${tf}m`).join(" + ")} agree
        </span>
      )}
    </div>
  );
}

/**
 * The contract to buy.
 *
 * Shows the ASK and what one lot costs rather than the last traded premium: an option quoted
 * 1.00 × 1.10 is a ₹1.10 purchase, and a row printing 1.05 would be quietly optimistic about every
 * trade taken from this board. A warning triangle is a real book problem — hover for which.
 */
function OptionCell({ signal }: { signal: PullbackSignal | null }) {
  const o = signal?.option;
  if (!o)
    return (
      <Dash title="No option chain for this row this cycle — only candidates are enriched. The price plan on the underlying is complete." />
    );

  return (
    <div
      className="flex flex-col gap-[3px] min-w-[136px]"
      title={`${o.reason}\n\n${o.band.reason}${o.warnings.length ? `\n\n⚠ ${o.warnings.join("\n⚠ ")}` : ""}`}
    >
      <span className="text-[13px] font-bold">
        <span className={o.side === "CE" ? "text-bull" : "text-bear"}>{o.label}</span>
        <span className={`ml-1.5 text-[10px] font-semibold ${moneynessClass(o.moneyness)}`}>{o.moneyness}</span>
        {o.warnings.length > 0 && <span className="ml-1 text-amber-300" aria-label="see warnings">⚠</span>}
      </span>
      <span className="text-[11.5px] text-muted tabular-nums">
        ₹{o.entryCost.toFixed(2)}
        {o.costPerLot != null && <span> · {rupees(o.costPerLot)}/lot</span>}
      </span>
      <span className="text-[11px] text-muted tabular-nums">
        {o.expiry.slice(5)} · {o.expiryDays}d
        {o.gainPctAtTarget != null && (
          <span className={o.gainPctAtTarget >= 40 ? " text-bull" : ""}>
            {" "}· {o.gainPctAtTarget >= 0 ? "+" : ""}{o.gainPctAtTarget.toFixed(0)}% at target
          </span>
        )}
      </span>
    </div>
  );
}

/* --------------------------------------------------------------------- the cards --- */

function Card({ title, value, sub, cls = "", children }: {
  title: string; value?: React.ReactNode; sub?: React.ReactNode; cls?: string; children?: React.ReactNode;
}) {
  return (
    <section className="panel p-4 flex-1 min-w-[190px]">
      <div className="text-[11px] uppercase tracking-wide text-muted mb-1.5">{title}</div>
      {value !== undefined && <div className={`text-[26px] leading-[28px] font-extrabold tabular-nums ${cls}`}>{value}</div>}
      {sub && <div className="text-[12px] text-muted mt-1">{sub}</div>}
      {children}
    </section>
  );
}

function Cards({ board }: { board: PullbackBoard }) {
  const strongest = useMemo(() => {
    const withTrend = board.rows.filter((r) => r.dominant && r.dominant.state !== "None");
    return withTrend.sort((a, b) => (b.dominant?.strength ?? 0) - (a.dominant?.strength ?? 0))[0] ?? null;
  }, [board.rows]);

  const upcoming = useMemo(
    () =>
      board.rows
        .filter((r) => !r.signal && r.watch?.pullback.phase === "AtZone")
        .sort((a, b) => (b.watch?.score.total ?? 0) - (a.watch?.score.total ?? 0))
        .slice(0, 4),
    [board.rows],
  );

  return (
    <div className="flex flex-wrap gap-3 mb-4">
      <Card
        title="Today's signals"
        value={board.firedToday}
        sub={`${board.bullishSignals + board.bearishSignals} live now · ${board.enriched} chains fetched`}
      />

      <Card
        title="Strongest trend"
        value={strongest ? strongest.dominant!.strength : "—"}
        cls={strongest ? trendClass(strongest.dominant!.state) : "text-muted"}
        sub={
          strongest ? (
            <Link href={`/pullback-scanner/${encodeURIComponent(strongest.symbol)}`} className="text-accent hover:underline">
              {strongest.symbol} · {strongest.dominant!.state} on {TIMEFRAME_LABEL[strongest.dominant!.timeframe]}
            </Link>
          ) : (
            "nothing clears the trend checklist"
          )
        }
      />

      <Card title="Upcoming pullbacks" value={board.watching} sub="at or approaching the zone">
        {upcoming.length > 0 && (
          <div className="mt-2 flex flex-col gap-1">
            {upcoming.map((r) => (
              <Link
                key={r.symbol}
                href={`/pullback-scanner/${encodeURIComponent(r.symbol)}`}
                className="flex items-center justify-between text-[12px] hover:text-white text-muted"
              >
                <span className="font-bold text-[#c7d2dc]">{r.symbol}</span>
                <span className="tabular-nums">
                  {r.watch!.score.total.toFixed(0)} · {TIMEFRAME_LABEL[r.watch!.timeframe]}
                </span>
              </Link>
            ))}
          </div>
        )}
      </Card>

      <Card title="Bullish" value={board.bullishSignals} cls="text-bull" sub="confirmed long entries" />
      <Card title="Bearish" value={board.bearishSignals} cls="text-bear" sub="confirmed short entries" />
    </div>
  );
}

function MarketBar({ board }: { board: PullbackBoard }) {
  const m = board.market;
  const b = m.breadth;
  const total = b.advances + b.declines || 1;

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
        <div className="flex flex-col min-w-[180px]">
          <span className="text-[11px] uppercase tracking-wide text-muted">Advance / Decline</span>
          <span className="text-[15px] font-bold tabular-nums">
            <span className="text-bull">{b.advances}</span>
            <span className="text-muted"> / </span>
            <span className="text-bear">{b.declines}</span>
          </span>
          <span className="mt-1 h-[5px] w-full rounded-full bg-bear/60 overflow-hidden">
            <span className="block h-full bg-bull" style={{ width: `${(b.advances / total) * 100}%` }} />
          </span>
        </div>
        <Stat
          label="Above own VWAP"
          value={b.pctAboveVwap == null ? "—" : `${b.pctAboveVwap.toFixed(0)}%`}
          cls={(b.pctAboveVwap ?? 50) >= 50 ? "text-bull" : "text-bear"}
        />
        <Stat
          label="Session"
          value={m.marketOpen ? `${m.minuteOfSession} / 375 min` : "Closed"}
          cls={m.marketOpen ? "text-bull" : "text-muted"}
        />
        <div className="ml-auto text-right">
          <div className="text-[11px] uppercase tracking-wide text-muted">Scanned</div>
          <div className="text-[15px] font-bold tabular-nums">
            {board.scanned} / {board.universeSize}
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------- the filters --- */

type Row = "All" | "Signals" | "Watching";
type Kind = "All" | "Index" | "Stocks";
type Dir = "All" | TrendState;
type TfFilter = "All" | Timeframe;
type BandFilter = "All" | ConfidenceBand;

function Segmented<T extends string | number>({ options, value, onChange, label, render }: {
  options: T[]; value: T; onChange: (v: T) => void; label: string; render?: (v: T) => string;
}) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o)}
          type="button"
          onClick={() => onChange(o)}
          className={`rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
            o === value ? "bg-accent text-white" : "text-muted hover:bg-chip hover:text-white"
          }`}
        >
          {render ? render(o) : String(o)}
        </button>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------------- the board --- */

export default function PullbackClient({ initial, source }: { initial: PullbackBoard; source?: string }) {
  const { data: board, updatedAt } = useLiveData<PullbackBoard>(initial, "/api/pullback", REFRESH_MS);

  const [search, setSearch] = useState("");
  const [rowKind, setRowKind] = useState<Row>("All");
  const [kind, setKind] = useState<Kind>("All");
  const [dir, setDir] = useState<Dir>("All");
  const [tf, setTf] = useState<TfFilter>("All");
  const [band, setBand] = useState<BandFilter>("All");
  const [sector, setSector] = useState("All");
  const [minConfidence, setMinConfidence] = useState(0);
  const [minLiquidity, setMinLiquidity] = useState(0);
  const [minTurnover, setMinTurnover] = useState(0);

  // `Array.from` rather than spreading the Set — this app's tsconfig sets no `target`, so iterating
  // one needs `downlevelIteration`.
  const sectors = useMemo(
    () => ["All", ...Array.from(new Set(board.rows.map((r) => r.sector).filter((s): s is string => !!s))).sort()],
    [board.rows],
  );

  const rows = useMemo(() => {
    const q = search.trim().toUpperCase();
    return board.rows.filter((r) => {
      const s = bestOf(r);
      if (rowKind === "Signals" && !r.signal) return false;
      if (rowKind === "Watching" && (r.signal || !r.watch)) return false;
      if (kind === "Index" && r.kind !== "index") return false;
      if (kind === "Stocks" && r.kind !== "stock") return false;
      if (dir !== "All") {
        const d = s?.direction ?? null;
        if (dir === "None" ? d !== null : d !== (dir === "Bullish" ? 1 : -1)) return false;
      }
      if (tf !== "All") {
        if (s) { if (s.timeframe !== tf) return false; }
        else if (r.trends[tf]?.state === "None" || !r.trends[tf]) return false;
      }
      if (band !== "All" && s?.score.band !== band) return false;
      if (sector !== "All" && r.sector !== sector) return false;
      if (minConfidence > 0 && (confidenceOf(r) ?? 0) < minConfidence) return false;
      if (minLiquidity > 0 && (s?.option?.liquidity.score ?? -1) < minLiquidity) return false;
      if (minTurnover > 0 && r.turnoverCr < minTurnover) return false;
      if (q && !r.symbol.includes(q) && !(r.sector ?? "").includes(q) && !(r.name ?? "").toUpperCase().includes(q))
        return false;
      return true;
    });
  }, [board.rows, search, rowKind, kind, dir, tf, band, sector, minConfidence, minLiquidity, minTurnover]);

  const cols: Col<PullbackRow>[] = [
    {
      h: "Stock",
      val: (r) => r.symbol,
      render: (r) => (
        <div className="flex items-center gap-2">
          <SymbolCell sym={r.symbol} />
          {r.kind === "index" && (
            <span
              className="text-[10px] font-bold text-accent border border-accent/50 rounded px-1 py-[1px]"
              title="Charted on the near-month future — the index itself publishes no volume, so VWAP and the volume gate are only computable there. Option strikes are on spot."
            >
              FUT
            </span>
          )}
          {!r.enriched && (
            <span
              className="text-[10px] font-bold text-amber-300/80 border border-amber-700/50 rounded px-1 py-[1px]"
              title="Quote tier only — no option chain and no exact-bar resync this cycle, so the bar extremes are poll-built."
            >
              Q
            </span>
          )}
        </div>
      ),
    },
    { h: "CMP", val: (r) => r.price, render: (r) => <Num>{fmt(r.price)}</Num> },
    { h: "Chg %", val: (r) => r.changePct, render: (r) => <PctChip v={r.changePct} /> },
    {
      h: "Trend",
      val: (r) => r.dominant?.strength ?? -1,
      render: (r) =>
        r.dominant ? (
          <div>
            <div className={`text-[14px] font-bold ${trendClass(r.dominant.state)}`}>
              {r.dominant.state === "Bullish" ? "▲" : r.dominant.state === "Bearish" ? "▼" : "■"} {r.dominant.strength}
            </div>
            <div className="text-[11px] text-muted">{TIMEFRAME_LABEL[r.dominant.timeframe]}</div>
          </div>
        ) : (
          <Dash />
        ),
    },
    {
      h: "Confidence",
      val: (r) => confidenceOf(r) ?? -1,
      render: (r) => <ConfidenceCell row={r} />,
    },
    { h: "Signal", val: (r) => (r.signal ? 2 : r.watch ? 1 : 0), render: (r) => <SignalCell row={r} /> },
    {
      h: "9 EMA",
      val: (r) => r.readout?.ema9 ?? -1,
      render: (r) => (r.readout?.ema9 == null ? <Dash title={r.readout?.warming ? "timeframe still warming" : undefined} /> : <Num>{fmt(r.readout.ema9)}</Num>),
    },
    {
      h: "20 EMA",
      val: (r) => r.readout?.ema20 ?? -1,
      render: (r) =>
        r.readout?.ema20 == null ? <Dash /> : (
          <div>
            <Num>{fmt(r.readout.ema20)}</Num>
            <div className="text-[11px] text-muted tabular-nums">{atrStr(r.readout.ema20DistanceAtr)}</div>
          </div>
        ),
    },
    {
      h: "VWAP",
      val: (r) => r.readout?.vwapDistanceAtr ?? -999,
      render: (r) =>
        r.readout?.vwap == null ? (
          <Dash title="This instrument publishes no volume on the scanned series." />
        ) : (
          <div>
            <Num>{fmt(r.readout.vwap)}</Num>
            <div
              className={`text-[11px] tabular-nums ${(r.readout.vwapDistanceAtr ?? 0) >= 0 ? "text-bull" : "text-bear"}`}
              title="Distance from VWAP in ATR. Closer is a better entry; a long way above it is a chase."
            >
              {atrStr(r.readout.vwapDistanceAtr)}
            </div>
          </div>
        ),
    },
    {
      h: "ADX",
      val: (r) => r.readout?.adx ?? -1,
      render: (r) =>
        r.readout?.adx == null ? (
          <Dash title="ADX is a Wilder smoothing of DX and needs about 28 bars on this timeframe." />
        ) : (
          <div>
            <Num cls={r.readout.adx >= 25 ? "text-bull" : r.readout.adx < 20 ? "text-bear" : "text-amber-300"}>
              {r.readout.adx.toFixed(1)}
            </Num>
            <div className="text-[11px] text-muted">
              {r.readout.adxRising == null ? "—" : r.readout.adxRising ? "rising" : "falling"}
            </div>
          </div>
        ),
    },
    {
      h: "Volume",
      val: (r) => r.readout?.participation ?? -1,
      render: (r) =>
        r.readout?.participation == null ? <Dash /> : (
          <div title="This window's mean volume against the previous window's — the trend's volume condition. The bar-level ratio underneath is what the confirmation candle was judged on.">
            <Num cls={r.readout.participation >= 1 ? "text-bull" : "text-muted"}>{xStr(r.readout.participation)}</Num>
            <div className="text-[11px] text-muted tabular-nums">bar {xStr(r.readout.volumeRatio)}</div>
          </div>
        ),
    },
    {
      h: "Stop",
      val: (r) => bestOf(r)?.stop.recommended.distanceAtr ?? -1,
      render: (r) => {
        const s = bestOf(r);
        if (!s) return <Dash />;
        const st = s.stop.recommended;
        return (
          <div title={`${st.reason}${s.stop.warning ? `\n\n⚠ ${s.stop.warning}` : ""}`}>
            <Num cls="text-bear">{fmt(st.price)}</Num>
            <div className="text-[11px] text-muted tabular-nums">
              {st.kind} · {st.distanceAtr.toFixed(2)} ATR · {st.distancePct.toFixed(2)}%
              {s.stop.warning && <span className="text-amber-300"> ⚠</span>}
            </div>
          </div>
        );
      },
    },
    {
      h: "Target",
      val: (r) => bestOf(r)?.target.primary.r ?? -1,
      render: (r) => {
        const s = bestOf(r);
        if (!s) return <Dash />;
        const t = s.target.primary;
        return (
          <div title={`${t.reason}\n\nTrailing: ${s.target.trailing.rule} (now ${s.target.trailing.current.toFixed(2)})`}>
            <Num cls="text-bull">{fmt(t.price)}</Num>
            <div className="text-[11px] text-muted tabular-nums">
              {t.label} · {t.distancePct.toFixed(2)}%
            </div>
          </div>
        );
      },
    },
    {
      // Sorted on ROOM, not on the reward:risk. With a 2R primary target the reward:risk is 2.00 on
      // every row by construction — a column of identical numbers, useless to sort by — while room
      // is the independent measurement of whether the objective is worth the risk the retracement
      // created. Both are shown, because the brief asks for the ratio and the ratio is what gets
      // quoted; room is what decides.
      h: "R:R",
      val: (r) => bestOf(r)?.target.roomR ?? -1,
      render: (r) => {
        const s = bestOf(r);
        if (!s) return <Dash />;
        return (
          <div title="Top: reward:risk to the primary target. Bottom: how many multiples of the risk the objective — the impulse leg repeating — is worth. The second is what the scanner gates on.">
            <Num cls={s.target.rewardRisk >= 2 ? "text-bull" : "text-emerald-300"}>
              {s.target.rewardRisk.toFixed(2)}
            </Num>
            <div
              className={`text-[11px] tabular-nums ${s.target.roomR >= 2 ? "text-bull" : s.target.roomR >= 1.5 ? "text-emerald-300" : "text-amber-300"}`}
            >
              {s.target.roomR.toFixed(2)}R room
            </div>
          </div>
        );
      },
    },
    {
      h: "Recommended option",
      val: (r) => bestOf(r)?.option?.gainPctAtTarget ?? -999,
      render: (r) => <OptionCell signal={bestOf(r)} />,
    },
    {
      h: "Delta",
      val: (r) => Math.abs(bestOf(r)?.option?.delta ?? 0),
      render: (r) => {
        const o = bestOf(r)?.option;
        if (!o) return <Dash />;
        const inBand = Math.abs(o.delta) >= o.band.min && Math.abs(o.delta) <= o.band.max;
        return (
          <div title={`${ENTRY_KIND_HELP[bestOf(r)!.entryKind]}\n\nBand: ${o.band.min.toFixed(2)}–${o.band.max.toFixed(2)}`}>
            <Num cls={inBand ? "text-bull" : "text-amber-300"}>{Math.abs(o.delta).toFixed(2)}</Num>
            <div className="text-[11px] text-muted tabular-nums">
              Θ {o.thetaPctPerHour == null ? "—" : `${o.thetaPctPerHour.toFixed(1)}%/h`}
            </div>
          </div>
        );
      },
    },
    {
      h: "Liquidity",
      val: (r) => bestOf(r)?.option?.liquidity.score ?? -1,
      render: (r) => {
        const l = bestOf(r)?.option?.liquidity;
        if (!l) return <Dash />;
        return (
          <div title={l.reasons.join(" · ")}>
            <span className={`text-[14px] font-bold ${liquidityClass(l.grade)}`}>{l.grade}</span>
            <div className="text-[11px] text-muted tabular-nums">{l.score.toFixed(0)}</div>
          </div>
        );
      },
    },
    {
      h: "Why",
      render: (r) => {
        const s = bestOf(r);
        if (!s) return <Dash />;
        const lines = r.signal ? s.reasons.slice(0, 3) : s.blockers.slice(0, 3);
        return (
          <div className="flex flex-col gap-[3px] min-w-[230px]">
            {lines.map((t, i) => (
              <span key={i} className={`text-[12px] leading-[15px] ${r.signal ? "text-[#c7d2dc]" : "text-[#7d8895]"}`}>
                <span className={r.signal ? "text-bull" : "text-bear"}>{r.signal ? "✓" : "✗"}</span> {t}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      h: "",
      render: (r) => (
        <Link href={`/pullback-scanner/${encodeURIComponent(r.symbol)}`} className="text-[12px] text-accent hover:underline whitespace-nowrap">
          Chart →
        </Link>
      ),
    },
  ];

  return (
    <main className="p-5">
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <h1 className="text-3xl font-extrabold tracking-tight">EMA Pullback Scanner</h1>
        <SourceBadge source={source} />
        {/* Client-only. Formatting `Date.now()` during render gives the server one second and the
            browser another, which hydrates as a text mismatch. */}
        <span className="text-[12px] text-muted">
          config v{board.configVersion}
          {updatedAt !== null && ` · updated ${istClock(updatedAt, true)}`}
        </span>
      </div>

      <MarketBar board={board} />
      <Cards board={board} />
      <AlertFeed />

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
        title={`Pullback setups — ${rows.length} of ${board.scanned}`}
        desc="A signal needs all seven: an established trend, a measured retracement into the 9/20/VWAP band, a reversal candle, a volume expansion, ADX above the trend line, intact swing structure, and a tradable option book. Rows without a signal are on the board for their trend and for the pullback that has not arrived yet."
        live
        search={{ value: search, onChange: setSearch }}
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-[15px] py-3">
          <Segmented options={["All", "Signals", "Watching"] as Row[]} value={rowKind} onChange={setRowKind} label="Row type" />
          <Segmented options={["All", "Index", "Stocks"] as Kind[]} value={kind} onChange={setKind} label="Instrument" />
          <Segmented options={["All", "Bullish", "Bearish"] as Dir[]} value={dir} onChange={setDir} label="Direction" />
          <Segmented
            options={["All", ...TIMEFRAMES] as TfFilter[]}
            value={tf}
            onChange={setTf}
            label="Timeframe"
            render={(v) => (v === "All" ? "All" : `${v}m`)}
          />
          <Segmented
            options={["All", "Excellent", "Strong", "Medium", "Weak"] as BandFilter[]}
            value={band}
            onChange={setBand}
            label="Confidence band"
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-[15px] pb-3">
          <label className="flex items-center gap-2 text-[12.5px] text-muted">
            Sector
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="bg-chip border border-border rounded-lg px-2 py-1.5 text-[12.5px] text-white outline-none"
            >
              {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-[12.5px] text-muted">
            Min confidence
            <input
              type="range" min={0} max={100} step={5} value={minConfidence}
              onChange={(e) => setMinConfidence(Number(e.target.value))}
              className="w-[110px] accent-[#4c8dff]"
            />
            <span className="tabular-nums font-bold text-white w-[24px]">{minConfidence}</span>
          </label>
          <label className="flex items-center gap-2 text-[12.5px] text-muted" title="The option book's liquidity score, 0–100. Rows with no chain this cycle are excluded once this is above zero.">
            Min option liquidity
            <input
              type="range" min={0} max={100} step={5} value={minLiquidity}
              onChange={(e) => setMinLiquidity(Number(e.target.value))}
              className="w-[110px] accent-[#4c8dff]"
            />
            <span className="tabular-nums font-bold text-white w-[24px]">{minLiquidity}</span>
          </label>
          <label className="flex items-center gap-2 text-[12.5px] text-muted">
            Min turnover ₹Cr
            <input
              type="range" min={0} max={500} step={10} value={minTurnover}
              onChange={(e) => setMinTurnover(Number(e.target.value))}
              className="w-[110px] accent-[#4c8dff]"
            />
            <span className="tabular-nums font-bold text-white w-[34px]">{minTurnover}</span>
          </label>
        </div>

        <DataTable
          cols={cols}
          rows={rows}
          rowKey={(r) => r.symbol}
          height={740}
          initialSort={5}
          empty={
            board.scanned === 0
              ? "Nothing has been scanned yet — the EMA seed is probably still building."
              : "No row clears these filters. On a chopping day that is the normal answer: a pullback setup needs a trend, a retracement, a candle and a volume expansion to line up, and none of them do in a range."
          }
        />
      </TableCard>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
        <HistoryPanel />
        <Backtester />
      </div>

      <p className="mt-4 text-[11.5px] text-muted max-w-4xl leading-relaxed">
        This scanner does <strong className="text-[#c7d2dc]">not</strong> signal on EMA crossovers. A cross is a state
        change at the point of maximum ambiguity — the two averages are equal, so what decides the trade is the noise on
        top of them. Every signal here is a retracement inside a trend that was already established, which is a
        different setup with different statistics. Stops and targets are on the <em>underlying</em>; the option
        percentage is a second-order estimate from the delta and gamma quoted on the chain, net of paying the ask and
        selling the bid, and it ignores any change in implied volatility over the hold. Rows marked{" "}
        <code className="text-[11px]">Q</code> had no option chain and no exact-bar resync this cycle, so their bar
        extremes come from the quote poll and run slightly narrow. Every threshold — the ADX lines, the retracement band,
        the confirmation rules, the delta bands, the score weights — is configurable at{" "}
        <code className="text-[11px]">PUT /pullback/config</code>. Nothing here is advice.
      </p>
    </main>
  );
}
