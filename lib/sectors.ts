// Sector membership and strength, derived from the Sector Scope payload.
//
// Lives here rather than under app/sector-scope because Market Pulse needs the same two
// answers for its sector filter: which basket a stock belongs to, and how strong each
// basket is right now. One implementation, so the "8.27 X" in a filter dropdown and the
// bar height on Sector Scope can never disagree.

import type { SectorScope, SectorStock } from "./types";

// OTHERS is a catch-all bucket. The real page maps it in the treemap but leaves it out of
// the strength bars, the per-sector tables and the sector filter, so it is excluded here
// too — a stock that sits only in OTHERS is reachable through "All" and nowhere else.
export const TREEMAP_ONLY = new Set(["OTHERS"]);

// Sector strength, shown as a multiple ("7.05 x") exactly as the real widget labels it.
//
// It is the SUM of each stock's % move scaled by its R.Factor (relative volume), not an
// average — the sum is deliberate. A 3% move on 5x normal volume says far more about
// where money is rotating than the same move on a quiet tape, and a broad sector with
// many participating names should outrank a narrow one. Their data shows that size
// effect plainly (FMCG, 21 names, scores 7.05; CEMENT, 4 names, scores 0.32), which an
// average would erase.
//
// R.Factor is SQUARED, which weights the calm majority down hard and lets the genuinely
// agitated names carry the sector — the behaviour their ranking shows. Squaring only
// pays off once R.Factor is itself accurate (it amplifies error just as readily as
// signal); on an earlier volume-based R.Factor it scored worse than the unsquared form
// and was correctly rejected. Against a live capture of all 15 of their sectors it now
// wins clearly: Spearman 0.946 vs 0.904 unsquared.
//
// The divisor calibrates onto their scale. It's empirical and depends on our R.Factor
// baseline — it shifts every bar's height equally and never changes the ordering.
//
// It therefore has to move whenever R.Factor's level does, and it moves by the SQUARE
// because R.Factor enters squared: the 1.33 calibration added to rfac() in
// api/src/services.ts scales every bar by 1.33² = 1.77, so 26.3 becomes 46.5 to leave
// the bars where they were. Change one of these two constants and you must change the
// other, or the strength axis silently drifts off their scale.
const STRENGTH_DIVISOR = 46.5;

export const sectorStrength = (stocks: SectorStock[]) =>
  +(stocks.reduce((a, s) => a + s.pChange * s.rFactor ** 2, 0) / STRENGTH_DIVISOR).toFixed(2);

export interface SectorRank { name: string; strength: number }

/** The sectors a filter can offer, strongest first — the order the real dropdown lists. */
export function rankSectors(data: SectorScope): SectorRank[] {
  return Object.entries(data)
    .filter(([name, stocks]) => !TREEMAP_ONLY.has(name) && stocks?.length)
    .map(([name, stocks]) => ({ name, strength: sectorStrength(stocks) }))
    .sort((a, b) => b.strength - a.strength);
}

/**
 * Which baskets each symbol sits in.
 *
 * A set per symbol rather than one label, because the baskets overlap heavily: SBIN is in
 * PSU BANK, BANK, FIN SERVICE, NIFTY 50 and SENSEX at once, and picking any of those five
 * has to find it.
 */
export function sectorMembership(data: SectorScope): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const [name, stocks] of Object.entries(data)) {
    if (TREEMAP_ONLY.has(name)) continue;
    for (const s of stocks ?? []) {
      const set = out.get(s.Symbol);
      if (set) set.add(name);
      else out.set(s.Symbol, new Set([name]));
    }
  }
  return out;
}

/** Their dropdown prints the mid-cap basket short. Everything else reads as it is named. */
const SHORT: Record<string, string> = { "NIFTY MID SELECT": "MID SELECT" };
export const sectorLabel = (name: string) => SHORT[name] ?? name;
