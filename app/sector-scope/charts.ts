// Chart options for the sector heatmap widgets
// (treemap + sector-strength bars). Both are ECharts; the option shapes below
// mirror the ones the live site feeds its charts.
import type { SectorScope, SectorStock } from "@/lib/types";

// OTHERS is a catch-all bucket: the real page maps it but leaves it out of the
// strength bars and the per-sector tables.
export const TREEMAP_ONLY = new Set(["OTHERS"]);

export interface TreeNode {
  name: string;
  id: string;
  // [area, area*10, signed %, colour score -100..100]
  value: [number, number, number, number];
  children?: TreeNode[];
}

// Colour score is normalised *within each sector*: the biggest mover of the day
// pins to ±100 and everything else scales down to ±40. Without the 40 floor a
// quiet stock would render mid-grey and read as "no data" rather than "barely moved".
function score(pct: number, maxUp: number, maxDown: number): number {
  if (pct >= 0) return maxUp > 0 ? 40 + (60 * pct) / maxUp : 40;
  return maxDown > 0 ? -(40 + (60 * Math.abs(pct)) / maxDown) : -40;
}

// Sector strength, shown as a multiple ("7.05 x") exactly as the real widget labels it.
//
// It is the SUM of each stock's % move scaled by its R.Factor (relative volume), not an
// average — the sum is deliberate. A 3% move on 5x normal volume says far more about
// where money is rotating than the same move on a quiet tape, and a broad sector with
// many participating names should outrank a narrow one. Their data shows that size
// effect plainly (FMCG, 21 names, scores 7.05; CEMENT, 4 names, scores 0.32), which an
// average would erase.
//
// R.Factor is SQUARED, which weights the calm majority down hard and lets the genuinely
// agitated names carry the sector — the behaviour their ranking shows. Squaring only
// pays off once R.Factor is itself accurate (it amplifies error just as readily as
// signal); on an earlier volume-based R.Factor it scored worse than the unsquared form
// and was correctly rejected. Against a live capture of all 15 of their sectors it now
// wins clearly: Spearman 0.946 vs 0.904 unsquared.
//
// The divisor calibrates onto their scale. It's empirical and depends on our R.Factor
// baseline — it shifts every bar's height equally and never changes the ordering.
//
// It therefore has to move whenever R.Factor's level does, and it moves by the SQUARE
// because R.Factor enters squared: the 1.33 calibration added to rfac() in
// api/src/services.ts scales every bar by 1.33² = 1.77, so 26.3 becomes 46.5 to leave
// the bars where they were. Change one of these two constants and you must change the
// other, or the strength axis silently drifts off their scale.
const STRENGTH_DIVISOR = 46.5;

export const sectorStrength = (stocks: SectorStock[]) =>
  +(stocks.reduce((a, s) => a + s.pChange * s.rFactor ** 2, 0) / STRENGTH_DIVISOR).toFixed(2);

export function toTreemap(data: SectorScope): TreeNode[] {
  return Object.entries(data)
    .filter(([, stocks]) => stocks.length > 0)
    .map(([sector, stocks]) => {
      const maxUp = Math.max(0, ...stocks.map((s) => s.pChange));
      const maxDown = Math.max(0, ...stocks.map((s) => -s.pChange));
      const strength = sectorStrength(stocks);
      return {
        name: sector,
        id: sector,
        // Tile area is driven by size of move, so the day's action dominates the map.
        value: [Math.abs(strength) * 1000, Math.abs(strength) * 10000, strength, 0] as TreeNode["value"],
        children: stocks.map((s) => ({
          name: s.Symbol,
          id: s.Symbol,
          value: [
            Math.abs(s.pChange) * 1000,
            Math.abs(s.pChange) * 10000,
            s.pChange,
            score(s.pChange, maxUp, maxDown),
          ] as TreeNode["value"],
        })),
      };
    })
    .sort((a, b) => b.value[2] - a.value[2]);
}

