import { fetchData } from "@/lib/api";
import type { PullbackBoard } from "@/lib/pullback";
import PullbackClient from "./PullbackClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "EMA Pullback Scanner",
  description:
    "9/20 EMA pullback continuation setups across every NSE F&O stock and the four index underlyings — " +
    "trend, retracement into the EMA/VWAP zone, candle and volume confirmation, ADX and structure, " +
    "scored 0–100 with the stop, the targets and the option contract worked out.",
};

export default async function Page() {
  // The board carries its own warnings — a warming seed, a rate-limited endpoint, a timeframe with
  // too little history — and those are part of the page, not an error condition. The one case worth
  // rendering separately is a backend that answered nothing at all, because a scanner with no rows
  // and no explanation is indistinguishable from a broken deployment.
  const board = await fetchData<PullbackBoard>("/pullback").catch(
    (e: Error) => ({ data: null, source: undefined, error: e.message }) as const,
  );

  if (!("data" in board) || board.data === null) {
    const message = "error" in board ? board.error : "the pullback API did not answer";
    return (
      <main className="p-5">
        <h1 className="text-3xl font-extrabold tracking-tight mb-4">EMA Pullback Scanner</h1>
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
              Has the EMA seed been built? A 200-period average on the 15-minute chart spans eight
              sessions and cannot be computed from today. <code>GET /pullback/status</code> reports it,
              and <code>POST /pullback/seed/rebuild</code> starts one.
            </li>
          </ul>
        </div>
      </main>
    );
  }

  return <PullbackClient initial={board.data} source={board.source} />;
}
