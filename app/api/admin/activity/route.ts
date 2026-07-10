import { NextResponse } from "next/server";
import { getActivityFeed, getActivityFeedScanBlocks } from "@/lib/activityFeed";

export async function GET() {
  try {
    const items = await getActivityFeed();
    return NextResponse.json({
      items,
      scanBlocks: getActivityFeedScanBlocks().toString(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load activity";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
