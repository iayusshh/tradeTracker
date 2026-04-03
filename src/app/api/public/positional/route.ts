import { NextResponse } from "next/server";
import { getPositionalOverview } from "@/lib/server/trade-service";

export async function GET() {
  const overview = await getPositionalOverview();

  return NextResponse.json(
    { items: overview.items, nav: overview.nav },
    {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
      },
    }
  );
}
