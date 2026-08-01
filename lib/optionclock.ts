// Server-side loader for Option Clock.
//
// The upstream endpoints are the real feed's, params and all: base64 JSON in a ?data=
// query. This is the one place that encoding lives, shared by the server render and the
// same-origin proxy the page polls.

import { istDay } from "./oi";
import type { OptionClock, PcrPoint, RunningExpiry, OiSnapshots } from "./types";

const BASE = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4100";

/** The trend's row spacing. Ten minutes, matching the real page's reading cadence. */
export const PCR_STEP = 600;

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

/**
 * Everything one view of the clock needs, for one trading day.
 *
 * The expiry list comes first because the OI calls can't be made without one — the same
 * order the real page fires them in. `day` is passed down rather than a time window: the
 * API derives the session bounds from it, so a past day reads entirely out of the store
 * and never asks NSE for a chain that would describe today instead.
 */
export async function loadClock(script: string, exp?: string, day?: string): Promise<ClockLoad> {
  const expiries = await call<RunningExpiry[]>("get_running_expiry", { script });
  const base = { script, exp: exp ?? "" };
  const days = await call<string[]>("trading_days", base).catch(() => [] as string[]);
  const on = day || days[0] || istDay();
  const forDay = { ...base, day: on };

  const [live, window, pcr] = await Promise.all([
    call<OiSnapshots>("live_oi", forDay),
    call<OiSnapshots>("index_analysis", forDay),
    call<PcrPoint[]>("pcr_series", { ...forDay, step: PCR_STEP }),
  ]);
  return { expiries, days: days.length ? days : [on], day: on, live, window, pcr };
}
