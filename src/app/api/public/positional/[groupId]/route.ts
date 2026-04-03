import { NextResponse } from "next/server";
import { getPositionalGroupById } from "@/lib/server/trade-service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await context.params;
  const group = await getPositionalGroupById(groupId);

  if (!group) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(group, {
    headers: {
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
    },
  });
}
