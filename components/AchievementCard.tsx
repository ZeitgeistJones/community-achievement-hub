import Image from "next/image";
import Link from "next/link";
import { getTierConfig } from "@/lib/tiers";
import type { AchievementWithSupply } from "@/lib/types";
import { SupplyBar } from "./SupplyBar";
import { TierBadge } from "./TierBadge";

type AchievementCardProps = {
  achievement: AchievementWithSupply;
  claimCount?: bigint;
  href?: string;
  compact?: boolean;
};

export function AchievementCard({
  achievement,
  claimCount = 0n,
  href,
  compact = false,
}: AchievementCardProps) {
  const tierConfig = getTierConfig(achievement.tier);
  const isCapped = achievement.maxSupply > 0n;
  const isHidden = achievement.hidden;
  const isInactive = !achievement.active;

  const cardContent = (
    <article
      className={`relative flex flex-col overflow-hidden rounded-xl border bg-surface transition hover:border-white/20 ${
        isInactive ? "opacity-60 grayscale" : ""
      } ${isHidden ? "border-white/5 bg-hidden" : tierConfig.borderClass} ${
        achievement.tier === 3 && !isHidden ? tierConfig.glowClass : ""
      }`}
    >
      {isInactive && (
        <div className="absolute right-0 top-3 z-10 rounded-l-md bg-red-900/80 px-2 py-1 text-xs font-medium text-red-200">
          No longer claimable
        </div>
      )}

      <div className="relative aspect-[4/3] w-full overflow-hidden bg-black/30">
        {isHidden ? (
          <div className="flex h-full items-center justify-center">
            <div
              className="h-24 w-24 rounded-full bg-white/5 blur-md"
              aria-hidden
            />
            <span className="absolute font-mono text-2xl text-white/30">???</span>
          </div>
        ) : achievement.imageURI ? (
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

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3
            className={`font-display text-lg leading-tight ${
              isHidden ? "font-mono text-white/40" : "text-text"
            }`}
          >
            {isHidden ? "???" : achievement.name}
          </h3>
          <TierBadge tier={achievement.tier} />
        </div>

        {!compact && (
          <p
            className={`text-sm text-text/70 line-clamp-2 ${
              isHidden ? "italic" : ""
            }`}
          >
            {achievement.description}
          </p>
        )}

        <p className="mt-auto text-xs uppercase tracking-wide text-text/40">
          {achievement.appId}
        </p>

        {isCapped && !isHidden && (
          <SupplyBar
            claimCount={claimCount}
            maxSupply={achievement.maxSupply}
            capLocked={achievement.capLocked}
          />
        )}
      </div>
    </article>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {cardContent}
      </Link>
    );
  }

  return cardContent;
}
