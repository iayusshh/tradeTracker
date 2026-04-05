"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  tradeId: string;
};

type FormState = {
  kind: "ENTRY" | "EXIT" | "ADJUSTMENT";
  price: string;
  quantity: string;
  underlyingLtp: string;
  executedAt: string;
  fees: string;
  notes: string;
};

function toDateTimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIsoDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString();
}

export function AddCommodityExecutionForm({ tradeId }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [state, setState] = useState<FormState>({
    kind: "ENTRY",
    price: "",
    quantity: "1",
    underlyingLtp: "",
    executedAt: toDateTimeLocalValue(new Date()),
    fees: "0",
    notes: "",
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/admin/commodities/${tradeId}/executions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: state.kind,
          price: Number(state.price),
          quantity: Number(state.quantity),
          underlyingLtp: Number(state.underlyingLtp),
          executedAt: toIsoDateTime(state.executedAt),
          fees: Number(state.fees),
          notes: state.notes || null,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "Could not add execution.");
        return;
      }

      setState((prev) => ({
        ...prev,
        price: "",
        quantity: "1",
        underlyingLtp: "",
        notes: "",
      }));
      router.refresh();
    } catch {
      setError("Unexpected network issue. Please retry.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-700">Add entry / exit</h4>

      <div className="grid gap-3 sm:grid-cols-2">
        <select
          value={state.kind}
          onChange={(event) =>
            setState((prev) => ({
              ...prev,
              kind: event.target.value as "ENTRY" | "EXIT" | "ADJUSTMENT",
            }))
          }
          className="rounded-lg border border-slate-300 px-3 py-2"
        >
          <option value="ENTRY">Entry</option>
          <option value="EXIT">Exit</option>
          <option value="ADJUSTMENT">Adjustment</option>
        </select>

        <input
          type="datetime-local"
          required
          value={state.executedAt}
          onChange={(event) => setState((prev) => ({ ...prev, executedAt: event.target.value }))}
          className="rounded-lg border border-slate-300 px-3 py-2"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <input
          type="number"
          step="0.01"
          required
          value={state.price}
          onChange={(event) => setState((prev) => ({ ...prev, price: event.target.value }))}
          placeholder="Price"
          className="rounded-lg border border-slate-300 px-3 py-2"
        />

        <input
          type="number"
          min="1"
          required
          value={state.quantity}
          onChange={(event) => setState((prev) => ({ ...prev, quantity: event.target.value }))}
          placeholder="Quantity"
          className="rounded-lg border border-slate-300 px-3 py-2"
        />

        <input
          type="number"
          step="0.01"
          required
          value={state.underlyingLtp}
          onChange={(event) => setState((prev) => ({ ...prev, underlyingLtp: event.target.value }))}
          placeholder="Underlying LTP"
          className="rounded-lg border border-slate-300 px-3 py-2"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <input
          type="number"
          step="0.01"
          value={state.fees}
          onChange={(event) => setState((prev) => ({ ...prev, fees: event.target.value }))}
          placeholder="Fees"
          className="rounded-lg border border-slate-300 px-3 py-2"
        />

        <input
          value={state.notes}
          onChange={(event) => setState((prev) => ({ ...prev, notes: event.target.value }))}
          placeholder="Notes"
          className="rounded-lg border border-slate-300 px-3 py-2"
        />
      </div>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-lg bg-amber-700 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
      >
        {isSubmitting ? "Saving..." : "Add execution"}
      </button>
    </form>
  );
}
