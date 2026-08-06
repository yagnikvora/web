// The pullback chart.
//
// Everything the brief asks to be drawn, on two panes sharing one time axis: candles with the four
// EMAs and VWAP above, volume below. On top of that the things that make it a PULLBACK chart rather
// than a price chart — the EMA zone as a shaded band, the entry and exit arrows, the stop and target
// lines, and the impulse leg the retracement belongs to.
//
// THE ZONE IS DRAWN AS A BAND, NOT AS THREE LINES, and that is the whole visual argument of the
// module. The 9 EMA, the 20 EMA and VWAP are three references a few tenths of an ATR apart, and the
// entry is "price came back into that region and turned" — not "price touched one specific average
// to the paisa". Drawing it as a band is what makes the setup legible at a glance and what stops a
// reader measuring a four-paisa miss as a failed signal.
//
// TWO ECHARTS MECHANICS ARE WORTH KNOWING BEFORE EDITING THIS.
//
//   The band is a `custom` series rather than a stacked area. A stacked area needs both edges to be
//   defined at every index, and both edges here are null until the 20 EMA warms — a stack over a
//   null baseline silently anchors to zero and paints the band from the x-axis to the EMA.
//
//   The axis is a CATEGORY axis of formatted times, not a time axis. NSE has a lunchless 375-minute
//   session and overnight gaps; a real time axis would draw fourteen hours of empty space between
//   15:30 and 09:15 and squeeze the session into a sliver.

import type { Bar, PullbackSignal, TimeframeRead } from "@/lib/pullback";
import { istClock } from "@/lib/format";

export const BULL = "#2ec76a";
export const BEAR = "#e5484d";
const AXIS = "#8b98a9";
const GRID = "#161e2a";
const ZONE = "rgba(76,141,255,0.13)";
const ZONE_EDGE = "rgba(76,141,255,0.35)";

const EMA_STYLE = {
  9: { color: "#f0b429", width: 1.6, name: "9 EMA" },
  20: { color: "#4c8dff", width: 1.6, name: "20 EMA" },
  50: { color: "#a78bfa", width: 1.3, name: "50 EMA" },
  200: { color: "#94a3b8", width: 1.3, name: "200 EMA" },
} as const;

const tooltip = {
  backgroundColor: "#0e131c",
  borderColor: "#1e2733",
  textStyle: { color: "#ecedee", fontSize: 12 },
};

const istTime = istClock;

const istDay = (ms: number): string =>
  new Date(ms).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short" });

/**
 * A simple EMA over the closes, recomputed here for the chart.
 *
 * The API sends the raw bars and the LAST value of each average, not the whole series — sending four
 * series per timeframe would multiply the detail payload for data the browser can derive in a
 * millisecond. The seeding matches `api/src/pullback/indicators/ema.ts` exactly (SMA of the first
 * `period`, then the recursion, null before that), because a chart whose 200 EMA is seeded
 * differently from the scanner's would disagree with the signal drawn on it.
 */
function ema(bars: Bar[], period: number): Array<number | null> {
  const out = new Array<number | null>(bars.length).fill(null);
  if (bars.length < period) return out;
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += bars[i].close;
  let v = sum / period;
  out[period - 1] = v;
  for (let i = period; i < bars.length; i++) {
    v = bars[i].close * k + v * (1 - k);
    out[i] = v;
  }
  return out;
}

/** Session-anchored VWAP, reset at every day boundary — the same rule the backend applies. */
function vwap(bars: Bar[]): Array<number | null> {
  const out = new Array<number | null>(bars.length).fill(null);
  let day = "";
  let vol = 0;
  let turn = 0;
  for (let i = 0; i < bars.length; i++) {
    if (bars[i].day !== day) { day = bars[i].day; vol = 0; turn = 0; }
    vol += bars[i].volume;
    turn += bars[i].turnover;
    out[i] = vol > 0 ? turn / vol : null;
  }
  return out;
}

export interface ChartInput {
  bars: Bar[];
  read: TimeframeRead | undefined;
  /** The signal or watch candidate whose plan is drawn. Null draws price only. */
  signal: PullbackSignal | null;
  timeframe: number;
}

