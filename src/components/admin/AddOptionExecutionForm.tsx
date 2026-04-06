"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type LegChoice = {
  id: string;
  label: string;
  side: "BUY" | "SELL";
};

type Props = {
  groupId: string;
  legs: LegChoice[];
};

export function AddOptionExecutionForm({ groupId, legs }: Props) {
  const router = useRouter();
  const [legId, setLegId] = useState(legs[0]?.id ?? "");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (legs.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-300 p-8 text-sm text-slate-400">
        Add a leg first to log exits.
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const optionPrice = Number(price);
    if (!Number.isFinite(optionPrice) || optionPrice < 0) {
      setError("Enter a valid exit price (0 or more).");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/positional/${groupId}/executions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legId,
          kind: "EXIT",
          optionPrice,
          quantity,
          underlyingLtp: 0,
          executedAt: new Date().toISOString(),
        }),
      });
      const data = await res.json() as { error?: unknown };
      if (!res.ok) {
        setError(JSON.stringify(data));
        return;
      }
      setPrice("");
      setQuantity(1);
      router.refresh();
    } catch {
      setError("Network error — please retry.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">Log Exit</p>

      {/* Leg selector */}
      <div className="flex flex-wrap gap-2">
        {legs.map((leg) => {
          const active = legId === leg.id;
          const buy = leg.side === "BUY";
          return (
            <button
              key={leg.id}
              type="button"
              onClick={() => setLegId(leg.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? buy
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-rose-600 bg-rose-600 text-white"
                  : buy
                    ? "border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-400"
                    : "border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-400"
              }`}
            >
              {leg.label}
            </button>
          );
        })}
      </div>

      {/* Price + Lots */}
      <div className="flex gap-4">
        <div className="flex flex-col gap-1.5 flex-1">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Exit price</span>
          <input
            type="text"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00"
            className="h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Lots</span>
          <div className="flex">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="h-10 w-9 rounded-l-lg border border-slate-300 bg-white text-slate-500 hover:bg-slate-100 text-lg font-medium transition-colors"
            >
              −
            </button>
            <input
              type="text"
              inputMode="numeric"
              value={quantity}
              onChange={(e) => {
                const n = parseInt(e.target.value);
                if (!isNaN(n) && n >= 1) setQuantity(n);
              }}
              className="h-10 w-12 border-y border-slate-300 text-center text-sm font-semibold text-slate-900 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="h-10 w-9 rounded-r-lg border border-slate-300 bg-white text-slate-500 hover:bg-slate-100 text-lg font-medium transition-colors"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full h-10 rounded-lg bg-rose-600 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-60 transition-colors"
      >
        {submitting ? "Saving…" : "Exit"}
      </button>
    </form>
  );
}
