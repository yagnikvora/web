"use client";

// A symbol's mark in a table row: the issuer's logo, with a coloured initials chip standing
// in whenever there is no logo on disk.
//
// The logos are served from this app's own /public rather than hotlinked from someone
// else's CDN — `npm run logos` fetches them once into public/images/symbols/, so a board of
// 200 rows costs zero third-party requests and an outage on their side cannot blank the UI.
// Symbols with no file simply keep the initials chip, which is the same look the old code
// fell back to on a 404.

import { useState } from 'react';

/**
 * Where a symbol's logo lives.
 *
 * Defaults to same-origin. Set NEXT_PUBLIC_SYMBOL_LOGO_BASE to serve the same filenames
 * from a bucket or CDN instead — the scanner script writes the identical layout.
 */
const BASE = process.env.NEXT_PUBLIC_SYMBOL_LOGO_BASE || '/images/symbols';

const symbolLogo = (symbol: string) => `${BASE}/${encodeURIComponent(symbol)}.webp`;

// Symbols whose logo has already 404'd this session. Sorting and filtering unmount and
// remount these rows constantly; without this, every remount re-requests a file we already
// know is not there.
const missing = new Set<string>();

// Stable per-symbol tint for the fallback chip, so a stock keeps the same colour everywhere
// it appears. Fixed saturation and lightness rather than a random hex, so every chip stays
// legible against white text and no two sit at wildly different weights.
function hue(symbol: string): number {
  let h = 2166136261;
  for (let i = 0; i < symbol.length; i++) { h ^= symbol.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) % 360;
}

export function SymbolAvatar({ symbol, className = 'w-[25px] h-[25px] text-[9px]' }: {
  symbol: string; className?: string;
}) {
  // Keyed by symbol, not a bare boolean: a row that gets reused for a different stock must
  // start over rather than inherit the previous one's failure.
  const [failedFor, setFailedFor] = useState<string | null>(null);

  if (failedFor === symbol || missing.has(symbol)) {
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

  return (
    // A plain <img>, not next/image: these are already 64px webp on our own origin, so the
    // optimizer would only add a round trip for a file that is a couple of hundred bytes.
    <img
      src={symbolLogo(symbol)}
      onError={() => { missing.add(symbol); setFailedFor(symbol); }}
      className={`${className} rounded-full shrink-0 bg-white object-contain`}
      loading="lazy"
      decoding="async"
      alt=""
      aria-hidden
    />
  );
}
