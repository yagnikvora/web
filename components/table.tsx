"use client";

// The one table in this app.
//
// Market Pulse, Sector Scope, the scanners, Index Mover, FII/DII and Option Clock each used
// to carry their own <table>: three type scales, three header treatments, two rival copies
// of the green/red palette, two hand-rolled sort implementations, and logos on two of the
// six. They are all this now, so a change to row padding, a sort caret or a chip colour
// happens once and lands everywhere.
//
// The look is Market Pulse's, since that is the one measured against the reference design.

import { ReactNode, useMemo, useState } from "react";
import { tvLink } from "@/lib/format";
import { Bookmark, Bulb, ChartLink, LiveBadge, Play, SymbolAvatar, Bullish, Bearish } from "@/components/icons";

/* --------------------------------------------------------------------- palette --- */

// The chips are the one place this app puts dark text on a light ground, so both halves are
// pinned rather than themed — a token that shifted would take the contrast with it.
const GREEN_BG = "#b9e3a8", GREEN_FG = "#46642e";
const RED_BG = "#fba8a8", RED_FG = "#b3150c";

/* ----------------------------------------------------------------------- cells --- */

/** A stock: its logo, its name, and a link out to the chart. */
export const SymbolCell = ({ sym }: { sym: string }) => (
  <a
    target="_blank" rel="noopener noreferrer" href={tvLink(sym)}
    className="flex items-center text-[15px] leading-[13px] font-bold hover:underline"
  >
    <SymbolAvatar symbol={sym} className="w-[25px] h-[25px] text-[10px] mr-3" />
    {sym}
  </a>
);

/** The per-row actions that sit in their own unlabelled column. */
export const RowIcons = ({ sym }: { sym: string }) => (
  <div className="flex items-center">
    <a target="_blank" rel="noopener noreferrer" href={tvLink(sym)} title="Open Chart">
      <ChartLink className="w-[19px] h-[19px] text-muted hover:text-white transition-colors" title="Open chart" />
    </a>
    <Bookmark
      className="w-[17px] h-[19px] ml-2 text-muted hover:text-accent transition-colors cursor-pointer"
      title="Add to Watchlist"
    />
  </div>
);

/** A percentage on a green or red lozenge. Fixed width so a column of them lines up. */
export const PctChip = ({ v }: { v: number }) => (
  <span
    className="inline-block min-w-[62px] text-center rounded-[25px] px-[10px] py-[6px] text-[15px] leading-[13px] font-bold"
    style={v >= 0 ? { background: GREEN_BG, color: GREEN_FG } : { background: RED_BG, color: RED_FG }}
  >
    {v.toFixed(2)}
  </span>
);

/** BULL / BEAR, outlined. */
export const SignalPill = ({ bull }: { bull: boolean }) => (
  <div
    className="w-[58px] text-center rounded-[25px] border-[1.6px] py-[6px] text-[15px] leading-[13px] font-black"
    style={bull
      ? { background: GREEN_BG, borderColor: GREEN_FG, color: GREEN_FG }
      : { background: RED_BG, borderColor: RED_FG, color: RED_FG }}
  >
    {bull ? "BULL" : "BEAR"}
  </div>
);

/** Direction, as an arrow rather than a word. */
export const TrendArrow = ({ bull }: { bull: boolean }) =>
  bull
    ? <Bullish className="w-[22px] h-[22px] text-bull" title="bullish" />
    : <Bearish className="w-[22px] h-[22px] text-bear" title="bearish" />;

/** Any other value. Figures are tabular so digits stack in a column. */
export const Num = ({ children, cls = "" }: { children: ReactNode; cls?: string }) => (
  <span className={`text-[15px] leading-[13px] font-bold tabular-nums ${cls}`}>{children}</span>
);

/* ----------------------------------------------------------------- the shell --- */

