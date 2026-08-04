"use client";

// One stock, every number the score was built from.
//
// The organising idea is that the page should let a reader RE-DERIVE the score, not just
// read it. So each factor card shows its own score, its configured weight, its contribution
// to the total, and the raw metrics underneath — and the sum of the contributions is
// printed against the reported score. If they ever disagree, the page says so rather than
// quietly showing two different numbers in two places.

import { useMemo } from "react";
import Link from "next/link";
import { useLiveData } from "@/lib/live";
import { fmt, tvLink } from "@/lib/format";
import { SourceBadge } from "@/components/ui";
import { SymbolAvatar } from "@/components/icons";
import {
  actionClass, activityClass, ageStr, buildUpClass, directionClass, ENRICHMENT_LABEL, entryBand,
  formatMetric, gradeClass, humaniseKey, IV_BASIS_LABEL, moneynessClass, pctStr, rupees,
  scoreBand, stateClass, STATE_HELP, tradeClass, xStr,
  type FactorOutcome, type MomentumDetail, type MomentumSignal,
} from "@/lib/momentum";

/** The timing layer moves in minutes, so this page is polled in tens of seconds. */
const DETAIL_REFRESH_MS = 20_000;

/* ------------------------------------------------------------------------ pieces --- */

function Stat({ label, value, cls = "", hint }: { label: string; value: React.ReactNode; cls?: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5" title={hint}>
      <span className="text-[11px] uppercase tracking-wide text-muted">{label}</span>
      <span className={`text-[16px] font-bold tabular-nums ${cls}`}>{value}</span>
    </div>
  );
}

/** A horizontal bar for a 0–100 score. Grey when the factor was not computable. */
function ScoreBar({ score }: { score: number | null }) {
  if (score === null) return <div className="h-[6px] rounded-full bg-[#2a3341]" />;
  const band = scoreBand(score);
  return (
    <div className="h-[6px] rounded-full bg-[#2a3341] overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${score}%`, background: band.bg }} />
    </div>
  );
}

