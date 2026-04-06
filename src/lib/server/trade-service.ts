import "server-only";

import { prisma } from "@/lib/db";
import { computeCommodityTradePnl, computePositionalGroupPnl } from "@/lib/math/pnl";
import {
  monthKeyFromDate,
  monthLabelFromDate,
  weekKeyFromDate,
  weekLabelFromDate,
} from "@/lib/server/timeline";

export type TagItem = {
  id: string;
  name: string;
  color: string;
};

export type OverviewItem = {
  id: string;
  title: string;
  startedAt: Date;
  status: "OPEN" | "CLOSED";
  totalPnl: number;
  tags: TagItem[];
  bundleId: string | null;
  bundleName: string | null;
};

export type NavWeek = {
  key: string;
  label: string;
  totalPnl: number;
  count: number;
};

export type NavMonth = {
  key: string;
  label: string;
  totalPnl: number;
  count: number;
  weeks: NavWeek[];
};

function toNumber(value: number) {
  return Math.round(value * 100) / 100;
}

function upsertWeekBucket(month: NavMonth, key: string, label: string) {
  const existing = month.weeks.find((week) => week.key === key);
  if (existing) {
    return existing;
  }

  const created: NavWeek = {
    key,
    label,
    totalPnl: 0,
    count: 0,
  };

  month.weeks.push(created);
  return created;
}

export function buildMonthWeekBuckets(items: OverviewItem[]): NavMonth[] {
  const monthMap = new Map<string, NavMonth>();

  for (const item of items) {
    const monthKey = monthKeyFromDate(item.startedAt);
    const monthLabel = monthLabelFromDate(item.startedAt);
    const weekKey = weekKeyFromDate(item.startedAt);
    const weekLabel = weekLabelFromDate(item.startedAt);

    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, {
        key: monthKey,
        label: monthLabel,
        totalPnl: 0,
        count: 0,
        weeks: [],
      });
    }

    const monthBucket = monthMap.get(monthKey)!;
    const weekBucket = upsertWeekBucket(monthBucket, weekKey, weekLabel);

    monthBucket.totalPnl += item.totalPnl;
    monthBucket.count += 1;
    weekBucket.totalPnl += item.totalPnl;
    weekBucket.count += 1;
  }

  return [...monthMap.values()]
    .map((month) => ({
      ...month,
      totalPnl: toNumber(month.totalPnl),
      weeks: [...month.weeks]
        .map((week) => ({ ...week, totalPnl: toNumber(week.totalPnl) }))
        .sort((a, b) => b.key.localeCompare(a.key)),
    }))
    .sort((a, b) => b.key.localeCompare(a.key));
}

export async function refreshPositionalGroupPnl(groupId: string) {
  const group = await prisma.positionalTradeGroup.findUnique({
    where: { id: groupId },
    include: {
      legs: {
        include: {
          executions: true,
        },
      },
    },
  });

  if (!group) {
    return null;
  }

  const pnl = computePositionalGroupPnl(group.legs);
  const hasOpenLeg = group.legs.some((leg: (typeof group.legs)[number]) => {
    const entered = leg.executions
      .filter((execution: (typeof leg.executions)[number]) => execution.kind !== "EXIT")
      .reduce((sum: number, execution: (typeof leg.executions)[number]) => sum + execution.quantity, 0);
    const exited = leg.executions
      .filter((execution: (typeof leg.executions)[number]) => execution.kind === "EXIT")
      .reduce((sum: number, execution: (typeof leg.executions)[number]) => sum + execution.quantity, 0);

    return entered - exited > 0;
  });

  return prisma.positionalTradeGroup.update({
    where: { id: groupId },
    data: {
      status: hasOpenLeg ? "OPEN" : "CLOSED",
      realizedPnl: pnl.realizedPnl,
      unrealizedPnl: pnl.unrealizedPnl,
      totalPnl: pnl.totalPnl,
    },
  });
}

