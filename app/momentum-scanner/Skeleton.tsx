import { Bar, SkeletonHead, SkeletonStrip, SkeletonTable } from "@/components/skeleton";

// The scanner's arrangement is heading → market strip → "Entries live now" → table, and the
// placeholder follows it so the real board lands in the same places rather than reflowing.
// Used by both `loading.tsx` (navigation) and `page.tsx` (the streaming fallback).
export default function MomentumSkeleton() {
  return (
    <main className="px-0 py-1 sm:p-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the Momentum Scanner…</span>
      <SkeletonHead title="Momentum Scanner" />
      <SkeletonStrip n={7} />

      <section className="panel p-3 sm:p-4 mb-4">
        <div className="flex items-baseline gap-3 mb-3 flex-wrap">
          <h2 className="text-[15px] font-bold text-muted">Entries live now</h2>
          <Bar w={300} h={11} />
        </div>
        <div className="flex flex-wrap gap-2.5">
          {Array.from({ length: 6 }, (_, i) => (
            <Bar key={i} w={186 + ((i * 29) % 60)} h={52} className="rounded-xl" />
          ))}
        </div>
      </section>

      <SkeletonTable title="Top momentum" cols={17} rows={9} height={720} filters={1} />
    </main>
  );
}
