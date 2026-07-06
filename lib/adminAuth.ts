import { buildAuthMessage } from "./walletAuth";

type SignMessageAsync = (args: { message: string }) => Promise<`0x${string}`>;

export async function signAndBustCache(
  signMessageAsync: SignMessageAsync,
  address: `0x${string}`
): Promise<{ ok: boolean; error?: string }> {
  const timestamp = Date.now();
  const message = buildAuthMessage(timestamp);
  const signature = await signMessageAsync({ message });

  const res = await fetch("/api/admin/bust-cache", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, signature, timestamp }),
  });

  const data = (await res.json()) as { ok?: boolean; error?: string };
  if (!res.ok) {
    return { ok: false, error: data.error ?? "Cache refresh failed" };
  }
  return { ok: true };
}
