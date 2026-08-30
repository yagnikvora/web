// What the journal page shows that the API does not already send.
//
// The API answers "what happened to each trade". A portfolio page has to answer a different
// question — "is this edge worth trading" — and that one is asked of the whole set at once:
// the curve, the drawdown it went through to get there, how much a winner pays for a loser.
// All of it is derived on the client because it is derived from rows the client already has;
// asking the server for a second opinion on numbers it already sent would just be a round trip.
//
// EVERY STATISTIC HERE IGNORES UNTRACKED AND OPEN ROWS. A trade with no exit price has no
// result, and a mean taken over a null is how a journal quietly flatters itself. `scored` says
// how many rows the figures actually cover, so a thin sample reads as a thin sample.

import type { ExitReason, JournalDay, JournalTrade } from "@/lib/journal";

/** A row with a real, finished number on it — the only kind anything below will average. */
const isScored = (t: JournalTrade): boolean =>
  t.exit !== null && t.exit.reason !== "untracked" && typeof t.netPnl === "number";

/** Oldest first, and within a day in the order the positions were actually taken. */
function chronological(days: JournalDay[]): JournalTrade[] {
  return days
    .flatMap((d) => d.trades)
    .sort((a, b) => (a.day === b.day ? a.entry.minute - b.entry.minute : a.day < b.day ? -1 : 1));
}

/** The move on the premium itself, which is the scale MFE and MAE are quoted on. */
export function movePct(t: JournalTrade): number | null {
  if (!t.exit || t.exit.reason === "untracked" || !(t.entry.premium > 0)) return null;
  return t.exit.premium / t.entry.premium - 1;
}

/**
 * The stop in force on a row: as a fraction of premium, and as the price it sits at.
 *
 * MIRRORS THE API'S `journalTick`, and has to stay mirrored. The stop starts at −`slPct` and
 * moves ONCE, to `lockPct`, the moment the position has been up `armAtPct`. It never moves
 * again and it never moves back — so a row whose best already cleared the arming level is
 * showing the locked level even if it later gave the whole move back. That is the point of the
 * checkpoint, and a column that redrew the stop as the price fell would be describing a
 * different rule from the one being traded.
 *
 * With `armAtPct` unset or zero the checkpoint is switched off upstream, and this is just the
 * flat stop.
 */
export function stopOf(
  t: JournalTrade,
  cfg: { slPct: number; armAtPct?: number; lockPct?: number },
): { pct: number; premium: number | null; armed: boolean } {
  const arm = cfg.armAtPct ?? 0;
  const armed = arm > 0 && (t.mfePct ?? 0) >= arm;
  const pct = armed ? (cfg.lockPct ?? 0) : -cfg.slPct;
  return {
    pct,
    premium: t.entry.premium > 0 ? +(t.entry.premium * (1 + pct)).toFixed(2) : null,
    armed,
  };
}

/** How long the position was held, in minutes of session. */
export const holdMin = (t: JournalTrade): number | null =>
  t.exit && t.exit.reason !== "untracked" ? Math.max(0, t.exit.minute - t.entry.minute) : null;

/** "2h 05m" — a hold time reads as a duration, never as a clock face. */
export function holdLabel(min: number | null | undefined): string {
  if (min === null || min === undefined || !Number.isFinite(min)) return "—";
  const m = Math.round(min);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

export interface EquityPoint {
  /** 1-based position in the sequence — the x-axis of a curve drawn trade by trade. */
  n: number;
  day: string;
  symbol: string;
  net: number;
  /** Running total after this trade. */
  cum: number;
}

export interface DayPoint {
  day: string;
  net: number;
  cum: number;
  trades: number;
  wins: number;
  losses: number;
  winRate: number | null;
}

export interface ExitSlice {
  reason: ExitReason;
  n: number;
  net: number;
}

export interface Rollup {
  /** How many rows every figure below is actually computed over. */
  scored: number;
  equity: EquityPoint[];
  daily: DayPoint[];
  grossProfit: number;
  grossLoss: number;
  /** Rupees won per rupee lost. Null with no losses — an infinity is not a statistic. */
  profitFactor: number | null;
  avgWin: number | null;
  /** Negative, so it reads the way it lands in the account. */
  avgLoss: number | null;
  /** Average win over average loss. How much a winner has to be worth to carry a loser. */
  payoff: number | null;
  /** Net per trade. The one number that says whether taking the next signal is worth it. */
  expectancy: number | null;
  /** Deepest fall from a high-water mark on the trade-by-trade curve, in rupees. */
  maxDrawdown: number;
  /** The day the curve was at the bottom of that fall. */
  maxDrawdownAt: string | null;
  winStreak: number;
  lossStreak: number;
  /** The run the range ends on — the only streak that is still alive. */
  currentStreak: { dir: 1 | -1 | 0; n: number };
  avgHold: number | null;
  avgWinHold: number | null;
  avgLossHold: number | null;
  /** Average of the best each trade saw, and of the worst — the room the exits worked in. */
  avgMfe: number | null;
  avgMae: number | null;
  exits: ExitSlice[];
  greenDays: number;
  redDays: number;
  bestDay: DayPoint | null;
  worstDay: DayPoint | null;
}

const mean = (xs: number[]): number | null =>
  xs.length ? +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2) : null;

