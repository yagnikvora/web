// The platform's identity, in one place.
//
// Everything user-visible that names the product or its modules lives here, so a rebrand
// is this file rather than a search across the app. It exists because the previous name
// was scattered through the page title, the nav logo, chart watermarks and eight feature
// headings, and renaming meant finding all of them.
//
// MODULES maps a route to what the page calls itself. The route paths deliberately do NOT
// change with the label: they are what people bookmark and what search engines hold.

export const BRAND = {
  /** Wordmark. Split so the nav can accent the second half. */
  name: 'Trinetra',
  nameLead: 'Tri',
  nameAccent: 'netra',
  /**
   * The slogan. Sanskrit त्रिनेत्र — "the third eye", the one that sees what the other two
   * cannot. This wording explains the name as it sells it, which a wordmark alone can't.
   */
  tagline: 'The third eye on the market.',
  description:
    'A real-time market-analysis workspace for NSE stocks, indices and F&O — momentum ' +
    'scanners, option-OI analytics, sector heatmaps and institutional flows, in one place.',
  /** Drawn on the price chart, the way a charting vendor signs its output. */
  watermark: 'Trinetra',
} as const;

/**
 * Route -> module name, and a one-line description used as the nav tooltip.
 *
 * The labels are the established names and stay as they are — only the platform is being
 * rebranded. They live here rather than inline so that renaming any of them later is an
 * edit to this table, not a hunt through the nav, the home page and eight headings.
 */
export const MODULES: Record<string, { label: string; gloss: string }> = {
  '/momentum-scanner': {
    label: 'Momentum Scanner',
    gloss: 'Institutional momentum score across every F&O stock, with the reasoning shown',
  },
  '/trend-day': {
    label: 'Trend Day',
    gloss: 'Stocks going one direction all session, ranked by conviction and held steady',
  },
  '/market-pulse': { label: 'Market Pulse', gloss: 'Live momentum, breakout and power scanners' },
  '/sector-scope': { label: 'Sector Scope', gloss: 'Sector strength heatmap' },
  '/option-clock': { label: 'Option Clock', gloss: 'Open-interest clock and PCR trend' },
  '/option-apex': { label: 'Option Apex', gloss: 'Index chart, money flux and sentiment dials' },
};

export const moduleLabel = (href: string) => MODULES[href]?.label ?? href;
export const moduleGloss = (href: string) => MODULES[href]?.gloss ?? '';

/**
 * Which module a path belongs to, sub-pages included — /momentum-scanner/RELIANCE resolves
 * to /momentum-scanner. Longest match wins, so a future module nested under another still
 * resolves to itself. Null for anything outside the table, such as the home page.
 *
 * The nav needs this twice: to keep a module highlighted while the reader is on one of its
 * detail pages, and to name the current module on a phone, where the links live behind a
 * button and nothing else on screen says where you are.
 */
export const moduleForPath = (path: string): string | null =>
  Object.keys(MODULES)
    .filter((href) => path === href || path.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0] ?? null;

/**
 * The signed-in account shown in the nav.
 *
 * A placeholder until real auth exists. It was a hardcoded personal handle, which is the
 * sort of thing that ships to production and stays there.
 */
export const VIEWER = { name: process.env.NEXT_PUBLIC_VIEWER_NAME || 'Guest' };
