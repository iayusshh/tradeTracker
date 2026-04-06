import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";

const bodySchema = z.object({ tagId: z.string().cuid() });

export async function POST(
  request: Request,
  context: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await context.params;
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.positionalTradeGroup.update({
    where: { id: groupId },
    data: { tags: { connect: { id: parsed.data.tagId } } },
  });

  revalidatePath("/desk");
  revalidatePath(`/desk/positional/${groupId}`);
  revalidatePath("/positional");
  revalidatePath(`/positional/${groupId}`);

  return new NextResponse(null, { status: 204 });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await context.params;
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.positionalTradeGroup.update({
    where: { id: groupId },
    data: { tags: { disconnect: { id: parsed.data.tagId } } },
  });

  revalidatePath("/desk");
  revalidatePath(`/desk/positional/${groupId}`);
  revalidatePath("/positional");
  revalidatePath(`/positional/${groupId}`);

  return new NextResponse(null, { status: 204 });
}
