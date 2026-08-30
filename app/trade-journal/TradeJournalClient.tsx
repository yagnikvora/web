"use client";

// The trade journal, read at night.
//
// The whole point of this page is that a finished day needs no watching. It opens on today, and
// every control moves the date rather than the refresh — a settled day cannot change, and a page
// that re-fetches a finished record every minute is just asking the API to confirm it again.
//
// The one thing that DOES change is an open position during market hours. Those rows carry a
// running mark, so the table prices them live — gross, charges and net at what the position
// would fetch right now — and the page re-fetches on a timer while any of them are open.
//
// The polling is narrow on purpose. It runs only when the range on screen includes today AND
// something in it is still open AND the tab is visible; the moment the last position closes it
// stops on its own. A settled day cannot change, and re-asking for one is pure noise.
//
// THE LAYOUT IS A PORTFOLIO, NOT A LOG. The headline number and the curve that produced it come
// first, the statistics that qualify them come second, and the individual positions come last —
// because the question this page is opened with is "is this working", and only then "what
// happened on the 14th".

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ago, CHANNEL_LABEL, inr, istToday, JournalSyncProbe, JournalTrade, JournalView, liveTotals, pct,
  plural, rangeFor, RangeMode, sessionClock, shiftDay, syncLabel, type JournalChannel,
} from "@/lib/journal";
import EChart from "@/components/EChart";
import { isMarketOpen } from "@/lib/live";
import { calendar, holdLabel, rollup } from "./analytics";
import { dailyOption, equityOption, tradeOption } from "./charts";
import { EditDialog, ExitDialog } from "./dialogs";
import {
  Card, CalendarGrid, ChannelEdge, ExitMix, Hero, IconButton, Notice, Segmented, ShadowLab,
  short, StatCard, WinBar, pretty, weekday,
} from "./parts";
import { ExitLab } from "./ExitLab";
import { RangePicker } from "./RangePicker";
import { DaySection } from "./trades";

const CHANNELS: Array<JournalChannel | "all"> = ["all", "displacement", "trend-day", "ignition"];

const MODES: Array<{ k: RangeMode; label: string }> = [
  { k: "day", label: "Day" },
  { k: "week", label: "7 days" },
  { k: "month", label: "Month" },
  { k: "custom", label: "Custom" },
];

/*
 * How often to re-ask, in seconds. 0 is off — kept as a real choice because the page is also
 * read at night, when a timer would only spin.
 *
 * WHAT 2s DOES AND DOES NOT BUY. The page can ask this often; the numbers cannot answer that
 * fast. A mark on an open position is written by the API's `journalTick`, which runs on
 * `refresh.quoteMs` — 15 seconds by default, and floored at 5 by the config clamp. `journalRange`
 * serves what is stored and never re-prices on read, so at 2s roughly seven asks in eight come
 * back with the row unchanged.
 *
 * What it does buy is latency at the moment something DOES change: a mark, a stop firing, a
 * settle finishing or an exit taken on another machine reaches this page within two seconds
 * instead of within fifteen. That is the whole of it — for genuinely 2s-fresh marks the server
 * has to mark more often, or price on read.
 */
const REFRESH: Array<{ k: number; label: string }> = [
  { k: 0, label: "Off" },
  { k: 2, label: "2s" },
  { k: 15, label: "15s" },
  { k: 30, label: "30s" },
  { k: 60, label: "1m" },
];

type Lens = "curve" | "day" | "trade" | "calendar";

