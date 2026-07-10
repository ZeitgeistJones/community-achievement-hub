// POST /api/report — SERVER-TO-SERVER ONLY.
// Your other apps call this from THEIR server routes (never the browser) to
// report that a wallet earned an achievement. Requires the shared secret.
//
//   fetch("https://<hub>/api/report", {
//     method: "POST",
//     headers: {
//       Authorization: `Bearer ${process.env.REPORT_SECRET}`,
//       "Content-Type": "application/json",
//     },
//     body: JSON.stringify({ wallet, appId: "coveragekit", key: "first_scan" }),
//   });
//
// Deliberately NO CORS headers here — a browser must never hold the secret.

import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { getAllAchievements } from "@/lib/achievements";
import { getPublicClient } from "@/lib/clients";
import {
  ACHIEVEMENT_BADGE_ADDRESS,
  achievementBadgeAbi,
} from "@/lib/contracts";
import { getRedis } from "@/lib/redis";
import { recordEarned } from "@/lib/earned";

export async function POST(request: Request) {
  try {
    const secret = process.env.REPORT_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: "REPORT_SECRET is not configured on the Hub" },
        { status: 500 }
      );
    }
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!getRedis()) {
      return NextResponse.json(
        { error: "Storage is not configured" },
        { status: 503 }
      );
    }

    const body = (await request.json()) as {
      wallet?: string;
      appId?: string;
      key?: string;
    };
    const { wallet, appId, key } = body;

    if (!wallet || !isAddress(wallet)) {
      return NextResponse.json(
        { error: "A valid wallet address is required" },
        { status: 400 }
      );
    }
    if (!appId || !key) {
      return NextResponse.json(
        { error: "appId and key are required" },
        { status: 400 }
      );
    }

    const achievements = await getAllAchievements();
    const achievement = achievements.find(
      (a) => a.appId === appId && a.key === key
    );
    if (!achievement) {
      return NextResponse.json(
        { error: `No achievement found for ${appId}/${key}` },
        { status: 404 }
      );
    }
    if (!achievement.active) {
      return NextResponse.json(
        { error: "This achievement is not currently claimable" },
        { status: 404 }
      );
    }

    // Idempotency: if the badge is already on-chain, there is nothing to do.
    const client = getPublicClient();
    const alreadyClaimed = await client.readContract({
      address: ACHIEVEMENT_BADGE_ADDRESS,
      abi: achievementBadgeAbi,
      functionName: "hasClaimed",
      args: [BigInt(achievement.id), wallet],
    });
    if (alreadyClaimed) {
      return NextResponse.json({
        ok: true,
        achievementId: achievement.id,
        alreadyClaimed: true,
      });
    }

    const result = await recordEarned(wallet, achievement.id);
    return NextResponse.json({
      ok: true,
      achievementId: achievement.id,
      alreadyEarned: result === "alreadyEarned",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
