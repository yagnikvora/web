// The journal's three charts.
//
// One palette, one grid, one tooltip skin across all of them, so the panel reads as one
// instrument rather than three widgets that happened to land next to each other. The colours
// are the app's tokens as literals — ECharts paints to a canvas and never sees a CSS variable.

import { inr } from "@/lib/journal";
import type { DayPoint, EquityPoint } from "./analytics";

const BULL = "#2ec76a";
const BEAR = "#e5484d";
const ACCENT = "#4c8dff";
const MUTED = "#8b98a9";
const GRID = "rgba(255,255,255,0.05)";

/** The dark tooltip every chart on this page uses. */
const TOOLTIP = {
  backgroundColor: "#0e131c",
  borderColor: "#243044",
  borderWidth: 1,
  padding: [8, 10] as [number, number],
  textStyle: { color: "#ecedee", fontSize: 12 },
  extraCssText: "border-radius:10px;box-shadow:0 10px 30px -12px rgba(0,0,0,.8)",
};

const AXIS_LABEL = { color: MUTED, fontSize: 10 };

/** A vertical fade under a line, from the line's own colour down to nothing. */
const fade = (color: string, top = 0.28) => ({
  type: "linear", x: 0, y: 0, x2: 0, y2: 1,
  colorStops: [
    { offset: 0, color: `${color}${Math.round(top * 255).toString(16).padStart(2, "0")}` },
    { offset: 1, color: `${color}00` },
  ],
});

/* -------------------------------------------------------------------- the equity curve --- */

/**
 * Cumulative net, trade by trade.
 *
 * Drawn against trade number rather than against the calendar on purpose: a curve plotted on
 * dates puts a flat week between two trades and reads as a drawdown that never happened. The
 * day is still in the tooltip, which is where it is actually wanted.
 *
 * `bare` strips the axes for the hero, where the shape is the whole message and a gridline
 * would only be furniture.
 */
export function equityOption(points: EquityPoint[], bare = false) {
  const up = (points.at(-1)?.cum ?? 0) >= 0;
  const color = up ? BULL : BEAR;

  return {
    animationDuration: 420,
    grid: bare
      ? { left: 2, right: 2, top: 6, bottom: 2 }
      : { left: 8, right: 14, top: 16, bottom: 4, containLabel: true },
    tooltip: {
      ...TOOLTIP,
      trigger: "axis",
      axisPointer: { type: "line", lineStyle: { color: "rgba(255,255,255,0.18)" } },
      formatter: (ps: unknown) => {
        const p = (Array.isArray(ps) ? ps[0] : ps) as { dataIndex: number };
        const pt = points[p.dataIndex];
        if (!pt) return "";
        return (
          `<div style="font-weight:700">${pt.symbol}</div>`
          + `<div style="color:${MUTED};font-size:11px;margin:2px 0 5px">${pt.day} · trade ${pt.n}</div>`
          + `<div>this trade <b style="color:${pt.net >= 0 ? BULL : BEAR}">${inr(pt.net, true)}</b></div>`
          + `<div>running <b style="color:${pt.cum >= 0 ? BULL : BEAR}">${inr(pt.cum, true)}</b></div>`
        );
      },
    },
    xAxis: {
      type: "category",
      data: points.map((p) => String(p.n)),
      boundaryGap: false,
      show: !bare,
      axisLine: { lineStyle: { color: GRID } },
      axisTick: { show: false },
      axisLabel: { ...AXIS_LABEL, showMaxLabel: true },
    },
    yAxis: {
      type: "value",
      scale: true,
      show: !bare,
      splitLine: { lineStyle: { color: GRID } },
      axisLabel: { ...AXIS_LABEL, formatter: (v: number) => inr(v) },
    },
    series: [
      {
        type: "line",
        data: points.map((p) => p.cum),
        showSymbol: false,
        symbol: "circle",
        symbolSize: 6,
        lineStyle: { width: 2, color },
        itemStyle: { color },
        areaStyle: { color: fade(color) },
        // Breakeven, so a curve that is under water looks under water.
        markLine: {
          silent: true,
          symbol: "none",
          data: [{ yAxis: 0 }],
          lineStyle: { color: "rgba(255,255,255,0.16)", type: "dashed", width: 1 },
          label: { show: false },
        },
      },
    ],
  };
}

/* ------------------------------------------------------------------------ day by day --- */

