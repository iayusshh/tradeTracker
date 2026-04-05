import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { refreshPositionalGroupPnl } from "@/lib/server/trade-service";

const patchLegSchema = z.object({
  optionType: z.enum(["CALL", "PUT"]).optional(),
  side: z.enum(["BUY", "SELL"]).optional(),
  strike: z.number().positive().optional(),
  expiry: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
  quantity: z.number().int().positive().optional(),
  lotSize: z.number().int().positive().optional(),
  entryPrice: z.number().positive().nullable().optional(),
});

type Context = { params: Promise<{ groupId: string; legId: string }> };

export async function PATCH(request: Request, context: Context) {
  const { groupId, legId } = await context.params;

  const parsed = patchLegSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const leg = await prisma.optionLeg.findUnique({
    where: { id: legId },
    include: {
      executions: {
        select: {
          id: true,
          kind: true,
        },
      },
    },
  });
  if (!leg || leg.groupId !== groupId) {
    return NextResponse.json({ error: "Leg not found" }, { status: 404 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const nextLeg = await tx.optionLeg.update({
      where: { id: legId },
      data: {
        optionType: parsed.data.optionType,
        side: parsed.data.side,
        strike: parsed.data.strike,
        expiry: parsed.data.expiry ? new Date(parsed.data.expiry) : undefined,
        quantity: parsed.data.quantity,
        lotSize: parsed.data.lotSize,
      },
    });

    const nonExitExecutions = leg.executions.filter((execution) => execution.kind !== "EXIT");
    const exitExecutions = leg.executions.filter((execution) => execution.kind === "EXIT");

    if (
      parsed.data.quantity !== undefined &&
      nonExitExecutions.length === 1 &&
      exitExecutions.length === 0
    ) {
      await tx.optionExecution.update({
        where: { id: nonExitExecutions[0].id },
        data: { quantity: parsed.data.quantity },
      });
    }

    if (parsed.data.entryPrice !== undefined && parsed.data.entryPrice !== null && nonExitExecutions.length > 0) {
      await tx.optionExecution.updateMany({
        where: { id: { in: nonExitExecutions.map((execution) => execution.id) } },
        data: { optionPrice: parsed.data.entryPrice },
      });
    }

    return nextLeg;
  });

  await refreshPositionalGroupPnl(groupId);
  revalidatePath(`/desk/positional/${groupId}`);
  revalidatePath(`/positional/${groupId}`);

  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, context: Context) {
  const { groupId, legId } = await context.params;

  const leg = await prisma.optionLeg.findUnique({ where: { id: legId } });

  if (!leg || leg.groupId !== groupId) {
    return NextResponse.json({ error: "Leg not found" }, { status: 404 });
  }

  await prisma.optionLeg.delete({ where: { id: legId } });
  await refreshPositionalGroupPnl(groupId);
  revalidatePath(`/desk/positional/${groupId}`);
  revalidatePath(`/positional/${groupId}`);

  return new NextResponse(null, { status: 204 });
}
