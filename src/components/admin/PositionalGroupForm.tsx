"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type FormState = {
  title: string;
  underlyingSymbol: string;
  startedAt: string;
  targetDate: string;
  notes: string;
};

export function PositionalGroupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [state, setState] = useState<FormState>({
    title: "",
    underlyingSymbol: "NIFTY",
    startedAt: new Date().toISOString().slice(0, 10),
    targetDate: "",
    notes: "",
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/positional", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: state.title,
          underlyingSymbol: state.underlyingSymbol,
          startedAt: state.startedAt,
          targetDate: state.targetDate || null,
          notes: state.notes || null,
        }),
      });

      const payload = (await response.json()) as { id?: string; error?: string };

      if (!response.ok || !payload.id) {
        setError(payload.error || "Could not create positional group.");
        return;
      }

      router.push(`/desk/positional/${payload.id}`);
      router.refresh();
    } catch {
      setError("Unexpected network issue. Please retry.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="text-lg font-semibold text-slate-900">Create positional group</h3>

      <div>
        <label className="text-sm font-medium text-slate-700" htmlFor="title">
          Group title
        </label>
        <input
          id="title"
          required
          value={state.title}
          onChange={(event) => setState((prev) => ({ ...prev, title: event.target.value }))}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          placeholder="NIFTY monthly iron condor"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-slate-700" htmlFor="underlying">
            Underlying
          </label>
          <input
            id="underlying"
            required
            value={state.underlyingSymbol}
            onChange={(event) =>
              setState((prev) => ({ ...prev, underlyingSymbol: event.target.value.toUpperCase() }))
            }
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
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
        <label className="text-sm font-medium text-slate-700" htmlFor="targetDate">
          Target date (optional)
        </label>
        <input
          id="targetDate"
          type="date"
          value={state.targetDate}
          onChange={(event) => setState((prev) => ({ ...prev, targetDate: event.target.value }))}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
        />
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
          placeholder="Entry context, risk limits, expected event..."
        />
      </div>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-60"
      >
        {isSubmitting ? "Creating..." : "Create group"}
      </button>
    </form>
  );
}