export function rollup(days: JournalDay[]): Rollup {
  const all = chronological(days);
  const done = all.filter(isScored);

  const equity: EquityPoint[] = [];
  let cum = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let maxDrawdownAt: string | null = null;

  for (const t of done) {
    const net = t.netPnl as number;
    cum = +(cum + net).toFixed(2);
    peak = Math.max(peak, cum);
    const dd = peak - cum;
    if (dd > maxDrawdown) {
      maxDrawdown = +dd.toFixed(2);
      maxDrawdownAt = t.day;
    }
    equity.push({ n: equity.length + 1, day: t.day, symbol: t.symbol, net, cum });
  }

  // Days, oldest first. Built from the rows rather than from `day.totals`, so a channel filter
  // narrows the curve exactly the way it narrows the table underneath it.
  const byDay = new Map<string, DayPoint>();
  for (const t of done) {
    const net = t.netPnl as number;
    const d = byDay.get(t.day)
      ?? { day: t.day, net: 0, cum: 0, trades: 0, wins: 0, losses: 0, winRate: null };
    d.net = +(d.net + net).toFixed(2);
    d.trades++;
    if (net > 0) d.wins++;
    else if (net < 0) d.losses++;
    byDay.set(t.day, d);
  }
  // `Array.from` rather than a spread: this project targets ES5, where iterating a Map's
  // values needs downlevelIteration and a spread does not compile.
  const daily = Array.from(byDay.values()).sort((a, b) => (a.day < b.day ? -1 : 1));
  let running = 0;
  for (const d of daily) {
    running = +(running + d.net).toFixed(2);
    d.cum = running;
    const decided = d.wins + d.losses;
    d.winRate = decided ? +(d.wins / decided).toFixed(4) : null;
  }

  const wins = done.filter((t) => (t.netPnl as number) > 0);
  const losses = done.filter((t) => (t.netPnl as number) < 0);
  const grossProfit = +wins.reduce((a, t) => a + (t.netPnl as number), 0).toFixed(2);
  const grossLoss = +Math.abs(losses.reduce((a, t) => a + (t.netPnl as number), 0)).toFixed(2);

  const avgWin = mean(wins.map((t) => t.netPnl as number));
  const avgLoss = mean(losses.map((t) => t.netPnl as number));

  // Streaks, walked once.
  let winStreak = 0, lossStreak = 0, run = 0, dir: 1 | -1 | 0 = 0;
  for (const t of done) {
    const net = t.netPnl as number;
    const d: 1 | -1 | 0 = net > 0 ? 1 : net < 0 ? -1 : 0;
    if (d === 0) { run = 0; dir = 0; continue; }
    run = d === dir ? run + 1 : 1;
    dir = d;
    if (d === 1) winStreak = Math.max(winStreak, run);
    else lossStreak = Math.max(lossStreak, run);
  }

  // Ordered best-to-worst-ish rather than alphabetically, and every member is listed: a reason
  // missing from here is a reason that vanishes out of "How they ended" without a trace.
  const exitOrder: ExitReason[] = [
    "target", "checkpoint", "stop", "square-off", "manual", "untracked",
  ];
  const exits: ExitSlice[] = exitOrder
    .map((reason) => {
      const rows = all.filter((t) => t.exit?.reason === reason);
      return { reason, n: rows.length, net: +rows.reduce((a, t) => a + (t.netPnl ?? 0), 0).toFixed(2) };
    })
    .filter((s) => s.n > 0);

  const holds = done.map(holdMin).filter((m): m is number => m !== null);

  return {
    scored: done.length,
    equity,
    daily,
    grossProfit,
    grossLoss,
    profitFactor: grossLoss > 0 ? +(grossProfit / grossLoss).toFixed(2) : null,
    avgWin,
    avgLoss,
    payoff: avgWin !== null && avgLoss !== null && avgLoss !== 0
      ? +(avgWin / Math.abs(avgLoss)).toFixed(2)
      : null,
    expectancy: mean(done.map((t) => t.netPnl as number)),
    maxDrawdown,
    maxDrawdownAt,
    winStreak,
    lossStreak,
    currentStreak: { dir, n: run },
    avgHold: holds.length ? Math.round(holds.reduce((a, b) => a + b, 0) / holds.length) : null,
    avgWinHold: mean(wins.map(holdMin).filter((m): m is number => m !== null)),
    avgLossHold: mean(losses.map(holdMin).filter((m): m is number => m !== null)),
    avgMfe: mean(done.map((t) => t.mfePct).filter((p): p is number => typeof p === "number")),
    avgMae: mean(done.map((t) => t.maePct).filter((p): p is number => typeof p === "number")),
    exits,
    greenDays: daily.filter((d) => d.net > 0).length,
    redDays: daily.filter((d) => d.net < 0).length,
    bestDay: daily.length ? daily.reduce((a, b) => (b.net > a.net ? b : a)) : null,
    worstDay: daily.length ? daily.reduce((a, b) => (b.net < a.net ? b : a)) : null,
  };
}

