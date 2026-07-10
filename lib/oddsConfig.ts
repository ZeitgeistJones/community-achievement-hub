// Redis-backed odds configuration for random-chance achievement rolls.
// Used by /api/report to decide which achievement to award when a key is
// reported. If no config exists for a (appId, key) pair, the reported key
// is awarded directly — no randomness, no change to existing behaviour.
//
// Key shape: `odds:${appId}:${key}` → JSON OddsConfig
//
// Weights are relative integers (not percentages). e.g.:
//   [{ key: "first_scan", weight: 95 }, { key: "lucky_scan", weight: 5 }]
// means a 95% chance of first_scan and 5% chance of lucky_scan.

import { getRedis } from "./redis";

export type OddsOutcome = {
  key: string;
  weight: number;
};

export type OddsConfig = {
  outcomes: OddsOutcome[];
};

function oddsKey(appId: string, key: string): string {
  return `odds:${appId}:${key}`;
}

export async function getOddsConfig(
  appId: string,
  key: string
): Promise<OddsConfig | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get<OddsConfig>(oddsKey(appId, key));
    if (!raw || !Array.isArray(raw.outcomes) || raw.outcomes.length === 0) {
      return null;
    }
    return raw;
  } catch {
    return null;
  }
}

export async function setOddsConfig(
  appId: string,
  key: string,
  outcomes: OddsOutcome[]
): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error("Redis is not configured");
  await redis.set(oddsKey(appId, key), { outcomes });
}

export async function deleteOddsConfig(
  appId: string,
  key: string
): Promise<void> {
  const redis = getRedis();
  if (!redis) throw new Error("Redis is not configured");
  await redis.del(oddsKey(appId, key));
}

/**
 * Weighted random pick. Returns the key of the winning outcome.
 * Pure function: given the same outcomes and a fixed rng, always deterministic.
 * Uses Math.random() in production; pass a seeded rng for tests.
 */
export function rollOutcome(
  outcomes: OddsOutcome[],
  rng: () => number = Math.random
): string {
  const totalWeight = outcomes.reduce((sum, o) => sum + o.weight, 0);
  if (totalWeight <= 0) return outcomes[0]?.key ?? "";
  let roll = rng() * totalWeight;
  for (const outcome of outcomes) {
    roll -= outcome.weight;
    if (roll <= 0) return outcome.key;
  }
  // Floating point safety: return last outcome if we overshoot
  return outcomes[outcomes.length - 1].key;
}
