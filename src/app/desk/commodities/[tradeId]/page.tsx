import { notFound } from "next/navigation";
import { format } from "date-fns";
import { AddCommodityExecutionForm } from "@/components/admin/AddCommodityExecutionForm";
import { CommodityTradeSettingsForm } from "@/components/admin/CommodityTradeSettingsForm";
import { EditableCommodityExecutionsTable } from "@/components/admin/EditableCommodityExecutionsTable";
import { ToggleStatusButton } from "@/components/admin/ToggleStatusButton";
import { TagPicker } from "@/components/admin/TagPicker";
import { BundlePicker } from "@/components/admin/BundlePicker";
import { LiveCommodityPnl } from "@/components/LiveCommodityPnl";
import { StatusDot } from "@/components/StatusDot";
import { formatInr, pnlColor } from "@/lib/format";
import { getCommodityTradeById, getAllTags, getAllBundles } from "@/lib/server/trade-service";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ tradeId: string }>;
};

export default async function AdminCommodityDetailPage({ params }: Props) {
  const { tradeId } = await params;
  const [trade, allTags, allBundles] = await Promise.all([
    getCommodityTradeById(tradeId),
    getAllTags(),
    getAllBundles(),
  ]);

  if (!trade) {
    notFound();
  }

  const tradeTags = (trade as { tags?: { id: string; name: string; color: string }[] }).tags ?? [];
  const tradeBundle = (trade as { bundle?: { id: string; name: string } | null }).bundle ?? null;
  const serializedExecutions = trade.executions.map((execution: (typeof trade.executions)[number]) => ({
    id: execution.id,
    kind: execution.kind as "ENTRY" | "EXIT" | "ADJUSTMENT",
    executedAt: new Date(execution.executedAt).toISOString(),
    price: Number(execution.price),
    quantity: Number(execution.quantity),
    underlyingLtp: Number(execution.underlyingLtp),
    fees: Number(execution.fees),
  }));

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <StatusDot status={trade.status} />
              <h2 className="text-2xl font-bold text-slate-900">{trade.title ?? trade.symbol}</h2>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className="text-sm text-slate-600">
                {trade.symbol} · {trade.exchange} · {trade.direction} · {trade.instrumentType} · {trade.lotSize} lot size · {format(trade.startedAt, "dd MMM yyyy")}
              </p>
              {trade.instrumentType === "OPTIONS" && trade.optionType && trade.strike !== null ? (
                <p className="text-xs text-slate-500">
                  {trade.optionType} {Number(trade.strike).toFixed(2)}
                  {trade.expiry ? ` · Exp ${format(trade.expiry, "dd MMM yyyy")}` : ""}
                </p>
              ) : null}
              <TagPicker
                entityId={trade.id}
                entityType="commodity"
                currentTags={tradeTags}
                allTags={allTags}
              />
              <BundlePicker
                entityId={trade.id}
                entityType="commodity"
                currentBundleId={tradeBundle?.id ?? null}
                currentBundleName={tradeBundle?.name ?? null}
                allBundles={allBundles}
              />
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Total PnL</p>
              <p className={`text-xl font-bold ${pnlColor(trade.totalPnl)}`}>{formatInr(trade.totalPnl)}</p>
              <p className="text-xs text-slate-500">
                R: {formatInr(trade.realizedPnl)} | U: {formatInr(trade.unrealizedPnl)}
              </p>
            </div>
            <ToggleStatusButton
              id={trade.id}
              currentStatus={trade.status}
              patchUrl={`/api/admin/commodities/${trade.id}`}
            />
          </div>
        </div>
      </section>

      <LiveCommodityPnl
        tradeId={trade.id}
        status={trade.status}
        direction={trade.direction as "LONG" | "SHORT"}
        lotSize={trade.lotSize}
        executions={serializedExecutions}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <CommodityTradeSettingsForm
          trade={{
            id: trade.id,
            title: trade.title,
            symbol: trade.symbol,
            exchange: trade.exchange,
            direction: trade.direction as "LONG" | "SHORT",
            instrumentType: trade.instrumentType as "FUTURES" | "OPTIONS",
            lotSize: trade.lotSize,
            expiry: trade.expiry ? new Date(trade.expiry).toISOString() : null,
            strike: trade.strike !== null ? Number(trade.strike) : null,
            optionType: trade.optionType as "CALL" | "PUT" | null,
            notes: trade.notes,
          }}
        />
        <AddCommodityExecutionForm tradeId={trade.id} lotSize={trade.lotSize} />
      </div>

      <EditableCommodityExecutionsTable
        tradeId={trade.id}
        lotSize={trade.lotSize}
        instrumentType={trade.instrumentType as "FUTURES" | "OPTIONS"}
        currentStrike={trade.strike !== null ? Number(trade.strike) : null}
        executions={serializedExecutions}
      />
    </div>
  );
}
