"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { BRAND, moduleLabel } from "@/lib/brand";
import { isMarketOpen, REFRESH_MS } from "@/lib/live";
import { Bullish, Bearish, SymbolAvatar } from "@/components/icons";
import type { HeadlineIndex, MoverRow, Overview } from "@/lib/overview";

// Labels come from lib/brand.ts; the longer copy lives here because it is marketing prose
// for the card, not the one-line tooltip the nav needs.
const CARDS: { href: string; tag: string; desc: string }[] = [
  { href: "/market-pulse", tag: "Stocks", desc: "Real-time momentum, breakout & power scanners for F&O stocks." },
  { href: "/sector-scope", tag: "Stocks", desc: "Sector + stock heatmap treemap weighted by strength." },
  { href: "/option-clock", tag: "Index", desc: "Live OI per strike, PCR trend, and net position build-up." },
  { href: "/option-apex", tag: "Index", desc: "Index chart, sentiment & PCR dials, and Money Flux." },
];

const inr = (n: number, d = 2) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });

/* ------------------------------------------------------------------ sparkline --- */

/**
 * The session's shape in 120×34.
 *
 * Scaled to its own min/max rather than a fixed range, because an index that moved 0.2%
 * would otherwise render as a flat line — the point of the strip is the shape of the day,
 * not its magnitude, which the number beside it already gives.
 */
