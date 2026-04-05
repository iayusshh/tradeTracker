"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  id: string;
  currentStatus: "OPEN" | "CLOSED";
  /** The PATCH endpoint to call, e.g. /api/admin/positional/[id] */
  patchUrl: string;
};

export function ToggleStatusButton({ id, currentStatus, patchUrl }: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextStatus = currentStatus === "OPEN" ? "CLOSED" : "OPEN";
  const label = currentStatus === "OPEN" ? "Mark as closed" : "Reopen";
  const color =
    currentStatus === "OPEN"
      ? "bg-slate-700 hover:bg-slate-600"
      : "bg-teal-700 hover:bg-teal-600";

  async function handleClick() {
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(patchUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        setError(payload.error ?? "Could not update status.");
        return;
      }

      router.refresh();
    } catch {
      setError("Network error. Please retry.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={isSubmitting}
        className={`rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-60 ${color}`}
      >
        {isSubmitting ? "Saving..." : label}
      </button>
      {error && <p className="text-xs text-rose-700">{error}</p>}
    </div>
  );
}
