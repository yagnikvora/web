"use client";
import { useEffect, useState } from "react";
import { fetchData } from "@/lib/api";
import { fmt, signCls } from "@/lib/format";
import { PageTitle, Panel } from "@/components/ui";
import {
  DataTable, Num, PctChip, RowIcons, SymbolCell, TableCard, type Col,
} from "@/components/table";
import type { IndexMover, MoverStock } from "@/lib/types";

const INDICES = ["NIFTY 50", "NIFTY BANK", "NIFTY IT", "NIFTY AUTO"];

const cols: Col<MoverStock>[] = [
  { h: "Symbol", val: (s) => s.Symbol, render: (s) => <SymbolCell sym={s.Symbol} /> },
  { h: "", render: (s) => <RowIcons sym={s.Symbol} /> },
  { h: "% Change", val: (s) => s.per_change, render: (s) => <PctChip v={s.per_change} /> },
  {
    h: "Points to Index",
    // Ranked by size of contribution, so first click puts the biggest movers on top
    // whichever way they moved.
    val: (s) => Math.abs(s.point_to_index),
    render: (s) => <Num cls={signCls(s.point_to_index)}>{fmt(s.point_to_index, 3)}</Num>,
  },
];

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

  return (
    <div>
      <PageTitle source={source}>Index Mover</PageTitle>
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

          <TableCard title="Point contribution by stock" live>
            <DataTable cols={cols} rows={d.stocks} rowKey={(s) => s.Symbol} initialSort={3} height={460} />
          </TableCard>
        </>
      )}
    </div>
  );
}
