import Link from "next/link";

const CARDS: { title: string; desc: string; href: string; tag: string }[] = [
  { title: "Market Pulse", desc: "Real-time momentum, breakout & power scanners for F&O stocks.", href: "/market-pulse", tag: "Stocks" },
  { title: "Insider Strategy", desc: "Structure-based signals — contraction breakout, momentum spikes, LOM.", href: "/insider-strategy", tag: "Stocks" },
  { title: "Sector Scope", desc: "Sector + stock heatmap treemap weighted by strength.", href: "/sector-scope", tag: "Stocks" },
  { title: "Swing Spectrum", desc: "10/50-day breakout, channel, NR7 & reversal swing scanners.", href: "/swing-spectrum", tag: "Stocks" },
  { title: "Option Clock", desc: "Live OI per strike, PCR, and net position build-up.", href: "/option-clock", tag: "Index" },
  { title: "Option Apex", desc: "Index chart, sentiment & PCR dials, and Money Flux.", href: "/option-apex", tag: "Index" },
  { title: "Index Mover", desc: "Which stocks are driving the index up or down, point by point.", href: "/index-mover", tag: "Index" },
  { title: "FII / DII", desc: "Daily institutional cash-market buy / sell / net flows.", href: "/fii-dii", tag: "Index" },
];

export default function Home() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight">Find the best trades.</h1>
        <p className="text-muted mt-2 max-w-2xl">
          A real-time market-analysis workspace for NSE stocks, indices and F&amp;O — momentum scanners,
          option-OI analytics, sector heatmaps and institutional flows, all in one place.
        </p>
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {CARDS.map((c) => (
          <Link key={c.href} href={c.href}
            className="panel p-5 hover:border-accent/60 transition-colors group">
            <div className="text-[11px] uppercase tracking-widest text-muted">{c.tag}</div>
            <div className="text-lg font-bold mt-1 group-hover:text-accent transition-colors">{c.title}</div>
            <p className="text-sm text-muted mt-2 leading-relaxed">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
