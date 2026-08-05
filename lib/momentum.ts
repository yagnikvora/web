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
  | "momentumPulse" | "trendQuality" | "rvol" | "liquidity" | "relativeStrength" | "vwap"
  | "optionFlow" | "greeks" | "impliedVolatility" | "atrExpansion" | "sectorStrength"
  | "marketBreadth" | "trendStructure";

export type Confidence = "High" | "Medium" | "Low";
export type Direction = "Bullish" | "Bearish" | "Neutral";
export type TradeType = "Momentum Buy" | "Momentum Sell" | "Watch" | "Avoid";
export type ActivityLevel = "High" | "Medium" | "Low";
export type LiquidityGrade = "Excellent" | "Good" | "Average" | "Poor";
export type RvolGrade = LiquidityGrade;
export type OiBuildUp = "Long Build-up" | "Short Build-up" | "Short Covering" | "Long Unwinding" | "Neutral";
export type IvBasis = "iv-history" | "hv-proxy" | "unavailable";
export type EnrichmentLevel = "quote" | "partial" | "full";

export interface FactorReason { ok: boolean; text: string }

/* ------------------------------------------------------------------ timing layer --- */

export type SignalState =
  | "Igniting" | "Trending" | "Extending" | "Extended" | "Stalling" | "Reversing" | "Quiet";
export type SignalAction = "Buy Call" | "Buy Put" | "Watch" | "Stand Aside";
export type TriggerKind =
  | "baseBreak" | "vwapReclaim" | "vwapLoss" | "orbBreak" | "dayExtreme" | "priorRange"
  | "thrust" | "trendPullback";

/* -------------------------------------------------------------- conviction layer --- */

export type TrendPhase = "None" | "Forming" | "Confirmed" | "Faded";

/**
 * The session-scale read: has this stock gone ONE WAY all day.
 *
 * Neither the score nor the timing layer could answer this. The score is cumulative magnitude
 * and peaks once the move is over; the timing layer measures the last three minutes. A stock
 * that grinds one direction for five hours scores modestly on both — a steady grind has no
 * volume burst and little velocity — which is why a board built from them showed a churn of
 * spiky names and never the stock that was quietly trending all session.
 */
export interface ConvictionSummary {
  ready: boolean;
  /** 0–100. The Trend Day view's ranking key. */
  score: number;
  phase: TrendPhase;
  direction: Direction;
  /** Minutes the current phase has held. The persistence that stops the list churning. */
  heldMin: number | null;
  /** Highest conviction reached today, so a faded row still says what it once was. */
  peak: number;
  vwapAdherence: number | null;
  vwapCrossings: number | null;
  sessionEfficiency: number | null;
  rangePosition: number | null;
  deepestPullbackAtr: number | null;
  /** True when a restart missed part of the session, so every share above is partial. */
  partial: boolean;
  summary: string;
  note?: string;
}

export interface SignalTrigger {
  kind: TriggerKind;
  label: string;
  direction: 1 | -1;
  at: number;
  price: number;
  ageMin: number;
  movedSincePct: number;
}

export interface PulseSummary {
  ready: boolean;
  score: number | null;
  bias: number;
  movePct: number | null;
  velocityAtrPerMin: number | null;
  burstRvol: number | null;
  efficiency: number | null;
  acceleration: number | null;
  legAgeMin: number | null;
  legMovePct: number | null;
  pullback: number | null;
  minutesSinceExtreme: number | null;
  note?: string;
}

export interface SignalPlan {
  entry: number;
  stop: number;
  target: number;
  stopPct: number;
  targetPct: number;
  rewardRisk: number | null;
  optionMovePctAtTarget: number | null;
  underlyingMovePctForTargetOption: number | null;
  meetsOptionTarget: boolean | null;
  basis: "strike" | "chain" | "atr-only";
}

export type OptionType = "CE" | "PE";

/** The contract to buy — the one output of the model that ends in an order. */
export interface StrikeChoice {
  strike: number;
  type: OptionType;
  label: string;
  instrumentKey: string;
  expiry: string;
  expiryDays: number;
  stepsFromAtm: number;
  moneyness: "ITM" | "ATM" | "OTM";
  premium: number;
  /** The ask — what getting in actually costs, not the mid. */
  entryCost: number;
  bid: number;
  ask: number;
  spreadPct: number | null;
  delta: number;
  gamma: number | null;
  iv: number | null;
  thetaPctPerHour: number | null;
  oi: number;
  volume: number;
  lotSize: number | null;
  costPerLot: number | null;
  premiumAtTarget: number | null;
  /** Net of paying the ask and selling the bid. */
  gainPctAtTarget: number | null;
  profitPerLot: number | null;
  breakEven: number | null;
  reason: string;
  warnings: string[];
}

