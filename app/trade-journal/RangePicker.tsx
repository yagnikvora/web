"use client";

// The custom range: a start date and an end date, picked on a calendar.
//
// WHY NOT TWO `<input type="date">`. That is what this replaced, and it had three problems that
// are not cosmetic. The two boxes sat apart in the toolbar — one of them was the shared day
// stepper — so the range was never visible as a range. Neither box knew about the other, so
// "start after end" was a state you could put the page into and only find out about from an
// empty table. And a native picker shows one month at a time with no idea what the other end is,
// which is exactly the thing you are trying to see while choosing a fortnight.
//
// So: one control, two months side by side, the range painted across the days between the ends,
// and a preview that follows the pointer while the second end is being chosen. The ends are
// sorted on commit, so a range that runs backwards cannot be expressed.

import { useEffect, useMemo, useRef, useState } from "react";
import { Caret } from "@/components/icons";
import { useOutsideClose } from "@/lib/useOutsideClose";
import { isoLocal, plural, shiftDay } from "@/lib/journal";

/* ------------------------------------------------------------------------- calendar --- */

const DOW = ["M", "T", "W", "T", "F", "S", "S"];

const monthOf = (iso: string) => iso.slice(0, 7);

function addMonths(key: string, n: number): string {
  const d = new Date(`${key}-01T00:00:00`);
  d.setMonth(d.getMonth() + n);
  return isoLocal(d).slice(0, 7);
}

/** The last day of a month, as a full date. `new Date(y, m, 0)` is the 0th of the next one. */
function endOfMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return isoLocal(new Date(y, m, 0));
}

