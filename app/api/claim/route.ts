// POST /api/claim — the heart of the pipeline.
// Verifies the wallet actually earned the achievement (Redis), signs an
// EIP-712 voucher with the signer key, and submits the mint via the relayer
// so the user pays zero gas and never sees a wallet popup.
//
// Security model: there is deliberately no user auth here. A voucher can only
// ever mint to the wallet named inside it, and only if that wallet earned the
// achievement — calling this with someone else's address just gifts THEM
// their own badge. Nothing can be stolen or redirected.

import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { getAchievementById } from "@/lib/achievements";
import { getPublicClient } from "@/lib/clients";
import {
  ACHIEVEMENT_BADGE_ADDRESS,
  achievementBadgeAbi,
} from "@/lib/contracts";
import { corsPreflight, withCors } from "@/lib/cors";
import {
  acquireClaimLock,
  isEarned,
  releaseClaimLock,
} from "@/lib/earned";
import { getRedis } from "@/lib/redis";
import {
  buildEventHash,
  buildVoucher,
  signVoucher,
  submitClaim,
} from "@/lib/voucher";

export async function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function POST(request: Request) {
  let lockWallet: string | null = null;
  let lockId: number | null = null;

  try {
    const body = (await request.json()) as {
      wallet?: string;
      achievementId?: number;
    };
    const { wallet } = body;
    const achievementId = Number(body.achievementId);

    if (!wallet || !isAddress(wallet)) {
      return withCors(
        request,
        NextResponse.json(
          { error: "A valid wallet address is required" },
          { status: 400 }
        )
      );
    }
    if (!Number.isInteger(achievementId) || achievementId < 1) {
      return withCors(
        request,
        NextResponse.json(
          { error: "A valid achievementId is required" },
          { status: 400 }
        )
      );
    }
    if (!getRedis()) {
      return withCors(
        request,
        NextResponse.json(
          { error: "Claiming is temporarily unavailable" },
          { status: 503 }
        )
      );
    }

    // One in-flight claim per (wallet, achievement).
    const locked = await acquireClaimLock(wallet, achievementId);
    if (!locked) {
      return withCors(
        request,
        NextResponse.json(
          { error: "This claim is already in progress" },
          { status: 409 }
        )
      );
    }
    lockWallet = wallet;
    lockId = achievementId;

    // Gate: the wallet must actually have earned this.
    const earned = await isEarned(wallet, achievementId);
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
        hypothesisId: "H8",
        location: "app/api/claim/route.ts:POST:earnedCheck",
        message: "claim earned gate",
        data: {
          wallet: wallet.toLowerCase(),
          achievementId,
          earned,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    if (!earned) {
      return withCors(
        request,
        NextResponse.json(
          { error: "This achievement hasn't been earned by this wallet" },
          { status: 403 }
        )
      );
    }

    // Idempotency: already minted → success, no transaction needed.
    const client = getPublicClient();
    const alreadyClaimed = await client.readContract({
      address: ACHIEVEMENT_BADGE_ADDRESS,
      abi: achievementBadgeAbi,
      functionName: "hasClaimed",
      args: [BigInt(achievementId), wallet],
    });
    if (alreadyClaimed) {
      return withCors(
        request,
        NextResponse.json({ ok: true, alreadyClaimed: true })
      );
    }

    const achievement = await getAchievementById(achievementId);
    if (!achievement) {
      return withCors(
        request,
        NextResponse.json({ error: "Achievement not found" }, { status: 404 })
      );
    }

    const eventHash = buildEventHash(
      achievement.appId,
      achievement.key,
      wallet
    );
    const voucher = buildVoucher(wallet, achievementId, eventHash);
    const signature = await signVoucher(voucher);
    const result = await submitClaim(voucher, signature);

    if (!result.ok) {
      return withCors(
        request,
        NextResponse.json(
          { error: result.error },
          { status: result.expected ? 400 : 500 }
        )
      );
    }

    return withCors(
      request,
      NextResponse.json({
        ok: true,
        alreadyClaimed: result.alreadyClaimed ?? false,
        txHash: result.txHash ?? null,
        tokenId: result.tokenId ?? null,
        edition: result.edition ?? null,
        tier: achievement.tier,
        maxSupply: achievement.maxSupply.toString(),
        rewardPaid: result.rewardPaid ?? false,
      })
    );
  } catch (e) {
    // Never leak raw RPC/internal errors (they can contain request payloads).
    console.error(
      "claim route error:",
      e instanceof Error ? e.message : "unknown"
    );
    return withCors(
      request,
      NextResponse.json(
        { error: "Something went wrong submitting the claim. Please try again." },
        { status: 500 }
      )
    );
  } finally {
    if (lockWallet && lockId) {
      await releaseClaimLock(lockWallet, lockId);
    }
  }
}
