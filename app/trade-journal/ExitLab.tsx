"use client";

// Ask the archive a question the journal was not built to answer.
//
// The shadow column beside every trade is a FIXED set of alternatives, decided at settlement and
// frozen into the row. That is the right shape for "how did the shipped rule do against the usual
// suspects", and the wrong shape for "what would MY stop have made" — which is the question that
// actually gets asked, and which used to mean opening a terminal and editing `tools/exit-lab.ts`.
//
// So this posts arbitrary rules at `/api/momentum/journal/exit-lab`, which re-walks the archived
// 1-minute option candles of the real trades. Same grader as the shipped journal, same convention
// that an ambiguous minute resolves as the stop, same ₹120 a lot. Nothing here is a model.
//
// AND IT SWEEPS, rather than answering once. A single rule graded once is a number, and a number
// is exactly what went wrong before: +24%→+6% measured on 78 trades looked like a +₹20k edge and
// on 244 trades is −₹13,655. Drawn as a curve across every arming level, a fitted spike and a
// real plateau are told apart at a glance.

import { useCallback, useState } from "react";
import EChart from "@/components/EChart";
import { inr, JournalView, pct, plural } from "@/lib/journal";
import { sweepOption } from "./charts";
import { Card, sign } from "./parts";

/* --------------------------------------------------------------------------- shapes --- */

interface LabResult {
  name: string;
  net: number;
  wins: number;
  losses: number;
  trades: number;
  winRate: number | null;
  worst: number;
  best: number;
  maxDrawdown: number;
  outs: { target: number; stop: number; close: number };
}

interface LabReport {
  from: string;
  to: string;
  graded: number;
  missing: number;
  results: LabResult[];
}

/** The arming levels the sweep walks. Wide enough to show the shape either side of the peak. */
const SWEEP = [8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 34, 38];

const FLAT = "no checkpoint";
const MINE = "your rule";

/* ---------------------------------------------------------------------------- input --- */

function Pct({ label, value, onChange, min, max, hint }: {
  label: string; value: number; onChange: (n: number) => void;
  min: number; max: number; hint?: string;
}) {
  return (
    <label className="block" title={hint}>
      <span className="text-[10px] uppercase tracking-[0.09em] text-muted">{label}</span>
      <div className="mt-1 flex items-center rounded-lg border border-border bg-black/25 focus-within:border-accent/60">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={1}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, n)));
          }}
          className="w-[62px] bg-transparent px-2.5 py-2 text-sm text-white tabular-nums outline-none"
        />
        <span className="pr-2.5 text-[12px] text-muted">%</span>
      </div>
    </label>
  );
}

/* ------------------------------------------------------------------------ the panel --- */

