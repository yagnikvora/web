import { Suspense } from "react";
import { loadApex, DEFAULT_SCRIPT, DEFAULT_TF } from "@/lib/apex";
import OptionApexClient from "./OptionApexClient";
import OptionApexSkeleton from "./Skeleton";

export const dynamic = "force-dynamic";

async function Board() {
  try {
    const initial = await loadApex(DEFAULT_SCRIPT, DEFAULT_TF);
    return <OptionApexClient initial={initial} />;
  } catch (e) {
    // Option data has no mock fallback here for the same reason Option Clock has none:
    // an invented OI ladder or money-flux bar reads exactly like a real one and would be
    // traded on. Say what's wrong instead.
    return (
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight mb-5">Options Apex</h1>
        <div className="panel p-6">
          <p className="font-semibold mb-1">Option data unavailable</p>
          <p className="text-muted text-sm">
            The index chart or NSE&apos;s option chain could not be reached. Nothing is shown
            rather than a placeholder — it will fill in automatically once the feeds answer.
          </p>
          <p className="text-muted text-xs mt-3 font-mono">{String((e as Error).message)}</p>
        </div>
      </div>
    );
  }
}

// Non-async on purpose — see the note in ../pullback-scanner/page.tsx. This route waits on
// the index candles AND the option chain before it can render anything, which makes it the
// one most worth showing a shell for.
export default function Page() {
  return (
    <Suspense fallback={<OptionApexSkeleton />}>
      <Board />
    </Suspense>
  );
}
