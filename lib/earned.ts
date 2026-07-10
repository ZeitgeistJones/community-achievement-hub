// Redis store for "earned but maybe not yet claimed" achievement events.
// The Redis record is the source of truth for WHO EARNED WHAT; the chain is
// the source of truth for WHO HAS CLAIMED WHAT. Pending = earned minus claimed.
// All wallet keys are lowercased so casing can never split a user's record.

import { getRedis } from "./redis";

export function earnedSetKey(wallet: string) {
  return `earned:${wallet.toLowerCase()}`;
}

export function earnedAtKey(wallet: string, achievementId: number) {
  return `earnedAt:${wallet.toLowerCase()}:${achievementId}`;
}

export function claimLockKey(wallet: string, achievementId: number) {
  return `claiming:${wallet.toLowerCase()}:${achievementId}`;
}

/** Records an earned event. Returns whether it was new or already recorded. */
export async function recordEarned(
  wallet: string,
  achievementId: number
): Promise<"recorded" | "alreadyEarned"> {
  const redis = getRedis();
  if (!redis) throw new Error("Redis is not configured");
  const added = await redis.sadd(earnedSetKey(wallet), String(achievementId));
  if (added === 1) {
    await redis.set(earnedAtKey(wallet, achievementId), Date.now());
    return "recorded";
  }
  return "alreadyEarned";
}

export async function getEarnedIds(wallet: string): Promise<number[]> {
  const redis = getRedis();
  if (!redis) throw new Error("Redis is not configured");
  const members = await redis.smembers(earnedSetKey(wallet));
  return members
    .map((m) => Number(m))
    .filter((n) => Number.isInteger(n) && n > 0);
}

export async function isEarned(
  wallet: string,
  achievementId: number
): Promise<boolean> {
  const redis = getRedis();
  if (!redis) throw new Error("Redis is not configured");
  const result = await redis.sismember(
    earnedSetKey(wallet),
    String(achievementId)
  );
  return result === 1;
}

export async function getEarnedAt(
  wallet: string,
  achievementId: number
): Promise<number | null> {
  const redis = getRedis();
  if (!redis) return null;
  const value = await redis.get<number>(earnedAtKey(wallet, achievementId));
  return typeof value === "number" ? value : value ? Number(value) : null;
}

/** SET NX lock so only one claim per (wallet, achievement) runs at a time. */
export async function acquireClaimLock(
  wallet: string,
  achievementId: number
): Promise<boolean> {
  const redis = getRedis();
  if (!redis) throw new Error("Redis is not configured");
  const result = await redis.set(claimLockKey(wallet, achievementId), "1", {
    nx: true,
    ex: 60,
  });
  return result === "OK";
}

export async function releaseClaimLock(
  wallet: string,
  achievementId: number
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(claimLockKey(wallet, achievementId));
  } catch {
    // Lock has a 60s TTL, so a failed delete self-heals.
  }
}
