"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import EChart from "@/components/EChart";
import { Bulb as BulbIcon, Play, LiveBadge } from "@/components/icons";
import LiveClock from "@/components/LiveClock";
import { isMarketOpen, REFRESH_MS } from "@/lib/live";
import {
  atmOf, bounds, dayLabel, expLabel, expParam, groupIN, istDay, istTime, ladder, sessionGrid, totals,
} from "@/lib/oi";
import { clockOption, distributionOption, netOption, BEAR, BULL } from "./charts";
import { PCR_STEP, type ClockLoad } from "@/lib/optionclock";
import type { PcrPoint, RunningExpiry } from "@/lib/types";


const SCRIPTS: { script: string; label: string }[] = [
  { script: "NIFTY 50", label: "Nifty50" },
  { script: "NIFTY BANK", label: "BankNifty" },
  { script: "FINNIFTY", label: "FinNifty" },
  { script: "MIDCPNIFTY", label: "MidCpNifty" },
];

/* ---------- small pieces ---------- */

const Bulb = ({ title }: { title: string }) => (
  <BulbIcon className="w-[19px] h-[19px] ml-2 text-amber-300/80 cursor-help" title={title} />
);

// The pill dropdowns in the page header: a quiet label, the value in bold, a caret.
function Dropdown<T>({ label, value, options, render, onPick }: {
  label: string; value: T; options: T[]; render: (o: T) => ReactNode; onPick: (o: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 bg-[#1b1f27] border border-white/10 rounded-[10px] px-4 h-[46px] min-w-[180px] justify-between"
      >
        <span className="text-[15px] text-[#c9d1d9]">
          {label}&nbsp;<span className="font-bold text-white">{render(value)}</span>
        </span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" className={`shrink-0 text-[#8b98a9] transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M2 4l4 4 4-4z" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 min-w-full rounded-[10px] border border-[#2a3140] bg-[#161b22] shadow-lg py-1">
          {options.map((o, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { onPick(o); setOpen(false); }}
              className={`block w-full text-left px-4 py-2 text-[14px] whitespace-nowrap hover:bg-white/10 ${o === value ? "bg-white/[0.06]" : ""}`}
            >
              {render(o)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const Card = ({ title, hint, right, children, className = "" }: {
  title: string; hint: string; right?: ReactNode; children: ReactNode; className?: string;
}) => (
  <section className={className}>
    <header className="flex items-center pb-3 mb-3 border-b border-white/10">
      <h2 className="text-[22px] font-bold">{title}</h2>
      <Bulb title={hint} />
      {right}
    </header>
    {children}
  </section>
);

/* ---------- PCR trend ---------- */

interface PcrRow { ts: number; pcr: number | null; bulls: number; bears: number; chg: number | null }

const arrow = (v: number | null) =>
  v == null ? <span className="text-muted">—</span>
    : v > 0 ? <span className="text-bull">▲ +{v.toFixed(2)}</span>
    : v < 0 ? <span className="text-bear">▼ {v.toFixed(2)}</span>
    : <span className="text-muted">◆ 0.00</span>;

/**
 * PCR at every ten-minute mark of the session, 09:15 through 15:30.
 *
 * The whole grid is always laid out, so the shape of the day is visible at a glance and
 * rows don't jump around as readings arrive — a slot the recorder hasn't reached yet
 * shows as pending rather than being left out.
 *
 * Puts divided by calls: above 1 the board carries more downside protection than upside,
 * and it's the direction of travel that reads as sentiment shifting, which is why each
 * row carries its change from the previous reading and not just a level.
 */
function PcrTrend({ rows, step }: { rows: PcrRow[]; step: number }) {
  const live = rows.filter((r) => r.pcr != null);
  const latest = live[live.length - 1];
  const first = live[0];
  const move = latest && first ? +(latest.pcr! - first.pcr!).toFixed(2) : 0;

  // Keep the newest reading in view as the session fills past the visible rows.
  const scroller = useRef<HTMLDivElement>(null);
  const lastRow = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    const box = scroller.current, row = lastRow.current;
    if (box && row) box.scrollTop = Math.max(0, row.offsetTop - box.clientHeight / 2);
  }, [latest?.ts]);

  return (
    <section className="panel px-5 py-4 mb-4">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3">
        <h2 className="text-[22px] font-bold">PCR Trend</h2>
        <Bulb title="Put-call ratio through the session. Rising = puts building faster than calls (bullish); falling = the reverse." />
        <span className="text-[13px] text-muted">every {step / 60} min · 09:15–15:30</span>
        {latest && (
          <span className="ml-auto flex items-center gap-2 text-[14px]">
            <span className="text-muted">{istTime(latest.ts)}</span>
            <span className={`text-[18px] font-bold ${latest.pcr! >= 1 ? "text-bull" : "text-bear"}`}>{latest.pcr!.toFixed(2)}</span>
            <span className="text-muted">since {istTime(first.ts)}</span>
            {arrow(move)}
          </span>
        )}
      </header>

      <div ref={scroller} className="max-h-[420px] overflow-auto">
        <table className="w-full text-[14px] border-separate border-spacing-0">
          <thead>
            <tr className="text-left text-muted text-[12.5px]">
              {["Time", "PCR", "Change", "Bulls OI (PE)", "Bears OI (CE)"].map((h) => (
                <th key={h} className="sticky top-0 z-10 bg-panel px-3 py-2 font-semibold border-b border-border">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ts} ref={r.ts === latest?.ts ? lastRow : undefined} className={r.pcr == null ? "opacity-45" : undefined}>
                <td className="px-3 py-2 border-b border-[#161d28] font-semibold">{istTime(r.ts)}</td>
                {r.pcr == null ? (
                  <td colSpan={4} className="px-3 py-2 border-b border-[#161d28] text-muted text-[13px]">not recorded yet</td>
                ) : (
                  <>
                    <td className={`px-3 py-2 border-b border-[#161d28] font-bold ${r.pcr >= 1 ? "text-bull" : "text-bear"}`}>{r.pcr.toFixed(2)}</td>
                    <td className="px-3 py-2 border-b border-[#161d28]">{arrow(r.chg)}</td>
                    <td className="px-3 py-2 border-b border-[#161d28] text-[#c9d1d9]">{groupIN(r.bulls)}</td>
                    <td className="px-3 py-2 border-b border-[#161d28] text-[#c9d1d9]">{groupIN(r.bears)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ---------- page ---------- */

interface Sel { script: string; exp: number; day: string }

export default function OptionClockClient({ initial, script }: { initial: ClockLoad; script: string }) {
  const [data, setData] = useState<ClockLoad>(initial);
  const [sel, setSel] = useState<Sel>({ script, exp: initial.expiries[0]?.[0] ?? 0, day: initial.day });
  const [updatedAt, setUpdatedAt] = useState(Date.now());
  const [open, setOpen] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const first = useRef(true);

  useEffect(() => { setOpen(isMarketOpen()); }, []);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const q = new URLSearchParams({ script: sel.script, exp: sel.exp ? expParam(sel.exp) : "", day: sel.day });
        const res = await fetch(`/api/option-clock?${q}`, { cache: "no-store" });
        const j = await res.json();
        if (!alive) return;
        if (!res.ok) { setErr(j?.error || "Option data unavailable"); return; }
        setData(j); setErr(null); setUpdatedAt(Date.now());
      } catch (e) {
        if (alive) setErr(String((e as Error).message));
      }
    };

    // The server render already answered the opening selection — don't refetch it.
    if (first.current) first.current = false;
    else load();

    // A closed day never changes, and outside trading hours today's OI is fixed too —
    // either way there is nothing to poll for.
    if (sel.day !== istDay() || !isMarketOpen()) return () => { alive = false; };
    const id = setInterval(load, REFRESH_MS);
    return () => { alive = false; clearInterval(id); };
  }, [sel]);

  /* ---- derive what the three widgets draw ---- */

  const win = bounds(data.window);
  const to = data.window[String(win[win.length - 1])];
  const liveSnap = data.live[String(bounds(data.live).pop() ?? "")];

  // One snapshot means the window closed on a single recording; the ladder then shows
  // OI with no change rather than crediting the whole day's build to that instant.
  const rows = useMemo(() => {
    const ts = bounds(data.window);
    const last = data.window[String(ts[ts.length - 1])];
    return ladder(last, ts.length > 1 ? data.window[String(ts[0])] : undefined);
  }, [data.window]);

  const liveRows = useMemo(() => {
    const ts = bounds(data.live);
    return ladder(data.live[String(ts[ts.length - 1])]);
  }, [data.live]);

  const now = totals(liveRows);
  const chg = totals(rows);
  const atm = atmOf(to) || atmOf(liveSnap);

  // Memoised so a re-render for an unrelated reason (the slider moving, a dropdown
  // opening) doesn't push a fresh option object into the charts and replay the animation.
  const clock = useMemo(() => clockOption(rows, atm), [rows, atm]);
  const net = useMemo(() => netOption(chg.bullsChg, chg.bearsChg), [chg.bullsChg, chg.bearsChg]);
  const dist = useMemo(() => distributionOption(now.bulls, now.bears), [now.bulls, now.bears]);

  const expiry: RunningExpiry | undefined = data.expiries.find(([e]) => e === sel.exp) ?? data.expiries[0];

  // The full session laid over whatever has been recorded, so every ten-minute mark has
  // a row. Change compares against the previous slot that actually has a reading, so a
  // gap in the tape doesn't turn into a fake jump on the row after it.
  const pcrRows = useMemo<PcrRow[]>(() => {
    const byTs = new Map<number, PcrPoint>((data.pcr ?? []).map((p) => [p[0], p]));
    let prev: number | null = null;
    return sessionGrid(PCR_STEP, data.day).map((ts) => {
      const p = byTs.get(ts);
      if (!p) return { ts, pcr: null, bulls: 0, bears: 0, chg: null };
      const row: PcrRow = { ts, pcr: p[1], bulls: p[2], bears: p[3], chg: prev == null ? null : +(p[1] - prev).toFixed(2) };
      prev = p[1];
      return row;
    });
  }, [data.pcr, data.day]);

  return (
    <div className="min-h-screen">
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <h1 className="text-[32px] font-extrabold leading-[44px]">Option Clock</h1>
        <LiveBadge />
        <LiveClock at={updatedAt} open={open} />
        <div className="ml-auto flex items-center gap-3">
          <Dropdown
            label="Day:"
            value={sel.day}
            options={data.days}
            render={(d) => dayLabel(d)}
            onPick={(d) => setSel((p) => ({ ...p, day: d }))}
          />
          <Dropdown
            label="Index:"
            value={sel.script}
            options={SCRIPTS.map((s) => s.script)}
            render={(s) => SCRIPTS.find((x) => x.script === s)?.label ?? s}
            // A different index has its own expiries; take the nearest one until the
            // refetch says otherwise.
            onPick={(s) => setSel((p) => ({ ...p, script: s, exp: 0 }))}
          />
          <Dropdown
            label="Exp:"
            value={expiry?.[0] ?? 0}
            options={data.expiries.map(([e]) => e)}
            render={(e) => {
              const l = expLabel(e);
              return <>{l.date} <span className="text-[12px] font-semibold">({l.away})</span></>;
            }}
            onPick={(e) => setSel((p) => ({ ...p, exp: e }))}
          />
        </div>
      </div>

      <PcrTrend rows={pcrRows} step={PCR_STEP} />

      {err && (
        <div className="panel px-4 py-3 mb-4 text-[13px] text-amber-300 border-amber-700/40">
          {err} — showing the last data that loaded.
        </div>
      )}

      <div className="panel p-5 grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card
          title="OI Clock"
          hint="How open interest moved across the selected window. Calls building above spot is resistance; puts building below it is support."
          className="xl:col-span-2 xl:border-r xl:border-white/10 xl:pr-6"
          right={
            <a href="#" onClick={(e) => e.preventDefault()} className="flex items-center ml-4 group">
              <span className="text-[15px] font-semibold underline mr-1.5">How to use</span>
              <Play className="w-[16px] h-[16px] text-accent" />
            </a>
          }
        >
          {rows.length ? (
            <EChart option={clock} height={620} />
          ) : (
            <div className="h-[620px] grid place-items-center text-muted text-sm">No OI recorded for this window yet.</div>
          )}
          <p className="text-[12px] text-muted mt-1">
            {win.length > 1
              ? `Change between ${istTime(win[0])} and ${istTime(win[win.length - 1])} IST${atm ? ` · ATM ${groupIN(atm)}` : ""}`
              : "Only one snapshot recorded in this window — widen it to see a change."}
          </p>
        </Card>

        <div className="flex flex-col gap-6">
          <Card title="Net Position" hint="Total OI added or unwound on each side over the window.">
            <EChart option={net} height={240} />
          </Card>

          <Card title="Distribution" hint="How the open interest currently on the board splits between the two sides.">
            <EChart option={dist} height={210} />
            <div className="flex justify-center gap-4 mt-2">
              {[
                { label: "Total Bulls OI", value: now.bulls, color: BULL },
                { label: "Total Bears OI", value: now.bears, color: BEAR },
              ].map((t) => (
                <div key={t.label} className="text-center">
                  <div className="text-[15px] font-bold" style={{ color: t.color }}>{t.label}</div>
                  <div className="mt-1.5 px-4 py-2 rounded-full bg-[#1b1f27] border border-white/10 text-[15px] font-semibold">
                    {groupIN(t.value)}
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center mt-3 text-[15px]">
              <span className="text-accent font-semibold">PCR :-</span>{" "}
              <span className={now.pcr >= 1 ? "text-bull font-bold" : "text-bear font-bold"}>{now.pcr.toFixed(2)}</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
