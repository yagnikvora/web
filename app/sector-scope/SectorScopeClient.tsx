"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useLiveData } from "@/lib/live";
import LiveClock from "@/components/LiveClock";
import { TREEMAP_ONLY } from "@/lib/sectors";
import { toTreemap, treemapOption, barOption } from "./charts";
import { Bulb, Play } from "@/components/icons";
import SectorTables, { sectorAnchor } from "./SectorTables";
import type { EChartsType } from "echarts";
import type { SectorScope } from "@/lib/types";

// ECharts touches window/canvas on import, so it can't run in the server render.
const ReactECharts = dynamic(() => import("echarts-for-react"), {
  ssr: false,
  loading: () => (
    <div className="h-[70vh] grid place-items-center text-[#8a8aa0] text-[14px] rounded-[14px] bg-white/[0.02] border border-white/10">
      Loading chart…
    </div>
  ),
});


// Click params we care about: a bar gives `name`; a treemap tile gives the path
// [root, sector, stock], so the sector is looked up along it.
interface ClickParams { name?: string; treePathInfo?: { name: string }[] }

export default function SectorScopeClient({ data: initial }: { data: SectorScope }) {
  const { data, updatedAt, open } = useLiveData<SectorScope>(initial, "/api/sector-scope");
  const [jumped, setJumped] = useState<string | null>(null);

  const nodes = useMemo(() => toTreemap(data), [data]);
  const treemap = useMemo(() => treemapOption(nodes), [nodes]);
  // OTHERS is a catch-all bucket — it maps but has no sector identity to rank or tabulate.
  const ranked = useMemo(() => nodes.filter((n) => !TREEMAP_ONLY.has(n.name)), [nodes]);
  const bars = useMemo(() => barOption(ranked), [ranked]);
  // Charts rank by strength, but the table cards keep the feed's own sector order — the
  // real page lays them out that way (METAL, PSU BANK, REALTY, ENERGY, …) and re-ranking
  // them every refresh would shuffle cards under the reader mid-session.
  const tables = useMemo(
    () =>
      Object.entries(data).filter(
        ([name, stocks]) => !TREEMAP_ONLY.has(name) && stocks?.length,
      ) as [string, typeof data[string]][],
    [data],
  );
  const sectorNames = useMemo(() => new Set(ranked.map((n) => n.name)), [ranked]);

  // Jump to a sector's table. Clicking a stock tile resolves to its parent sector,
  // so a click anywhere in the map lands somewhere useful.
  const goToSector = useCallback((name?: string) => {
    if (!name || !sectorNames.has(name)) return;
    document.getElementById(sectorAnchor(name))?.scrollIntoView({ behavior: "smooth", block: "start" });
    setJumped(name);
  }, [sectorNames]);

  const onChartClick = useCallback((p: ClickParams) => {
    // For a treemap leaf, treePathInfo is [root, sector, stock] — take the sector.
    const sector = p.treePathInfo?.find((n) => sectorNames.has(n.name))?.name;
    goToSector(sector ?? p.name);
  }, [goToSector, sectorNames]);

  // Bound straight onto the chart instance — the `onEvents` prop didn't survive the
  // dynamic import. Binding runs once on ready, so it reads the handler through a ref
  // to avoid capturing a stale closure as the live data refreshes underneath it.
  const handlerRef = useRef(onChartClick);
  handlerRef.current = onChartClick;

  const bindClick = useCallback((inst: EChartsType) => {
    inst.off("click");
    inst.on("click", (p) => handlerRef.current(p as ClickParams));
  }, []);

  return (
    <div className="pb-10">
      {/* header */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-5">
        <h2 className="flex items-center text-[28px] font-extrabold leading-tight">
          Sector Scope
          <Bulb className="ml-2 w-[20px] h-[20px] text-amber-300/80" />
        </h2>
        <button type="button" className="flex items-center gap-1.5 text-[#cfd3dc] hover:text-white transition-colors">
          <span className="text-[17px] font-semibold underline underline-offset-4">How to use</span>
          <Play className="w-[15px] h-[15px] text-accent" />
        </button>
        <LiveClock at={updatedAt} open={open} />
      </div>

      {/* treemap — sectors as groups, tile area by size of move, colour by strength */}
      <section className="rounded-[14px] border border-white/10 bg-white/[0.02] p-3">
        <div className="flex items-center justify-between px-1 pb-2">
          <h3 className="text-[15px] font-bold tracking-wide text-[#cfd3dc]">SECTOR MAP</h3>
          <span className="text-[12px] text-[#8a8aa0]">
            Tile size = size of move · colour = strength · click to open the sector
          </span>
        </div>
        <ReactECharts
          option={treemap}
          style={{ height: "70vh", minHeight: 420 }}
          notMerge
          lazyUpdate
          onChartReady={bindClick}
          opts={{ renderer: "canvas" }}
        />
      </section>

      {/* sector strength bars */}
      <section className="rounded-[14px] border border-white/10 bg-white/[0.02] p-3 mt-6">
        <div
          className="py-2.5 mb-1 flex items-center px-1 text-[15px]"
          style={{ borderBottom: "1px solid rgb(221, 242, 71)" }}
        >
          <span className="font-bold tracking-wide">SECTOR SCOPE</span>
          <span className={`ml-3 mr-2 w-2 h-2 rounded-full ${open ? "bg-[#2ec76a] animate-pulse" : "bg-[#8a8aa0]"}`} />
          <span className="text-[#878787] text-[13px]">{open ? "ACTIVE" : "CLOSED"}</span>
          <span className="ml-auto text-[12px] text-[#8a8aa0] hidden sm:block">
            Move × R.Factor, summed per sector · click a bar for that sector
          </span>
        </div>
        {/* Taller than it looks like it needs to be. "NIFTY MID SELECT" rotated upright
            is a ~180px label band that comes off the bottom before a single bar is drawn,
            so at 40vh the plot was left with barely a third of the box and every sector
            flattened into a hairline. The band costs the same at any height, so the extra
            height all goes to the bars. */}
        <ReactECharts
          option={bars}
          style={{ height: "48vh", minHeight: 460 }}
          notMerge
          lazyUpdate
          onChartReady={bindClick}
          opts={{ renderer: "canvas" }}
        />
      </section>

      {/* per-sector tables — one card per sector, R.Factor ranked */}
      <SectorTables sectors={tables} highlight={jumped} />
    </div>
  );
}
