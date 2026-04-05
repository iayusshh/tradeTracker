"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { buildPayoffSeries } from "@/lib/math/payoff";
import { computeOptionLegSnapshot } from "@/lib/math/pnl";
import { PayoffChart } from "@/components/charts/PayoffChart";
import { formatInr, pnlColor } from "@/lib/format";

export type SerializedLeg = {
  id: string;
  side: "BUY" | "SELL";
  optionType: "CALL" | "PUT";
  strike: number;
  expiry: string;
  quantity: number;
  lotSize: number;
  executions: {
    id: string;
    kind: "ENTRY" | "EXIT" | "ADJUSTMENT";
    executedAt: string;
    optionPrice: number;
    quantity: number;
    underlyingLtp: number;
    fees: number;
  }[];
};

type EditState = {
  side: "BUY" | "SELL";
  optionType: "CALL" | "PUT";
  strike: number;
  expiry: string;
  quantity: number;
  lotSize: number;
  entryPrice: string;
};

type Props = {
  groupId: string;
  legs: SerializedLeg[];
  strikeStep: number;
  currentPrice: number;
  targetDate: string | null;
};

function SideToggle({
  value,
  onChange,
}: {
  value: "BUY" | "SELL";
  onChange: (v: "BUY" | "SELL") => void;
}) {
  return (
    <div className="flex">
      <button type="button" onClick={() => onChange("BUY")}
        className={`h-8 w-10 rounded-l-lg border text-xs font-bold transition-colors ${
          value === "BUY" ? "border-blue-600 bg-blue-600 text-white z-10" : "border-slate-300 bg-white text-slate-400 hover:bg-slate-50"
        }`}
      >B</button>
      <button type="button" onClick={() => onChange("SELL")}
        className={`h-8 w-10 rounded-r-lg border-y border-r text-xs font-bold transition-colors ${
          value === "SELL" ? "border-rose-600 bg-rose-600 text-white z-10" : "border-slate-300 bg-white text-slate-400 hover:bg-slate-50"
        }`}
      >S</button>
    </div>
  );
}

function TypeToggle({
  value,
  onChange,
}: {
  value: "CALL" | "PUT";
  onChange: (v: "CALL" | "PUT") => void;
}) {
  return (
    <div className="flex">
      <button type="button" onClick={() => onChange("CALL")}
        className={`h-8 w-11 rounded-l-lg border text-xs font-bold transition-colors ${
          value === "CALL" ? "border-teal-700 bg-teal-700 text-white z-10" : "border-slate-300 bg-white text-slate-400 hover:bg-slate-50"
        }`}
      >CE</button>
      <button type="button" onClick={() => onChange("PUT")}
        className={`h-8 w-11 rounded-r-lg border-y border-r text-xs font-bold transition-colors ${
          value === "PUT" ? "border-teal-700 bg-teal-700 text-white z-10" : "border-slate-300 bg-white text-slate-400 hover:bg-slate-50"
        }`}
      >PE</button>
    </div>
  );
}

function StrikeInput({
  value,
  step,
  onChange,
}: {
  value: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex">
      <button type="button" onClick={() => onChange(value - step)}
        className="h-8 w-7 rounded-l-lg border border-slate-300 bg-white text-slate-500 hover:bg-slate-100 text-base font-medium transition-colors"
      >−</button>
      <input
        type="text" inputMode="numeric"
        value={value}
        onChange={e => { const n = parseFloat(e.target.value); if (!isNaN(n)) onChange(n); }}
        className="h-8 w-20 border-y border-slate-300 text-center text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-teal-500"
      />
      <button type="button" onClick={() => onChange(value + step)}
        className="h-8 w-7 rounded-r-lg border border-slate-300 bg-white text-slate-500 hover:bg-slate-100 text-base font-medium transition-colors"
      >+</button>
    </div>
  );
}

function LotsInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex">
      <button type="button" onClick={() => onChange(Math.max(1, value - 1))}
        className="h-8 w-7 rounded-l-lg border border-slate-300 bg-white text-slate-500 hover:bg-slate-100 text-base font-medium transition-colors"
      >−</button>
      <input
        type="text" inputMode="numeric"
        value={value}
        onChange={e => { const n = parseInt(e.target.value); if (!isNaN(n) && n >= 1) onChange(n); }}
        className="h-8 w-12 border-y border-slate-300 text-center text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-teal-500"
      />
      <button type="button" onClick={() => onChange(value + 1)}
        className="h-8 w-7 rounded-r-lg border border-slate-300 bg-white text-slate-500 hover:bg-slate-100 text-base font-medium transition-colors"
      >+</button>
    </div>
  );
}

export function EditableLegsList({ groupId, legs, strikeStep, currentPrice, targetDate }: Props) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // For the payoff chart: legs with no executions get a synthetic entry at price 0
  // so the chart always shows the strategy shape (intrinsic value at expiry).
  const legsForChart = legs.map(leg =>
    leg.executions.length > 0
      ? leg
      : {
          ...leg,
          executions: [{
            id: "__preview__",
            kind: "ENTRY" as const,
            executedAt: new Date().toISOString(),
            optionPrice: 0,
            quantity: leg.quantity,
            underlyingLtp: currentPrice,
            fees: 0,
          }],
        }
  );

  const chart = buildPayoffSeries({
    legs: legsForChart,
    currentPrice,
    targetDate: targetDate ? new Date(targetDate) : null,
  });
  const isTheoreticalChart = legs.every(l => l.executions.length === 0);

  function startEdit(leg: SerializedLeg) {
    const snapshot = computeOptionLegSnapshot(leg);
    setEditingId(leg.id);
    setEditState({
      side: leg.side,
      optionType: leg.optionType,
      strike: leg.strike,
      expiry: leg.expiry.slice(0, 10),
      quantity: leg.quantity,
      lotSize: leg.lotSize,
      entryPrice: leg.executions.length > 0 ? snapshot.averageEntryPrice.toFixed(2) : "",
    });
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditState(null);
    setError(null);
  }

  async function saveLeg(legId: string) {
    if (!editState) return;
    setSaving(true);
    setError(null);
    try {
      const entryPrice = editState.entryPrice.trim() === ""
        ? null
        : Number(editState.entryPrice);

      if (entryPrice !== null && (!Number.isFinite(entryPrice) || entryPrice <= 0)) {
        setError("Entry price must be a valid number greater than 0.");
        return;
      }

      const res = await fetch(`/api/admin/positional/${groupId}/legs/${legId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          side: editState.side,
          optionType: editState.optionType,
          strike: editState.strike,
          expiry: editState.expiry,
          quantity: editState.quantity,
          lotSize: editState.lotSize,
          entryPrice,
        }),
      });
      const payload = await res.json() as { error?: unknown };
      if (!res.ok) {
        setError(typeof payload.error === "string" ? payload.error : "Validation error.");
        return;
      }
      setEditingId(null);
      setEditState(null);
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteLeg(legId: string) {
    setDeleting(legId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/positional/${groupId}/legs/${legId}`, { method: "DELETE" });
      if (res.status === 409) {
        const payload = await res.json() as { error: string };
        setError(payload.error);
        return;
      }
      if (!res.ok) { setError("Could not delete."); return; }
      if (editingId === legId) { setEditingId(null); setEditState(null); }
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setDeleting(null);
    }
  }

  if (legs.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-400">
        No legs yet. Add one above.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Payoff chart */}
      <div className="relative min-w-0">
        <PayoffChart data={chart.points} currentPrice={chart.currentPrice} breakevens={chart.breakevens} />
        {isTheoreticalChart && chart.points.length > 0 && (
          <span className="absolute right-4 top-4 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700">
            Theoretical · add entry price for actual P&amp;L
          </span>
        )}
      </div>

      {/* Editable legs table */}
      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Legs</p>
        </div>

        <div className="divide-y divide-slate-50">
          {legs.map(leg => {
            const snapshot = computeOptionLegSnapshot(leg);
            const displayLots = leg.quantity;
            const sideColor = leg.side === "BUY" ? "bg-blue-600" : "bg-rose-600";
            const isEditing = editingId === leg.id;

            return (
              <div key={leg.id}>
                {/* Summary row */}
                <div className={`flex items-center gap-3 px-5 py-3 ${isEditing ? "bg-slate-50" : "hover:bg-slate-50/60"} transition-colors`}>
                  <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold text-white ${sideColor}`}>
                    {leg.side === "BUY" ? "B" : "S"}
                  </span>
                  <span className="w-24 text-sm font-semibold text-slate-800">
                    {leg.optionType === "CALL" ? "CE" : "PE"} {leg.strike}
                  </span>
                  <span className="w-24 text-xs text-slate-500">{format(new Date(leg.expiry), "dd MMM yyyy")}</span>
                  <span className="w-28 text-right text-xs text-slate-600">
                    {displayLots > 0 ? (
                      <>
                        <span className="font-medium text-slate-800">{displayLots * leg.lotSize}</span>
                        <span className="text-slate-400"> units</span>
                        <span className="ml-1 text-slate-300">({displayLots}×{leg.lotSize})</span>
                        {leg.executions.length > 0 && snapshot.openQuantity !== displayLots && (
                          <span className="ml-1 text-slate-300">open {snapshot.openQuantity}</span>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </span>
                  <span className="w-20 text-right text-xs text-slate-600">{snapshot.averageEntryPrice.toFixed(2)} avg</span>
                  <span className={`flex-1 text-right text-xs font-semibold ${pnlColor(snapshot.totalPnl)}`}>
                    {formatInr(snapshot.totalPnl)}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {isEditing ? (
                      <button type="button" onClick={cancelEdit}
                        className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-200 transition-colors"
                      >Cancel</button>
                    ) : (
                      <button type="button" onClick={() => startEdit(leg)}
                        className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-200 transition-colors"
                      >Edit</button>
                    )}
                    <button type="button"
                      onClick={() => deleteLeg(leg.id)}
                      disabled={deleting === leg.id}
                      className="rounded-md px-2 py-1 text-xs text-rose-400 hover:bg-rose-50 disabled:opacity-40 transition-colors"
                    >
                      {deleting === leg.id ? "…" : "Delete"}
                    </button>
                  </div>
                </div>

                {/* Inline edit row */}
                {isEditing && editState && (
                  <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
                    <div className="flex flex-wrap items-end gap-3">
                      <SideToggle value={editState.side} onChange={v => setEditState(p => p && ({ ...p, side: v }))} />
                      <TypeToggle value={editState.optionType} onChange={v => setEditState(p => p && ({ ...p, optionType: v }))} />
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Strike</span>
                        <StrikeInput value={editState.strike} step={strikeStep} onChange={v => setEditState(p => p && ({ ...p, strike: v }))} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Expiry</span>
                        <input type="date" value={editState.expiry}
                          onChange={e => setEditState(p => p && ({ ...p, expiry: e.target.value }))}
                          className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Lots</span>
                        <LotsInput value={editState.quantity} onChange={v => setEditState(p => p && ({ ...p, quantity: v }))} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                          Multiplier
                          <span className="ml-1.5 font-normal normal-case text-slate-500">
                            = {editState.quantity * editState.lotSize} units
                          </span>
                        </span>
                        <LotsInput value={editState.lotSize} onChange={v => setEditState(p => p && ({ ...p, lotSize: v }))} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Entry Px</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={editState.entryPrice}
                          onChange={e => setEditState(p => p && ({ ...p, entryPrice: e.target.value }))}
                          placeholder="optional"
                          className="h-8 w-20 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                      </div>
                      <button type="button"
                        onClick={() => saveLeg(leg.id)}
                        disabled={saving}
                        className="h-8 self-end rounded-lg bg-teal-700 px-4 text-xs font-semibold text-white hover:bg-teal-600 disabled:opacity-60 transition-colors"
                      >
                        {saving ? "Saving…" : "Save"}
                      </button>
                    </div>
                    {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {error && !editingId && (
          <p className="border-t border-slate-100 px-5 py-2 text-xs text-rose-600">{error}</p>
        )}
      </div>
    </div>
  );
}
