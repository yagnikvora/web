// Semicircular sentiment gauge: Strong Sell → Strong Buy. value in [-1, 1].
export default function Gauge({ label, value }: { label: string; value: number }) {
  const v = Math.max(-1, Math.min(1, value));
  const angle = (v * 90); // -90..90 degrees
  const rad = ((angle - 90) * Math.PI) / 180;
  const cx = 100, cy = 100, r = 78;
  const nx = cx + r * Math.cos(rad), ny = cy + r * Math.sin(rad);
  const arc = (from: number, to: number, color: string) => {
    const a0 = ((from * 90 - 90 - 90) * Math.PI) / 180, a1 = ((to * 90 - 90 - 90) * Math.PI) / 180;
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    return <path d={`M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`} stroke={color} strokeWidth={12} fill="none" strokeLinecap="round" />;
  };
  const verdict = v <= -0.6 ? "STRONG SELL" : v < -0.2 ? "SELL" : v < 0.2 ? "NEUTRAL" : v < 0.6 ? "BUY" : "STRONG BUY";
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 120" className="w-full max-w-[240px]">
        {arc(-1, -0.33, "#e5484d")}
        {arc(-0.33, 0.33, "#8b98a9")}
        {arc(0.33, 1, "#2ec76a")}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#e6edf3" strokeWidth={3} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={6} fill="#e6edf3" />
      </svg>
      <div className="text-sm font-bold mt-1">{label}</div>
      <div className={`text-xs ${v >= 0.2 ? "text-bull" : v <= -0.2 ? "text-bear" : "text-muted"}`}>{verdict}</div>
    </div>
  );
}
