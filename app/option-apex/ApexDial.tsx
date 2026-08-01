// The Sentimental Dial and PCR gauges — the pair the real page puts beside the chart.
//
// Five equal zones across a half circle, Strong Sell on the left through Strong Buy on
// the right, with the needle at `value` on a −1 … +1 scale. Drawn as flat SVG so it
// stays crisp at any panel width and costs nothing to re-render on every poll.

const ZONES = [
  { label: "STRONG\nSELL", color: "#e5484d" },
  { label: "SELL", color: "#f0888c" },
  { label: "NEUTRAL", color: "#5b6b80" },
  { label: "BUY", color: "#7aa8ff" },
  { label: "STRONG\nBUY", color: "#2f6fed" },
];

const CX = 100, CY = 104, R = 74, W = 13;

/** Point on the dial's arc. `t` runs 0 (far left / strongest sell) to 1 (far right). */
function point(t: number, r = R) {
  const a = Math.PI * (1 - t);
  return [CX + r * Math.cos(a), CY - r * Math.sin(a)] as const;
}

function arc(from: number, to: number, color: string, key: string) {
  const [x0, y0] = point(from);
  const [x1, y1] = point(to);
  return (
    <path key={key} d={`M ${x0} ${y0} A ${R} ${R} 0 0 1 ${x1} ${y1}`}
      stroke={color} strokeWidth={W} fill="none" strokeLinecap="butt" />
  );
}

function verdictOf(v: number): string {
  if (v <= -0.6) return "STRONG SELL";
  if (v < -0.2) return "SELL";
  if (v <= 0.2) return "NEUTRAL";
  if (v < 0.6) return "BUY";
  return "STRONG BUY";
}

const verdictClass = (v: number) =>
  v >= 0.2 ? "text-bull" : v <= -0.2 ? "text-bear" : "text-muted";

export default function ApexDial({ label, value, readout, hint }: {
  label: string;
  value: number;
  /** The underlying number the dial is a picture of, e.g. "PCR 1.49". */
  readout?: string;
  hint?: string;
}) {
  const v = Math.max(-1, Math.min(1, Number.isFinite(value) ? value : 0));
  const t = (v + 1) / 2;
  const [nx, ny] = point(t, R - 12);
  const verdict = verdictOf(v);

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 132" className="w-full max-w-[260px]">
        <defs>
          <radialGradient id="dialFace" cx="50%" cy="100%" r="85%">
            <stop offset="0%" stopColor="#141c2b" />
            <stop offset="100%" stopColor="#0a0f18" />
          </radialGradient>
        </defs>
        <path d={`M ${CX - R - W / 2} ${CY} A ${R + W / 2} ${R + W / 2} 0 0 1 ${CX + R + W / 2} ${CY} Z`}
          fill="url(#dialFace)" />

        {ZONES.map((z, i) => arc(i / 5, (i + 1) / 5, z.color, z.label))}

        {/* Zone captions sit outside the arc, angled the way the reference page sets them. */}
        {ZONES.map((z, i) => {
          const [lx, ly] = point((i + 0.5) / 5, R + 15);
          const lines = z.label.split("\n");
          return (
            <text key={`t-${z.label}`} x={lx} y={ly - (lines.length - 1) * 4} textAnchor="middle"
              fill="#9aa7b8" fontSize={7.5} fontWeight={700} letterSpacing={0.4}>
              {lines.map((ln, k) => <tspan key={ln} x={lx} dy={k === 0 ? 0 : 8.5}>{ln}</tspan>)}
            </text>
          );
        })}

        <line x1={CX} y1={CY} x2={nx} y2={ny} stroke="#e9eef5" strokeWidth={2.4} strokeLinecap="round" />
        <circle cx={CX} cy={CY} r={5.5} fill="#0a0f18" stroke="#e9eef5" strokeWidth={2} />
      </svg>

      <div className="text-[15px] font-bold mt-1">{label}</div>
      <div className={`text-xs font-semibold ${verdictClass(v)}`}>{verdict}</div>
      {readout && <div className="text-[11px] text-muted mt-0.5">{readout}</div>}
      {hint && <div className="text-[10px] text-muted/70 mt-1 text-center max-w-[240px] leading-tight">{hint}</div>}
    </div>
  );
}
