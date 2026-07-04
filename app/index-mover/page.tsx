"use client";
import { useEffect, useState } from "react";
import { fetchData } from "@/lib/api";
import { fmt, signCls, tvLink } from "@/lib/format";
import { Panel, SourceBadge } from "@/components/ui";
import type { IndexMover } from "@/lib/types";

const INDICES = ["NIFTY 50", "NIFTY BANK", "NIFTY IT", "NIFTY AUTO"];

export default function Page() {
  const [index, setIndex] = useState("NIFTY 50");
  const [d, setD] = useState<IndexMover | null>(null);
  const [source, setSource] = useState<string>();

  useEffect(() => {
    setD(null);
    fetchData<IndexMover>(`/api_be/data/order/indice_point_movement?index=${encodeURIComponent(index)}`)
      .then((r) => { setD(r.data); setSource(r.source); });
  }, [index]);

  const pts = d ? (d.points ?? Object.values(d.stocks).reduce((a, s) => a + s.point_to_index, 0)) : 0;
  const up = pts >= 0;
  const total = d ? d.gainers + d.losers || 1 : 1;
  const sorted = d ? [...d.stocks].sort((a, b) => Math.abs(b.point_to_index) - Math.abs(a.point_to_index)) : [];

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <h1 className="text-3xl font-extrabold tracking-tight">Index Mover</h1>
        <SourceBadge source={source} />
      </div>
      <select value={index} onChange={(e) => setIndex(e.target.value)} className="chip mb-5">
        {INDICES.map((i) => <option key={i}>{i}</option>)}
      </select>

      {!d ? <div className="text-muted">Loading…</div> : (
        <>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 mb-4">
            <Panel title="Index Move">
              <div className={`text-4xl font-extrabold ${up ? "text-bull" : "text-bear"}`}>
                {up ? "UP" : "DOWN"} {fmt(Math.abs(pts), 0)} pts {d.pct != null && <span className="text-2xl">({fmt(d.pct)}%)</span>}
              </div>
              <div className="text-xs text-muted mt-1">points contributed by constituents</div>
            </Panel>
            <Panel title="Gainers / Losers">
              <div className="h-3.5 rounded-full bg-bear overflow-hidden flex">
                <div className="h-full bg-bull" style={{ width: `${(d.gainers / total) * 100}%` }} />
              </div>
              <div className="flex justify-between mt-2 text-sm">
                <span className="text-bull">● Gainers: <b>{d.gainers}</b></span>
                <span className="text-bear">Losers: <b>{d.losers}</b> ●</span>
              </div>
            </Panel>
          </div>

          <Panel title="Point contribution by stock">
            <div className="max-h-[460px] overflow-auto">
              <table className="w-full text-[13px]">
                <thead className="sticky top-0 bg-panel">
                  <tr className="text-left text-muted">
                    <th className="px-2 py-1.5 border-b border-border font-semibold">Symbol</th>
                    <th className="px-2 py-1.5 border-b border-border font-semibold">% Change</th>
                    <th className="px-2 py-1.5 border-b border-border font-semibold">Points to Index</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((s) => (
                    <tr key={s.Symbol} className="hover:bg-[#0e1420]">
                      <td className="px-2 py-1.5 border-b border-[#161d28]">
                        <a href={tvLink(s.Symbol)} target="_blank" rel="noreferrer" className="font-semibold hover:text-accent">{s.Symbol}</a>
                      </td>
                      <td className={`px-2 py-1.5 border-b border-[#161d28] ${signCls(s.per_change)}`}>{fmt(s.per_change)}%</td>
                      <td className={`px-2 py-1.5 border-b border-[#161d28] ${signCls(s.point_to_index)}`}>{fmt(s.point_to_index, 3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
