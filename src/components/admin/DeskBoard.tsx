"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { LiveGroupPnl } from "@/components/LiveGroupPnl";
import { StatusDot } from "@/components/StatusDot";
import { TagPicker } from "@/components/admin/TagPicker";
import { formatInr, pnlColor } from "@/lib/format";

export type TagItem = { id: string; name: string; color: string };
export type BundleItem = { id: string; name: string };

export type TradeItem = {
  id: string;
  kind: "positional" | "commodity";
  title: string;
  startedAt: Date;
  status: "OPEN" | "CLOSED";
  totalPnl: number;
  tags: TagItem[];
  bundleId: string | null;
  bundleName: string | null;
};

type Props = {
  positional: TradeItem[];
  commodities: TradeItem[];
  allTags: TagItem[];
  allBundles: BundleItem[];
};

async function readJsonSafely<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

// Droppable bundle bucket
function BundleBucket({
  id,
  label,
  pnl,
  children,
  isOver,
  isEmpty,
  onDelete,
}: {
  id: string;
  label: string;
  pnl: number;
  children: React.ReactNode;
  isOver: boolean;
  isEmpty: boolean;
  onDelete: () => void;
}) {
  const { setNodeRef } = useDroppable({ id });

  return (
    <div className="space-y-1.5">
      <div
        className={`group flex items-center justify-between rounded-lg px-3 py-1.5 transition ${
          isOver ? "bg-indigo-50 ring-1 ring-indigo-200" : "bg-slate-50"
        }`}
      >
        <div className="flex items-center gap-1.5">
          <svg className="h-3 w-3 text-slate-400" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zm8 0A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm-8 8A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm8 0A1.5 1.5 0 0 1 10.5 9h3A1.5 1.5 0 0 1 15 10.5v3A1.5 1.5 0 0 1 13.5 15h-3A1.5 1.5 0 0 1 9 13.5v-3z" />
          </svg>
          <span className="text-xs font-semibold text-slate-600">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold ${pnlColor(pnl)}`}>{formatInr(pnl)}</span>
          <button
            type="button"
            onClick={onDelete}
            title="Delete bundle"
            className="hidden h-4 w-4 items-center justify-center rounded text-slate-300 transition hover:bg-rose-50 hover:text-rose-500 group-hover:flex"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
              <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
              <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z" />
            </svg>
          </button>
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={`min-h-[2rem] space-y-1.5 rounded-lg pl-2 transition ${
          isOver
            ? "bg-indigo-50/60 ring-1 ring-dashed ring-indigo-300"
            : isEmpty
            ? "ring-1 ring-dashed ring-slate-200"
            : ""
        }`}
      >
        {children}
        {isEmpty && (
          <p className="py-2 text-center text-[11px] text-slate-400">
            Drop here
          </p>
        )}
      </div>
    </div>
  );
}

// Ungrouped droppable area
function UngroupedBucket({
  id,
  children,
  isOver,
  show,
}: {
  id: string;
  children: React.ReactNode;
  isOver: boolean;
  show: boolean;
}) {
  const { setNodeRef } = useDroppable({ id });

  if (!show) return <>{children}</>;

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        Ungrouped
      </p>
      <div
        ref={setNodeRef}
        className={`min-h-[2rem] space-y-1.5 rounded-lg transition ${
          isOver ? "bg-slate-100/80 ring-1 ring-dashed ring-slate-300" : ""
        }`}
      >
        {children}
        {isOver && (
          <p className="py-2 text-center text-[11px] text-slate-400">
            Remove from bundle
          </p>
        )}
      </div>
    </div>
  );
}

// Draggable card
function DraggableCard({
  trade,
  allTags,
  isDragging,
  onDeleteTrade,
  onEditTitle,
  deletingTradeId,
  editingTitleId,
}: {
  trade: TradeItem;
  allTags: TagItem[];
  isDragging: boolean;
  onDeleteTrade: (trade: TradeItem) => void;
  onEditTitle: (trade: TradeItem) => void;
  deletingTradeId: string | null;
  editingTitleId: string | null;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: trade.id,
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border bg-white transition ${
        isDragging ? "opacity-40 shadow-lg" : "border-slate-200 hover:bg-slate-50"
      }`}
    >
      <TradeCard
        trade={trade}
        allTags={allTags}
        dragListeners={listeners}
        dragAttributes={attributes}
        onDeleteTrade={onDeleteTrade}
        onEditTitle={onEditTitle}
        deletingTradeId={deletingTradeId}
        editingTitleId={editingTitleId}
      />
    </div>
  );
}

