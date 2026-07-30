import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { verifyOwnerSignature } from "@/lib/walletAuth";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const address = formData.get("address");
    const signature = formData.get("signature");
    const timestampRaw = formData.get("timestamp");

    const sig = await verifyOwnerSignature({
      address: typeof address === "string" ? address : undefined,
      signature: typeof signature === "string" ? signature : undefined,
      timestamp:
        typeof timestampRaw === "string" ? Number(timestampRaw) : undefined,
    });
    if (!sig.ok) {
      return NextResponse.json(
        { error: sig.error ?? "Unauthorized" },
        { status: 401 }
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "File must be 5MB or smaller" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "File must be PNG, JPEG, or WebP" },
        { status: 400 }
      );
    }

    const blob = await put(file.name || "badge.png", file, {
      access: "public",
      addRandomSuffix: true,
    });

    return NextResponse.json({ url: blob.url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
