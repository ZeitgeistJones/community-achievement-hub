// GET /api/pending?wallet=0x.. — earned-but-not-yet-claimed achievements.
// Public + CORS-enabled so the embed script can call it from your other apps.
// Chain state is read fresh (never cached) so a just-claimed badge disappears
// from pending immediately.

import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { getAllAchievements } from "@/lib/achievements";
import { getPublicClient } from "@/lib/clients";
import {
  ACHIEVEMENT_BADGE_ADDRESS,
  achievementBadgeAbi,
} from "@/lib/contracts";
import { corsPreflight, withCors } from "@/lib/cors";
import { getEarnedAt, getEarnedIds } from "@/lib/earned";
import { getRedis } from "@/lib/redis";
import { toPendingAchievement } from "@/lib/pendingTypes";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get("wallet");

    if (!wallet || !isAddress(wallet)) {
      return withCors(
        request,
        NextResponse.json(
          { error: "A valid wallet address is required" },
          { status: 400 }
        )
      );
    }

    if (!getRedis()) {
      return withCors(
        request,
        NextResponse.json({ pending: [] }, { status: 200 })
      );
    }

    const earnedIds = await getEarnedIds(wallet);
    if (earnedIds.length === 0) {
      return withCors(request, NextResponse.json({ pending: [] }));
    }

    // Fresh on-chain truth for what has already been minted.
    const client = getPublicClient();
    const claimed = await client.readContract({
      address: ACHIEVEMENT_BADGE_ADDRESS,
      abi: achievementBadgeAbi,
      functionName: "achievementsOfWallet",
      args: [wallet],
    });
    const claimedSet = new Set(claimed.map((id) => Number(id)));

    const pendingIds = earnedIds.filter((id) => !claimedSet.has(id));
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
        hypothesisId: "H7",
        location: "app/api/pending/route.ts:GET",
        message: "pending pipeline state",
        data: {
          wallet: wallet.toLowerCase(),
          earnedIds,
          claimedIds: [...claimedSet],
          pendingIds,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    if (pendingIds.length === 0) {
      return withCors(request, NextResponse.json({ pending: [] }));
    }

    const achievements = await getAllAchievements();
    const byId = new Map(achievements.map((a) => [a.id, a]));

    const pending = [];
    for (const id of pendingIds) {
      const def = byId.get(id);
      if (!def || !def.active) continue; // deactivated after earning: hide it
      const earnedAt = await getEarnedAt(wallet, id);
      pending.push(toPendingAchievement(def, earnedAt));
    }

    return withCors(request, NextResponse.json({ pending }));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return withCors(
      request,
      NextResponse.json({ error: message }, { status: 500 })
    );
  }
}
