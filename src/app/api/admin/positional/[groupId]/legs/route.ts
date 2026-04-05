import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { refreshPositionalGroupPnl } from "@/lib/server/trade-service";

const addLegSchema = z.object({
  optionType: z.enum(["CALL", "PUT"]),
  side: z.enum(["BUY", "SELL"]),
  strike: z.number().positive(),
  expiry: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
  quantity: z.number().int().positive(),
  lotSize: z.number().int().positive(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await context.params;
  const parsed = addLegSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const group = await prisma.positionalTradeGroup.findUnique({ where: { id: groupId } });
  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  const leg = await prisma.optionLeg.create({
    data: {
      groupId,
      optionType: parsed.data.optionType,
      side: parsed.data.side,
      strike: parsed.data.strike,
      expiry: parsed.data.expiry ? new Date(parsed.data.expiry) : new Date("2099-12-31"),
      quantity: parsed.data.quantity,
      lotSize: parsed.data.lotSize,
    },
  });

  await refreshPositionalGroupPnl(groupId);

  revalidatePath("/desk");
  revalidatePath(`/desk/positional/${groupId}`);
  revalidatePath("/positional");
  revalidatePath(`/positional/${groupId}`);

  return NextResponse.json({ id: leg.id }, { status: 201 });
}
