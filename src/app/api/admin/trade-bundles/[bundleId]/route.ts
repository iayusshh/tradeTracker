import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";

const patchSchema = z.object({ name: z.string().min(1).max(100).trim() });

export async function PATCH(
  request: Request,
  context: { params: Promise<{ bundleId: string }> }
) {
  const { bundleId } = await context.params;
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const bundle = await prisma.tradeBundle.update({
    where: { id: bundleId },
    data: { name: parsed.data.name },
  });

  revalidatePath("/desk");
  revalidatePath("/positional");
  revalidatePath("/commodities");

  return NextResponse.json(bundle);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ bundleId: string }> }
) {
  const { bundleId } = await context.params;

  await prisma.tradeBundle.delete({ where: { id: bundleId } });

  revalidatePath("/desk");
  revalidatePath("/positional");
  revalidatePath("/commodities");

  return new NextResponse(null, { status: 204 });
}
