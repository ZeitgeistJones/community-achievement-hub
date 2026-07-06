import { NextResponse } from "next/server";
import { bustAchievementsCache } from "@/lib/achievements";
import { verifyOwnerSignature } from "@/lib/walletAuth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sig = await verifyOwnerSignature(body);
    if (!sig.ok) {
      return NextResponse.json({ error: sig.error ?? "Unauthorized" }, { status: 401 });
    }

    await bustAchievementsCache();
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
