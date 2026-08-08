"use client";

import { useMemo, useState } from "react";
import {
  DataTable, Num, PctChip, RowIcons, SymbolCell, TableCard, TrendArrow, type Col,
} from "@/components/table";
import type { SectorStock } from "@/lib/types";


// Stable DOM id per sector so a click on the treemap or a strength bar can jump
// straight to that sector's table.
export const sectorAnchor = (name: string) => `sector-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

const UP = "#2ec76a", DOWN = "#e8564f";

// Up/down split of the sector, as a proportional bar plus the counts underneath.
function Breadth({ stocks }: { stocks: SectorStock[] }) {
  const up = stocks.filter((s) => s.pChange >= 0).length;
  const down = stocks.length - up;
  const pctUp = stocks.length ? (up / stocks.length) * 100 : 0;
  return (
    <>
      <div className="flex h-[6px] rounded-full overflow-hidden bg-white/10">
        <div style={{ width: `${pctUp}%`, background: UP }} />
        <div style={{ width: `${100 - pctUp}%`, background: DOWN }} />
      </div>
      <div className="flex items-center justify-between gap-2 mt-[10px] mb-[14px] text-[11.5px] sm:text-[13px] font-semibold">
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

// The live widget lists at most 20 rows per sector — the 20 highest R.Factors. Sectors
// with more members (NIFTY 50 at 50, FIN SERVICE at 32, SENSEX at 30) are cut here, and
// the cut is exact: every oversized sector in the captured page prints exactly 20 rows.
// The breadth line above the table still counts the WHOLE sector, which is why NIFTY 50
// reads "36 Up / 14 Down" over a 20-row table.
const MAX_ROWS = 20;

const cols: Col<SectorStock>[] = [
  { h: "Symbol", val: (s) => s.Symbol, render: (s) => <SymbolCell sym={s.Symbol} /> },
  { h: "", render: (s) => <RowIcons sym={s.Symbol} /> },
  { h: "Pre C", val: (s) => s.prevClose, render: (s) => <Num>{s.prevClose}</Num> },
  { h: "%", val: (s) => s.pChange, render: (s) => <PctChip v={s.pChange} /> },
  { h: "R Fact", val: (s) => s.rFactor, render: (s) => <Num>{s.rFactor.toFixed(2)}</Num> },
  // Tracks LTP against today's open — a stock can be green on the day and still print a
  // down arrow because it has faded from where it opened.
  { h: "Signal", render: (s) => <TrendArrow bull={s.ltp >= s.open} /> },
];

function SectorTable({ name, stocks, active }: { name: string; stocks: SectorStock[]; active: boolean }) {
  const [q, setQ] = useState("");

  // Rank once by R.Factor and cut to the 20 the real page would show; searching and
  // re-sorting then work within that set rather than pulling in rows it never lists.
  const top = useMemo(
    () => [...stocks].sort((a, b) => b.rFactor - a.rFactor).slice(0, MAX_ROWS),
    [stocks],
  );

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return top.filter((s) => s.Symbol.toLowerCase().includes(needle));
  }, [top, q]);

  return (
    <TableCard
      id={sectorAnchor(name)}
      title={name}
      live
      search={{ value: q, onChange: setQ }}
      // scroll-mt clears the sticky nav when jumped to from a chart click; the ring
      // marks which card that click landed on
      className={`scroll-mt-[90px] transition-colors duration-300 ${
        active ? "!border-[#84b1ff]/70 ring-1 ring-[#84b1ff]/40" : ""
      }`}
    >
      <div className="px-[10px] sm:px-[15px] pt-[14px]">
        <Breadth stocks={stocks} />
      </div>
      {/* R.Factor descending is what the real widget opens on — heaviest relative volume
          first, i.e. where the day's activity actually is. */}
      <DataTable cols={cols} rows={shown} rowKey={(s) => s.Symbol} initialSort={4} height={430} />
    </TableCard>
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
