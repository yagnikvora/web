import { fetchData } from "@/lib/api";
import { PageTitle } from "@/components/ui";
import ScannerGrid from "@/components/ScannerGrid";
import type { ScannerGroups } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { data, source } = await fetchData<ScannerGroups>("/api_be/data/swing_spectrum");
  return (
    <div>
      <PageTitle source={source}>Swing Spectrum</PageTitle>
      <p className="text-muted -mt-3 mb-5 text-sm">Breakout, channel, NR7 and reversal scanners for multi-day swing setups.</p>
      <ScannerGrid groups={data} />
    </div>
  );
}
