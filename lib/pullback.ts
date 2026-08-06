// EMA Pullback Scanner — client-side types and the helpers the pages share.
//
// These mirror `api/src/pullback/types.ts`. They are duplicated rather than imported because the
// two apps are separate packages with separate tsconfigs, which is the arrangement `lib/types.ts`
// and `lib/momentum.ts` already have for the rest of the API surface.
//
// The rule that has to survive the copy: a number the backend could not MEASURE is `null`, never
// 0. Every formatter here renders null as an em dash, so a warming average looks warming rather
// than looking like a reading of zero — and on this board that distinction is the difference
// between "the 200 EMA has not seeded yet" and "price is exactly on the 200 EMA".

export type Timeframe = 1 | 3 | 5 | 15;
export const TIMEFRAMES: Timeframe[] = [1, 3, 5, 15];

/**
 * The frame a detail page opens on when the URL does not name one. Mirrors
 * `DEFAULT_CHART_TIMEFRAME` in `api/src/pullback/types.ts` — the API already defaults to it, and
 * this is asked for explicitly so the page's first chart does not depend on that agreement.
 */
export const DEFAULT_CHART_TIMEFRAME: Timeframe = 5;

export const TIMEFRAME_LABEL: Record<Timeframe, string> = {
  1: "1 min", 3: "3 min", 5: "5 min", 15: "15 min",
};

export type TrendState = "Bullish" | "Bearish" | "None";
export type PullbackPhase = "None" | "Impulse" | "PullingBack" | "AtZone" | "Resuming" | "Failed";
export type ConfidenceBand = "Weak" | "Medium" | "Strong" | "Excellent";
export type InstrumentKind = "stock" | "index";
export type EntryKind = "pullback" | "holding";
export type OptionSide = "CE" | "PE";
export type SignalOutcomeState = "Open" | "TargetHit" | "StopHit" | "Expired";
export type AlertKind = "freshPullback" | "trendResume" | "emaRejection" | "targetHit" | "stopHit";

export type CandlePattern =
  | "bullishEngulfing" | "bearishEngulfing" | "hammer" | "shootingStar"
  | "piercing" | "darkCloud" | "strongBody" | "insideBarBreak" | "none";

export interface Bar {
  at: number;
  day: string;
  minute: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover: number;
  /** Assembled from quote polls rather than exchange candles — its extremes are approximate. */
  synthetic?: boolean;
}

export interface Pivot { index: number; at: number; price: number; kind: "high" | "low" }

export interface TimeframeRead {
  timeframe: Timeframe;
  bars: number;
  lastClosedAt: number | null;
  forming: Bar | null;
  ema: { ema9: number | null; ema20: number | null; ema50: number | null; ema200: number | null };
  slope: { ema9AtrPerBar: number | null; ema20AtrPerBar: number | null; vwapAtrPerBar: number | null };
  vwap: number | null;
  atr: number | null;
  adx: { adx: number | null; plusDi: number | null; minusDi: number | null; rising: boolean | null };
  structure: {
    higherHigh: boolean; higherLow: boolean; lowerHigh: boolean; lowerLow: boolean; steps: number;
    lastSwingHigh: Pivot | null; lastSwingLow: Pivot | null;
    priorSwingHigh: Pivot | null; priorSwingLow: Pivot | null; note?: string;
  };
  avgVolume: number | null;
  volumeRatio: number | null;
  /** This window's mean volume ÷ the previous window's — the trend's volume condition. */
  participation: number | null;
  close: number | null;
  distance: { ema9Atr: number | null; ema20Atr: number | null; ema50Atr: number | null; vwapAtr: number | null };
  warming: boolean;
  note?: string;
}

export interface Check { key: string; label: string; ok: boolean; required: boolean; value: string }

export interface TrendRead {
  timeframe: Timeframe;
  state: TrendState;
  strength: number;
  checks: Check[];
  /** Failed REQUIRED conditions — "this is not a trend". */
  failed: string[];
  /** Conditions that disqualify a real trend from being traded — flat averages, chop, wide book. */
  vetoes: string[];
}

export interface ConfirmationRead {
  pattern: CandlePattern;
  at: number;
  close: number;
  high: number;
  low: number;
  bodyRatio: number;
  volumeRatio: number | null;
  reclaimedEma9: boolean;
  barsAgo: number;
  reasons: string[];
}

