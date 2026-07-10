// GET/POST/DELETE /api/admin/odds — owner-only odds config management.
// GET ?appId=x&key=y → returns current config or null
// POST { address, signature, timestamp, appId, key, outcomes } → set config
// DELETE { address, signature, timestamp, appId, key } → remove config

import { NextResponse } from "next/server";
import { verifyOwnerSignature } from "@/lib/walletAuth";
import {
  deleteOddsConfig,
  getOddsConfig,
  OddsOutcome,
  setOddsConfig,
} from "@/lib/oddsConfig";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const appId = searchParams.get("appId");
  const key = searchParams.get("key");
  if (!appId || !key) {
    return NextResponse.json(
      { error: "appId and key are required" },
      { status: 400 }
    );
  }
  const config = await getOddsConfig(appId, key);
  return NextResponse.json({ config });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      address?: string;
      signature?: string;
      timestamp?: number;
      appId?: string;
      key?: string;
      outcomes?: OddsOutcome[];
    };

    const sig = await verifyOwnerSignature(body);
    if (!sig.ok) {
      return NextResponse.json(
        { error: sig.error ?? "Unauthorized" },
        { status: 401 }
      );
    }

    const { appId, key, outcomes } = body;
    if (!appId || !key) {
      return NextResponse.json(
        { error: "appId and key are required" },
        { status: 400 }
      );
    }
    if (
      !Array.isArray(outcomes) ||
      outcomes.length < 2 ||
      outcomes.some((o) => !o.key || typeof o.weight !== "number" || o.weight <= 0)
    ) {
      return NextResponse.json(
        {
          error:
            "outcomes must be an array of at least 2 items with { key: string, weight: number > 0 }",
        },
        { status: 400 }
      );
    }

    await setOddsConfig(appId, key, outcomes);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as {
      address?: string;
      signature?: string;
      timestamp?: number;
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

    const { appId, key } = body;
    if (!appId || !key) {
      return NextResponse.json(
        { error: "appId and key are required" },
        { status: 400 }
      );
    }

    await deleteOddsConfig(appId, key);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
