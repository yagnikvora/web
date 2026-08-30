"use client";

// The two things this page can change: what a row's prices are, and whether a position is
// still open. Both ask first, and both show the money the answer books.

import { ReactNode, useCallback, useEffect, useState } from "react";
import { SymbolAvatar } from "@/components/SymbolAvatar";
import {
  CHANNEL_LABEL, EXIT_LABEL, inr, JournalTrade, liveOf, pct, prem, sessionClock,
} from "@/lib/journal";
import { sign } from "./parts";

/* ------------------------------------------------------------------------ the shell --- */

/**
 * The modal both dialogs sit in.
 *
 * Escape closes it, the backdrop closes it, and the panel itself does not — a click that lands
 * on the numbers you are reading should never dismiss the thing you are reading them in.
 */
function Modal({ title, sub, avatar, children, onClose }: {
  title: ReactNode; sub?: ReactNode; avatar?: string; children: ReactNode; onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full sm:max-w-md bg-panel border border-border rounded-t-2xl sm:rounded-2xl
                   shadow-[0_30px_80px_-20px_rgba(0,0,0,.9)] p-5 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          {avatar && <SymbolAvatar symbol={avatar} className="w-[34px] h-[34px] text-[11px] shrink-0" />}
          <div className="min-w-0">
            <h2 className="text-[16px] font-bold tracking-tight">{title}</h2>
            {sub && <p className="text-[11.5px] text-muted mt-0.5">{sub}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="close"
            className="ml-auto -mt-1 -mr-1 w-8 h-8 grid place-items-center rounded-lg text-muted
                       hover:text-white hover:bg-white/[0.06] shrink-0"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** One row of the money box. */
function Line({ label, value, note, cls = "", strong = false }: {
  label: string; value: string; note?: string; cls?: string; strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between px-3.5 py-2.5">
      <span className="text-[11.5px] text-muted">{label}</span>
      <span className="text-right">
        <span className={`tabular-nums ${strong ? "text-[16px] font-bold" : "text-[13px]"} ${cls}`}>
          {value}
        </span>
        {note && <span className="text-[10.5px] text-muted ml-1.5">{note}</span>}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ the manual exit --- */

/**
 * Confirm selling one open position, at whatever the feed is bidding.
 *
 * IT ASKS BEFORE IT SELLS, and that is the whole reason this is a dialog. Every other control on
 * this page is reversible or read-only; this one ends a live position while the market is open,
 * from a row in a table that re-sorts itself every thirty seconds. What makes a dialog the right
 * shape rather than merely a safer one is that a confirmation is only worth asking for if it
 * shows you something the button could not: the price, and the money that price books.
 *
 * THE NUMBERS KEEP MOVING WHILE IT IS OPEN, because the page is still polling and the parent
 * resolves this row fresh on every render. A frozen quote would be the one dishonest thing a
 * confirmation could do — agreeing to a figure that stopped being true while you read it.
 *
 * AND THE FIGURE IS STILL NOT THE FILL. The server prices the sale from the feed at the instant
 * the request lands, which is a moment later and a different tick. It is said plainly below
 * rather than left to be discovered from a row that closed a rupee away from what was quoted.
 */
export function ExitDialog({ trade, chargePerLot, onClose, onExited }: {
  trade: JournalTrade; chargePerLot: number; onClose: () => void; onExited: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const live = liveOf(trade, chargePerLot);
  // The row can close underneath an open dialog — the target or the stop can fire on the very
  // tick you are reading. Better to say so than to let the confirm fail with "already closed".
  const gone = trade.status !== "open" || trade.exit !== null;

  const go = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/momentum/journal/${encodeURIComponent(trade.id)}/exit`, {
        method: "POST",
      });
      const j = await res.json();
      // The upstream refusals are specific and actionable — "already closed" and "no price in the
      // last 120s" want different things from you — so the message is shown as it arrived.
      if (!res.ok) throw new Error(j?.error ?? `exit failed (${res.status})`);
      onExited();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [trade.id, onExited]);

  return (
    <Modal
      onClose={onClose}
      avatar={trade.symbol}
      title={`Close ${trade.symbol} ${trade.contract?.label ?? ""}?`}
      sub={
        <>
          {trade.day} · {CHANNEL_LABEL[trade.channel]} · bought {prem(trade.entry.premium)} at{" "}
          {sessionClock(trade.entry.minute)} · {trade.lots} lot × {trade.contract?.lotSize ?? "—"}
        </>
      }
    >
      {gone ? (
        <p className="text-amber-400 text-[13px] mt-4">
          This position has already closed
          {trade.exit ? ` — ${EXIT_LABEL[trade.exit.reason].toLowerCase()}` : ""}. Nothing left to sell.
        </p>
      ) : (
        <>
          <div className="rounded-xl border border-border bg-black/25 mt-4 divide-y divide-border">
            <Line label="Selling at" value={live ? prem(live.premium) : "—"} note="the bid, live" strong />
            <Line label="Gross" value={inr(live?.gross ?? null, true)} cls={sign(live?.gross)} />
            <Line label="Charges" value={live ? inr(-live.charges) : "—"} cls="text-muted" note="round trip" />
            <Line
              label="Net"
              value={inr(live?.net ?? null, true)}
              note={live ? pct(live.netPct) : undefined}
              cls={sign(live?.net)}
              strong
            />
          </div>

          {!live && (
            <p className="text-amber-400 text-[11.5px] mt-3">
              The feed has no price on this contract right now, so there is nothing to quote. The
              exit will be refused unless a print arrives — use{" "}
              <span className="font-medium">my fill</span> to record the price you actually got.
            </p>
          )}

          <p className="text-[11.5px] text-muted mt-3 leading-relaxed">
            Priced from the feed when you confirm, so the fill may differ from the figure above by a
            tick. Recorded as <span className="text-white">your</span> exit — the nightly settlement
            will not overwrite it, and <span className="text-white">Revert to settled</span> undoes
            it. Nothing is sent to your broker.
          </p>
        </>
      )}

      {err && <p className="text-bear text-[12px] mt-3">{err}</p>}

      <div className="flex items-center gap-2 mt-5">
        {!gone && (
          <button
            onClick={() => void go()}
            disabled={busy}
            className="px-4 py-2.5 rounded-xl bg-bear text-white text-[13px] font-semibold
                       hover:brightness-110 disabled:opacity-50 transition"
          >
            {busy ? "Selling…" : live ? `Sell at ${prem(live.premium)}` : "Sell at the bid"}
          </button>
        )}
        <button onClick={onClose} className="ml-auto px-3 py-2 text-[13px] text-muted hover:text-white">
          {gone ? "Close" : "Cancel"}
        </button>
      </div>
    </Modal>
  );
}

/* --------------------------------------------------------------------- the edit form --- */

/**
 * Replace what the feed recorded with what the broker filled.
 *
 * Deliberately only four fields. A journal that asks for the whole contract note will not get
 * filled in; the two prices and the lot count are what change the money.
 */
export function EditDialog({ trade, onClose, onSaved }: {
  trade: JournalTrade; onClose: () => void; onSaved: () => void;
}) {
  const [entryPremium, setEntry] = useState(String(trade.entry.premium));
  const [exitPremium, setExit] = useState(trade.exit ? String(trade.exit.premium) : "");
  const [lots, setLots] = useState(String(trade.lots));
  const [note, setNote] = useState(trade.note);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // What the numbers in the boxes would book, updated as they are typed. The point of the form
  // is the money it changes, so the money is on screen while it is being changed.
  const size = (trade.contract?.lotSize ?? 0) * (Number(lots) || 0);
  const inP = Number(entryPremium);
  const outP = Number(exitPremium);
  const preview = size > 0 && Number.isFinite(inP) && Number.isFinite(outP) && exitPremium !== ""
    ? { gross: (outP - inP) * size, used: inP * size }
    : null;

  const save = async (reset = false) => {
    setSaving(true);
    setErr(null);
    try {
      const body = reset
        ? { reset: true }
        : {
          entryPremium: entryPremium === "" ? undefined : Number(entryPremium),
          exitPremium: exitPremium === "" ? undefined : Number(exitPremium),
          lots: Number(lots),
          note,
        };
      const res = await fetch(`/api/momentum/journal/${encodeURIComponent(trade.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? `save failed (${res.status})`);
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      avatar={trade.symbol}
      title={`${trade.symbol} ${trade.contract?.label ?? ""}`}
      sub={
        <>
          {trade.day} · {CHANNEL_LABEL[trade.channel]} · signalled {sessionClock(trade.entry.minute)}.
          Saving your own prices stops the nightly settlement from overwriting this row.
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 mt-4">
        <Field label="Buy price" value={entryPremium} onChange={setEntry} />
        <Field label="Sell price" value={exitPremium} onChange={setExit} placeholder="still open" />
        <Field label="Lots" value={lots} onChange={setLots} />
        <div>
          <span className="text-[10px] uppercase tracking-[0.09em] text-muted">Lot size</span>
          <div className="mt-1 rounded-lg border border-border bg-black/25 px-3 py-2 text-sm text-muted tabular-nums">
            {trade.contract?.lotSize ?? "—"}
          </div>
        </div>
      </div>

      {preview && (
        <div className="mt-3 rounded-xl border border-border bg-black/25 divide-y divide-border">
          <Line label="Premium deployed" value={inr(preview.used)} cls="text-muted" />
          <Line
            label="Gross on these prices"
            value={inr(preview.gross, true)}
            cls={sign(preview.gross)}
            note="charges are applied by the API"
          />
        </div>
      )}

      <label className="block mt-3">
        <span className="text-[10px] uppercase tracking-[0.09em] text-muted">Note</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="why you took it, or didn't"
          className="mt-1 w-full rounded-lg border border-border bg-black/25 px-3 py-2 text-sm text-white
                     placeholder:text-muted/60 outline-none focus:border-accent/60"
        />
      </label>

      {err && <p className="text-bear text-[12px] mt-3">{err}</p>}

      <div className="flex items-center gap-2 mt-5">
        <button
          onClick={() => void save()}
          disabled={saving}
          className="px-4 py-2.5 rounded-xl bg-accent text-white text-[13px] font-semibold
                     hover:brightness-110 disabled:opacity-50 transition"
        >
          {saving ? "Saving…" : "Save my fill"}
        </button>
        {trade.edited && (
          <button
            onClick={() => void save(true)}
            disabled={saving}
            className="px-3 py-2.5 rounded-xl border border-border text-muted text-[13px] hover:bg-chip
                       hover:text-white transition"
            title="Discard your prices and let the nightly settlement own this row again"
          >
            Revert to settled
          </button>
        )}
        <button onClick={onClose} className="ml-auto px-3 py-2 text-[13px] text-muted hover:text-white">
          Cancel
        </button>
      </div>
    </Modal>
  );
}

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-[0.09em] text-muted">{label}</span>
      <input
        type="number"
        step="0.05"
        min="0"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-border bg-black/25 px-3 py-2 text-sm text-white
                   tabular-nums placeholder:text-muted/60 outline-none focus:border-accent/60"
      />
    </label>
  );
}
