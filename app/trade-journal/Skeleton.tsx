import { Bar } from "@/components/skeleton";

// The heading and the standing copy are the same on every load, so they are rendered for real
// rather than shimmered — the same call Trend Day's skeleton makes. What is genuinely unknown is
// the headline, the curve, the ratios and the day's rows, and only those are placeheld.
//
// The geometry mirrors the real page closely enough that nothing jumps on the swap: the hero is
// the hero's height, there are eight ratio tiles because there are eight, and the analysis row
// splits at xl exactly where the real one does.
export default function TradeJournalSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the trade journal…</span>

      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h1 className="text-[26px] sm:text-3xl font-extrabold tracking-tight">Trade Journal</h1>
          <p className="text-muted text-[12.5px] mt-1 max-w-3xl leading-relaxed">
            Every alert this app sent, recorded as a position and settled from the contract&apos;s own
            1-minute candles after the close.
          </p>
        </div>
        <div className="ml-auto"><Bar w={84} h={20} className="rounded-full" /></div>
      </div>

      {/* the control bar */}
      <div className="-mx-3 sm:-mx-5 px-3 sm:px-5 py-2.5 border-y border-border flex flex-wrap items-center gap-3">
        <Bar w={196} h={32} className="rounded-lg" />
        <Bar w={244} h={32} className="rounded-xl" />
        <Bar w={286} h={32} className="rounded-xl" />
        <div className="ml-auto"><Bar w={188} h={32} className="rounded-xl" /></div>
      </div>

      {/* the hero */}
      <section className="rounded-2xl border border-border bg-panel p-5 grid lg:grid-cols-2 gap-5">
        <div>
          <Bar w={132} h={10} />
          <div className="mt-3"><Bar w={252} h={44} className="rounded-lg" /></div>
          <div className="mt-3"><Bar w="70%" h={11} /></div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="rounded-xl bg-black/20 border border-border/70 px-3 py-2 space-y-2">
                <Bar w={54} h={8} />
                <Bar w={64} h={16} />
                <Bar w={72} h={8} />
              </div>
            ))}
          </div>
        </div>
        <div>
          <Bar w={104} h={10} />
          <div className="mt-2"><Bar w="100%" h={148} className="rounded-xl" /></div>
        </div>
      </section>

      {/* the ratios */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-panel p-3.5 space-y-2">
            <Bar w={78} h={9} />
            <Bar w={104} h={20} />
            <Bar w={90} h={10} />
          </div>
        ))}
      </div>

      {/* the analysis */}
      <div className="grid xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)] gap-4 items-start">
        <section className="rounded-2xl border border-border bg-panel p-4">
          <div className="flex items-center gap-3 mb-3.5">
            <div className="space-y-1.5">
              <Bar w={96} h={12} />
              <Bar w={168} h={10} />
            </div>
            <div className="ml-auto"><Bar w={186} h={26} className="rounded-xl" /></div>
          </div>
          <Bar w="100%" h="clamp(240px, 38vh, 420px)" className="rounded-xl" />
        </section>
        <div className="space-y-4">
          {Array.from({ length: 3 }, (_, i) => (
            <section key={i} className="rounded-2xl border border-border bg-panel p-4 space-y-3">
              <Bar w={128} h={12} />
              {Array.from({ length: 3 }, (_, j) => (
                <Bar key={j} w={`${94 - j * 8}%`} h={i === 0 ? 42 : 14} className="rounded-lg" />
              ))}
            </section>
          ))}
        </div>
      </div>

      {/* one day of rows */}
      <section className="rounded-2xl border border-border bg-panel overflow-hidden">
        <div className="flex items-center gap-4 px-4 sm:px-5 py-3.5 border-b border-border bg-black/20">
          <Bar w={112} h={17} />
          <Bar w={86} h={11} />
          <div className="ml-auto"><Bar w={104} h={18} /></div>
        </div>
        <div className="px-[10px] sm:px-[15px] py-3">
          <div className="flex items-center gap-3 bg-[#27272a] rounded-[5px] px-[10px] py-[10px]">
            {Array.from({ length: 11 }, (_, i) => (
              <Bar key={i} w={i === 0 ? 96 : 52 + ((i * 13) % 34)} h={10} />
            ))}
          </div>
          {Array.from({ length: 4 }, (_, r) => (
            <div key={r} className="flex items-center gap-3 px-[10px] py-[12px]">
              <span className="sk w-[26px] h-[26px] rounded-full shrink-0" />
              {Array.from({ length: 10 }, (_, i) => (
                <Bar key={i} w={48 + ((r * 7 + i * 19) % 44)} h={15} />
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