/** The pill search box. Its state is the caller's, because it filters the caller's rows. */
function SearchBox({ value, onChange, label }: {
  value: string; onChange: (v: string) => void; label: string;
}) {
  return (
    <div className="flex items-center bg-[#27272a] rounded-[12px] h-10 w-[230px] max-w-[42%] px-3 shrink-0">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent outline-none flex-1 min-w-0 text-[14px] placeholder:text-[#8a8aa0]"
        aria-label={`Search ${label}`}
      />
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 text-[#8a8aa0]">
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
        <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/**
 * The card a table sits in: heading, optional hint/walkthrough/LIVE, and a search box or a
 * readout on the right.
 *
 * Anything between the header and the table — filter dropdowns, a breadth bar — goes in as
 * children alongside the table itself, since which of those a page wants is the one thing
 * that genuinely differs between them.
 */
export function TableCard({ id, title, desc, howTo, live, right, search, className = "", children }: {
  id?: string;
  title: ReactNode;
  /** Tooltip on the bulb. No bulb without it. */
  desc?: string;
  howTo?: boolean;
  live?: boolean;
  /** Sits where the search box would; ignored when `search` is given. */
  right?: ReactNode;
  search?: { value: string; onChange: (v: string) => void };
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={`rounded-[10px] border-[0.8px] border-white/30 shadow-[0_4px_6px_rgba(0,0,0,0.1)] bg-white/[0.02] px-[10px] pb-[10px] ${className}`}
    >
      <div className="flex items-start justify-between gap-3 px-[15px] pt-[12px]">
        <div className="min-w-0">
          <div className="flex items-center">
            <h4 className="text-[20px] font-bold leading-[25px] whitespace-nowrap">{title}</h4>
            {desc && <Bulb className="w-[20px] h-[20px] ml-2 text-amber-300/80 cursor-help" title={desc} />}
          </div>
          {(howTo || live) && (
            <div className="flex items-center mt-1 w-fit">
              {howTo && (
                <button type="button" className="flex items-center cursor-pointer">
                  <span className="text-[16px] font-semibold underline mr-1.5 pb-[2px]">How to use</span>
                  <Play className="w-[17px] h-[17px] text-accent" />
                </button>
              )}
              {live && <LiveBadge className={howTo ? "ml-3" : ""} />}
            </div>
          )}
        </div>
        {search ? <SearchBox value={search.value} onChange={search.onChange} label={String(title)} /> : right}
      </div>
      {children}
    </section>
  );
}

/* ----------------------------------------------------------------- the table --- */

export type Col<T> = {
  h: string;
  /**
   * Sort accessor. A column is sortable exactly when it has one — there is no separate
   * flag to forget to set. Strings sort A→Z on first click, numbers by `defaultDir`.
   */
  val?: (r: T) => number | string;
  render: (r: T) => ReactNode;
};

// Shared with the one table that can't go through DataTable: Option Clock's PCR grid, whose
// pending rows span four columns at once and whose newest row is scrolled to by ref.
export const TH_CLASS =
  "sticky top-0 z-10 bg-[#27272a] text-[#a1a1aa] text-[12.5px] leading-[10px] font-semibold text-left px-[10px] py-[10px] whitespace-nowrap select-none first:rounded-l-[5px] last:rounded-r-[5px]";
export const TD_CLASS = "px-[10px] py-[12px] align-middle";

export function DataTable<T>({
  cols, rows, rowKey, height = 500, defaultDir = -1, initialSort, empty = "No rows found.",
}: {
  cols: Col<T>[];
  rows: T[];
  rowKey?: (r: T, i: number) => string | number;
  /** Cap on the scroll box, in px. Short tables stay short rather than padding to it. */
  height?: number;
  /** Which way a numeric column sorts on its first click. */
  defaultDir?: 1 | -1;
  /** Column index to open sorted on. */
  initialSort?: number;
  empty?: ReactNode;
}) {
  const [sort, setSort] = useState<{ i: number; dir: 1 | -1 } | null>(
    initialSort == null ? null : { i: initialSort, dir: defaultDir },
  );

  const shown = useMemo(() => {
    const val = sort && cols[sort.i]?.val;
    if (!val || !sort) return rows;
    return [...rows].sort((a, b) => {
      const x = val(a), y = val(b);
      const c = typeof x === "string" ? x.localeCompare(y as string) : (x as number) - (y as number);
      return c * sort.dir;
    });
  }, [rows, sort, cols]);

  const click = (i: number) => {
    const val = cols[i].val;
    if (!val) return;
    setSort((s) => {
      if (s && s.i === i) return { i, dir: s.dir === 1 ? -1 : 1 };
      // Names read best A→Z; figures lead with the extreme the column is about.
      const alpha = rows.length > 0 && typeof val(rows[0]) === "string";
      return { i, dir: alpha ? 1 : defaultDir };
    });
  };

  return (
    <div className="overflow-auto px-[15px] pb-[5px]" style={{ maxHeight: height }}>
      <table className="w-full table-auto border-separate border-spacing-0">
        <thead>
          <tr>
            {cols.map((c, i) => (
              <th
                key={i}
                onClick={() => click(i)}
                className={`${TH_CLASS} ${c.val ? "cursor-pointer hover:text-[#d4d4d8]" : ""}`}
              >
                <span className="inline-flex items-center gap-1">
                  {c.h}
                  {c.val && (
                    <svg
                      width="10" height="10" viewBox="0 0 12 12" fill="currentColor"
                      className={`transition-transform ${sort?.i === i ? "opacity-100" : "opacity-30"} ${
                        (sort?.i === i ? sort.dir : defaultDir) === 1 ? "rotate-180" : ""
                      }`}
                    >
                      <path d="M2 4l4 4 4-4z" />
                    </svg>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((r, ri) => (
            <tr key={rowKey ? rowKey(r, ri) : ri} className="hover:bg-white/[0.03]">
              {cols.map((c, ci) => (
                <td key={ci} className={TD_CLASS}>{c.render(r)}</td>
              ))}
            </tr>
          ))}
          {!shown.length && (
            <tr>
              <td colSpan={cols.length} className="px-[10px] py-8 text-center text-[#8a8aa0] text-[14px]">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