// The card content (used both in draggable and overlay)
function TradeCard({
  trade,
  allTags,
  dragListeners,
  dragAttributes,
  onDeleteTrade,
  onEditTitle,
  deletingTradeId,
  editingTitleId,
  overlay = false,
}: {
  trade: TradeItem;
  allTags: TagItem[];
  dragListeners?: ReturnType<typeof useDraggable>["listeners"];
  dragAttributes?: ReturnType<typeof useDraggable>["attributes"];
  onDeleteTrade?: (trade: TradeItem) => void;
  onEditTitle?: (trade: TradeItem) => void;
  deletingTradeId?: string | null;
  editingTitleId?: string | null;
  overlay?: boolean;
}) {
  const href =
    trade.kind === "positional"
      ? `/desk/positional/${trade.id}`
      : `/desk/commodities/${trade.id}`;

  return (
    <div className={`p-3 ${overlay ? "rounded-xl border border-slate-200 bg-white shadow-xl" : ""}`}>
      <div className="flex items-start gap-2">
        {/* Drag handle */}
        <button
          {...dragListeners}
          {...dragAttributes}
          className="mt-1 flex-shrink-0 cursor-grab text-slate-300 hover:text-slate-500 active:cursor-grabbing"
          tabIndex={-1}
          aria-label="Drag to regroup"
          onClick={(e) => e.preventDefault()}
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
            <circle cx="5" cy="4" r="1.5" />
            <circle cx="11" cy="4" r="1.5" />
            <circle cx="5" cy="8" r="1.5" />
            <circle cx="11" cy="8" r="1.5" />
            <circle cx="5" cy="12" r="1.5" />
            <circle cx="11" cy="12" r="1.5" />
          </svg>
        </button>

        <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <StatusDot status={trade.status} />
              <Link href={href} className="truncate font-semibold text-slate-900 hover:text-teal-700">
                {trade.title}
              </Link>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">{format(trade.startedAt, "dd MMM yyyy")}</p>
            {trade.tags.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {trade.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                    style={{ backgroundColor: tag.color }}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
            {trade.kind === "positional" ? (
              <LiveGroupPnl groupId={trade.id} status={trade.status} initialPnl={trade.totalPnl} />
            ) : (
              <span className={`font-semibold ${pnlColor(trade.totalPnl)}`}>
                {formatInr(trade.totalPnl)}
              </span>
            )}
            {!overlay && (
              <div className="flex items-center gap-1.5">
                <TagPicker
                  entityId={trade.id}
                  entityType={trade.kind}
                  currentTags={trade.tags}
                  allTags={allTags}
                />
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onEditTitle?.(trade);
                  }}
                  disabled={editingTitleId === trade.id || deletingTradeId === trade.id}
                  className="rounded-md border border-slate-300 px-2 py-0.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {editingTitleId === trade.id ? "Saving..." : "Rename"}
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onDeleteTrade?.(trade);
                  }}
                  disabled={deletingTradeId === trade.id}
                  className="rounded-md border border-rose-200 px-2 py-0.5 text-[11px] font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deletingTradeId === trade.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Column for one category (positional or commodity)
function TradeColumn({
  title,
  createHref,
  createLabel,
  items,
  allTags,
  allBundles,
  overId,
  activeId,
  onCreateBundle,
  onDeleteBundle,
  onDeleteTrade,
  onEditTitle,
  deletingTradeId,
  editingTitleId,
}: {
  title: string;
  createHref: string;
  createLabel: string;
  items: TradeItem[];
  allTags: TagItem[];
  allBundles: BundleItem[];
  overId: string | null;
  activeId: string | null;
  onCreateBundle: (name: string) => Promise<void>;
  onDeleteBundle: (bundleId: string) => Promise<void>;
  onDeleteTrade: (trade: TradeItem) => void;
  onEditTitle: (trade: TradeItem) => void;
  deletingTradeId: string | null;
  editingTitleId: string | null;
}) {
  const [newBundleName, setNewBundleName] = useState("");
  const [showBundleInput, setShowBundleInput] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Group items by bundle, including empty bundles so new buckets are immediately usable.
  const bundleMap = new Map<string, { bundle: BundleItem; items: TradeItem[] }>(
    allBundles.map((bundle) => [bundle.id, { bundle, items: [] }])
  );
  const ungrouped: TradeItem[] = [];

  for (const item of items) {
    if (item.bundleId && item.bundleName) {
      if (!bundleMap.has(item.bundleId)) {
        bundleMap.set(item.bundleId, {
          bundle: { id: item.bundleId, name: item.bundleName },
          items: [],
        });
      }
      bundleMap.get(item.bundleId)!.items.push(item);
    } else {
      ungrouped.push(item);
    }
  }

  // Only show bundles that have at least one trade in this column
  const bundles = [...bundleMap.entries()].sort(([, a], [, b]) =>
    a.bundle.name.localeCompare(b.bundle.name)
  );
  const hasBundles = bundles.length > 0;

  async function handleCreate() {
    const name = newBundleName.trim();
    if (!name) return;

    setCreateError(null);
    setCreating(true);
    try {
      await onCreateBundle(name);
      setNewBundleName("");
      setShowBundleInput(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not create bundle.";
      setCreateError(message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <div className="flex items-center gap-3">
          {!showBundleInput && (
            <button
              type="button"
              onClick={() => setShowBundleInput(true)}
              className="text-xs text-slate-400 hover:text-slate-700"
              title="New bundle"
            >
              + Bundle
            </button>
          )}
          <Link href={createHref} className="text-sm font-semibold text-teal-700">
            {createLabel}
          </Link>
        </div>
      </div>

      {showBundleInput && (
        <div className="mt-3 flex gap-2">
          <input
            autoFocus
            type="text"
            placeholder="Bundle name"
            value={newBundleName}
            onChange={(e) => setNewBundleName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") {
                setShowBundleInput(false);
                setNewBundleName("");
              }
            }}
            className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100"
          />
          <button
            type="button"
            disabled={creating || !newBundleName.trim()}
            onClick={handleCreate}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 hover:bg-slate-700"
          >
            {creating ? "…" : "Create"}
          </button>
          <button
            type="button"
            onClick={() => { setShowBundleInput(false); setNewBundleName(""); }}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      )}

      {createError ? (
        <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {createError}
        </p>
      ) : null}

      <div className="mt-4 space-y-4">
        {items.length === 0 && allBundles.length === 0 ? (
          <p className="text-sm text-slate-500">No trades yet.</p>
        ) : (
          <>
            {bundles.map(([bundleId, { bundle, items: bItems }]) => (
              <BundleBucket
                key={bundleId}
                id={`bundle:${bundleId}`}
                label={bundle.name}
                pnl={bItems.reduce((s, i) => s + i.totalPnl, 0)}
                isOver={overId === `bundle:${bundleId}`}
                isEmpty={bItems.length === 0}
                onDelete={() => onDeleteBundle(bundleId)}
              >
                {bItems.map((item) => (
                  <DraggableCard
                    key={item.id}
                    trade={item}
                    allTags={allTags}
                    isDragging={activeId === item.id}
                    onDeleteTrade={onDeleteTrade}
                    onEditTitle={onEditTitle}
                    deletingTradeId={deletingTradeId}
                    editingTitleId={editingTitleId}
                  />
                ))}
              </BundleBucket>
            ))}

            <UngroupedBucket
              id="bundle:null"
              isOver={overId === "bundle:null"}
              show={hasBundles}
            >
              {ungrouped.map((item) => (
                <DraggableCard
                  key={item.id}
                  trade={item}
                  allTags={allTags}
                  isDragging={activeId === item.id}
                  onDeleteTrade={onDeleteTrade}
                  onEditTitle={onEditTitle}
                  deletingTradeId={deletingTradeId}
                  editingTitleId={editingTitleId}
                />
              ))}
            </UngroupedBucket>
          </>
        )}
      </div>
    </section>
  );
}

export function DeskBoard({ positional, commodities, allTags, allBundles }: Props) {
  const [posItems, setPosItems] = useState<TradeItem[]>(positional);
  const [comItems, setComItems] = useState<TradeItem[]>(commodities);
  const [bundles, setBundles] = useState<BundleItem[]>(allBundles);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [deletingTradeId, setDeletingTradeId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const activeItem =
    posItems.find((i) => i.id === activeId) ??
    comItems.find((i) => i.id === activeId) ??
    null;

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
  }

  function handleDragOver({ over }: { over: { id: string } | null }) {
    setOverId(over?.id ?? null);
  }

  async function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    setOverId(null);

    if (!over) return;

    const tradeId = active.id as string;
    const dropId = over.id as string; // "bundle:${id}" or "bundle:null"

    if (!dropId.startsWith("bundle:")) return;

    const newBundleId = dropId === "bundle:null" ? null : dropId.slice(7);

    // Find which list this trade belongs to
    const inPos = posItems.some((i) => i.id === tradeId);
    const items = inPos ? posItems : comItems;
    const setItems = inPos ? setPosItems : setComItems;

    const trade = items.find((i) => i.id === tradeId);
    if (!trade || trade.bundleId === newBundleId) return;

    const newBundle = newBundleId ? bundles.find((b) => b.id === newBundleId) : null;

    // Optimistic update
    setItems((prev) =>
      prev.map((i) =>
        i.id === tradeId
          ? { ...i, bundleId: newBundleId, bundleName: newBundle?.name ?? null }
          : i
      )
    );

    const patchUrl =
      trade.kind === "positional"
        ? `/api/admin/positional/${tradeId}`
        : `/api/admin/commodities/${tradeId}`;

    const res = await fetch(patchUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bundleId: newBundleId }),
    });

    if (!res.ok) {
      // Revert on failure
      setItems((prev) =>
        prev.map((i) =>
          i.id === tradeId
            ? { ...i, bundleId: trade.bundleId, bundleName: trade.bundleName }
            : i
        )
      );
    }
  }

  const createBundle = useCallback(async (name: string) => {
    setActionError(null);

    const res = await fetch("/api/admin/trade-bundles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    const payload = await readJsonSafely<{ id?: string; name?: string; error?: string }>(res);
    if (!res.ok || !payload?.id || !payload?.name) {
      const message =
        typeof payload?.error === "string"
          ? payload.error
          : `Could not create bundle (HTTP ${res.status}).`;
      setActionError(message);
      throw new Error(message);
    }

    const bundle: BundleItem = { id: payload.id, name: payload.name };
    setBundles((prev) =>
      prev.find((b) => b.id === bundle.id) ? prev : [...prev, bundle]
    );
  }, []);

  const deleteBundle = useCallback(async (bundleId: string) => {
    setActionError(null);

    const prevPosItems = posItems;
    const prevComItems = comItems;
    const prevBundles = bundles;

    // Optimistically ungroup any trades assigned to this bundle
    const ungroup = (items: TradeItem[]) =>
      items.map((i) => i.bundleId === bundleId ? { ...i, bundleId: null, bundleName: null } : i);
    setPosItems(ungroup);
    setComItems(ungroup);
    setBundles((prev) => prev.filter((b) => b.id !== bundleId));

    try {
      const response = await fetch(`/api/admin/trade-bundles/${bundleId}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await readJsonSafely<{ error?: string }>(response);
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : `Could not delete bundle (HTTP ${response.status}).`
        );
      }
    } catch (err) {
      setPosItems(prevPosItems);
      setComItems(prevComItems);
      setBundles(prevBundles);
      setActionError(err instanceof Error ? err.message : "Could not delete bundle.");
    }
  }, [bundles, comItems, posItems]);

  const editTradeTitle = useCallback(async (trade: TradeItem) => {
    const input = window.prompt("Edit trade title", trade.title);
    if (input === null) return;

    const title = input.trim();
    if (trade.kind === "positional" && title.length < 3) {
      setActionError("Positional title must be at least 3 characters.");
      return;
    }
    if (trade.kind === "commodity" && title.length < 1) {
      setActionError("Commodity title cannot be empty.");
      return;
    }

    setActionError(null);
    setEditingTitleId(trade.id);

    const endpoint =
      trade.kind === "positional"
        ? `/api/admin/positional/${trade.id}`
        : `/api/admin/commodities/${trade.id}`;

    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });

      const payload = await readJsonSafely<{ error?: string }>(response);
      if (!response.ok) {
        setActionError(
          typeof payload?.error === "string"
            ? payload.error
            : `Could not update title (HTTP ${response.status}).`
        );
        return;
      }

      if (trade.kind === "positional") {
        setPosItems((prev) => prev.map((item) => (item.id === trade.id ? { ...item, title } : item)));
      } else {
        setComItems((prev) => prev.map((item) => (item.id === trade.id ? { ...item, title } : item)));
      }
    } catch {
      setActionError("Unexpected network issue while updating title. Please retry.");
    } finally {
      setEditingTitleId(null);
    }
  }, []);

  const deleteTrade = useCallback(async (trade: TradeItem) => {
    const tradeLabel = trade.kind === "positional" ? "positional group" : "commodity trade";
    const confirmMessage = `Delete ${tradeLabel} \"${trade.title}\"? This action cannot be undone.`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setActionError(null);
    setDeletingTradeId(trade.id);

    const endpoint =
      trade.kind === "positional"
        ? `/api/admin/positional/${trade.id}`
        : `/api/admin/commodities/${trade.id}`;

    try {
      const response = await fetch(endpoint, { method: "DELETE" });
      const payload = await readJsonSafely<{ error?: string }>(response);

      if (!response.ok) {
        setActionError(
          typeof payload?.error === "string"
            ? payload.error
            : `Could not delete ${tradeLabel}.`
        );
        return;
      }

      if (trade.kind === "positional") {
        setPosItems((prev) => prev.filter((item) => item.id !== trade.id));
      } else {
        setComItems((prev) => prev.filter((item) => item.id !== trade.id));
      }
    } catch {
      setActionError("Unexpected network issue while deleting trade. Please retry.");
    } finally {
      setDeletingTradeId(null);
    }
  }, []);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver as never}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-3">
        {actionError ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {actionError}
          </p>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <TradeColumn
            title="Positional groups"
            createHref="/desk/positional/new"
            createLabel="+ Create"
            items={posItems}
            allTags={allTags}
            allBundles={bundles}
            overId={overId}
            activeId={activeId}
            onCreateBundle={createBundle}
            onDeleteBundle={deleteBundle}
            onDeleteTrade={deleteTrade}
            onEditTitle={editTradeTitle}
            deletingTradeId={deletingTradeId}
            editingTitleId={editingTitleId}
          />
          <TradeColumn
            title="Commodity trades"
            createHref="/desk/commodities/new"
            createLabel="+ Create"
            items={comItems}
            allTags={allTags}
            allBundles={bundles}
            overId={overId}
            activeId={activeId}
            onCreateBundle={createBundle}
            onDeleteBundle={deleteBundle}
            onDeleteTrade={deleteTrade}
            onEditTitle={editTradeTitle}
            deletingTradeId={deletingTradeId}
            editingTitleId={editingTitleId}
          />
        </div>
      </div>

      <DragOverlay>
        {activeItem && (
          <TradeCard
            trade={activeItem}
            allTags={allTags}
            overlay
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
