"use client";

import { useMemo, useState } from "react";
import type { AchievementWithSupply } from "@/lib/types";
import { AchievementCard } from "./AchievementCard";
import { getTierName } from "@/lib/tiers";

export type FilterState = {
  appId: string;
  tier: string;
  stillAvailable: boolean;
};

export function DirectoryFilters({
  achievements,
  onChange,
}: {
  achievements: AchievementWithSupply[];
  onChange: (filters: FilterState) => void;
}) {
  const appIds = useMemo(
    () => [...new Set(achievements.map((a) => a.appId))].sort(),
    [achievements]
  );

  const [appId, setAppId] = useState("");
  const [tier, setTier] = useState("");
  const [stillAvailable, setStillAvailable] = useState(false);

  function update(partial: Partial<FilterState>) {
    const next = {
      appId: partial.appId ?? appId,
      tier: partial.tier ?? tier,
      stillAvailable: partial.stillAvailable ?? stillAvailable,
    };
    if (partial.appId !== undefined) setAppId(partial.appId);
    if (partial.tier !== undefined) setTier(partial.tier);
    if (partial.stillAvailable !== undefined) setStillAvailable(partial.stillAvailable);
    onChange(next);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-surface p-4">
      <label className="flex flex-col gap-1 text-xs text-text/60">
        App
        <select
          value={appId}
          onChange={(e) => update({ appId: e.target.value })}
          className="rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm text-text"
        >
          <option value="">All apps</option>
          {appIds.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-text/60">
        Tier
        <select
          value={tier}
          onChange={(e) => update({ tier: e.target.value })}
          className="rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm text-text"
        >
          <option value="">All tiers</option>
          <option value="1">{getTierName(1)}</option>
          <option value="2">{getTierName(2)}</option>
          <option value="3">{getTierName(3)}</option>
        </select>
      </label>

      <label className="flex items-center gap-2 self-end pb-2 text-sm text-text/80">
        <input
          type="checkbox"
          checked={stillAvailable}
          onChange={(e) => update({ stillAvailable: e.target.checked })}
          className="rounded border-white/20"
        />
        Still available
      </label>
    </div>
  );
}

export function AchievementGrid({
  achievements,
}: {
  achievements: AchievementWithSupply[];
}) {
  const [filters, setFilters] = useState<FilterState>({
    appId: "",
    tier: "",
    stillAvailable: false,
  });

  const filtered = useMemo(() => {
    return achievements.filter((a) => {
      if (filters.appId && a.appId !== filters.appId) return false;
      if (filters.tier && String(a.tier) !== filters.tier) return false;
      if (filters.stillAvailable) {
        const available = a.maxSupply === 0n || a.remainingSupply > 0n;
        if (!available) return false;
      }
      return true;
    });
  }, [achievements, filters]);

  const grouped = useMemo(() => {
    const map = new Map<string, AchievementWithSupply[]>();
    for (const a of filtered) {
      const list = map.get(a.appId) ?? [];
      list.push(a);
      map.set(a.appId, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  if (achievements.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/15 bg-surface/50 px-6 py-16 text-center">
        <p className="text-lg text-text/80">
          No achievements yet — check back soon
        </p>
        <p className="mt-2 text-sm text-text/50">
          New badges will appear here once they are created on-chain.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <DirectoryFilters achievements={achievements} onChange={setFilters} />

      {filtered.length === 0 ? (
        <p className="text-center text-text/60">No achievements match your filters.</p>
      ) : (
        grouped.map(([appId, items]) => (
          <section key={appId}>
            <h2 className="mb-4 font-display text-xl text-text/90">{appId}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((a) => (
                <AchievementCard
                  key={a.id}
                  achievement={a}
                  href={`/achievement/${a.id}`}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
