import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";

const createCommodityTradeSchema = z.object({
  title: z.string().max(200).nullable().optional(),
  symbol: z.string().min(2),
  direction: z.enum(["LONG", "SHORT"]),
  startedAt: z.string().datetime({ offset: true }).or(z.string().date()),
  notes: z.string().max(2000).nullable().optional(),
});

export async function GET() {
  const trades = await prisma.commodityTrade.findMany({
    orderBy: { startedAt: "desc" },
  });

  return NextResponse.json(trades);
}

export async function POST(request: Request) {
  const parsed = createCommodityTradeSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const trade = await prisma.commodityTrade.create({
    data: {
      title: parsed.data.title ?? null,
      symbol: parsed.data.symbol.toUpperCase(),
      direction: parsed.data.direction,
      startedAt: new Date(parsed.data.startedAt),
      notes: parsed.data.notes ?? null,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/commodities");

  return NextResponse.json({ id: trade.id }, { status: 201 });
}
