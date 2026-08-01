// Inline SVG icons.
//
// These replace images that were hotlinked from another company's CDN — an outage or a
// path change on their side would have broken this app's UI, and they were not ours to
// serve. Inline SVG is also simply better here: no extra requests, crisp at any size, and
// each one takes `currentColor` so it follows the surrounding text instead of being a
// baked-in colour that only suits one theme.
//
// Company logos are deliberately NOT here. Per-symbol brand marks for ~200 issuers are
// not licensable in bulk, so `SymbolAvatar` draws initials instead — which is what the old
// code already fell back to whenever a logo 404'd.

import type { ReactNode } from 'react';

type IconProps = { className?: string; title?: string };

const svg = (children: ReactNode, { className = 'w-4 h-4', title }: IconProps, box = 24) => (
  <svg viewBox={`0 0 ${box} ${box}`} className={className} fill="none"
    stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
    aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
    {title && <title>{title}</title>}
    {children}
  </svg>
);

/** Hint marker — the "what am I looking at" affordance beside a panel heading. */
export const Bulb = (p: IconProps) => svg(
  <>
    <path d="M9 18h6M10 21h4" />
    <path d="M12 3a6 6 0 0 0-3.5 10.9c.5.4.8 1 .8 1.6V16h5.4v-.5c0-.6.3-1.2.8-1.6A6 6 0 0 0 12 3Z" />
  </>, p);

/** "How to use" — links to a walkthrough. */
export const Play = (p: IconProps) => svg(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M10 8.5l6 3.5-6 3.5v-7Z" fill="currentColor" stroke="none" />
  </>, p);

/** Add to watchlist. */
export const Bookmark = (p: IconProps) => svg(
  <path d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1Z" />, p);

/** Open this symbol on an external chart. */
export const ChartLink = (p: IconProps) => svg(
  <>
    <path d="M4 20V10M9 20V5M14 20v-7M19 20V8" />
  </>, p);

/** Disclosure caret. Rotate with a class when open. */
export const Caret = (p: IconProps) => svg(<path d="M6 9l6 6 6-6" />, p);

/** Sector / grid — the "all sectors" filter. */
export const Sectors = (p: IconProps) => svg(
  <>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
  </>, p);

export const Bullish = (p: IconProps) => svg(
  <>
    <path d="M4 17l5.5-5.5 3.5 3.5L20 8" />
    <path d="M15 8h5v5" />
  </>, p);

export const Bearish = (p: IconProps) => svg(
  <>
    <path d="M4 7l5.5 5.5L13 9l7 7" />
    <path d="M15 16h5v-5" />
  </>, p);

/** Neutral — "no direction filter", i.e. everything. */
export const Neutral = (p: IconProps) => svg(<path d="M4 12h16M7 8l-3 4 3 4M17 8l3 4-3 4" />, p);

/* ------------------------------------------------------------------- registry --- */

/**
 * Icons addressed by name, for data-driven config.
 *
 * The widget and filter tables used to carry image URLs as strings; they now carry a name
 * from this list, so an unknown one is a TypeScript error instead of a broken image.
 */
export const ICONS = {
  bulb: Bulb, play: Play, bookmark: Bookmark, chart: ChartLink, caret: Caret,
  sectors: Sectors, bullish: Bullish, bearish: Bearish, neutral: Neutral,
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, className, title }: { name: IconName; className?: string; title?: string }) {
  const C = ICONS[name];
  return <C className={className} title={title} />;
}

/* --------------------------------------------------------------------- avatar --- */

// Stable per-symbol tint, so a stock keeps the same colour everywhere it appears. Fixed
// saturation and lightness rather than a random hex, so every avatar stays legible against
// white text and no two sit at wildly different weights.
function hue(symbol: string): number {
  let h = 2166136261;
  for (let i = 0; i < symbol.length; i++) { h ^= symbol.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) % 360;
}

/**
 * A symbol's mark: its first two characters on a colour derived from the name.
 *
 * Replaces a hotlinked per-issuer logo. The old code already rendered this on a 404, so
 * this is the same look, minus the dependency and the ~200 requests a full board made.
 */
export function SymbolAvatar({ symbol, className = 'w-[25px] h-[25px] text-[9px]' }: {
  symbol: string; className?: string;
}) {
  return (
    <span
      className={`${className} rounded-full shrink-0 inline-flex items-center justify-center font-bold text-white/95 select-none`}
      style={{ background: `hsl(${hue(symbol)} 45% 38%)` }}
      aria-hidden
    >
      {symbol.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase()}
    </span>
  );
}

/** The live-data badge. Styled by `.badge-live` in globals.css, which already existed. */
export const LiveBadge = ({ className = '' }: { className?: string }) => (
  <span className={`badge-live ${className}`}>● LIVE</span>
);