export interface PullbackRead {
  timeframe: Timeframe;
  phase: PullbackPhase;
  direction: 1 | -1 | 0;
  /** The band spanned by the 9 EMA, 20 EMA and VWAP, widened by the ATR tolerance. */
  zone: { top: number; bottom: number } | null;
  touch: { ema9: boolean; ema20: boolean; vwap: boolean; nearest: "ema9" | "ema20" | "vwap" | null };
  barsInZone: number | null;
  impulse: { fromPrice: number; toPrice: number; fromAt: number; toAt: number; atr: number } | null;
  retracement: number | null;
  extreme: number | null;
  depthAtr: number | null;
  confirmation: ConfirmationRead | null;
  note?: string;
}

export interface ScoreComponent {
  key: "trend" | "volume" | "vwap" | "ema" | "structure" | "adx";
  label: string;
  points: number;
  max: number;
  available: boolean;
  reasons: string[];
}

export interface ScoreBreakdown {
  total: number;
  band: ConfidenceBand;
  components: ScoreComponent[];
  /** Fraction of the 100 points that was measurable. A 78 at 70% coverage is not a 78. */
  coverage: number;
}

export interface StopCandidate {
  kind: "swing" | "atr" | "ema";
  price: number;
  distance: number;
  distanceAtr: number;
  distancePct: number;
  reason: string;
}

export interface StopPlan { candidates: StopCandidate[]; recommended: StopCandidate; warning?: string }

export interface TargetCandidate {
  kind: "1R" | "2R" | "priorHigh" | "measuredMove" | "atr";
  label: string;
  price: number;
  r: number;
  distancePct: number;
  reason: string;
}

export interface TargetPlan {
  candidates: TargetCandidate[];
  primary: TargetCandidate;
  /** Against the primary target. With a 2R primary this is 2.00 by construction on every row. */
  rewardRisk: number;
  /**
   * How many multiples of the risk the trade's actual OBJECTIVE is worth — the measured move, i.e.
   * the impulse leg repeating from the pullback's low.
   *
   * This is the number the backend's reward:risk gate reads, and the reason it exists is that
   * `rewardRisk` cannot do that job: a 2R target is defined FROM the stop, so comparing a floor
   * against it is arithmetic restating itself. Room is the independent measurement — the retracement
   * created this much risk, so is the leg repeating worth it?
   */
  roomR: number;
  /** A rule plus what it evaluates to now — never a level to leave a resting order at. */
  trailing: { rule: string; current: number; kind: "ema" | "chandelier" };
}

export interface LiquidityScore {
  score: number;
  grade: "Excellent" | "Good" | "Average" | "Poor";
  components: { spread: number | null; openInterest: number | null; volume: number | null; depth: number | null };
  reasons: string[];
}

export interface OptionPick {
  symbol: string;
  side: OptionSide;
  strike: number;
  label: string;
  instrumentKey: string;
  expiry: string;
  expiryDays: number;
  moneyness: "ITM" | "ATM" | "OTM";
  stepsFromAtm: number;
  premium: number;
  /** The ask — what getting in costs, not the mid. */
  entryCost: number;
  bid: number;
  ask: number;
  spreadPct: number | null;
  delta: number;
  gamma: number | null;
  theta: number | null;
  thetaPctPerHour: number | null;
  vega: number | null;
  iv: number | null;
  oi: number;
  /** Day-over-day: Upstox's `prev_oi` on a chain leg is the previous session's close. */
  oiChange: number | null;
  volume: number;
  lotSize: number | null;
  costPerLot: number | null;
  premiumAtTarget: number | null;
  /** Net of paying the ask and selling the bid. */
  gainPctAtTarget: number | null;
  profitPerLot: number | null;
  breakEven: number | null;
  liquidity: LiquidityScore;
  band: { min: number; max: number; reason: string };
  reason: string;
  warnings: string[];
}

export interface SignalOutcome {
  state: SignalOutcomeState;
  maxFavourable: number;
  maxAdverse: number;
  r: number | null;
  closedAt: number | null;
  note?: string;
}

export interface PullbackSignal {
  id: string;
  symbol: string;
  timeframe: Timeframe;
  direction: 1 | -1;
  side: "BUY" | "SELL";
  entryKind: EntryKind;
  /** When the confirmation bar CLOSED — not when the scan noticed. */
  firedAt: number;
  ageMin: number;
  entry: number;
  price: number;
  movedSincePct: number;
  score: ScoreBreakdown;
  stop: StopPlan;
  target: TargetPlan;
  option: OptionPick | null;
  trend: TrendRead;
  pullback: PullbackRead;
  alignedWith: Timeframe[];
  outcome: SignalOutcome;
  reasons: string[];
  /** Non-empty only on a watch row, never on a fired signal. */
  blockers: string[];
}

