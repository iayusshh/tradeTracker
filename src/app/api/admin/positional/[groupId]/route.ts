import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { refreshPositionalGroupPnl } from "@/lib/server/trade-service";

const patchGroupSchema = z.object({
  title: z.string().min(3).optional(),
  targetDate: z.string().datetime({ offset: true }).or(z.string().date()).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  status: z.enum(["OPEN", "CLOSED"]).optional(),
  bundleId: z.string().cuid().nullable().optional(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await context.params;

  const group = await prisma.positionalTradeGroup.findUnique({
    where: { id: groupId },
    include: {
      legs: {
        include: {
          executions: {
            orderBy: { executedAt: "asc" },
          },
        },
      },
    },
  });

  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  return NextResponse.json(group);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await context.params;
  const parsed = patchGroupSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.positionalTradeGroup.update({
    where: { id: groupId },
    data: {
      title: parsed.data.title,
      notes: parsed.data.notes,
      targetDate:
        parsed.data.targetDate === undefined
          ? undefined
          : parsed.data.targetDate
            ? new Date(parsed.data.targetDate)
            : null,
      status: parsed.data.status,
      bundleId:
        parsed.data.bundleId === undefined
          ? undefined
          : parsed.data.bundleId,
    },
  });

  await refreshPositionalGroupPnl(groupId);

  revalidatePath("/desk");
  revalidatePath(`/desk/positional/${groupId}`);
  revalidatePath("/positional");
  revalidatePath(`/positional/${groupId}`);

  return NextResponse.json(updated);
}
