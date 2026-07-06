"use client";

import { useAccount, useReadContract } from "wagmi";
import {
  ACHIEVEMENT_BADGE_ADDRESS,
  achievementBadgeAbi,
} from "@/lib/contracts";
import type { AchievementWithSupply } from "@/lib/types";
import type { ReactNode } from "react";

export function HiddenReveal({
  achievement,
  children,
  silhouette,
}: {
  achievement: AchievementWithSupply;
  children: ReactNode;
  silhouette: ReactNode;
}) {
  const { address, isConnected } = useAccount();

  const { data: hasClaimed, isLoading } = useReadContract({
    address: ACHIEVEMENT_BADGE_ADDRESS,
    abi: achievementBadgeAbi,
    functionName: "hasClaimed",
    args: address
      ? [BigInt(achievement.id), address]
      : undefined,
    query: { enabled: achievement.hidden && isConnected && !!address },
  });

  if (!achievement.hidden) return <>{children}</>;

  if (!isConnected || isLoading) return <>{silhouette}</>;

  if (hasClaimed) return <>{children}</>;

  return <>{silhouette}</>;
}
