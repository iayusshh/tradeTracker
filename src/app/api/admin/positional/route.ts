import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";

const createPositionalGroupSchema = z.object({
  title: z.string().min(3),
  underlyingSymbol: z.string().min(2),
  startedAt: z.string().datetime({ offset: true }).or(z.string().date()),
  targetDate: z.string().datetime({ offset: true }).or(z.string().date()).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export async function GET() {
  const groups = await prisma.positionalTradeGroup.findMany({
    orderBy: { startedAt: "desc" },
  });

  return NextResponse.json(groups);
}

export async function POST(request: Request) {
  const parsed = createPositionalGroupSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const group = await prisma.positionalTradeGroup.create({
    data: {
      title: parsed.data.title,
      underlyingSymbol: parsed.data.underlyingSymbol.toUpperCase(),
      startedAt: new Date(parsed.data.startedAt),
      targetDate: parsed.data.targetDate ? new Date(parsed.data.targetDate) : null,
      notes: parsed.data.notes ?? null,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/positional");

  return NextResponse.json({ id: group.id }, { status: 201 });
}
