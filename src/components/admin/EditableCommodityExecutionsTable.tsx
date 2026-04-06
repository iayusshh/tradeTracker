"use client";

import { useState } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";

type ExecutionRow = {
  id: string;
  kind: "ENTRY" | "EXIT" | "ADJUSTMENT";
  executedAt: string;
  price: number;
  quantity: number;
  underlyingLtp: number;
  fees: number;
};

type Props = {
  tradeId: string;
  lotSize: number;
  instrumentType: "FUTURES" | "OPTIONS";
  currentStrike: number | null;
  executions: ExecutionRow[];
};

type ExecutionEditState = {
  executedAt: string;
  price: string;
  underlyingLtp: string;
  fees: string;
};

function toDateTimeLocalValue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function toIsoDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toISOString();
}

function sortByExecutionTime(rows: ExecutionRow[]) {
  return [...rows].sort(
    (a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime()
  );
}

async function readJsonSafely<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function toErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object") {
    const value = (payload as { error?: unknown }).error;
    if (typeof value === "string") {
      return value;
    }
  }

  return fallback;
}

export function EditableCommodityExecutionsTable({
  tradeId,
  lotSize,
  instrumentType,
  currentStrike,
  executions,
}: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<ExecutionRow[]>(sortByExecutionTime(executions));
  const [error, setError] = useState<string | null>(null);
  const [editingExecutionId, setEditingExecutionId] = useState<string | null>(null);
  const [savingExecutionId, setSavingExecutionId] = useState<string | null>(null);
  const [deletingExecutionId, setDeletingExecutionId] = useState<string | null>(null);
  const [editState, setEditState] = useState<ExecutionEditState | null>(null);

  const [editingStrike, setEditingStrike] = useState(false);
  const [strikeSaving, setStrikeSaving] = useState(false);
  const [strike, setStrike] = useState<number | null>(currentStrike);
  const [strikeInput, setStrikeInput] = useState(
    currentStrike !== null ? String(currentStrike) : ""
  );

  function beginExecutionEdit(execution: ExecutionRow) {
    setError(null);
    setEditingExecutionId(execution.id);
    setEditState({
      executedAt: toDateTimeLocalValue(execution.executedAt),
      price: execution.price.toFixed(2),
      underlyingLtp: execution.underlyingLtp.toFixed(2),
      fees: execution.fees.toFixed(2),
    });
  }

  function cancelExecutionEdit() {
    setEditingExecutionId(null);
    setEditState(null);
  }

  async function saveExecution(executionId: string) {
    if (!editState) return;

    const price = Number(editState.price);
    const executedAtIso = toIsoDateTime(editState.executedAt);
    const executedAtDate = new Date(executedAtIso);
    const underlyingLtp = Number(editState.underlyingLtp);
    const fees = Number(editState.fees);

    if (Number.isNaN(executedAtDate.getTime())) {
      setError("Execution time is invalid.");
      return;
    }

    if (!Number.isFinite(price) || price <= 0) {
      setError("Price must be a number greater than 0.");
      return;
    }

    if (!Number.isFinite(underlyingLtp) || underlyingLtp <= 0) {
      setError("Underlying LTP must be a number greater than 0.");
      return;
    }

    if (!Number.isFinite(fees) || fees < 0) {
      setError("Fees must be 0 or more.");
      return;
    }

    setError(null);
    setSavingExecutionId(executionId);

    try {
      const response = await fetch(
        `/api/admin/commodities/${tradeId}/executions/${executionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            executedAt: executedAtIso,
            price,
            underlyingLtp,
            fees,
          }),
        }
      );

      const payload = await readJsonSafely<{
        error?: string;
        id?: string;
        executedAt?: string;
        price?: number;
        underlyingLtp?: number;
        fees?: number;
      }>(response);

      if (!response.ok) {
        setError(
          toErrorMessage(payload, `Could not update execution (HTTP ${response.status}).`)
        );
        return;
      }

      setRows((prev) =>
        sortByExecutionTime(
          prev.map((row) =>
            row.id === executionId
              ? {
                  ...row,
                  executedAt: payload?.executedAt ?? executedAtIso,
                  price: payload?.price ?? price,
                  underlyingLtp: payload?.underlyingLtp ?? underlyingLtp,
                  fees: payload?.fees ?? fees,
                }
              : row
          )
        )
      );
      setEditingExecutionId(null);
      setEditState(null);
      router.refresh();
    } catch {
      setError("Unexpected network issue while updating execution. Please retry.");
    } finally {
      setSavingExecutionId(null);
    }
  }

  async function saveStrike() {
    const parsedStrike = Number(strikeInput);
    if (!Number.isFinite(parsedStrike) || parsedStrike <= 0) {
      setError("Strike price must be a number greater than 0.");
      return;
    }

    setError(null);
    setStrikeSaving(true);

    try {
      const response = await fetch(`/api/admin/commodities/${tradeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strike: parsedStrike }),
      });

      const payload = await readJsonSafely<{ error?: string }>(response);
      if (!response.ok) {
        setError(
          toErrorMessage(payload, `Could not update strike (HTTP ${response.status}).`)
        );
        return;
      }

      setStrike(parsedStrike);
      setEditingStrike(false);
      router.refresh();
    } catch {
      setError("Unexpected network issue while updating strike. Please retry.");
    } finally {
      setStrikeSaving(false);
    }
  }

  async function deleteExecution(execution: ExecutionRow) {
    if (
      !window.confirm(
        `Delete ${execution.kind.toLowerCase()} at ${format(
          new Date(execution.executedAt),
          "dd MMM yyyy HH:mm"
        )}? This cannot be undone.`
      )
    ) {
      return;
    }

    setError(null);
    setDeletingExecutionId(execution.id);

    try {
      const response = await fetch(
        `/api/admin/commodities/${tradeId}/executions/${execution.id}`,
        { method: "DELETE" }
      );

      const payload = await readJsonSafely<{ error?: string }>(response);
      if (!response.ok) {
        setError(
          toErrorMessage(payload, `Could not delete execution (HTTP ${response.status}).`)
        );
        return;
      }

      setRows((prev) => prev.filter((row) => row.id !== execution.id));
      if (editingExecutionId === execution.id) {
        setEditingExecutionId(null);
        setEditState(null);
      }
      router.refresh();
    } catch {
      setError("Unexpected network issue while deleting execution. Please retry.");
    } finally {
      setDeletingExecutionId(null);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-900">Execution ledger</h3>

        {instrumentType === "OPTIONS" ? (
          <div className="flex items-center gap-2">
            {!editingStrike ? (
              <>
                <span className="text-sm text-slate-600">
                  Strike: <span className="font-semibold text-slate-900">{strike !== null ? strike.toFixed(2) : "--"}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setEditingStrike(true)}
                  className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Edit strike
                </button>
              </>
            ) : (
              <>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={strikeInput}
                  onChange={(event) => setStrikeInput(event.target.value)}
                  className="w-28 rounded-md border border-slate-300 px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  onClick={saveStrike}
                  disabled={strikeSaving}
                  className="rounded-md bg-slate-800 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
                >
                  {strikeSaving ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingStrike(false);
                    setStrikeInput(strike !== null ? String(strike) : "");
                  }}
                  className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="px-2 py-2">Type</th>
              <th className="px-2 py-2">Time</th>
              <th className="px-2 py-2">Price</th>
              <th className="px-2 py-2">Lots</th>
              <th className="px-2 py-2">Units</th>
              <th className="px-2 py-2">Underlying LTP</th>
              <th className="px-2 py-2">Fees</th>
              <th className="px-2 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((execution) => {
              const isEditing = editingExecutionId === execution.id;

              return (
                <tr key={execution.id} className="border-b border-slate-100">
                  <td className="px-2 py-2">{execution.kind}</td>
                  <td className="px-2 py-2">
                    {isEditing ? (
                      <input
                        type="datetime-local"
                        value={editState?.executedAt ?? ""}
                        onChange={(event) =>
                          setEditState((prev) =>
                            prev ? { ...prev, executedAt: event.target.value } : prev
                          )
                        }
                        className="w-44 rounded-md border border-slate-300 px-2 py-1"
                      />
                    ) : (
                      format(new Date(execution.executedAt), "dd MMM yyyy HH:mm")
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editState?.price ?? ""}
                        onChange={(event) =>
                          setEditState((prev) =>
                            prev ? { ...prev, price: event.target.value } : prev
                          )
                        }
                        className="w-24 rounded-md border border-slate-300 px-2 py-1"
                      />
                    ) : (
                      execution.price.toFixed(2)
                    )}
                  </td>
                  <td className="px-2 py-2">{execution.quantity}</td>
                  <td className="px-2 py-2">{execution.quantity * lotSize}</td>
                  <td className="px-2 py-2">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editState?.underlyingLtp ?? ""}
                        onChange={(event) =>
                          setEditState((prev) =>
                            prev ? { ...prev, underlyingLtp: event.target.value } : prev
                          )
                        }
                        className="w-28 rounded-md border border-slate-300 px-2 py-1"
                      />
                    ) : (
                      execution.underlyingLtp.toFixed(2)
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editState?.fees ?? ""}
                        onChange={(event) =>
                          setEditState((prev) =>
                            prev ? { ...prev, fees: event.target.value } : prev
                          )
                        }
                        className="w-20 rounded-md border border-slate-300 px-2 py-1"
                      />
                    ) : (
                      execution.fees.toFixed(2)
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {isEditing ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => saveExecution(execution.id)}
                          disabled={savingExecutionId === execution.id}
                          className="rounded-md bg-slate-800 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
                        >
                          {savingExecutionId === execution.id ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={cancelExecutionEdit}
                          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => beginExecutionEdit(execution)}
                          disabled={deletingExecutionId === execution.id}
                          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteExecution(execution)}
                          disabled={deletingExecutionId === execution.id}
                          className="rounded-md border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                        >
                          {deletingExecutionId === execution.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
