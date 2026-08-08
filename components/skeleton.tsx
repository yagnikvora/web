// The loading state, shared by every route's `loading.tsx`.
//
// DELIBERATELY NOT A CLIENT COMPONENT. A loading boundary that imports anything marked
// "use client" cannot paint until that chunk has been downloaded and hydrated, which is
// the exact wait it exists to hide. Everything here is plain server-rendered markup with
// one CSS class (`.sk` in globals.css) doing the shimmer, so the router can show it the
// instant the link is clicked — before the page's own JavaScript exists.
//
// It also mirrors the real geometry rather than showing a centred spinner: the same page
// title, the same card row, the same column count and the same table height. The board
// then swaps in underneath the reader's eye instead of shoving the page down.

/** One shimmering placeholder. Width and height are inline because they are per-instance. */
export function Bar({ w, h = 13, className = "" }: { w: number | string; h?: number | string; className?: string }) {
  return <span className={`sk ${className}`} style={{ width: typeof w === "number" ? `${w}px` : w, height: h }} />;
}

/** The page heading, with the route's real title — the reader has arrived, and should see so. */
export function SkeletonHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-5 flex-wrap">
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{title}</h1>
      <Bar w={74} h={20} className="rounded-full" />
      {sub && <span className="text-[12px] text-muted">{sub}</span>}
    </div>
  );
}

/** The market strip: a row of label-over-value readouts inside one panel. */
export function SkeletonStrip({ n = 7 }: { n?: number }) {
  return (
    <section className="panel p-3 sm:p-4 mb-4">
      <div className="flex flex-wrap items-center gap-x-5 sm:gap-x-8 gap-y-3 sm:gap-y-4">
        {Array.from({ length: n }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Bar w={64 + ((i * 17) % 40)} h={9} />
            <Bar w={80 + ((i * 23) % 46)} h={15} />
          </div>
        ))}
      </div>
    </section>
  );
}

/** The row of summary cards above the table. */
export function SkeletonCards({ n = 5 }: { n?: number }) {
  return (
    <div className="flex flex-wrap gap-3 mb-4">
      {Array.from({ length: n }, (_, i) => (
        <section key={i} className="panel p-3 sm:p-4 flex-1 min-w-[150px] sm:min-w-[190px]">
          <Bar w={92} h={9} className="mb-2" />
          <Bar w={64} h={26} className="mb-2" />
          <Bar w="80%" h={11} />
        </section>
      ))}
    </div>
  );
}

/**
 * The table, inside the same card shell `components/table.tsx` draws.
 *
 * The card chrome is duplicated here rather than imported because `TableCard` is a client
 * component — see the note at the top of this file. It is a header, a border and a
 * background; the cost of the copy is far below the cost of waiting for a JS chunk.
 */
