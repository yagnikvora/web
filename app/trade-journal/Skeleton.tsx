import { Bar, SkeletonTable } from "@/components/skeleton";

// The heading and the standing copy are the same on every load, so they are rendered for real
// rather than shimmered — the same call Trend Day's skeleton makes. What is genuinely unknown is
// the seven totals and the day's rows, and only those are placeheld.
export default function TradeJournalSkeleton() {
  return (
    <main className="p-5 space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the trade journal…</span>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Trade Journal</h1>
          <p className="text-muted text-sm mt-1 max-w-2xl">
            Every alert this app sent, recorded as a position and settled from the contract&apos;s own
            1-minute candles after the close.
          </p>
        </div>
        <div className="ml-auto"><Bar w={74} h={20} className="rounded-full" /></div>
      </div>

      <div className="panel p-4 flex flex-wrap items-center gap-3">
        <Bar w={210} h={30} className="rounded-lg" />
        <Bar w={310} h={30} className="rounded-lg" />
        <div className="ml-auto flex gap-2">
          <Bar w={96} h={30} className="rounded-lg" />
          <Bar w={110} h={30} className="rounded-lg" />
          <Bar w={92} h={30} className="rounded-lg" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="panel p-3 space-y-2">
            <Bar w={62} h={9} />
            <Bar w={88} h={19} />
            <Bar w={74} h={9} />
          </div>
        ))}
      </div>

      <SkeletonTable title="Today" cols={11} rows={4} height={300} />
    </main>
  );
}
