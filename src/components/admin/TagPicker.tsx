"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

const PALETTE = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#10b981", "#06b6d4",
  "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899",
  "#64748b", "#78716c",
];

type Tag = { id: string; name: string; color: string };

type Props = {
  entityId: string;
  entityType: "positional" | "commodity";
  currentTags: Tag[];
  allTags: Tag[];
};

export function TagPicker({ entityId, entityType, currentTags, allTags }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState<Tag[]>(currentTags);
  const [allTagsList, setAllTagsList] = useState<Tag[]>(allTags);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PALETTE[8]);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const tagUrl =
    entityType === "positional"
      ? `/api/admin/positional/${entityId}/tags`
      : `/api/admin/commodities/${entityId}/tags`;

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

  const currentIds = new Set(tags.map((t) => t.id));

  async function addTag(tag: Tag) {
    if (currentIds.has(tag.id)) return;
    setLoading(tag.id);
    await fetch(tagUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagId: tag.id }),
    });
    setTags((prev) => [...prev, tag]);
    setLoading(null);
    router.refresh();
  }

  async function removeTag(tagId: string) {
    setLoading(tagId);
    await fetch(tagUrl, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagId }),
    });
    setTags((prev) => prev.filter((t) => t.id !== tagId));
    setLoading(null);
    router.refresh();
  }

  async function createAndAdd() {
    const name = newName.trim();
    if (!name) return;
    setLoading("creating");
    const res = await fetch("/api/admin/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color: newColor }),
    });
    const tag: Tag = await res.json();
    setAllTagsList((prev) =>
      prev.find((t) => t.id === tag.id) ? prev : [...prev, tag]
    );
    await fetch(tagUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagId: tag.id }),
    });
    setTags((prev) => (prev.find((t) => t.id === tag.id) ? prev : [...prev, tag]));
    setNewName("");
    setNewColor(PALETTE[8]);
    setCreating(false);
    setLoading(null);
    router.refresh();
  }

  return (
    <div ref={ref} className="relative flex flex-wrap items-center gap-1">
      {/* Active tag pills */}
      {tags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-1 rounded-full py-0.5 pl-2 pr-1 text-[11px] font-semibold text-white"
          style={{ backgroundColor: tag.color }}
        >
          {tag.name}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              removeTag(tag.id);
            }}
            className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-black/20 leading-none transition hover:bg-black/40"
          >
            ×
          </button>
        </span>
      ))}

      {/* Trigger */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        title="Tags"
        className={`flex h-5 w-5 items-center justify-center rounded-full transition ${
          open
            ? "bg-slate-200 text-slate-700"
            : "text-slate-300 hover:bg-slate-100 hover:text-slate-500"
        }`}
      >
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
          <path d="M2 4a2 2 0 0 1 2-2h4.586a1 1 0 0 1 .707.293l4.414 4.414a1 1 0 0 1 0 1.414l-4.586 4.586a1 1 0 0 1-1.414 0L3.293 8.293A1 1 0 0 1 3 7.586V4zm4.5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {!creating ? (
            <>
              {allTagsList.length > 0 && (
                <div className="p-1.5">
                  {allTagsList.map((tag) => {
                    const active = currentIds.has(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        disabled={loading === tag.id}
                        onClick={() => (active ? removeTag(tag.id) : addTag(tag))}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        <span
                          className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="flex-1 text-left text-sm text-slate-700">{tag.name}</span>
                        {active && (
                          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 text-emerald-500">
                            <path d="M12.207 4.793a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414 0l-2-2a1 1 0 0 1 1.414-1.414L6.5 9.086l4.293-4.293a1 1 0 0 1 1.414 0z" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className={`border-t border-slate-100 p-1.5 ${allTagsList.length === 0 ? "border-t-0" : ""}`}>
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                    <path d="M8 2a1 1 0 0 1 1 1v4h4a1 1 0 1 1 0 2H9v4a1 1 0 1 1-2 0V9H3a1 1 0 0 1 0-2h4V3a1 1 0 0 1 1-1z" />
                  </svg>
                  New tag
                </button>
              </div>
            </>
          ) : (
            <div className="p-3 space-y-2.5">
              <input
                autoFocus
                type="text"
                placeholder="Tag name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createAndAdd()}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100"
              />
              <div className="grid grid-cols-7 gap-1.5">
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewColor(c)}
                    className="h-5 w-5 rounded-full transition hover:scale-110"
                    style={{
                      backgroundColor: c,
                      outline: newColor === c ? `2px solid ${c}` : "none",
                      outlineOffset: "2px",
                    }}
                  />
                ))}
              </div>
              <div className="flex gap-1.5 pt-0.5">
                <button
                  type="button"
                  disabled={loading === "creating" || !newName.trim()}
                  onClick={createAndAdd}
                  className="flex-1 rounded-lg bg-slate-900 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:opacity-40"
                >
                  {loading === "creating" ? "Adding…" : "Add tag"}
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
