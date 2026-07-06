"use client";

import { AchievementCard } from "@/components/AchievementCard";
import type { AchievementWithSupply } from "@/lib/types";

export function LivePreviewCard({
  achievement,
}: {
  achievement: AchievementWithSupply;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-wide text-text/50">Live preview</p>
      <AchievementCard achievement={achievement} claimCount={0n} />
    </div>
  );
}
