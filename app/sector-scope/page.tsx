import { fetchData } from "@/lib/api";
import { fmt, tvLink, heatColor } from "@/lib/format";
import { Panel, PageTitle } from "@/components/ui";
import type { SectorScope } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { data, source } = await fetchData<SectorScope>("/api_be/data/sector_scope");
  return (
    <div>
      <PageTitle source={source}>Sector Scope</PageTitle>
      <Panel>
        <div className="flex flex-wrap gap-2">
          {Object.entries(data).map(([sector, stocks]) => (
            <div key={sector} className="border border-border rounded-xl p-2 flex-1 min-w-[240px]">
              <div className="text-[11px] uppercase tracking-wider text-muted mb-1.5">{sector}</div>
              <div className="flex flex-wrap gap-1">
                {stocks.map((s) => (
                  <a key={s.Symbol} href={tvLink(s.Symbol)} target="_blank" rel="noreferrer"
                    className="rounded-md px-2 py-1.5 text-[11px] font-semibold text-white min-w-[74px]"
                    style={{ background: heatColor(s.pChange), flexGrow: Math.max(1, s.weight) }}>
                    {s.Symbol}<br /><span className="opacity-90">{fmt(s.pChange)}%</span>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted mt-3">Tile size ∝ weight, colour ∝ intraday % change (green up, red down).</p>
      </Panel>
    </div>
  );
}
