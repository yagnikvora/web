// Decoding for the Option Clock feed.
//
// The feed keys every leg by its NSE contract name, so a snapshot is a flat map and the
// strike ladder has to be read back out of the keys. Weekly contracts spell the expiry
// as yy + month code + dd (NFO:NIFTY2680424300CE = 04-Aug-2026, 24300 call), monthly
// ones as yy + MMM (NFO:NIFTY26AUG24300CE) — both are matched here so the ladder builds
// the same way whichever expiry is on screen.

import type { OiSnapshot } from "./types";

const CONTRACT = /^NFO:[A-Z]+?\d{2}(?:[1-9OND]\d{2}|[A-Z]{3})(\d+)(CE|PE)$/;

export interface StrikeRow {
  strike: number;
  ceOI: number; peOI: number;   // open interest now
  ceChg: number; peChg: number; // change across the selected window
}

/** Strike and side of a contract key, or null for anything else in the map ("atm"). */
function parseContract(key: string): { strike: number; side: "CE" | "PE" } | null {
  const m = CONTRACT.exec(key);
  return m ? { strike: Number(m[1]), side: m[2] as "CE" | "PE" } : null;
}

/**
 * The strike ladder, lowest first, with OI as of `to` and the change since `from`.
 * `from` missing (a window with only one recorded snapshot) leaves the changes at zero
 * rather than pretending the whole of the day's OI was built inside the window.
 */
export function ladder(to: OiSnapshot | undefined, from?: OiSnapshot): StrikeRow[] {
  if (!to) return [];
  const rows = new Map<number, StrikeRow>();
  for (const [key, oi] of Object.entries(to)) {
    const c = parseContract(key);
    if (!c) continue;
    const row = rows.get(c.strike) ?? { strike: c.strike, ceOI: 0, peOI: 0, ceChg: 0, peChg: 0 };
    const prev = from?.[key];
    if (c.side === "CE") { row.ceOI = oi; row.ceChg = prev == null ? 0 : oi - prev; }
    else { row.peOI = oi; row.peChg = prev == null ? 0 : oi - prev; }
    rows.set(c.strike, row);
  }
  return Array.from(rows.values()).sort((a, b) => a.strike - b.strike);
}

/** Totals across the ladder. Bulls are the puts, bears the calls; PCR is bulls ÷ bears. */
export function totals(rows: StrikeRow[]) {
  const bulls = rows.reduce((a, r) => a + r.peOI, 0);
  const bears = rows.reduce((a, r) => a + r.ceOI, 0);
  return {
    bulls, bears,
    pcr: bears > 0 ? bulls / bears : 0,
    bullsChg: rows.reduce((a, r) => a + r.peChg, 0),
    bearsChg: rows.reduce((a, r) => a + r.ceChg, 0),
  };
}

/** The two timestamps of a window payload, oldest first. */
export const bounds = (snaps: Record<string, unknown>) =>
  Object.keys(snaps).map(Number).sort((a, b) => a - b);

/** ATM strike carried alongside the ladder in every snapshot. */
export const atmOf = (snap: OiSnapshot | undefined) => snap?.atm ?? 0;

/* ---------- session clock ---------- */

const IST_OFFSET_S = 330 * 60;
const SESSION_START_MIN = 9 * 60 + 15;
const SESSION_END_MIN = 15 * 60 + 30;


/** The IST calendar day an instant falls in, YYYY-MM-DD. */
export const istDay = (nowMs = Date.now()) =>
  new Date(nowMs + IST_OFFSET_S * 1000).toISOString().slice(0, 10);

/** Epoch (s) of 09:15 IST on a given IST calendar day. */
function dayOpen(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 1000 - IST_OFFSET_S + SESSION_START_MIN * 60;
}
const dayClose = (day: string) => dayOpen(day) + (SESSION_END_MIN - SESSION_START_MIN) * 60;

/**
 * A day's slot times for a step: 09:15, 09:25, … 15:25, then 15:30. Mirrors
 * sessionGrid() in api/src/oiclock.ts — the close is appended rather than stepped to,
 * because the trading day isn't a whole number of ten-minute steps and the last reading
 * of the day is the one most worth a row.
 */
export function sessionGrid(step: number, day = istDay()): number[] {
  const open = dayOpen(day), close = dayClose(day);
  const out: number[] = [];
  for (let t = open; t < close; t += step) out.push(t);
  out.push(close);
  return out;
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Today" for the current session, otherwise "Thu, 30 Jul". */
export function dayLabel(day: string, nowMs = Date.now()): string {
  if (day === istDay(nowMs)) return "Today";
  const [y, m, d] = day.split("-").map(Number);
  const at = new Date(Date.UTC(y, m - 1, d));
  return `${DOW[at.getUTCDay()]}, ${d} ${MONTHS[m - 1]}`;
}

/** "09:15" for an epoch, read in IST whatever timezone the browser is in. */
export const istTime = (epochS: number) =>
  new Date((epochS + IST_OFFSET_S) * 1000).toISOString().slice(11, 16);

/* ---------- expiry labels ---------- */

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "04Aug26" — the compact form the feed takes as its `exp` parameter. */
export function expParam(epochS: number): string {
  const d = new Date((epochS + IST_OFFSET_S) * 1000);
  return `${String(d.getUTCDate()).padStart(2, "0")}${MON[d.getUTCMonth()]}${String(d.getUTCFullYear()).slice(2)}`;
}

/** "Aug-04" plus how far off it is, exactly as the real expiry dropdown reads. */
export function expLabel(epochS: number, nowMs = Date.now()): { date: string; away: string } {
  const d = new Date((epochS + IST_OFFSET_S) * 1000);
  const date = `${MON[d.getUTCMonth()]}-${String(d.getUTCDate()).padStart(2, "0")}`;
  const days = Math.ceil((epochS * 1000 - nowMs) / 86400e3);
  const away = days <= 0 ? "Today" : days === 1 ? "In 1 Day" : `In ${days} Days`;
  return { date, away };
}


/** Compact axis/label numbers: 144118 -> "144.1k". */
export const compact = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e7) return `${(n / 1e7).toFixed(2)}Cr`;
  if (a >= 1e5) return `${(n / 1e5).toFixed(2)}L`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(Math.round(n));
};

export const groupIN = (n: number) => Math.round(n).toLocaleString("en-IN");
