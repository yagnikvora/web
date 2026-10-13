"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VIEWER } from "@/lib/brand";
import { useStartingCapital } from "@/lib/capital";
import { useOutsideClose } from "@/lib/useOutsideClose";

// The account chip in the nav, and the one setting that belongs to the reader rather than to the
// scanner: the capital a month is started with. See lib/capital.ts for what the journal does
// with it and why it is kept in the browser.

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

/** "2,00,000", "200000" and "₹2,00,000" are all the same answer. Null for anything else. */
function parse(text: string): number | null {
  const n = Number(text.replace(/[₹,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

export default function AccountMenu() {
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [capital, saveCapital] = useStartingCapital();
  const [text, setText] = useState("");
  const initial = VIEWER.name.trim().charAt(0).toUpperCase() || "?";

  const close = useCallback(() => setOpen(false), []);
  useOutsideClose(open, box, close);

  // The box shows what is saved each time the panel opens, so a figure typed and abandoned does
  // not come back looking like the setting.
  useEffect(() => {
    if (open) setText(capital === null ? "" : capital.toLocaleString("en-IN"));
  }, [open, capital]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const typed = parse(text);
  const dirty = text.trim() === "" ? capital !== null : typed !== capital;
  const invalid = text.trim() !== "" && typed === null;

  const save = () => {
    if (invalid) return;
    saveCapital(text.trim() === "" ? null : typed);
    setOpen(false);
  };

  return (
    // Anchored to the nav bar below `sm`, to the chip above it — the same reason AlertSettings is.
    <div className="sm:relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Account settings"
        aria-label="Account settings"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg text-muted hover:text-white transition-colors"
      >
        <span className="hidden sm:inline">{VIEWER.name}</span>
        <span
          className={`grid place-items-center w-8 h-8 rounded-full bg-chip border text-white font-bold ${
            open ? "border-white/30" : "border-border"
          }`}
        >
          {initial}
        </span>
      </button>

      {open && (
        <div
          className="absolute right-3 top-[calc(100%+6px)] sm:right-0 sm:top-[calc(100%+10px)] z-50
                     w-[min(324px,calc(100vw-24px))] panel p-3.5 shadow-panel text-left"
        >
          <header className="flex items-baseline gap-2 mb-3">
            <h2 className="text-[13.5px] font-semibold text-white">Account</h2>
            <span className="ml-auto text-[10.5px] text-muted">{VIEWER.name}</span>
          </header>

          <section className="rounded-xl border border-border bg-black/20 p-3">
            <label htmlFor="start-capital" className="block text-[12.5px] font-semibold text-white">
              Starting capital
            </label>
            <p className="text-[10.5px] text-muted leading-snug mt-0.5">
              What the account holds on the first of each month. The Trade Journal adds every
              day&apos;s net result to it and shows the balance after each session.
            </p>
            <div
              className={`mt-2.5 flex items-center gap-1.5 rounded-lg border bg-black/30 px-2.5 py-1.5 ${
                invalid ? "border-bear/60" : "border-border focus-within:border-accent/60"
              }`}
            >
              <span className="text-[13px] text-muted">₹</span>
              <input
                id="start-capital"
                inputMode="numeric"
                autoComplete="off"
                placeholder="2,00,000"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") save(); }}
                className="flex-1 min-w-0 bg-transparent text-[13px] text-white tabular-nums outline-none
                           placeholder:text-muted/50"
              />
            </div>
            {invalid && <p className="mt-1.5 text-[11px] text-bear">Enter an amount in rupees.</p>}
          </section>

          <div className="mt-3.5 flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={!dirty || invalid}
              className="px-3.5 py-2 rounded-xl bg-accent text-white text-[12.5px] font-semibold
                         hover:brightness-110 disabled:opacity-40 transition"
            >
              {dirty ? "Save" : "Saved"}
            </button>
            {capital !== null && (
              <button
                type="button"
                onClick={() => { saveCapital(null); setOpen(false); }}
                className="ml-auto text-[11.5px] text-accent hover:underline"
                title="Stop showing a balance in the journal"
              >
                Clear
              </button>
            )}
          </div>

          <p className="mt-2.5 text-[10.5px] text-muted/80 leading-relaxed">
            {capital === null
              ? "Not set — the journal shows each day's result only."
              : `Every month is read as starting from ${inr(capital)}.`}{" "}
            Kept in this browser.
          </p>
        </div>
      )}
    </div>
  );
}
