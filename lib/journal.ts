// The trade journal's shapes, mirroring `api/src/momentum/journal/journal.ts`.
//
// Hand-written rather than generated, like the rest of lib/: the API is one repo away and a
// codegen step for six interfaces is more machinery than it saves.

import { clock12 } from "./format";

export type JournalChannel = "displacement" | "trend-day" | "ignition";

export const CHANNEL_LABEL: Record<JournalChannel, string> = {
  displacement: "Displacement",
  "trend-day": "Trend Day",
  ignition: "Ignition",
};

export interface JournalContract {
  label: string;
  strike: number;
  type: string;
  instrumentKey: string;
  expiry: string;
  lotSize: number;
}

export interface JournalFill {
  at: number;
  minute: number;
  premium: number;
  spot: number | null;
  source: "auto" | "manual";
}

export interface JournalShadow {
  name: string;
  pct: number;
  out: "target" | "stop" | "close";
  minute: number | null;
}

export type ExitReason = "target" | "stop" | "square-off" | "manual" | "untracked";

export interface JournalTrade {
  id: string;
  day: string;
  channel: JournalChannel;
  symbol: string;
  direction: 1 | -1;
  contract: JournalContract | null;
  lots: number;
  entry: JournalFill;
  exit: (JournalFill & { reason: ExitReason }) | null;
  mark: { at: number; premium: number; pct: number } | null;
  mfePct: number | null;
  maePct: number | null;
  /** Minute of session each excursion was set. Null/absent when it never happened, or on rows
   *  written before the field existed — render "—", never 09:15. */
  mfeMinute?: number | null;
  maeMinute?: number | null;
  /** Session minute the live marking of this row began. Null means the excursions cover the
   *  whole trade — see the API's `markedFrom`. */
  markedFrom?: number | null;
  spreadPctAtEntry: number | null;
  amountUsed: number | null;
  grossPnl: number | null;
  charges: number | null;
  netPnl: number | null;
  netPct: number | null;
  shadow: JournalShadow[];
  readings: Record<string, number | null>;
  note: string;
  status: "open" | "closed";
  settled: boolean;
  edited: boolean;
  /** When this row last changed. How the mirror decides which machine's copy is later. */
  updatedAt: number;
}

export interface JournalTotals {
  trades: number;
  closed: number;
  open: number;
  untracked: number;
  wins: number;
  losses: number;
  winRate: number | null;
  amountUsed: number;
  grossPnl: number;
  charges: number;
  netPnl: number;
  netPct: number | null;
  best: number | null;
  worst: number | null;
  byChannel: Array<{ channel: string; trades: number; wins: number; netPnl: number; winRate: number | null }>;
  shadow: Array<{ name: string; netPnl: number; wins: number; trades: number }>;
}

export interface JournalDay {
  day: string;
  trades: JournalTrade[];
  totals: JournalTotals;
}

/* ------------------------------------------------------------------------ live P&L --- */

/** What an open position is worth at its current mark. */
export interface JournalLive {
  premium: number;
  /** Move on the premium, the same number `mark.pct` carries. */
  pct: number;
  gross: number;
  charges: number;
  net: number;
  netPct: number | null;
  /** When the mark was taken. A stale one is worse than none, so the age is shown. */
  at: number;
}

/**
 * The running P&L of a position that has not closed.
 *
 * Derived here rather than stored on the row, and deliberately never written into `grossPnl`
 * or `netPnl`: those fields mean "what this trade actually made", and a running mark in them
 * would make an open day and a settled one impossible to tell apart. The API keeps the same
 * separation — `price()` only fills them on an exit.
 *
 * Charges are the whole round trip, the same fee a real exit books. A position closed at this
 * mark would pay it, so a net that leaves it out is not a net.
 */
export function liveOf(t: JournalTrade, chargePerLot: number): JournalLive | null {
  if (t.status !== "open" || t.exit || !t.mark || !t.contract) return null;
  const size = t.contract.lotSize * t.lots;
  if (!(size > 0)) return null;
  const gross = (t.mark.premium - t.entry.premium) * size;
  const charges = chargePerLot * t.lots;
  const net = gross - charges;
  const used = t.entry.premium * size;
  return {
    premium: t.mark.premium,
    pct: t.mark.pct,
    gross: +gross.toFixed(2),
    charges: +charges.toFixed(2),
    net: +net.toFixed(2),
    netPct: used > 0 ? +(net / used).toFixed(4) : null,
    at: t.mark.at,
  };
}

export interface JournalLiveTotals {
  /** Positions still open. */
  open: number;
  /** How many of them the feed has actually put a price on. The gap is the honest part: a
   *  disconnected feed shows `0 of 9` rather than a confident ₹0. */
  marked: number;
  gross: number;
  charges: number;
  net: number;
  used: number;
  netPct: number | null;
  /** Newest mark in the set, or null when nothing is priced. */
  at: number | null;
}

/** The open book, added up. */
export function liveTotals(days: JournalDay[], chargePerLot: number): JournalLiveTotals {
  let open = 0, marked = 0, gross = 0, charges = 0, net = 0, used = 0, at = 0;
  for (const d of days) {
    for (const t of d.trades) {
      if (t.status !== "open" || t.exit) continue;
      open++;
      const l = liveOf(t, chargePerLot);
      if (!l) continue;
      marked++;
      gross += l.gross;
      charges += l.charges;
      net += l.net;
      used += t.amountUsed ?? 0;
      at = Math.max(at, l.at);
    }
  }
  return {
    open, marked,
    gross: +gross.toFixed(2),
    charges: +charges.toFixed(2),
    net: +net.toFixed(2),
    used: +used.toFixed(2),
    netPct: used > 0 ? +(net / used).toFixed(4) : null,
    at: at || null,
  };
}

