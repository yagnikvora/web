// ECharts options for Option Apex.
//
// One chart, two stacked panes on a shared time axis — the index candles above, the money
// flux histogram below — which is how the real page draws it and how any charting package
// draws price over volume. Stacked rather than side by side because the whole point of
// the histogram is reading a flux bar against the candle it happened under.

import { istTime } from "@/lib/oi";
import type { Candle, FluxPoint } from "@/lib/types";

export const BULL = "#2ec76a";
export const BEAR = "#e5484d";
const AXIS = "#8b98a9";
const GRID = "#161e2a";

/** ₹ in the units a trading desk reads: 3159622928 -> "₹315.96 Cr". */
export function rupees(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (a >= 1e7) return `${sign}₹${(a / 1e7).toFixed(2)} Cr`;
  if (a >= 1e5) return `${sign}₹${(a / 1e5).toFixed(2)} L`;
  if (a >= 1e3) return `${sign}₹${(a / 1e3).toFixed(1)} k`;
  return `${sign}₹${Math.round(a)}`;
}

const tooltip = {
  backgroundColor: "#0e131c",
  borderColor: "#1e2733",
  textStyle: { color: "#ecedee", fontSize: 12 },
};

/**
 * The main chart: candles over money flux.
 *
 * Flux bars are keyed to the candle bucket they fall in rather than plotted on their own
 * axis, so a bar always sits under the price action that produced it. A bucket the feed had
 * no candles for is absent rather than zero — a zero bar reads as "no money moved", which
 * is a different claim from "there was nothing to read".
 */
export function apexChartOption(candles: Candle[], flux: FluxPoint[], chartType: ChartType) {
  const times = candles.map((c) => istTime(c[0]));
  const at = new Map(candles.map((c, i) => [c[0], i]));

  // Land each flux bucket on the candle whose window contains it.
  const bars: (number | null)[] = candles.map(() => null);
  for (const [ts, , v] of flux) {
    let idx = at.get(ts);
    if (idx == null) {
      // Bucket and candle grids can differ (flux is capped at the option-candle
      // resolution). Attach to the last candle at or before the bucket.
      for (let i = 0; i < candles.length; i++) if (candles[i][0] <= ts) idx = i; else break;
    }
    if (idx != null) bars[idx] = (bars[idx] ?? 0) + v;
  }

  const priceSeries =
    chartType === "line" || chartType === "area"
      ? {
          type: "line" as const,
          name: "Price",
          data: candles.map((c) => c[4]),
          showSymbol: false,
          lineStyle: { width: 2, color: "#4c8dff" },
          ...(chartType === "area"
            ? {
                areaStyle: {
                  color: {
                    type: "linear" as const, x: 0, y: 0, x2: 0, y2: 1,
                    colorStops: [
                      { offset: 0, color: "rgba(76,141,255,.35)" },
                      { offset: 1, color: "rgba(76,141,255,0)" },
                    ],
                  },
                },
              }
            : {}),
        }
      : {
          type: "candlestick" as const,
          name: "Price",
          // ECharts takes [open, close, low, high]; the feed is [o, h, l, c].
          data: candles.map((c) => [c[1], c[4], c[3], c[2]]),
          itemStyle:
            chartType === "hollow"
              ? { color: "transparent", color0: "transparent", borderColor: BULL, borderColor0: BEAR, borderWidth: 1.4 }
              : { color: BULL, color0: BEAR, borderColor: BULL, borderColor0: BEAR },
        };

  return {
    animation: false,
    backgroundColor: "transparent",
    // Two panes: price on top, flux underneath, sharing one category axis.
    // Left padding is for the first x-axis label, which is centred on its tick and would
    // otherwise hang off the edge of the canvas and be clipped mid-digit.
    grid: [
      { left: 24, right: 66, top: 16, height: "62%", containLabel: true },
      { left: 24, right: 66, top: "74%", bottom: 28, containLabel: true },
    ],
    axisPointer: { link: [{ xAxisIndex: "all" }], label: { backgroundColor: "#1e2733" } },
    tooltip: {
      ...tooltip,
      trigger: "axis",
      axisPointer: { type: "cross" },
      formatter: (ps: Array<{ axisValue: string; seriesName: string; data: unknown; dataIndex: number }>) => {
        if (!ps.length) return "";
        const i = ps[0].dataIndex;
        const c = candles[i];
        if (!c) return "";
        const f = bars[i];
        const dir = c[4] >= c[1] ? BULL : BEAR;
        return [
          `<b>${ps[0].axisValue}</b>`,
          `O ${c[1].toFixed(2)} &nbsp; H ${c[2].toFixed(2)}`,
          `L ${c[3].toFixed(2)} &nbsp; <span style="color:${dir}">C ${c[4].toFixed(2)}</span>`,
          f == null
            ? `<span style="color:${AXIS}">Money Flux — no candles</span>`
            : `Money Flux <span style="color:${f >= 0 ? BULL : BEAR}">${rupees(f)}</span>`,
        ].join("<br/>");
      },
    },
    xAxis: [
      {
        type: "category", data: times, gridIndex: 0,
        boundaryGap: true,
        axisLine: { lineStyle: { color: GRID } },
        axisLabel: { show: false },
        axisTick: { show: false },
        splitLine: { show: true, lineStyle: { color: GRID } },
      },
      {
        type: "category", data: times, gridIndex: 1,
        boundaryGap: true,
        axisLine: { lineStyle: { color: GRID } },
        axisTick: { show: false },
        axisLabel: {
          color: AXIS, fontSize: 11,
          // One label roughly every half hour, whatever the timeframe.
          interval: Math.max(0, Math.round(times.length / 9) - 1),
        },
        splitLine: { show: false },
      },
    ],
    yAxis: [
      {
        scale: true, gridIndex: 0, position: "right",
        axisLabel: { color: AXIS, fontSize: 11, formatter: (v: number) => v.toFixed(0) },
        axisLine: { show: false },
        splitLine: { lineStyle: { color: GRID } },
      },
      {
        scale: true, gridIndex: 1, position: "right",
        // Few labels: this pane is a third the height of the price one, and ECharts'
        // default split count crams them into an unreadable stack when the flux series
        // is short. Zero is always drawn so the sign of a bar is never ambiguous.
        splitNumber: 2,
        axisLabel: { color: AXIS, fontSize: 10, formatter: (v: number) => (v === 0 ? "0" : rupees(v).replace("₹", "")) },
        axisLine: { show: false },
        splitLine: { lineStyle: { color: GRID } },
      },
    ],
    dataZoom: [
      { type: "inside", xAxisIndex: [0, 1], start: 0, end: 100, zoomOnMouseWheel: true },
    ],
    series: [
      { ...priceSeries, xAxisIndex: 0, yAxisIndex: 0 },
      {
        name: "Money Flux",
        type: "bar",
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: bars.map((v) => (v == null ? null : { value: v, itemStyle: { color: v >= 0 ? BULL : BEAR } })),
        barMaxWidth: 14,
      },
    ],
  };
}

