"use client";
import { useEffect, useRef, useState } from "react";
import { fetchData } from "@/lib/api";
import { fmt, signCls } from "@/lib/format";
import { PageTitle, Panel } from "@/components/ui";
import { DataTable, Num, TableCard, type Col } from "@/components/table";
import type { FiiDiiRow } from "@/lib/types";

type Mode = "fii" | "dii" | "both";

// Net columns carry the sign colour; gross buy/sell are just magnitudes.
const money = (h: string, get: (r: FiiDiiRow) => number, signed = false): Col<FiiDiiRow> => ({
  h, val: get,
  render: (r) => <Num cls={signed ? signCls(get(r)) : ""}>{fmt(get(r), 1)}</Num>,
});

const cols: Col<FiiDiiRow>[] = [
  { h: "Date", val: (r) => r.date, render: (r) => <Num>{r.date}</Num> },
  money("FII Buy", (r) => r.fiiBuy),
  money("FII Sell", (r) => r.fiiSell),
  money("FII Net", (r) => r.fiiNet, true),
  money("In Market", (r) => r.inMarket),
  money("DII Net", (r) => r.diiNet, true),
  money("DII Buy", (r) => r.diiBuy),
  money("DII Sell", (r) => r.diiSell),
];

export default function Page() {
  const [rows, setRows] = useState<FiiDiiRow[]>([]);
  const [source, setSource] = useState<string>();
  const [mode, setMode] = useState<Mode>("fii");
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    fetchData<FiiDiiRow[]>("/api_be/fii_dii_delivery/fetch_fii_dii_data").then((r) => { setRows(r.data); setSource(r.source); });
  }, []);

  useEffect(() => {
    const c = canvas.current; if (!c || !rows.length) return;
    const ctx = c.getContext("2d")!; c.width = c.clientWidth;
    const W = c.width, H = c.height; ctx.clearRect(0, 0, W, H);
    const data = rows.slice(0, 20).reverse().map((r) => mode === "fii" ? r.fiiNet : mode === "dii" ? r.diiNet : r.fiiNet + r.diiNet);
    const max = Math.max(...data.map(Math.abs), 1), mid = H / 2, gap = W / data.length, bw = gap * 0.6;
    ctx.strokeStyle = "#2a3543"; ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(W, mid); ctx.stroke();
    data.forEach((v, i) => {
      const h = (Math.abs(v) / max) * (H / 2 - 12), x = i * gap + gap * 0.2;
      ctx.fillStyle = v >= 0 ? "#4c8dff" : "#e5484d";
      ctx.fillRect(x, v >= 0 ? mid - h : mid, bw, h);
    });
  }, [rows, mode]);

  return (
    <div>
      <PageTitle source={source}>FII / DII</PageTitle>
      <select value={mode} onChange={(e) => setMode(e.target.value as Mode)} className="chip mb-4">
        <option value="fii">FII Net value</option>
        <option value="dii">DII Net Value</option>
        <option value="both">FII + DII Net Value</option>
      </select>

      <Panel title="Net activity (₹ Cr)" className="mb-4">
        <canvas ref={canvas} height={260} className="w-full" />
      </Panel>

      <TableCard title="Capital Market Activity (in ₹ Cr.)" desc="Daily cash-segment buy, sell and net for foreign and domestic institutions.">
        <DataTable cols={cols} rows={rows} rowKey={(r) => r.date} height={420} />
      </TableCard>
    </div>
  );
}
