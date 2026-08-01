export const fmt = (n: number | null | undefined, d = 2) =>
  n == null || Number.isNaN(n) ? "—" : Number(n).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });

export const signCls = (n: number) => (n >= 0 ? "text-bull" : "text-bear");

export const tvLink = (sym: string) =>
  `https://www.tradingview.com/chart/?symbol=NSE:${encodeURIComponent(sym.replace("&", "_"))}&interval=5`;

export const titleCase = (k: string) =>
  k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