export const CHART_TYPES = ["candle", "hollow", "line", "area"] as const;
export type ChartType = (typeof CHART_TYPES)[number];
export const CHART_TYPE_LABEL: Record<ChartType, string> = {
  candle: "Candles", hollow: "Hollow", line: "Line", area: "Area",
};

/**
 * Index Mover: each constituent's contribution to the index's move, in points.
 *
 * A ranked bar rather than the real page's radial spray — the same numbers, read off a
 * common baseline, which is the whole reason the ranking is worth showing.
 */
export function moverOption(rows: Array<{ Symbol: string; point_to_index: number }>) {
  const sorted = [...rows].sort((a, b) => b.point_to_index - a.point_to_index);
  const top = [...sorted.slice(0, 8), ...sorted.slice(-4)]
    // A short constituent list can overlap the two slices; keep one row per symbol.
    .filter((r, i, a) => a.findIndex((x) => x.Symbol === r.Symbol) === i)
    .sort((a, b) => a.point_to_index - b.point_to_index);

  return {
    animationDuration: 400,
    grid: { left: 8, right: 56, top: 8, bottom: 8, containLabel: true },
    tooltip: { ...tooltip, trigger: "axis", axisPointer: { type: "shadow" },
      valueFormatter: (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)} pts` },
    xAxis: {
      type: "value", boundaryGap: ["12%", "12%"],
      axisLabel: { color: AXIS, fontSize: 11 },
      splitLine: { lineStyle: { color: GRID } },
    },
    yAxis: {
      type: "category",
      data: top.map((r) => r.Symbol),
      axisLabel: { color: "#c9d1d9", fontSize: 11 },
      axisLine: { lineStyle: { color: GRID } },
      axisTick: { show: false },
    },
    series: [{
      type: "bar",
      data: top.map((r) => ({
        value: +r.point_to_index.toFixed(2),
        itemStyle: { color: r.point_to_index >= 0 ? BULL : BEAR, borderRadius: 3 },
        label: {
          show: true, position: r.point_to_index >= 0 ? ("right" as const) : ("left" as const),
          color: AXIS, fontSize: 10,
          formatter: () => `${r.point_to_index >= 0 ? "+" : ""}${r.point_to_index.toFixed(2)}`,
        },
      })),
      barMaxWidth: 16,
    }],
  };
}
