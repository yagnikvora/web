export type Signal = "BULL" | "BEAR";
// 'stale' = real NSE data from an earlier fetch, re-served while NSE is unreachable.
export type Source = "nse" | "mock" | "stale";

export interface Envelope<T> { payload: { data: T }; status: string; source?: Source; note?: string; }

// Market Pulse rows use the real tradefinder flat param_N schema. Meaning per widget:
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

export interface OiRow { strike: number; ceOI: number; peOI: number; ceChg: number; peChg: number; }
export interface OptionAnalysis { symbol: string; spot: number; atm: number; expiry: string | null; expiries: string[]; rows: OiRow[]; pcr: number; maxPainStrike: number; }

export interface ScanRow { Symbol: string; pChange: number; price: number; signal?: Signal; when: string; score?: number; }
export type ScannerGroups = Record<string, ScanRow[]>;

export interface FiiDiiRow { date: string; fiiBuy: number; fiiSell: number; fiiNet: number; inMarket: number; diiNet: number; diiBuy: number; diiSell: number; }
