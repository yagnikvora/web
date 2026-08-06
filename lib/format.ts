export const fmt = (n: number | null | undefined, d = 2) =>
  n == null || Number.isNaN(n) ? "—" : Number(n).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });

export const signCls = (n: number) => (n >= 0 ? "text-bull" : "text-bear");

export const tvLink = (sym: string) =>
  `https://www.tradingview.com/chart/?symbol=NSE:${encodeURIComponent(sym.replace("&", "_"))}&interval=5`;

export const titleCase = (k: string) =>
  k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/* ------------------------------------------------------------------------- clocks --- */
//
// EVERY clock reading on this platform comes from `istClock` below. One helper rather than the
// seven near-copies this replaced, which had drifted into three different answers for the same
// instant: some passed `timeZone: "Asia/Kolkata"` and some did not, so a laptop outside India
// read the alert feed in IST and the "updated" stamp beside it in local time.
//
// TWO THINGS ARE DELIBERATE AND SHOULD SURVIVE AN EDIT.
//
//   The string is assembled here rather than by `toLocaleTimeString(..., { hour12: true })`.
//   Locale output is not stable enough to render: `en-IN` gives lowercase "09:15 am" where
//   `en-US` gives "09:15 AM", and recent Chrome puts a NARROW NO-BREAK SPACE (U+202F) before
//   the meridiem where Node still uses a plain space. These strings are server-rendered and
//   then hydrated, and are used as chart category values — a byte that differs between Node
//   and the browser is a hydration mismatch and a broken axis lookup, not a cosmetic issue.
//
//   IST is applied as a fixed +5:30 shift read back through the UTC getters. India has no DST,
//   so the shift is exact, and it needs no ICU timezone data to be present.

/** India is UTC+5:30 year-round. */
const IST_OFFSET_MS = 330 * 60_000;

/**
 * An epoch (MILLISECONDS) as an Indian 12-hour clock reading — "09:15 AM", "03:18 PM".
 *
 * `withSeconds` is for stamps that say when something was last refreshed, where the seconds are
 * the point: two readings a few seconds apart are otherwise indistinguishable.
 */
export function istClock(ms: number, withSeconds = false): string {
  const d = new Date(ms + IST_OFFSET_MS);
  const h24 = d.getUTCHours();
  const hh = String(h24 % 12 || 12).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = withSeconds ? `:${String(d.getUTCSeconds()).padStart(2, "0")}` : "";
  return `${hh}:${mm}${ss} ${h24 < 12 ? "AM" : "PM"}`;
}

/** The same reading from an epoch in SECONDS, which is what the option feeds carry. */
export const istClockS = (epochS: number, withSeconds = false) => istClock(epochS * 1000, withSeconds);

/** @deprecated Prefer `istClockS` — kept because several option pages still import this name. */
export const timeOfDay = istClockS;

/**
 * The clock part of a "YYYY-MM-DD HH:MM:SS" stamp, so a table cell shows "01:18 PM" rather
 * than wrapping the whole date onto two lines.
 *
 * Read off the string rather than parsed into a Date on purpose: the stamp carries no zone,
 * so anything that turned it into an instant would have to invent one, and would shift
 * every reading by that guess. It is ALREADY IST — that is what the backend sends — so there
 * is no shift to apply here, only a reformat. Anything not in that shape is passed through.
 */
export const stampTime = (s: string) => {
  const m = /\b(\d{2}):(\d{2}):\d{2}\b/.exec(s);
  if (!m) return s;
  const h = Number(m[1]);
  return `${String(h % 12 || 12).padStart(2, "0")}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
};
