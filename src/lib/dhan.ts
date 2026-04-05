import "server-only";

import { format } from "date-fns";

const DHAN_BASE = "https://api.dhan.co/v2";

/**
 * Maps underlyingSymbol (as stored in DB) to Dhan option chain scrip codes.
 * Add entries here for any new underlyings you trade.
 */
const UNDERLYING_SCRIP: Record<string, { code: number; type: "INDEX" | "EQUITY" }> = {
  NIFTY: { code: 13, type: "INDEX" },
  BANKNIFTY: { code: 25, type: "INDEX" },
  FINNIFTY: { code: 27, type: "INDEX" },
  MIDCPNIFTY: { code: 442, type: "INDEX" },
  SENSEX: { code: 1, type: "INDEX" },
  BANKEX: { code: 12, type: "INDEX" },
};

function authHeaders() {
  return {
    "access-token": process.env.DHAN_ACCESS_TOKEN ?? "",
    "client-id": process.env.DHAN_CLIENT_ID ?? "",
  };
}

export type OptionChainEntry = {
  strike: number;
  call: number | null;
  put: number | null;
};

/**
 * Fetches the full option chain for a given underlying + expiry from Dhan.
 * Returns one entry per strike with the LTP for CE and PE.
 */
export async function fetchOptionChain(
  underlyingSymbol: string,
  expiry: Date
): Promise<OptionChainEntry[]> {
  const scrip = UNDERLYING_SCRIP[underlyingSymbol.toUpperCase()];
  if (!scrip) {
    throw new Error(`No Dhan scrip mapping for underlying: "${underlyingSymbol}"`);
  }

  const expiryStr = format(expiry, "yyyy-MM-dd");
  const url = `${DHAN_BASE}/optionchain?UnderlyingScrip=${scrip.code}&UnderlyingType=${scrip.type}&Expiry=${expiryStr}`;

  const res = await fetch(url, {
    headers: authHeaders(),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Dhan option chain API error ${res.status}: ${body}`);
  }

  const json = await res.json();
  const oc = json?.data?.oc as Record<
    string,
    { call?: { last_price?: number }; put?: { last_price?: number } }
  >;

  if (!oc) return [];

  return Object.entries(oc).map(([strikeStr, data]) => ({
    strike: parseFloat(strikeStr),
    call: data.call?.last_price ?? null,
    put: data.put?.last_price ?? null,
  }));
}

/**
 * Given a list of option legs (with underlyingSymbol on the group), returns a
 * map of legId → live LTP. Legs with no matching quote get 0.
 *
 * Legs are batched by (underlyingSymbol, expiry) so we only make one API call
 * per unique expiry.
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
        console.error(`[dhan] fetchOptionChain failed for ${underlyingSymbol} ${format(expiry, "dd-MMM-yyyy")}:`, err);
        return;
      }

      // Build a quick-lookup map: "strike_CALL" | "strike_PUT" → ltp
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
