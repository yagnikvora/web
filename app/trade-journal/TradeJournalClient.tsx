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

import { useCallback, useEffect, useMemo, useState } from "react";
import { Panel } from "@/components/ui";
import { Col, DataTable, TableCard } from "@/components/table";
import {
  ago, CHANNEL_LABEL, EXIT_LABEL, excursionFrom, inr, istToday, JournalSyncProbe, JournalTrade,
  JournalView,
  liveOf, liveTotals, pct, plural, prem, RangeMode, rangeFor, sessionClock, shiftDay, syncLabel,
  type JournalChannel,
} from "@/lib/journal";

const CHANNELS: Array<JournalChannel | "all"> = ["all", "displacement", "trend-day", "ignition"];
const MODES: Array<{ k: RangeMode; label: string }> = [
  { k: "day", label: "Day" },
  { k: "week", label: "7 days" },
  { k: "month", label: "Month to date" },
  { k: "custom", label: "Custom" },
];

// How often to re-ask, in seconds. 0 is off — kept as a real choice because the page is also
// read at night, when a timer would only spin.
const REFRESH: Array<{ s: number; label: string }> = [
  { s: 0, label: "Off" },
  { s: 15, label: "15s" },
  { s: 30, label: "30s" },
  { s: 60, label: "1m" },
];

const sign = (n: number | null | undefined) =>
  n === null || n === undefined ? "text-muted" : n > 0 ? "text-bull" : n < 0 ? "text-bear" : "text-muted";

