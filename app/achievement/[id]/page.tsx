import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AchievementCard } from "@/components/AchievementCard";
import { HiddenReveal } from "@/components/HiddenReveal";
import { SupplyBar } from "@/components/SupplyBar";
import { TierBadge } from "@/components/TierBadge";
import { getAchievementById, getAllAchievements } from "@/lib/achievements";
import {
  ACHIEVEMENT_BADGE_ADDRESS,
  ACHIEVEMENT_REGISTRY_ADDRESS,
  achievementBadgeAbi,
  achievementRegistryAbi,
} from "@/lib/contracts";
import { getPublicClient } from "@/lib/clients";
import { formatRewardLine, truncateAddress } from "@/lib/format";
import { getTierName } from "@/lib/tiers";

type PageProps = { params: { id: string } };

export default async function AchievementDetailPage({ params }: PageProps) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) notFound();

  const client = getPublicClient();

  const exists = await client.readContract({
    address: ACHIEVEMENT_REGISTRY_ADDRESS,
    abi: achievementRegistryAbi,
    functionName: "exists",
    args: [BigInt(id)],
  });

  if (!exists) notFound();

  const achievement = await getAchievementById(id);
  if (!achievement) notFound();

  const [holders, claimCount] = await Promise.all([
    client.readContract({
      address: ACHIEVEMENT_BADGE_ADDRESS,
      abi: achievementBadgeAbi,
      functionName: "holdersOfAchievement",
      args: [BigInt(id)],
    }),
    client.readContract({
      address: ACHIEVEMENT_BADGE_ADDRESS,
      abi: achievementBadgeAbi,
      functionName: "claimCount",
      args: [BigInt(id)],
    }),
  ]);

  const allAchievements = await getAllAchievements();
  const prereqMap = new Map(allAchievements.map((a) => [a.id, a]));
  const rewardLine = formatRewardLine(
    achievement.rewardToken,
    achievement.rewardAmount
  );

  const fullContent = (
    <div className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-surface">
          {achievement.imageURI ? (
            <Image
              src={achievement.imageURI}
              alt={achievement.name}
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-full items-center justify-center text-text/30">
              No image
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl">{achievement.name}</h1>
            <TierBadge tier={achievement.tier} />
          </div>

          <p className="text-sm uppercase tracking-wide text-text/40">
            {achievement.appId} · {getTierName(achievement.tier)}
          </p>

          <p className="text-text/80 leading-relaxed">{achievement.description}</p>

          {rewardLine && (
            <p className="rounded-lg border border-legendary/30 bg-legendary/10 px-3 py-2 text-sm text-legendary-light">
              {rewardLine}
            </p>
          )}

          {!achievement.active && (
            <p className="text-sm text-red-300">This achievement is no longer claimable.</p>
          )}

          {achievement.maxSupply > 0n && (
            <div className="max-w-sm">
              <SupplyBar
                claimCount={claimCount}
                maxSupply={achievement.maxSupply}
                capLocked={achievement.capLocked}
              />
              {achievement.remainingSupply > 0n ? (
                <p className="mt-1 text-xs text-text/50">
                  {achievement.remainingSupply.toString()} editions remaining
                </p>
              ) : (
                <p className="mt-1 text-xs text-red-300">Sold out</p>
              )}
            </div>
          )}
        </div>
      </div>

      {achievement.prerequisites.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-xl">Prerequisites</h2>
          <div className="flex flex-wrap gap-3">
            {achievement.prerequisites.map((prereqId) => {
              const prereq = prereqMap.get(Number(prereqId));
              return (
                <Link
                  key={prereqId.toString()}
                  href={`/achievement/${prereqId}`}
                  className="block w-48"
                >
                  {prereq ? (
                    <AchievementCard achievement={prereq} compact href={undefined} />
                  ) : (
                    <div className="rounded-xl border border-white/10 bg-surface p-4 text-sm text-text/60">
                      Achievement #{prereqId.toString()}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-display text-xl">
          Holders ({holders.length})
        </h2>
        {holders.length === 0 ? (
          <p className="text-text/50">No one has claimed this badge yet.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {holders.map((holder) => (
              <li key={holder}>
                <Link
                  href={`/trophy-case/${holder}`}
                  className="block rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm font-mono text-text/80 hover:border-white/20 hover:text-text"
                >
                  {truncateAddress(holder)}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );

  const silhouette = (
    <div className="space-y-6 text-center">
      <div className="mx-auto flex aspect-square max-w-md items-center justify-center rounded-xl border border-white/5 bg-hidden">
        <span className="font-mono text-4xl text-white/30">???</span>
      </div>
      <p className="italic text-text/60">{achievement.description}</p>
      <p className="text-sm text-text/40">
        Connect a wallet and claim this badge to reveal it.
      </p>
    </div>
  );

  return (
    <HiddenReveal achievement={achievement} silhouette={silhouette}>
      {fullContent}
    </HiddenReveal>
  );
}
