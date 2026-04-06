import { notFound } from "next/navigation";
import { format } from "date-fns";
import { AddOptionExecutionForm } from "@/components/admin/AddOptionExecutionForm";
import { AddOptionLegForm } from "@/components/admin/AddOptionLegForm";
import { EditableLegsList, type SerializedLeg } from "@/components/admin/EditableLegsList";
import { ToggleStatusButton } from "@/components/admin/ToggleStatusButton";
import { TagPicker } from "@/components/admin/TagPicker";
import { BundlePicker } from "@/components/admin/BundlePicker";
import { LivePositionalPnl } from "@/components/LivePositionalPnl";
import { LivePnlSummary } from "@/components/LivePnlSummary";
import { StatusDot } from "@/components/StatusDot";
import { computePositionalGroupPnl } from "@/lib/math/pnl";
import { getPositionalGroupById, getAllTags, getAllBundles } from "@/lib/server/trade-service";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ groupId: string }>;
};

function symbolStrikeStep(symbol: string): number {
  const s = symbol.toUpperCase();
  if (s.includes("SENSEX") || s.includes("BSE")) return 100;
  if (s.includes("NIFTY")) return 50;
  return 50;
}

export default async function AdminPositionalDetailPage({ params }: Props) {
  const { groupId } = await params;
  const [group, allTags, allBundles] = await Promise.all([
    getPositionalGroupById(groupId),
    getAllTags(),
    getAllBundles(),
  ]);

  if (!group) {
    notFound();
  }

  const groupTags = (group as { tags?: { id: string; name: string; color: string }[] }).tags ?? [];
  const groupBundle = (group as { bundle?: { id: string; name: string } | null }).bundle ?? null;

  // Compute current price from latest execution's underlyingLtp
  const allExecutions = group.legs.flatMap(
    (leg: (typeof group.legs)[number]) => leg.executions
  );
  // Skip executions with underlyingLtp = 0 (exits logged without underlying price)
  const latestWithPrice = [...allExecutions]
    .filter((ex) => Number(ex.underlyingLtp) > 0)
    .sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime())[0];
  const currentPrice = Number(
    latestWithPrice?.underlyingLtp ?? group.legs[0]?.strike ?? 22000
  );

  // Serialize legs for client components (plain objects, dates as ISO strings)
  const serializedLegs: SerializedLeg[] = group.legs.map(
    (leg: (typeof group.legs)[number]) => ({
      id: leg.id,
      side: leg.side as "BUY" | "SELL",
      optionType: leg.optionType as "CALL" | "PUT",
      strike: Number(leg.strike),
      expiry: new Date(leg.expiry).toISOString(),
      quantity: Number(leg.quantity),
      lotSize: Number(leg.lotSize),
      executions: leg.executions.map((ex: (typeof leg.executions)[number]) => ({
        id: ex.id,
        kind: ex.kind as "ENTRY" | "EXIT" | "ADJUSTMENT",
        executedAt: new Date(ex.executedAt).toISOString(),
        optionPrice: Number(ex.optionPrice),
        quantity: Number(ex.quantity),
        underlyingLtp: Number(ex.underlyingLtp),
        fees: Number(ex.fees),
      })),
    })
  );

  const legOptions = serializedLegs.map((leg) => ({
    id: leg.id,
    label: `${leg.side === "BUY" ? "B" : "S"} ${leg.optionType === "CALL" ? "CE" : "PE"} ${leg.strike} (${format(new Date(leg.expiry), "dd MMM")})`,
    side: leg.side,
  }));

  const strikeStep = symbolStrikeStep(group.underlyingSymbol);

  // Compute PnL fresh from execution data — don't rely on potentially stale DB cache
  const computedPnl = computePositionalGroupPnl(serializedLegs);

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <StatusDot status={group.status} />
              <h2 className="text-2xl font-bold text-slate-900">{group.title}</h2>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className="text-sm text-slate-500">
                {group.underlyingSymbol} · {format(group.startedAt, "dd MMM yyyy")}
              </p>
              <TagPicker
                entityId={group.id}
                entityType="positional"
                currentTags={groupTags}
                allTags={allTags}
              />
              <BundlePicker
                entityId={group.id}
                entityType="positional"
                currentBundleId={groupBundle?.id ?? null}
                currentBundleName={groupBundle?.name ?? null}
                allBundles={allBundles}
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <LivePnlSummary
              groupId={group.id}
              legs={serializedLegs}
              status={group.status}
              initialPnl={computedPnl}
            />
            <ToggleStatusButton
              id={group.id}
              currentStatus={group.status}
              patchUrl={`/api/admin/positional/${group.id}`}
            />
          </div>
        </div>
      </section>

      {/* Live P&L (only shown when there are open legs) */}
      <LivePositionalPnl groupId={group.id} legs={serializedLegs} status={group.status} />

      {/* Add forms */}
      <div className="grid gap-4 lg:grid-cols-2">
        <AddOptionLegForm groupId={group.id} underlyingSymbol={group.underlyingSymbol} />
        <AddOptionExecutionForm groupId={group.id} legs={legOptions} />
      </div>

      {/* Editable legs list + payoff chart */}
      <EditableLegsList
        groupId={group.id}
        legs={serializedLegs}
        strikeStep={strikeStep}
        currentPrice={currentPrice}
        targetDate={group.targetDate ? new Date(group.targetDate).toISOString() : null}
      />

      {/* Execution ledger */}
      {group.legs.some((leg: (typeof group.legs)[number]) => leg.executions.length > 0) && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Execution Ledger</h3>
          <div className="space-y-4">
            {group.legs
              .filter((leg: (typeof group.legs)[number]) => leg.executions.length > 0)
              .map((leg: (typeof group.legs)[number]) => {
                const chipColor = leg.side === "BUY" ? "text-blue-700 bg-blue-50" : "text-rose-700 bg-rose-50";
                return (
                  <div key={leg.id}>
                    <div className={`mb-2 inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-semibold ${chipColor}`}>
                      {leg.side === "BUY" ? "B" : "S"} {leg.optionType === "CALL" ? "CE" : "PE"} {leg.strike}
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-slate-100">
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 text-left text-slate-400">
                            <th className="px-3 py-2">Type</th>
                            <th className="px-3 py-2">Time</th>
                            <th className="px-3 py-2 text-right">Price</th>
                            <th className="px-3 py-2 text-right">Qty</th>
                            <th className="px-3 py-2 text-right">Underlying</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leg.executions.map((ex: (typeof leg.executions)[number]) => {
                            const kindColor =
                              ex.kind === "ENTRY" ? "text-teal-700 bg-teal-50"
                              : ex.kind === "EXIT" ? "text-rose-700 bg-rose-50"
                              : "text-amber-700 bg-amber-50";
                            return (
                              <tr key={ex.id} className="border-b border-slate-50 last:border-0">
                                <td className="px-3 py-2">
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${kindColor}`}>
                                    {ex.kind}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-slate-500">{format(ex.executedAt, "dd MMM HH:mm")}</td>
                                <td className="px-3 py-2 text-right font-medium text-slate-800">{Number(ex.optionPrice).toFixed(2)}</td>
                                <td className="px-3 py-2 text-right text-slate-700">{ex.quantity}</td>
                                <td className="px-3 py-2 text-right text-slate-500">{Number(ex.underlyingLtp).toFixed(2)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      )}
    </div>
  );
}
