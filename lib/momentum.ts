// Momentum Scanner — client-side types and the small helpers the two pages share.
//
// These mirror `api/src/momentum/types.ts`. They are duplicated rather than imported
// because the two apps are separate packages with separate tsconfigs, which is the same
// arrangement `lib/types.ts` already has for the rest of the API surface.
//
// The one rule that has to survive the copy: a number the backend could not MEASURE is
// `null`, never 0. Every formatter here renders null as an em dash, so a missing factor
// looks missing rather than looking like a reading of zero.

export type FactorKey =
  | "rvol" | "liquidity" | "relativeStrength" | "vwap" | "optionFlow" | "greeks"
  | "impliedVolatility" | "atrExpansion" | "sectorStrength" | "marketBreadth" | "trendStructure";

export type Confidence = "High" | "Medium" | "Low";
export type Direction = "Bullish" | "Bearish" | "Neutral";
export type TradeType = "Momentum Buy" | "Momentum Sell" | "Avoid";
export type ActivityLevel = "High" | "Medium" | "Low";
export type LiquidityGrade = "Excellent" | "Good" | "Average" | "Poor";
export type RvolGrade = LiquidityGrade;
export type OiBuildUp = "Long Build-up" | "Short Build-up" | "Short Covering" | "Long Unwinding" | "Neutral";
export type IvBasis = "iv-history" | "hv-proxy" | "unavailable";
export type EnrichmentLevel = "quote" | "partial" | "full";

export interface FactorReason { ok: boolean; text: string }

export type MetricValue = number | string | boolean | null;

export interface FactorOutcome {
  key: FactorKey;
  label: string;
  score: number | null;
  bias: number;
  weight: number;
  available: boolean;
  note?: string;
  metrics: Record<string, MetricValue>;
  reasons: FactorReason[];
}

export interface MomentumRow {
  rank: number;
  symbol: string;
  sector: string | null;
  price: number;
  prevClose: number;
  changePct: number;
  volume: number;
  turnoverCr: number;
  score: number;
  rawScore: number;
  coverage: number;
  confidence: Confidence;
  direction: Direction;
  tradeType: TradeType;
  institutionalActivity: ActivityLevel;
  liquidity: { score: number | null; grade: LiquidityGrade | null };
  rvol: { value: number | null; grade: RvolGrade | null };
  vwap: { value: number | null; distancePct: number | null; rising: boolean | null };
  relativeStrengthPct: number | null;
  sectorStrengthPct: number | null;
  atrExpansion: number | null;
  oiBuildUp: OiBuildUp | null;
  /** Futures OI is intraday; the chain's PCR and OI changes are day-over-day. */
  oi: {
    futuresOi: number | null;
    futuresOiChangePctIntraday: number | null;
    pcrOi: number | null;
    pcrVolume: number | null;
    maxPain: number | null;
    optionValueCr: number | null;
    expiry: string | null;
  } | null;
  greeksSummary: { delta: number | null; deltaShift: number | null; gamma: number | null; thetaBurnPct: number | null } | null;
  ivSummary: { atmIv: number | null; ivRank: number | null; ivPercentile: number | null; basis: IvBasis } | null;
  expectedMove: { rupees: number; pct: number; days: number } | null;
  trend: { higherHigh: boolean; higherLow: boolean; breakout: "up" | "down" | null; orb: "up" | "down" | null } | null;
  enrichment: EnrichmentLevel;
  reasons: FactorReason[];
  /** Only present when the request asked for it, and always on the detail endpoint. */
  factors?: FactorOutcome[];
}

export interface MarketContext {
  asOf: number;
  marketOpen: boolean;
  sessionFraction: number;
  minuteOfSession: number;
  nifty: { level: number; changePct: number; aboveVwap: boolean | null; vwapSource: string } | null;
  indiaVix: { level: number; changePct: number } | null;
  breadth: {
    advances: number; declines: number; unchanged: number;
    advanceDeclineRatio: number | null; pctAboveVwap: number | null;
    sectorsPositive: number; sectorsTracked: number; bias: number;
  };
}

export interface MomentumBoard {
  asOf: number;
  configVersion: number;
  universeSize: number;
  scored: number;
  shortlisted: number;
  matched: number;
  returned: number;
  market: MarketContext;
  rows: MomentumRow[];
  warnings: string[];
}

