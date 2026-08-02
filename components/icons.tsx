// Inline SVG icons.
//
// These replace images that were hotlinked from another company's CDN — an outage or a
// path change on their side would have broken this app's UI, and they were not ours to
// serve. Inline SVG is also simply better here: no extra requests, crisp at any size, and
// each one takes `currentColor` so it follows the surrounding text instead of being a
// baked-in colour that only suits one theme.
//
// Company logos are not here either, for a different reason: they are per-symbol raster
// assets, not UI chrome, so they live as files under public/images/symbols/ and are drawn
// by `SymbolAvatar` (re-exported below from its own client module).

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
const ICONS = {
  bulb: Bulb, play: Play, bookmark: Bookmark, chart: ChartLink, caret: Caret,
  sectors: Sectors, bullish: Bullish, bearish: Bearish, neutral: Neutral,
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, className, title }: { name: IconName; className?: string; title?: string }) {
  const C = ICONS[name];
  return <C className={className} title={title} />;
}

/* --------------------------------------------------------------------- avatar --- */

// Lives in its own file because it needs an error handler for the logo-to-initials
// fallback, and so a `use client` boundary. Re-exported here so callers keep one import.
export { SymbolAvatar } from './SymbolAvatar';

/** The live-data badge. Styled by `.badge-live` in globals.css, which already existed. */
export const LiveBadge = ({ className = '' }: { className?: string }) => (
  <span className={`badge-live ${className}`}>● LIVE</span>
);
