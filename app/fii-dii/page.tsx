"use client";
import { useEffect, useRef, useState } from "react";
import { fetchData } from "@/lib/api";
import { fmt, signCls } from "@/lib/format";
import { Panel, SourceBadge } from "@/components/ui";
import type { FiiDiiRow } from "@/lib/types";

type Mode = "fii" | "dii" | "both";

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

  const cell = (v: number, colored = false) =>
    <td className={`px-2 py-1.5 border-b border-[#161d28] ${colored ? signCls(v) : ""}`}>{fmt(v, 1)}</td>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <h1 className="text-3xl font-extrabold tracking-tight">FII / DII</h1>
        <SourceBadge source={source} />
      </div>
      <select value={mode} onChange={(e) => setMode(e.target.value as Mode)} className="chip mb-4">
        <option value="fii">FII Net value</option>
        <option value="dii">DII Net Value</option>
        <option value="both">FII + DII Net Value</option>
      </select>

      <Panel title="Net activity (₹ Cr)" className="mb-4">
        <canvas ref={canvas} height={260} className="w-full" />
      </Panel>

      <Panel title="Capital Market Activity (in ₹ Cr.)">
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-panel">
              <tr className="text-left text-muted">
                {["Date","FII Buy","FII Sell","FII Net","In Market","DII Net","DII Buy","DII Sell"].map((h) =>
                  <th key={h} className="px-2 py-1.5 border-b border-border font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.date} className="hover:bg-[#0e1420]">
                  <td className="px-2 py-1.5 border-b border-[#161d28]">{r.date}</td>
                  {cell(r.fiiBuy)}{cell(r.fiiSell)}{cell(r.fiiNet, true)}{cell(r.inMarket)}{cell(r.diiNet, true)}{cell(r.diiBuy)}{cell(r.diiSell)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
