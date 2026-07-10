// Client-safe (JSON-serializable) shape of a pending achievement, shared by
// /api/pending, the UnlockOverlay component, and the /test console.

import type { AchievementWithSupply } from "./types";

export type PendingAchievement = {
  id: number;
  appId: string;
  key: string;
  name: string;
  description: string;
  tier: number;
  imageURI: string;
  maxSupply: string; // bigint as string; "0" = uncapped
  capLocked: boolean;
  rewardToken: string;
  rewardAmount: string; // bigint as string
  hidden: boolean;
  earnedAt: number | null; // ms timestamp, display only
};

export function toPendingAchievement(
  a: AchievementWithSupply,
  earnedAt: number | null
): PendingAchievement {
  return {
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
    hidden: a.hidden,
    earnedAt,
  };
}