export async function refreshCommodityTradePnl(tradeId: string) {
  const trade = await prisma.commodityTrade.findUnique({
    where: { id: tradeId },
    include: { executions: true },
  });

  if (!trade) {
    return null;
  }

  const pnl = computeCommodityTradePnl(trade);
  const entered = trade.executions
    .filter((execution: (typeof trade.executions)[number]) => execution.kind !== "EXIT")
    .reduce((sum: number, execution: (typeof trade.executions)[number]) => sum + execution.quantity, 0);
  const exited = trade.executions
    .filter((execution: (typeof trade.executions)[number]) => execution.kind === "EXIT")
    .reduce((sum: number, execution: (typeof trade.executions)[number]) => sum + execution.quantity, 0);

  return prisma.commodityTrade.update({
    where: { id: tradeId },
    data: {
      status: entered - exited > 0 ? "OPEN" : "CLOSED",
      realizedPnl: pnl.realizedPnl,
      unrealizedPnl: pnl.unrealizedPnl,
      totalPnl: pnl.totalPnl,
    },
  });
}

export async function getPositionalOverview() {
  const groups = await prisma.positionalTradeGroup.findMany({
    orderBy: { startedAt: "desc" },
    include: {
      tags: true,
      bundle: { select: { id: true, name: true } },
    },
  });

  const items: OverviewItem[] = groups.map((group: (typeof groups)[number]) => ({
    id: group.id,
    title: group.title,
    startedAt: group.startedAt,
    status: group.status,
    totalPnl: group.totalPnl,
    tags: group.tags.map((t: { id: string; name: string; color: string }) => ({
      id: t.id,
      name: t.name,
      color: t.color,
    })),
    bundleId: group.bundle?.id ?? null,
    bundleName: group.bundle?.name ?? null,
  }));

  return {
    items,
    nav: buildMonthWeekBuckets(items),
  };
}

export async function getCommodityOverview() {
  const trades = await prisma.commodityTrade.findMany({
    orderBy: { startedAt: "desc" },
    include: {
      tags: true,
      bundle: { select: { id: true, name: true } },
    },
  });

  const items: OverviewItem[] = trades.map((trade: (typeof trades)[number]) => ({
    id: trade.id,
    title: trade.title ?? trade.symbol,
    startedAt: trade.startedAt,
    status: trade.status,
    totalPnl: trade.totalPnl,
    tags: trade.tags.map((t: { id: string; name: string; color: string }) => ({
      id: t.id,
      name: t.name,
      color: t.color,
    })),
    bundleId: trade.bundle?.id ?? null,
    bundleName: trade.bundle?.name ?? null,
  }));

  return {
    items,
    nav: buildMonthWeekBuckets(items),
  };
}

export async function getAllTags() {
  return prisma.tag.findMany({ orderBy: { name: "asc" } });
}

export async function getAllBundles() {
  return prisma.tradeBundle.findMany({ orderBy: { name: "asc" } });
}

export async function getTotalNetPnl(): Promise<number> {
  const [positional, commodity] = await Promise.all([
    prisma.positionalTradeGroup.aggregate({ _sum: { totalPnl: true } }),
    prisma.commodityTrade.aggregate({ _sum: { totalPnl: true } }),
  ]);
  return toNumber(
    (positional._sum.totalPnl ?? 0) + (commodity._sum.totalPnl ?? 0)
  );
}

export async function getPositionalGroupById(groupId: string) {
  return prisma.positionalTradeGroup.findUnique({
    where: { id: groupId },
    include: {
      legs: {
        orderBy: [{ expiry: "asc" }, { strike: "asc" }],
        include: {
          executions: {
            orderBy: { executedAt: "asc" },
          },
        },
      },
      tags: true,
      bundle: { select: { id: true, name: true } },
    },
  });
}

export async function getCommodityTradeById(tradeId: string) {
  return prisma.commodityTrade.findUnique({
    where: { id: tradeId },
    include: {
      executions: {
        orderBy: { executedAt: "asc" },
      },
      tags: true,
      bundle: { select: { id: true, name: true } },
    },
  });
}
