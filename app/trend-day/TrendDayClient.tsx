"use client";

// The Trend Day board — stocks going ONE DIRECTION all session.
//
// WHY THIS IS A SEPARATE PAGE FROM THE SCANNER, and not a filter on it.
//
// The two lists answer different questions at different speeds, and putting them together
// makes both worse. The scanner ranks on a score recomputed every fifteen seconds with a
// sixteen-weight three-minute factor inside it: it is SUPPOSED to move, because it is
// answering "what is happening right now". This list is ranked on a measurement taken over
// hours, behind a phase machine with hysteresis in both directions — promotion needs twenty
// minutes of sustained one-sidedness, demotion needs ten minutes of sustained failure. It
// barely moves between polls, and that is the entire point: it is the list you leave open.
//
// Three presentation decisions carry meaning rather than taste:
//
//   CONFIRMED AT is on the row and is not decoration. Two stocks at conviction 80 are not
//   equally good if one was called at 10:30 and the other at 14:40, and the promotion time is
//   the only thing on the row that separates them. It is an absolute clock reading rather than
//   an elapsed one so it can be read straight onto a chart, and because it survives a fade:
//   once a row demotes there is no other record of when the day was called.
//
//   FADED DAYS ARE IN THEIR OWN SECTION, below, never mixed into the ranking. A trend day
//   that has stopped being one is the most dangerous row on the board — somebody is holding
//   it on a thesis that expired — and rendering it as a candidate would invert that.
//
//   PARTIAL READS SAY SO. After a restart the accumulators have only seen part of the
//   session, and a conviction of 90 measured over forty minutes is a different claim from one
//   measured over five hours. The row is marked rather than quietly presented as the latter.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLiveData } from "@/lib/live";
import { istClock } from "@/lib/format";
import { DataTable, Num, PctChip, SymbolCell, TableCard, type Col } from "@/components/table";
import { SourceBadge } from "@/components/ui";
import {
  actionClass, convictionBand, directionClass, PHASE_HELP, phaseClass,
  stateClass, STATE_HELP,
  type MomentumRow, type TrendBoard, type TrendPhase,
} from "@/lib/momentum";

/**
 * Polled at half the scanner's rate.
 *
 * The underlying reading changes on the scale of tens of minutes — a phase cannot promote in
 * under twenty and cannot demote in under ten — so a faster poll would spend requests to
 * redraw the same rows. The one thing that does move quickly is the pullback entry, and that
 * is what the scanner and the signals feed are for.
 */
const TREND_REFRESH_MS = 40_000;

/* ------------------------------------------------------------------------ pieces --- */

const Pill = ({ children, cls, title }: { children: React.ReactNode; cls: string; title?: string }) => (
  <span
    title={title}
    className={`inline-block rounded-full border px-2.5 py-[5px] text-[12px] font-bold whitespace-nowrap ${cls}`}
  >
    {children}
  </span>
);

