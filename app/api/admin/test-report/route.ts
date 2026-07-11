// POST /api/admin/test-report — owner-only, browser-friendly test hook.
// Lets the owner simulate an app reporting an earned achievement WITHOUT curl
// or exposing REPORT_SECRET to the browser. Auth is the same wallet-signature
// scheme as /api/admin/bust-cache. Used by the /test console page.

import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { getAllAchievements } from "@/lib/achievements";
import { getPublicClient } from "@/lib/clients";
import {
  ACHIEVEMENT_BADGE_ADDRESS,
  achievementBadgeAbi,
} from "@/lib/contracts";
import { recordEarned } from "@/lib/earned";
import { getRedis } from "@/lib/redis";
import { verifyOwnerSignature } from "@/lib/walletAuth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      address?: string;
      signature?: string;
      timestamp?: number;
      targetWallet?: string;
      appId?: string;
      key?: string;
    };

    const sig = await verifyOwnerSignature(body);
    if (!sig.ok) {
      return NextResponse.json(
        { error: sig.error ?? "Unauthorized" },
        { status: 401 }
      );
    }

    if (!getRedis()) {
      return NextResponse.json(
        { error: "Storage is not configured" },
        { status: 503 }
      );
    }

    const targetWallet = body.targetWallet ?? body.address;
    const { appId, key } = body;

    if (!targetWallet || !isAddress(targetWallet)) {
      return NextResponse.json(
        { error: "A valid target wallet is required" },
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
        { error: `No achievement found for ${appId}/${key} — create it in /admin first` },
        { status: 404 }
      );
    }
    if (!achievement.active) {
      return NextResponse.json(
        { error: "This achievement is deactivated" },
        { status: 400 }
      );
    }

    const client = getPublicClient();
    const alreadyClaimed = await client.readContract({
      address: ACHIEVEMENT_BADGE_ADDRESS,
      abi: achievementBadgeAbi,
      functionName: "hasClaimed",
      args: [BigInt(achievement.id), targetWallet],
    });
    if (alreadyClaimed) {
      return NextResponse.json({
        ok: true,
        achievementId: achievement.id,
        alreadyClaimed: true,
      });
    }

    const result = await recordEarned(targetWallet, achievement.id);
    // #region agent log
    fetch("http://127.0.0.1:7685/ingest/8d9fda70-28d1-4679-bc79-33127703700a", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "939fee",
      },
      body: JSON.stringify({
        sessionId: "939fee",
        runId: "pre-fix",
        hypothesisId: "H6-H10",
        location: "app/api/admin/test-report/route.ts:POST:success",
        message: "test-report recorded earn",
        data: {
          targetWallet: targetWallet.toLowerCase(),
          appId,
          key,
          achievementId: achievement.id,
          recordResult: result,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
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
