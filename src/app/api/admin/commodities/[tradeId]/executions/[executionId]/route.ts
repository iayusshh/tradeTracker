import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { refreshCommodityTradePnl } from "@/lib/server/trade-service";

const patchExecutionSchema = z
  .object({
    price: z.number().positive().optional(),
    executedAt: z.coerce.date().optional(),
    underlyingLtp: z.number().positive().optional(),
    fees: z.number().min(0).optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .refine(
    (value) =>
      value.price !== undefined ||
      value.executedAt !== undefined ||
      value.underlyingLtp !== undefined ||
      value.fees !== undefined ||
      value.notes !== undefined,
    { message: "Provide at least one field to update." }
  );

export async function PATCH(
  request: Request,
  context: { params: Promise<{ tradeId: string; executionId: string }> }
) {
  const { tradeId, executionId } = await context.params;
  const parsed = patchExecutionSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.commodityExecution.findFirst({
    where: {
      id: executionId,
      tradeId,
    },
    select: {
      id: true,
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Execution not found" }, { status: 404 });
  }

  const updated = await prisma.commodityExecution.update({
    where: { id: executionId },
    data: {
      price: parsed.data.price,
      executedAt: parsed.data.executedAt,
      underlyingLtp: parsed.data.underlyingLtp,
      fees: parsed.data.fees,
      notes: parsed.data.notes,
    },
  });

  await refreshCommodityTradePnl(tradeId);

  revalidatePath("/desk");
  revalidatePath(`/desk/commodities/${tradeId}`);
  revalidatePath("/commodities");
  revalidatePath(`/commodities/${tradeId}`);

  return NextResponse.json({
    id: updated.id,
    price: updated.price,
    executedAt: updated.executedAt,
    underlyingLtp: updated.underlyingLtp,
    fees: updated.fees,
    notes: updated.notes,
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ tradeId: string; executionId: string }> }
) {
  const { tradeId, executionId } = await context.params;

  const existing = await prisma.commodityExecution.findFirst({
    where: {
      id: executionId,
      tradeId,
    },
    select: {
      id: true,
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Execution not found" }, { status: 404 });
  }

  await prisma.commodityExecution.delete({
    where: { id: executionId },
  });

  await refreshCommodityTradePnl(tradeId);

  revalidatePath("/desk");
  revalidatePath(`/desk/commodities/${tradeId}`);
  revalidatePath("/commodities");
  revalidatePath(`/commodities/${tradeId}`);

  return NextResponse.json({ ok: true });
}
