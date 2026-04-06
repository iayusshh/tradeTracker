import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { refreshPositionalGroupPnl } from "@/lib/server/trade-service";

const addExecutionSchema = z.object({
  legId: z.string().min(1),
  kind: z.enum(["ENTRY", "EXIT", "ADJUSTMENT"]),
  optionPrice: z.number().min(0),
  quantity: z.number().int().positive(),
  underlyingLtp: z.number().min(0),
  executedAt: z.coerce.date(),
  fees: z.number().min(0).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await context.params;
  const parsed = addExecutionSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const leg = await prisma.optionLeg.findFirst({
    where: { id: parsed.data.legId, groupId },
    include: { executions: true },
  });

  if (!leg) {
    return NextResponse.json({ error: "Leg not found for this group" }, { status: 404 });
  }

  const entered = leg.executions
    .filter((e) => e.kind !== "EXIT")
    .reduce((sum, e) => sum + e.quantity, 0);
  const exited = leg.executions
    .filter((e) => e.kind === "EXIT")
    .reduce((sum, e) => sum + e.quantity, 0);
  const openQuantity = entered - exited;

  if (parsed.data.kind === "EXIT" && parsed.data.quantity > openQuantity) {
    return NextResponse.json(
      { error: `Exit quantity exceeds open contracts (${openQuantity}).` },
      { status: 400 }
    );
  }

  const execution = await prisma.optionExecution.create({
    data: {
      legId: parsed.data.legId,
      kind: parsed.data.kind,
      optionPrice: parsed.data.optionPrice,
      quantity: parsed.data.quantity,
      underlyingLtp: parsed.data.underlyingLtp,
      executedAt: parsed.data.executedAt,
      fees: parsed.data.fees ?? 0,
      notes: parsed.data.notes ?? null,
    },
  });

  await refreshPositionalGroupPnl(groupId);

  revalidatePath("/desk");
  revalidatePath(`/desk/positional/${groupId}`);
  revalidatePath("/positional");
  revalidatePath(`/positional/${groupId}`);

  return NextResponse.json({ id: execution.id }, { status: 201 });
}
