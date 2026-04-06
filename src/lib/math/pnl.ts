export type CommodityDirection = "LONG" | "SHORT";
export type ExecutionKind = "ENTRY" | "EXIT" | "ADJUSTMENT";
export type PositionSide = "BUY" | "SELL";
export type OptionType = "CALL" | "PUT";

export type OptionExecutionLike = {
  kind: ExecutionKind;
  executedAt: Date | string;
  optionPrice: number;
  quantity: number;
  underlyingLtp: number;
  fees: number;
};

export type OptionLegLike = {
  side: PositionSide;
  optionType: OptionType;
  strike: number;
  expiry: Date | string;
  quantity: number;
  lotSize: number;
  executions: OptionExecutionLike[];
};

export type CommodityExecutionLike = {
  kind: ExecutionKind;
  executedAt: Date | string;
  price: number;
  quantity: number;
  underlyingLtp: number;
  fees: number;
};

export type CommodityTradeLike = {
  direction: CommodityDirection;
  lotSize?: number;
  executions: CommodityExecutionLike[];
};

type LegWithExecutions = OptionLegLike;
type TradeWithExecutions = CommodityTradeLike;

export type PnlBreakdown = {
  realizedPnl: number;
  unrealizedPnl: number;
  totalPnl: number;
};

export type LegSnapshot = PnlBreakdown & {
  averageEntryPrice: number;
  markPrice: number;
  openQuantity: number;
};

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function signedCashflowForOption(
  side: PositionSide,
  kind: ExecutionKind,
  price: number,
  quantity: number,
  lotSize: number,
  fees: number
) {
  const notional = price * quantity * lotSize;

  const isEntryLike = kind === "ENTRY" || kind === "ADJUSTMENT";
  const isSell = (side === "SELL" && isEntryLike) || (side === "BUY" && kind === "EXIT");

  if (isSell) {
    return notional - fees;
  }

  return -notional - fees;
}

function signedCashflowForCommodity(
  direction: CommodityDirection,
  kind: ExecutionKind,
  price: number,
  quantity: number,
  lotSize: number,
  fees: number
) {
  const notional = price * quantity * lotSize;

  const isEntryLike = kind === "ENTRY" || kind === "ADJUSTMENT";
  const isSell =
    (direction === "SHORT" && isEntryLike) || (direction === "LONG" && kind === "EXIT");

  if (isSell) {
    return notional - fees;
  }

  return -notional - fees;
}

export function computeOptionLegSnapshot(leg: LegWithExecutions, liveMarkPrice?: number): LegSnapshot {
  const executions = [...leg.executions].sort(
    (a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime()
  );

  let cashflow = 0;
  let openQuantity = 0;
  let entryQuantity = 0;
  let entryNotional = 0;
  let markPrice = 0;

  for (const execution of executions) {
    const qty = Math.max(0, execution.quantity);

    cashflow += signedCashflowForOption(
      leg.side,
      execution.kind,
      execution.optionPrice,
      qty,
      leg.lotSize,
      execution.fees
    );

    if (execution.kind === "EXIT") {
      openQuantity = Math.max(0, openQuantity - qty);
    } else {
      openQuantity += qty;
      entryQuantity += qty;
      entryNotional += execution.optionPrice * qty;
    }

    markPrice = execution.optionPrice;
  }

  // When a live price is provided and the position is still open, use it as the mark.
  if (liveMarkPrice !== undefined && openQuantity > 0) {
    markPrice = liveMarkPrice;
  }

  const directionalOpen = leg.side === "BUY" ? openQuantity : -openQuantity;
  const markValue = directionalOpen * markPrice * leg.lotSize;
  const totalPnl = cashflow + markValue;
  const realizedPnl = openQuantity === 0 ? totalPnl : 0;
  const unrealizedPnl = openQuantity === 0 ? 0 : totalPnl;

  return {
    averageEntryPrice: entryQuantity > 0 ? entryNotional / entryQuantity : markPrice,
    markPrice,
    openQuantity,
    realizedPnl: round(realizedPnl),
    unrealizedPnl: round(unrealizedPnl),
    totalPnl: round(totalPnl),
  };
}

export function computePositionalGroupPnl(legs: LegWithExecutions[]): PnlBreakdown {
  const totals = legs.reduce(
    (acc, leg) => {
      const snapshot = computeOptionLegSnapshot(leg);
      acc.realizedPnl += snapshot.realizedPnl;
      acc.unrealizedPnl += snapshot.unrealizedPnl;
      acc.totalPnl += snapshot.totalPnl;
      return acc;
    },
    { realizedPnl: 0, unrealizedPnl: 0, totalPnl: 0 }
  );

  return {
    realizedPnl: round(totals.realizedPnl),
    unrealizedPnl: round(totals.unrealizedPnl),
    totalPnl: round(totals.totalPnl),
  };
}

export function computeCommodityTradePnl(
  trade: TradeWithExecutions,
  liveMarkPrice?: number
): PnlBreakdown {
  const executions = [...trade.executions].sort(
    (a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime()
  );

  let cashflow = 0;
  let openQuantity = 0;
  let markPrice = 0;
  const lotSize = Math.max(1, Math.trunc(trade.lotSize ?? 1));

  for (const execution of executions) {
    const qty = Math.max(0, execution.quantity);

    cashflow += signedCashflowForCommodity(
      trade.direction,
      execution.kind,
      execution.price,
      qty,
      lotSize,
      execution.fees
    );

    if (execution.kind === "EXIT") {
      openQuantity = Math.max(0, openQuantity - qty);
    } else {
      openQuantity += qty;
    }

    markPrice = execution.price;
  }

  // Use live mark when available and position is still open.
  if (liveMarkPrice !== undefined && openQuantity > 0) {
    markPrice = liveMarkPrice;
  }

  const directionalOpen = trade.direction === "LONG" ? openQuantity : -openQuantity;
  const markValue = directionalOpen * markPrice * lotSize;
  const totalPnl = cashflow + markValue;

  return {
    realizedPnl: round(openQuantity === 0 ? totalPnl : 0),
    unrealizedPnl: round(openQuantity === 0 ? 0 : totalPnl),
    totalPnl: round(totalPnl),
  };
}
