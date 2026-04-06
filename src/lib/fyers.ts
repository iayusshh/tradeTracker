import "server-only";

import { format } from "date-fns";

const FYERS_OPTION_CHAIN_URL = "https://api-t1.fyers.in/data/options-chain-v3";

/**
 * Maps underlyingSymbol (as stored in DB) to Fyers option chain symbols.
 * Add entries here for any new underlyings you trade.
 */
const UNDERLYING_SYMBOL: Record<string, string> = {
  NIFTY: "NSE:NIFTY50-INDEX",
  BANKNIFTY: "NSE:NIFTYBANK-INDEX",
  FINNIFTY: "NSE:FINNIFTY-INDEX",
  MIDCPNIFTY: "NSE:MIDCPNIFTY-INDEX",
  SENSEX: "BSE:SENSEX-INDEX",
  BANKEX: "BSE:BANKEX-INDEX",
};

function authHeader() {
  return `${process.env.FYERS_APP_ID ?? ""}:${process.env.FYERS_ACCESS_TOKEN ?? ""}`;
}

export type OptionChainEntry = {
  strike: number;
  call: number | null;
  put: number | null;
};

/**
 * Fetches the full option chain for a given underlying + expiry from Fyers.
 * Returns one entry per strike with the LTP for CE and PE.
 */
export async function fetchOptionChain(
  underlyingSymbol: string,
  expiry: Date
): Promise<OptionChainEntry[]> {
  const fyersSymbol = UNDERLYING_SYMBOL[underlyingSymbol.toUpperCase()];
  if (!fyersSymbol) {
    throw new Error(`No Fyers symbol mapping for underlying: "${underlyingSymbol}"`);
  }

  // Fyers requires a Unix epoch timestamp (seconds), not a date string.
  // NSE/BSE options expire at 15:30 IST = 10:00 UTC; use that exact time.
  const expiryTs = Math.floor(
    Date.UTC(expiry.getUTCFullYear(), expiry.getUTCMonth(), expiry.getUTCDate(), 10, 0, 0) / 1000
  );
  const url = `${FYERS_OPTION_CHAIN_URL}?symbol=${encodeURIComponent(fyersSymbol)}&strikecount=100&timestamp=${expiryTs}`;

  const res = await fetch(url, {
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Fyers option chain API error ${res.status}: ${body}`);
  }

  const json = await res.json();
  if (json?.s !== "ok") {
    throw new Error(`Fyers option chain API returned status "${json?.s}": ${json?.message ?? ""}`);
  }

  const chain = json?.data?.optionsChain as Array<{
    strike_price: number;
    option_type: string;
    ltp: number;
  }>;

  if (!chain?.length) return [];

  // Collapse per-row entries into one entry per strike
  const strikeMap = new Map<number, OptionChainEntry>();
  for (const row of chain) {
    const strike = row.strike_price;
    if (!strikeMap.has(strike)) {
      strikeMap.set(strike, { strike, call: null, put: null });
    }
    const entry = strikeMap.get(strike)!;
    if (row.option_type === "CE") entry.call = row.ltp ?? null;
    else if (row.option_type === "PE") entry.put = row.ltp ?? null;
  }

  return [...strikeMap.values()];
}

/**
 * Given a list of option legs (with underlyingSymbol on the group), returns a
 * map of legId → live LTP. Legs with no matching quote get 0.
 *
 * Legs are batched by expiry so we only make one API call per unique expiry.
 */
export async function fetchLegLtps(
  legs: Array<{
    id: string;
    strike: number;
    expiry: Date;
    optionType: "CALL" | "PUT";
  }>,
  underlyingSymbol: string
): Promise<Record<string, number>> {
  // Group legs by expiry to minimise API calls
  const expiryMap = new Map<string, typeof legs>();
  for (const leg of legs) {
    const key = format(leg.expiry, "yyyy-MM-dd");
    if (!expiryMap.has(key)) expiryMap.set(key, []);
    expiryMap.get(key)!.push(leg);
  }

  const result: Record<string, number> = {};

  await Promise.all(
    [...expiryMap.entries()].map(async ([, legsForExpiry]) => {
      const expiry = legsForExpiry[0].expiry;
      let chain: OptionChainEntry[];

      try {
        chain = await fetchOptionChain(underlyingSymbol, expiry);
      } catch (err) {
        console.error(
          `[fyers] fetchOptionChain failed for ${underlyingSymbol} ${format(expiry, "dd-MMM-yyyy")}:`,
          err
        );
        return;
      }

      // Build quick-lookup: "strike_CALL" | "strike_PUT" → ltp
      const ltpByKey = new Map<string, number>();
      for (const entry of chain) {
        if (entry.call !== null) ltpByKey.set(`${entry.strike}_CALL`, entry.call);
        if (entry.put !== null) ltpByKey.set(`${entry.strike}_PUT`, entry.put);
      }

      for (const leg of legsForExpiry) {
        const ltp = ltpByKey.get(`${leg.strike}_${leg.optionType}`);
        if (ltp !== undefined) result[leg.id] = ltp;
      }
    })
  );

  return result;
}
