import {
  ACHIEVEMENT_BADGE_ADDRESS,
  ACHIEVEMENT_REGISTRY_ADDRESS,
  achievementBadgeAbi,
  achievementRegistryAbi,
} from "./contracts";
import { getPublicClient } from "./clients";
import { getRedis } from "./redis";
import {
  ACHIEVEMENTS_CACHE_KEY,
  type AchievementDef,
  type AchievementWithSupply,
} from "./types";

const CACHE_TTL_SECONDS = 60;

type SerializedAchievement = {
  id: number;
  appId: string;
  key: string;
  name: string;
  description: string;
  tier: number;
  imageURI: string;
  maxSupply: string;
  capLocked: boolean;
  rewardToken: string;
  rewardAmount: string;
  prerequisites: string[];
  hidden: boolean;
  active: boolean;
  remainingSupply: string;
  claimCount?: string;
};

function serialize(achievements: AchievementWithSupply[]): SerializedAchievement[] {
  return achievements.map((a) => ({
    id: a.id,
    appId: a.appId,
    key: a.key,
    name: a.name,
    description: a.description,
    tier: a.tier,
    imageURI: a.imageURI,
    maxSupply: a.maxSupply.toString(),
    capLocked: a.capLocked,
    rewardToken: a.rewardToken,
    rewardAmount: a.rewardAmount.toString(),
    prerequisites: a.prerequisites.map((p) => p.toString()),
    hidden: a.hidden,
    active: a.active,
    remainingSupply: a.remainingSupply.toString(),
    claimCount: a.claimCount?.toString(),
  }));
}

function deserialize(data: SerializedAchievement[]): AchievementWithSupply[] {
  return data.map((a) => ({
    id: a.id,
    appId: a.appId,
    key: a.key,
    name: a.name,
    description: a.description,
    tier: a.tier,
    imageURI: a.imageURI,
    maxSupply: BigInt(a.maxSupply),
    capLocked: a.capLocked,
    rewardToken: a.rewardToken as `0x${string}`,
    rewardAmount: BigInt(a.rewardAmount),
    prerequisites: a.prerequisites.map((p) => BigInt(p)),
    hidden: a.hidden,
    active: a.active,
    remainingSupply: BigInt(a.remainingSupply),
    claimCount: a.claimCount ? BigInt(a.claimCount) : undefined,
  }));
}

async function fetchAchievementsFromChain(): Promise<AchievementWithSupply[]> {
  const client = getPublicClient();
  const total = await client.readContract({
    address: ACHIEVEMENT_REGISTRY_ADDRESS,
    abi: achievementRegistryAbi,
    functionName: "totalAchievements",
  });

  const count = Number(total);
  if (count === 0) return [];

  const contracts = [];
  for (let id = 1; id <= count; id++) {
    contracts.push({
      address: ACHIEVEMENT_REGISTRY_ADDRESS,
      abi: achievementRegistryAbi,
      functionName: "getAchievement" as const,
      args: [BigInt(id)],
    });
    contracts.push({
      address: ACHIEVEMENT_BADGE_ADDRESS,
      abi: achievementBadgeAbi,
      functionName: "remainingSupply" as const,
      args: [BigInt(id)],
    });
  }

  const results = await client.multicall({ contracts });

  const achievements: AchievementWithSupply[] = [];
  for (let i = 0; i < count; i++) {
    const defResult = results[i * 2];
    const supplyResult = results[i * 2 + 1];
    if (defResult.status === "failure" || supplyResult.status === "failure") {
      continue;
    }
    const def = defResult.result as AchievementDef;
    achievements.push({
      ...def,
      id: i + 1,
      remainingSupply: supplyResult.result as bigint,
    });
  }

  return achievements;
}

export async function getAllAchievements(): Promise<AchievementWithSupply[]> {
  const redis = getRedis();
  if (redis) {
    try {
      const cached = await redis.get<SerializedAchievement[]>(ACHIEVEMENTS_CACHE_KEY);
      if (cached) return deserialize(cached);
    } catch {
      // fall through to chain
    }
  }

  const achievements = await fetchAchievementsFromChain();

  if (redis) {
    try {
      await redis.set(ACHIEVEMENTS_CACHE_KEY, serialize(achievements), {
        ex: CACHE_TTL_SECONDS,
      });
    } catch {
      // cache write failure is non-fatal
    }
  }

  return achievements;
}

export async function getAchievementById(
  id: number
): Promise<AchievementWithSupply | null> {
  const all = await getAllAchievements();
  return all.find((a) => a.id === id) ?? null;
}

export async function bustAchievementsCache(): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.del(ACHIEVEMENTS_CACHE_KEY);
}