export interface MomentumSignal {
  state: SignalState;
  action: SignalAction;
  entryQuality: number;
  freshness: number | null;
  trigger: SignalTrigger | null;
  microDirection: Direction;
  aligned: boolean | null;
  pulse: PulseSummary;
  extension: {
    /** Intraday range ÷ ATR, gap EXCLUDED — the reading the ceiling is applied to. */
    atrUsed: number | null;
    /** True range ÷ ATR, gap included. Context only; not gated on. */
    trueRangeAtrUsed: number | null;
    gapAtr: number | null;
    vwapAtr: number | null;
    legMoveAtr: number | null;
    /** What the ceilings were scaled by. 1 on an ordinary day, higher on a trend day. */
    budgetMultiplier: number;
    /** The ceiling actually applied. 0 means it was withdrawn on a confirmed trend day. */
    atrUsedMax: number;
    extended: boolean;
  };
  plan: SignalPlan | null;
  /** Null when the row had no option chain this cycle — the shortlist is finite. */
  strike: StrikeChoice | null;
  /** Which kind of entry this is, so the contract on it reads correctly. */
  entryKind: "ignition" | "pullback" | "trend" | null;
  /** How many trend-day re-entries have fired on this stock today. */
  trendEntriesToday: number;
  reasons: FactorReason[];
  blockers: string[];
}

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
  /** WHEN, as opposed to what. Null only when the timing layer is switched off in config. */
  signal: MomentumSignal | null;
  /** Whether the day has been one-sided. Null only when the conviction layer is off. */
  conviction: ConvictionSummary | null;
  /** Why the row is where it is in the list, and how settled that position is. */
  stability: { rankScore: number; drift: number; heldMin: number | null };
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
  igniting: number;
  entrable: number;
  trendConfirmed: number;
  trendForming: number;
  trendFaded: number;
  matched: number;
  returned: number;
  market: MarketContext;
  rows: MomentumRow[];
  warnings: string[];
}

