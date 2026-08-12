import { Suspense } from "react";
import { fetchData } from "@/lib/api";
import type { TrendBoard } from "@/lib/momentum";
import TrendDayClient from "./TrendDayClient";
import TrendDaySkeleton from "./Skeleton";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Trend Day",
  description:
    "Stocks going one direction all session — VWAP adherence, crossing count, path efficiency and " +
    "pullback depth over the whole day, ranked by conviction and held steady rather than reshuffled " +
    "every fifteen seconds.",
};

async function Board() {
  const board = await fetchData<TrendBoard>("/momentum/trend").catch(
    (e: Error) => ({ data: null, source: undefined, error: e.message }) as const,
  );

  if (!("data" in board) || board.data === null) {
    const message = "error" in board ? board.error : "the trend API did not answer";
    return (
      <main className="p-5">
        <h1 className="text-3xl font-extrabold tracking-tight mb-4">Trend Day</h1>
        <div className="panel p-5 max-w-3xl">
          <p className="text-bear font-semibold mb-2">The trend board could not load.</p>
          <p className="text-muted text-sm mb-4">{message}</p>
          <ul className="text-sm text-muted list-disc pl-5 space-y-1">
            <li>Is the API running on port 4100 (<code>cd api &amp;&amp; npm run dev</code>)?</li>
            <li>
              Is the conviction layer on? It is by default —{" "}
              <code>thresholds.conviction.enabled</code> in <code>GET /momentum/config</code>.
            </li>
            <li>
              This view needs the session&apos;s own history. After a restart it stays empty until the
              scanner has watched <code>phase.minObservedMin</code> minutes of the market itself.
            </li>
          </ul>
        </div>
      </main>
    );
  }

  return <TrendDayClient initial={board.data} source={board.source} />;
}

// Non-async on purpose — see the note in ../momentum-scanner/page.tsx.
export default function Page() {
  return (
    <Suspense fallback={<TrendDaySkeleton />}>
      <Board />
    </Suspense>
  );
}
