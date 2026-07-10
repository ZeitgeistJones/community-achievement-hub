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
//     body: JSON.stringify({ wallet, appId: "build-report", key: "first_scan" }),
//   });
//
// If an odds config exists for (appId, key), a weighted random roll picks
// which achievement the wallet actually earns — the caller never knows.
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
import { getOddsConfig, rollOutcome } from "@/lib/oddsConfig";

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

    // Validate the reported (appId, key) exists and is active.
    const reportedAchievement = achievements.find(
      (a) => a.appId === appId && a.key === key
    );
    if (!reportedAchievement) {
      return NextResponse.json(
        { error: `No achievement found for ${appId}/${key}` },
        { status: 404 }
      );
    }
    if (!reportedAchievement.active) {
      return NextResponse.json(
        { error: "This achievement is not currently claimable" },
        { status: 404 }
      );
    }

    // Random-chance roll: check if there's an odds config for this key.
    // If yes, roll and potentially award a different achievement instead.
    // If no config, fall through and award the reported key directly.
    let targetAchievement = reportedAchievement;

    const oddsConfig = await getOddsConfig(appId, key);
    if (oddsConfig) {
      const rolledKey = rollOutcome(oddsConfig.outcomes);
      if (rolledKey !== key) {
        const alternate = achievements.find(
          (a) => a.appId === appId && a.key === rolledKey && a.active
        );
        if (alternate) {
          targetAchievement = alternate;
        } else {
          // Rolled outcome doesn't exist or is inactive — fall back to reported key.
          // Log server-side so admin knows the odds config has a stale reference.
          console.warn(
            `odds roll: outcome key "${rolledKey}" for ${appId}/${key} not found or inactive — falling back to reported key`
          );
        }
      }
    }

    // Idempotency: if the target badge is already on-chain, nothing to do.
    const client = getPublicClient();
    const alreadyClaimed = await client.readContract({
      address: ACHIEVEMENT_BADGE_ADDRESS,
      abi: achievementBadgeAbi,
      functionName: "hasClaimed",
      args: [BigInt(targetAchievement.id), wallet],
    });
    if (alreadyClaimed) {
      return NextResponse.json({
        ok: true,
        achievementId: targetAchievement.id,
        alreadyClaimed: true,
      });
    }

    const result = await recordEarned(wallet, targetAchievement.id);
    return NextResponse.json({
      ok: true,
      achievementId: targetAchievement.id,
      alreadyEarned: result === "alreadyEarned",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