export function SkeletonTable({
  title, cols = 12, rows = 9, height = 620, filters = 0, filterCols = 4, search = true,
}: {
  title: string;
  /** Column count, matched to the real board so the header does not reflow on swap. */
  cols?: number;
  rows?: number;
  height?: number;
  /** How many filter strips sit between the card header and the table. */
  filters?: number;
  /** Controls per filter strip. */
  filterCols?: number;
  /** Whether the card carries a search box on the right. */
  search?: boolean;
}) {
  return (
    <section className="rounded-[10px] border-[0.8px] border-white/30 shadow-[0_4px_6px_rgba(0,0,0,0.1)] bg-white/[0.02] px-[6px] sm:px-[10px] pb-[10px]">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-start justify-between gap-2 sm:gap-3 px-[10px] sm:px-[15px] pt-[12px]">
        <div className="min-w-0">
          <h4 className="text-[17px] sm:text-[20px] font-bold leading-[22px] sm:leading-[25px] text-muted">{title}</h4>
          <div className="mt-2">
            <Bar w={58} h={16} className="rounded-full" />
          </div>
        </div>
        {/* Classes rather than <Bar>, because Bar sets width inline and an inline style
            cannot be overridden at the sm: breakpoint. */}
        {search && <span className="sk h-10 w-full sm:w-[230px] sm:max-w-[42%] rounded-[12px]" />}
      </div>

      {Array.from({ length: filters }, (_, f) => (
        <div key={f} className="flex flex-wrap items-center gap-x-4 sm:gap-x-6 gap-y-2 px-[10px] sm:px-[15px] py-3">
          {Array.from({ length: filterCols }, (_, i) => (
            <Bar key={i} w={96 + ((i * 31) % 70)} h={28} className="rounded-lg" />
          ))}
        </div>
      ))}

      {/* Same viewport cap as the real DataTable, so the placeholder does not reserve
          740px of height that the board will then not use. */}
      <div className="overflow-hidden px-[10px] sm:px-[15px] pb-[5px]" style={{ maxHeight: `min(${height}px, 78vh)` }}>
        <div className="flex items-center gap-3 bg-[#27272a] rounded-[5px] px-[10px] py-[10px]">
          {Array.from({ length: cols }, (_, i) => (
            <Bar key={i} w={i === 0 ? 96 : 52 + ((i * 13) % 34)} h={10} />
          ))}
        </div>
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="flex items-center gap-3 px-[10px] py-[12px]">
            <span className="sk w-[25px] h-[25px] rounded-full shrink-0" />
            {Array.from({ length: cols - 1 }, (_, i) => (
              <Bar key={i} w={48 + ((r * 7 + i * 19) % 44)} h={15} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * A chart panel, matching `components/ui`'s `Panel`: a heading, an optional control
 * cluster on the right, and a block standing in for the canvas.
 *
 * Charts are the one place the placeholder is worth more than usual. ECharts is loaded
 * lazily and paints nothing until its own chunk arrives, so without this the panel is an
 * empty box for longer than the data takes — the height here is the chart's own, which
 * keeps everything below it from jumping once the canvas mounts.
 */
export function SkeletonPanel({
  title, height, controls = 0, className = "", children,
}: {
  title?: string;
  /** The chart's height, taken from the real panel — px, or the CSS length it clamps to. */
  height?: number | string;
  controls?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className={`panel p-3 sm:p-4 ${className}`}>
      <header className="flex items-center gap-2 mb-3">
        {title && <h2 className="text-[15px] font-semibold text-muted">{title}</h2>}
        <Bar w={44} h={16} className="rounded-full" />
        {controls > 0 && (
          <div className="ml-auto flex items-center gap-1.5">
            {Array.from({ length: controls }, (_, i) => (
              <Bar key={i} w={58} h={24} className="rounded-md" />
            ))}
          </div>
        )}
      </header>
      {height != null && <Bar w="100%" h={height} className="rounded-xl" />}
      {children}
    </section>
  );
}

/**
 * A single-symbol page: the back link, the heading, the readout row and the chart.
 *
 * The symbol itself is not known here — a loading boundary is rendered before the segment's
 * params are resolved on the client — so the heading is a placeholder rather than a guess.
 */
export function SkeletonDetail({ back, chart = "clamp(320px, 52vh, 520px)" }: { back: string; chart?: number | string }) {
  return (
    <main className="px-0 py-1 sm:p-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <Bar w={150} h={13} className="mb-3" />
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <Bar w={210} h={30} />
        <Bar w={74} h={20} className="rounded-full" />
      </div>

      <section className="panel p-4 mb-4">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Bar w={70 + ((i * 19) % 36)} h={9} />
              <Bar w={96 + ((i * 27) % 40)} h={16} />
            </div>
          ))}
        </div>
      </section>

      <section className="panel p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Bar key={i} w={56} h={28} className="rounded-lg" />
          ))}
        </div>
        <Bar w="100%" h={chart} className="rounded-xl" />
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {Array.from({ length: 2 }, (_, i) => (
          <section key={i} className="panel p-4">
            <Bar w={140} h={13} className="mb-3" />
            {Array.from({ length: 5 }, (_, j) => (
              <Bar key={j} w={`${88 - j * 9}%`} h={13} className="mb-2" />
            ))}
          </section>
        ))}
      </div>

      <p className="text-[12px] text-muted mt-4">Back to {back}…</p>
    </main>
  );
}

/**
 * A whole scanner page: heading, strip, cards, table. The three scanner routes differ only
 * in their numbers, so they pass those rather than each rebuilding the arrangement.
 */
export function SkeletonBoard({
  title, strip = 7, cards = 5, table, cols = 14, rows = 9, height = 620, filters = 2,
}: {
  title: string;
  strip?: number;
  cards?: number;
  table: string;
  cols?: number;
  rows?: number;
  height?: number;
  filters?: number;
}) {
  return (
    <main className="px-0 py-1 sm:p-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading {title}…</span>
      <SkeletonHead title={title} />
      {strip > 0 && <SkeletonStrip n={strip} />}
      {cards > 0 && <SkeletonCards n={cards} />}
      <SkeletonTable title={table} cols={cols} rows={rows} height={height} filters={filters} />
    </main>
  );
}
