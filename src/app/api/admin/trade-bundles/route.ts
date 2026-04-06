import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";

const createSchema = z.object({ name: z.string().min(1).max(100).trim() });

export async function GET() {
  const bundles = await prisma.tradeBundle.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { positionalGroups: true, commodityTrades: true } },
    },
  });
  return NextResponse.json(bundles);
}

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const bundle = await prisma.tradeBundle.create({ data: { name: parsed.data.name } });

  revalidatePath("/desk");
  revalidatePath("/positional");
  revalidatePath("/commodities");

  return NextResponse.json(bundle, { status: 201 });
}
