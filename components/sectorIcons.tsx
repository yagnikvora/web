// Pictograms for the sector filter.
//
// Drawn here rather than fetched, for the same reason the rest of components/icons.tsx is:
// these are UI chrome, and hotlinking someone else's sprite sheet for them would put a
// third party in the render path of a dropdown.
//
// Same stroke language as the other icons (24-box, round caps, currentColor) so a sector
// mark sits next to a bulb or a caret without looking imported. Each one carries a tint,
// spread across the hue wheel so no two adjacent rows in the menu read as the same colour,
// and sits on a 13%-alpha wash of itself — which is what turns fifteen loose glyphs into
// one set.
//
// The three index buckets get letterforms instead of pictures. There is no honest drawing
// of "NIFTY 50", and their own menu makes the same call.

import type { ReactNode } from "react";
import { Sectors } from "@/components/icons";

type Mark = { tint: string; draw?: ReactNode; text?: string };

const SECTORS: Record<string, Mark> = {
  AUTO: {
    tint: "#ef5350",
    draw: (
      <>
        <path d="M4.8 15.8v-3.1l1.8-4.1A2 2 0 0 1 8.5 7.4h7a2 2 0 0 1 1.9 1.2l1.8 4.1v3.1" />
        <path d="M4.8 12.7h14.4" />
        <circle cx="8.2" cy="16.4" r="1.7" />
        <circle cx="15.8" cy="16.4" r="1.7" />
      </>
    ),
  },
  REALTY: {
    tint: "#f59e0b",
    draw: (
      <>
        <path d="M3.5 10.5 12 4l8.5 6.5" />
        <path d="M5.8 9.5V20h12.4V9.5" />
        <path d="M10 20v-5h4v5" />
      </>
    ),
  },
  CEMENT: {
    tint: "#b0a89f",
    draw: (
      <>
        <rect x="3.2" y="6.2" width="17.6" height="11.6" rx="1.2" />
        <path d="M3.2 10.1h17.6M3.2 13.9h17.6" />
        <path d="M9 6.2v3.9M15 6.2v3.9M6 10.1v3.8M12 10.1v3.8M18 10.1v3.8M9 13.9v3.9M15 13.9v3.9" />
      </>
    ),
  },
  ENERGY: {
    tint: "#facc15",
    draw: <path d="M13.2 2.5 5.5 13.2h5.4L10.4 21.5l8.1-11.2h-5.5l.2-7.8Z" />,
  },
  SENSEX: {
    tint: "#4ade80",
    draw: (
      <>
        <rect x="3.6" y="13" width="3.8" height="6.5" rx="0.9" />
        <rect x="10.1" y="9.4" width="3.8" height="10.1" rx="0.9" />
        <rect x="16.6" y="5.4" width="3.8" height="14.1" rx="0.9" />
      </>
    ),
  },
  PHARMA: {
    tint: "#2dd4bf",
    draw: (
      <>
        <rect x="2.6" y="9" width="18.8" height="6" rx="3" transform="rotate(-45 12 12)" />
        <path d="M9.9 9.9 14.1 14.1" />
      </>
    ),
  },
  IT: {
    tint: "#22d3ee",
    draw: (
      <>
        <path d="M8.8 8 4.4 12l4.4 4" />
        <path d="M15.2 8l4.4 4-4.4 4" />
        <path d="M13.4 6.2 10.6 17.8" />
      </>
    ),
  },
  "FIN SERVICE": {
    tint: "#38bdf8",
    draw: (
      <>
        <ellipse cx="12" cy="6.8" rx="7.2" ry="2.8" />
        <path d="M4.8 6.8v4.4c0 1.5 3.2 2.8 7.2 2.8s7.2-1.3 7.2-2.8V6.8" />
        <path d="M4.8 11.2v4.4c0 1.5 3.2 2.8 7.2 2.8s7.2-1.3 7.2-2.8v-4.4" />
      </>
    ),
  },
  // The three bank buckets share a building and are told apart by what sits on it: a flag
  // for state-owned, a lock for private, nothing for the combined bucket.
  "PSU BANK": {
    tint: "#4c8dff",
    draw: (
      <>
        <path d="M12 2.6v3.2" />
        <path d="M12 2.9h3.3l-.9 1.1.9 1.1H12" />
        <path d="M3.5 11.2 12 7l8.5 4.2" />
        <path d="M6.4 12.2v6M12 12.2v6M17.6 12.2v6" />
        <path d="M3.5 20.4h17" />
      </>
    ),
  },
  BANK: {
    tint: "#d4a95e",
    draw: (
      <>
        <path d="M3.5 10 12 5l8.5 5" />
        <path d="M6 11.2v7M10 11.2v7M14 11.2v7M18 11.2v7" />
        <path d="M3.5 20.4h17" />
      </>
    ),
  },
  "PVT BANK": {
    tint: "#c084fc",
    draw: (
      <>
        <path d="M3.5 10.2 12 5.6l8.5 4.6" />
        <path d="M6.2 11.4v6.8M17.8 11.4v6.8" />
        <path d="M3.5 20.4h17" />
        <rect x="9.4" y="14" width="5.2" height="4.2" rx="1" />
        <path d="M10.8 14v-1.3a1.2 1.2 0 0 1 2.4 0V14" />
      </>
    ),
  },
  FMCG: {
    tint: "#f472b6",
    draw: (
      <>
        <path d="M2.5 4h2.3l2.7 10.8h10.2l2-7.6H6.2" />
        <circle cx="9.3" cy="18.6" r="1.5" />
        <circle cx="16.8" cy="18.6" r="1.5" />
      </>
    ),
  },
  METAL: {
    tint: "#94a3b8",
    draw: (
      <>
        <path d="M9.8 6.6h4.4l1.4 4.2H8.4l1.4-4.2Z" />
        <path d="M5.2 13h5.4l1.4 4.4H3.8L5.2 13Z" />
        <path d="M13.4 13h5.4l1.4 4.4h-8.2L13.4 13Z" />
      </>
    ),
  },
  "NIFTY 50": { tint: "#818cf8", text: "50" },
  "NIFTY MID SELECT": { tint: "#a78bfa", text: "MID" },
};

