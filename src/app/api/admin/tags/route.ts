import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";

const createTagSchema = z.object({
  name: z.string().min(1).max(50).trim(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color"),
});

export async function GET() {
  const tags = await prisma.tag.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(tags);
}

export async function POST(request: Request) {
  const parsed = createTagSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.tag.findUnique({ where: { name: parsed.data.name } });
  if (existing) {
    return NextResponse.json(existing);
  }

  const tag = await prisma.tag.create({ data: parsed.data });

  revalidatePath("/desk");
  revalidatePath("/positional");
  revalidatePath("/commodities");

  return NextResponse.json(tag, { status: 201 });
}
