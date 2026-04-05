import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { refreshCommodityTradePnl } from "@/lib/server/trade-service";

const addExecutionSchema = z.object({
  kind: z.enum(["ENTRY", "EXIT", "ADJUSTMENT"]),
  price: z.number().positive(),
  quantity: z.number().int().positive(),
  underlyingLtp: z.number().positive(),
  executedAt: z.coerce.date(),
  fees: z.number().min(0).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ tradeId: string }> }
) {
  const { tradeId } = await context.params;
  const parsed = addExecutionSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const trade = await prisma.commodityTrade.findUnique({
    where: { id: tradeId },
    include: { executions: true },
  });

  if (!trade) {
    return NextResponse.json({ error: "Trade not found" }, { status: 404 });
  }

  const entered = trade.executions
    .filter((execution: (typeof trade.executions)[number]) => execution.kind !== "EXIT")
    .reduce((sum: number, execution: (typeof trade.executions)[number]) => sum + execution.quantity, 0);
  const exited = trade.executions
    .filter((execution: (typeof trade.executions)[number]) => execution.kind === "EXIT")
    .reduce((sum: number, execution: (typeof trade.executions)[number]) => sum + execution.quantity, 0);
  const openQuantity = entered - exited;

  if (parsed.data.kind === "EXIT" && parsed.data.quantity > openQuantity) {
    return NextResponse.json(
      { error: `Exit quantity exceeds open quantity (${openQuantity}).` },
      { status: 400 }
    );
  }

  const execution = await prisma.commodityExecution.create({
    data: {
      tradeId,
      kind: parsed.data.kind,
      price: parsed.data.price,
      quantity: parsed.data.quantity,
      underlyingLtp: parsed.data.underlyingLtp,
      executedAt: parsed.data.executedAt,
      fees: parsed.data.fees ?? 0,
      notes: parsed.data.notes ?? null,
    },
  });

  await refreshCommodityTradePnl(tradeId);

  revalidatePath("/desk");
  revalidatePath(`/desk/commodities/${tradeId}`);
  revalidatePath("/commodities");
  revalidatePath(`/commodities/${tradeId}`);

  return NextResponse.json({ id: execution.id }, { status: 201 });
}
