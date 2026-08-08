import { Bar, SkeletonTable } from "@/components/skeleton";

// Two ECharts canvases dominate this page, and their heights are viewport-relative
// (70vh/48vh with px floors). The placeholders use the same rule rather than a fixed
// number, so the treemap does not land 200px away from where its box was drawn.
export default function SectorScopeSkeleton() {
  return (
    <div className="pb-10" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading Sector Scope…</span>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-5">
        <h2 className="text-2xl sm:text-[28px] font-extrabold leading-tight">Sector Scope</h2>
        <Bar w={132} h={20} className="rounded-full" />
      </div>

      <section className="rounded-[14px] border border-white/10 bg-white/[0.02] p-3">
        <div className="flex items-center justify-between px-1 pb-2">
          <h3 className="text-[15px] font-bold tracking-wide text-[#cfd3dc]">SECTOR MAP</h3>
          <span className="hidden md:block"><Bar w={330} h={12} /></span>
        </div>
        <span className="sk rounded-[10px] block w-full" style={{ height: "70vh", minHeight: 420 }} />
      </section>

      <section className="rounded-[14px] border border-white/10 bg-white/[0.02] p-3 mt-6">
        <div
          className="py-2.5 mb-1 flex items-center px-1 text-[15px]"
          style={{ borderBottom: "1px solid rgb(221, 242, 71)" }}
        >
          <span className="font-bold tracking-wide">SECTOR SCOPE</span>
          <Bar w={70} h={12} className="ml-3" />
        </div>
        <span className="sk rounded-[10px] block w-full" style={{ height: "48vh", minHeight: 460 }} />
      </section>

      {/* One card per sector below the charts. Four is a sample, not the real count —
          which sectors the feed returns is exactly what has not loaded yet. */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonTable key={i} title="Sector" cols={6} rows={6} height={460} />
        ))}
      </div>
    </div>
  );
}