/**
 * The indicator values a board row displays, for the timeframe the row is presented by.
 *
 * A flattened slice of one `TimeframeRead`, sent instead of all four because the list view wants
 * thirteen numbers and the full frames are roughly half a megabyte across the board — too much to
 * poll every twenty seconds. `frames` is on the detail endpoint, where the weight is asked for.
 */
export interface RowReadout {
  timeframe: Timeframe;
  ema9: number | null;
  ema20: number | null;
  ema50: number | null;
  ema200: number | null;
  vwap: number | null;
  atr: number | null;
  adx: number | null;
  adxRising: boolean | null;
  participation: number | null;
  volumeRatio: number | null;
  vwapDistanceAtr: number | null;
  ema20DistanceAtr: number | null;
  ema9SlopeAtrPerBar: number | null;
  warming: boolean;
}

export interface PullbackRow {
  symbol: string;
  name: string | null;
  kind: InstrumentKind;
  sector: string | null;
  price: number;
  prevClose: number;
  changePct: number;
  volume: number;
  turnoverCr: number;
  spreadBps: number | null;
  /** The indicators for the timeframe this row is presented by. Always present. */
  readout: RowReadout | null;
  /** Only present when the request asked for it, and always on the detail endpoint. */
  frames?: Partial<Record<Timeframe, TimeframeRead>>;
  trends: Partial<Record<Timeframe, TrendRead>>;
  pullbacks: Partial<Record<Timeframe, PullbackRead>>;
  signal: PullbackSignal | null;
  /** At the zone with no confirmation yet — the watchlist entry. */
  watch: PullbackSignal | null;
  dominant: { timeframe: Timeframe; state: TrendState; strength: number } | null;
  enriched: boolean;
  warnings: string[];
}

export interface PullbackMarket {
  asOf: number;
  marketOpen: boolean;
  minuteOfSession: number;
  nifty: { level: number; changePct: number; aboveVwap: boolean | null } | null;
  indiaVix: { level: number; changePct: number } | null;
  breadth: { advances: number; declines: number; pctAboveVwap: number | null };
}

export interface PullbackBoard {
  asOf: number;
  configVersion: number;
  universeSize: number;
  scanned: number;
  enriched: number;
  bullishSignals: number;
  bearishSignals: number;
  watching: number;
  firedToday: number;
  matched: number;
  returned: number;
  market: PullbackMarket;
  rows: PullbackRow[];
  warnings: string[];
}

export interface AlertEvent {
  id: string;
  kind: AlertKind;
  at: number;
  symbol: string;
  timeframe: Timeframe;
  direction: 1 | -1;
  price: number;
  title: string;
  detail: string;
  signalId: string | null;
  score: number | null;
}

export interface AlertFeed {
  events: AlertEvent[];
  status: { held: number; webhookFailures: number; lastWebhookError: string | null };
}

export interface SignalRecord {
  id: string;
  day: string;
  symbol: string;
  timeframe: Timeframe;
  direction: 1 | -1;
  firedAt: number;
  entry: number;
  stop: number;
  target: number;
  score: number;
  band: ConfidenceBand;
  entryKind: EntryKind;
  option: { label: string; entryCost: number; delta: number } | null;
  outcome: SignalOutcome;
}

export interface HistoryFeed {
  day: string;
  summary: { fired: number; targetHit: number; stopHit: number; open: number; winRatePct: number | null };
  records: SignalRecord[];
}

export interface PullbackDetail {
  asOf: number;
  configVersion: number;
  market: PullbackMarket;
  symbol: string;
  name: string | null;
  kind: InstrumentKind;
  /** Set for an index: the series is the near FUTURE, because the index publishes no volume. */
  seriesNote: string | null;
  timeframe: Timeframe;
  row: PullbackRow | null;
  frames: Partial<Record<Timeframe, TimeframeRead>>;
  bars: Bar[];
  history: SignalRecord[];
  warnings: string[];
}

/* -------------------------------------------------------------------------- backtest --- */

