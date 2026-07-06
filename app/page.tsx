import { AchievementGrid } from "@/components/AchievementGrid";
import { getAllAchievements } from "@/lib/achievements";
import type { AchievementWithSupply } from "@/lib/types";

export default async function HomePage() {
  let achievements: AchievementWithSupply[] = [];
  let error: string | null = null;

  try {
    achievements = await getAllAchievements();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load achievements";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-text">Achievement Directory</h1>
        <p className="mt-2 text-text/60">
          Browse on-chain badges across the ecosystem. Connect a wallet to claim
          achievements from your apps.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          Could not load achievements: {error}. Check your RPC configuration.
        </div>
      ) : null}

      <AchievementGrid achievements={achievements} />
    </div>
  );
}
