import { Bar, SkeletonTable } from "@/components/skeleton";

// Trend Day leads with a heading and a paragraph of standing copy rather than a stat strip,
// so the placeholder does too — that text is the same on every load, and showing it straight
// away is more useful than shimmering over words we already know.
export default function TrendDaySkeleton() {
  return (
    <main className="px-0 py-1 sm:p-5 flex flex-col gap-4 sm:gap-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading Trend Day…</span>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Trend Day</h1>
          <p className="text-muted text-sm mt-1 max-w-3xl">
            Stocks going <strong className="text-[#c7d2dc]">one direction all session</strong>. Ranked by how
            one-sided the whole day has been — VWAP adherence, how many times price changed sides, path
            efficiency and the deepest counter-move — rather than by how much it moved in the last three
            minutes.
          </p>
        </div>
        <Bar w={74} h={20} className="rounded-full" />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Bar w={220} h={13} />
        <Bar w={260} h={13} />
        <Bar w={130} h={13} />
      </div>

      <SkeletonTable title="One-sided days" cols={11} rows={8} height={620} />
    </main>
  );
}