export interface BacktestTrade {
  symbol: string;
  direction: 1 | -1;
  entryAt: number;
  entry: number;
  stop: number;
  target: number;
  exitAt: number;
  exit: number;
  r: number;
  holdMin: number;
  outcome: "target" | "stop" | "sessionEnd";
  score: number;
  band: ConfidenceBand;
  mfeR: number;
  maeR: number;
}

export interface BacktestResult {
  request: { symbol: string; timeframe: Timeframe; from: string; to: string; exitOn: string };
  sessions: number;
  trades: BacktestTrade[];
  stats: {
    count: number;
    wins: number;
    losses: number;
    winRatePct: number | null;
    averageR: number | null;
    profitFactor: number | null;
    maxDrawdownR: number;
    averageHoldMin: number | null;
    expectancyR: number | null;
    bestR: number;
    worstR: number;
  };
  equity: Array<{ at: number; r: number }>;
  byBand: Array<{ band: ConfidenceBand; count: number; winRatePct: number | null; averageR: number | null }>;
  warnings: string[];
}

/* --------------------------------------------------------------------- presentation --- */

/**
 * The confidence band's colours.
 *
 * Four steps, not a gradient — deliberately. A reader comparing 71 against 68 should see them as
 * the same class of setup, because within the model's precision they are, and a continuous ramp
 * invites reading a two-point difference as meaningful.
 */
export function bandColours(band: ConfidenceBand): { fg: string; bg: string; ring: string } {
  switch (band) {
    case "Excellent": return { fg: "#0b2e1a", bg: "#2ec76a", ring: "#2ec76a" };
    case "Strong": return { fg: "#0c2418", bg: "#8fdcae", ring: "#8fdcae" };
    case "Medium": return { fg: "#2b2410", bg: "#e2c15c", ring: "#e2c15c" };
    default: return { fg: "#e8e8ea", bg: "#39404d", ring: "#5b6572" };
  }
}

export const bandClass = (band: ConfidenceBand): string =>
  band === "Excellent"
    ? "text-bull border-emerald-600 bg-emerald-500/15"
    : band === "Strong"
      ? "text-emerald-300 border-emerald-800/70 bg-emerald-500/10"
      : band === "Medium"
        ? "text-amber-300 border-amber-700/60 bg-amber-500/10"
        : "text-muted border-border bg-white/[0.03]";

/**
 * What each pullback phase means, in words a reader can act on.
 *
 * `AtZone` is the state the whole module is built to surface early, and `Failed` is the one worth
 * showing loudly: anybody who entered on the touch is now on the wrong side of the structure.
 */
export const PHASE_HELP: Record<PullbackPhase, string> = {
  None: "No impulse leg to pull back from — price has not got clear of its own moving averages.",
  Impulse: "Extended away from the EMA band. There is a trend; there is no entry until it retraces.",
  PullingBack: "Retracing toward the 9/20/VWAP band, not there yet.",
  AtZone: "Price has reached the band. Waiting for a reversal candle on expanding volume — this is the state to be watching, not the one to be entering.",
  Resuming: "The turn has printed: reversal candle, volume expansion, close back past the 9 EMA. This is the entry.",
  Failed: "The retracement went THROUGH the band and kept going. The trend structure broke rather than paused — anyone filled on the touch is already wrong.",
};

export const phaseClass = (p: PullbackPhase): string =>
  p === "Resuming"
    ? "text-bull border-emerald-600 bg-emerald-500/15"
    : p === "AtZone"
      ? "text-[#7dd3fc] border-sky-700/70 bg-sky-500/10"
      : p === "PullingBack"
        ? "text-amber-300 border-amber-700/60 bg-amber-500/10"
        : p === "Failed"
          ? "text-bear border-red-800/70 bg-red-500/10"
          : "text-muted border-border bg-white/[0.03]";

export const PHASE_SHORT: Record<PullbackPhase, string> = {
  None: "No setup",
  Impulse: "Extended",
  PullingBack: "Pulling back",
  AtZone: "At zone",
  Resuming: "Resuming",
  Failed: "Rejected",
};

export const trendClass = (s: TrendState): string =>
  s === "Bullish" ? "text-bull" : s === "Bearish" ? "text-bear" : "text-muted";

export const ENTRY_KIND_HELP: Record<EntryKind, string> = {
  pullback:
    "An entry AT the zone: defined stop a short distance away, one-to-two-hour hold. The 0.30–0.45 " +
    "delta band is picked for that — enough leverage to be worth the premium, enough delta to still " +
    "track the stop the plan is built on.",
  holding:
    "Joining a trend already in motion — price never came back. Worse entry, longer hold, wider stop, " +
    "so the 0.45–0.60 band buys delta rather than leverage.",
};

