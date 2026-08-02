"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { timeOfDay } from "@/lib/format";
import { useLiveData } from "@/lib/live";
import LiveClock from "@/components/LiveClock";
import { Caret, Icon, type IconName } from "@/components/icons";
import {
  DataTable, Num, PctChip, RowIcons, SignalPill, SymbolCell, TableCard, TrendArrow, type Col,
} from "@/components/table";
import type { MarketPulse, BeaconRow, ParamRow } from "@/lib/types";


/* ---------- generic widget ---------- */

type Filter = { icon: IconName; label: string };

type Dir = "Neutral" | "Bullish" | "Bearish";
const DIR_OPTS: { label: Dir; icon: IconName; tint: string }[] = [
  { label: "Neutral", icon: "neutral", tint: "text-muted" },
  { label: "Bullish", icon: "bullish", tint: "text-bull" },
  { label: "Bearish", icon: "bearish", tint: "text-bear" },
];

// Interactive direction dropdown (Neutral = all, Bullish = %≥0, Bearish = %<0).
function DirDropdown({ value, onChange }: { value: Dir; onChange: (d: Dir) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  const cur = DIR_OPTS.find((o) => o.label === value)!;
  return (
    <div ref={ref} className="relative ml-[15px] mb-[10px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center bg-[#333333] rounded-[10px] p-2 w-fit cursor-pointer"
      >
        <Icon name={cur.icon} className={`w-[22px] h-[22px] ${cur.tint}`} />
        <span className="ml-2 text-[14px] whitespace-nowrap">{cur.label}&nbsp;</span>
        <Caret className={`w-[13px] h-[13px] ml-3 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 min-w-[160px] rounded-[10px] border border-[#555] bg-[#232323] shadow-lg py-1">
          {DIR_OPTS.map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => { onChange(o.label); setOpen(false); }}
              className={`flex items-center w-full text-left px-3 py-2 text-[14px] hover:bg-white/10 ${o.label === value ? "bg-white/[0.06]" : ""}`}
            >
              <Icon name={o.icon} className={`w-[20px] h-[20px] mr-2 ${o.tint}`} />
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Widget<T extends { Symbol: string }>({
  title, desc, filters, cols, rows, defaultDir = -1, initialSortCol, dirOf,
}: {
  title: string; desc: string; filters: Filter[]; cols: Col<T>[]; rows: T[];
  defaultDir?: 1 | -1; initialSortCol?: number; dirOf?: (r: T) => number;
}) {
  const [q, setQ] = useState("");
  const [dir, setDir] = useState<Dir>("Neutral");

  const shown = useMemo(() => {
    let out = rows.filter((r) => r.Symbol.toLowerCase().includes(q.trim().toLowerCase()));
    if (dirOf && dir !== "Neutral") {
      out = out.filter((r) => (dir === "Bullish" ? dirOf(r) >= 0 : dirOf(r) < 0));
    }
    return out;
  }, [rows, q, dir, dirOf]);

  return (
    <TableCard title={title} desc={desc} howTo live search={{ value: q, onChange: setQ }}>
      {/* filter dropdowns */}
      <div className="flex flex-wrap mt-3">
        {/* interactive Bullish/Bearish/Neutral filter (only where a direction accessor exists) */}
        {dirOf && <DirDropdown value={dir} onChange={setDir} />}
        {/* remaining chips (sector "All" etc.) stay as static labels for now */}
        {filters
          .filter((f) => !["Neutral", "Bullish", "Bearish"].includes(f.label))
          .map((f, i) => (
            <div key={i} className="ml-[15px] mb-[10px] flex items-center bg-[#333333] rounded-[10px] p-2 w-fit cursor-pointer">
              <Icon name={f.icon} className="w-[18px] h-[18px] text-muted" />
              <span className="ml-2 text-[14px]">{f.label}&nbsp;</span>
              <Caret className="w-[13px] h-[13px] ml-3 text-muted" />
            </div>
          ))}
      </div>

      <DataTable
        cols={cols}
        rows={shown}
        rowKey={(r, i) => r.Symbol + i}
        defaultDir={defaultDir}
        initialSort={initialSortCol}
      />
    </TableCard>
  );
}

/* ---------- widget configs ---------- */


const sectorAll: Filter = { icon: "sectors", label: "All" };

// Every widget opens with these three, so they are built once rather than restated per config.
const symCols: Col<{ Symbol: string }>[] = [
  { h: "Symbol", val: (r) => r.Symbol, render: (r) => <SymbolCell sym={r.Symbol} /> },
  { h: "", render: (r) => <RowIcons sym={r.Symbol} /> },
];
const pctCol: Col<ParamRow> = { h: "%", val: (r) => r.param_2, render: (r) => <PctChip v={r.param_2} /> };

// breakout_beacon: p0=%chg, p1=signal%, p2=BULL/BEAR, p3=epoch(s)
const bbCols: Col<BeaconRow>[] = [
  { h: "Signal", render: (r) => <SignalPill bull={r.param_2 === "BULL"} /> },
  ...symCols,
  { h: "%", val: (r) => r.param_0, render: (r) => <PctChip v={r.param_0} /> },
  { h: "Signal %", val: (r) => Math.abs(r.param_1), render: (r) => <Num>{r.param_1}</Num> },
  { h: "Time", val: (r) => r.param_3, render: (r) => <Num>{timeOfDay(r.param_3)}</Num> },
];

// intraday_boost / gainers / losers: p0=LTP, p1=prevClose, p2=%chg, p3=R.Factor
const boostCols: Col<ParamRow>[] = [
  ...symCols, pctCol,
  { h: "R.Fac", val: (r) => r.param_3, render: (r) => <Num>{r.param_3.toFixed(2)}</Num> },
  { h: "Signal", render: (r) => <TrendArrow bull={r.param_2 >= 0} /> },
];

const gainerCols: Col<ParamRow>[] = boostCols.slice(0, 4);

// top_level / low_level: p3=diff (distance from day high/low)
const levelCols: Col<ParamRow>[] = [
  ...symCols, pctCol,
  { h: "Diff", val: (r) => r.param_3, render: (r) => <Num>{r.param_3.toFixed(2)}</Num> },
];

// high_powered_stocks: p3=turnover(₹Cr)
const powerCols: Col<ParamRow>[] = [
  ...symCols, pctCol,
  { h: "T.O.", val: (r) => r.param_3, render: (r) => <Num>{r.param_3.toFixed(2)}</Num> },
];

/* ---------- page ---------- */

export default function MarketPulseClient({ data: initial }: { data: MarketPulse }) {
  const { data, updatedAt, open } = useLiveData<MarketPulse>(initial, "/api/market-pulse");
  return (
    <div
      className="min-h-screen"
      style={{ backgroundImage: "radial-gradient(900px 620px at 28% 42%, rgba(20,60,160,0.16), transparent 65%)" }}
    >
      <div className="flex items-center gap-4 pb-[30px]">
        <h2 className="text-[32px] font-extrabold leading-[44px] capitalize">Market Pulse</h2>
        <LiveClock at={updatedAt} open={open} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Widget
          title="BREAKOUT BEACON"
          desc="With BREAKOUT BEACON, unleash massive gains! Spot stocks surging with momentum as big players pile in."
          filters={[{ icon: "neutral", label: "Neutral" }, sectorAll]}
          cols={bbCols}
          rows={data.breakout_beacon}
          initialSortCol={4}
          dirOf={(r) => (r.param_2 === "BULL" ? 1 : -1)}
        />
        <Widget
          title="INTRADAY BOOST"
          desc="Spot the Rising Stars of Today's Market! Highlights stocks with a significant boost in activity vs the past 20 days."
          filters={[
            { icon: "neutral", label: "Neutral" },
            { icon: "sectors", label: "All" },
            sectorAll,
          ]}
          cols={boostCols}
          rows={data.intraday_boost}
          dirOf={(r) => r.param_2}
        />
        <Widget
          title="TOP LEVEL STOCKS"
          desc="Stocks trading near their day's high, signaling a blend of strength and momentum."
          filters={[sectorAll]}
          cols={levelCols}
          rows={data.top_level_stocks}
          defaultDir={1}
        />
        <Widget
          title="LOW LEVEL STOCKS"
          desc="Discover hidden market gems at the bottom! Unique opportunities to capitalize on shifts in momentum."
          filters={[sectorAll]}
          cols={levelCols}
          rows={data.low_level_stocks}
          defaultDir={1}
        />
        <Widget
          title="TOP GAINERS"
          desc="Ride the Wave of Today's Winners! The stocks making the biggest leaps today."
          filters={[sectorAll]}
          cols={gainerCols}
          rows={data.top_gainers}
        />
        <Widget
          title="TOP LOSERS"
          desc="Identify the Market's Biggest Retreats of the Day! Sometimes, today's losers can be tomorrow's winners."
          filters={[sectorAll]}
          cols={gainerCols}
          rows={data.top_losers}
        />
        <Widget
          title="HIGH POW. STOCKS"
          desc="Market's Most Electrifying Stocks! Stocks with the highest turnover in the cash segment."
          filters={[sectorAll]}
          cols={powerCols}
          rows={data.high_powered_stocks}
        />
      </div>
    </div>
  );
}
