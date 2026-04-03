import { NextResponse } from "next/server";
import { z } from "zod";
import { getCommodityOverview, getPositionalOverview } from "@/lib/server/trade-service";

const querySchema = z.object({
  type: z.enum(["positional", "commodities"]),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = querySchema.safeParse({ type: searchParams.get("type") });

  if (!query.success) {
    return NextResponse.json({ error: "Query param type is required" }, { status: 400 });
  }

  const data =
    query.data.type === "positional"
      ? (await getPositionalOverview()).nav
      : (await getCommodityOverview()).nav;

  return NextResponse.json(
    { data },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300",
      },
    }
  );
}