export function pullbackChartOption(i: ChartInput) {
  const { bars, signal } = i;
  const labels = bars.map((b, k) =>
    // A day label on the first bar of each session, a clock label everywhere else — so a
    // multi-session chart shows where the days break without repeating the date 300 times.
    k > 0 && bars[k - 1].day !== b.day ? `${istDay(b.at)} ${istTime(b.at)}` : istTime(b.at),
  );

  const e9 = ema(bars, 9);
  const e20 = ema(bars, 20);
  const e50 = ema(bars, 50);
  const e200 = ema(bars, 200);
  const vw = vwap(bars);

  // The zone at every bar: the span of whichever of {9 EMA, 20 EMA, VWAP} are warm, widened by the
  // ATR tolerance the backend used. Null where fewer than two are warm — the backend refuses to
  // call a single line a zone, and so does this.
  const tolerance = 0.2 * (i.read?.atr ?? 0);
  const band = bars.map((_, k) => {
    const vals = [e9[k], e20[k], vw[k]].filter((v): v is number => v !== null);
    if (vals.length < 2) return null;
    return [Math.min(...vals) - tolerance, Math.max(...vals) + tolerance] as [number, number];
  });

  const line = (data: Array<number | null>, style: { color: string; width: number; name: string }) => ({
    type: "line" as const,
    name: style.name,
    data,
    showSymbol: false,
    connectNulls: false,
    lineStyle: { width: style.width, color: style.color },
    emphasis: { disabled: true },
    z: 5,
  });

  /** Index of the bar containing `at`, or the last bar at or before it. */
  const indexAt = (at: number): number => {
    let idx = -1;
    for (let k = 0; k < bars.length; k++) if (bars[k].at <= at) idx = k; else break;
    return idx;
  };

  const marks: Array<Record<string, unknown>> = [];
  const lines: Array<Record<string, unknown>> = [];

  if (signal) {
    const entryIdx = indexAt(signal.firedAt);
    if (entryIdx >= 0) {
      // The entry arrow points the way the trade goes and sits on the side price came from, so a
      // long entry's arrow is below the bar and a short's above it.
      marks.push({
        name: "Entry",
        coord: [labels[entryIdx], signal.entry],
        symbol: signal.direction === 1 ? "triangle" : "triangle",
        symbolRotate: signal.direction === 1 ? 0 : 180,
        symbolSize: 13,
        symbolOffset: [0, signal.direction === 1 ? 16 : -16],
        itemStyle: { color: signal.direction === 1 ? BULL : BEAR },
        label: {
          show: true,
          position: signal.direction === 1 ? "bottom" : "top",
          distance: 14,
          formatter: `${signal.side} ${signal.entry.toFixed(2)}`,
          color: signal.direction === 1 ? BULL : BEAR,
          fontSize: 11,
          fontWeight: "bold",
        },
      });

      // The exit arrow only exists once the trade has settled. Drawing one on an open position
      // would be drawing a fill that has not happened.
      if (signal.outcome.closedAt != null && signal.outcome.state !== "Open") {
        const exitIdx = indexAt(signal.outcome.closedAt);
        const hit = signal.outcome.state === "TargetHit";
        if (exitIdx >= 0)
          marks.push({
            name: "Exit",
            coord: [labels[exitIdx], hit ? signal.target.primary.price : signal.stop.recommended.price],
            symbol: "pin",
            symbolSize: 22,
            itemStyle: { color: hit ? BULL : BEAR },
            label: {
              show: true,
              position: "top",
              formatter: `${hit ? "TARGET" : "STOP"} ${signal.outcome.r == null ? "" : `${signal.outcome.r.toFixed(2)}R`}`,
              color: hit ? BULL : BEAR,
              fontSize: 10.5,
              fontWeight: "bold",
            },
          });
      }
    }

    lines.push(
      {
        yAxis: signal.stop.recommended.price,
        lineStyle: { color: BEAR, type: "dashed", width: 1.4 },
        label: {
          // Below its own line, where the target's label is above its own. On a tight setup the
          // two lines are a few rupees apart and two `insideEndTop` labels land on top of each
          // other; sending them opposite ways keeps both readable however close the plan is.
          show: true, position: "insideEndBottom", formatter: `Stop ${signal.stop.recommended.price.toFixed(2)}`,
          color: BEAR, fontSize: 10.5, fontWeight: "bold",
        },
      },
      {
        yAxis: signal.target.primary.price,
        lineStyle: { color: BULL, type: "dashed", width: 1.4 },
        label: {
          show: true, position: "insideEndTop",
          formatter: `${signal.target.primary.label} ${signal.target.primary.price.toFixed(2)}`,
          color: BULL, fontSize: 10.5, fontWeight: "bold",
        },
      },
      {
        yAxis: signal.entry,
        lineStyle: { color: "#c7d2dc", type: "dotted", width: 1.2 },
        label: { show: false },
      },
    );
  }

  // The impulse leg the retracement belongs to, drawn as a line from its start to its extreme. It is
  // the one piece of context that makes the retracement percentage on the row mean anything.
  const impulse = signal?.pullback.impulse;
  const impulseLine =
    impulse && indexAt(impulse.fromAt) >= 0 && indexAt(impulse.toAt) >= 0
      ? [
          {
            type: "line" as const,
            name: "Impulse",
            data: [],
            markLine: {
              silent: true,
              symbol: ["none", "none"],
              data: [
                [
                  { coord: [labels[indexAt(impulse.fromAt)], impulse.fromPrice] },
                  { coord: [labels[indexAt(impulse.toAt)], impulse.toPrice] },
                ],
              ],
              lineStyle: { color: "#7dd3fc", type: "solid", width: 1.2, opacity: 0.7 },
            },
            z: 3,
          },
        ]
      : [];

  return {
    animation: false,
    backgroundColor: "transparent",
    legend: {
      top: 0,
      right: 8,
      textStyle: { color: AXIS, fontSize: 11 },
      itemWidth: 14,
      itemHeight: 8,
      data: ["9 EMA", "20 EMA", "50 EMA", "200 EMA", "VWAP", "Pullback zone"],
      inactiveColor: "#3a4351",
    },
    grid: [
      { left: 12, right: 74, top: 26, height: "66%", containLabel: true },
      { left: 12, right: 74, top: "80%", bottom: 26, containLabel: true },
    ],
    axisPointer: { link: [{ xAxisIndex: "all" }], label: { backgroundColor: "#1e2733" } },
    tooltip: {
      ...tooltip,
      trigger: "axis",
      axisPointer: { type: "cross" },
      formatter: (ps: Array<{ axisValue: string; dataIndex: number }>) => {
        if (!ps.length) return "";
        const k = ps[0].dataIndex;
        const b = bars[k];
        if (!b) return "";
        const z = band[k];
        const dir = b.close >= b.open ? BULL : BEAR;
        const num = (v: number | null) => (v == null ? "—" : v.toFixed(2));
        return [
          `<b>${ps[0].axisValue}</b>${b.synthetic ? ' <span style="color:#e2c15c">poll-built</span>' : ""}`,
          `O ${b.open.toFixed(2)} &nbsp; H ${b.high.toFixed(2)}`,
          `L ${b.low.toFixed(2)} &nbsp; <span style="color:${dir}">C ${b.close.toFixed(2)}</span>`,
          `<span style="color:${EMA_STYLE[9].color}">9</span> ${num(e9[k])} &nbsp; <span style="color:${EMA_STYLE[20].color}">20</span> ${num(e20[k])}`,
          `<span style="color:${EMA_STYLE[50].color}">50</span> ${num(e50[k])} &nbsp; <span style="color:${EMA_STYLE[200].color}">200</span> ${num(e200[k])}`,
          `VWAP ${num(vw[k])}`,
          z ? `<span style="color:${AXIS}">Zone ${z[0].toFixed(2)} – ${z[1].toFixed(2)}</span>` : "",
          `Vol ${b.volume.toLocaleString("en-IN")}`,
        ].filter(Boolean).join("<br/>");
      },
    },
    xAxis: [
      {
        type: "category", data: labels, gridIndex: 0, boundaryGap: true,
        axisLine: { lineStyle: { color: GRID } },
        axisLabel: { show: false },
        axisTick: { show: false },
        splitLine: { show: true, lineStyle: { color: GRID } },
      },
      {
        type: "category", data: labels, gridIndex: 1, boundaryGap: true,
        axisLine: { lineStyle: { color: GRID } },
        axisTick: { show: false },
        // Auto interval rather than one computed off the full bar count: the chart opens zoomed
        // into the last third, and a fixed every-Nth-label picked for 320 bars leaves one or two
        // clock labels on the ~120 that are actually on screen. `hideOverlap` lets the density
        // follow the zoom instead.
        axisLabel: { color: AXIS, fontSize: 10.5, hideOverlap: true },
        splitLine: { show: false },
      },
    ],
    yAxis: [
      {
        // `scale: true` keeps the axis off zero — a ₹143 stock's day is a 2% range, and an axis
        // anchored at zero draws it as a flat line. The boundary gap is headroom for the Stop and
        // Target labels, which sit above their lines and would otherwise be clipped by the grid.
        scale: true, gridIndex: 0, position: "right", boundaryGap: ["6%", "8%"],
        axisLine: { show: false },
        axisLabel: { color: AXIS, fontSize: 11 },
        splitLine: { lineStyle: { color: GRID } },
      },
      {
        gridIndex: 1, position: "right",
        axisLine: { show: false },
        axisLabel: { color: AXIS, fontSize: 10, formatter: (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}k` : String(v)) },
        splitLine: { show: false },
      },
    ],
    dataZoom: [
      // Opens on the last third, which is where the signal is. A 320-bar chart drawn whole makes
      // individual candles two pixels wide and the confirmation bar impossible to see.
      { type: "inside", xAxisIndex: [0, 1], start: 62, end: 100, zoomOnMouseWheel: true },
      { type: "slider", xAxisIndex: [0, 1], height: 14, bottom: 4, start: 62, end: 100, borderColor: GRID, fillerColor: "rgba(76,141,255,0.12)", handleStyle: { color: "#4c8dff" }, textStyle: { color: AXIS, fontSize: 10 } },
    ],
    series: [
      {
        // The zone. A `custom` series rather than a stacked area, so a null edge draws NOTHING
        // instead of anchoring the band to the x-axis.
        type: "custom" as const,
        name: "Pullback zone",
        z: 1,
        renderItem: (params: { dataIndex: number }, api: {
          value: (d: number) => number;
          coord: (p: [number, number]) => [number, number];
          size: (p: [number, number]) => [number, number];
        }) => {
          const k = params.dataIndex;
          const lo = api.value(1);
          const hi = api.value(2);
          if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
          const [x, yTop] = api.coord([k, hi]);
          const [, yBottom] = api.coord([k, lo]);
          const [w] = api.size([1, 0]);
          return {
            type: "rect",
            shape: { x: x - w / 2, y: yTop, width: Math.max(1, w), height: Math.max(1, yBottom - yTop) },
            style: { fill: ZONE, stroke: ZONE_EDGE, lineWidth: 0 },
          };
        },
        // Dimension 0 is the bar index and dimensions 1-2 are the band's edges IN PRICE, and the
        // encode below is why the chart is readable at all.
        //
        // A custom series still contributes its encoded y values to the price axis extent. This
        // used to be `data: bars.map((_, k) => k)` with `encode: { x: 0, y: 0 }` — the same
        // dimension serving as both, so every bar index was offered to the price axis as if it
        // were a price. On a 320-bar chart that stretched the axis to 0–320 and squashed a stock
        // trading near 143 into a flat line two pixels tall. The candles were never wrong; the
        // scale they were drawn against was.
        data: bars.map((_, k) => [k, band[k]?.[0] ?? null, band[k]?.[1] ?? null]),
        encode: { x: 0, y: [1, 2] },
        tooltip: { show: false },
      },
      {
        type: "candlestick" as const,
        name: "Price",
        // ECharts takes [open, close, low, high].
        data: bars.map((b) => [b.open, b.close, b.low, b.high]),
        itemStyle: { color: BULL, color0: BEAR, borderColor: BULL, borderColor0: BEAR },
        z: 4,
        markPoint: marks.length ? { symbolKeepAspect: false, data: marks } : undefined,
        markLine: lines.length ? { silent: true, symbol: ["none", "none"], data: lines } : undefined,
      },
      line(e9, EMA_STYLE[9]),
      line(e20, EMA_STYLE[20]),
      line(e50, EMA_STYLE[50]),
      line(e200, EMA_STYLE[200]),
      {
        ...line(vw, { color: "#e879f9", width: 1.6, name: "VWAP" }),
        lineStyle: { width: 1.6, color: "#e879f9", type: "dashed" },
      },
      ...impulseLine,
      {
        type: "bar" as const,
        name: "Volume",
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: bars.map((b) => ({
          value: b.volume,
          itemStyle: { color: b.close >= b.open ? "rgba(46,199,106,.45)" : "rgba(229,72,77,.45)" },
        })),
        barWidth: "62%",
      },
    ],
  };
}
