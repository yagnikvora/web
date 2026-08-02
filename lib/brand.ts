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
  '/market-pulse': { label: 'Market Pulse', gloss: 'Live momentum, breakout and power scanners' },
  '/insider-strategy': { label: 'Insider Strategy', gloss: 'Structure-based strategy scanners' },
  '/sector-scope': { label: 'Sector Scope', gloss: 'Sector strength heatmap' },
  '/swing-spectrum': { label: 'Swing Spectrum', gloss: 'Multi-day swing setups' },
  '/option-clock': { label: 'Option Clock', gloss: 'Open-interest clock and PCR trend' },
  '/option-apex': { label: 'Option Apex', gloss: 'Index chart, money flux and sentiment dials' },
  '/index-mover': { label: 'Index Mover', gloss: 'Which stocks are moving the index' },
  '/fii-dii': { label: 'FII / DII', gloss: 'Institutional buying and selling' },
};

export const moduleLabel = (href: string) => MODULES[href]?.label ?? href;
export const moduleGloss = (href: string) => MODULES[href]?.gloss ?? '';

/**
 * The signed-in account shown in the nav.
 *
 * A placeholder until real auth exists. It was a hardcoded personal handle, which is the
 * sort of thing that ships to production and stays there.
 */
export const VIEWER = { name: process.env.NEXT_PUBLIC_VIEWER_NAME || 'Guest' };
