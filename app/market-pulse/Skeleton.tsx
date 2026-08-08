import { Bar, SkeletonTable } from "@/components/skeleton";

// The seven widget titles are fixed copy, not data, so they are printed for real — the
// reader can see which card is which before a single row exists. Column counts are each
// widget's own (see the `*Cols` configs in MarketPulseClient) so nothing reflows on swap.
const WIDGETS: { title: string; cols: number }[] = [
  { title: "BREAKOUT BEACON", cols: 6 },
  { title: "INTRADAY BOOST", cols: 5 },
  { title: "TOP LEVEL STOCKS", cols: 4 },
  { title: "LOW LEVEL STOCKS", cols: 4 },
  { title: "TOP GAINERS", cols: 4 },
  { title: "TOP LOSERS", cols: 4 },
  { title: "HIGH POW. STOCKS", cols: 4 },
];

export default function MarketPulseSkeleton() {
  return (
    <div
      className="min-h-screen"
      aria-busy="true"
      aria-live="polite"
      style={{ backgroundImage: "radial-gradient(900px 620px at 28% 42%, rgba(20,60,160,0.16), transparent 65%)" }}
    >
      <span className="sr-only">Loading Market Pulse…</span>

      <div className="flex items-center flex-wrap gap-3 sm:gap-4 pb-5 sm:pb-[30px]">
        <h2 className="text-2xl sm:text-[32px] font-extrabold leading-tight sm:leading-[44px] capitalize">Market Pulse</h2>
        <Bar w={132} h={20} className="rounded-full" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        {WIDGETS.map((w) => (
          <SkeletonTable key={w.title} title={w.title} cols={w.cols} rows={7} height={500} filters={1} filterCols={2} />
        ))}
      </div>
    </div>
  );
}
