import { Suspense } from "react";
import { fetchData } from "@/lib/api";
import { rangeFor, type JournalChannel, type JournalView, type RangeMode } from "@/lib/journal";
import TradeJournalClient from "./TradeJournalClient";
import TradeJournalSkeleton from "./Skeleton";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Trade Journal",
  description:
    "Every alert recorded as a position — the contract bought, the price paid, the price it exited " +
    "at, and what it made or lost after charges. Settled from the contract's own candles after the " +
    "close, so the day can be read at night instead of watched.",
};

const MODES: RangeMode[] = ["day", "week", "month", "custom"];
const CHANNELS: JournalChannel[] = ["displacement", "trend-day", "ignition"];

type Params = Record<string, string | string[] | undefined>;

/** One value out of a query string, ignoring the repeated form — none of these repeat. */
const one = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

const isDay = (v: string | undefined): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

/**
 * Opens on today, unless the URL says otherwise.
 *
 * WHY THE RANGE IS READ ON THE SERVER. The client could perfectly well parse its own location,
 * but then the first paint would be today's journal and the second would be the linked one —
 * a flash of the wrong day, and a hydration mismatch on every figure. Resolving it here means
 * the HTML that arrives is already the range that was asked for.
 *
 * With no parameters the request is left bare, exactly as before: the API defaults `from` and
 * `to` to the current IST session, and the server and the browser would otherwise disagree
 * about what "today" is whenever this box is not in IST.
 */
async function Journal({ searchParams }: { searchParams: Params }) {
  const day = one(searchParams.d);
  const mode = (MODES as string[]).includes(one(searchParams.mode) ?? "")
    ? (one(searchParams.mode) as RangeMode)
    : "day";
  const customFrom = one(searchParams.from);
  const channel = (CHANNELS as string[]).includes(one(searchParams.channel) ?? "")
    ? (one(searchParams.channel) as JournalChannel)
    : null;

  const qs = new URLSearchParams();
  if (isDay(day)) {
    const { from, to } = rangeFor(mode, day, isDay(customFrom) ? customFrom : day);
    qs.set("from", from);
    qs.set("to", to);
  }
  if (channel) qs.set("channel", channel);

  const path = qs.toString() ? `/momentum/journal?${qs}` : "/momentum/journal";
  const res = await fetchData<JournalView>(path).catch(
    (e: Error) => ({ data: null, source: undefined, error: e.message }) as const,
  );

  if (!("data" in res) || res.data === null) {
    const message = "error" in res ? res.error : "the journal API did not answer";
    return (
      <div className="space-y-4">
        <h1 className="text-[26px] sm:text-3xl font-extrabold tracking-tight">Trade Journal</h1>
        <section className="rounded-2xl border border-bear/30 bg-bear/[0.06] p-5 max-w-3xl">
          <p className="text-bear font-semibold mb-1">The journal could not load.</p>
          <p className="text-muted text-sm mb-4">{message}</p>
          <ul className="text-sm text-muted list-disc pl-5 space-y-1.5">
            <li>Is the API running on port 4100 (<code>cd api &amp;&amp; npm run dev</code>)?</li>
            <li>
              The journal is on by default. <code>JOURNAL=off</code> in <code>api/.env</code> disables
              it — check <code>journal.enabled</code> on <code>GET /momentum/status</code>.
            </li>
            <li>
              It only has rows once an alert channel has fired. Nothing is backfilled: a day the
              scanner was not running is a day with no trades, and it will stay that way.
            </li>
          </ul>
        </section>
      </div>
    );
  }

  return (
    <TradeJournalClient
      initial={res.data}
      source={res.source}
      mode={isDay(day) ? mode : "day"}
      channel={channel ?? "all"}
      customFrom={isDay(customFrom) ? customFrom : undefined}
    />
  );
}

// Non-async on purpose — see the note in ../momentum-scanner/page.tsx.
export default function Page({ searchParams }: { searchParams: Params }) {
  return (
    <Suspense fallback={<TradeJournalSkeleton />}>
      <Journal searchParams={searchParams} />
    </Suspense>
  );
}
