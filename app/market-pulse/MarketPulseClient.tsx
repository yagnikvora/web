"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { tvLink } from "@/lib/format";
import { useLiveData } from "@/lib/live";
import LiveClock from "@/components/LiveClock";
import {
  Bulb, Play, Bookmark, ChartLink, Caret, Bullish, Bearish, Icon, LiveBadge, SymbolAvatar,
  type IconName,
} from "@/components/icons";
import type { MarketPulse, BeaconRow, ParamRow } from "@/lib/types";


// Palette measured from the reference design.
const GREEN_BG = "#b9e3a8", GREEN_FG = "#46642e";
const RED_BG = "#fba8a8", RED_FG = "#b3150c";

const fmtTime = (epoch: number) =>
  new Date(epoch * 1000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

/* ---------- cell renderers ---------- */

const SymbolIcon = ({ sym }: { sym: string }) =>
  <SymbolAvatar symbol={sym} className="w-[25px] h-[25px] text-[10px] mr-3" />;

const SymbolCell = ({ sym }: { sym: string }) => (
  <a target="_blank" rel="noopener noreferrer" href={tvLink(sym)} className="flex items-center text-[15px] leading-[13px] font-bold hover:underline">
    <SymbolIcon sym={sym} />
    {sym}
  </a>
);

const IconsCell = ({ sym }: { sym: string }) => (
  <div className="flex items-center">
    <a target="_blank" rel="noopener noreferrer" href={tvLink(sym)} title="Open Chart">
      <ChartLink className="w-[19px] h-[19px] text-muted hover:text-white transition-colors" title="Open chart" />
    </a>
    <Bookmark className="w-[17px] h-[19px] ml-2 text-muted hover:text-accent transition-colors cursor-pointer" title="Add to Watchlist" />
  </div>
);

const PctChip = ({ v }: { v: number }) => (
  <span
    className="inline-block rounded-[25px] px-[10px] py-[6px] text-[15px] leading-[13px] font-bold"
    style={v >= 0 ? { background: GREEN_BG, color: GREEN_FG } : { background: RED_BG, color: RED_FG }}
  >
    {v.toFixed(2)}
  </span>
);

const BullBearPill = ({ bull }: { bull: boolean }) => (
  <div
    className="w-[58px] text-center rounded-[25px] border-[1.6px] py-[6px] text-[15px] leading-[13px] font-black"
    style={bull ? { background: GREEN_BG, borderColor: GREEN_FG, color: GREEN_FG } : { background: RED_BG, borderColor: RED_FG, color: RED_FG }}
  >
    {bull ? "BULL" : "BEAR"}
  </div>
);

const ArrowCell = ({ bull }: { bull: boolean }) =>
  bull
    ? <Bullish className="w-[22px] h-[22px] text-bull" title="bullish" />
    : <Bearish className="w-[22px] h-[22px] text-bear" title="bearish" />;

const Num = ({ children }: { children: ReactNode }) => (
  <span className="text-[15px] leading-[13px] font-bold">{children}</span>
);

/* ---------- generic widget ---------- */

type Col<T> = {
  h: string;
  sortable?: boolean;
  val?: (r: T) => number; // sort accessor
  render: (r: T) => ReactNode;
};

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
  const [sort, setSort] = useState<{ i: number; dir: 1 | -1 } | null>(
    initialSortCol != null ? { i: initialSortCol, dir: defaultDir } : null
  );

  const shown = useMemo(() => {
    let out = rows.filter((r) => r.Symbol.toLowerCase().includes(q.trim().toLowerCase()));
    if (dirOf && dir !== "Neutral") {
      out = out.filter((r) => (dir === "Bullish" ? dirOf(r) >= 0 : dirOf(r) < 0));
    }
    if (sort) {
      const { val } = cols[sort.i];
      if (val) out = [...out].sort((a, b) => (val(a) - val(b)) * sort.dir);
    }
    return out;
  }, [rows, q, dir, dirOf, sort, cols]);

  const clickSort = (i: number) => {
    if (!cols[i].sortable) return;
    setSort((s) => (s && s.i === i ? { i, dir: s.dir === 1 ? -1 : 1 } : { i, dir: defaultDir }));
  };

  return (
    <section className="rounded-[10px] border-[0.8px] border-white/30 shadow-[0_4px_6px_rgba(0,0,0,0.1)] bg-white/[0.02] px-[10px] pb-[10px]">
      {/* header */}
      <div className="flex items-start justify-between gap-3 px-[15px] pt-[12px]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center">
              <h4 className="text-[20px] font-bold leading-[25px] whitespace-nowrap">{title}</h4>
              <Bulb className="w-[20px] h-[20px] ml-2 text-amber-300/80 cursor-help" title={desc} />
            </div>
            <div className="flex items-center mt-1 cursor-pointer w-fit">
              <span className="text-[16px] font-semibold underline mr-1.5 pb-[2px]">How to use</span>
              <Play className="w-[17px] h-[17px] text-accent" />
              <LiveBadge className="ml-3" />
            </div>
          </div>
        </div>
        <div className="flex items-center bg-[#27272a] rounded-[12px] h-10 w-[230px] max-w-[42%] px-3 shrink-0">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="bg-transparent outline-none flex-1 min-w-0 text-[14px] placeholder:text-[#8a8aa0]"
            aria-label={`Search ${title}`}
          />
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 text-[#8a8aa0]">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      </div>

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

      {/* table */}
      <div className="h-[500px] overflow-auto px-[15px] pb-[5px]">
        <table className="w-full table-auto border-separate border-spacing-0">
          <thead>
            <tr>
              {cols.map((c, i) => (
                <th
                  key={i}
                  onClick={() => clickSort(i)}
                  className={`sticky top-0 z-10 bg-[#27272a] text-[#a1a1aa] text-[12.5px] leading-[10px] font-semibold text-left px-[10px] py-[10px] whitespace-nowrap select-none first:rounded-l-[5px] last:rounded-r-[5px] ${c.sortable ? "cursor-pointer hover:text-[#d4d4d8]" : ""}`}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.h}
                    {c.sortable && (
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor"
                        className={(sort?.i === i ? sort.dir : defaultDir) === 1 ? "rotate-180" : ""}>
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
              <tr key={r.Symbol + ri}>
                {cols.map((c, ci) => (
                  <td key={ci} className="px-[10px] py-[12px] align-middle">{c.render(r)}</td>
                ))}
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td colSpan={cols.length} className="px-[10px] py-8 text-center text-[#8a8aa0] text-[14px]">No rows found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ---------- widget configs ---------- */


const sectorAll: Filter = { icon: "sectors", label: "All" };

// breakout_beacon: p0=%chg, p1=signal%, p2=BULL/BEAR, p3=epoch(s)
const bbCols: Col<BeaconRow>[] = [
  { h: "Signal", render: (r) => <BullBearPill bull={r.param_2 === "BULL"} /> },
  { h: "Symbol", render: (r) => <SymbolCell sym={r.Symbol} /> },
  { h: "", render: (r) => <IconsCell sym={r.Symbol} /> },
  { h: "%", sortable: true, val: (r) => r.param_0, render: (r) => <PctChip v={r.param_0} /> },
  { h: "Signal %", sortable: true, val: (r) => Math.abs(r.param_1), render: (r) => <Num>{r.param_1}</Num> },
  { h: "Time", render: (r) => <Num>{fmtTime(r.param_3)}</Num> },
];

// intraday_boost / gainers / losers: p0=LTP, p1=prevClose, p2=%chg, p3=R.Factor
const boostCols: Col<ParamRow>[] = [
  { h: "Symbol", render: (r) => <SymbolCell sym={r.Symbol} /> },
  { h: "", render: (r) => <IconsCell sym={r.Symbol} /> },
  { h: "%", sortable: true, val: (r) => r.param_2, render: (r) => <PctChip v={r.param_2} /> },
  { h: "R.Fac", sortable: true, val: (r) => r.param_3, render: (r) => <Num>{r.param_3.toFixed(2)}</Num> },
  { h: "Signal", render: (r) => <ArrowCell bull={r.param_2 >= 0} /> },
];

const gainerCols: Col<ParamRow>[] = [
  { h: "Symbol", render: (r) => <SymbolCell sym={r.Symbol} /> },
  { h: "", render: (r) => <IconsCell sym={r.Symbol} /> },
  { h: "%", sortable: true, val: (r) => r.param_2, render: (r) => <PctChip v={r.param_2} /> },
  { h: "R.Fac", sortable: true, val: (r) => r.param_3, render: (r) => <Num>{r.param_3.toFixed(2)}</Num> },
];

// top_level / low_level: p3=diff (distance from day high/low)
const levelCols: Col<ParamRow>[] = [
  { h: "Symbol", render: (r) => <SymbolCell sym={r.Symbol} /> },
  { h: "", render: (r) => <IconsCell sym={r.Symbol} /> },
  { h: "%", sortable: true, val: (r) => r.param_2, render: (r) => <PctChip v={r.param_2} /> },
  { h: "Diff", sortable: true, val: (r) => r.param_3, render: (r) => <Num>{r.param_3.toFixed(2)}</Num> },
];

// high_powered_stocks: p3=turnover(₹Cr)
const powerCols: Col<ParamRow>[] = [
  { h: "Symbol", render: (r) => <SymbolCell sym={r.Symbol} /> },
  { h: "", render: (r) => <IconsCell sym={r.Symbol} /> },
  { h: "%", sortable: true, val: (r) => r.param_2, render: (r) => <PctChip v={r.param_2} /> },
  { h: "T.O.", sortable: true, val: (r) => r.param_3, render: (r) => <Num>{r.param_3.toFixed(2)}</Num> },
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
