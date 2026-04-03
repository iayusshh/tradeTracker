import { NextResponse } from "next/server";
import { getCommodityTradeById } from "@/lib/server/trade-service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ tradeId: string }> }
) {
  const { tradeId } = await context.params;
  const trade = await getCommodityTradeById(tradeId);

  if (!trade) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(trade, {
    headers: {
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
    },
  });
}
