// ECharts options for the OI clock widgets.
import { compact, type StrikeRow } from "@/lib/oi";

// Bears are the calls, bulls the puts — the same two colours the live page legends with.
export const BEAR = "#fb8c8c";
export const BULL = "#4ade80";

const AXIS = "#8b98a9";
const GRID = "#1e2733";

const tooltip = {
  backgroundColor: "#0e131c",
  borderColor: "#1e2733",
  textStyle: { color: "#ecedee", fontSize: 12 },
};

/**
 * The clock: one row per strike, bars showing how each leg's open interest CHANGED
 * across the selected window. Calls building above the spot is resistance, puts
 * building below it is support — which is why the two sides get read as bears and bulls.
 *
 * Bars run both ways from zero because OI unwinds as well as builds, and the value
 * labels sit outside whichever end the bar reaches so a negative one stays readable.
 */
export function clockOption(rows: StrikeRow[], atm: number) {
  const label = (v: number) => ({
    show: true,
    position: v >= 0 ? ("right" as const) : ("left" as const),
    color: AXIS,
    fontSize: 10,
    formatter: () => compact(v),
  });
  const bars = (pick: (r: StrikeRow) => number) =>
    rows.map((r) => ({ value: pick(r), label: label(pick(r)) }));

  return {
    animationDuration: 450,
    grid: { left: 8, right: 16, top: 34, bottom: 4, containLabel: true },
    legend: {
      top: 0,
      itemWidth: 24,
      itemHeight: 13,
      itemGap: 20,
      icon: "roundRect",
      textStyle: { color: "#c9d1d9", fontSize: 13 },
      data: ["Bears", "Bulls"],
    },
    tooltip: {
      ...tooltip,
      trigger: "axis",
      axisPointer: { type: "shadow" },
      valueFormatter: (v: number) => Math.round(v).toLocaleString("en-IN"),
    },
    xAxis: {
      type: "value",
      // Headroom at both ends so the value label hanging off a bar's tip stays inside
      // the plot instead of colliding with the strike axis. Proportional rather than a
      // pixel margin, so it holds up whatever the day's numbers are.
      boundaryGap: ["14%", "12%"],
      axisLabel: { color: AXIS, fontSize: 11, formatter: compact },
      splitLine: { lineStyle: { color: GRID } },
    },
    yAxis: {
      type: "category",
      // Ascending data puts the lowest strike at the bottom, as the live ladder reads.
      data: rows.map((r) => String(r.strike)),
      axisLabel: { color: AXIS, fontSize: 11 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        name: "Bears",
        type: "bar",
        data: bars((r) => r.ceChg),
        itemStyle: { color: BEAR, borderRadius: 3 },
        barMaxWidth: 9,
        markLine: {
          silent: true,
          symbol: "none",
          animation: false,
          lineStyle: { type: "dashed", color: "#6b7280", width: 1 },
          label: { formatter: "ATM", color: "#cbd5e1", fontSize: 11, position: "insideStartTop" },
          data: atm ? [{ yAxis: String(atm) }] : [],
        },
      },
      {
        name: "Bulls",
        type: "bar",
        data: bars((r) => r.peChg),
        itemStyle: { color: BULL, borderRadius: 3 },
        barMaxWidth: 9,
      },
    ],
  };
}

/** Net position: the two sides' total OI change over the window, side by side. */
export function netOption(bullsChg: number, bearsChg: number) {
  return {
    animationDuration: 450,
    grid: { left: 6, right: 12, top: 18, bottom: 4, containLabel: true },
    tooltip: { ...tooltip, trigger: "axis", axisPointer: { type: "shadow" },
      valueFormatter: (v: number) => Math.round(v).toLocaleString("en-IN") },
    xAxis: {
      type: "category",
      data: ["Bulls Chg", "Bears Chg"],
      axisLabel: { color: AXIS, fontSize: 12 },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: GRID } },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: AXIS, fontSize: 11, formatter: compact },
      splitLine: { lineStyle: { color: GRID } },
    },
    series: [{
      type: "bar",
      barMaxWidth: 90,
      data: [
        { value: bullsChg, itemStyle: { color: BULL, borderRadius: [3, 3, 0, 0] } },
        { value: bearsChg, itemStyle: { color: BEAR, borderRadius: [3, 3, 0, 0] } },
      ],
    }],
  };
}

/** Distribution: total open interest sitting on each side right now. */
export function distributionOption(bulls: number, bears: number) {
  const series = (name: string, value: number, color: string) => ({
    name, type: "bar" as const, barMaxWidth: 46,
    data: [value], itemStyle: { color, borderRadius: [3, 3, 0, 0] },
  });
  return {
    animationDuration: 450,
    grid: { left: 6, right: 12, top: 34, bottom: 4, containLabel: true },
    legend: {
      top: 0, itemWidth: 22, itemHeight: 12, itemGap: 16, icon: "roundRect",
      textStyle: { color: "#c9d1d9", fontSize: 12 },
    },
    tooltip: { ...tooltip, trigger: "axis", axisPointer: { type: "shadow" },
      valueFormatter: (v: number) => Math.round(v).toLocaleString("en-IN") },
    xAxis: { type: "category", data: [""], axisTick: { show: false }, axisLine: { lineStyle: { color: GRID } } },
    yAxis: {
      type: "value",
      axisLabel: { color: AXIS, fontSize: 11, formatter: compact },
      splitLine: { lineStyle: { color: GRID } },
    },
    series: [series("Bulls Total OI", bulls, BULL), series("Bears Total OI", bears, BEAR)],
  };
}
