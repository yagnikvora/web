import { fetchData } from "@/lib/api";
import type { SectorScope } from "@/lib/types";
import SectorScopeClient from "./SectorScopeClient";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { data } = await fetchData<SectorScope>("/api_be/data/sector_scope");
  return <SectorScopeClient data={data} />;
}
