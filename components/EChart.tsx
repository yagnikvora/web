"use client";

import { useEffect, useRef } from "react";
import type { ECharts, EChartsCoreOption } from "echarts";

/**
 * An ECharts canvas that always matches its container.
 *
 * ECharts measures the element once, at init. Mounting it through a lazy import means
 * that measurement can land before the surrounding grid has laid out, and the chart
 * then paints into a zero-width canvas and stays that way — a full-height panel with
 * nothing in it. Initialising from an effect guarantees the element is laid out first,
 * and a ResizeObserver keeps it right through every later reflow.
 *
 * echarts is imported lazily because it touches window/canvas on import and so cannot
 * be part of the server render.
 */
export default function EChart({ option, height, className = "" }: {
  option: EChartsCoreOption;
  height: number;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<ECharts | null>(null);
  // Read through a ref so the first paint uses the latest option without making the
  // init effect depend on it (which would tear the chart down on every data refresh).
  const latest = useRef(option);
  latest.current = option;

  useEffect(() => {
    let disposed = false;
    let ro: ResizeObserver | undefined;

    import("echarts").then((echarts) => {
      const el = box.current;
      if (disposed || !el) return;
      chart.current = echarts.init(el);
      chart.current.setOption(latest.current);
      ro = new ResizeObserver(() => chart.current?.resize());
      ro.observe(el);
    });

    return () => {
      disposed = true;
      ro?.disconnect();
      chart.current?.dispose();
      chart.current = null;
    };
  }, []);

  // notMerge, so a shorter strike ladder doesn't leave the previous one's bars behind.
  useEffect(() => { chart.current?.setOption(option, true); }, [option]);

  return <div ref={box} className={className} style={{ height, width: "100%" }} />;
}
