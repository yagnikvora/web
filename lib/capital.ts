"use client";

// The capital a month is started with, as set from the account menu in the nav.
//
// WHAT IT IS FOR. The journal reports each day as a gain or a loss, which answers "how did the
// day go" and not "what is in the account now". With this figure the journal can say the second
// thing: the starting capital plus every net result of the month up to and including that day.
//
// WHY IT LIVES IN THE BROWSER. It is one number, it belongs to whoever is reading rather than to
// the scanner, and nothing on the server computes with it. The cost is that it is set once per
// browser — a second machine asks again.
//
// ONE FIGURE, EVERY MONTH. Each month is read as starting from the same amount, which is the
// question as it was asked ("if I start the month with X"). It is not a ledger: profits are not
// carried into the next month and deposits and withdrawals are not known here.

import { useCallback, useEffect, useState } from "react";

const KEY = "trinetra.monthStartCapital";
/** Fired on this window after a save, because `storage` only reaches OTHER tabs. */
const CHANGED = "trinetra:capital";

function read(): number | null {
  try {
    const n = Number(window.localStorage.getItem(KEY));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    // Storage can be refused outright (private mode, a locked-down profile). No figure, then.
    return null;
  }
}

/**
 * The starting capital and its setter. Null until one has been set.
 *
 * Starts null on the first render and fills in from an effect, so the server's HTML and the
 * browser's first pass agree — the same reason the journal's market clock starts `false`.
 */
export function useStartingCapital(): [number | null, (v: number | null) => void] {
  const [capital, setCapital] = useState<number | null>(null);

  useEffect(() => {
    const sync = () => setCapital(read());
    sync();
    window.addEventListener(CHANGED, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGED, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const save = useCallback((v: number | null) => {
    try {
      if (v === null || !(v > 0)) window.localStorage.removeItem(KEY);
      else window.localStorage.setItem(KEY, String(Math.round(v)));
    } catch {
      // Nothing to do: the figure simply does not persist, and the menu still shows what was typed.
    }
    window.dispatchEvent(new Event(CHANGED));
  }, []);

  return [capital, save];
}

/** Net result per day → what the account holds at the end of each day, restarting every month. */
export function balances(capital: number, netByDay: Map<string, number>): Map<string, number> {
  const out = new Map<string, number>();
  let month = "";
  let running = capital;
  for (const day of Array.from(netByDay.keys()).sort()) {
    if (day.slice(0, 7) !== month) { month = day.slice(0, 7); running = capital; }
    running += netByDay.get(day) ?? 0;
    out.set(day, running);
  }
  return out;
}
