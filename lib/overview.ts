// Server-side loader for the home page.
//
// One upstream call: the API composes the ticker, the index cards and the market snapshot
// from a single quote batch (see api/src/overview.ts), so the page's first paint costs one
// request rather than one per panel.

export interface TickerRow { name: string; label: string; last: number; points: number; pct: number }

export interface HeadlineIndex extends TickerRow {
  open: number;
  dayHigh: number;
  dayLow: number;
  prevClose: number;
  /** Session closes at 15-minute resolution, for the card sparkline. */
  spark: number[];
}

export interface MoverRow { Symbol: string; ltp: number; pChange: number; turnover: number }

export interface Overview {
  day: string;
  live: boolean;
  ticker: TickerRow[];
  headline: HeadlineIndex[];
  vix: TickerRow | null;
  breadth: { advances: number; declines: number; total: number };
  gainers: MoverRow[];
  losers: MoverRow[];
  active: MoverRow[];
}

const BASE = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4100";

export async function loadOverview(): Promise<Overview> {
  const res = await fetch(`${BASE}/api_be/data/overview`, { cache: "no-store" });
  const j = await res.json().catch(() => null);
  if (!res.ok || j?.status !== "SUCCESS") throw new Error(j?.error || `overview -> ${res.status}`);
  return j.payload.data as Overview;
}
