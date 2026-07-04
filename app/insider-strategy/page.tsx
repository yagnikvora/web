import { fetchData } from "@/lib/api";
import { PageTitle } from "@/components/ui";
import ScannerGrid from "@/components/ScannerGrid";
import type { ScannerGroups } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { data, source } = await fetchData<ScannerGroups>("/api_be/data/insider_stratergy");
  return (
    <div>
      <PageTitle source={source}>Insider Strategy</PageTitle>
      <p className="text-muted -mt-3 mb-5 text-sm">Nine structure-based strategies that flag where big players are building positions.</p>
      <ScannerGrid groups={data} />
    </div>
  );
}
