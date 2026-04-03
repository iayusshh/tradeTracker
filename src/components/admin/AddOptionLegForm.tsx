"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  groupId: string;
};

type FormState = {
  optionType: "CALL" | "PUT";
  side: "BUY" | "SELL";
  strike: string;
  expiry: string;
  quantity: string;
  lotSize: string;
};

export function AddOptionLegForm({ groupId }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [state, setState] = useState<FormState>({
    optionType: "CALL",
    side: "SELL",
    strike: "",
    expiry: "",
    quantity: "1",
    lotSize: "1",
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/admin/positional/${groupId}/legs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          optionType: state.optionType,
          side: state.side,
          strike: Number(state.strike),
          expiry: state.expiry,
          quantity: Number(state.quantity),
          lotSize: Number(state.lotSize),
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "Could not add leg.");
        return;
      }

      setState((prev) => ({ ...prev, strike: "", quantity: "1" }));
      router.refresh();
    } catch {
      setError("Unexpected network issue. Please retry.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-700">Add leg</h4>

      <div className="grid gap-3 sm:grid-cols-2">
        <select
          value={state.optionType}
          onChange={(event) =>
            setState((prev) => ({ ...prev, optionType: event.target.value as "CALL" | "PUT" }))
          }
          className="rounded-lg border border-slate-300 px-3 py-2"
        >
          <option value="CALL">Call</option>
          <option value="PUT">Put</option>
        </select>

        <select
          value={state.side}
          onChange={(event) =>
            setState((prev) => ({ ...prev, side: event.target.value as "BUY" | "SELL" }))
          }
          className="rounded-lg border border-slate-300 px-3 py-2"
        >
          <option value="SELL">Sell</option>
          <option value="BUY">Buy</option>
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <input
          type="number"
          step="0.01"
          required
          value={state.strike}
          onChange={(event) => setState((prev) => ({ ...prev, strike: event.target.value }))}
          placeholder="Strike"
          className="rounded-lg border border-slate-300 px-3 py-2"
        />

        <input
          type="date"
          required
          value={state.expiry}
          onChange={(event) => setState((prev) => ({ ...prev, expiry: event.target.value }))}
          className="rounded-lg border border-slate-300 px-3 py-2"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <input
          type="number"
          min="1"
          required
          value={state.quantity}
          onChange={(event) => setState((prev) => ({ ...prev, quantity: event.target.value }))}
          placeholder="Contracts"
          className="rounded-lg border border-slate-300 px-3 py-2"
        />

        <input
          type="number"
          min="1"
          required
          value={state.lotSize}
          onChange={(event) => setState((prev) => ({ ...prev, lotSize: event.target.value }))}
          placeholder="Lot size"
          className="rounded-lg border border-slate-300 px-3 py-2"
        />
      </div>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-60"
      >
        {isSubmitting ? "Adding..." : "Add leg"}
      </button>
    </form>
  );
}