export default function TradeJournalClient({
  initial, source,
}: { initial: JournalView; source?: string }) {
  const [view, setView] = useState<JournalView>(initial);
  const [anchor, setAnchor] = useState(initial.to);
  const [mode, setMode] = useState<RangeMode>("day");
  const [customFrom, setCustomFrom] = useState(initial.from);
  const [channel, setChannel] = useState<JournalChannel | "all">("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<JournalTrade | null>(null);
  const [settling, setSettling] = useState(false);
  const [settleNote, setSettleNote] = useState<string | null>(null);

  const [autoSec, setAutoSec] = useState(30);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(0);

  const unsettled = useMemo(
    () => view.days.reduce((n, d) => n + d.trades.filter((t) => !t.settled).length, 0),
    [view],
  );

  // The open book at its current marks. Recomputed from `view` rather than tracked separately, so
  // there is exactly one copy of "what is open right now" and it cannot drift from the table.
  const live = useMemo(
    () => liveTotals(view.days, view.config.chargePerLot),
    [view],
  );

  const { from, to } = useMemo(() => rangeFor(mode, anchor, customFrom), [mode, anchor, customFrom]);

  const load = useCallback(async () => {
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
      setBusy(false);
    }
  }, [from, to, channel]);

  // Skips the first run: the server already fetched exactly this range.
  const [primed, setPrimed] = useState(false);
  useEffect(() => {
    if (!primed) { setPrimed(true); return; }
    void load();
  }, [load, primed]);

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
      setSettleNote(n ? `${plural(n, "trade")} settled from the contract's candles.` : (j?.note ?? "Nothing was outstanding."));
      await load();
    } catch (e) {
      setSettleNote((e as Error).message);
    } finally {
      setSettling(false);
    }
  }, [load]);

  const today = istToday();
  const t = view.totals;

  /*
   * The refresh loop.
   *
   * Three conditions, all of which have to hold: the timer is on, the range on screen reaches
   * today, and something in it is still open. Anything else is a finished record, and the page
   * stops asking about it without being told to.
   */
  const polling = autoSec > 0 && live.open > 0 && to >= today;

  useEffect(() => {
    if (!polling) return;
    const id = setInterval(() => {
      // A tab in the background is a tab nobody is reading. Skipping it keeps a journal left
      // open overnight from spending a request every thirty seconds until morning.
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
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

  return (
    <main className="p-5 space-y-4">
      <header className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Trade Journal</h1>
          <p className="text-muted text-sm mt-1 max-w-2xl">
            Every alert this app sent, recorded as a position and settled from the contract&apos;s own
            1-minute candles after the close. Entry is the ask at signal time; exit is{" "}
            <span className="text-white">+{Math.round(100 * view.config.tpPct)}%</span> or{" "}
            <span className="text-white">−{Math.round(100 * view.config.slPct)}%</span> of premium, else
            squared off at {sessionClock(view.config.squareOffMin)}.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-[11px] text-muted">
          {busy && <span className="text-accent">loading…</span>}
          {!view.config.enabled && (
            <span className="text-bear">journal is off — set JOURNAL=on in api/.env</span>
          )}
          {polling && nowMs > 0 && (
            <span title={`re-asking every ${autoSec}s while a position is open`}>
              <span className="text-bull">●</span>{" "}
              {loadedAt === null ? "live" : `updated ${ago(loadedAt, nowMs)}`}
            </span>
          )}
          <StoreBadge sync={view.sync} />
        </div>
      </header>

      {/* ------------------------------------------------------------------- controls --- */}
      <Panel>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <div className="flex items-center gap-2">
            <button
              className="chip !px-2.5 !py-1.5 hover:bg-border"
              onClick={() => setAnchor((a) => shiftDay(a, -1))}
              aria-label="previous day"
            >‹</button>
            <input
              type="date"
              value={anchor}
              max={today}
              onChange={(e) => e.target.value && setAnchor(e.target.value)}
              className="chip !py-1.5 bg-chip text-white [color-scheme:dark]"
            />
            <button
              className="chip !px-2.5 !py-1.5 hover:bg-border disabled:opacity-40"
              disabled={anchor >= today}
              onClick={() => setAnchor((a) => shiftDay(a, 1))}
              aria-label="next day"
            >›</button>
            <button
              className="chip !py-1.5 hover:bg-border disabled:opacity-40"
              disabled={anchor === today}
              onClick={() => setAnchor(today)}
            >Today</button>
          </div>

          <div className="flex items-center gap-1">
            {MODES.map((m) => (
              <button
                key={m.k}
                onClick={() => setMode(m.k)}
                className={`text-[12.5px] px-2.5 py-1.5 rounded-lg border ${
                  mode === m.k ? "bg-accent text-white border-accent" : "border-border text-muted hover:bg-chip"
                }`}
              >{m.label}</button>
            ))}
            {mode === "custom" && (
              <input
                type="date"
                value={customFrom}
                max={anchor}
                onChange={(e) => e.target.value && setCustomFrom(e.target.value)}
                className="chip !py-1.5 ml-1 bg-chip text-white [color-scheme:dark]"
                aria-label="range start"
              />
            )}
          </div>

          {/* The refresh cadence. Sits with the range controls because that is what it belongs
              to — how often to re-ask is a property of the window being looked at, and it has
              no effect at all on a window that cannot change. */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-muted mr-1">Live</span>
            {REFRESH.map((r) => (
              <button
                key={r.s}
                onClick={() => setAutoSec(r.s)}
                className={`text-[12px] px-2 py-1.5 rounded-lg border ${
                  autoSec === r.s ? "bg-accent text-white border-accent" : "border-border text-muted hover:bg-chip"
                }`}
              >{r.label}</button>
            ))}
            <button
              onClick={() => void load()}
              disabled={busy}
              className="text-[12px] px-2.5 py-1.5 rounded-lg border border-border text-muted hover:bg-chip hover:text-white disabled:opacity-40 ml-1"
              title="Re-ask now"
            >↻</button>
          </div>

          {/* The channel filter. This is the comparison the journal exists to make — the three
              channels have very different track records and the only honest way to find out
              which is worth acting on is to score them separately on real prices. */}
          <div className="flex items-center gap-1 ml-auto">
            {CHANNELS.map((c) => {
              const row = c === "all" ? null : t.byChannel.find((x) => x.channel === c);
              return (
                <button
                  key={c}
                  onClick={() => setChannel(c)}
                  title={row ? `${row.trades} trades · ${inr(row.netPnl, true)}` : undefined}
                  className={`text-[12.5px] px-2.5 py-1.5 rounded-lg border ${
                    channel === c ? "bg-accent text-white border-accent" : "border-border text-muted hover:bg-chip"
                  }`}
                >
                  {c === "all" ? "All channels" : CHANNEL_LABEL[c]}
                  {row && <span className="opacity-60 ml-1.5">{row.trades}</span>}
                </button>
              );
            })}
          </div>
        </div>
        <p className="text-[11px] text-muted mt-3">
          {from === to ? from : `${from} → ${to}`}
          {view.emptyDays > 0 && (
            <span title="Either nothing qualified, or the scanner was not running. The record cannot tell these apart.">
              {` · ${plural(view.emptyDays, "weekday")} with no record`}
            </span>
          )}
        </p>
      </Panel>

      {error && (
        <Panel><p className="text-bear text-sm">{error}</p></Panel>
      )}

      {unsettled > 0 && (
        <Panel>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm">
              <span className="text-accent font-medium">{plural(unsettled, "trade")}</span>{" "}
              {unsettled === 1 ? "has" : "have"} no settled exit yet. The recording machine settles
              from {sessionClock(view.config.squareOffMin)}; if it was shut down before that, finish
              the day from here.
            </p>
            <button
              onClick={() => void settle()}
              disabled={settling}
              className="ml-auto px-3 py-1.5 rounded-lg bg-accent text-white text-[12.5px] font-medium disabled:opacity-50"
            >{settling ? "Settling…" : "Settle now"}</button>
          </div>
          {settleNote && <p className="text-[11.5px] text-muted mt-2">{settleNote}</p>}
        </Panel>
      )}

      {/* A live view that is not actually live is the one failure worth shouting about: the rows
          look merely uneventful when in fact nothing is being priced. Says so rather than
          leaving a column of dashes to be interpreted. */}
      {live.open > 0 && live.marked === 0 && (
        <Panel>
          <p className="text-sm">
            <span className="text-amber-400 font-medium">
              {plural(live.open, "open position")} with no live price.
            </span>{" "}
            <span className="text-muted">
              The mark comes off the WebSocket feed, so this means the feed is not delivering —
              check <code>feed.phase</code> and <code>feed.lastError</code> on{" "}
              <code>GET /momentum/status</code>. Entries and settlement are unaffected; only the
              running number is missing.
            </span>
          </p>
        </Panel>
      )}

      {/* --------------------------------------------------------------------- totals --- */}
      <div className={`grid grid-cols-2 md:grid-cols-4 gap-3 ${live.open > 0 ? "xl:grid-cols-8" : "xl:grid-cols-7"}`}>
        <Stat label="Trades" value={String(t.trades)} note={`${t.open} open · ${t.untracked} not priced`} />
        <Stat label="Win rate" value={t.winRate === null ? "—" : pct(t.winRate, 0, false)} note={`${t.wins}W / ${t.losses}L`} />
        <Stat label="Amount used" value={inr(t.amountUsed)} note="premium deployed" />
        <Stat label="Gross P&L" value={inr(t.grossPnl, true)} cls={sign(t.grossPnl)} note="before charges" />
        <Stat label="Charges" value={inr(-t.charges)} cls="text-bear" note={`₹${view.config.chargePerLot}/lot round trip`} />
        <Stat label="Net P&L" value={inr(t.netPnl, true)} cls={sign(t.netPnl)} note={t.netPct === null ? "" : `${pct(t.netPct)} on capital used`} big />
        <Stat
          label="Best / worst"
          value={`${inr(t.best, true)} / ${inr(t.worst, true)}`}
          note="single trade"
        />
        {/* Its own tile rather than folded into Net P&L, which is the realised number. Adding an
            unrealised mark to a settled total would make the day's result move every fifteen
            seconds and stop meaning what it says. */}
        {live.open > 0 && (
          <Stat
            label="Open now"
            value={live.marked ? inr(live.net, true) : "—"}
            cls={live.marked ? sign(live.net) : ""}
            note={
              live.marked === 0
                ? `${live.open} open · not priced`
                : `${live.marked}/${live.open} priced · ${pct(live.netPct)} · after charges`
            }
          />
        )}
      </div>

      {/* What the tighter exits would have produced on the same prices. Here rather than in a
          document, because the argument for the wide stop is only convincing next to the
          alternative on the reader's own trades. */}
      {t.shadow.some((s) => s.trades > 0) && (
        <Panel title="The same trades on a different exit">
          <div className="flex flex-wrap gap-3">
            <ShadowCard
              name={`+${Math.round(100 * view.config.tpPct)}/−${Math.round(100 * view.config.slPct)}`}
              netPnl={t.netPnl} wins={t.wins} trades={t.closed} active
            />
            {t.shadow.filter((s) => s.trades > 0).map((s) => (
              <ShadowCard key={s.name} name={s.name} netPnl={s.netPnl} wins={s.wins} trades={s.trades} />
            ))}
          </div>
          <p className="text-[11px] text-muted mt-3">
            Each alternative is graded on the same candle path, with the stop winning any minute that
            could have gone either way. Charges are deducted from all of them equally.
          </p>
        </Panel>
      )}

      {/* ----------------------------------------------------------------------- days --- */}
      {view.days.length === 0 ? (
        <Panel>
          <p className="text-sm text-muted">
            No trades in this range. Either no alert fired, or the channels were off — check{" "}
            <code>GET /momentum/status</code> for <code>displacementAlerts.windowOpen</code>.
          </p>
        </Panel>
      ) : (
        view.days.map((d) => (
          <TradeTable
            key={d.day} day={d.day} trades={d.trades} totals={d.totals}
            chargePerLot={view.config.chargePerLot} nowMs={nowMs} onEdit={setEditing}
          />
        ))
      )}

      {editing && (
        <EditDialog
          trade={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void load(); }}
        />
      )}
    </main>
  );
}

/* ------------------------------------------------------------------------- pieces ----- */


/**
 * Where the record lives, and whether the far half of it is answering.
 *
 * A badge rather than a line of prose because it is checked at a glance and only matters when it is
 * wrong. Clicking it runs the store probe — the same steps `npm run check-neon` runs — so a red
 * badge can be diagnosed here instead of in a terminal.
 */
function StoreBadge({ sync }: { sync: JournalView["sync"] }) {
  const [probe, setProbe] = useState<JournalSyncProbe | null>(null);
  const [checking, setChecking] = useState(false);
  const { text, tone } = syncLabel(sync);
  const ring = tone === "good" ? "border-emerald-800 text-bull"
    : tone === "warn" ? "border-amber-800 text-amber-400"
      : tone === "bad" ? "border-red-900 text-bear"
        : "border-border text-muted";

  const check = async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/momentum/journal/sync", { cache: "no-store" });
      const j = await res.json();
      setProbe((j?.data ?? { configured: false, steps: [] }) as JournalSyncProbe);
    } catch (e) {
      setProbe({ configured: true, ok: false, steps: [{ step: "reach the API", ok: false, detail: String((e as Error).message) }] });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => (probe ? setProbe(null) : void check())}
        className={`text-[11px] px-2.5 py-1 rounded-full border ${ring} hover:bg-chip`}
        title={sync.lastError ?? "Check the shared store"}
      >
        {checking ? "checking…" : text}
      </button>
      {probe && (
        <div
          className="absolute right-0 mt-2 z-40 w-[330px] panel p-3.5 text-left"
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
                    {st.detail && <span className="text-muted truncate" title={st.detail}>{st.detail}</span>}
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

function Stat({ label, value, note, cls = "", big = false }: {
  label: string; value: string; note?: string; cls?: string; big?: boolean;
}) {
  return (
    <div className={`panel p-3 ${big ? "ring-1 ring-border" : ""}`}>
      <div className="text-[10.5px] uppercase tracking-wider text-muted">{label}</div>
      <div className={`${big ? "text-[22px]" : "text-[19px]"} font-bold tabular-nums mt-1 ${cls}`}>{value}</div>
      {note && <div className="text-[11px] text-muted mt-0.5 truncate" title={note}>{note}</div>}
    </div>
  );
}

function ShadowCard({ name, netPnl, wins, trades, active = false }: {
  name: string; netPnl: number; wins: number; trades: number; active?: boolean;
}) {
  return (
    <div className={`rounded-xl border px-3.5 py-2.5 ${active ? "border-accent bg-accent/10" : "border-border bg-chip"}`}>
      <div className="text-[11px] text-muted">
        {name}{active && <span className="text-accent ml-1.5">in use</span>}
      </div>
      <div className={`text-[17px] font-bold tabular-nums ${sign(netPnl)}`}>{inr(netPnl, true)}</div>
      <div className="text-[10.5px] text-muted">{trades ? `${wins}/${trades} won` : "—"}</div>
    </div>
  );
}

function TradeTable({ day, trades, totals, chargePerLot, nowMs, onEdit }: {
  day: string; trades: JournalTrade[]; totals: JournalDayTotals; chargePerLot: number;
  /** 0 when the page is not polling — the "12s ago" line is hidden rather than frozen. */
  nowMs: number;
  onEdit: (t: JournalTrade) => void;
}) {
  // Every money column asks the same question of a row: is it closed, or is it open with a
  // price on it? Answered once here so the four of them cannot disagree.
  const liveFor = (r: JournalTrade) => liveOf(r, chargePerLot);

  // Live rows sort with the closed ones instead of sinking to the bottom on a null.
  const dayNet = totals.netPnl + trades.reduce((n, r) => n + (liveFor(r)?.net ?? 0), 0);
  const anyLive = trades.some((r) => liveFor(r) !== null);

  const cols: Col<JournalTrade>[] = [
    {
      h: "Symbol",
      val: (r) => r.symbol,
      render: (r) => (
        <div className="min-w-[112px]">
          <div className="font-semibold flex items-center gap-1.5">
            {r.symbol}
            <span className={r.direction === 1 ? "text-bull" : "text-bear"}>
              {r.direction === 1 ? "▲" : "▼"}
            </span>
          </div>
          <div className="text-[11px] text-muted">{CHANNEL_LABEL[r.channel]}</div>
        </div>
      ),
    },
    {
      h: "Contract",
      val: (r) => r.contract?.label ?? "",
      render: (r) => (
        <div className="min-w-[104px]">
          <div className="tabular-nums">{r.contract?.label ?? <span className="text-muted">no chain</span>}</div>
          <div className="text-[11px] text-muted">
            {r.contract ? `${r.lots} lot × ${r.contract.lotSize}` : "—"}
          </div>
        </div>
      ),
    },
    {
      h: "Bought",
      val: (r) => r.entry.minute,
      render: (r) => (
        <div className="min-w-[104px] tabular-nums">
          <div>{prem(r.entry.premium)}</div>
          <div className="text-[11px] text-muted">
            {sessionClock(r.entry.minute)}
            {r.entry.source === "manual" && <span className="text-accent ml-1">·you</span>}
          </div>
        </div>
      ),
    },
    {
      h: "Sold",
      val: (r) => r.exit?.minute ?? 9_999,
      render: (r) => {
        if (!r.exit) {
          const l = liveFor(r);
          return (
            <div className="min-w-[104px] tabular-nums">
              <div className={sign(l?.pct)}>{l ? prem(l.premium) : "—"}</div>
              <div className="text-[11px] text-muted">
                {l ? (
                  <>
                    <span className={sign(l.pct)}>{pct(l.pct)}</span>
                    {nowMs > 0 && <span className="ml-1 opacity-70">{ago(l.at, nowMs)}</span>}
                  </>
                ) : (
                  <span className="text-accent">open · no price</span>
                )}
              </div>
            </div>
          );
        }
        return (
          <div className="min-w-[104px] tabular-nums">
            <div>{r.exit.reason === "untracked" ? "—" : prem(r.exit.premium)}</div>
            <div className="text-[11px] text-muted">
              {r.exit.reason === "untracked" ? "—" : sessionClock(r.exit.minute)}
              {r.exit.source === "manual" && <span className="text-accent ml-1">·you</span>}
            </div>
          </div>
        );
      },
    },
    {
      h: "Outcome",
      val: (r) => (r.exit ? r.exit.reason : "open"),
      render: (r) => {
        if (!r.exit) {
          const l = liveFor(r);
          // Green or red while it is priced, so the badge column alone reads as a scoreboard.
          const cls = !l ? "border-accent text-accent"
            : l.net > 0 ? "border-emerald-800 text-bull"
              : l.net < 0 ? "border-red-900 text-bear"
                : "border-border text-muted";
          return (
            <span className={`text-[11px] px-2 py-1 rounded-full border whitespace-nowrap ${cls}`}>
              OPEN
            </span>
          );
        }
        const cls =
          r.exit.reason === "target" ? "border-emerald-800 text-bull"
            : r.exit.reason === "stop" ? "border-red-900 text-bear"
              : r.exit.reason === "untracked" ? "border-border text-muted"
                : "border-border text-white";
        return (
          <span className={`text-[11px] px-2 py-1 rounded-full border whitespace-nowrap ${cls}`}>
            {EXIT_LABEL[r.exit.reason]}
          </span>
        );
      },
    },
    { h: "Used", val: (r) => r.amountUsed ?? 0, render: (r) => <span className="tabular-nums">{inr(r.amountUsed)}</span> },
    {
      h: "Gross",
      val: (r) => r.grossPnl ?? liveFor(r)?.gross ?? 0,
      render: (r) => {
        const g = r.grossPnl ?? liveFor(r)?.gross ?? null;
        return <span className={`tabular-nums ${sign(g)}`}>{inr(g, true)}</span>;
      },
    },
    {
      h: "Charges",
      val: (r) => r.charges ?? liveFor(r)?.charges ?? 0,
      render: (r) => {
        // The full round trip on an open row too: it is what closing at this mark would cost,
        // and a net that quietly omits it is the kind of number that looks better than it is.
        const c = r.charges ?? liveFor(r)?.charges ?? null;
        return <span className="tabular-nums text-muted">{c === null ? "—" : inr(-c)}</span>;
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
          <div className="min-w-[86px] tabular-nums">
            <div className={`font-semibold ${sign(net)}`}>{inr(net, true)}</div>
            <div className={`text-[11px] ${sign(p)}`}>
              {pct(p)}
              {/* Marked, not booked. The row has to say which it is or the two become one
                  number and the day's result stops being trustworthy. */}
              {l && <span className="text-accent ml-1 not-italic">live</span>}
            </div>
          </div>
        );
      },
    },
    {
      h: "Best / worst it saw",
      val: (r) => r.mfePct ?? 0,
      render: (r) => {
        // How much of the trade these two numbers actually cover. A row whose marking started
        // hours after entry has a blind window at the front, and the honest thing is to say so
        // on the row rather than let two confident percentages imply the whole day.
        const from = excursionFrom(r);
        return (
          <div className="min-w-[132px] tabular-nums text-[11.5px]">
            <div className={from === null ? "" : "opacity-70"}>
              <span className="text-bull">{pct(r.mfePct)}</span>
              <span className="text-muted mx-1">/</span>
              <span className="text-bear">{pct(r.maePct)}</span>
            </div>
            {/* The clock times, when the row carries them. A dash beats a wrong minute: an
                excursion of 0 never happened, so it has no moment to name. */}
            {(r.mfeMinute != null || r.maeMinute != null) && (
              <div className="text-[10.5px] text-muted">
                {sessionClock(r.mfeMinute)}
                <span className="mx-1">/</span>
                {sessionClock(r.maeMinute)}
              </div>
            )}
            {from !== null && (
              <div
                className="text-[10.5px] text-amber-400/90"
                title={
                  `Not watched from entry. This row was first priced at ${sessionClock(from)}, so ` +
                  `${sessionClock(r.entry.minute)}–${sessionClock(from)} is missing from both figures. ` +
                  "Settling the day re-reads the contract's own candles and fills the gap in."
                }
              >
                only since {sessionClock(from)}
              </div>
            )}
          </div>
        );
      },
    },
    {
      h: "",
      render: (r) => (
        <button
          onClick={() => onEdit(r)}
          className="text-[11px] px-2 py-1 rounded-lg border border-border text-muted hover:bg-chip hover:text-white whitespace-nowrap"
          title="Replace these prices with your actual fill"
        >
          {r.edited ? "edited" : "my fill"}
        </button>
      ),
    },
  ];

  const dow = new Date(`${day}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short" });

  return (
    <TableCard
      id={`journal-${day}`}
      title={`${day} · ${dow}`}
      right={
        <div className="flex items-center gap-3 text-[12px] tabular-nums">
          <span className="text-muted">{plural(totals.trades, "trade")}</span>
          {totals.winRate !== null && <span className="text-muted">{pct(totals.winRate, 0, false)} won</span>}
          {/* Closed and open shown apart. One combined figure would move on every tick and
              still be labelled as the day's result. */}
          <span className={`font-semibold ${sign(totals.netPnl)}`} title="booked">
            {inr(totals.netPnl, true)}
          </span>
          {anyLive && (
            <span className={`font-semibold ${sign(dayNet)}`} title="including open positions at their current mark">
              {inr(dayNet, true)} <span className="text-accent font-normal">live</span>
            </span>
          )}
        </div>
      }
    >
      <DataTable cols={cols} rows={trades} rowKey={(r) => r.id} height={420} pin={1} />
    </TableCard>
  );
}

type JournalDayTotals = JournalView["totals"];

/* --------------------------------------------------------------------- the edit form --- */

/**
 * Replace what the feed recorded with what the broker filled.
 *
 * Deliberately only four fields. A journal that asks for the whole contract note will not get
 * filled in; the two prices and the lot count are what change the money.
 */
function EditDialog({ trade, onClose, onSaved }: {
  trade: JournalTrade; onClose: () => void; onSaved: () => void;
}) {
  const [entryPremium, setEntry] = useState(String(trade.entry.premium));
  const [exitPremium, setExit] = useState(trade.exit ? String(trade.exit.premium) : "");
  const [lots, setLots] = useState(String(trade.lots));
  const [note, setNote] = useState(trade.note);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async (reset = false) => {
    setSaving(true);
    setErr(null);
    try {
      const body = reset
        ? { reset: true }
        : {
          entryPremium: entryPremium === "" ? undefined : Number(entryPremium),
          exitPremium: exitPremium === "" ? undefined : Number(exitPremium),
          lots: Number(lots),
          note,
        };
      const res = await fetch(`/api/momentum/journal/${encodeURIComponent(trade.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? `save failed (${res.status})`);
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="panel p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[16px] font-semibold">
          {trade.symbol} {trade.contract?.label ?? ""}
        </h2>
        <p className="text-[11.5px] text-muted mt-1">
          {trade.day} · {CHANNEL_LABEL[trade.channel]} · signalled {sessionClock(trade.entry.minute)}.
          Saving your own prices stops the nightly settlement from overwriting this row.
        </p>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <Field label="Buy price" value={entryPremium} onChange={setEntry} />
          <Field label="Sell price" value={exitPremium} onChange={setExit} placeholder="still open" />
          <Field label="Lots" value={lots} onChange={setLots} />
          <div>
            <label className="text-[10.5px] uppercase tracking-wider text-muted">Lot size</label>
            <div className="chip mt-1 text-muted">{trade.contract?.lotSize ?? "—"}</div>
          </div>
        </div>

        <label className="block mt-3">
          <span className="text-[10.5px] uppercase tracking-wider text-muted">Note</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="why you took it, or didn't"
            className="chip w-full mt-1 bg-chip text-white placeholder:text-muted/60"
          />
        </label>

        {err && <p className="text-bear text-[12px] mt-3">{err}</p>}

        <div className="flex items-center gap-2 mt-5">
          <button
            onClick={() => void save()}
            disabled={saving}
            className="px-3.5 py-2 rounded-lg bg-accent text-white text-[13px] font-medium disabled:opacity-50"
          >{saving ? "Saving…" : "Save my fill"}</button>
          {trade.edited && (
            <button
              onClick={() => void save(true)}
              disabled={saving}
              className="px-3 py-2 rounded-lg border border-border text-muted text-[13px] hover:bg-chip"
              title="Discard your prices and let the nightly settlement own this row again"
            >Revert to settled</button>
          )}
          <button onClick={onClose} className="ml-auto px-3 py-2 text-[13px] text-muted hover:text-white">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[10.5px] uppercase tracking-wider text-muted">{label}</span>
      <input
        type="number"
        step="0.05"
        min="0"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="chip w-full mt-1 bg-chip text-white tabular-nums placeholder:text-muted/60"
      />
    </label>
  );
}
