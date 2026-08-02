import { fetchData } from "@/lib/api";
import type { MarketPulse, SectorScope } from "@/lib/types";
import MarketPulseClient from "./MarketPulseClient";

export const dynamic = "force-dynamic";

export default async function Page() {
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
