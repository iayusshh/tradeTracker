import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ tagId: string }> }
) {
  const { tagId } = await context.params;

  await prisma.tag.delete({ where: { id: tagId } });

  revalidatePath("/desk");
  revalidatePath("/positional");
  revalidatePath("/commodities");

  return new NextResponse(null, { status: 204 });
}
