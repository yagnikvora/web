// Server-side loader for Option Clock.
//
// The three upstream endpoints are the real feed's, params and all: base64 JSON in a
// ?data= query. This is the one place that encoding lives, shared by the server render
// and the same-origin proxy the page polls.

import { sessionClose, sessionOpen } from "./oi";
import type { OptionClock, PcrPoint, RunningExpiry, OiSnapshots } from "./types";

const BASE = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4100";

const encode = (o: Record<string, string | number>) => Buffer.from(JSON.stringify(o)).toString("base64");

async function call<T>(path: string, params: Record<string, string | number>): Promise<T> {
  const res = await fetch(`${BASE}/api_be/index_analysis/${path}?data=${encodeURIComponent(encode(params))}`, {
    cache: "no-store",
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j || j.status !== "SUCCESS") throw new Error(j?.error || `${path} -> ${res.status}`);
  return j.payload.data as T;
}

export interface ClockLoad extends OptionClock {
  source?: string;
  note?: string;
}

/** The PCR trend's row spacing, in seconds. */
export const PCR_STEP = 600;

/**
 * Everything one view of the clock needs. The expiry list comes first because the OI
 * calls can't be made without one — the same order the real page fires them in.
 *
 * The clock always reads over the whole session; the three calls share one upstream
 * chain fetch, so this costs no more than a single one.
 */
export async function loadClock(script: string, exp?: string): Promise<ClockLoad> {
  const expiries = await call<RunningExpiry[]>("get_running_expiry", { script });
  const params = { script, exp: exp ?? "" };
  const [live, window, pcr] = await Promise.all([
    call<OiSnapshots>("live_oi", params),
    call<OiSnapshots>("index_analysis", { ...params, ts1: String(sessionOpen()), ts2: String(sessionClose()) }),
    call<PcrPoint[]>("pcr_series", { ...params, step: String(PCR_STEP) }),
  ]);
  return { expiries, live, window, pcr };
}
