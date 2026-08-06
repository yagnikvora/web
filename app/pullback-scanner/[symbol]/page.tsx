import Link from "next/link";
import { fetchData } from "@/lib/api";
import { TIMEFRAMES, DEFAULT_CHART_TIMEFRAME, type PullbackDetail, type Timeframe } from "@/lib/pullback";
import DetailClient from "./DetailClient";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: { symbol: string } }) {
  const symbol = decodeURIComponent(params.symbol).toUpperCase();
  return {
    title: `${symbol} — EMA Pullback`,
    description: `9/20 EMA pullback analysis for ${symbol}: trend checklist, retracement into the EMA/VWAP zone, confirmation candle, stop, targets and the option contract.`,
  };
}

export default async function Page({
  params, searchParams,
}: {
  params: { symbol: string };
  searchParams: { timeframe?: string };
}) {
  const symbol = decodeURIComponent(params.symbol).toUpperCase();
  const wanted = Number(searchParams.timeframe);
  const tf: Timeframe = TIMEFRAMES.includes(wanted as Timeframe) ? (wanted as Timeframe) : DEFAULT_CHART_TIMEFRAME;

  const detail = await fetchData<PullbackDetail>(
    `/pullback/${encodeURIComponent(symbol)}?timeframe=${tf}`,
  ).catch((e: Error) => ({ data: null, source: undefined, error: e.message }) as const);

  if (!("data" in detail) || detail.data === null) {
    const message = "error" in detail ? detail.error : "the pullback API did not answer";
    return (
      <main className="p-5">
        <h1 className="text-3xl font-extrabold tracking-tight mb-4">{symbol}</h1>
        <div className="panel p-5 max-w-3xl">
          <p className="text-bear font-semibold mb-2">This symbol could not be loaded.</p>
          <p className="text-muted text-sm mb-4">{message}</p>
          <p className="text-sm text-muted">
            It has to be an F&amp;O stock or one of the configured index underlyings, and it must be above the
            configured price and turnover floors.
          </p>
          <Link href="/pullback-scanner" className="text-accent text-sm hover:underline mt-4 inline-block">
            ← Back to the scanner
          </Link>
        </div>
      </main>
    );
  }

  return <DetailClient initial={detail.data} source={detail.source} />;
}
