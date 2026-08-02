export const fmt = (n: number | null | undefined, d = 2) =>
  n == null || Number.isNaN(n) ? "—" : Number(n).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });

export const signCls = (n: number) => (n >= 0 ? "text-bull" : "text-bear");

export const tvLink = (sym: string) =>
  `https://www.tradingview.com/chart/?symbol=NSE:${encodeURIComponent(sym.replace("&", "_"))}&interval=5`;

export const titleCase = (k: string) =>
  k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** An epoch (seconds) as a 12-hour clock reading. */
export const timeOfDay = (epoch: number) =>
  new Date(epoch * 1000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

/**
 * The clock part of a "YYYY-MM-DD HH:MM:SS" stamp, so a table cell shows "01:18 PM" rather
 * than wrapping the whole date onto two lines.
 *
 * Read off the string rather than parsed into a Date on purpose: the stamp carries no zone,
 * so anything that turned it into an instant would have to invent one, and would shift
 * every reading by that guess. Anything not in that shape is passed through untouched.
 */
export const stampTime = (s: string) => {
  const m = /\b(\d{2}):(\d{2}):\d{2}\b/.exec(s);
  if (!m) return s;
  const h = Number(m[1]);
  return `${String(h % 12 || 12).padStart(2, "0")}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
};