function FactorCard({ f, totalWeight }: { f: FactorOutcome; totalWeight: number }) {
  const contribution = f.available && f.score !== null ? (f.score * f.weight) / totalWeight : 0;

  return (
    <section className={`panel p-4 ${f.available ? "" : "opacity-70"}`}>
      <header className="flex items-baseline gap-2 mb-2">
        <h3 className="text-[15px] font-bold">{f.label}</h3>
        <span className="text-[11px] text-muted">weight {f.weight}</span>
        <span className="ml-auto text-[20px] font-black tabular-nums">
          {f.score === null ? <span className="text-muted text-[15px]">n/a</span> : f.score.toFixed(0)}
        </span>
      </header>

      <ScoreBar score={f.score} />

      <div className="flex items-center gap-3 mt-2 text-[11.5px] text-muted">
        <span>
          contributes <span className="text-white font-semibold tabular-nums">{contribution.toFixed(1)}</span> pts
        </span>
        {f.bias !== 0 && (
          <span className={f.bias > 0 ? "text-bull" : "text-bear"}>
            bias {f.bias > 0 ? "+" : ""}{f.bias.toFixed(2)}
          </span>
        )}
      </div>

      {f.reasons.length > 0 && (
        <ul className="mt-3 space-y-1">
          {f.reasons.map((r, i) => (
            <li key={i} className={`text-[12.5px] leading-[16px] ${r.ok ? "text-[#c7d2dc]" : "text-[#7d8895]"}`}>
              <span className={r.ok ? "text-bull" : "text-bear"}>{r.ok ? "✓" : "✗"}</span> {r.text}
            </li>
          ))}
        </ul>
      )}

      {f.note && (
        <p className="mt-2.5 text-[11.5px] text-amber-300/80 leading-[15px] border-l-2 border-amber-700/50 pl-2">
          {f.note}
        </p>
      )}

      {Object.keys(f.metrics).length > 0 && (
        <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-[3px] pt-3 border-t border-border">
          {Object.entries(f.metrics).map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-[11.5px] text-muted truncate">{humaniseKey(k)}</dt>
              <dd className="text-[11.5px] font-semibold tabular-nums text-right">{formatMetric(v)}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

/* --------------------------------------------------------------- the timing panel --- */

/**
 * Everything the timing layer knows, in the order a reader needs it.
 *
 * State first, because it is the one line that changes what to do. Then the trigger and its
 * age, then the plan — and the blockers last but unmissable, since the common case for a
 * high-scoring stock is that there IS a blocker and the whole value of this panel is saying
 * which one in words rather than leaving a reader to infer it from a number.
 */
function TimingPanel({ signal, targetLabel }: { signal: MomentumSignal; targetLabel: string }) {
  const band = entryBand(signal.entryQuality);
  const p = signal.plan;
  const e = signal.extension;
  const pulse = signal.pulse;

  return (
    <section className="panel p-4 mb-4">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <h2 className="text-[15px] font-semibold">Timing</h2>
        <span className={`inline-block rounded-full border px-2.5 py-[4px] text-[12px] font-bold ${stateClass(signal.state)}`}>
          {signal.state}
        </span>
        <span className={`inline-block rounded-full border px-2.5 py-[4px] text-[12px] font-bold ${actionClass(signal.action)}`}>
          {signal.action}
        </span>
        <span className="ml-auto flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wide text-muted">Entry quality</span>
          <span
            className="inline-block min-w-[42px] text-center rounded-[8px] px-2 py-[5px] text-[15px] leading-[13px] font-black tabular-nums"
            style={{ background: band.bg, color: band.fg }}
          >
            {signal.entryQuality}
          </span>
        </span>
      </div>

      <p className="text-[12.5px] text-muted mb-4 max-w-3xl leading-[17px]">{STATE_HELP[signal.state]}</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-4">
        <Stat
          label="Trigger"
          value={signal.trigger ? signal.trigger.label : "none"}
          hint="The level that was crossed, dated from when it was first crossed — not from when the condition was last true."
        />
        <Stat
          label="Fired"
          value={ageStr(signal.trigger?.ageMin)}
          cls={(signal.freshness ?? 0) > 50 ? "text-bull" : (signal.freshness ?? 0) > 0 ? "text-amber-300" : "text-muted"}
        />
        <Stat
          label="Since trigger"
          value={signal.trigger ? pctStr(signal.trigger.movedSincePct) : "—"}
          hint="How much of the move has already gone, measured from the trigger price"
        />
        <Stat
          label="Last minutes"
          value={signal.microDirection}
          cls={directionClass(signal.microDirection)}
          hint="The direction of the last few minutes, which can disagree with the day's"
        />
        <Stat
          label="Day's range used"
          value={e.atrUsed == null ? "—" : `${(e.atrUsed * 100).toFixed(0)}%`}
          cls={e.extended ? "text-amber-300" : "text-bull"}
          hint="Today's true range as a fraction of this stock's average day. Past ~80% there is little left to pay a further leg."
        />
        <Stat
          label="Stretch from VWAP"
          value={e.vwapAtr == null ? "—" : `${e.vwapAtr.toFixed(2)} ATR`}
          cls={(e.vwapAtr ?? 0) > 1 ? "text-amber-300" : "text-muted"}
        />
      </div>

      {/* ---- what the last minutes measured ---- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-4 mt-4 pt-4 border-t border-border">
        <Stat label="Move (window)" value={pctStr(pulse.movePct)} cls={(pulse.movePct ?? 0) >= 0 ? "text-bull" : "text-bear"} />
        <Stat
          label="Volume burst"
          value={xStr(pulse.burstRvol)}
          hint="Volume in the window against what this stock normally trades in the same minutes. Unlike day RVOL this spikes as a move starts."
        />
        <Stat
          label="One-directional"
          value={pulse.efficiency == null ? "—" : `${(pulse.efficiency * 100).toFixed(0)}%`}
          cls={(pulse.efficiency ?? 0) >= 0.65 ? "text-bull" : "text-muted"}
          hint="Share of the movement that went one way. High is a leg; low is a fight."
        />
        <Stat label="Leg age" value={pulse.legAgeMin == null ? "—" : `${pulse.legAgeMin.toFixed(0)}m`} />
        <Stat label="Leg move" value={pctStr(pulse.legMovePct)} />
        <Stat
          label="Pullback"
          value={pulse.pullback == null ? "—" : `${(pulse.pullback * 100).toFixed(0)}%`}
          hint="How far price has come back off the leg's extreme"
        />
      </div>

      {/* ---- the plan ---- */}
      {p && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-baseline gap-2 mb-3">
            <h3 className="text-[13.5px] font-semibold">If taken here</h3>
            <span className="text-[11px] text-muted">
              {p.basis === "strike"
                ? "priced off the contract below, net of its own bid-ask"
                : p.basis === "chain"
                  ? "priced off the ATM delta, gamma and premium quoted on the chain"
                  : "priced off ATR only — no option chain for this row this cycle"}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-4">
            <Stat label="Entry" value={fmt(p.entry)} />
            <Stat label="Stop" value={fmt(p.stop)} cls="text-bear" hint={`${p.stopPct.toFixed(2)}% away`} />
            <Stat label="Target" value={fmt(p.target)} cls="text-bull" hint={`${p.targetPct.toFixed(2)}% away`} />
            <Stat label="Reward : risk" value={p.rewardRisk == null ? "—" : `${p.rewardRisk.toFixed(2)}×`} />
            <Stat
              label="Option at target"
              value={p.optionMovePctAtTarget == null ? "—" : `${p.optionMovePctAtTarget >= 0 ? "+" : ""}${p.optionMovePctAtTarget.toFixed(0)}%`}
              cls={(p.optionMovePctAtTarget ?? 0) > 0 ? "text-bull" : "text-muted"}
              hint="First-order estimate from delta and gamma. Ignores time decay and any change in implied volatility over the hold."
            />
            <Stat
              label={`Stock needed for ${targetLabel}`}
              value={p.underlyingMovePctForTargetOption == null ? "—" : `${p.underlyingMovePctForTargetOption.toFixed(2)}%`}
              cls={p.meetsOptionTarget === false ? "text-amber-300" : p.meetsOptionTarget ? "text-bull" : ""}
              hint={
                p.meetsOptionTarget === false
                  ? "More than the room this plan thinks is left — the setup is real but the prize is smaller than that."
                  : "Inside the room this plan thinks is left."
              }
            />
          </div>
        </div>
      )}

      {/* ---- the contract ---- */}
      {signal.strike && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex flex-wrap items-baseline gap-2 mb-3">
            <h3 className="text-[13.5px] font-semibold">Contract to buy</h3>
            <span className={`text-[15px] font-black ${signal.strike.type === "CE" ? "text-bull" : "text-bear"}`}>
              {signal.strike.label}
            </span>
            <span className={`text-[11px] font-bold ${moneynessClass(signal.strike.moneyness)}`}>
              {signal.strike.moneyness}
            </span>
            <span className="text-[11px] text-muted">
              {signal.strike.expiry} · {signal.strike.expiryDays}d — {signal.strike.reason}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-4">
            <Stat
              label="Cost to enter"
              value={`₹${signal.strike.entryCost.toFixed(2)}`}
              hint="The ask, not the last traded price — this is what getting in costs."
            />
            <Stat
              label="One lot"
              value={rupees(signal.strike.costPerLot)}
              hint={signal.strike.lotSize ? `${signal.strike.lotSize} shares a lot` : "lot size unresolved"}
            />
            <Stat
              label="At target"
              value={
                signal.strike.premiumAtTarget == null
                  ? "—"
                  : `₹${signal.strike.premiumAtTarget.toFixed(2)}`
              }
              cls="text-bull"
              hint="Second-order in gamma. Ignores decay and any IV change over the hold."
            />
            <Stat
              label="Gain at target"
              value={signal.strike.gainPctAtTarget == null ? "—" : `${signal.strike.gainPctAtTarget >= 0 ? "+" : ""}${signal.strike.gainPctAtTarget.toFixed(0)}%`}
              cls={(signal.strike.gainPctAtTarget ?? 0) >= 30 ? "text-bull" : "text-muted"}
              hint="Net of paying the ask and selling the bid"
            />
            <Stat
              label="Per lot"
              value={signal.strike.profitPerLot == null ? "—" : rupees(signal.strike.profitPerLot)}
              cls={(signal.strike.profitPerLot ?? 0) >= 0 ? "text-bull" : "text-bear"}
            />
            <Stat label="Break-even" value={fmt(signal.strike.breakEven ?? 0)} hint="Underlying price at expiry" />
            <Stat label="Delta" value={Math.abs(signal.strike.delta).toFixed(2)} />
            <Stat
              label="Bid / ask"
              value={`${signal.strike.bid.toFixed(2)} / ${signal.strike.ask.toFixed(2)}`}
              cls={(signal.strike.spreadPct ?? 0) > 3 ? "text-amber-300" : ""}
              hint={signal.strike.spreadPct == null ? "one-sided book" : `${signal.strike.spreadPct.toFixed(1)}% of the mid`}
            />
            <Stat
              label="Decay"
              value={signal.strike.thetaPctPerHour == null ? "—" : `${signal.strike.thetaPctPerHour.toFixed(1)}%/hr`}
              cls={(signal.strike.thetaPctPerHour ?? 0) > 3 ? "text-amber-300" : "text-muted"}
              hint="Of the premium, per hour held"
            />
            <Stat label="Open interest" value={signal.strike.oi.toLocaleString("en-IN")} />
            <Stat label="Volume" value={signal.strike.volume.toLocaleString("en-IN")} />
            <Stat label="IV" value={signal.strike.iv == null ? "—" : `${signal.strike.iv.toFixed(1)}%`} />
          </div>

          {signal.strike.warnings.length > 0 && (
            <ul className="mt-3 space-y-1">
              {signal.strike.warnings.map((w, i) => (
                <li key={i} className="text-[12px] text-amber-300/90 leading-[16px]">⚠ {w}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ---- why it is or is not an entry ---- */}
      <div className="grid gap-4 lg:grid-cols-2 mt-4 pt-4 border-t border-border">
        <ul className="space-y-1">
          {signal.reasons.map((r, i) => (
            <li key={i} className={`text-[12.5px] leading-[16px] ${r.ok ? "text-[#c7d2dc]" : "text-[#7d8895]"}`}>
              <span className={r.ok ? "text-bull" : "text-bear"}>{r.ok ? "✓" : "✗"}</span> {r.text}
            </li>
          ))}
        </ul>

        {signal.blockers.length > 0 && (
          <div className="rounded-lg border border-amber-800/50 bg-amber-500/[0.06] p-3">
            <div className="text-[11px] font-bold uppercase tracking-wide text-amber-300 mb-1.5">
              Why this is not an entry right now
            </div>
            <ul className="text-[12.5px] text-[#c7d2dc] space-y-1 list-disc pl-4 leading-[16px]">
              {signal.blockers.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
          </div>
        )}
      </div>

      {pulse.note && (
        <p className="mt-3 text-[11.5px] text-amber-300/80 leading-[15px] border-l-2 border-amber-700/50 pl-2">
          {pulse.note}
        </p>
      )}
    </section>
  );
}

/** Score through the recorded sessions. Inline SVG — this is one line, not a chart library. */
function HistorySpark({ points }: { points: { day: string; score: number }[] }) {
  if (points.length < 2) {
    return (
      <p className="text-[12.5px] text-muted">
        {points.length === 1
          ? "One session recorded so far. The trail builds one point per session from here."
          : "No history recorded yet — the first point lands at the end of today's session."}
      </p>
    );
  }

  const w = 560;
  const h = 90;
  const xs = points.map((_, i) => (i / (points.length - 1)) * (w - 8) + 4);
  const ys = points.map((p) => h - 6 - (Math.max(0, Math.min(100, p.score)) / 100) * (h - 12));
  const d = xs.map((x, i) => `${i ? "L" : "M"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[90px]" role="img" aria-label="Momentum score history">
        {[25, 50, 75].map((g) => (
          <line key={g} x1={4} x2={w - 4} y1={h - 6 - (g / 100) * (h - 12)} y2={h - 6 - (g / 100) * (h - 12)} stroke="#1e2733" strokeWidth={1} />
        ))}
        <path d={d} fill="none" stroke="#4c8dff" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r={3.5} fill="#4c8dff" />
      </svg>
      <div className="flex justify-between text-[11px] text-muted">
        <span>{points[0].day}</span>
        <span>{points[points.length - 1].day}</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- page --- */

export default function DetailClient({ initial, source, symbol }: {
  initial: MomentumDetail; source?: string; symbol: string;
}) {
  const { data } = useLiveData<MomentumDetail>(
    initial,
    `/api/momentum/${encodeURIComponent(symbol)}`,
    DETAIL_REFRESH_MS,
  );
  const row = data.row;
  const factors = row.factors ?? [];

  const band = scoreBand(row.score);

  // Recomputed from the cards so the page cannot show a total that its own parts disagree
  // with. `rawScore` is before the coherence penalty, which is what this reconciles against.
  const { usedWeight, recomputed } = useMemo(() => {
    let sum = 0;
    let used = 0;
    for (const f of factors) {
      if (!f.available || f.score === null) continue;
      sum += f.score * f.weight;
      used += f.weight;
    }
    return { usedWeight: used, recomputed: used > 0 ? sum / used : 0 };
  }, [factors]);

  const penaltyPts = +(row.rawScore - row.score).toFixed(1);
  const drift = Math.abs(recomputed - row.rawScore);

  return (
    <main className="p-5">
      <Link href="/momentum-scanner" className="text-[13px] text-accent hover:underline">← Momentum Scanner</Link>

      {/* ---- headline ---- */}
      <header className="flex flex-wrap items-center gap-4 mt-3 mb-5">
        <SymbolAvatar symbol={row.symbol} className="w-[42px] h-[42px] text-[14px]" />
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight">{row.symbol}</h1>
            <a href={tvLink(row.symbol)} target="_blank" rel="noopener noreferrer" className="text-[12px] text-accent hover:underline">
              Chart ↗
            </a>
            <SourceBadge source={source} />
          </div>
          <div className="text-[13px] text-muted mt-0.5">
            {row.sector ?? "No mapped sector"} · rank {row.rank} · {ENRICHMENT_LABEL[row.enrichment]}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-4">
          <div className="text-right">
            <div className="text-[26px] font-black tabular-nums">{fmt(row.price)}</div>
            <div className={`text-[15px] font-bold tabular-nums ${row.changePct >= 0 ? "text-bull" : "text-bear"}`}>
              {pctStr(row.changePct)}
            </div>
          </div>
          <div
            className="grid place-items-center rounded-2xl w-[92px] h-[92px]"
            style={{ background: band.bg, color: band.fg }}
            title={`${band.label} · ${Math.round(row.coverage * 100)}% of the model computable`}
          >
            <div className="text-[34px] font-black leading-none tabular-nums">{row.score.toFixed(0)}</div>
            <div className="text-[10px] font-bold uppercase tracking-wide mt-1">{band.label}</div>
          </div>
        </div>
      </header>

      {/* ---- verdict ---- */}
      <section className="panel p-4 mb-4">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <Stat label="Direction" value={row.direction} cls={directionClass(row.direction)} />
          <Stat label="Confidence" value={row.confidence} />
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] uppercase tracking-wide text-muted">Trade type</span>
            <span className={`inline-block rounded-full border px-2.5 py-[5px] text-[12px] font-bold w-fit ${tradeClass(row.tradeType)}`}>
              {row.tradeType}
            </span>
          </div>
          <Stat label="Institutional activity" value={row.institutionalActivity} cls={activityClass(row.institutionalActivity)} />
          <Stat
            label="Coverage"
            value={`${Math.round(row.coverage * 100)}%`}
            hint={`${usedWeight} of the configured weight was computable for this row`}
          />
          <Stat
            label="Coherence penalty"
            value={penaltyPts > 0 ? `−${penaltyPts.toFixed(1)}` : "none"}
            cls={penaltyPts > 0 ? "text-amber-300" : "text-muted"}
            hint="Applied when the directional factors disagree with each other"
          />
        </div>
      </section>

      {/* ---- timing: whether there is any move left to buy ---- */}
      {row.signal && <TimingPanel signal={row.signal} targetLabel="a 35% option gain" />}

      {/* ---- the numbers the brief asks the detail page for ---- */}
      <section className="panel p-4 mb-4">
        <h2 className="text-[15px] font-semibold mb-3">Session</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-4">
          <Stat label="Previous close" value={fmt(row.prevClose)} />
          <Stat label="Volume" value={row.volume.toLocaleString("en-IN")} />
          <Stat label="Turnover" value={`₹${fmt(row.turnoverCr, 1)}Cr`} />
          <Stat label="RVOL" value={xStr(row.rvol.value)} cls={gradeClass(row.rvol.grade)} />
          <Stat label="VWAP" value={row.vwap.value == null ? "—" : fmt(row.vwap.value)} />
          <Stat
            label="vs VWAP"
            value={pctStr(row.vwap.distancePct)}
            cls={(row.vwap.distancePct ?? 0) >= 0 ? "text-bull" : "text-bear"}
          />
          <Stat label="VWAP slope" value={row.vwap.rising == null ? "—" : row.vwap.rising ? "Rising" : "Falling"} />
          <Stat label="ATR expansion" value={xStr(row.atrExpansion)} />
          <Stat
            label="Relative strength"
            value={pctStr(row.relativeStrengthPct)}
            cls={(row.relativeStrengthPct ?? 0) >= 0 ? "text-bull" : "text-bear"}
          />
          <Stat
            label="Sector strength"
            value={pctStr(row.sectorStrengthPct)}
            cls={(row.sectorStrengthPct ?? 0) >= 0 ? "text-bull" : "text-bear"}
          />
          <Stat label="OI build-up" value={row.oiBuildUp ?? "—"} cls={buildUpClass(row.oiBuildUp)} />
          <Stat
            label="Futures OI"
            value={row.oi?.futuresOi == null ? "—" : row.oi.futuresOi.toLocaleString("en-IN")}
            hint="Open interest on the near-month future. The share itself carries none."
          />
          <Stat
            label="OI change"
            value={pctStr(row.oi?.futuresOiChangePctIntraday)}
            cls={(row.oi?.futuresOiChangePctIntraday ?? 0) >= 0 ? "text-bull" : "text-bear"}
            hint="Intraday: live futures OI against the previous session's close."
          />
          <Stat
            label="PCR (OI)"
            value={row.oi?.pcrOi == null ? "—" : row.oi.pcrOi.toFixed(2)}
            hint="Put/call open interest across the near-month chain."
          />
          <Stat label="PCR (volume)" value={row.oi?.pcrVolume == null ? "—" : row.oi.pcrVolume.toFixed(2)} />
          <Stat label="Max pain" value={row.oi?.maxPain == null ? "—" : fmt(row.oi.maxPain, 0)} />
          <Stat label="Liquidity" value={row.liquidity.grade ?? "—"} cls={gradeClass(row.liquidity.grade)} />
          <Stat
            label="ATM IV"
            value={row.ivSummary?.atmIv == null ? "—" : `${row.ivSummary.atmIv.toFixed(1)}%`}
            hint={row.ivSummary ? `Rank basis: ${IV_BASIS_LABEL[row.ivSummary.basis]}` : undefined}
          />
          <Stat
            label="Expected move"
            value={row.expectedMove ? `±${row.expectedMove.pct.toFixed(1)}%` : "—"}
            hint={row.expectedMove ? `±₹${row.expectedMove.rupees} over ${row.expectedMove.days} days, from the ATM straddle` : undefined}
          />
        </div>
      </section>

      {/* ---- explanation ---- */}
      <section className="panel p-4 mb-4">
        <h2 className="text-[15px] font-semibold mb-3">Why this score</h2>
        <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-1.5">
          {row.reasons.map((r, i) => (
            <li key={i} className={`text-[13px] leading-[18px] ${r.ok ? "text-[#c7d2dc]" : "text-[#7d8895]"}`}>
              <span className={r.ok ? "text-bull" : "text-bear"}>{r.ok ? "✓" : "✗"}</span> {r.text}
            </li>
          ))}
        </ul>
      </section>

      {/* ---- factor grid ---- */}
      <h2 className="text-[15px] font-semibold mb-3">Factor breakdown</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {factors.map((f) => <FactorCard key={f.key} f={f} totalWeight={usedWeight || 1} />)}
      </div>

      {/* ---- reconciliation ---- */}
      <section className="panel p-4 mt-4">
        <h2 className="text-[15px] font-semibold mb-2">The arithmetic</h2>
        <p className="text-[13px] text-muted leading-relaxed max-w-3xl">
          Weighted mean over the <strong className="text-white">{usedWeight}</strong> weight that was computable
          {" "}= <strong className="text-white tabular-nums">{recomputed.toFixed(1)}</strong>.
          {penaltyPts > 0
            ? <> A coherence penalty of <strong className="text-amber-300 tabular-nums">{penaltyPts.toFixed(1)}</strong> points applies because the directional factors disagree, giving <strong className="text-white tabular-nums">{row.score.toFixed(1)}</strong>.</>
            : <> The directional factors agree, so no coherence penalty applies and the score is <strong className="text-white tabular-nums">{row.score.toFixed(1)}</strong>.</>}
          {drift >= 0.15 && (
            <span className="text-bear"> The cards above sum to {recomputed.toFixed(2)}, which disagrees with the reported raw score of {row.rawScore}. That is a bug — please report it.</span>
          )}
        </p>
      </section>

      {/* ---- history ---- */}
      <section className="panel p-4 mt-4">
        <h2 className="text-[15px] font-semibold mb-3">Historical momentum</h2>
        <HistorySpark points={data.history.map((h) => ({ day: h.day, score: h.score }))} />
        {data.history.length > 0 && (
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-[12.5px] tabular-nums">
              <thead>
                <tr className="text-muted text-left">
                  <th className="py-1.5 pr-4 font-semibold">Session</th>
                  <th className="py-1.5 pr-4 font-semibold">Score</th>
                  <th className="py-1.5 pr-4 font-semibold">Direction</th>
                  <th className="py-1.5 pr-4 font-semibold">Close</th>
                  <th className="py-1.5 pr-4 font-semibold">RVOL</th>
                  <th className="py-1.5 pr-4 font-semibold">ATM IV</th>
                  <th className="py-1.5 font-semibold">HV20</th>
                </tr>
              </thead>
              <tbody>
                {[...data.history].reverse().slice(0, 20).map((h) => (
                  <tr key={h.day} className="border-t border-border">
                    <td className="py-1.5 pr-4">{h.day}</td>
                    <td className="py-1.5 pr-4 font-bold">{h.score.toFixed(0)}</td>
                    <td className={`py-1.5 pr-4 ${directionClass(h.direction)}`}>{h.direction}</td>
                    <td className="py-1.5 pr-4">{fmt(h.close)}</td>
                    <td className="py-1.5 pr-4">{xStr(h.rvol)}</td>
                    <td className="py-1.5 pr-4">{h.atmIv == null ? "—" : `${h.atmIv.toFixed(1)}%`}</td>
                    <td className="py-1.5">{h.hv20 == null ? "—" : `${h.hv20.toFixed(1)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[11.5px] text-muted leading-relaxed max-w-3xl">
          One row per session, written at the last scan of the day. The ATM IV column is what an IV Rank is eventually
          built from — Upstox publishes no implied-volatility history, so this table accumulates it from the day the
          scanner was deployed.
        </p>
      </section>

      {data.warnings.length > 0 && (
        <section className="panel p-3.5 mt-4 border-amber-800/50">
          <div className="text-[12px] font-bold uppercase tracking-wide text-amber-300 mb-1.5">Board warnings</div>
          <ul className="text-[13px] text-muted space-y-1 list-disc pl-5">
            {data.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </section>
      )}
    </main>
  );
}
