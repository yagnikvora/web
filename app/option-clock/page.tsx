"use client";
import { useEffect, useState } from "react";
import { fetchData } from "@/lib/api";
import { fmt } from "@/lib/format";
import { Panel, SourceBadge } from "@/components/ui";
import type { OptionAnalysis } from "@/lib/types";

const SYMS = ["NIFTY", "BANKNIFTY", "FINNIFTY"];

export default function Page() {
  const [sym, setSym] = useState("NIFTY");
  const [d, setD] = useState<OptionAnalysis | null>(null);
  const [source, setSource] = useState<string>();

  useEffect(() => {
    setD(null);
    fetchData<OptionAnalysis>(`/api_be/index_analysis/option?symbol=${sym}`).then((r) => { setD(r.data); setSource(r.source); });
  }, [sym]);

  const maxOI = d ? Math.max(...d.rows.flatMap((r) => [r.ceOI, r.peOI]), 1) : 1;
  const bulls = d ? d.rows.reduce((a, r) => a + r.peChg, 0) : 0;
  const bears = d ? d.rows.reduce((a, r) => a + r.ceChg, 0) : 0;

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <h1 className="text-3xl font-extrabold tracking-tight">Option Clock</h1>
        <SourceBadge source={source} />
      </div>
      <div className="flex items-center gap-3 mb-5">
        <select value={sym} onChange={(e) => setSym(e.target.value)} className="chip">
          {SYMS.map((s) => <option key={s}>{s}</option>)}
        </select>
        {d && <span className="text-muted text-sm">Spot {fmt(d.spot, 1)} · ATM {d.atm}{d.expiry ? ` · Exp ${d.expiry}` : ""}</span>}
      </div>

      {!d ? <div className="text-muted">Loading…</div> : (
        <div className="grid gap-4 grid-cols-1 xl:grid-cols-2">
          <Panel title="OI Clock" badge="live">
            <div className="flex gap-4 justify-center mb-3 text-xs">
              <span className="text-bear">■ Bears (CE OI)</span><span className="text-bull">■ Bulls (PE OI)</span>
            </div>
            <div className="space-y-0.5">
              {[...d.rows].sort((a, b) => b.strike - a.strike).map((r) => (
                <div key={r.strike} className="grid items-center gap-2" style={{ gridTemplateColumns: "1fr 64px 1fr" }}>
                  <div className="justify-self-end h-4 rounded bg-bear" style={{ width: `${(r.ceOI / maxOI) * 100}%` }} title={`CE OI ${r.ceOI.toLocaleString()}`} />
                  <div className={`text-center text-[11px] ${r.strike === d.atm ? "text-accent font-bold" : "text-muted"}`}>{r.strike}</div>
                  <div className="h-4 rounded bg-bull" style={{ width: `${(r.peOI / maxOI) * 100}%` }} title={`PE OI ${r.peOI.toLocaleString()}`} />
                </div>
              ))}
            </div>
          </Panel>

          <div className="space-y-4">
            <Panel title="PCR (Put/Call Ratio)">
              <div className={`text-4xl font-extrabold ${d.pcr >= 1 ? "text-bull" : "text-bear"}`}>{d.pcr}</div>
              <div className="text-xs text-muted mt-1">{d.pcr >= 1 ? "PCR > 1 → bullish bias (more puts)" : "PCR < 1 → bearish bias (more calls)"}</div>
            </Panel>
            <Panel title="Net Position (ΔOI)">
              <div className="flex gap-5 flex-wrap">
                <div className="chip flex-1 min-w-[150px]"><div className="text-muted text-xs">Bulls Chg (ΣΔPE)</div><div className="text-2xl font-bold text-bull mt-1">{bulls.toLocaleString()}</div></div>
                <div className="chip flex-1 min-w-[150px]"><div className="text-muted text-xs">Bears Chg (ΣΔCE)</div><div className="text-2xl font-bold text-bear mt-1">{bears.toLocaleString()}</div></div>
              </div>
              <p className="text-xs text-muted mt-3">Rising PE OI = support building (bullish); rising CE OI = resistance (bearish).</p>
            </Panel>
            <Panel title="Max Pain">
              <div className="text-2xl font-bold">{d.maxPainStrike}</div>
              <div className="text-xs text-muted mt-1">strike where option writers have least payout</div>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