export default function TradeJournalClient({
  initial, source, mode: mode0 = "day", channel: channel0 = "all", customFrom: customFrom0,
}: {
  initial: JournalView;
  source?: string;
  /** The range the URL asked for. Resolved on the server — see the note in page.tsx. */
  mode?: RangeMode;
  channel?: JournalChannel | "all";
  customFrom?: string;
}) {
  const [view, setView] = useState<JournalView>(initial);
  const [anchor, setAnchor] = useState(initial.to);
  const [mode, setMode] = useState<RangeMode>(mode0);
  const [customFrom, setCustomFrom] = useState(customFrom0 ?? initial.from);
  const [channel, setChannel] = useState<JournalChannel | "all">(channel0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<JournalTrade | null>(null);
  /**
   * The row the exit dialog is open on, held as an ID rather than as the row itself.
   *
   * The dialog quotes a price and the page keeps polling underneath it. Holding a copy of the
   * trade would freeze that quote at the moment of the click, so a dialog left open for thirty
   * seconds would ask you to confirm a number the market has already left behind. Resolving the
   * id against the current `view` on every render means the figure in front of you keeps moving,
   * which is the truth about what you are agreeing to.
   */
  const [exitingId, setExitingId] = useState<string | null>(null);
  const [settling, setSettling] = useState(false);
  const [settleNote, setSettleNote] = useState<string | null>(null);
  const [lens, setLens] = useState<Lens>("day");
  /**
   * Which day sections are expanded, by date.
   *
   * Only the ones actually toggled are in here; everything else falls back to the rule below.
   * Holding a full map of every day would mean rebuilding it on every range change, and the
   * question "did the reader open this one" is exactly what the sparse map answers.
   */
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});
  const [pickerOpen, setPickerOpen] = useState(false);

  const [autoSec, setAutoSec] = useState(2);
  /**
   * Whether the NSE session is running.
   *
   * State on a slow timer rather than a call during render, for two reasons: a page opened at
   * 09:10 has to start polling when the bell rings without anything else nudging it, and a
   * render-time clock read would differ between the server's HTML and the browser's first pass.
   * Starting `false` means both agree, and the first tick corrects it a moment after mount.
   */
  const [marketOpen, setMarketOpen] = useState(false);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(0);

  useEffect(() => {
    const check = () => setMarketOpen(isMarketOpen());
    check();
    const id = setInterval(check, 20_000);
    return () => clearInterval(id);
  }, []);

  const unsettled = useMemo(
    () => view.days.reduce((n, d) => n + d.trades.filter((t) => !t.settled).length, 0),
    [view],
  );

  // The open book at its current marks. Recomputed from `view` rather than tracked separately, so
  // there is exactly one copy of "what is open right now" and it cannot drift from the table.
  const live = useMemo(() => liveTotals(view.days, view.config.chargePerLot), [view]);

  // Everything the API does not send: the curve, the drawdown, the averages.
  const roll = useMemo(() => rollup(view.days), [view]);

  const exiting = useMemo(
    () => (exitingId
      ? view.days.flatMap((d) => d.trades).find((t) => t.id === exitingId) ?? null
      : null),
    [view, exitingId],
  );

  const { from, to } = useMemo(() => rangeFor(mode, anchor, customFrom), [mode, anchor, customFrom]);

  const months = useMemo(() => calendar(from, to, roll.daily), [from, to, roll.daily]);

  /**
   * Whether an answer is still outstanding.
   *
   * A ref rather than `busy`, because the poll below needs to read it without the interval being
   * torn down and rebuilt on every request — and because it has to be true the instant `load` is
   * entered, which a state update is not.
   */
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ from, to });
      if (channel !== "all") qs.set("channel", channel);
      const res = await fetch(`/api/momentum/journal?${qs}`, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok || !j?.data) throw new Error(j?.error ?? `journal API returned ${res.status}`);
      setView(j.data as JournalView);
      setLoadedAt(Date.now());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [from, to, channel]);

  // Skips the first run: the server already fetched exactly this range.
  const [primed, setPrimed] = useState(false);
  useEffect(() => {
    if (!primed) { setPrimed(true); return; }
    // A new range starts from the default again. `load` only changes identity when the range or
    // the channel does, so this clears exactly when the day list underneath is being replaced —
    // and a "collapse all" chosen for a month does not follow you into a single day.
    setOpenDays({});
    void load();
  }, [load, primed]);

  /*
   * Keep the address bar on the range being read.
   *
   * `replaceState` rather than a router push: this is not navigation, it is a bookmark being
   * kept current, and a history entry per date-arrow click would turn the back button into an
   * undo stack for a stepper. What it buys is that a journal can be linked — "look at the 14th"
   * is a URL — and that a refresh comes back to the same day instead of to today.
   */
  useEffect(() => {
    const qs = new URLSearchParams({ d: anchor });
    if (mode !== "day") qs.set("mode", mode);
    if (mode === "custom") qs.set("from", customFrom);
    if (channel !== "all") qs.set("channel", channel);
    window.history.replaceState(null, "", `${window.location.pathname}?${qs}`);
  }, [anchor, mode, customFrom, channel]);

  /**
   * Run the settlement pass, then reload.
   *
   * Deliberately a button rather than something the page does on its own: it spends Upstox candle
   * requests, and a page that quietly spends quota every time it is opened is how a request budget
   * disappears without anybody choosing to spend it.
   */
  const settle = useCallback(async () => {
    setSettling(true);
    setSettleNote(null);
    try {
      const res = await fetch("/api/momentum/journal/settle", { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? `settle failed (${res.status})`);
      const n = j?.data?.settled ?? 0;
      setSettleNote(
        n
          ? `${plural(n, "trade")} settled from the contract's candles.`
          : (j?.note ?? "Nothing was outstanding."),
      );
      await load();
    } catch (e) {
      setSettleNote((e as Error).message);
    } finally {
      setSettling(false);
    }
  }, [load]);

  const today = istToday();
  const t = view.totals;
  const hasTrades = t.trades > 0;

  /*
   * The refresh loop.
   *
   * The timer has to be on, and the range on screen has to reach today — a settled day cannot
   * change, and re-asking for one is pure noise.
   *
   * The third condition used to be "and something in it is still open", which quietly broke the
   * case this page is most wanted in. A live session starts with an EMPTY journal: at 09:15
   * nothing is open, so nothing polled, so the first alert of the day never appeared on its own
   * and you had to press the refresh button to discover it. The same hole reopened every time
   * the book went flat. So it now also polls whenever the market is simply open, and the "still
   * open" clause is kept alongside it for the one case it still covers on its own — a position
   * carried past 15:30 while the page is left up.
   */
  const polling = autoSec > 0 && to >= today && (live.open > 0 || marketOpen);

  useEffect(() => {
    if (!polling) return;
    const id = setInterval(() => {
      // A tab in the background is a tab nobody is reading. Skipping it keeps a journal left
      // open overnight from spending a request every two seconds until morning.
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      // And a slow answer must not queue another ask behind it. At 15s that could not really
      // happen; at 2s a request that outlives its own interval would stack, and the page would
      // spend the rest of the session working through a backlog of stale answers. Only the
      // timer skips — a range change calls `load` directly and must always be fetched.
      if (inFlight.current) return;
      void load();
    }, autoSec * 1000);
    return () => clearInterval(id);
  }, [polling, autoSec, load]);

  // The clock behind "12s ago". Only ticks while polling, and starts at 0 so the server and the
  // browser render the same first frame — a live timestamp in the initial HTML is a hydration
  // mismatch waiting to happen.
  useEffect(() => {
    if (!polling) { setNowMs(0); return; }
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [polling]);

  // A day or two opens expanded; a month opens as a list of headers you can drop into. Eighteen
  // open tables is not a page anybody reads top to bottom.
  const openByDefault = view.days.length <= 3;
  const isOpen = (day: string) => openDays[day] ?? openByDefault;
  const allOpen = view.days.every((d) => isOpen(d.day));

  /**
   * Switch range mode, and give Custom something worth looking at.
   *
   * Arriving on Custom from a single day would leave both ends on the same date — a "custom
   * range" that is indistinguishable from Day, and a picker you have to use before the mode
   * means anything. So a degenerate range is widened to the last 30 days, and the picker opens
   * on the spot for anyone who wanted a different one.
   */
  const pickMode = (m: RangeMode) => {
    setMode(m);
    if (m !== "custom") { setPickerOpen(false); return; }
    if (customFrom >= anchor) setCustomFrom(shiftDay(anchor, -29));
    setPickerOpen(true);
  };

  const oneDay = from === to;
  const rangeLabel = oneDay
    ? `${pretty(from)} · ${weekday(from)}`
    : `${pretty(from)} → ${pretty(to)}`;

  /*
   * Which views of the performance panel this range can actually support, and which one it opens
   * on. Derived rather than corrected in an effect, so a range change can never leave a tab
   * selected that has no chart behind it.
   *
   * The default is the view that adds something the hero has not already said: over a range that
   * is the shape of the days, and over a single session it is the trades themselves.
   */
  const lenses: Array<{ k: Lens; label: string }> = [
    { k: "curve", label: "Curve" },
    ...(oneDay ? [] : [{ k: "day" as Lens, label: "By day" }]),
    { k: "trade", label: "By trade" },
    ...(oneDay ? [] : [{ k: "calendar" as Lens, label: "Calendar" }]),
  ];
  const shownLens: Lens = lenses.some((l) => l.k === lens) ? lens : oneDay ? "trade" : "day";

  const liveStatus = (
    <div className="flex items-center gap-2 text-[11px] text-muted">
      {busy && <span className="text-accent">loading…</span>}
      {polling && nowMs > 0 && (
        <span
          className="inline-flex items-center gap-1.5"
          title={`re-asking every ${autoSec}s while a position is open`}
        >
          <span className="w-[6px] h-[6px] rounded-full bg-bull animate-pulse" />
          {loadedAt === null ? "live" : `updated ${ago(loadedAt, nowMs)}`}
        </span>
      )}
      <StoreBadge sync={view.sync} />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------------------ the title --- */}
      <header className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h1 className="text-[26px] sm:text-3xl font-extrabold tracking-tight">Trade Journal</h1>
          <p className="text-muted text-[12.5px] mt-1 max-w-3xl leading-relaxed">
            Every alert this app sent, recorded as a position and settled from the contract&apos;s own
            1-minute candles after the close. Entry is the ask at signal time; the exit is{" "}
            <span className="text-white">+{Math.round(100 * view.config.tpPct)}%</span> or{" "}
            <span className="text-white">−{Math.round(100 * view.config.slPct)}%</span> of premium
            {/* The checkpoint, only mentioned when it is switched on — JOURNAL_ARM_AT_PCT=0
                turns it off, and describing a rule the record is not being graded under would
                be worse than saying nothing. */}
            {view.config.armAtPct ? (
              <>
                {" "}— with the stop moved once to{" "}
                <span className="text-white">{pct(view.config.lockPct, 0)}</span> after it has been
                up {pct(view.config.armAtPct, 0, false)}
              </>
            ) : null}
            , else squared off at {sessionClock(view.config.squareOffMin)} — or whenever you close a
            row yourself.
          </p>
        </div>
        <div className="ml-auto">{liveStatus}</div>
      </header>

      {/* ---------------------------------------------------------------- the controls --- */}
      {/*
        Sticky from `sm` up only. On a desktop this bar is one row and keeping it in reach while
        a long month scrolls is exactly right. On a phone it wraps to four rows — pinning 290px
        of controls over the top of the reading area would cost more than it saves, so there it
        scrolls away like anything else.
      */}
      <div
        /*
          `relative` is load-bearing, not decoration. `backdrop-blur` creates a stacking context,
          which scopes the range picker's popover to this bar — and on a phone, where the bar is
          not sticky, a bare `z-20` on a statically positioned element does nothing at all. The
          hero card below is `relative`, so it would paint straight over the open calendar.
        */
        className="relative sm:sticky sm:top-[59px] z-20 -mx-3 sm:-mx-5 px-3 sm:px-5 py-2.5 border-y border-border
                   bg-[#0a0e14] supports-[backdrop-filter]:bg-[#0a0e14]/85 backdrop-blur-md"
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {/* Day, 7 days and Month are all anchored on one date, so they get a stepper. Custom
              is the only mode with two independent ends, and it gets a control shaped like a
              range instead of a stepper standing in for one. */}
          {mode === "custom" ? (
            <RangePicker
              from={from}
              to={to}
              max={today}
              open={pickerOpen}
              onOpenChange={setPickerOpen}
              onChange={(f, t2) => { setCustomFrom(f); setAnchor(t2); }}
            />
          ) : (
            <div className="flex items-center gap-1.5">
              <IconButton onClick={() => setAnchor((a) => shiftDay(a, -1))} title="previous day">‹</IconButton>
              <input
                type="date"
                value={anchor}
                max={today}
                onChange={(e) => e.target.value && setAnchor(e.target.value)}
                className="h-[32px] rounded-lg border border-border bg-chip px-2.5 text-[12.5px] text-white
                           tabular-nums [color-scheme:dark] outline-none focus:border-accent/60"
                aria-label="date"
              />
              <IconButton
                onClick={() => setAnchor((a) => shiftDay(a, 1))}
                disabled={anchor >= today}
                title="next day"
              >›</IconButton>
              <button
                type="button"
                disabled={anchor === today}
                onClick={() => setAnchor(today)}
                className="h-[32px] px-3 rounded-lg border border-border bg-chip text-[12.5px] text-muted
                           hover:text-white hover:border-white/20 disabled:opacity-35 transition-colors"
              >
                Today
              </button>
            </div>
          )}

          <Segmented value={mode} options={MODES} onChange={pickMode} />

          {/* The channel filter. This is the comparison the journal exists to make — the three
              channels have very different track records, and the only honest way to find out
              which is worth acting on is to score them separately on real prices. */}
          <Segmented
            value={channel}
            onChange={setChannel}
            options={CHANNELS.map((c) => {
              const row = c === "all" ? null : t.byChannel.find((x) => x.channel === c);
              return {
                k: c,
                label: c === "all" ? "All" : CHANNEL_LABEL[c],
                badge: row ? row.trades : undefined,
                title: row ? `${plural(row.trades, "trade")} · ${inr(row.netPnl, true)}` : undefined,
              };
            })}
          />

          {/*
            The refresh cadence sits with the range controls because that is what it belongs to —
            how often to re-ask is a property of the window being looked at.
            
            ALWAYS SHOWN, including on a range it cannot act on. It was briefly hidden on a
            historical range on the grounds that a timer over a finished record does nothing,
            which was wrong twice over: the toolbar changed shape as you stepped through dates,
            and the setting could then only be chosen while already looking at today — exactly
            when you least want to go hunting for it.
          */}
          <div
            className="flex items-center gap-1.5 ml-auto"
            title="How often to re-ask while the market is open and this range reaches today. A settled day is never re-asked."
          >
            <span className="hidden sm:inline text-[10px] uppercase tracking-[0.09em] text-muted">
              Live
            </span>
            <Segmented value={autoSec} options={REFRESH} onChange={setAutoSec} size="sm" />
            <IconButton onClick={() => void load()} disabled={busy} title="Re-ask now">↻</IconButton>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ the alerts --- */}
      {error && <Notice tone="bad">{error}</Notice>}

      {!view.config.enabled && (
        <Notice tone="bad">
          The journal is switched off — set <code>JOURNAL=on</code> in <code>api/.env</code>. Nothing
          new is being recorded while it stays off.
        </Notice>
      )}

      {unsettled > 0 && (
        <Notice
          action={
            <button
              onClick={() => void settle()}
              disabled={settling}
              className="px-3.5 py-2 rounded-xl bg-accent text-white text-[12.5px] font-semibold
                         hover:brightness-110 disabled:opacity-50 transition"
            >
              {settling ? "Settling…" : "Settle now"}
            </button>
          }
        >
          <span className="text-accent font-medium">{plural(unsettled, "trade")}</span>{" "}
          {unsettled === 1 ? "has" : "have"} no settled exit yet. The recording machine settles from{" "}
          {sessionClock(view.config.squareOffMin)}; if it was shut down before that, finish the day
          from here.
          {settleNote && <span className="block text-muted mt-1">{settleNote}</span>}
        </Notice>
      )}

      {/* A live view that is not actually live is the one failure worth shouting about: the rows
          look merely uneventful when in fact nothing is being priced. */}
      {live.open > 0 && live.marked === 0 && (
        <Notice tone="warn">
          <span className="text-amber-400 font-medium">
            {plural(live.open, "open position")} with no live price.
          </span>{" "}
          The mark comes off the WebSocket feed, so this means the feed is not delivering — check{" "}
          <code>feed.phase</code> and <code>feed.lastError</code> on{" "}
          <code>GET /momentum/status</code>. Entries and settlement are unaffected; only the running
          number is missing.
        </Notice>
      )}

      {/* --------------------------------------------------------------------- the top --- */}
      <Hero
        totals={t}
        roll={roll}
        rangeLabel={rangeLabel}
        live={live}
        config={view.config}
        right={
          <span className="text-[10.5px] text-muted">
            {source === "upstox" ? "priced by Upstox" : source ? `source · ${source}` : null}
          </span>
        }
      />

      {/* ------------------------------------------------------------------- the ratios --- */}
      {/* Everything below the hero is an interrogation of a set of trades. With no trades there
          is nothing to interrogate, and eight tiles of em-dashes would only make an empty day
          look like a broken page. */}
      {hasTrades && (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Average win"
          value={inr(roll.avgWin, true)}
          cls="text-bull"
          note={`${plural(t.wins, "winner")} · ${short(roll.grossProfit)} in all`}
        />
        <StatCard
          label="Average loss"
          value={inr(roll.avgLoss, true)}
          cls="text-bear"
          note={`${plural(t.losses, "loser")} · ${short(-roll.grossLoss)} in all`}
        />
        <StatCard
          label="Payoff"
          value={roll.payoff === null ? "—" : `${roll.payoff.toFixed(2)}×`}
          hint="Average win divided by average loss. How much a winner has to carry."
          note={
            roll.payoff === null
              ? "needs a win and a loss to exist"
              : `breakeven needs ${pct(1 / (1 + roll.payoff), 0, false)} wins`
          }
        />
        <StatCard
          label="Deepest drawdown"
          value={roll.maxDrawdown > 0 ? inr(-roll.maxDrawdown) : "—"}
          cls={roll.maxDrawdown > 0 ? "text-bear" : ""}
          hint="The largest fall from a high-water mark on the trade-by-trade curve."
          note={roll.maxDrawdownAt ? `bottomed ${pretty(roll.maxDrawdownAt)}` : "no dip in this range"}
        />
        <StatCard
          label="Premium deployed"
          value={inr(t.amountUsed)}
          note={`across ${plural(t.trades, "position")}`}
        />
        <StatCard
          label="Charges paid"
          value={inr(-t.charges)}
          cls="text-bear"
          note={`₹${view.config.chargePerLot}/lot, round trip`}
        />
        <StatCard
          label="Best / worst"
          value={`${short(t.best)} / ${short(t.worst)}`}
          note="best and worst single trade"
        />
        <StatCard
          label="Average hold"
          value={holdLabel(roll.avgHold)}
          note={`winners ${holdLabel(roll.avgWinHold)} · losers ${holdLabel(roll.avgLossHold)}`}
        />
      </div>
      )}

      {/* ----------------------------------------------------------------- the analysis --- */}
      {hasTrades && (
      <div className="grid xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)] gap-4 items-start">
        <Card
          title="Performance"
          sub={
            <>
              {rangeLabel}
              {view.emptyDays > 0 && (
                <span title="Either nothing qualified, or the scanner was not running. The record cannot tell these apart.">
                  {` · ${plural(view.emptyDays, "weekday")} with no record`}
                </span>
              )}
              {t.untracked > 0 && ` · ${t.untracked} never priced`}
            </>
          }
          right={
            lenses.length > 1
              ? <Segmented value={shownLens} options={lenses} onChange={setLens} size="sm" />
              : undefined
          }
        >
          {roll.equity.length === 0 ? (
            <p className="text-[12.5px] text-muted py-10 text-center">
              Nothing has settled in this range, so there is no curve to draw yet.
            </p>
          ) : shownLens === "calendar" ? (
            <CalendarGrid
              months={months}
              selected={oneDay ? from : undefined}
              onPick={(d) => { setMode("day"); setAnchor(d); }}
            />
          ) : (
            <EChart
              option={
                shownLens === "curve" ? equityOption(roll.equity)
                  : shownLens === "day" ? dailyOption(roll.daily)
                    : tradeOption(roll.equity)
              }
              height="clamp(240px, 38vh, 420px)"
            />
          )}

          {/* The run of days, said in words. It is the part of the curve that a shape cannot
              carry — a green fortnight and a green month look identical at this size. */}
          {roll.daily.length > 1 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted mt-3 pt-3 border-t border-border">
              <span>
                <span className="text-bull font-semibold tabular-nums">{roll.greenDays}</span> green
                {" · "}
                <span className="text-bear font-semibold tabular-nums">{roll.redDays}</span> red
                {" sessions"}
              </span>
              <span title="consecutive winning and losing trades, not days">
                longest trade run{" "}
                <span className="text-bull font-semibold tabular-nums">{roll.winStreak}W</span>
                {" / "}
                <span className="text-bear font-semibold tabular-nums">{roll.lossStreak}L</span>
              </span>
              {roll.currentStreak.dir !== 0 && (
                <span>
                  ends on{" "}
                  <span className={`font-semibold tabular-nums ${roll.currentStreak.dir === 1 ? "text-bull" : "text-bear"}`}>
                    {roll.currentStreak.n}{roll.currentStreak.dir === 1 ? "W" : "L"}
                  </span>
                </span>
              )}
              {roll.bestDay && roll.worstDay && (
                <span className="tabular-nums">
                  best day <span className="text-bull">{inr(roll.bestDay.net, true)}</span>
                  {" · worst "}
                  <span className="text-bear">{inr(roll.worstDay.net, true)}</span>
                </span>
              )}
              {roll.avgMfe !== null && (
                <span title="the average best and worst each position showed while it was open">
                  average trade saw <span className="text-bull">{pct(roll.avgMfe)}</span>
                  {" / "}<span className="text-bear">{pct(roll.avgMae)}</span>
                </span>
              )}
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card
            title="Edge by channel"
            sub="Click one to filter the whole page"
            right={
              channel !== "all" ? (
                <button
                  onClick={() => setChannel("all")}
                  className="text-[11px] text-accent hover:underline"
                >
                  clear
                </button>
              ) : undefined
            }
          >
            <ChannelEdge rows={t.byChannel} active={channel} onPick={setChannel} />
          </Card>

          <Card title="How they ended" sub="Every closed position, by the exit that took it">
            <ExitMix exits={roll.exits} />
          </Card>

          <Card title="Win rate">
            <div className="flex items-end gap-3">
              <div className={`text-[28px] font-extrabold tabular-nums leading-none ${
                t.winRate === null ? "text-muted" : t.winRate >= 0.5 ? "text-bull" : "text-white"
              }`}>
                {t.winRate === null ? "—" : pct(t.winRate, 1, false)}
              </div>
              <div className="text-[11.5px] text-muted mb-0.5">
                <span className="text-bull font-semibold">{t.wins}W</span>
                {" / "}
                <span className="text-bear font-semibold">{t.losses}L</span>
              </div>
            </div>
            <WinBar wins={t.wins} losses={t.losses} />
            {roll.payoff !== null && (
              <p className="text-[11px] text-muted mt-2.5 leading-relaxed">
                A losing majority is not a losing strategy — at a payoff of{" "}
                {roll.payoff.toFixed(2)}× this set only needs{" "}
                {pct(1 / (1 + roll.payoff), 0, false)} of them to break even.
              </p>
            )}
          </Card>
        </div>
      </div>
      )}

      {/* What the tighter exits would have produced on the same prices. Here rather than in a
          document, because the argument for the wide stop is only convincing next to the
          alternative on the reader's own trades. */}
      {t.shadow.some((s) => s.trades > 0) && (
        <Card
          title="The same trades on a different exit"
          sub={`Every rule graded on the same candle path, over ${plural(t.closed, "closed trade")}`}
        >
          <ShadowLab totals={t} config={view.config} />
        </Card>
      )}

      {/*
        The same question asked of any rule, not just the six the API precomputes. Sits after the
        fixed comparison because that one is free and this one costs a walk of the archive — read
        the shadows first, and come here when they raise a question.

        NOT gated on the range having trades, unlike everything above it. This panel grades the
        WHOLE archive by default, so it is at its most useful on exactly the screen that has
        nothing else on it: a blank Monday morning before the first alert has fired.
      */}
      <ExitLab
        config={view.config}
        from={from}
        to={to}
        channel={channel === "all" ? null : channel}
      />

      {/* ----------------------------------------------------------------------- days --- */}
      {view.days.length === 0 ? (
        <Card>
          <div className="py-10 text-center">
            <p className="text-[14px] font-medium">No trades in this range.</p>
            <p className="text-[12px] text-muted mt-1.5 max-w-md mx-auto leading-relaxed">
              Either no alert fired, or the channels were off — check{" "}
              <code>GET /momentum/status</code> for <code>displacementAlerts.windowOpen</code>.
              Nothing is backfilled: a day the scanner was not running is a day with no trades.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {view.days.length > 1 && (
            <div className="flex items-center gap-3 pt-1">
              <h2 className="text-[13px] font-semibold tracking-tight">Positions</h2>
              <span className="text-[11px] text-muted">
                {plural(view.days.length, "session")} · {plural(t.trades, "trade")}
              </span>
              <button
                onClick={() =>
                  setOpenDays(Object.fromEntries(view.days.map((d) => [d.day, !allOpen])))
                }
                className="ml-auto text-[11.5px] text-accent hover:underline"
              >
                {allOpen ? "Collapse all" : "Expand all"}
              </button>
            </div>
          )}
          {view.days.map((d) => (
            <DaySection
              key={d.day} day={d.day} trades={d.trades} totals={d.totals}
              config={view.config} nowMs={nowMs} onEdit={setEditing}
              onExit={(row) => setExitingId(row.id)}
              open={isOpen(d.day)}
              onToggle={() => setOpenDays((m) => ({ ...m, [d.day]: !isOpen(d.day) }))}
            />
          ))}
        </div>
      )}

      {editing && (
        <EditDialog
          trade={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void load(); }}
        />
      )}

      {exiting && (
        <ExitDialog
          trade={exiting}
          chargePerLot={view.config.chargePerLot}
          onClose={() => setExitingId(null)}
          onExited={() => { setExitingId(null); void load(); }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------- pieces ----- */

/**
 * Where the record lives, and whether the far half of it is answering.
 *
 * A badge rather than a line of prose because it is checked at a glance and only matters when it
 * is wrong. Clicking it runs the store probe — the same steps `npm run check-neon` runs — so a red
 * badge can be diagnosed here instead of in a terminal.
 */
function StoreBadge({ sync }: { sync: JournalView["sync"] }) {
  const [probe, setProbe] = useState<JournalSyncProbe | null>(null);
  const [checking, setChecking] = useState(false);
  const { text, tone } = syncLabel(sync);
  const ring = tone === "good" ? "border-bull/30 text-bull bg-bull/[0.07]"
    : tone === "warn" ? "border-amber-500/30 text-amber-400 bg-amber-500/[0.07]"
      : tone === "bad" ? "border-bear/30 text-bear bg-bear/[0.07]"
        : "border-border text-muted bg-black/20";

  const check = async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/momentum/journal/sync", { cache: "no-store" });
      const j = await res.json();
      setProbe((j?.data ?? { configured: false, steps: [] }) as JournalSyncProbe);
    } catch (e) {
      setProbe({
        configured: true,
        ok: false,
        steps: [{ step: "reach the API", ok: false, detail: String((e as Error).message) }],
      });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => (probe ? setProbe(null) : void check())}
        className={`text-[10.5px] px-2.5 py-1 rounded-full border transition-colors hover:brightness-125 ${ring}`}
        title={sync.lastError ?? "Check the shared store"}
      >
        {checking ? "checking…" : text}
      </button>
      {probe && (
        <div
          className="absolute right-0 mt-2 z-40 w-[330px] rounded-2xl border border-border bg-panel
                     shadow-[0_24px_60px_-20px_rgba(0,0,0,.9)] p-3.5 text-left"
          onMouseLeave={() => setProbe(null)}
        >
          {!probe.configured ? (
            <p className="text-[12px] text-muted">
              {probe.note ?? "No shared store configured."} Set <code>DATABASE_URL</code> in{" "}
              <code>api/.env</code> on both machines to share the record.
            </p>
          ) : (
            <>
              <p className="text-[11px] text-muted mb-2 break-all">{probe.host}</p>
              <ul className="space-y-1">
                {probe.steps.map((st) => (
                  <li key={st.step} className="text-[12px] flex gap-2">
                    <span className={st.ok ? "text-bull" : "text-bear"}>{st.ok ? "ok" : "fail"}</span>
                    <span className="text-white">{st.step}</span>
                    {st.detail && (
                      <span className="text-muted truncate" title={st.detail}>{st.detail}</span>
                    )}
                  </li>
                ))}
              </ul>
              {sync.pending > 0 && (
                <p className="text-[11.5px] text-amber-400 mt-2.5">
                  {plural(sync.pending, "trade")} recorded here but not yet in the shared store. They
                  are safe on this machine and are retried every scan.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