/** GET /momentum/trend — the one-sided-day feed behind the Trend Day view. */
export interface TrendBoard {
  asOf: number;
  configVersion: number;
  market: MarketContext;
  trendConfirmed: number;
  trendForming: number;
  trendFaded: number;
  matched: number;
  returned: number;
  phase: { confirmedFrom: number; formingFrom: number };
  rows: MomentumRow[];
  /**
   * Days that WERE one-sided and have stopped being. Carried separately from `rows` so a
   * client cannot render a expired thesis as a candidate — but carried, because somebody is
   * holding these and that is the most useful thing the feed can say.
   */
  fading: MomentumRow[];
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
      : t === "Watch"
        ? "text-amber-300 border-amber-700/60 bg-amber-500/10"
        : "text-muted border-border bg-white/[0.03]";

/* --------------------------------------------------------------- timing display --- */

/**
 * The six states, in words a reader can act on.
 *
 * The wording matters more here than anywhere else on the page. `Extended` is the state that
 * used to look like the best row on the board — highest score, every factor green — and the
 * whole point of showing it is that somebody about to buy a call reads WHY not to.
 */
export const STATE_HELP: Record<SignalState, string> = {
  Igniting: "The move is starting. The leg is in front of the entry, not behind it.",
  Trending:
    "A one-sided day that is still intact. The trade here is each pullback, not the break — that " +
    "was hours ago. The range ceiling is relaxed because a wide range is what a trend day IS.",
  Extending: "The leg is established and still working — enter on a pullback, not a chase.",
  Extended: "Most of a normal day's range is already travelled. A high score here is describing what already happened.",
  Stalling: "The leg has stopped making new extremes and volume has faded.",
  Reversing: "The last few minutes are going against the day. A position taken on the day's direction is already wrong.",
  Quiet: "Nothing is moving on the minute scale.",
};

export const stateClass = (s: SignalState): string =>
  s === "Igniting"
    ? "text-bull border-emerald-600 bg-emerald-500/15"
    : s === "Trending"
      ? "text-[#7dd3fc] border-sky-700/70 bg-sky-500/10"
      : s === "Extending"
        ? "text-emerald-300 border-emerald-800/70 bg-emerald-500/10"
        : s === "Extended"
          ? "text-amber-300 border-amber-700/60 bg-amber-500/10"
          : s === "Reversing"
            ? "text-bear border-red-800/70 bg-red-500/10"
            : s === "Stalling"
              ? "text-[#c0a25c] border-[#6b5a2e] bg-amber-500/[0.06]"
              : "text-muted border-border bg-white/[0.03]";

/* -------------------------------------------------------------- conviction layer --- */

export const PHASE_HELP: Record<TrendPhase, string> = {
  None: "Not one-sided — or it has not moved far enough for the shape to mean anything.",
  Forming:
    "The shape looks one-sided but has not held long enough to be trusted. Roughly the first hour. " +
    "A fair share of these decay into chop by noon.",
  Confirmed:
    "Adherence to one side of VWAP, crossing count, path efficiency and pullback depth have all held. " +
    "This is the state a stock that walks one direction all day lives in from mid-morning.",
  Faded:
    "It WAS one-sided and has stopped being. The most dangerous row on the board: anyone still holding " +
    "it is holding it on a thesis that has expired.",
};

export const phaseClass = (p: TrendPhase): string =>
  p === "Confirmed"
    ? "text-bull border-emerald-600 bg-emerald-500/15"
    : p === "Forming"
      ? "text-[#7dd3fc] border-sky-700/70 bg-sky-500/10"
      : p === "Faded"
        ? "text-bear border-red-800/70 bg-red-500/10"
        : "text-muted border-border bg-white/[0.03]";

/** The conviction chip's colour band. Mirrors `scoreBand` so the two read consistently. */
export function convictionBand(v: number): { fg: string; bg: string } {
  if (v >= 80) return { fg: "#0b1f16", bg: "#34d399" };
  if (v >= 65) return { fg: "#0b1f16", bg: "#6ee7b7" };
  if (v >= 50) return { fg: "#231b06", bg: "#fbbf24" };
  return { fg: "#c7d2dc", bg: "rgba(255,255,255,0.06)" };
}

/** "4h 12m" — a trend day's tenure is read in hours, not in 252 minutes. */
export const heldStr = (min: number | null | undefined): string => {
  if (min == null) return "—";
  if (min < 60) return `${Math.round(min)}m`;
  return `${Math.floor(min / 60)}h ${Math.round(min % 60)}m`;
};

export const ENTRY_KIND_HELP: Record<"ignition" | "pullback" | "trend", string> = {
  ignition: "A fresh break. Short hold, and leverage is worth paying for.",
  pullback: "A retracement inside an ordinary established leg.",
  trend:
    "A retracement inside a confirmed one-sided day. Expected hold 30–90 minutes, so the strike is " +
    "picked in a delta band rather than on raw payoff — over three or four entries in a day, the " +
    "cheapest contract costs more in spread than it makes in leverage.",
};

export const actionClass = (a: SignalAction): string =>
  a === "Buy Call"
    ? "text-bull border-emerald-700/70 bg-emerald-500/10"
    : a === "Buy Put"
      ? "text-bear border-red-800/70 bg-red-500/10"
      : a === "Watch"
        ? "text-amber-300 border-amber-700/60 bg-amber-500/10"
        : "text-muted border-border bg-white/[0.03]";

/** "just now", "4m ago" — a trigger's whole value is its age. */
export const ageStr = (min: number | null | undefined): string =>
  min == null ? "—" : min < 1 ? "just now" : `${Math.round(min)}m ago`;

/** ₹27,500 rather than ₹27500 — a lot cost is read at a glance or not at all. */
export const rupees = (v: number | null | undefined): string =>
  v == null ? "—" : `₹${Math.round(v).toLocaleString("en-IN")}`;

export const moneynessClass = (m: StrikeChoice["moneyness"]): string =>
  m === "ATM" ? "text-[#c7d2dc]" : m === "OTM" ? "text-accent" : "text-amber-300";

/** Entry quality is a 0–100 like the score, and must not be read as one. */
export const entryBand = (q: number): { fg: string; bg: string } =>
  q >= 70
    ? { fg: "#0b2e1a", bg: "#2ec76a" }
    : q >= 50
      ? { fg: "#0c2418", bg: "#8fdcae" }
      : q >= 30
        ? { fg: "#2b2410", bg: "#e2c15c" }
        : { fg: "#e8e8ea", bg: "#39404d" };

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
