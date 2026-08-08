import { Bar, SkeletonPanel } from "@/components/skeleton";

// Chart heights are the real ones — 520 for the index chart, 340 for Index Mover — so the
// page does not jump when the ECharts canvases mount underneath.
export default function OptionApexSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading Options Apex…</span>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Options Apex</h1>
        <Bar w={74} h={20} className="rounded-full" />
        <div className="w-full sm:w-auto sm:ml-auto flex flex-wrap items-center gap-2">
          {/* Index, Time and Expiry. */}
          {[128, 96, 168].map((w) => (
            <Bar key={w} w={w} h={34} className="rounded-lg" />
          ))}
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <SkeletonPanel title="Index" height="clamp(320px, 52vh, 520px)" controls={3}>
          <Bar w={300} h={11} className="mt-2" />
        </SkeletonPanel>

        <div className="grid gap-4 content-start">
          <SkeletonPanel title="Sentiment">
            <div className="grid grid-cols-2 gap-3 pt-1">
              <Bar w="100%" h={150} className="rounded-xl" />
              <Bar w="100%" h={150} className="rounded-xl" />
            </div>
            <Bar w="100%" h={42} className="mt-3 rounded-lg" />
            <div className="grid grid-cols-2 gap-2 mt-3">
              <Bar w="100%" h={46} className="rounded-lg" />
              <Bar w="100%" h={46} className="rounded-lg" />
            </div>
          </SkeletonPanel>

          <SkeletonPanel title="Money Flux">
            <Bar w={190} h={28} />
            <Bar w="100%" h={10} className="mt-3 rounded-full" />
            <div className="flex justify-between mt-1.5">
              <Bar w={110} h={11} />
              <Bar w={110} h={11} />
            </div>
            <div className="grid grid-cols-2 gap-y-2 gap-x-3 mt-4">
              {Array.from({ length: 6 }, (_, i) => (
                <Bar key={i} w={i % 2 ? "70%" : "85%"} h={11} />
              ))}
            </div>
          </SkeletonPanel>
        </div>
      </div>

      <SkeletonPanel title="Index Mover" className="mt-4">
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
          <Bar w="100%" h="clamp(280px, 40vh, 340px)" className="rounded-xl" />
          <div>
            <Bar w={220} h={20} className="mb-3" />
            <div className="flex flex-col gap-2.5">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="sk w-6 h-6 rounded-full shrink-0" />
                  <Bar w={96 + ((i * 13) % 40)} h={13} />
                  <Bar w={70} h={13} className="ml-auto" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </SkeletonPanel>
    </div>
  );
}
