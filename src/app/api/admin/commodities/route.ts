import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";

const createCommodityTradeSchema = z
  .object({
    title: z.string().max(200).nullable().optional(),
    symbol: z.string().min(2),
    exchange: z.string().min(2).max(16).optional(),
    direction: z.enum(["LONG", "SHORT"]),
    instrumentType: z.enum(["FUTURES", "OPTIONS"]).optional(),
    lotSize: z.number().int().positive().optional(),
    expiry: z.string().datetime({ offset: true }).or(z.string().date()).nullable().optional(),
    strike: z.number().positive().nullable().optional(),
    optionType: z.enum(["CALL", "PUT"]).nullable().optional(),
    startedAt: z.string().datetime({ offset: true }).or(z.string().date()),
    notes: z.string().max(2000).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    const type = data.instrumentType ?? "FUTURES";
    if (type !== "OPTIONS") {
      return;
    }

    if (!data.expiry) {
      ctx.addIssue({
        path: ["expiry"],
        code: z.ZodIssueCode.custom,
        message: "Expiry is required for options.",
      });
    }

    if (data.strike === undefined || data.strike === null) {
      ctx.addIssue({
        path: ["strike"],
        code: z.ZodIssueCode.custom,
        message: "Strike is required for options.",
      });
    }

    if (!data.optionType) {
      ctx.addIssue({
        path: ["optionType"],
        code: z.ZodIssueCode.custom,
        message: "Option type is required for options.",
      });
    }
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

  try {
    const trade = await prisma.commodityTrade.create({
      data: {
        title: parsed.data.title ?? null,
        symbol: parsed.data.symbol.toUpperCase(),
        exchange: (parsed.data.exchange ?? "MCX").toUpperCase(),
        direction: parsed.data.direction,
        instrumentType: parsed.data.instrumentType ?? "FUTURES",
        lotSize: parsed.data.lotSize ?? 1,
        expiry:
          (parsed.data.instrumentType ?? "FUTURES") === "OPTIONS" && parsed.data.expiry
            ? new Date(parsed.data.expiry)
            : null,
        strike:
          (parsed.data.instrumentType ?? "FUTURES") === "OPTIONS"
            ? parsed.data.strike ?? null
            : null,
        optionType:
          (parsed.data.instrumentType ?? "FUTURES") === "OPTIONS"
            ? parsed.data.optionType ?? null
            : null,
        startedAt: new Date(parsed.data.startedAt),
        notes: parsed.data.notes ?? null,
      },
    });

    revalidatePath("/desk");
    revalidatePath("/commodities");

    return NextResponse.json({ id: trade.id }, { status: 201 });
  } catch (error) {
    console.error("[api/admin/commodities] create failed", error);

    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "development"
            ? error instanceof Error
              ? error.message
              : "Unknown create error"
            : "Could not create commodity trade.",
      },
      { status: 500 }
    );
  }
}
