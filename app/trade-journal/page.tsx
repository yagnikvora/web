import { Suspense } from "react";
import { fetchData } from "@/lib/api";
import type { JournalView } from "@/lib/journal";
import TradeJournalClient from "./TradeJournalClient";
import TradeJournalSkeleton from "./Skeleton";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Trade Journal",
  description:
    "Every alert recorded as a position — the contract bought, the price paid, the price it exited " +
    "at, and what it made or lost after charges. Settled from the contract's own candles after the " +
    "close, so the day can be read at night instead of watched.",
};

// Opens on today. The API defaults `from` and `to` to the current IST session, so the range is
// left off the request rather than computed here — the server and the browser would otherwise
// disagree about what "today" is whenever this box is not in IST.
async function Journal() {
  const res = await fetchData<JournalView>("/momentum/journal").catch(
    (e: Error) => ({ data: null, source: undefined, error: e.message }) as const,
  );

  if (!("data" in res) || res.data === null) {
    const message = "error" in res ? res.error : "the journal API did not answer";
    return (
      <main className="p-5">
        <h1 className="text-3xl font-extrabold tracking-tight mb-4">Trade Journal</h1>
        <div className="panel p-5 max-w-3xl">
          <p className="text-bear font-semibold mb-2">The journal could not load.</p>
          <p className="text-muted text-sm mb-4">{message}</p>
          <ul className="text-sm text-muted list-disc pl-5 space-y-1">
            <li>Is the API running on port 4100 (<code>cd api &amp;&amp; npm run dev</code>)?</li>
            <li>
              The journal is on by default. <code>JOURNAL=off</code> in <code>api/.env</code> disables
              it — check <code>journal.enabled</code> on <code>GET /momentum/status</code>.
            </li>
            <li>
              It only has rows once an alert channel has fired. Nothing is backfilled: a day the
              scanner was not running is a day with no trades, and it will stay that way.
            </li>
          </ul>
        </div>
      </main>
    );
  }

  return <TradeJournalClient initial={res.data} source={res.source} />;
}

// Non-async on purpose — see the note in ../momentum-scanner/page.tsx.
export default function Page() {
  return (
    <Suspense fallback={<TradeJournalSkeleton />}>
      <Journal />
    </Suspense>
  );
}