/** A green/red bar per session with the running total laid over it. */
export function dailyOption(daily: DayPoint[]) {
  const cumUp = (daily.at(-1)?.cum ?? 0) >= 0;
  return {
    animationDuration: 420,
    grid: { left: 8, right: 8, top: 26, bottom: 4, containLabel: true },
    legend: {
      show: true,
      right: 0,
      top: 0,
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: MUTED, fontSize: 10 },
      data: ["Day", "Running"],
    },
    tooltip: {
      ...TOOLTIP,
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (ps: unknown) => {
        const arr = (Array.isArray(ps) ? ps : [ps]) as Array<{ dataIndex: number }>;
        const d = daily[arr[0]?.dataIndex ?? -1];
        if (!d) return "";
        return (
          `<div style="font-weight:700">${d.day}</div>`
          + `<div style="color:${MUTED};font-size:11px;margin:2px 0 5px">`
          + `${d.trades} trade${d.trades === 1 ? "" : "s"} · ${d.wins}W / ${d.losses}L</div>`
          + `<div>day <b style="color:${d.net >= 0 ? BULL : BEAR}">${inr(d.net, true)}</b></div>`
          + `<div>running <b style="color:${d.cum >= 0 ? BULL : BEAR}">${inr(d.cum, true)}</b></div>`
        );
      },
    },
    xAxis: {
      type: "category",
      // Just the date part — the year is the same on every bar and repeating it eight times
      // costs a third of the axis.
      data: daily.map((d) => d.day.slice(5)),
      axisLine: { lineStyle: { color: GRID } },
      axisTick: { show: false },
      axisLabel: { ...AXIS_LABEL, hideOverlap: true },
    },
    /*
     * ONE AXIS, SHARED. The running total used to sit on its own hidden scale, which meant the
     * line's height could not be read against the rupee labels at all — a curve visibly peaking
     * near ₹28,000 was actually at ₹57,363, and only the tooltip said so. Both series are rupees
     * on the same account, so they belong on the same ruler even though it costs the bars some
     * height: a chart you have to hover to believe is worse than a chart with shorter bars.
     */
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: GRID } },
      axisLabel: { ...AXIS_LABEL, formatter: (v: number) => inr(v) },
    },
    series: [
      {
        name: "Day",
        type: "bar",
        data: daily.map((d) => ({
          value: d.net,
          itemStyle: {
            color: d.net >= 0 ? fade(BULL, 1) : fade(BEAR, 1),
            borderRadius: d.net >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4],
          },
        })),
        barMaxWidth: 26,
      },
      {
        name: "Running",
        type: "line",
        data: daily.map((d) => d.cum),
        showSymbol: false,
        smooth: true,
        lineStyle: { width: 2, color: cumUp ? ACCENT : BEAR, type: "solid" },
        itemStyle: { color: cumUp ? ACCENT : BEAR },
      },
    ],
  };
}

/* --------------------------------------------------------------------- trade by trade --- */

/** One bar per position, in the order they were taken. What a single day is actually made of. */
export function tradeOption(points: EquityPoint[]) {
  return {
    animationDuration: 420,
    grid: { left: 8, right: 8, top: 16, bottom: 4, containLabel: true },
    tooltip: {
      ...TOOLTIP,
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (ps: unknown) => {
        const arr = (Array.isArray(ps) ? ps : [ps]) as Array<{ dataIndex: number }>;
        const p = points[arr[0]?.dataIndex ?? -1];
        if (!p) return "";
        return (
          `<div style="font-weight:700">${p.symbol}</div>`
          + `<div style="color:${MUTED};font-size:11px;margin:2px 0 5px">${p.day}</div>`
          + `<div><b style="color:${p.net >= 0 ? BULL : BEAR}">${inr(p.net, true)}</b></div>`
        );
      },
    },
    xAxis: {
      type: "category",
      data: points.map((p) => p.symbol),
      axisLine: { lineStyle: { color: GRID } },
      axisTick: { show: false },
      axisLabel: { ...AXIS_LABEL, rotate: points.length > 8 ? 40 : 0, hideOverlap: true },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: GRID } },
      axisLabel: { ...AXIS_LABEL, formatter: (v: number) => inr(v) },
    },
    series: [
      {
        type: "bar",
        data: points.map((p) => ({
          value: p.net,
          itemStyle: {
            color: p.net >= 0 ? fade(BULL, 1) : fade(BEAR, 1),
            borderRadius: p.net >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4],
          },
        })),
        barMaxWidth: 30,
      },
    ],
  };
}

/* ---------------------------------------------------------------------- the shadow lab --- */

/**
 * Every exit rule side by side, the one in use included.
 *
 * Horizontal, because the labels are names like "trail25@+40" and a vertical bar chart would
 * either rotate them to 45 degrees or wrap them into two lines.
 */
