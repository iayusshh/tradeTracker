"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type FormState = {
  title: string;
  symbol: string;
  direction: "LONG" | "SHORT";
  startedAt: string;
  notes: string;
};

export function CommodityTradeForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [state, setState] = useState<FormState>({
    title: "",
    symbol: "CRUDEOIL",
    direction: "LONG",
    startedAt: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/commodities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: state.title || null,
          symbol: state.symbol,
          direction: state.direction,
          startedAt: state.startedAt,
          notes: state.notes || null,
        }),
      });

      const payload = (await response.json()) as { id?: string; error?: string };

      if (!response.ok || !payload.id) {
        setError(payload.error || "Could not create commodity trade.");
        return;
      }

      router.push(`/desk/commodities/${payload.id}`);
      router.refresh();
    } catch {
      setError("Unexpected network issue. Please retry.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="text-lg font-semibold text-slate-900">Create commodity trade</h3>

      <div>
        <label className="text-sm font-medium text-slate-700" htmlFor="title">
          Trade title (optional)
        </label>
        <input
          id="title"
          value={state.title}
          onChange={(event) => setState((prev) => ({ ...prev, title: event.target.value }))}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          placeholder="Crude oil swing"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="text-sm font-medium text-slate-700" htmlFor="symbol">
            Symbol
          </label>
          <input
            id="symbol"
            required
            value={state.symbol}
            onChange={(event) => setState((prev) => ({ ...prev, symbol: event.target.value.toUpperCase() }))}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700" htmlFor="direction">
            Direction
          </label>
          <select
            id="direction"
            value={state.direction}
            onChange={(event) =>
              setState((prev) => ({ ...prev, direction: event.target.value as "LONG" | "SHORT" }))
            }
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          >
            <option value="LONG">Long</option>
            <option value="SHORT">Short</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700" htmlFor="startedAt">
            Start date
          </label>
          <input
            id="startedAt"
            type="date"
            required
            value={state.startedAt}
            onChange={(event) => setState((prev) => ({ ...prev, startedAt: event.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700" htmlFor="notes">
          Notes
        </label>
        <textarea
          id="notes"
          value={state.notes}
          onChange={(event) => setState((prev) => ({ ...prev, notes: event.target.value }))}
          className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2"
        />
      </div>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
      >
        {isSubmitting ? "Creating..." : "Create trade"}
      </button>
    </form>
  );
}