/* ------------------------------------------------------------------------ the calendar --- */

export interface CalCell {
  /** null for a padding cell — a slot that belongs to no day of this month. */
  day: string | null;
  inRange: boolean;
  point: DayPoint | null;
}

export interface CalMonth {
  /** "2026-08" */
  key: string;
  label: string;
  /**
   * Rows of five: Monday to Friday. The market is shut at the weekend, and two dead columns in
   * every week is a fifth of the grid spent saying nothing.
   */
  weeks: CalCell[][];
  net: number;
  days: number;
}

const monthLabel = (key: string) =>
  new Date(`${key}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * The month grids covering [from, to].
 *
 * Capped at six, because a custom range can be a year wide and thirteen grids stops being a
 * calendar and becomes a wall.
 */
export function calendar(from: string, to: string, daily: DayPoint[]): CalMonth[] {
  const points = new Map(daily.map((d) => [d.day, d]));
  const months: CalMonth[] = [];

  const cursorMonth = new Date(`${from.slice(0, 7)}-01T00:00:00`);
  const lastMonth = new Date(`${to.slice(0, 7)}-01T00:00:00`);

  while (cursorMonth <= lastMonth && months.length < 6) {
    const key = iso(cursorMonth).slice(0, 7);
    const cells: CalCell[] = [];
    const day = new Date(cursorMonth);

    // Lead with blanks so the 1st lands under its own weekday column. Weekend starts get no
    // lead-in at all, since Saturday and Sunday have no column to sit in.
    const lead = Math.min((day.getDay() + 6) % 7, 5) % 5;
    for (let i = 0; i < lead; i++) cells.push({ day: null, inRange: false, point: null });

    let net = 0;
    let traded = 0;
    while (day.getMonth() === cursorMonth.getMonth()) {
      const dow = day.getDay();
      if (dow !== 0 && dow !== 6) {
        const d = iso(day);
        const point = points.get(d) ?? null;
        if (point) { net += point.net; traded++; }
        cells.push({ day: d, inRange: d >= from && d <= to, point });
      }
      day.setDate(day.getDate() + 1);
    }
    while (cells.length % 5 !== 0) cells.push({ day: null, inRange: false, point: null });

    const weeks: CalCell[][] = [];
    for (let i = 0; i < cells.length; i += 5) weeks.push(cells.slice(i, i + 5));
    months.push({ key, label: monthLabel(key), weeks, net: +net.toFixed(2), days: traded });

    cursorMonth.setMonth(cursorMonth.getMonth() + 1);
  }

  return months;
}
