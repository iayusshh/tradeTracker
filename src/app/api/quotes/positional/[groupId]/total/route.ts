import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchLegLtps } from "@/lib/fyers";
import { computeOptionLegSnapshot } from "@/lib/math/pnl";

export async function GET(
  _request: Request,
  context: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await context.params;

  const group = await prisma.positionalTradeGroup.findUnique({
    where: { id: groupId },
    select: {
      underlyingSymbol: true,
      status: true,
      legs: {
        select: {
          id: true,
          side: true,
          optionType: true,
          strike: true,
          expiry: true,
          quantity: true,
          lotSize: true,
          executions: {
            select: {
              kind: true,
              executedAt: true,
              optionPrice: true,
              quantity: true,
              underlyingLtp: true,
              fees: true,
            },
          },
        },
      },
    },
  });

  if (!group) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const openLegs = group.legs.filter((leg) => {
    const entered = leg.executions
      .filter((e) => e.kind !== "EXIT")
      .reduce((sum, e) => sum + e.quantity, 0);
    const exited = leg.executions
      .filter((e) => e.kind === "EXIT")
      .reduce((sum, e) => sum + e.quantity, 0);
    return entered - exited > 0;
  });

  let ltpMap: Record<string, number> = {};

  if (group.status === "OPEN" && openLegs.length > 0) {
    try {
      ltpMap = await fetchLegLtps(
        openLegs.map((leg) => ({
          id: leg.id,
          strike: leg.strike,
          expiry: leg.expiry,
          optionType: leg.optionType as "CALL" | "PUT",
        })),
        group.underlyingSymbol
      );
    } catch {
      // Fall through with empty ltpMap; mark price will be last execution price
    }
  }

  const totals = group.legs.reduce(
    (acc, leg) => {
      const snapshot = computeOptionLegSnapshot(
        {
          side: leg.side as "BUY" | "SELL",
          optionType: leg.optionType as "CALL" | "PUT",
          strike: Number(leg.strike),
          expiry: leg.expiry,
          quantity: leg.quantity,
          lotSize: leg.lotSize,
          executions: leg.executions.map((ex) => ({
            kind: ex.kind as "ENTRY" | "EXIT" | "ADJUSTMENT",
            executedAt: ex.executedAt,
            optionPrice: Number(ex.optionPrice),
            quantity: ex.quantity,
            underlyingLtp: Number(ex.underlyingLtp),
            fees: Number(ex.fees),
          })),
        },
        ltpMap[leg.id]
      );
      acc.realizedPnl += snapshot.realizedPnl;
      acc.unrealizedPnl += snapshot.unrealizedPnl;
      acc.totalPnl += snapshot.totalPnl;
      return acc;
    },
    { realizedPnl: 0, unrealizedPnl: 0, totalPnl: 0 }
  );

  return NextResponse.json(
    {
      realizedPnl: Math.round(totals.realizedPnl * 100) / 100,
      unrealizedPnl: Math.round(totals.unrealizedPnl * 100) / 100,
      totalPnl: Math.round(totals.totalPnl * 100) / 100,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
