// Server-side loader for Option Apex.
//
// The upstream endpoints are the real feed's, params and all: base64 JSON in a ?data=
// query under the money_flux namespace. This is the one place that encoding lives,
// shared by the server render and the same-origin route the page polls.

import { expParam } from "./oi";
import type { ApexChart, ApexDials, ApexFlux, IndexMover, RunningExpiry } from "./types";

const BASE = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4100";

/** The Index selector. Keys are the `script` the feed takes; labels are the real page's. */
export const SCRIPTS: [string, string][] = [
  ["NIFTY 50", "Nifty50"],
  ["NIFTY BANK", "BankNifty"],
  ["FINNIFTY", "FinNifty"],
  ["MIDCPNIFTY", "MidCpNifty"],
];

/** The Time selector, in minutes. The real page defaults to 3m. */
export const TIMEFRAMES = [1, 3, 5, 15, 30, 60];
export const DEFAULT_TF = 3;
export const DEFAULT_SCRIPT = "NIFTY 50";

export const scriptLabel = (s: string) => SCRIPTS.find(([k]) => k === s)?.[1] ?? s;

const encode = (o: Record<string, string | number>) => Buffer.from(JSON.stringify(o)).toString("base64");

interface Envelope<T> { payload?: { data: T }; status?: string; source?: string; note?: string; error?: string }

async function call<T>(path: string, params: Record<string, string | number>): Promise<{ data: T; source?: string; note?: string }> {
  const res = await fetch(`${BASE}/api_be/money_flux/${path}?data=${encodeURIComponent(encode(params))}`, {
    cache: "no-store",
  });
  const j = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (!res.ok || !j || j.status !== "SUCCESS") throw new Error(j?.error || `${path} -> ${res.status}`);
  return { data: j.payload!.data, source: j.source, note: j.note };
}

export interface ApexLoad {
  script: string;
  tf: number;
  exp: string;                 // compact feed form, "04Aug26"
  expiries: RunningExpiry[];
  chart: ApexChart;
  flux: ApexFlux;
  /**
   * Null when Upstox couldn't answer for this index and day. The dials are left off rather
   * than drawn at zero — a needle resting dead centre is a reading, and "we have no
   * reading" is not the same claim.
   */
  dials: ApexDials | null;
  /** Why the dials are missing, when they are — usually a rejected Upstox token. */
  dialsError?: string;
  mover: IndexMover | null;
  source?: string;
  note?: string;
}

/**
 * Everything one view of the page needs.
 *
 * Ordered the way the real page fires them: the expiry list first, because nothing
 * option-side can be asked for without one, then the chart — whose trading day the flux
 * and dials are then pinned to, so the histogram under the candles is measured over the
 * session the candles actually show rather than whatever the calendar says today is.
 */
export async function loadApex(script = DEFAULT_SCRIPT, tf = DEFAULT_TF, exp?: string): Promise<ApexLoad> {
  const { data: expiries } = await call<RunningExpiry[]>("get_running_expiry", { script });
  const chosen = exp || (expiries[0] ? expParam(expiries[0][0]) : "");

  const chart = await call<ApexChart>("chart", { script, tf, exp: chosen });
  const forDay = { script, exp: chosen, day: chart.data.day };

  // Each panel below the chart fails on its own. The dials need Upstox and the mover needs
  // an NSE constituent list, and neither absence is a reason to show nothing at all — the
  // chart and whatever else answered are still worth having on screen.
  const [flux, dials, mover] = await Promise.all([
    call<ApexFlux>("op_histogram", { ...forDay, tf }),
    // Upstox serves the PCR, so a rejected token takes this panel and nothing else. Its
    // message is carried through to the page rather than swallowed.
    call<ApexDials>("op_dial", { ...forDay, tf }).catch((e: Error) => ({ error: String(e.message) })),
    indexMover(script).catch(() => null),
  ]);

  const dialData = "error" in dials ? null : dials.data;
  return {
    script, tf, exp: chosen, expiries,
    chart: chart.data, flux: flux.data, dials: dialData, mover,
    dialsError: "error" in dials ? dials.error : undefined,
    source: chart.source, note: chart.note ?? flux.note,
  };
}

/** Point contribution per constituent — the Index Mover panel. */
async function indexMover(script: string): Promise<IndexMover | null> {
  // Only the two indices NSE publishes a constituent list for; the narrower ones have no
  // point-contribution feed, and the panel is simply left off rather than faked.
  if (script !== "NIFTY 50" && script !== "NIFTY BANK") return null;
  const res = await fetch(`${BASE}/api_be/data/order/indice_point_movement?index=${encodeURIComponent(script)}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  const j = (await res.json()) as Envelope<IndexMover>;
  return j.payload?.data ?? null;
}