// Any basket the feed adds that isn't drawn above still gets a mark: initials on a tint
// derived from the name, the same fallback the stock avatars use for a missing logo.
function fallback(label: string): Mark {
  let h = 2166136261;
  for (let i = 0; i < label.length; i++) { h ^= label.charCodeAt(i); h = Math.imul(h, 16777619); }
  const words = label.split(/\s+/);
  return {
    tint: `hsl(${(h >>> 0) % 360} 60% 62%)`,
    text: (words.length > 1 ? words[0][0] + words[1][0] : label.slice(0, 2)).toUpperCase(),
  };
}

/** The tinted square every mark sits on. The wash is the tint's own colour at 13% alpha. */
const Tile = ({ tint, children }: { tint: string; children: ReactNode }) => (
  <span
    className="w-[22px] h-[22px] shrink-0 rounded-[6px] grid place-items-center"
    style={{ background: `${tint}22`, color: tint }}
    aria-hidden
  >
    {children}
  </span>
);

/**
 * A sector's mark, on its own tinted tile.
 *
 * `sector` is the raw basket name because that is what the registry is keyed by; `label` is
 * only used to letter the fallback, so an unknown bucket is marked with the words actually
 * printed beside it.
 */
export function SectorIcon({ sector, label = sector }: { sector: string; label?: string }) {
  const mark = SECTORS[sector] ?? fallback(label);
  return (
    <Tile tint={mark.tint}>
      {mark.text ? (
        <span className={`font-bold leading-none ${mark.text.length > 2 ? "text-[8px]" : "text-[10px]"}`}>
          {mark.text}
        </span>
      ) : (
        <svg
          viewBox="0 0 24 24" className="w-[15px] h-[15px]" fill="none" stroke="currentColor"
          strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
        >
          {mark.draw}
        </svg>
      )}
    </Tile>
  );
}

/** The "All" row's mark: the grid glyph the icon set already has, on a neutral tile. */
export const AllSectorsIcon = () => (
  <Tile tint="#8b98a9"><Sectors className="w-[15px] h-[15px]" /></Tile>
);