export function ExitLab({ config, from, to, channel }: {
  config: JournalView["config"];
  /** The range on screen, for the "this range only" scope. */
  from: string;
  to: string;
  channel: string | null;
}) {
  const [tp, setTp] = useState(Math.round(100 * config.tpPct));
  const [sl, setSl] = useState(Math.round(100 * config.slPct));
  const [arm, setArm] = useState(Math.round(100 * (config.armAtPct ?? 0)));
  const [lock, setLock] = useState(Math.round(100 * (config.lockPct ?? 0)));
  const [wholeArchive, setWholeArchive] = useState(true);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<LabReport | null>(null);

  const run = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const rules: Array<Record<string, unknown>> = [
        { name: FLAT, tp: tp / 100, sl: sl / 100 },
      ];
      if (arm > 0) rules.push({ name: MINE, tp: tp / 100, sl: sl / 100, armAt: arm / 100, lock: lock / 100 });
      // The sweep re-asks the same rule at every arming level, so the answer arrives as a shape
      // rather than as a single figure with no context around it.
      for (const a of SWEEP) {
        rules.push({ name: `arm ${a}`, tp: tp / 100, sl: sl / 100, armAt: a / 100, lock: lock / 100 });
      }

      const res = await fetch("/api/momentum/journal/exit-lab", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(wholeArchive ? {} : { from, to }),
          ...(channel ? { channel } : {}),
          rules,
        }),
      });
      const j = await res.json();
      if (!res.ok || !j?.data) throw new Error(j?.error ?? `exit lab returned ${res.status}`);
      setReport(j.data as LabReport);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [tp, sl, arm, lock, wholeArchive, from, to, channel]);

  const find = (name: string) => report?.results.find((r) => r.name === name) ?? null;
  const flat = find(FLAT);
  const mine = find(MINE);
  const sweep = (report?.results ?? [])
    .filter((r) => r.name.startsWith("arm "))
    .map((r) => ({ arm: Number(r.name.slice(4)) / 100, net: r.net }));

  const shipped = Math.round(100 * (config.armAtPct ?? 0)) === arm
    && Math.round(100 * (config.lockPct ?? 0)) === lock
    && Math.round(100 * config.tpPct) === tp
    && Math.round(100 * config.slPct) === sl;

  return (
    <Card
      title="Test an exit rule"
      sub="Re-graded on the archived 1-minute candles of your own trades — the same grader the journal settles with, not a model"
    >
      <div className="flex flex-wrap items-end gap-3">
        <Pct label="Target" value={tp} onChange={setTp} min={1} max={500}
          hint="Take profit, as a percentage of the premium paid." />
        <Pct label="Stop" value={sl} onChange={setSl} min={1} max={99}
          hint="The opening stop, as a percentage of the premium paid." />
        <Pct label="Arm at" value={arm} onChange={setArm} min={0} max={100}
          hint="Once the position has been up this much, the stop moves once. 0 switches the checkpoint off." />
        <Pct label="Lock to" value={lock} onChange={setLock} min={-90} max={200}
          hint="Where the stop moves to once armed. It never moves again." />

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setWholeArchive((v) => !v)}
            className={`h-[36px] px-3 rounded-lg border text-[12px] transition-colors ${
              wholeArchive
                ? "border-border bg-chip text-white"
                : "border-accent/40 bg-accent/[0.08] text-accent"
            }`}
            title="A month is not a sample. The whole archive is the honest default for an exit study."
          >
            {wholeArchive ? "Whole archive" : "This range only"}
          </button>
          <button
            type="button"
            onClick={() => void run()}
            disabled={busy}
            className="h-[36px] px-4 rounded-lg bg-accent text-white text-[13px] font-semibold
                       hover:brightness-110 disabled:opacity-50 transition"
          >
            {busy ? "Grading…" : "Grade it"}
          </button>
        </div>
      </div>

      {error && <p className="text-bear text-[12px] mt-3">{error}</p>}

      {report && flat && (
        <div className="mt-4">
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <Score
              label={arm > 0 ? `+${tp}/−${sl} →${lock >= 0 ? "+" : "−"}${Math.abs(lock)}@${arm}` : `+${tp}/−${sl}`}
              note={shipped ? "this is what ships today" : "the rule you typed"}
              row={mine ?? flat}
              accent
            />
            <Score label={`+${tp}/−${sl} flat`} note="no checkpoint at all" row={flat} />
            {mine && (
              <Score
                label="Difference"
                note={mine.net >= flat.net ? "the checkpoint earns this" : "the checkpoint costs this"}
                delta={mine.net - flat.net}
              />
            )}
            <Score
              label="Sample"
              plain={`${plural(report.graded, "trade")}`}
              note={
                report.missing > 0
                  ? `${report.missing} had no archived path and were left out`
                  : `${report.from === "2000-01-01" ? "the whole archive" : `${report.from} → ${report.to}`}`
              }
            />
          </div>

          {sweep.length > 1 && (
            <div className="mt-5">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-[10px] uppercase tracking-[0.09em] text-muted">
                  Net against the arming level
                </span>
                <span className="text-[11px] text-muted">
                  same target, stop and lock — only the trigger moves
                </span>
              </div>
              <EChart option={sweepOption(sweep, flat.net, arm / 100)} height="clamp(200px, 26vh, 300px)" />
              <p className="text-[11px] text-muted mt-2 leading-relaxed">
                A curve that rises and falls steeply across neighbouring levels is a fitted spike,
                not an edge — the level that wins on this book would not be the one that wins on
                the next. Prefer a level sitting on a flat stretch above the dashed line, and
                discount it for slippage: every checkpoint exit pays the spread again, and these
                contracts carry roughly {pct(0.01, 0, false)} of it.
              </p>
            </div>
          )}
        </div>
      )}

      {!report && !error && (
        <p className="text-[11.5px] text-muted mt-3 leading-relaxed">
          Nothing has been graded yet. The numbers above the fold are the record as it stands; this
          re-walks the same trades under whatever rule you type, so the two can be compared on the
          same prices rather than on an argument.
        </p>
      )}
    </Card>
  );
}

/** One figure of the comparison. `delta` renders a difference, `plain` a non-money string. */
function Score({ label, note, row, delta, plain, accent = false }: {
  label: string;
  note: string;
  row?: LabResult | null;
  delta?: number;
  plain?: string;
  accent?: boolean;
}) {
  const value = plain !== undefined
    ? plain
    : delta !== undefined
      ? inr(delta, true)
      : row ? inr(row.net, true) : "—";
  const cls = plain !== undefined ? "" : sign(delta !== undefined ? delta : row?.net ?? null);

  return (
    <div className={`rounded-xl border p-3 ${
      accent ? "border-accent/40 bg-accent/[0.06]" : "border-border bg-black/20"
    }`}>
      <div className="text-[10px] uppercase tracking-[0.09em] text-muted truncate" title={label}>
        {label}
      </div>
      <div className={`text-[19px] font-bold tabular-nums leading-tight mt-1 ${cls}`}>{value}</div>
      <div className="text-[10.5px] text-muted mt-0.5 truncate" title={note}>{note}</div>
      {row && delta === undefined && plain === undefined && (
        <div className="text-[10.5px] text-muted mt-1.5 tabular-nums">
          {row.winRate === null ? "—" : pct(row.winRate, 0, false)} won · worst{" "}
          <span className="text-bear">{inr(row.worst, true)}</span> · dip{" "}
          <span className="text-bear">{inr(-row.maxDrawdown)}</span>
        </div>
      )}
    </div>
  );
}