/** The conviction number, with its phase underneath. The ranking key, made legible. */
function ConvictionCell({ row }: { row: MomentumRow }) {
  const c = row.conviction;
  if (!c || !c.ready) return <span className="text-muted text-[13px]">—</span>;

  const band = convictionBand(c.score);
  return (
    <div className="flex items-center gap-2.5 min-w-[132px]">
      <span
        className="inline-block min-w-[46px] text-center rounded-[8px] px-2 py-[6px] text-[15px] leading-[13px] font-black tabular-nums"
        style={{ background: band.bg, color: band.fg }}
        title={c.summary}
      >
        {c.score.toFixed(0)}
      </span>
      <div className="flex flex-col gap-1">
        <Pill cls={phaseClass(c.phase)} title={PHASE_HELP[c.phase]}>
          {c.phase}
        </Pill>
        {c.partial && (
          <span
            className="text-[11px] text-amber-300/80"
            title={c.note ?? "the scanner did not watch the whole session, so every share on this row is partial"}
          >
            partial read
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * The evidence, in the four numbers that actually separate a trend day from a chop day.
 *
 * Crossings is the one to read first and the least obvious: it is the only reading here that
 * a gap cannot fake. A stock that gapped 4% and went nowhere has the same change, the same
 * relative volume and the same relative strength as one that walked up 4% — and eleven
 * crossings against one.
 */
function ShapeCell({ row }: { row: MomentumRow }) {
  const c = row.conviction;
  if (!c || !c.ready) return <span className="text-muted text-[13px]">—</span>;

  const side = c.direction === "Bullish" ? "above" : c.direction === "Bearish" ? "below" : "either side of";
  const item = (label: string, value: string, title: string, good: boolean) => (
    <span title={title} className={good ? "text-[#c7d2dc]" : "text-muted"}>
      <span className="text-muted">{label} </span>
      <span className="font-bold tabular-nums">{value}</span>
    </span>
  );

  return (
    <div className="flex flex-col gap-[3px] text-[12px] min-w-[164px]">
      {item(
        "VWAP",
        c.vwapAdherence == null ? "—" : `${(c.vwapAdherence * 100).toFixed(0)}%`,
        `Share of the session spent ${side} VWAP. A one-sided day sits above 90%.`,
        (c.vwapAdherence ?? 0) >= 0.9,
      )}
      {item(
        "crossings",
        c.vwapCrossings == null ? "—" : String(c.vwapCrossings),
        "How many times price changed sides of VWAP today. A trend day does it 0–2 times; a chop day " +
          "eight or more. The only reading here a gap cannot fake.",
        (c.vwapCrossings ?? 99) <= 2,
      )}
      {item(
        "path eff",
        c.sessionEfficiency == null ? "—" : c.sessionEfficiency.toFixed(2),
        "Net move ÷ total distance travelled, over the WHOLE session. Not the same scale as the " +
          "three-minute figure on the scanner — 0.30 here is a strong trend day.",
        (c.sessionEfficiency ?? 0) >= 0.3,
      )}
      {item(
        "deepest dip",
        c.deepestPullbackAtr == null ? "—" : `${c.deepestPullbackAtr.toFixed(2)} ATR`,
        "The largest counter-trend move of the day. This is the one a holder feels: a 4% gain through " +
          "a 2.5% mid-session gut is not a position anybody actually held.",
        (c.deepestPullbackAtr ?? 9) <= 0.45,
      )}
    </div>
  );
}

/**
 * The clock time the phase machine called it, which `Held` deliberately does not say.
 *
 * The two columns are not the same reading. `Held` is elapsed and keeps moving; this is fixed
 * the moment the promotion happens, so it can be read straight onto a chart and compared
 * across rows — "everything confirmed at 10:30" and "this one confirmed at 14:10" are
 * different days, and the elapsed figures alone never show that.
 *
 * It also outlives the phase. A demoted row restarts `Held` from its demotion, so after a fade
 * this is the only record left of when the day was called — which is precisely the row somebody
 * is still holding.
 */
function ConfirmedAtCell({ row }: { row: MomentumRow }) {
  const c = row.conviction;

  if (!c?.confirmedAt)
    return (
      <span
        className="text-muted text-[13px]"
        title={
          c?.phase === "Forming"
            ? "Still forming — it has not been confirmed today. Confirmation needs the conviction to hold above the confirm score for 20 minutes, and cannot happen before minute 75 of the session."
            : "This row has not reached Confirmed at any point today."
        }
      >
        —
      </span>
    );

  const current = c.phase === "Confirmed";
  return (
    <div className="flex flex-col gap-[2px] min-w-[86px]">
      <span
        className={`text-[13px] font-bold tabular-nums ${current ? "text-[#c7d2dc]" : "text-muted"}`}
        title={
          current
            ? "When this was promoted to Confirmed today. It has held the phase continuously since."
            : "When this was confirmed earlier today. It has since been demoted — the phase below is what it is now."
        }
      >
        {istClock(c.confirmedAt)}
      </span>
      {/* A row can be confirmed, fade, and climb back to Forming — so this says which of the
          two happened rather than assuming the demotion was terminal. */}
      {!current && (
        <span className="text-[11px] text-amber-300/70">
          {c.phase === "Forming" ? "back to forming" : "then faded"}
        </span>
      )}
    </div>
  );
}

/** What the timing layer says right now, and what it would buy. */
function EntryCell({ row }: { row: MomentumRow }) {
  const s = row.signal;
  if (!s) return <span className="text-muted text-[13px]">—</span>;

  return (
    <div className="flex flex-col gap-1 min-w-[150px]">
      <div className="flex items-center gap-1.5">
        <Pill cls={stateClass(s.state)} title={STATE_HELP[s.state]}>{s.state}</Pill>
        <Pill cls={actionClass(s.action)}>{s.action}</Pill>
      </div>
      {s.strike ? (
        <span className="text-[12px] text-[#c7d2dc]" title={s.strike.reason}>
          {s.strike.label} @ ₹{s.strike.entryCost.toFixed(2)}
          {s.strike.costPerLot != null && (
            <span className="text-muted"> · ₹{s.strike.costPerLot.toLocaleString("en-IN")}/lot</span>
          )}
        </span>
      ) : (
        <span className="text-[12px] text-muted" title="This row was not in the option-chain shortlist this cycle, so no contract is named.">
          no chain this cycle
        </span>
      )}
      {/* The blockers are the honest half of the row. A Trending stock with no entry is
          waiting for a dip, and saying which gate is open is more useful than a bare Watch. */}
      {s.blockers.length > 0 && (
        <span className="text-[11px] text-muted line-clamp-2" title={s.blockers.join("\n")}>
          {s.blockers[0]}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------ table --- */

function columns(): Col<MomentumRow>[] {
  return [
    {
      h: "Stock",
      val: (r) => r.symbol,
      render: (r) => (
        <div className="flex flex-col gap-1">
          <SymbolCell sym={r.symbol} />
          <Link
            href={`/momentum-scanner/${encodeURIComponent(r.symbol)}`}
            className="text-[11px] text-muted hover:text-accent transition-colors pl-[37px]"
          >
            full breakdown →
          </Link>
        </div>
      ),
    },
    { h: "LTP", val: (r) => r.price, render: (r) => <Num>{r.price.toFixed(2)}</Num> },
    { h: "Chg %", val: (r) => r.changePct, render: (r) => <PctChip v={r.changePct} /> },
    {
      h: "Dir",
      val: (r) => r.conviction?.direction ?? "",
      render: (r) => (
        <span className={`text-[13px] font-bold ${directionClass(r.conviction?.direction ?? "Neutral")}`}>
          {r.conviction?.direction ?? "—"}
        </span>
      ),
    },
    {
      h: "Conviction",
      val: (r) => r.conviction?.score ?? -1,
      render: (r) => <ConvictionCell row={r} />,
    },
    {
      h: "Confirmed at",
      // Zero for a row that never confirmed, so sorting groups the un-confirmed together at
      // one end rather than scattering them through the times.
      val: (r) => r.conviction?.confirmedAt ?? 0,
      render: (r) => <ConfirmedAtCell row={r} />,
    },
    { h: "Session shape", render: (r) => <ShapeCell row={r} /> },
    { h: "Entry now", val: (r) => r.signal?.entryQuality ?? -1, render: (r) => <EntryCell row={r} /> },
  ];
}

/* ------------------------------------------------------------------------- page --- */

/**
 * Why the list is empty, which is a different sentence at four different times of day.
 *
 * The single message this replaced explained the promotion gates — true, and the right answer
 * at 11:00. Read at 00:05 it says "nothing can be called Forming before minute 30 of the
 * session" about a session that is nine hours away, which describes the board as though it were
 * failing to find something rather than waiting for the market to open. An empty list has to say
 * WHICH kind of empty it is, or the honest one is indistinguishable from a broken one.
 */
function emptyState(data: TrendBoard) {
  const minute = data.market.minuteOfSession;
  const open = data.market.marketOpen;

  if (minute <= 0 && !open)
    return {
      head: "The market is closed.",
      body: (
        <>
          Trading opens at <span className="text-[#c7d2dc]">09:15 IST</span>. This board is measured
          from the session as it happens, so it has nothing to rank until then — the first rows can
          appear from 09:45, and nothing is Confirmed before 10:30. If the scanner is started later
          in the day it rebuilds the part of the session it missed from the exchange&apos;s own
          candles, so a late start does not cost you the morning.
        </>
      ),
    };

  if (minute < data.phase.formingFrom)
    return {
      head: `Too early — minute ${minute} of the session.`,
      body: (
        <>
          Nothing can be called Forming before minute{" "}
          <span className="text-[#c7d2dc]">{data.phase.formingFrom}</span> (09:45). Half an hour is
          the least that can tell a trend from an opening drive, and an opening drive that reverses
          at 09:50 is the most common shape on the tape.
        </>
      ),
    };

  if (minute >= 375)
    return {
      head: "No one-sided days today.",
      body: (
        <>
          The session is over and nothing held a one-sided shape long enough to be called. That is a
          real answer rather than a gap — on a rotational day the whole board legitimately reads
          empty.
        </>
      ),
    };

  return {
    head: "No one-sided days yet.",
    body: (
      <>
        Nothing can be called Forming before minute {data.phase.formingFrom} of the session, or
        Confirmed before minute {data.phase.confirmedFrom} — half an hour is the least that can tell
        a trend from an opening drive, and an opening drive that reverses at 09:50 is the most common
        shape on the tape. An empty list at 11:00 is a real answer: not every day has one.
      </>
    ),
  };
}

const PHASE_TABS: Array<{ key: "all" | TrendPhase; label: string }> = [
  { key: "all", label: "All" },
  { key: "Confirmed", label: "Confirmed" },
  { key: "Forming", label: "Forming" },
];

export default function TrendDayClient({ initial, source }: { initial: TrendBoard; source?: string }) {
  const { data } = useLiveData<TrendBoard>(initial, "/api/momentum/trend", TREND_REFRESH_MS);
  const [tab, setTab] = useState<"all" | TrendPhase>("all");

  const rows = useMemo(
    () => (tab === "all" ? data.rows : data.rows.filter((r) => r.conviction?.phase === tab)),
    [data.rows, tab],
  );

  const cols = useMemo(columns, []);
  const asOf = istClock(data.asOf, true);
  const blank = emptyState(data);

  return (
    <main className="px-0 py-1 sm:p-5 flex flex-col gap-4 sm:gap-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Trend Day</h1>
          <p className="text-muted text-sm mt-1 max-w-3xl">
            Stocks going <strong className="text-[#c7d2dc]">one direction all session</strong>. Ranked by how
            one-sided the whole day has been — VWAP adherence, how many times price changed sides, path
            efficiency and the deepest counter-move — rather than by how much it moved in the last three
            minutes. This list is meant to sit still: a stock has to hold its shape for{" "}
            {/* the numbers come from the config, so the copy cannot drift from the model */}
            <span className="text-[#c7d2dc]">20 minutes</span> to be promoted and fail it for{" "}
            <span className="text-[#c7d2dc]">10</span> to be demoted.
          </p>
        </div>
        <SourceBadge source={source} />
      </div>

      <div className="flex items-center gap-3 flex-wrap text-sm">
        <span className="text-muted">
          {data.trendConfirmed} confirmed · {data.trendForming} forming · {data.trendFaded} faded
        </span>
        <span className="text-muted/60">·</span>
        <span className="text-muted">
          confirmable from minute {data.phase.confirmedFrom} of the session
        </span>
        <span className="text-muted/60">·</span>
        <span className="text-muted">as of {asOf} IST</span>
      </div>

      {data.warnings.length > 0 && (
        <div className="panel p-4 text-sm text-amber-300/90 flex flex-col gap-1">
          {data.warnings.map((w) => (
            <p key={w}>! {w}</p>
          ))}
        </div>
      )}

      <TableCard
        title="One-sided days"
        desc={
          "A trend day is not the same as a stock that is up a lot. This ranks on the SHAPE of the " +
          "session: how much of it was spent on one side of VWAP, how many times that changed, how much " +
          "of the total distance travelled was net progress, and how deep the worst counter-move went. " +
          "A stock that gapped and then chopped scores badly here however large its change on the day."
        }
        live
        right={
          <div className="flex flex-wrap items-center gap-1">
            {PHASE_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`px-3 py-2 sm:py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  tab === t.key ? "bg-accent text-white" : "text-muted hover:bg-chip hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        }
      >
        <DataTable
          cols={cols}
          rows={rows}
          rowKey={(r) => r.symbol}
          height={620}
          empty={
            <div className="text-muted text-sm py-6 text-center max-w-xl mx-auto">
              <p className="mb-1 font-semibold text-[#c7d2dc]">{blank.head}</p>
              <p>{blank.body}</p>
            </div>
          }
        />
      </TableCard>

      {/*
        Faded days, kept apart from the ranking above.
        Somebody is holding these. That is the whole reason they are on the page — and the whole
        reason they must not appear in a list a reader scans for candidates.
      */}
      {data.fading.length > 0 && (
        <TableCard
          title="Faded — was one-sided, has stopped being"
          desc={
            "These held a one-sided shape earlier and no longer do. Nothing here is a candidate. It is on " +
            "the page because a position opened on the earlier reading is still open, and the thesis " +
            "behind it has expired."
          }
        >
          <DataTable
            cols={[
              { h: "Stock", val: (r) => r.symbol, render: (r) => <SymbolCell sym={r.symbol} /> },
              { h: "LTP", val: (r) => r.price, render: (r) => <Num>{r.price.toFixed(2)}</Num> },
              { h: "Chg %", val: (r) => r.changePct, render: (r) => <PctChip v={r.changePct} /> },
              {
                h: "Peaked at",
                val: (r) => r.conviction?.peak ?? 0,
                render: (r) => (
                  <Num cls="text-amber-300">{(r.conviction?.peak ?? 0).toFixed(0)}</Num>
                ),
              },
              {
                h: "Now",
                val: (r) => r.conviction?.score ?? 0,
                render: (r) => <Num cls="text-bear">{(r.conviction?.score ?? 0).toFixed(0)}</Num>,
              },
              {
                h: "What happened",
                render: (r) => (
                  <span className="text-[12px] text-muted">{r.conviction?.summary ?? "—"}</span>
                ),
              },
            ]}
            rows={data.fading}
            rowKey={(r) => r.symbol}
            height={260}
          />
        </TableCard>
      )}

      <p className="text-muted text-xs max-w-3xl">
        Conviction is measured from the scanner&apos;s own 15-second poll, accumulated across the session —
        so it costs no extra data and is computed for every F&amp;O stock, not a shortlist. After a restart
        it only knows the part of the day it watched, and rows measured that way are marked{" "}
        <span className="text-amber-300/80">partial read</span>.
      </p>
    </main>
  );
}
