import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchLegLtps } from "@/lib/fyers";

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
          strike: true,
          expiry: true,
          optionType: true,
          executions: {
            select: { kind: true, quantity: true },
          },
        },
      },
    },
  });

  if (!group) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (group.status === "CLOSED") {
    return NextResponse.json({}, { headers: { "Cache-Control": "no-store" } });
  }

  // Only request quotes for legs that still have an open position
  const openLegs = group.legs.filter((leg) => {
    const entered = leg.executions
      .filter((e) => e.kind !== "EXIT")
      .reduce((sum, e) => sum + e.quantity, 0);
    const exited = leg.executions
      .filter((e) => e.kind === "EXIT")
      .reduce((sum, e) => sum + e.quantity, 0);
    return entered - exited > 0;
  });

  if (openLegs.length === 0) {
    return NextResponse.json({}, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const ltpMap = await fetchLegLtps(
      openLegs.map((leg) => ({
        id: leg.id,
        strike: leg.strike,
        expiry: leg.expiry,
        optionType: leg.optionType as "CALL" | "PUT",
      })),
      group.underlyingSymbol
    );

    return NextResponse.json(ltpMap, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    // Quote-provider errors should not break desk refreshes.
    return NextResponse.json({}, { headers: { "Cache-Control": "no-store" } });
  }
}