export interface MomentumHistoryPoint {
  day: string;
  score: number;
  close: number;
  direction: Direction;
  rvol: number | null;
  atmIv: number | null;
  hv20: number | null;
}

export interface MomentumDetail {
  asOf: number;
  configVersion: number;
  market: MarketContext;
  row: MomentumRow;
  history: MomentumHistoryPoint[];
  warnings: string[];
}

/* ------------------------------------------------------------------- presentation --- */

/**
 * The score band. Deliberately four steps, not a gradient: a reader comparing 71 against 68
 * should see them as the same class of setup, because within the model's precision they are.
 */
export function scoreBand(score: number): { label: string; fg: string; bg: string; ring: string } {
  if (score >= 80) return { label: "Very strong", fg: "#0b2e1a", bg: "#2ec76a", ring: "#2ec76a" };
  if (score >= 65) return { label: "Strong", fg: "#0c2418", bg: "#8fdcae", ring: "#8fdcae" };
  if (score >= 45) return { label: "Moderate", fg: "#2b2410", bg: "#e2c15c", ring: "#e2c15c" };
  return { label: "Weak", fg: "#e8e8ea", bg: "#39404d", ring: "#5b6572" };
}

export const directionClass = (d: Direction): string =>
  d === "Bullish" ? "text-bull" : d === "Bearish" ? "text-bear" : "text-muted";

export const tradeClass = (t: TradeType): string =>
  t === "Momentum Buy"
    ? "text-bull border-emerald-700/70 bg-emerald-500/10"
    : t === "Momentum Sell"
      ? "text-bear border-red-800/70 bg-red-500/10"
      : "text-muted border-border bg-white/[0.03]";

export const gradeClass = (g: LiquidityGrade | RvolGrade | null): string =>
  g === "Excellent" ? "text-bull"
    : g === "Good" ? "text-emerald-300"
      : g === "Average" ? "text-amber-300"
        : g === "Poor" ? "text-bear"
          : "text-muted";

export const activityClass = (a: ActivityLevel): string =>
  a === "High" ? "text-accent" : a === "Medium" ? "text-muted" : "text-[#5b6572]";

export const buildUpClass = (b: OiBuildUp | null): string =>
  b === "Long Build-up" ? "text-bull"
    : b === "Short Build-up" ? "text-bear"
      : b === "Short Covering" ? "text-emerald-300"
        : b === "Long Unwinding" ? "text-amber-300"
          : "text-muted";

/** Null renders as an em dash — a missing reading must not look like zero. */
export const n = (v: number | null | undefined, digits = 2, suffix = ""): string =>
  v == null || Number.isNaN(v) ? "—" : `${v.toFixed(digits)}${suffix}`;

export const pctStr = (v: number | null | undefined, digits = 2): string =>
  v == null || Number.isNaN(v) ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(digits)}%`;

export const xStr = (v: number | null | undefined): string =>
  v == null || Number.isNaN(v) ? "—" : `${v.toFixed(2)}x`;

/** Metric keys are camelCase with the occasional `_qualifier`; both need unpicking. */
export const humaniseKey = (k: string): string =>
  k
    .replace(/_/g, " · ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\bPct\b/g, "%")
    .replace(/\bCr\b/g, "₹Cr")
    .replace(/\bOi\b/gi, "OI")
    .replace(/\bIv\b/g, "IV")
    .replace(/\bVwap\b/gi, "VWAP")
    .replace(/\bAtm\b/gi, "ATM")
    .replace(/\bPcr\b/gi, "PCR")
    .replace(/\bRvol\b/gi, "RVOL")
    .replace(/^./, (c) => c.toUpperCase());

export const formatMetric = (v: MetricValue): string => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return "—";
    if (Number.isInteger(v) && Math.abs(v) >= 1000) return v.toLocaleString("en-IN");
    if (Number.isInteger(v)) return String(v);
    return Math.abs(v) < 0.01 ? v.toExponential(2) : v.toFixed(Math.abs(v) < 1 ? 4 : 2);
  }
  return v;
};

export const IV_BASIS_LABEL: Record<IvBasis, string> = {
  "iv-history": "recorded IV history",
  "hv-proxy": "realised-volatility proxy",
  unavailable: "unavailable",
};

export const ENRICHMENT_LABEL: Record<EnrichmentLevel, string> = {
  full: "Full — quote, futures OI and option chain",
  partial: "Partial — the option chain could not be fetched this cycle",
  quote: "Quote tier only — outside the enrichment shortlist",
};