/**
 * From what minute this row's best/worst is actually known, or null when it covers the trade.
 *
 * The excursions are accumulated from live marks, so a row first marked long after entry has a
 * blind window at the front of it and its "worst it saw" is only the worst of what was watched.
 * A minute or two of slack because the first mark lands on the tick after the entry is not a
 * gap worth captioning.
 */
export function excursionFrom(t: JournalTrade): number | null {
  const from = t.markedFrom;
  if (from === null || from === undefined) return null;
  return from > t.entry.minute + 2 ? from : null;
}

/** "12s ago", "4m ago" — how old a mark is, which is the only way to spot a dead feed. */
export function ago(at: number | null, nowMs: number): string {
  if (at === null || !Number.isFinite(at)) return "—";
  const s = Math.max(0, Math.round((nowMs - at) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ${m % 60}m ago`;
}

/** Where the record lives, and whether the far half of it is answering. */
export interface JournalSync {
  mode: "disk" | "neon" | "mirror";
  remote: "ok" | "degraded" | "off";
  pending: number;
  lastPushAt: number | null;
  lastPullAt: number | null;
  lastError: string | null;
  servedFromLocal: boolean;
}

export interface JournalSyncProbe {
  configured: boolean;
  host?: string;
  ok?: boolean;
  note?: string;
  steps: Array<{ step: string; ok: boolean; detail?: string }>;
}

export interface JournalView {
  from: string;
  to: string;
  channel: JournalChannel | null;
  days: JournalDay[];
  totals: JournalTotals;
  sync: JournalSync;
  config: {
    enabled: boolean;
    tpPct: number;
    slPct: number;
    squareOffMin: number;
    chargePerLot: number;
    lots: number;
    backfillDays: number;
    shadow: Array<{ name: string; tp: number; sl: number }>;
  };
  /** Weekdays in the range with no record at all — not the same as "no signals". */
  emptyDays: number;
}

/** What the store badge says, and whether it is worth acting on. */
export function syncLabel(s: JournalSync): { text: string; tone: "good" | "warn" | "bad" | "plain" } {
  if (s.mode === "disk") return { text: "this machine only", tone: "plain" };
  // An unreachable store is the worst state: the page is showing one machine's view of a record
  // that is meant to be shared.
  if (s.servedFromLocal) return { text: "store unreachable", tone: "bad" };
  // Checked regardless of whether the store is reachable RIGHT NOW. A queue that has not drained
  // means the other machine cannot see those trades yet, which is the thing worth knowing.
  if (s.pending > 0) return { text: `${s.pending} not yet shared`, tone: "warn" };
  if (s.remote === "degraded") return { text: "store degraded", tone: "warn" };
  return { text: "shared", tone: "good" };
}

/* ------------------------------------------------------------------------ formatting --- */

/** Indian grouping, no decimals, explicit sign. Rupee amounts are read, not calculated with. */
export function inr(n: number | null | undefined, sign = false): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const s = Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
  const lead = n < 0 ? "−" : sign ? "+" : "";
  return `${lead}₹${s}`;
}

/** A premium, which needs paise — a ₹12.85 option is not a ₹13 one. */
export const prem = (n: number | null | undefined): string =>
  n === null || n === undefined || !Number.isFinite(n) ? "—" : `₹${n.toFixed(2)}`;

export function pct(n: number | null | undefined, dp = 1, sign = true): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const v = 100 * n;
  return `${sign && v >= 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(dp)}%`;
}

/**
 * Minute of session back to a clock face. 0 is 09:15 AM.
 *
 * Rendered through `clock12` rather than assembled here, so the journal reads the same way as
 * every other clock on the platform — this was the one page still on a 24-hour face.
 */
export function sessionClock(minute: number | null | undefined): string {
  if (minute === null || minute === undefined || !Number.isFinite(minute)) return "—";
  const t = 9 * 60 + 15 + minute;
  return clock12(Math.floor(t / 60), t % 60);
}

export const EXIT_LABEL: Record<ExitReason, string> = {
  target: "Target",
  stop: "Stopped",
  "square-off": "Squared off",
  // Covers both ways a position ends on the operator's say-so: a price typed in from the
  // contract note, and the row's own Exit button. "Your fill" only described the first.
  manual: "You exited",
  untracked: "Not priced",
};

/** Local date as YYYY-MM-DD, for the date input. Not UTC — a date picker is a wall clock. */
export function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function shiftDay(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(y, m - 1, d);
  t.setDate(t.getDate() + days);
  return isoLocal(t);
}

/** IST today, whatever timezone the browser is in — the journal's days are session days. */
export function istToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parts;
}

/** "1 trade", "6 trades" — a count next to a mis-agreeing noun reads as a bug in the number. */
export const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

export type RangeMode = "day" | "week" | "month" | "custom";

/** The [from, to] a mode implies, anchored on the picked date. */
export function rangeFor(mode: RangeMode, anchor: string, customFrom: string): { from: string; to: string } {
  if (mode === "day") return { from: anchor, to: anchor };
  if (mode === "week") return { from: shiftDay(anchor, -6), to: anchor };
  if (mode === "month") return { from: `${anchor.slice(0, 7)}-01`, to: anchor };
  return { from: customFrom <= anchor ? customFrom : anchor, to: anchor };
}
