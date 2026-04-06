import { addDays, differenceInCalendarDays } from "date-fns";
import {
  computeOptionLegSnapshot,
  type OptionLegLike,
  type OptionType,
} from "@/lib/math/pnl";

type LegWithExecutions = OptionLegLike;

export type PayoffPoint = {
  price: number;
  expiryPnl: number;
  targetPnl: number;
};

export type PayoffOutput = {
  points: PayoffPoint[];
  breakevens: number[];
  currentPrice: number;
};

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function intrinsicValue(optionType: OptionType, strike: number, underlying: number) {
  if (optionType === "CALL") {
    return Math.max(0, underlying - strike);
  }

  return Math.max(0, strike - underlying);
}

function createPriceGrid(
  currentPrice: number,
  strikes: number[],
  explicitStep?: number
): number[] {
  const minStrike = Math.min(...strikes);
  const maxStrike = Math.max(...strikes);
  const rangePadding = Math.max(200, (maxStrike - minStrike) * 0.6);
  const min = Math.max(1, Math.floor((minStrike - rangePadding) / 10) * 10);
  const max = Math.ceil((maxStrike + rangePadding) / 10) * 10;

  let step = explicitStep ?? Math.max(5, Math.round((max - min) / 80));
  step = Math.ceil(step / 5) * 5;

  const prices: number[] = [];
  for (let value = min; value <= max; value += step) {
    prices.push(round(value));
  }

  if (!prices.includes(round(currentPrice))) {
    prices.push(round(currentPrice));
    prices.sort((a, b) => a - b);
  }

  return prices;
}

function findBreakevens(points: PayoffPoint[]) {
  const results: number[] = [];

  for (let i = 1; i < points.length; i += 1) {
    const left = points[i - 1];
    const right = points[i];

    if (left.expiryPnl === 0) {
      results.push(left.price);
      continue;
    }

    if (left.expiryPnl * right.expiryPnl < 0) {
      const slope = right.expiryPnl - left.expiryPnl;
      if (slope !== 0) {
        const x = left.price - (left.expiryPnl * (right.price - left.price)) / slope;
        results.push(round(x));
      }
    }
  }

  return [...new Set(results)].sort((a, b) => a - b);
}

function estimateRemainingTimeValue({
  entryPrice,
  intrinsicAtCurrent,
  daysToExpiryNow,
  daysToExpiryAtTarget,
}: {
  entryPrice: number;
  intrinsicAtCurrent: number;
  daysToExpiryNow: number;
  daysToExpiryAtTarget: number;
}) {
  const entryTimeValue = Math.max(0, entryPrice - intrinsicAtCurrent);

  if (daysToExpiryNow <= 0) {
    return 0;
  }

  const ratio = Math.max(0, Math.min(1, daysToExpiryAtTarget / daysToExpiryNow));
  return entryTimeValue * Math.sqrt(ratio);
}

export function buildPayoffSeries({
  legs,
  targetDate,
  currentPrice,
}: {
  legs: LegWithExecutions[];
  targetDate?: Date | null;
  currentPrice: number;
}): PayoffOutput {
  if (legs.length === 0) {
    return {
      points: [],
      breakevens: [],
      currentPrice,
    };
  }

  const strikes = legs.map((leg) => leg.strike);
  const prices = createPriceGrid(currentPrice, strikes);
  const effectiveTargetDate = targetDate ?? addDays(new Date(), 5);

  const points = prices.map((price) => {
    let expiryPnl = 0;
    let targetPnl = 0;

    for (const leg of legs) {
      const snapshot = computeOptionLegSnapshot(leg);

      // For closed legs fall back to total entered quantity so the chart
      // still shows the original strategy payoff profile.
      const entryQuantity = leg.executions
        .filter((ex) => ex.kind !== "EXIT")
        .reduce((sum, ex) => sum + Math.max(0, ex.quantity), 0);
      const effectiveQty = snapshot.openQuantity > 0 ? snapshot.openQuantity : entryQuantity;

      if (effectiveQty <= 0) {
        continue;
      }

      const multiplier = effectiveQty * leg.lotSize;
      const intrinsic = intrinsicValue(leg.optionType, leg.strike, price);

      const legExpiryPnl =
        leg.side === "BUY"
          ? (intrinsic - snapshot.averageEntryPrice) * multiplier
          : (snapshot.averageEntryPrice - intrinsic) * multiplier;

      const daysToExpiryNow = Math.max(0, differenceInCalendarDays(leg.expiry, new Date()));
      const daysToExpiryAtTarget = Math.max(0, differenceInCalendarDays(leg.expiry, effectiveTargetDate));
      const intrinsicAtCurrent = intrinsicValue(leg.optionType, leg.strike, currentPrice);

      const remainingTimeValue = estimateRemainingTimeValue({
        entryPrice: snapshot.averageEntryPrice,
        intrinsicAtCurrent,
        daysToExpiryNow,
        daysToExpiryAtTarget,
      });

      const projectedOptionPrice = intrinsic + remainingTimeValue;
      const legTargetPnl =
        leg.side === "BUY"
          ? (projectedOptionPrice - snapshot.averageEntryPrice) * multiplier
          : (snapshot.averageEntryPrice - projectedOptionPrice) * multiplier;

      expiryPnl += legExpiryPnl;
      targetPnl += legTargetPnl;
    }

    return {
      price,
      expiryPnl: round(expiryPnl),
      targetPnl: round(targetPnl),
    };
  });

  return {
    points,
    breakevens: findBreakevens(points),
    currentPrice,
  };
}
