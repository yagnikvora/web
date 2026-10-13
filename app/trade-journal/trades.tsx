"use client";

// One session's positions, as a table on a desktop and as cards on a phone.
//
// THE TWO ARE THE SAME ROWS, NOT TWO FEATURES. Eleven columns on a 390px screen is a board that
// scrolls sideways twice to read one trade; the card puts the same eleven facts in reading order
// and drops nothing. Which one is showing is a media query, so neither can go stale against the
// other.

import { Col, DataTable } from "@/components/table";
import {
  ago, CHANNEL_LABEL, EXIT_LABEL, excursionFrom, inr, JournalDay, JournalTrade, JournalView,
  liveOf, pct, plural, prem, sessionClock,
} from "@/lib/journal";
import { holdLabel, holdMin, movePct, stopOf } from "./analytics";
import { OutcomeBadge, PathBar, pretty, sign, SymbolBlock, weekday } from "./parts";

/* ------------------------------------------------------------------------ the header --- */

function DayHeader({ day, trades, totals, dayNet, anyLive, balance, open, onToggle }: {
  day: string; trades: JournalTrade[]; totals: JournalDay["totals"]; dayNet: number; anyLive: boolean;
  balance: number | null;
  open: boolean; onToggle: () => void;
}) {
  const wins = totals.wins;
  const losses = totals.losses;
  const decided = wins + losses;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={`w-full text-left flex flex-wrap items-center gap-x-5 gap-y-2 px-4 sm:px-5 py-3.5
                  bg-black/20 hover:bg-black/30 transition-colors ${open ? "border-b border-border" : ""}`}
    >
      <div className="flex items-baseline gap-2">
        <span
          aria-hidden
          className={`text-muted text-[11px] transition-transform ${open ? "rotate-90" : ""}`}
        >
          ▶
        </span>
        <h2 className="text-[16px] font-bold tracking-tight">{pretty(day)}</h2>
        <span className="text-[11.5px] text-muted">{weekday(day)}</span>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-[11.5px] text-muted tabular-nums">{plural(trades.length, "trade")}</span>
        {decided > 0 && (
          <div className="flex items-center gap-2" title={`${wins} won, ${losses} lost`}>
            <div className="w-[54px] h-[5px] rounded-full bg-bear/25 overflow-hidden">
              <div className="h-full rounded-full bg-bull/80" style={{ width: `${(100 * wins) / decided}%` }} />
            </div>
            <span className="text-[11.5px] text-muted tabular-nums">
              {pct(totals.winRate, 0, false)} won
            </span>
          </div>
        )}
      </div>

      <div className="ml-auto flex items-baseline gap-3 tabular-nums">
        {/* Booked and marked are kept apart. One combined figure would move on every tick and
            still be labelled as the day's result. */}
        <span className={`text-[17px] font-bold ${sign(totals.netPnl)}`} title="booked">
          {inr(totals.netPnl, true)}
        </span>
        {anyLive && (
          <span
            className={`text-[12.5px] font-semibold ${sign(dayNet)}`}
            title="including open positions at their current mark"
          >
            {inr(dayNet, true)} <span className="text-accent font-normal">live</span>
          </span>
        )}
        {/* What the account holds once this day is counted. A fixed-width column, so a month of
            these reads down the page as one running figure. */}
        {balance !== null && (
          <span
            className="min-w-[124px] text-right text-[11.5px] text-muted"
            title={`The month's starting capital plus every net result up to and including ${pretty(day)}${
              anyLive ? ", with open positions at their current mark" : ""
            }. Set the starting capital from the account menu, top right.`}
          >
            balance{" "}
            <span className="text-[13.5px] font-semibold text-white">{inr(balance)}</span>
          </span>
        )}
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------------ the section --- */

/**
 * One session.
 *
 * COLLAPSIBLE, BECAUSE A MONTH IS EIGHTEEN OF THESE. Expanded they run to fifteen thousand
 * pixels, which is not a document anybody scrolls through looking for the 14th — and the header
 * already carries what the scroll was for: the date, the count, the win split and the money. The
 * caller decides what a range opens on; a single day opens expanded, a month opens as a list.
 */
export function DaySection({ day, trades, totals, config, nowMs, balance = null, open, onToggle, onEdit, onExit }: {
  day: string;
  /** The account at the end of this day, or null when no starting capital is set. */
  balance?: number | null;
  trades: JournalTrade[];
  totals: JournalDay["totals"];
  /** The whole thing rather than one figure of it: the rows need the charges AND the stop. */
  config: JournalView["config"];
  /** 0 when the page is not polling — the "12s ago" line is hidden rather than frozen. */
  nowMs: number;
  open: boolean;
  onToggle: () => void;
  onEdit: (t: JournalTrade) => void;
  /** Open the confirmation dialog on this row. Selling is the dialog's job, not the table's. */
  onExit: (t: JournalTrade) => void;
}) {
  // Every money column asks the same question of a row: is it closed, or is it open with a
  // price on it? Answered once here so they cannot disagree.
  const liveFor = (r: JournalTrade) => liveOf(r, config.chargePerLot);
  const dayNet = totals.netPnl + trades.reduce((n, r) => n + (liveFor(r)?.net ?? 0), 0);
  const anyLive = trades.some((r) => liveFor(r) !== null);

  const cols: Col<JournalTrade>[] = [
    {
      h: "Symbol",
      val: (r) => r.symbol,
      render: (r) => <SymbolBlock symbol={r.symbol} direction={r.direction} channel={r.channel} />,
    },
    {
      h: "Contract",
      val: (r) => r.contract?.label ?? "",
      render: (r) => (
        <div className="min-w-[96px]">
          <div className="tabular-nums text-[12.5px] font-medium">
            {r.contract?.label ?? <span className="text-muted font-normal">no chain</span>}
          </div>
          <div className="text-[10.5px] text-muted">
            {r.contract ? `${r.lots} lot × ${r.contract.lotSize}` : "—"}
          </div>
        </div>
      ),
    },
    {
      h: "In → Out",
      val: (r) => r.entry.minute,
      render: (r) => {
        const l = liveFor(r);
        const out = r.exit
          ? (r.exit.reason === "untracked" ? null : r.exit.premium)
          : (l?.premium ?? null);
        return (
          <div className="min-w-[136px] tabular-nums">
            <div className="text-[12.5px] flex items-center gap-1.5">
              <span>{prem(r.entry.premium)}</span>
              <span className="text-muted/60">→</span>
              <span className={r.exit ? "" : sign(l?.pct)}>{prem(out)}</span>
              {!r.exit && !l && <span className="text-accent text-[10.5px]">no price</span>}
            </div>
            <div className="text-[10.5px] text-muted flex items-center gap-1">
              <span>{sessionClock(r.entry.minute)}</span>
              {r.entry.source === "manual" && <span className="text-accent">·you</span>}
              <span className="text-muted/50">→</span>
              <span>
                {r.exit
                  ? (r.exit.reason === "untracked" ? "—" : sessionClock(r.exit.minute))
                  : (l && nowMs > 0 ? ago(l.at, nowMs) : "open")}
              </span>
              {r.exit?.source === "manual" && <span className="text-accent">·you</span>}
            </div>
          </div>
        );
      },
    },
    {
      /*
       * The level the position would have been cut at — beside the entry and the exit, because
       * it is the third price in the same story and reads as nonsense anywhere else.
       *
       * It replaced the charges column, which printed the same ₹120 on every row: charges are a
       * flat rate per lot, so the per-row figure carried no information the header did not. The
       * running total is still in the hero and in the "Charges paid" tile.
       */
      h: "Stop loss",
      val: (r) => stopOf(r, config).pct,
      render: (r) => {
        const s = stopOf(r, config);
        return (
          <div
            className="min-w-[88px] tabular-nums"
            title={
              s.armed
                ? `Locked. This position was up ${pct(config.armAtPct, 0, false)} at some point, `
                  + `which moves the stop once to ${pct(s.pct, 0)} of premium — it does not move again.`
                : `The opening stop, ${pct(s.pct, 0)} of premium. It moves once to `
                  + `${pct(config.lockPct, 0)} if the position ever gets up `
                  + `${pct(config.armAtPct, 0, false)}.`
            }
          >
            <div className="text-[12.5px]">{prem(s.premium)}</div>
            <div className={`text-[10.5px] ${s.armed ? "text-bull" : "text-muted"}`}>
              {pct(s.pct, 0)}
              {s.armed && <span className="ml-1">locked</span>}
            </div>
          </div>
        );
      },
    },
    {
      h: "Held",
      val: (r) => holdMin(r) ?? -1,
      render: (r) => (
        <span className="tabular-nums text-[12px] text-muted whitespace-nowrap">
          {holdLabel(holdMin(r))}
        </span>
      ),
    },
    {
      h: "Path",
      val: (r) => r.mfePct ?? 0,
      render: (r) => {
        // How much of the trade the two excursions actually cover. A row whose marking started
        // hours after entry has a blind window at the front, and the honest thing is to say so
        // rather than let two confident percentages imply the whole day.
        const from = excursionFrom(r);
        const l = liveFor(r);
        const at = r.exit ? movePct(r) : (l?.pct ?? null);
        const hasTimes = r.mfeMinute != null || r.maeMinute != null;
        const gap = from === null ? null
          : `Not watched from entry. This row was first priced at ${sessionClock(from)}, so `
            + `${sessionClock(r.entry.minute)}–${sessionClock(from)} is missing from both figures. `
            + "Settling the day re-reads the contract's own candles and fills it in.";
        return (
          <div
            className="min-w-[146px]"
            title={
              `Worst ${pct(r.maePct)}${r.maeMinute == null ? "" : ` at ${sessionClock(r.maeMinute)}`}`
              + ` · best ${pct(r.mfePct)}${r.mfeMinute == null ? "" : ` at ${sessionClock(r.mfeMinute)}`}`
              + (at === null ? "" : ` · ${r.exit ? "out at" : "now"} ${pct(at)}`)
              + ". Entry is the centre line; the notch is where it got out."
            }
          >
            {/* Worst on the left, best on the right — the same order as the track below, which
                runs from loss through entry to gain. They were the other way round, over a bar
                that disagreed with them, which is the one arrangement guaranteed to mislead. */}
            <div className="flex items-baseline justify-between text-[10.5px] tabular-nums mb-1 gap-2">
              <span className="text-bear">
                <span className="text-muted/60 mr-1">worst</span>{pct(r.maePct)}
              </span>
              <span className="text-bull">
                <span className="text-muted/60 mr-1">best</span>{pct(r.mfePct)}
              </span>
            </div>
            <PathBar mfe={r.mfePct} mae={r.maePct} exit={at} live={!r.exit} />
            <div className="flex items-baseline justify-between text-[9.5px] text-muted mt-1 gap-1">
              {hasTimes ? (
                <>
                  <span className="tabular-nums">{sessionClock(r.maeMinute)}</span>
                  {gap && <span className="text-amber-400/90 shrink-0" title={gap}>from {sessionClock(from)}</span>}
                  <span className="tabular-nums">{sessionClock(r.mfeMinute)}</span>
                </>
              ) : gap ? (
                <span className="text-amber-400/90 mx-auto" title={gap}>from {sessionClock(from)}</span>
              ) : (
                <span className="opacity-0">·</span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      h: "Outcome",
      val: (r) => (r.exit ? r.exit.reason : "open"),
      render: (r) => <OutcomeBadge reason={r.exit?.reason ?? null} live={liveFor(r)?.net ?? null} />,
    },
    {
      h: "Used",
      val: (r) => r.amountUsed ?? 0,
      render: (r) => <span className="tabular-nums text-[12px] text-muted">{inr(r.amountUsed)}</span>,
    },
    {
      h: "Gross",
      val: (r) => r.grossPnl ?? liveFor(r)?.gross ?? 0,
      render: (r) => {
        const g = r.grossPnl ?? liveFor(r)?.gross ?? null;
        return <span className={`tabular-nums text-[12.5px] ${sign(g)}`}>{inr(g, true)}</span>;
      },
    },
    {
      h: "Net",
      val: (r) => r.netPnl ?? liveFor(r)?.net ?? 0,
      render: (r) => {
        const l = liveFor(r);
        const net = r.netPnl ?? l?.net ?? null;
        const p = r.netPct ?? l?.netPct ?? null;
        return (
          <div className="min-w-[92px] tabular-nums text-right">
            <div className={`text-[14px] font-bold ${sign(net)}`}>{inr(net, true)}</div>
            <div className={`text-[10.5px] ${sign(p)}`}>
              {pct(p)}
              {/* Marked, not booked. The row has to say which it is, or the two become one
                  number and the day's result stops being trustworthy. */}
              {l && <span className="text-accent ml-1">live</span>}
            </div>
          </div>
        );
      },
    },
    {
      // WHAT THE EXIT RULE ACTUALLY CONTRIBUTED. Every other column describes the trade that was
      // taken; this one describes the trade that was not, and the gap between them is the whole
      // value of the target, the stop and the checkpoint. A row squared off at 15:15 is its own
      // counterfactual, so it reads a flat "—" rather than a zero nobody needs to compare.
      h: "At 3:15",
      val: (r) => r.dayEnd?.netPnl ?? 0,
      render: (r) => {
        const d = r.dayEnd;
        if (!d) return <span className="text-[12px] text-muted">—</span>;
        const held = r.netPnl === null ? null : d.netPnl - r.netPnl;
        const flat = held !== null && Math.abs(held) < 1;
        return (
          <div
            className="min-w-[86px] tabular-nums text-right"
            title={
              `The contract closed the session at ${prem(d.premium)} — ${pct(d.pct)} on the entry, `
              + `${inr(d.netPnl, true)} after the same charges.`
              + (held === null || flat
                ? " This position ran to the square-off, so that is what it booked."
                : held > 0
                  ? ` Getting out early cost ${inr(Math.abs(held))} against simply holding.`
                  : ` Getting out early saved ${inr(Math.abs(held))} against simply holding.`)
            }
          >
            <div className={`text-[12.5px] ${sign(d.netPnl)}`}>{inr(d.netPnl, true)}</div>
            <div className={`text-[10.5px] ${flat ? "text-muted" : sign(held === null ? null : -held)}`}>
              {held === null || flat ? "held to close" : `${held > 0 ? "left" : "saved"} ${inr(Math.abs(held))}`}
            </div>
          </div>
        );
      },
    },
    {
      h: "",
      render: (r) => (
        <div className="flex items-center gap-1.5 justify-end">
          {/* Only a position that is actually running can be sold. A closed row has no exit to
              take, and offering the button there would be an action that can only fail. */}
          {r.status === "open" && !r.exit && (
            <button
              onClick={() => onExit(r)}
              className="text-[11px] px-2 py-1 rounded-lg border border-border text-muted hover:border-bear
                         hover:bg-bear/10 hover:text-bear whitespace-nowrap transition-colors"
              title="Close this position at the live bid. Asks for confirmation first."
            >
              Exit
            </button>
          )}
          <button
            onClick={() => onEdit(r)}
            className={`text-[11px] px-2 py-1 rounded-lg border whitespace-nowrap transition-colors ${
              r.edited
                ? "border-accent/40 bg-accent/[0.08] text-accent"
                : "border-border text-muted hover:bg-chip hover:text-white"
            }`}
            title="Replace these prices with your actual fill"
          >
            {r.edited ? "edited" : "my fill"}
          </button>
        </div>
      ),
    },
  ];

  return (
    <section className="rounded-2xl border border-border bg-panel overflow-hidden">
      <DayHeader
        day={day} trades={trades} totals={totals} dayNet={dayNet} anyLive={anyLive}
        balance={balance} open={open} onToggle={onToggle}
      />

      {open && (
        <>
          <div className="hidden md:block">
            <DataTable cols={cols} rows={trades} rowKey={(r) => r.id} height={460} pin={1} />
          </div>

          <div className="md:hidden divide-y divide-border">
            {trades.map((t) => (
              <TradeCard
                key={t.id} t={t} config={config} nowMs={nowMs}
                onEdit={onEdit} onExit={onExit}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- the card --- */

/** One position, laid out for a thumb. Same facts as the row, in the order they are asked for. */
function TradeCard({ t, config, nowMs, onEdit, onExit }: {
  t: JournalTrade; config: JournalView["config"]; nowMs: number;
  onEdit: (t: JournalTrade) => void; onExit: (t: JournalTrade) => void;
}) {
  const l = liveOf(t, config.chargePerLot);
  const net = t.netPnl ?? l?.net ?? null;
  const p = t.netPct ?? l?.netPct ?? null;
  const out = t.exit ? (t.exit.reason === "untracked" ? null : t.exit.premium) : (l?.premium ?? null);
  const at = t.exit ? movePct(t) : (l?.pct ?? null);
  const from = excursionFrom(t);
  const stop = stopOf(t, config);

  return (
    <article className="px-4 py-3.5">
      <div className="flex items-start gap-3">
        <SymbolBlock symbol={t.symbol} direction={t.direction} channel={t.channel} />
        <div className="ml-auto text-right tabular-nums shrink-0">
          <div className={`text-[17px] font-bold leading-tight ${sign(net)}`}>{inr(net, true)}</div>
          <div className={`text-[11px] ${sign(p)}`}>
            {pct(p)}
            {l && <span className="text-accent ml-1">live</span>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3">
        <OutcomeBadge reason={t.exit?.reason ?? null} live={l?.net ?? null} />
        <span className="text-[11.5px] tabular-nums text-muted">
          {t.contract?.label ?? "no chain"}
          {t.contract && <span className="opacity-60"> · {t.lots}×{t.contract.lotSize}</span>}
        </span>
        <span className="ml-auto text-[11px] text-muted tabular-nums">{holdLabel(holdMin(t))}</span>
      </div>

      <div className="mt-3">
        {/* Same order as the track: worst on the left, best on the right. */}
        <div className="flex items-center justify-between text-[10.5px] tabular-nums mb-1">
          <span className="text-bear"><span className="text-muted/60 mr-1">worst</span>{pct(t.maePct)}</span>
          {from !== null && (
            <span className="text-amber-400/90" title={`only watched from ${sessionClock(from)}`}>
              from {sessionClock(from)}
            </span>
          )}
          <span className="text-bull"><span className="text-muted/60 mr-1">best</span>{pct(t.mfePct)}</span>
        </div>
        <PathBar mfe={t.mfePct} mae={t.maePct} exit={at} live={!t.exit} />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted tabular-nums mt-3">
        <span>
          {prem(t.entry.premium)} <span className="opacity-50">→</span> {prem(out)}
        </span>
        <span className="opacity-70">
          {sessionClock(t.entry.minute)} <span className="opacity-50">→</span>{" "}
          {t.exit
            ? (t.exit.reason === "untracked" ? "—" : sessionClock(t.exit.minute))
            : (l && nowMs > 0 ? ago(l.at, nowMs) : "open")}
        </span>
        <span className="opacity-70">used {inr(t.amountUsed)}</span>
        <span className={stop.armed ? "text-bull" : "opacity-70"}>
          stop {prem(stop.premium)} · {pct(stop.pct, 0)}{stop.armed ? " locked" : ""}
        </span>
        {/* The desktop's "At 3:15", in the phone's own idiom: what the rule contributed, which is
            the only part of the counterfactual worth a line on a 390px screen. */}
        {t.dayEnd && (() => {
          const held = t.netPnl === null ? null : t.dayEnd!.netPnl - t.netPnl;
          const flat = held !== null && Math.abs(held) < 1;
          return (
            <span className={held === null || flat ? "opacity-70" : sign(-held)}>
              at 3:15 {inr(t.dayEnd!.netPnl, true)}
              {held !== null && !flat && ` · ${held > 0 ? "left" : "saved"} ${inr(Math.abs(held))}`}
            </span>
          );
        })()}
      </div>

      {t.note && <p className="text-[11.5px] text-white/70 mt-2 italic">{t.note}</p>}

      <div className="flex items-center gap-2 mt-3">
        {t.status === "open" && !t.exit && (
          <button
            onClick={() => onExit(t)}
            className="text-[11.5px] px-2.5 py-1.5 rounded-lg border border-bear/40 text-bear bg-bear/[0.08]"
          >
            Exit at bid
          </button>
        )}
        <button
          onClick={() => onEdit(t)}
          className={`text-[11.5px] px-2.5 py-1.5 rounded-lg border ${
            t.edited ? "border-accent/40 bg-accent/[0.08] text-accent" : "border-border text-muted"
          }`}
        >
          {t.edited ? "edited · my fill" : "my fill"}
        </button>
        <span className="ml-auto text-[10.5px] text-muted/70">
          {CHANNEL_LABEL[t.channel]}
          {t.exit && <> · {EXIT_LABEL[t.exit.reason]}</>}
        </span>
      </div>
    </article>
  );
}
