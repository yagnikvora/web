import { Bar } from "@/components/skeleton";

// The PCR table's headings are fixed copy, so they are drawn for real — only the readings
// underneath are unknown.
const PCR_HEADS = ["Time", "PCR", "Change", "Bulls OI (PE)", "Bears OI (CE)"];

// A copy of `TH_CLASS` from components/table, NOT an import of it. That module is marked
// "use client", and importing anything from it here — even a string — would make this
// loading boundary depend on a client chunk it would then have to wait for.
const TH =
  "sticky top-0 z-10 bg-[#27272a] text-[#a1a1aa] text-[12.5px] leading-[10px] font-semibold text-left px-[10px] py-[10px] whitespace-nowrap select-none first:rounded-l-[5px] last:rounded-r-[5px]";

export default function OptionClockSkeleton() {
  return (
    <div className="min-h-screen" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading Option Clock…</span>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
        <h1 className="text-2xl sm:text-[32px] font-extrabold leading-tight sm:leading-[44px]">Option Clock</h1>
        <Bar w={54} h={18} className="rounded-full" />
        <Bar w={132} h={20} className="rounded-full" />
        <div className="w-full sm:w-auto sm:ml-auto flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Day, Index and Expiry — three dropdowns, and the widths they settle at. */}
          {[150, 132, 172].map((w) => (
            <Bar key={w} w={w} h={36} className="rounded-lg" />
          ))}
        </div>
      </div>

      <section className="panel px-3 sm:px-5 py-4 mb-4">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3">
          <h2 className="text-[19px] sm:text-[22px] font-bold text-muted">PCR Trend</h2>
          <Bar w={190} h={13} />
        </header>
        <div className="max-h-[420px] overflow-hidden">
          <table className="w-full table-auto border-separate border-spacing-0">
            <thead>
              <tr>{PCR_HEADS.map((h) => <th key={h} className={TH}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }, (_, r) => (
                <tr key={r}>
                  {PCR_HEADS.map((h, c) => (
                    <td key={h} className="px-[10px] py-[12px]">
                      <Bar w={c === 0 ? 56 : 74 + ((r * 11 + c * 17) % 40)} h={15} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* The three charts, at the heights OptionClockClient gives them: 620 for the clock,
          240 and 210 for the two on the right. */}
      <div className="panel p-3 sm:p-5 grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 xl:border-r xl:border-white/10 xl:pr-6">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-[15px] font-semibold text-muted">OI Clock</h2>
            <Bar w={100} h={16} className="ml-auto" />
          </div>
          <Bar w="100%" h="clamp(360px, 62vh, 620px)" className="rounded-xl" />
          <Bar w={280} h={12} className="mt-2" />
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-[15px] font-semibold text-muted mb-3">Net Position</h2>
            <Bar w="100%" h={240} className="rounded-xl" />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-muted mb-3">Distribution</h2>
            <Bar w="100%" h={210} className="rounded-xl" />
            <div className="flex justify-center gap-4 mt-2">
              <Bar w={140} h={54} className="rounded-xl" />
              <Bar w={140} h={54} className="rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
