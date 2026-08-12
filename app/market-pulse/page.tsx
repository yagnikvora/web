import { Suspense } from "react";
import { fetchData } from "@/lib/api";
import type { MarketPulse, SectorScope } from "@/lib/types";
import MarketPulseClient from "./MarketPulseClient";
import MarketPulseSkeleton from "./Skeleton";

export const dynamic = "force-dynamic";

async function Board() {
  // Sector Scope is what the sector filter is built from — which baskets a stock belongs to
  // and how strong each one is. It is fetched alongside rather than in series, and its
  // failure is not fatal: Market Pulse's own data is the page, and a missing sector payload
  // costs the filter its options, not the tables.
  const [pulse, sectors] = await Promise.all([
    fetchData<MarketPulse>("/api_be/data/market_pulse"),
    fetchData<SectorScope>("/api_be/data/sector_scope").catch(() => ({ data: {} as SectorScope })),
  ]);

  return <MarketPulseClient data={pulse.data} sectors={sectors.data} />;
}

// Non-async on purpose: the two fetches sit behind the Suspense boundary so the shell
// flushes immediately and the skeleton paints while they are still in flight. See the
// longer note in ../momentum-scanner/page.tsx.
export default function Page() {
  return (
    <Suspense fallback={<MarketPulseSkeleton />}>
      <Board />
    </Suspense>
  );
}
