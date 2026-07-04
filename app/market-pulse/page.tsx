import { fetchData } from "@/lib/api";
import { fmt, signCls, tvLink, timeOf } from "@/lib/format";
import { Panel, Pill, PageTitle } from "@/components/ui";
import type { MarketPulse } from "@/lib/types";

export const dynamic = "force-dynamic";

const Sym = ({ s }: { s: string }) => (
  <a href={tvLink(s)} target="_blank" rel="noreferrer" className="font-semibold hover:text-accent">{s}</a>
);

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="max-h-[420px] overflow-auto">
      <table className="w-full text-[13px]">
        <thead className="sticky top-0 bg-panel">
          <tr>{head.map((h) => <th key={h} className="text-left text-muted font-semibold px-2 py-1.5 border-b border-border">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-[#0e1420]">
              {r.map((c, j) => <td key={j} className="px-2 py-1.5 border-b border-[#161d28]">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function Page() {
  const { data, source } = await fetchData<MarketPulse>("/api_be/data/market_pulse");
  return (
    <div>
      <PageTitle source={source}>Market Pulse</PageTitle>
      <div className="grid gap-4 grid-cols-1 xl:grid-cols-2">
        <Panel title="Breakout Beacon" badge="live">
          <Table head={["Signal", "Symbol", "%", "Signal %", "Time"]}
            rows={data.breakout_beacon.map((r) => [
              <Pill key="s" signal={r.signal} />, <Sym key="y" s={r.Symbol} />,
              <span key="p" className={signCls(r.pChange)}>{fmt(r.pChange)}</span>,
              fmt(r.signalPct), timeOf(r.ts),
            ])} />
        </Panel>

        <Panel title="Intraday Boost" badge="live">
          <Table head={["Symbol", "%", "R.Fac", "Signal"]}
            rows={data.intraday_boost.map((r) => [
              <Sym key="y" s={r.Symbol} />, <span key="p" className={signCls(r.pChange)}>{fmt(r.pChange)}</span>,
              fmt(r.rFactor), <Pill key="s" signal={r.pChange >= 0 ? "BULL" : "BEAR"} />,
            ])} />
        </Panel>

        <Panel title="Top Gainers" badge="live">
          <Table head={["Symbol", "%", "R.Fac"]}
            rows={data.top_gainers.map((r) => [<Sym key="y" s={r.Symbol} />, <span key="p" className="text-bull">{fmt(r.pChange)}</span>, fmt(r.rFactor)])} />
        </Panel>

        <Panel title="Top Losers" badge="live">
          <Table head={["Symbol", "%", "R.Fac"]}
            rows={data.top_losers.map((r) => [<Sym key="y" s={r.Symbol} />, <span key="p" className="text-bear">{fmt(r.pChange)}</span>, fmt(r.rFactor)])} />
        </Panel>

        <Panel title="High Power Stocks" badge="live">
          <Table head={["Symbol", "%", "T.O. (₹Cr)"]}
            rows={data.high_powered_stocks.map((r) => [<Sym key="y" s={r.Symbol} />, <span key="p" className={signCls(r.pChange)}>{fmt(r.pChange)}</span>, fmt(r.turnover, 1)])} />
        </Panel>

        <Panel title="Top / Low Level Stocks" badge="live">
          <Table head={["Symbol", "%", "Diff", "Symbol", "%", "Diff"]}
            rows={data.top_level_stocks.map((r, i) => {
              const lo = data.low_level_stocks[i];
              return [
                <Sym key="y" s={r.Symbol} />, <span key="p" className={signCls(r.pChange)}>{fmt(r.pChange)}</span>, fmt(r.diff, 2),
                lo ? <Sym key="y2" s={lo.Symbol} /> : "", lo ? <span key="p2" className={signCls(lo.pChange)}>{fmt(lo.pChange)}</span> : "", lo ? fmt(lo.diff, 2) : "",
              ];
            })} />
        </Panel>
      </div>
    </div>
  );
}
