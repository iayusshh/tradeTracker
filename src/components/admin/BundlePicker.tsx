"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

type Bundle = { id: string; name: string };

type Props = {
  entityId: string;
  entityType: "positional" | "commodity";
  currentBundleId: string | null;
  currentBundleName: string | null;
  allBundles: Bundle[];
};

export function BundlePicker({
  entityId,
  entityType,
  currentBundleId,
  currentBundleName,
  allBundles,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [bundleId, setBundleId] = useState<string | null>(currentBundleId);
  const [bundleName, setBundleName] = useState<string | null>(currentBundleName);
  const [bundles, setBundles] = useState<Bundle[]>(allBundles);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const patchUrl =
    entityType === "positional"
      ? `/api/admin/positional/${entityId}`
      : `/api/admin/commodities/${entityId}`;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function selectBundle(id: string | null, name: string | null) {
    setLoading(true);
    await fetch(patchUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bundleId: id }),
    });
    setBundleId(id);
    setBundleName(name);
    setLoading(false);
    setOpen(false);
    router.refresh();
  }

  async function createBundle() {
    const name = newName.trim();
    if (!name) return;
    setLoading(true);
    const res = await fetch("/api/admin/trade-bundles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const bundle: Bundle = await res.json();
    setBundles((prev) => (prev.find((b) => b.id === bundle.id) ? prev : [...prev, bundle]));
    await fetch(patchUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bundleId: bundle.id }),
    });
    setBundleId(bundle.id);
    setBundleName(bundle.name);
    setNewName("");
    setCreating(false);
    setLoading(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        title={bundleName ? `Bundle: ${bundleName}` : "Assign to bundle"}
        className={`flex h-5 items-center gap-1 rounded-full px-1.5 text-[10px] font-medium transition ${
          bundleId
            ? "bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200 hover:bg-indigo-100"
            : open
            ? "bg-slate-200 text-slate-600"
            : "text-slate-300 hover:bg-slate-100 hover:text-slate-500"
        }`}
      >
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-2.5 w-2.5 flex-shrink-0">
          <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zm8 0A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm-8 8A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm8 0A1.5 1.5 0 0 1 10.5 9h3A1.5 1.5 0 0 1 15 10.5v3A1.5 1.5 0 0 1 13.5 15h-3A1.5 1.5 0 0 1 9 13.5v-3z" />
        </svg>
        {bundleName && <span className="max-w-[80px] truncate">{bundleName}</span>}
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {!creating ? (
            <>
              <div className="p-1.5">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => selectBundle(null, null)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition hover:bg-slate-50 disabled:opacity-50"
                >
                  <span className="flex-1 text-left text-slate-400 italic">No bundle</span>
                  {bundleId === null && (
                    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 text-emerald-500">
                      <path d="M12.207 4.793a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414 0l-2-2a1 1 0 0 1 1.414-1.414L6.5 9.086l4.293-4.293a1 1 0 0 1 1.414 0z" />
                    </svg>
                  )}
                </button>
                {bundles.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    disabled={loading}
                    onClick={() => selectBundle(b.id, b.name)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    <span className="flex-1 text-left text-slate-700">{b.name}</span>
                    {bundleId === b.id && (
                      <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 text-emerald-500">
                        <path d="M12.207 4.793a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414 0l-2-2a1 1 0 0 1 1.414-1.414L6.5 9.086l4.293-4.293a1 1 0 0 1 1.414 0z" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
              <div className="border-t border-slate-100 p-1.5">
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                    <path d="M8 2a1 1 0 0 1 1 1v4h4a1 1 0 1 1 0 2H9v4a1 1 0 1 1-2 0V9H3a1 1 0 0 1 0-2h4V3a1 1 0 0 1 1-1z" />
                  </svg>
                  New bundle
                </button>
              </div>
            </>
          ) : (
            <div className="p-3 space-y-2">
              <input
                autoFocus
                type="text"
                placeholder="Bundle name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createBundle()}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100"
              />
              <div className="flex gap-1.5">
                <button
                  type="button"
                  disabled={loading || !newName.trim()}
                  onClick={createBundle}
                  className="flex-1 rounded-lg bg-slate-900 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:opacity-40"
                >
                  {loading ? "Adding…" : "Create"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreating(false);
                    setNewName("");
                  }}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-500 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
