import { Suspense } from "react";
import { loadClock } from "@/lib/optionclock";
import OptionClockClient from "./OptionClockClient";
import OptionClockSkeleton from "./Skeleton";

export const dynamic = "force-dynamic";

const DEFAULT_SCRIPT = "NIFTY 50";

async function Board() {
  try {
    const data = await loadClock(DEFAULT_SCRIPT);
    return <OptionClockClient initial={data} script={DEFAULT_SCRIPT} />;
  } catch (e) {
    // Option data has no mock fallback on purpose: an invented OI ladder reads exactly
    // like a real one and would be traded on. Say what's wrong instead.
    return (
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight mb-5">Option Clock</h1>
        <div className="panel p-6">
          <p className="font-semibold mb-1">Option data unavailable</p>
          <p className="text-muted text-sm">
            NSE&apos;s option chain could not be reached and nothing has been recorded for this
            session yet. It will fill in automatically once the feed answers.
          </p>
          <p className="text-muted text-xs mt-3 font-mono">{String((e as Error).message)}</p>
        </div>
      </div>
    );
  }
}

// Non-async on purpose — see the note in ../momentum-scanner/page.tsx. It matters more here
// than on the tables: the chain read is slow and the three charts are ECharts canvases that
// paint nothing until their own chunk lands.
export default function Page() {
  return (
    <Suspense fallback={<OptionClockSkeleton />}>
      <Board />
    </Suspense>
  );
}
