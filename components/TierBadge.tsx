import { getTierConfig } from "@/lib/tiers";

export function TierBadge({ tier }: { tier: number }) {
  const config = getTierConfig(tier);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.borderClass} ${config.bgClass}`}
      style={{ color: config.light }}
    >
      {config.name}
    </span>
  );
}
