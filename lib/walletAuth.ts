import { verifyMessage } from "viem";
import { OWNER_ADDRESS } from "./contracts";

const MAX_AGE_MS = 5 * 60 * 1000;

export function buildAuthMessage(timestamp: number) {
  return `Community Achievement Hub admin auth\nTimestamp: ${timestamp}`;
}

export async function verifyOwnerSignature(body: {
  address?: string;
  signature?: string;
  timestamp?: number;
}): Promise<{ ok: boolean; error?: string }> {
  const { address, signature, timestamp } = body;

  if (!address || !signature || timestamp === undefined) {
    return { ok: false, error: "Missing auth fields" };
  }

  if (address.toLowerCase() !== OWNER_ADDRESS.toLowerCase()) {
    return { ok: false, error: "Not the owner wallet" };
  }

  const age = Date.now() - Number(timestamp);
  if (age < 0 || age > MAX_AGE_MS) {
    return { ok: false, error: "Signature expired, please re-sign" };
  }

  const message = buildAuthMessage(Number(timestamp));

  const valid = await verifyMessage({
    address: address as `0x${string}`,
    message,
    signature: signature as `0x${string}`,
  });

  if (!valid) {
    return { ok: false, error: "Invalid signature" };
  }

  return { ok: true };
}
