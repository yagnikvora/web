"use client";

import { useMemo, useState } from "react";
import { stampTime, titleCase } from "@/lib/format";
import {
  DataTable, Num, PctChip, RowIcons, SignalPill, SymbolCell, TableCard, type Col,
} from "@/components/table";
import type { ScanRow, ScannerGroups } from "@/lib/types";

// One scanner. Which columns it gets depends on what its rows actually carry: the
// structure scanners publish a BULL/BEAR call and the momentum ones don't, and a group
// with no prices would otherwise print a column of dashes.
function Scanner({ name, rows }: { name: string; rows: ScanRow[] }) {
  const [q, setQ] = useState("");

  const cols = useMemo<Col<ScanRow>[]>(() => {
    const out: Col<ScanRow>[] = [
      { h: "Symbol", val: (r) => r.Symbol, render: (r) => <SymbolCell sym={r.Symbol} /> },
      { h: "", render: (r) => <RowIcons sym={r.Symbol} /> },
      { h: "%", val: (r) => r.pChange, render: (r) => <PctChip v={r.pChange} /> },
    ];
    if (rows.some((r) => r.price > 0))
      out.push({ h: "Price", val: (r) => r.price, render: (r) => <Num>{r.price ? r.price.toFixed(2) : "—"}</Num> });
    if (rows.some((r) => r.signal))
      out.push({ h: "Signal", render: (r) => (r.signal ? <SignalPill bull={r.signal === "BULL"} /> : <Num cls="text-muted">—</Num>) });
    // The date is on the row's title, since every row in a scanner is from the same session.
    out.push({
      h: "When", val: (r) => r.when,
      render: (r) => <Num cls="text-muted whitespace-nowrap"><span title={r.when}>{stampTime(r.when)}</span></Num>,
    });
    return out;
  }, [rows]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => r.Symbol.toLowerCase().includes(needle));
  }, [rows, q]);

  return (
    <TableCard title={titleCase(name)} live search={{ value: q, onChange: setQ }}>
      <DataTable cols={cols} rows={shown} rowKey={(r, i) => r.Symbol + i} initialSort={2} height={430} />
    </TableCard>
  );
}

export default function ScannerGrid({ groups }: { groups: ScannerGroups }) {
  return (
    <div className="grid gap-5 grid-cols-1 xl:grid-cols-2 items-start">
      {Object.entries(groups).map(([name, rows]) => (
        <Scanner key={name} name={name} rows={rows} />
      ))}
    </div>
  );
}