const monthLabel = (key: string) =>
  new Date(`${key}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

/**
 * A month as 7-wide rows, Monday first, with nulls for the lead-in.
 *
 * Days from the neighbouring months are left blank rather than shown greyed: the panel already
 * shows the next month in full beside this one, so repeating its first week here would put the
 * same date on screen twice with two different meanings.
 */
function monthGrid(key: string): Array<string | null> {
  const first = new Date(`${key}-01T00:00:00`);
  const cells: Array<string | null> = new Array((first.getDay() + 6) % 7).fill(null);
  const day = new Date(first);
  while (day.getMonth() === first.getMonth()) {
    cells.push(isoLocal(day));
    day.setDate(day.getDate() + 1);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/* -------------------------------------------------------------------------- presets --- */

/** The ranges worth a click rather than six. Anchored on today, since that is what "last" means. */
function presetsFor(max: string): Array<{ label: string; from: string; to: string }> {
  const month = monthOf(max);
  const prev = addMonths(month, -1);
  return [
    { label: "Last 7 days", from: shiftDay(max, -6), to: max },
    { label: "Last 30 days", from: shiftDay(max, -29), to: max },
    { label: "Last 90 days", from: shiftDay(max, -89), to: max },
    { label: "This month", from: `${month}-01`, to: max },
    { label: "Last month", from: `${prev}-01`, to: endOfMonth(prev) },
    { label: "Year to date", from: `${max.slice(0, 4)}-01-01`, to: max },
  ];
}

/* ------------------------------------------------------------------------ the label --- */

const asDate = (iso: string) => new Date(`${iso}T00:00:00`);

/** Days in a closed range, both ends counted — a range of one day is one day, not zero. */
export const spanDays = (from: string, to: string) =>
  Math.round((asDate(to).getTime() - asDate(from).getTime()) / 86_400_000) + 1;

/** "1 Aug → 28 Aug 2026". The year is printed once unless the range crosses one. */
function rangeText(from: string, to: string): string {
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  const start = asDate(from).toLocaleDateString(
    "en-IN",
    sameYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" },
  );
  const end = asDate(to).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  return from === to ? end : `${start} → ${end}`;
}

/* ------------------------------------------------------------------------ the picker --- */

export function RangePicker({ from, to, max, open, onOpenChange, onChange }: {
  from: string;
  to: string;
  /** Latest selectable day. Today, in IST — a journal cannot record tomorrow. */
  max: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Always called with the ends in order, so the caller never has to sort them. */
  onChange: (from: string, to: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [left, setLeft] = useState(() => addMonths(monthOf(to), -1));
  /** The first end, once it has been clicked. Null means the next click starts a new range. */
  const [anchor, setAnchor] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  useOutsideClose(open, box, () => onOpenChange(false));

  /*
   * Opening resets the half-made selection and parks the panel on the range that is already
   * chosen — whatever else it does, a picker must never open somewhere the current answer is
   * invisible.
   *
   * Which month that is depends on how many are on screen. With two, a range sitting inside the
   * current month is better shown as [last month, this month]: the selection lands on the right
   * and the month you are most likely to reach back into is already there. With one — a phone —
   * that same choice would open on a month with nothing selected in it, so there the start month
   * is shown and the arrows do the rest.
   */
  useEffect(() => {
    if (!open) return;
    setAnchor(null);
    setHover(null);
    const twoUp = window.matchMedia("(min-width: 640px)").matches;
    const start = monthOf(from);
    setLeft(twoUp && start === monthOf(max) ? addMonths(start, -1) : start);
  }, [open, from, max]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onOpenChange(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const presets = useMemo(() => presetsFor(max), [max]);

  // What to paint. Mid-selection that is the anchor against wherever the pointer is, which is
  // what makes a fortnight visible before it is committed rather than after.
  const [lo, hi] = useMemo(() => {
    if (!anchor) return [from, to];
    const other = hover ?? anchor;
    return anchor <= other ? [anchor, other] : [other, anchor];
  }, [anchor, hover, from, to]);

  const commit = (a: string, b: string) => {
    onChange(a <= b ? a : b, a <= b ? b : a);
    onOpenChange(false);
  };

  const pick = (day: string) => {
    if (!anchor) { setAnchor(day); setHover(day); return; }
    commit(anchor, day);
  };

  const days = spanDays(from, to);

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`h-[32px] inline-flex items-center gap-2 rounded-lg border px-2.5 text-[12.5px]
                    transition-colors ${
          open ? "border-accent/60 bg-accent/[0.08]" : "border-border bg-chip hover:border-white/20"
        }`}
      >
        <CalendarGlyph />
        <span className="tabular-nums text-white whitespace-nowrap">{rangeText(from, to)}</span>
        <span className="text-muted tabular-nums whitespace-nowrap">{plural(days, "day")}</span>
        <Caret className={`w-[12px] h-[12px] text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose a date range"
          className="absolute left-0 mt-2 z-40 w-[min(94vw,700px)] rounded-2xl border border-border bg-panel
                     shadow-[0_30px_80px_-24px_rgba(0,0,0,.9)] p-4"
        >
          <div className="grid sm:grid-cols-[126px_minmax(0,1fr)] gap-4">
            <div className="flex sm:flex-col flex-wrap gap-1">
              {presets.map((p) => {
                const on = p.from === from && p.to === to;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => commit(p.from, p.to)}
                    className={`text-left text-[12px] rounded-lg px-2.5 py-1.5 whitespace-nowrap transition-colors ${
                      on ? "bg-accent/[0.14] text-accent" : "text-muted hover:bg-white/[0.06] hover:text-white"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            <div className="relative">
              <NavButton
                side="left"
                onClick={() => setLeft(addMonths(left, -1))}
                label="previous month"
              />
              <NavButton
                side="right"
                onClick={() => setLeft(addMonths(left, 1))}
                disabled={left >= monthOf(max)}
                label="next month"
              />
              <div className="grid sm:grid-cols-2 gap-5">
                <Month
                  mkey={left} max={max} lo={lo} hi={hi} picking={anchor !== null}
                  onPick={pick} onHover={setHover}
                />
                <div className="hidden sm:block">
                  <Month
                    mkey={addMonths(left, 1)} max={max} lo={lo} hi={hi} picking={anchor !== null}
                    onPick={pick} onHover={setHover}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4 pt-3 border-t border-border">
            <span className="text-[11.5px] text-muted">
              {anchor
                ? <>Start <span className="text-white tabular-nums">{rangeText(anchor, anchor)}</span> — now pick the end.</>
                : <>Showing <span className="text-white tabular-nums">{rangeText(from, to)}</span> · {plural(days, "day")}.</>}
            </span>
            {anchor && (
              <button
                type="button"
                onClick={() => { setAnchor(null); setHover(null); }}
                className="text-[11.5px] text-muted hover:text-white"
              >
                Start over
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="ml-auto text-[11.5px] text-muted hover:text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NavButton({ side, onClick, disabled, label }: {
  side: "left" | "right"; onClick: () => void; disabled?: boolean; label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`absolute top-0 ${side === "left" ? "left-0" : "right-0"} w-7 h-7 grid place-items-center
                  rounded-lg text-muted hover:bg-white/[0.06] hover:text-white disabled:opacity-25
                  disabled:hover:bg-transparent disabled:hover:text-muted transition-colors z-10`}
    >
      {side === "left" ? "‹" : "›"}
    </button>
  );
}

function Month({ mkey, max, lo, hi, picking, onPick, onHover }: {
  mkey: string;
  max: string;
  lo: string;
  hi: string;
  /** True once one end is down — only then does hovering redraw the range. */
  picking: boolean;
  onPick: (day: string) => void;
  onHover: (day: string) => void;
}) {
  const cells = monthGrid(mkey);
  return (
    <div className="min-w-0">
      <div className="text-[12px] font-semibold text-center h-7 leading-7">{monthLabel(mkey)}</div>
      <div className="grid grid-cols-7">
        {DOW.map((d, i) => (
          <div key={i} className="h-6 grid place-items-center text-[9.5px] uppercase text-muted/60">
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={i} className="h-9" />;

          const disabled = day > max;
          const isLo = day === lo;
          const isHi = day === hi;
          const inside = day > lo && day < hi;
          const dow = new Date(`${day}T00:00:00`).getDay();
          const weekend = dow === 0 || dow === 6;

          // The wash sits on the cell rather than the button, so it runs edge to edge and the
          // week reads as one bar instead of seven tinted squares with gaps between them.
          const wash = (inside || ((isLo || isHi) && lo !== hi))
            ? `bg-accent/[0.12] ${isLo ? "rounded-l-lg" : ""} ${isHi ? "rounded-r-lg" : ""}`
            : "";

          return (
            <div key={day} className={`h-9 relative ${wash}`}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onPick(day)}
                onMouseEnter={() => picking && onHover(day)}
                title={day}
                className={`absolute inset-[2px] rounded-lg text-[12px] tabular-nums grid place-items-center
                            transition-colors ${
                  disabled ? "text-muted/25 cursor-not-allowed"
                    : isLo || isHi ? "bg-accent text-white font-semibold"
                      : inside ? "text-white hover:bg-white/[0.08]"
                        // Saturdays and Sundays are dimmed, not blocked: the market is shut, so a
                        // weekend end simply contributes no rows — but a range typed as
                        // "the 1st to the 30th" should not be refused for landing on one.
                        : weekend ? "text-muted/45 hover:bg-white/[0.08]"
                          : "text-white/85 hover:bg-white/[0.08]"
                }`}
              >
                {Number(day.slice(-2))}
                {day === max && !isLo && !isHi && (
                  <span className="absolute bottom-[3px] w-[3px] h-[3px] rounded-full bg-accent" />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Local, because nothing else in the app has needed a calendar mark. */
const CalendarGlyph = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="text-muted shrink-0" aria-hidden>
    <rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="2" />
    <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
