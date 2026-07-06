"use client";

import { useCallback, useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import {
  ACHIEVEMENT_BADGE_ADDRESS,
  ACHIEVEMENT_REGISTRY_ADDRESS,
  achievementBadgeAbi,
  achievementRegistryAbi,
} from "@/lib/contracts";
import type { AchievementDef, AchievementWithSupply } from "@/lib/types";

export function useAchievementsList() {
  const publicClient = usePublicClient();
  const [achievements, setAchievements] = useState<AchievementWithSupply[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!publicClient) return;
    setLoading(true);
    setError(null);
    try {
      const total = await publicClient.readContract({
        address: ACHIEVEMENT_REGISTRY_ADDRESS,
        abi: achievementRegistryAbi,
        functionName: "totalAchievements",
      });

      const count = Number(total);
      if (count === 0) {
        setAchievements([]);
        return;
      }

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
        contracts.push({
          address: ACHIEVEMENT_BADGE_ADDRESS,
          abi: achievementBadgeAbi,
          functionName: "claimCount" as const,
          args: [BigInt(id)],
        });
      }

      const results = await publicClient.multicall({ contracts });
      const list: AchievementWithSupply[] = [];

      for (let i = 0; i < count; i++) {
        const defResult = results[i * 3];
        const supplyResult = results[i * 3 + 1];
        const claimResult = results[i * 3 + 2];
        if (
          defResult.status === "failure" ||
          supplyResult.status === "failure" ||
          claimResult.status === "failure"
        ) {
          continue;
        }
        const def = defResult.result as AchievementDef;
        list.push({
          ...def,
          id: i + 1,
          remainingSupply: supplyResult.result as bigint,
          claimCount: claimResult.result as bigint,
        });
      }

      setAchievements(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load achievements");
    } finally {
      setLoading(false);
    }
  }, [publicClient]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { achievements, loading, error, refresh };
}
