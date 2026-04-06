import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchOptionChain, fetchSingleSymbolLtp } from "@/lib/fyers";

function getOpenQuantity(executions: Array<{ kind: "ENTRY" | "EXIT" | "ADJUSTMENT"; quantity: number }>) {
  const entered = executions
    .filter((execution) => execution.kind !== "EXIT")
    .reduce((sum, execution) => sum + execution.quantity, 0);
  const exited = executions
    .filter((execution) => execution.kind === "EXIT")
    .reduce((sum, execution) => sum + execution.quantity, 0);

  return entered - exited;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ tradeId: string }> }
) {
  const { tradeId } = await context.params;

  const trade = await prisma.commodityTrade.findUnique({
    where: { id: tradeId },
    select: {
      id: true,
      symbol: true,
      exchange: true,
      status: true,
      instrumentType: true,
      strike: true,
      optionType: true,
      expiry: true,
      lotSize: true,
      executions: {
        select: {
          kind: true,
          quantity: true,
        },
      },
    },
  });

  if (!trade) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const openQuantity = getOpenQuantity(
    trade.executions.map((execution) => ({
      kind: execution.kind as "ENTRY" | "EXIT" | "ADJUSTMENT",
      quantity: execution.quantity,
    }))
  );

  if (trade.status === "CLOSED" || openQuantity <= 0) {
    return NextResponse.json(
      {
        markPrice: null,
        underlyingLtp: null,
        source: null,
        openQuantity,
        lotSize: trade.lotSize,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  let markPrice: number | null = null;
  let resolvedSymbol: string | null = null;
  let source: "quotes" | "option-chain" | null = null;

  try {
    const quote = await fetchSingleSymbolLtp(trade.symbol, trade.exchange);
    if (quote) {
      markPrice = quote.ltp;
      resolvedSymbol = quote.resolvedSymbol || null;
      source = "quotes";
    }
  } catch {
    // Ignore quote-provider errors and keep fallback behaviour.
  }

  if (
    markPrice === null &&
    trade.instrumentType === "OPTIONS" &&
    trade.expiry &&
    trade.strike !== null &&
    trade.optionType
  ) {
    try {
      const chain = await fetchOptionChain(trade.symbol, trade.expiry);
      const row = chain.find((entry) => entry.strike === Number(trade.strike));
      if (row) {
        markPrice =
          trade.optionType === "CALL"
            ? (row.call ?? null)
            : (row.put ?? null);
        source = markPrice === null ? null : "option-chain";
      }
    } catch {
      // No-op: option chain is best-effort fallback.
    }
  }

  return NextResponse.json(
    {
      markPrice,
      underlyingLtp: markPrice,
      resolvedSymbol,
      source,
      openQuantity,
      lotSize: trade.lotSize,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
