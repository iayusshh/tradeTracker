import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { refreshCommodityTradePnl } from "@/lib/server/trade-service";

const patchCommoditySchema = z.object({
  title: z.string().max(200).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  status: z.enum(["OPEN", "CLOSED"]).optional(),
  bundleId: z.string().cuid().nullable().optional(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ tradeId: string }> }
) {
  const { tradeId } = await context.params;

  const trade = await prisma.commodityTrade.findUnique({
    where: { id: tradeId },
    include: {
      executions: {
        orderBy: { executedAt: "asc" },
      },
    },
  });

  if (!trade) {
    return NextResponse.json({ error: "Trade not found" }, { status: 404 });
  }

  return NextResponse.json(trade);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ tradeId: string }> }
) {
  const { tradeId } = await context.params;
  const parsed = patchCommoditySchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.commodityTrade.update({
    where: { id: tradeId },
    data: {
      title: parsed.data.title,
      notes: parsed.data.notes,
      status: parsed.data.status,
      bundleId:
        parsed.data.bundleId === undefined
          ? undefined
          : parsed.data.bundleId,
    },
  });

  await refreshCommodityTradePnl(tradeId);

  revalidatePath("/desk");
  revalidatePath(`/desk/commodities/${tradeId}`);
  revalidatePath("/commodities");
  revalidatePath(`/commodities/${tradeId}`);

  return NextResponse.json(updated);
}
