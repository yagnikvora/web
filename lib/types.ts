export type Signal = "BULL" | "BEAR";
export type Source = "nse" | "mock";

export interface Envelope<T> { payload: { data: T }; status: string; source?: Source; note?: string; }

export interface SignalRow { Symbol: string; pChange: number; signalPct: number; signal: Signal; ts: number; }
export interface QuoteRow { Symbol: string; ltp: number; prevClose: number; pChange: number; }
export interface BoostRow extends QuoteRow { rFactor: number; }
export interface PowerRow extends QuoteRow { turnover: number; }
export interface LevelRow extends QuoteRow { diff: number; }
export interface MarketPulse {
  breakout_beacon: SignalRow[]; intraday_boost: BoostRow[]; top_gainers: BoostRow[]; top_losers: BoostRow[];
  high_powered_stocks: PowerRow[]; top_level_stocks: LevelRow[]; low_level_stocks: LevelRow[];
}

export interface SectorStock { Symbol: string; ltp: number; prevClose: number; pChange: number; rFactor: number; weight: number; }
export type SectorScope = Record<string, SectorStock[]>;

export interface MoverStock { Symbol: string; per_change: number; per_to_index: number; point_to_index: number; }
export interface IndexMover { index: string; level: number; points: number | null; pct: number | null; gainers: number; losers: number; stocks: MoverStock[]; }

export interface OiRow { strike: number; ceOI: number; peOI: number; ceChg: number; peChg: number; }
export interface OptionAnalysis { symbol: string; spot: number; atm: number; expiry: string | null; expiries: string[]; rows: OiRow[]; pcr: number; maxPainStrike: number; }

export interface ScanRow { Symbol: string; pChange: number; price: number; signal?: Signal; when: string; score?: number; }
export type ScannerGroups = Record<string, ScanRow[]>;

export interface FiiDiiRow { date: string; fiiBuy: number; fiiSell: number; fiiNet: number; inMarket: number; diiNet: number; diiBuy: number; diiSell: number; }