export function shadowOption(rules: Array<{ name: string; netPnl: number; active: boolean }>) {
  const rows = [...rules].sort((a, b) => a.netPnl - b.netPnl);
  return {
    animationDuration: 420,
    grid: { left: 8, right: 76, top: 4, bottom: 4, containLabel: true },
    tooltip: {
      ...TOOLTIP,
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (ps: unknown) => {
        const arr = (Array.isArray(ps) ? ps : [ps]) as Array<{ dataIndex: number }>;
        const r = rows[arr[0]?.dataIndex ?? -1];
        if (!r) return "";
        return `<div style="font-weight:700">${r.name}${r.active ? " · in use" : ""}</div>`
          + `<div><b style="color:${r.netPnl >= 0 ? BULL : BEAR}">${inr(r.netPnl, true)}</b></div>`;
      },
    },
    xAxis: { type: "value", show: false },
    yAxis: {
      type: "category",
      data: rows.map((r) => r.name),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        fontSize: 11,
        // The rule actually in use is named in white and drawn in the accent colour, so the
        // chart says which bar is the status quo without needing a legend.
        color: (name: string) => (rows.find((r) => r.name === name)?.active ? "#ecedee" : MUTED),
      },
    },
    series: [
      {
        type: "bar",
        data: rows.map((r) => ({
          value: r.netPnl,
          itemStyle: {
            color: r.active ? ACCENT : r.netPnl >= 0 ? `${BULL}99` : `${BEAR}99`,
            borderRadius: 4,
          },
        })),
        barMaxWidth: 18,
        label: {
          show: true,
          position: "right",
          distance: 6,
          fontSize: 11,
          color: MUTED,
          formatter: (p: { value: number; dataIndex: number }) =>
            `${inr(p.value, true)}${rows[p.dataIndex]?.active ? "  · in use" : ""}`,
        },
      },
    ],
  };
}

/* ---------------------------------------------------------------------- the arm sweep --- */

/**
 * Net against the level the stop arms at, with the no-checkpoint result as a flat reference.
 *
 * THIS CHART IS THE POINT OF THE LAB. A single rule graded once is a number, and a number is
 * exactly what fooled this project before: one arming level measured on one sample looked like
 * an edge and was a spike. Drawn as a curve, a fitted peak and a genuine plateau are told apart
 * at a glance — and where the curve sits relative to the dashed line is whether the checkpoint
 * is worth having at all.
 */
export function sweepOption(
  points: Array<{ arm: number; net: number }>,
  flatNet: number,
  chosenArm: number,
) {
  const best = points.reduce((a, b) => (b.net > a.net ? b : a), points[0]);
  return {
    animationDuration: 420,
    grid: { left: 8, right: 14, top: 22, bottom: 4, containLabel: true },
    tooltip: {
      ...TOOLTIP,
      trigger: "axis",
      axisPointer: { type: "line", lineStyle: { color: "rgba(255,255,255,0.18)" } },
      formatter: (ps: unknown) => {
        const arr = (Array.isArray(ps) ? ps : [ps]) as Array<{ dataIndex: number }>;
        const p = points[arr[0]?.dataIndex ?? -1];
        if (!p) return "";
        const delta = p.net - flatNet;
        return (
          `<div style="font-weight:700">arm at +${Math.round(100 * p.arm)}%</div>`
          + `<div>net <b style="color:${p.net >= 0 ? BULL : BEAR}">${inr(p.net, true)}</b></div>`
          + `<div style="color:${MUTED};font-size:11px;margin-top:3px">`
          + `<b style="color:${delta >= 0 ? BULL : BEAR}">${inr(delta, true)}</b> vs no checkpoint</div>`
        );
      },
    },
    xAxis: {
      type: "category",
      data: points.map((p) => `+${Math.round(100 * p.arm)}%`),
      boundaryGap: false,
      axisLine: { lineStyle: { color: GRID } },
      axisTick: { show: false },
      axisLabel: { ...AXIS_LABEL, hideOverlap: true },
    },
    yAxis: {
      type: "value",
      scale: true,
      splitLine: { lineStyle: { color: GRID } },
      axisLabel: { ...AXIS_LABEL, formatter: (v: number) => inr(v) },
    },
    series: [
      {
        type: "line",
        data: points.map((p) => p.net),
        smooth: false,
        showSymbol: true,
        symbolSize: (_v: unknown, p: { dataIndex: number }) =>
          points[p.dataIndex]?.arm === chosenArm ? 11 : 4,
        itemStyle: {
          color: (p: { dataIndex: number }) =>
            points[p.dataIndex]?.arm === chosenArm ? "#ecedee" : ACCENT,
        },
        lineStyle: { width: 2, color: ACCENT },
        areaStyle: { color: fade(ACCENT, 0.2) },
        markLine: {
          silent: true,
          symbol: "none",
          data: [{ yAxis: flatNet }],
          lineStyle: { color: MUTED, type: "dashed", width: 1 },
          label: {
            show: true,
            position: "insideEndTop",
            color: MUTED,
            fontSize: 10,
            formatter: `no checkpoint · ${inr(flatNet, true)}`,
          },
        },
        markPoint: {
          silent: true,
          symbol: "pin",
          symbolSize: 0,
          data: [{
            coord: [`+${Math.round(100 * best.arm)}%`, best.net],
            label: {
              show: true,
              position: "top",
              distance: 8,
              color: BULL,
              fontSize: 10,
              formatter: `best +${Math.round(100 * best.arm)}%`,
            },
          }],
        },
      },
    ],
  };
}
