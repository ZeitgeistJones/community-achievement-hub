"use client";

import { useEffect, useState } from "react";
import type { ActivityFeedItem } from "@/lib/activityFeed";
import { truncateAddress } from "@/lib/format";

export function ActivityFeed() {
  const [items, setItems] = useState<ActivityFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/activity");
        const data = (await res.json()) as {
          items?: ActivityFeedItem[];
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error ?? "Failed to load activity");
        }
        setItems(data.items ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load activity");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl">Activity feed</h2>
      <p className="text-sm text-text/50">Last ~50,000 blocks on Base</p>

      {loading && <p className="text-text/50">Loading events…</p>}
      {error && <p className="text-sm text-red-300">{error}</p>}

      {!loading && !error && items.length === 0 && (
        <p className="text-text/50">No recent claim or reward activity.</p>
      )}

      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={`${item.transactionHash}-${item.kind}-${item.achievementId}`}
            className={`rounded-lg border px-4 py-3 text-sm ${
              item.kind === "shortfall"
                ? "border-red-500/50 bg-red-950/40 text-red-100"
                : "border-white/10 bg-surface"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">
                {item.kind === "claimed" && "Badge claimed"}
                {item.kind === "paid" && "Reward paid"}
                {item.kind === "shortfall" && "Reward shortfall"}
              </span>
              <span className="text-xs text-text/40">
                Block {item.blockNumber}
              </span>
            </div>
            <p className="mt-1 text-text/70">
              Achievement #{item.achievementId} ·{" "}
              {truncateAddress(item.recipient)} · {item.detail}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
