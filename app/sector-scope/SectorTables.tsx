"use client";

import { useMemo, useState } from "react";
import { tvLink } from "@/lib/format";
import type { SectorStock } from "@/lib/types";

const CDN = "https://tradefinder.b-cdn.net/assets";

// Stable DOM id per sector so a click on the treemap or a strength bar can jump
// straight to that sector's table.
export const sectorAnchor = (name: string) => `sector-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

// exact palette lifted from tradefinder.in computed styles
const GREEN_BG = "#b9e3a8", GREEN_FG = "#46642e";
const RED_BG = "#fba8a8", RED_FG = "#b3150c";
const UP = "#2ec76a", DOWN = "#e8564f";

function SymbolIcon({ sym }: { sym: string }) {
  const [err, setErr] = useState(false);
  if (err)
    return (
      <span className="w-[25px] h-[25px] rounded-full bg-white/15 shrink-0 inline-flex items-center justify-center text-[11px] font-bold">
        {sym[0]}
      </span>
    );
  return (
    <img
      src={`${CDN}/fno_symbol_curved/${encodeURIComponent(sym)}.webp?w=64&q=100`}
      onError={() => setErr(true)}
      className="w-[25px] h-[25px] rounded-full bg-white shrink-0"
      alt=""
    />
  );
}

const PctChip = ({ v }: { v: number }) => (
  <span
    className="inline-block rounded-[25px] px-[10px] py-[6px] text-[14px] leading-[13px] font-bold min-w-[62px] text-center"
    style={v >= 0 ? { background: GREEN_BG, color: GREEN_FG } : { background: RED_BG, color: RED_FG }}
  >
    {v.toFixed(2)}
  </span>
);

// Arrow tracks LTP against today's open — a stock can be green on the day and still
// print a down arrow because it has faded from where it opened.
const SignalArrow = ({ bull }: { bull: boolean }) => (
  <svg width="18" height="22" viewBox="0 0 18 22" aria-label={bull ? "bullish" : "bearish"}>
    <path
      d={bull ? "M9 1l7 9h-4v11H6V10H2z" : "M9 21l7-9h-4V1H6v11H2z"}
      fill={bull ? UP : DOWN}
    />
  </svg>
);

// Up/down split of the sector, as a proportional bar plus the counts underneath.
function Breadth({ stocks }: { stocks: SectorStock[] }) {
  const up = stocks.filter((s) => s.pChange >= 0).length;
  const down = stocks.length - up;
  const pctUp = stocks.length ? (up / stocks.length) * 100 : 0;
  return (
    <>
      <div className="flex h-[6px] rounded-full overflow-hidden bg-white/10 mx-[6px]">
        <div style={{ width: `${pctUp}%`, background: UP }} />
        <div style={{ width: `${100 - pctUp}%`, background: DOWN }} />
      </div>
      <div className="flex items-center justify-between mt-[10px] mb-[14px] px-[6px] text-[13px] font-semibold">
        <span className="flex items-center gap-2" style={{ color: UP }}>
          <span className="w-[10px] h-[10px] rounded-full" style={{ background: UP }} />
          {up} stocks ({pctUp.toFixed(2)}% Up)
        </span>
        <span className="flex items-center gap-2" style={{ color: DOWN }}>
          <span className="w-[10px] h-[10px] rounded-full" style={{ background: DOWN }} />
          {down} stocks ({(100 - pctUp).toFixed(2)}% Down)
        </span>
      </div>
    </>
  );
}

type SortKey = "Symbol" | "prevClose" | "pChange" | "rFactor";

// The live widget lists at most 20 rows per sector — the 20 highest R.Factors. Sectors
// with more members (NIFTY 50 at 50, FIN SERVICE at 32, SENSEX at 30) are cut here, and
// the cut is exact: every oversized sector in the captured page prints exactly 20 rows.
// The breadth line above the table still counts the WHOLE sector, which is why NIFTY 50
// reads "36 Up / 14 Down" over a 20-row table.
const MAX_ROWS = 20;

function SectorTable({ name, stocks, active }: { name: string; stocks: SectorStock[]; active: boolean }) {
  const [q, setQ] = useState("");
  // R.Factor descending is the default the real widget opens on — heaviest
  // relative volume first, i.e. where the day's activity actually is.
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: "rFactor", dir: -1 });

  // Rank once by R.Factor and cut to the 20 the real page would show; searching and
  // re-sorting then work within that set rather than pulling in rows it never lists.
  const top = useMemo(
    () => [...stocks].sort((a, b) => b.rFactor - a.rFactor).slice(0, MAX_ROWS),
    [stocks],
  );

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return top
      .filter((s) => s.Symbol.toLowerCase().includes(needle))
      .sort((a, b) => {
        const x = a[sort.k], y = b[sort.k];
        const c = typeof x === "string" ? x.localeCompare(y as string) : (x as number) - (y as number);
        return c * sort.dir;
      });
  }, [top, q, sort]);

  const click = (k: SortKey) =>
    setSort((s) => (s.k === k ? { k, dir: s.dir === 1 ? -1 : 1 } : { k, dir: k === "Symbol" ? 1 : -1 }));

  const cols: { k?: SortKey; h: string; w?: string }[] = [
    { k: "Symbol", h: "Symbol" }, { h: "" }, { k: "prevClose", h: "Pre C" },
    { k: "pChange", h: "%" }, { k: "rFactor", h: "R Fact" }, { h: "Signal" },
  ];

  return (
    <section
      id={sectorAnchor(name)}
      // scroll-mt clears the sticky nav when jumped to from a chart click; the ring
      // marks which card that click landed on
      className={`rounded-[14px] border bg-white/[0.02] p-[18px] scroll-mt-[90px] transition-colors duration-300 ${
        active ? "border-[#84b1ff]/70 ring-1 ring-[#84b1ff]/40" : "border-white/10"
      }`}
    >
      <div className="flex items-center justify-between gap-3 mb-[16px]">
        <div className="flex items-center gap-3 min-w-0">
          <h4 className="text-[17px] font-bold tracking-wide whitespace-nowrap">{name}</h4>
          <img src={`${CDN}/images/LIVE.webp?w=96&q=100`} className="w-[46px] h-[23px]" alt="LIVE" />
        </div>
        <div className="flex items-center bg-[#27272a] rounded-[10px] h-[38px] w-[240px] max-w-[52%] px-3 shrink-0">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="shrink-0 text-[#8a8aa0] mr-2">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="..."
            aria-label={`Search ${name}`}
            className="bg-transparent outline-none flex-1 min-w-0 text-[14px] placeholder:text-[#8a8aa0]"
          />
        </div>
      </div>

      <Breadth stocks={stocks} />

      <div className="max-h-[430px] overflow-auto">
        <table className="w-full table-auto border-separate border-spacing-0">
          <thead>
            <tr>
              {cols.map((c, i) => (
                <th
                  key={i}
                  onClick={() => c.k && click(c.k)}
                  className={`sticky top-0 z-10 bg-[#27272a] text-[#a1a1aa] text-[12.5px] font-semibold text-left px-[10px] py-[11px] whitespace-nowrap select-none first:rounded-l-[6px] last:rounded-r-[6px] ${
                    c.k ? "cursor-pointer hover:text-[#d4d4d8]" : ""
                  }`}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.h}
                    {c.k && (
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor"
                        className={`${sort.k === c.k ? "opacity-100" : "opacity-0"} ${sort.k === c.k && sort.dir === 1 ? "rotate-180" : ""}`}>
                        <path d="M2 4l4 4 4-4z" />
                      </svg>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((s) => (
              <tr key={s.Symbol}>
                <td className="px-[10px] py-[11px]">
                  <a target="_blank" rel="noopener noreferrer" href={tvLink(s.Symbol)}
                    className="flex items-center gap-3 text-[14px] font-bold hover:underline">
                    <SymbolIcon sym={s.Symbol} />
                    {s.Symbol}
                  </a>
                </td>
                <td className="px-[10px] py-[11px]">
                  <div className="flex items-center gap-1">
                    <a target="_blank" rel="noopener noreferrer" href={tvLink(s.Symbol)} title="Open Chart">
                      <img src={`${CDN}/images/chart_logo.webp?w=64&q=100`} className="w-[23px] h-[23px]" alt="" />
                    </a>
                    <img src={`${CDN}/images/bookmark.webp?w=64&q=100`} title="Add to Watchlist"
                      className="w-[19px] h-[23px] cursor-pointer" alt="" />
                  </div>
                </td>
                <td className="px-[10px] py-[11px] text-[14px] font-bold tabular-nums">{s.prevClose}</td>
                <td className="px-[10px] py-[11px]"><PctChip v={s.pChange} /></td>
                <td className="px-[10px] py-[11px] text-[14px] font-bold tabular-nums">{s.rFactor.toFixed(2)}</td>
                <td className="px-[10px] py-[11px]"><SignalArrow bull={s.ltp >= s.open} /></td>
              </tr>
            ))}
            {!shown.length && (
              <tr><td colSpan={cols.length} className="px-[10px] py-8 text-center text-[#8a8aa0] text-[14px]">No rows found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function SectorTables({
  sectors, highlight,
}: { sectors: [string, SectorStock[]][]; highlight?: string | null }) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mt-6 items-start">
      {sectors.map(([name, stocks]) =>
        stocks?.length ? (
          <SectorTable key={name} name={name} stocks={stocks} active={highlight === name} />
        ) : null,
      )}
    </div>
  );
}
