import { Suspense } from "react";
import Link from "next/link";
import { fetchData } from "@/lib/api";
import { SkeletonDetail } from "@/components/skeleton";
import type { MomentumDetail } from "@/lib/momentum";
import DetailClient from "./DetailClient";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: { symbol: string } }) {
  const symbol = decodeURIComponent(params.symbol).toUpperCase();
  return {
    title: `${symbol} — Momentum breakdown`,
    description: `Every factor behind ${symbol}'s momentum score: relative volume, VWAP, relative strength, option OI build-up, Greeks, implied volatility and trend structure.`,
  };
}

async function Detail({ symbol }: { symbol: string }) {
  const res = await fetchData<MomentumDetail>(`/momentum/${encodeURIComponent(symbol)}`).catch(
    (e: Error) => ({ data: null, source: undefined, error: e.message }) as const,
  );

  if (res.data === null) {
    // A 404 here is a normal outcome, not a fault: the stock may sit below the configured
    // price or turnover floor, or below minCoverage. Saying which saves a support round trip.
    return (
      <main className="p-5">
        <Link href="/momentum-scanner" className="text-[13px] text-accent hover:underline">← Momentum Scanner</Link>
        <h1 className="text-3xl font-extrabold tracking-tight mt-3 mb-4">{symbol}</h1>
        <div className="panel p-5 max-w-2xl">
          <p className="text-bear font-semibold mb-2">{symbol} is not on the current board.</p>
          <p className="text-muted text-sm mb-3">{"error" in res ? res.error : "no detail returned"}</p>
          <ul className="text-sm text-muted list-disc pl-5 space-y-1">
            <li>It may be outside the 208-stock NSE F&amp;O universe.</li>
            <li>It may be under the configured minimum price or turnover.</li>
            <li>Too few of its factors may have been computable to publish a score.</li>
          </ul>
        </div>
      </main>
    );
  }

  return <DetailClient initial={res.data} source={res.source} symbol={symbol} />;
}

// Non-async so the shell flushes before the per-symbol fetch. See ../page.tsx.
export default function Page({ params }: { params: { symbol: string } }) {
  const symbol = decodeURIComponent(params.symbol).toUpperCase();

  return (
    // Keyed on the symbol so moving between two stocks re-suspends rather than leaving the
    // previous one's breakdown on screen while the new one loads.
    <Suspense key={symbol} fallback={<SkeletonDetail back="the momentum scanner" />}>
      <Detail symbol={symbol} />
    </Suspense>
  );
}
