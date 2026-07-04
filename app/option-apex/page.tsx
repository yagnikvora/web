"use client";
import { useEffect, useState } from "react";
import { fetchData } from "@/lib/api";
import { fmt, heatColor } from "@/lib/format";
import { Panel, SourceBadge } from "@/components/ui";
import Gauge from "@/components/Gauge";
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

  // sentiment from PCR: PCR 0.5→-1 (bearish), 1.0→0, 1.5→+1 (bullish)
  const sentiment = d ? Math.max(-1, Math.min(1, (d.pcr - 1) * 2)) : 0;
  const pcrGauge = d ? Math.max(-1, Math.min(1, (d.pcr - 1) * 1.5)) : 0;
  // money flux: per-strike net OI change magnitude as a proxy treemap
  const flux = d ? d.rows.map((r) => ({ label: String(r.strike), v: (r.peChg - r.ceChg) })) : [];
  const maxFlux = Math.max(...flux.map((f) => Math.abs(f.v)), 1);

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <h1 className="text-3xl font-extrabold tracking-tight">Option Apex</h1>
        <SourceBadge source={source} />
      </div>
      <div className="flex items-center gap-3 mb-5">
        <select value={sym} onChange={(e) => setSym(e.target.value)} className="chip">
          {SYMS.map((s) => <option key={s}>{s}</option>)}
        </select>
        {d && <span className="text-muted text-sm">Spot {fmt(d.spot, 1)} · ATM {d.atm} · PCR {d.pcr}</span>}
      </div>

      {!d ? <div className="text-muted">Loading…</div> : (
        <div className="grid gap-4 grid-cols-1 xl:grid-cols-2">
          <Panel title="Sentiment & PCR Dials" badge="live">
            <div className="grid grid-cols-2 gap-4 pt-2">
              <Gauge label="Sentimental Dial" value={sentiment} />
              <Gauge label="PCR" value={pcrGauge} />
            </div>
          </Panel>

          <Panel title="Money Flux (net ΔOI by strike)" badge="live">
            <div className="flex flex-wrap gap-1">
              {flux.map((f) => (
                <div key={f.label} className="rounded-md px-2 py-2 text-[11px] font-semibold text-white text-center"
                  style={{ background: heatColor((f.v / maxFlux) * 3), flexGrow: Math.max(1, Math.abs(f.v) / maxFlux * 6) }}>
                  {f.label}<br /><span className="opacity-90">{f.v >= 0 ? "+" : ""}{(f.v / 1000).toFixed(1)}k</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted mt-3">Green = net PE writing (support), red = net CE writing (resistance).</p>
          </Panel>
        </div>
      )}
    </div>
  );
}
