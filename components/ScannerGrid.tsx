import { fmt, signCls, tvLink, titleCase } from "@/lib/format";
import { Panel, Pill } from "@/components/ui";
import type { ScannerGroups } from "@/lib/types";

export default function ScannerGrid({ groups }: { groups: ScannerGroups }) {
  return (
    <div className="grid gap-4 grid-cols-1 xl:grid-cols-2">
      {Object.entries(groups).map(([key, rows]) => {
        const hasSignal = rows.some((r) => r.signal);
        const hasPrice = rows.some((r) => r.price > 0);
        return (
          <Panel key={key} title={titleCase(key)} badge="live">
            <div className="max-h-[380px] overflow-auto">
              <table className="w-full text-[13px]">
                <thead className="sticky top-0 bg-panel">
                  <tr className="text-left text-muted">
                    <th className="px-2 py-1.5 border-b border-border font-semibold">Symbol</th>
                    <th className="px-2 py-1.5 border-b border-border font-semibold">%</th>
                    {hasPrice && <th className="px-2 py-1.5 border-b border-border font-semibold">Price</th>}
                    <th className="px-2 py-1.5 border-b border-border font-semibold">When</th>
                    {hasSignal && <th className="px-2 py-1.5 border-b border-border font-semibold">Signal</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="hover:bg-[#0e1420]">
                      <td className="px-2 py-1.5 border-b border-[#161d28]">
                        <a href={tvLink(r.Symbol)} target="_blank" rel="noreferrer" className="font-semibold hover:text-accent">{r.Symbol}</a>
                      </td>
                      <td className={`px-2 py-1.5 border-b border-[#161d28] ${signCls(r.pChange)}`}>{fmt(r.pChange)}</td>
                      {hasPrice && <td className="px-2 py-1.5 border-b border-[#161d28] text-muted">{r.price ? fmt(r.price, 1) : "—"}</td>}
                      <td className="px-2 py-1.5 border-b border-[#161d28] text-muted text-xs">{r.when}</td>
                      {hasSignal && <td className="px-2 py-1.5 border-b border-[#161d28]">{r.signal ? <Pill signal={r.signal} /> : "—"}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        );
      })}
    </div>
  );
}
