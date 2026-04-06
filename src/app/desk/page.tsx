import {
  getCommodityOverview,
  getPositionalOverview,
  getAllTags,
  getAllBundles,
} from "@/lib/server/trade-service";
import { DeskBoard, type TradeItem } from "@/components/admin/DeskBoard";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [positional, commodities, allTags, allBundles] = await Promise.all([
    getPositionalOverview(),
    getCommodityOverview(),
    getAllTags(),
    getAllBundles(),
  ]);

  const posItems: TradeItem[] = positional.items.map((g) => ({
    id: g.id,
    kind: "positional" as const,
    title: g.title,
    startedAt: g.startedAt,
    status: g.status,
    totalPnl: g.totalPnl,
    tags: g.tags,
    bundleId: g.bundleId,
    bundleName: g.bundleName,
  }));

  const comItems: TradeItem[] = commodities.items.map((t) => ({
    id: t.id,
    kind: "commodity" as const,
    title: t.title,
    startedAt: t.startedAt,
    status: t.status,
    totalPnl: t.totalPnl,
    tags: t.tags,
    bundleId: t.bundleId,
    bundleName: t.bundleName,
  }));

  return (
    <DeskBoard
      positional={posItems}
      commodities={comItems}
      allTags={allTags}
      allBundles={allBundles}
    />
  );
}
