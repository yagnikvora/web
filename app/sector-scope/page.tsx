import { Suspense } from "react";
import { fetchData } from "@/lib/api";
import type { SectorScope } from "@/lib/types";
import SectorScopeClient from "./SectorScopeClient";
import SectorScopeSkeleton from "./Skeleton";

export const dynamic = "force-dynamic";

async function Board() {
  const { data } = await fetchData<SectorScope>("/api_be/data/sector_scope");
  return <SectorScopeClient data={data} />;
}

// Non-async on purpose — see the note in ../momentum-scanner/page.tsx.
export default function Page() {
  return (
    <Suspense fallback={<SectorScopeSkeleton />}>
      <Board />
    </Suspense>
  );
}
