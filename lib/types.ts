export type AchievementDef = {
  appId: string;
  key: string;
  name: string;
  description: string;
  tier: number;
  imageURI: string;
  maxSupply: bigint;
  capLocked: boolean;
  rewardToken: `0x${string}`;
  rewardAmount: bigint;
  prerequisites: readonly bigint[];
  hidden: boolean;
  active: boolean;
};

export type AchievementWithSupply = AchievementDef & {
  id: number;
  remainingSupply: bigint;
  claimCount?: bigint;
};

export const ACHIEVEMENTS_CACHE_KEY = "cache:achievements";