function Spark({ points, up }: { points: number[]; up: boolean }) {
  // Gradient ids must be unique in the document — four cards sharing one id is invalid
  // HTML, and the first definition would win for all of them.
  const id = useId();
  if (points.length < 2) return <div className="h-[34px]" />;
  const lo = Math.min(...points), hi = Math.max(...points);
  const span = hi - lo || 1;
  const W = 120, H = 34;
  const xy = points.map((p, i) => [
    (i / (points.length - 1)) * W,
    H - ((p - lo) / span) * (H - 4) - 2,
  ] as const);
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L ${W} ${H} L 0 ${H} Z`;
  const stroke = up ? "#2ec76a" : "#e5484d";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-[120px] h-[34px] shrink-0" preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity={0.28} />
          <stop offset="100%" stopColor={stroke} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={stroke} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* ------------------------------------------------------------- index cards --- */

function IndexCard({ x }: { x: HeadlineIndex }) {
  const up = x.pct >= 0;
  // Where the close sits inside the day's range — the little marker under the numbers.
  const span = x.dayHigh - x.dayLow;
  const at = span > 0 ? ((x.last - x.dayLow) / span) * 100 : 50;

  return (
    <div className="panel p-4 hover:border-accent/40 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-widest text-muted">{x.label}</div>
          <div className="text-[22px] font-extrabold tabular-nums mt-0.5">{inr(x.last)}</div>
          <div className={`text-[13px] font-semibold tabular-nums ${up ? "text-bull" : "text-bear"}`}>
            {up ? "+" : ""}{inr(x.points)} ({up ? "+" : ""}{x.pct.toFixed(2)}%)
          </div>
        </div>
        <Spark points={x.spark} up={up} />
      </div>

      <div className="mt-3">
        <div className="relative h-[3px] rounded-full bg-chip">
          <span className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[7px] h-[7px] rounded-full ring-2 ring-panel"
            style={{ left: `${at}%`, background: up ? "#2ec76a" : "#e5484d" }} />
        </div>
        <div className="flex justify-between text-[10px] text-muted mt-1 tabular-nums">
          <span>L {inr(x.dayLow)}</span>
          <span>O {inr(x.open)}</span>
          <span>H {inr(x.dayHigh)}</span>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- movers --- */

function MoverList({ title, rows, kind }: { title: string; rows: MoverRow[]; kind: "gain" | "lose" | "active" }) {
  return (
    <section className="panel p-4">
      <header className="flex items-center gap-2 mb-3">
        <h2 className="text-[13px] font-bold uppercase tracking-widest text-muted">{title}</h2>
        {kind === "gain" && <Bullish className="w-[15px] h-[15px] text-bull" />}
        {kind === "lose" && <Bearish className="w-[15px] h-[15px] text-bear" />}
      </header>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.Symbol} className="flex items-center gap-2 text-[13px]">
            <SymbolAvatar symbol={r.Symbol} className="w-[22px] h-[22px] text-[9px]" />
            <span className="font-semibold truncate">{r.Symbol}</span>
            <span className="ml-auto tabular-nums text-muted">{inr(r.ltp)}</span>
            <span className={`w-[64px] text-right tabular-nums font-semibold ${r.pChange >= 0 ? "text-bull" : "text-bear"}`}>
              {kind === "active" ? `${inr(r.turnover, 0)} Cr` : `${r.pChange >= 0 ? "+" : ""}${r.pChange.toFixed(2)}%`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------- page --- */

export default function HomeClient({ initial }: { initial: Overview }) {
  const [d, setD] = useState(initial);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    setOpen(isMarketOpen());
    const poll = async () => {
      const o = isMarketOpen();
      setOpen(o);
      if (!o) return; // nothing upstream changes outside trading hours
      try {
        const res = await fetch("/api/overview", { cache: "no-store" });
        const j = await res.json();
        if (alive && j?.data) setD(j.data as Overview);
      } catch { /* keep the last good snapshot */ }
    };
    const id = setInterval(poll, REFRESH_MS);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const { breadth } = d;
  const upPct = breadth.total ? (breadth.advances / breadth.total) * 100 : 50;

  return (
    <div>
      {/* --------------------------------------------------------- hero --- */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-panel mb-5">
        {/* A soft wash behind the emblem, so the logo reads as lit rather than pasted on.
            It sits under the artwork deliberately — the glow is what ties the two together. */}
        <div aria-hidden className="pointer-events-none absolute -top-28 right-0 w-[520px] h-[520px] rounded-full opacity-[0.13]"
          style={{ background: "radial-gradient(circle, #4c8dff 0%, transparent 62%)" }} />

        <div className="relative grid lg:grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <div className="px-6 py-8 sm:px-9 sm:py-10">
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              open ? "bg-emerald-500/15 text-emerald-400" : "bg-white/10 text-muted"}`}>
              {open ? "● MARKET OPEN" : "● MARKET CLOSED"}
            </span>
            <span className="text-[11px] text-muted">
              {open ? "Live from Upstox" : `Showing the ${d.day} session`}
            </span>
          </div>
          <h1 className="text-3xl sm:text-[42px] font-extrabold tracking-tight leading-[1.1]">
            {BRAND.tagline}
          </h1>
          <p className="text-muted mt-3 max-w-2xl leading-relaxed">{BRAND.description}</p>

          {/* Breadth: the one number that says what kind of day it is. */}
          <div className="mt-6 max-w-md">
            <div className="flex items-baseline justify-between text-[11px] mb-1.5">
              <span className="text-bull font-semibold">{breadth.advances} advancing</span>
              <span className="text-muted uppercase tracking-widest">F&amp;O breadth</span>
              <span className="text-bear font-semibold">{breadth.declines} declining</span>
            </div>
            <div className="flex h-[6px] rounded-full overflow-hidden bg-chip">
              <div className="bg-bull" style={{ width: `${upPct}%` }} />
              <div className="bg-bear" style={{ width: `${100 - upPct}%` }} />
            </div>
          </div>
          </div>

          {/* The full logo, filling what was dead space on the right.
              No blend mode or mask: the artwork is genuinely transparent, so it composites
              on the panel by itself. (An earlier revision of this file had an opaque
              near-black backing and needed `mix-blend-mode: screen` to hide the tile —
              applying that to transparent art only washes out its soft edges.) */}
          <div className="hidden lg:block relative pr-4 xl:pr-8 shrink-0">
            <Image
              src="/images/Trinetra.png"
              alt={`${BRAND.name} — ${BRAND.tagline}`}
              // The RENDERED size, not the file's 1254px — Next builds its srcset from this
              // prop, and the intrinsic width made it request a 3840px asset for a 340px
              // slot. No `sizes` either: with one, Next emits a device-width srcset and
              // falls back to w=3840 in `src`; without it, a fixed-size image gets a plain
              // 1x/2x srcset, which is what this actually needs. Measured end result is
              // ~11 kB of WebP against the 1.1 MB source.
              width={380}
              height={380}
              priority
              className="w-[280px] xl:w-[340px] h-auto select-none"
            />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- index cards --- */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 mb-5">
        {d.headline.map((x) => <IndexCard key={x.name} x={x} />)}
      </div>

      {/* ----------------------------------------------------- movers --- */}
      <div className="grid gap-3 grid-cols-1 lg:grid-cols-3 mb-6">
        <MoverList title="Top Gainers" rows={d.gainers} kind="gain" />
        <MoverList title="Top Losers" rows={d.losers} kind="lose" />
        <MoverList title="Most Active by Value" rows={d.active} kind="active" />
      </div>

      {/* ---------------------------------------------------- modules --- */}
      <h2 className="text-[13px] font-bold uppercase tracking-widest text-muted mb-3">Workspace</h2>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {CARDS.map((c) => (
          <Link key={c.href} href={c.href}
            className="panel p-5 hover:border-accent/60 transition-colors group">
            <div className="text-[11px] uppercase tracking-widest text-muted">{c.tag}</div>
            <div className="text-lg font-bold mt-1 group-hover:text-accent transition-colors">
              {moduleLabel(c.href)}
            </div>
            <p className="text-sm text-muted mt-2 leading-relaxed">{c.desc}</p>
          </Link>
        ))}
      </div>

      <p className="text-[11px] text-muted/70 mt-8">
        {d.vix && <>India VIX {inr(d.vix.last)} ({d.vix.pct >= 0 ? "+" : ""}{d.vix.pct.toFixed(2)}%) · </>}
        {breadth.total} F&amp;O stocks tracked · quotes and option data from Upstox ·
        {" "}{d.day} session. Analysis only, not investment advice.
      </p>
    </div>
  );
}
