import { fetchData } from "@/lib/api";
import type { MarketPulse } from "@/lib/types";
import MarketPulseClient from "./MarketPulseClient";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { data } = await fetchData<MarketPulse>("/api_be/data/market_pulse");
  return <MarketPulseClient data={data} />;
}
