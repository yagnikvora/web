import { Suspense } from "react";
import { fetchData } from "@/lib/api";
import type { MomentumBoard } from "@/lib/momentum";
import MomentumClient from "./MomentumClient";
import MomentumSkeleton from "./Skeleton";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Momentum Scanner",
  description:
    "Institutional-grade intraday momentum across every NSE F&O stock — relative volume, VWAP, " +
    "relative strength, option OI build-up, Greeks and volatility, scored 0–100 with the reasoning shown.",
};

async function Board() {
  // The board carries its own warnings — a missing baseline, a rate-limited endpoint, an IV
  // history still warming — and those are part of the page, not an error condition. The one
  // case worth rendering separately is a backend that answered nothing at all, because a
  // scanner with no rows and no explanation is indistinguishable from a broken deployment.
  const board = await fetchData<MomentumBoard>("/momentum?includeFactors=false").catch(
    (e: Error) => ({ data: null, source: undefined, error: e.message }) as const,
  );

  if (!("data" in board) || board.data === null) {
    const message = "error" in board ? board.error : "the momentum API did not answer";
    return (
      <main className="p-5">
        <h1 className="text-3xl font-extrabold tracking-tight mb-4">Momentum Scanner</h1>
        <div className="panel p-5 max-w-3xl">
          <p className="text-bear font-semibold mb-2">The scanner could not load.</p>
          <p className="text-muted text-sm mb-4">{message}</p>
          <ul className="text-sm text-muted list-disc pl-5 space-y-1">
            <li>Is the API running on port 4100 (<code>cd api &amp;&amp; npm run dev</code>)?</li>
            <li>
              Is <code>UPSTOX_ACCESS_TOKEN</code> set in <code>api/.env</code> to an Analytics Token?
              Check with <code>npm run check-upstox</code>.
            </li>
            <li>
              Has the daily baseline been built? <code>GET /momentum/status</code> reports it, and
              <code> POST /momentum/baseline/rebuild</code> starts one.
            </li>
          </ul>
        </div>
      </main>
    );
  }

  return <MomentumClient initial={board.data} source={board.source} />;
}

/**
 * The page itself does no awaiting, and that is the point.
 *
 * An `async` page holds the entire RSC response until its fetch resolves: the router gets nothing
 * to render, so a click on the nav sits on the old page for the length of the request plus the time
 * to serialise ~800 KB of board. With the fetch moved behind a Suspense boundary the shell flushes
 * on the first chunk, the skeleton paints, and the board streams in underneath it — which is also
 * what makes the navigation feel immediate on a hard refresh, where `loading.tsx` alone would not
 * help.
 *
 * Every board page in this app is built this way and the others point here for the reasoning. It
 * used to live in the EMA Pullback Scanner's page, which was the first one to need it; this became
 * its home when that scanner was removed.
 */
export default function Page() {
  return (
    <Suspense fallback={<MomentumSkeleton />}>
      <Board />
    </Suspense>
  );
}