export function treemapOption(nodes: TreeNode[]) {
  return {
    tooltip: {
      formatter: (p: any) => {
        const v = p.value as number[];
        const pct = v?.[2] ?? 0;
        return `<b>${p.name}</b><br/>${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
      },
    },
    toolbox: { show: true, feature: { restore: {} }, iconStyle: { borderColor: "#84b1ff", borderWidth: 2 } },
    series: [
      {
        name: "",
        top: 0, left: 0, bottom: 0, right: 0,
        roam: false,
        breadcrumb: { show: false },
        type: "treemap",
        label: { show: true, formatter: "{b}" },
        upperLabel: { show: true, height: 30, color: "white", fontSize: 14, fontWeight: "bold", padding: 4 },
        itemStyle: { borderColor: "black" },
        visualMin: -100,
        visualMax: 100,
        visualDimension: 3, // colour comes from the score, not the tile area
        levels: [
          { itemStyle: { borderWidth: 1, borderColor: "#00000000", gapWidth: 5 } },
          { color: ["#942e38", "#aaa", "#269f3c"], colorMappingBy: "value", itemStyle: { gapWidth: 1 } },
        ],
        data: nodes,
      },
    ],
  };
}

// Vertical gradient across the bar's own box (global:false), so offset 0 is always the
// TOP edge. That means a positive bar reads tip → base and a negative bar reads base →
// tip, which is why the two colour pairs below look reversed: both put the vivid end at
// the tip and the softened end where the bar meets the zero line.
const GRAD = (from: string, to: string) => ({
  type: "linear", x: 0, y: 0, x2: 0, y2: 1, global: false,
  colorStops: [{ offset: 0, color: from }, { offset: 1, color: to }],
});

// Bar geometry. The radius is deliberately well under half the bar width: at exactly half
// the ends turn into full semicircular caps, which read as lozenges rather than bars once
// a sector is short. This softens the corners without rounding the bar away.
//
// It stays a single number for every bar because zrender clamps corner radii against the
// shape it is drawing (graphic/helper/roundRect) — so a sector sitting on zero, only a few
// pixels tall, clamps down to half its own height and keeps proportionate ends instead of
// looking like a fat pill. Raising this toward BAR_MAX_W / 2 walks back to full capsules.
const BAR_MAX_W = 50;
const BAR_RADIUS = 5;

export function barOption(nodes: TreeNode[]) {
  const sorted = [...nodes].sort((a, b) => b.value[2] - a.value[2]);
  return {
    // 'axis' + shadow gives the grey column behind the hovered bar, and the value reads
    // as a multiple ("7.05 x") — both as the real widget presents it.
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (ps: any) => {
        const p = Array.isArray(ps) ? ps[0] : ps;
        return `${p.name}<br/>${p.marker} ${Number(p.value).toFixed(2)} x`;
      },
    },
    // containLabel means these are the margins AROUND the axis labels, so `top` is pure
    // dead space above the tallest bar — ECharts defaults it to 60px, which is a lot of
    // nothing on a chart this short. Trimmed to the few pixels the top y-label needs, and
    // every pixel saved goes back into bar height.
    grid: { left: "3%", right: "4%", top: 24, bottom: 4, containLabel: true },
    xAxis: [
      {
        type: "category",
        data: sorted.map((n) => n.name),
        axisTick: { alignWithLabel: true, show: false },
        axisLabel: { fontWeight: "bold", rotate: 90, color: "#878787" },
        axisLine: { show: false },
        splitLine: { show: false },
      },
    ],
    yAxis: [
      {
        type: "value",
        axisLabel: { fontWeight: "bold", color: "#878787" },
        axisLine: { show: false },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        type: "bar",
        // A share of the slot rather than a pixel width, so the bar-to-gap rhythm holds
        // at any viewport — the real chart runs its bars at about a third of the slot.
        // The cap only exists to stop them turning into blocks on an ultrawide monitor.
        barWidth: "34%",
        barMaxWidth: BAR_MAX_W,
        cursor: "pointer", // bars jump to the sector's table
        data: sorted.map((n) => ({
          value: n.value[2],
          itemStyle: {
            borderRadius: BAR_RADIUS,
            // Red's far end was #a00, a near-black maroon that the real chart never
            // reaches — its losing sectors stay a legible red at full depth.
            color: n.value[2] >= 0 ? GRAD("#29AE42", "#60A46D") : GRAD("#E96A6A", "#C93636"),
          },
        })),
      },
    ],
  };
}
