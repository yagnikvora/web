export type Signal = "BULL" | "BEAR";
// 'nse'/'upstox' = read live from that provider. 'stale' = real data from an earlier
// fetch, re-served while the upstream is unreachable. 'mock' = invented demo data.
export type Source = "nse" | "upstox" | "mock" | "stale";

export interface Envelope<T> { payload: { data: T }; status: string; source?: Source; note?: string; }

// Scanner rows use a flat param_N schema. Meaning per widget:
//   breakout_beacon:      param_0=%chg  param_1=signal%   param_2="BULL"/"BEAR"  param_3=epoch(s)
//   intraday_boost /      param_0=LTP   param_1=prevClose param_2=%chg           param_3=R.Factor
//     top_gainers/losers
//   high_powered_stocks:  param_0=LTP   param_1=prevClose param_2=%chg           param_3=turnover(₹Cr)
//   top_level/low_level:  param_0=LTP   param_1=prevClose param_2=%chg           param_3=diff
export interface BeaconRow { Symbol: string; param_0: number; param_1: number; param_2: Signal; param_3: number; }
export interface ParamRow { Symbol: string; param_0: number; param_1: number; param_2: number; param_3: number; }
export interface MarketPulse {
  breakout_beacon: BeaconRow[]; intraday_boost: ParamRow[]; top_gainers: ParamRow[]; top_losers: ParamRow[];
  high_powered_stocks: ParamRow[]; top_level_stocks: ParamRow[]; low_level_stocks: ParamRow[];
}

export interface SectorStock { Symbol: string; ltp: number; open: number; prevClose: number; pChange: number; rFactor: number; weight: number; }
export type SectorScope = Record<string, SectorStock[]>;

export interface MoverStock { Symbol: string; per_change: number; per_to_index: number; point_to_index: number; }
export interface IndexMover { index: string; level: number; points: number | null; pct: number | null; gainers: number; losers: number; stocks: MoverStock[]; }

// ---- Option Clock ----
// The feed's own shape: snapshot timestamp -> { "NFO:<underlying><expiry code><strike><CE|PE>": OI }
// plus an "atm" entry. CE legs are the bears, PE legs the bulls.
export type OiSnapshot = Record<string, number>;
export type OiSnapshots = Record<string, OiSnapshot>;
// [epoch(s) of the expiry day at 15:30 IST, weekly | monthly]
export type RunningExpiry = [number, "wk" | "mo"];
// One reading of the PCR trend: [epoch(s), PCR, total put OI, total call OI]
export type PcrPoint = [number, number, number, number];
export interface OptionClock {
  expiries: RunningExpiry[];
  days: string[];      // trading days held in the store, newest first
  day: string;         // the day this payload describes, YYYY-MM-DD IST
  live: OiSnapshots;   // latest snapshot of that day, for totals and PCR
  window: OiSnapshots; // both ends of the session, for the clock itself
  pcr: PcrPoint[];     // PCR every 10 minutes through the session
}

// ---- Option Apex ----
// [epoch(s), open, high, low, close] — one intraday candle of the index.
export type Candle = [number, number, number, number, number];
export interface ApexChart {
  script: string; tf: number;
  day: string;          // the IST trading day these candles describe
  candles: Candle[];
  last: number; prevClose: number | null;
}
// [epoch(s) of the bucket, expiry, net money flux in ₹]
export type FluxPoint = [number, string, number];
export interface ApexFlux {
  day: string;
  step: number;   // bucket width actually used, seconds
  slot: number;   // the option-candle resolution — buckets can be no finer
  points: FluxPoint[];
  ceFlow: number; peFlow: number; // session totals, ₹
  missing: number;                // buckets the feed had no candles for (1 = the opening baseline)
}
export interface ApexDials {
  pcr: number; pcrScore: number; sentiment: number;
  /** [epoch(s), pcr] through the day, from Upstox. Empty if unavailable. */
  pcrSeries: [number, number][];
  pcrBucketMinutes: number;
  /** Why there is no trend, when there isn't. The ratio itself is unaffected. */
  pcrTrendNote?: string;
  netFlow: number; grossFlow: number;
  bulls: number; bears: number;
  spot: number; ts: number; day: string;
  buckets: number; // flux readings behind the sentiment dial
}

export interface ScanRow { Symbol: string; pChange: number; price: number; signal?: Signal; when: string; score?: number; }
export type ScannerGroups = Record<string, ScanRow[]>;

export interface FiiDiiRow { date: string; fiiBuy: number; fiiSell: number; fiiNet: number; inMarket: number; diiNet: number; diiBuy: number; diiSell: number; }