export const PATTERN_LABEL: Record<CandlePattern, string> = {
  bullishEngulfing: "Bullish engulfing",
  bearishEngulfing: "Bearish engulfing",
  hammer: "Hammer",
  shootingStar: "Shooting star",
  piercing: "Piercing line",
  darkCloud: "Dark cloud cover",
  strongBody: "Strong directional candle",
  insideBarBreak: "Inside-bar break",
  none: "No reversal candle",
};

export const ALERT_LABEL: Record<AlertKind, string> = {
  freshPullback: "Fresh pullback",
  trendResume: "Trend resumed",
  emaRejection: "EMA rejection",
  targetHit: "Target hit",
  stopHit: "Stop hit",
};

export const alertClass = (k: AlertKind): string =>
  k === "trendResume"
    ? "text-bull border-emerald-700/70 bg-emerald-500/10"
    : k === "freshPullback"
      ? "text-[#7dd3fc] border-sky-700/70 bg-sky-500/10"
      : k === "targetHit"
        ? "text-bull border-emerald-800/60 bg-emerald-500/[0.07]"
        : k === "stopHit"
          ? "text-bear border-red-800/70 bg-red-500/10"
          : "text-amber-300 border-amber-700/60 bg-amber-500/10";

export const outcomeClass = (s: SignalOutcomeState): string =>
  s === "TargetHit"
    ? "text-bull"
    : s === "StopHit"
      ? "text-bear"
      : s === "Open"
        ? "text-[#7dd3fc]"
        : "text-muted";

export const OUTCOME_LABEL: Record<SignalOutcomeState, string> = {
  Open: "Open",
  TargetHit: "Target",
  StopHit: "Stopped",
  Expired: "Expired",
};

export const liquidityClass = (g: LiquidityScore["grade"]): string =>
  g === "Excellent" ? "text-bull"
    : g === "Good" ? "text-emerald-300"
      : g === "Average" ? "text-amber-300"
        : "text-bear";

export const moneynessClass = (m: OptionPick["moneyness"]): string =>
  m === "ATM" ? "text-[#c7d2dc]" : m === "OTM" ? "text-accent" : "text-amber-300";

/* -------------------------------------------------------------------- formatters --- */

/** Null renders as an em dash — a missing reading must not look like zero. */
export const n = (v: number | null | undefined, digits = 2, suffix = ""): string =>
  v == null || Number.isNaN(v) ? "—" : `${v.toFixed(digits)}${suffix}`;

export const pctStr = (v: number | null | undefined, digits = 2): string =>
  v == null || Number.isNaN(v) ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(digits)}%`;

export const xStr = (v: number | null | undefined): string =>
  v == null || Number.isNaN(v) ? "—" : `${v.toFixed(2)}x`;

export const atrStr = (v: number | null | undefined): string =>
  v == null || Number.isNaN(v) ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)} ATR`;

/** ₹27,500 rather than ₹27500 — a lot cost is read at a glance or not at all. */
export const rupees = (v: number | null | undefined): string =>
  v == null ? "—" : `₹${Math.round(v).toLocaleString("en-IN")}`;

/** "just now", "4m ago" — a pullback signal's whole value is its age. */
export const ageStr = (min: number | null | undefined): string =>
  min == null ? "—" : min < 1 ? "just now" : min < 60 ? `${Math.round(min)}m ago` : `${Math.floor(min / 60)}h ${Math.round(min % 60)}m ago`;

/**
 * An epoch as an Indian 12-hour clock reading.
 *
 * Most stamps on this board are bar times; the alert feed's `at` is the wall-clock instant the
 * scan emitted the event, which is not the same thing and is why an alert can read later than
 * the bar it describes.
 */
export { istClock } from "./format";

export const istDate = (ms: number): string =>
  new Date(ms).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short" });

/** The row's live confidence: its signal's, else its watch candidate's, else nothing. */
export const confidenceOf = (r: PullbackRow): number | null =>
  r.signal?.score.total ?? r.watch?.score.total ?? null;

/** The signal or watch candidate a row is presented by. */
export const bestOf = (r: PullbackRow): PullbackSignal | null => r.signal ?? r.watch;
