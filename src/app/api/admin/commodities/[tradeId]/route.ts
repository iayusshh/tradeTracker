import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { refreshCommodityTradePnl } from "@/lib/server/trade-service";

const patchCommoditySchema = z.object({
  title: z.string().max(200).nullable().optional(),
  symbol: z.string().min(2).optional(),
  exchange: z.string().min(2).max(16).optional(),
  direction: z.enum(["LONG", "SHORT"]).optional(),
  instrumentType: z.enum(["FUTURES", "OPTIONS"]).optional(),
  lotSize: z.number().int().positive().optional(),
  expiry: z.string().datetime({ offset: true }).or(z.string().date()).nullable().optional(),
  strike: z.number().positive().nullable().optional(),
  optionType: z.enum(["CALL", "PUT"]).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  status: z.enum(["OPEN", "CLOSED"]).optional(),
  bundleId: z.string().cuid().nullable().optional(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ tradeId: string }> }
) {
  const { tradeId } = await context.params;

  const trade = await prisma.commodityTrade.findUnique({
    where: { id: tradeId },
    include: {
      executions: {
        orderBy: { executedAt: "asc" },
      },
    },
  });

  if (!trade) {
    return NextResponse.json({ error: "Trade not found" }, { status: 404 });
  }

  return NextResponse.json(trade);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ tradeId: string }> }
) {
  const { tradeId } = await context.params;
  const parsed = patchCommoditySchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.commodityTrade.findUnique({
    where: { id: tradeId },
    select: {
      instrumentType: true,
      expiry: true,
      strike: true,
      optionType: true,
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Trade not found" }, { status: 404 });
  }

  const effectiveInstrumentType = parsed.data.instrumentType ?? existing.instrumentType;
  const effectiveExpiry = parsed.data.expiry === undefined ? existing.expiry : parsed.data.expiry;
  const effectiveStrike = parsed.data.strike === undefined ? existing.strike : parsed.data.strike;
  const effectiveOptionType =
    parsed.data.optionType === undefined ? existing.optionType : parsed.data.optionType;

  if (effectiveInstrumentType === "OPTIONS") {
    if (!effectiveExpiry || effectiveStrike === null || !effectiveOptionType) {
      return NextResponse.json(
        {
          error:
            "Options trades require expiry, strike and option type. Please provide all three fields.",
        },
        { status: 400 }
      );
    }
  }

  const clearOptionFields = parsed.data.instrumentType === "FUTURES";

  const updated = await prisma.commodityTrade.update({
    where: { id: tradeId },
    data: {
      title: parsed.data.title,
      symbol: parsed.data.symbol?.toUpperCase(),
      exchange: parsed.data.exchange?.toUpperCase(),
      direction: parsed.data.direction,
      instrumentType: parsed.data.instrumentType,
      lotSize: parsed.data.lotSize,
      expiry:
        clearOptionFields
          ? null
          : parsed.data.expiry === undefined
          ? undefined
          : parsed.data.expiry
            ? new Date(parsed.data.expiry)
            : null,
      strike: clearOptionFields ? null : parsed.data.strike,
      optionType: clearOptionFields ? null : parsed.data.optionType,
      notes: parsed.data.notes,
      status: parsed.data.status,
      bundleId:
        parsed.data.bundleId === undefined
          ? undefined
          : parsed.data.bundleId,
    },
  });

  await refreshCommodityTradePnl(tradeId);

  revalidatePath("/desk");
  revalidatePath(`/desk/commodities/${tradeId}`);
  revalidatePath("/commodities");
  revalidatePath(`/commodities/${tradeId}`);

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ tradeId: string }> }
) {
  const { tradeId } = await context.params;

  const existing = await prisma.commodityTrade.findUnique({
    where: { id: tradeId },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Trade not found" }, { status: 404 });
  }

  await prisma.commodityTrade.delete({
    where: { id: tradeId },
  });

  revalidatePath("/desk");
  revalidatePath(`/desk/commodities/${tradeId}`);
  revalidatePath("/commodities");
  revalidatePath(`/commodities/${tradeId}`);

  return NextResponse.json({ ok: true });
}
