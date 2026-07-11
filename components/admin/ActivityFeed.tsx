"use client";

import { useEffect, useState } from "react";
import type { ActivityFeedItem } from "@/lib/activityFeed";
import { truncateAddress } from "@/lib/format";

export function ActivityFeed() {
  const [items, setItems] = useState<ActivityFeedItem[]>([]);
  const [scanBlocks, setScanBlocks] = useState<string | null>(null);
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
          scanBlocks?: string;
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error ?? "Failed to load activity");
        }
        // #region agent log
        fetch("http://127.0.0.1:7685/ingest/8d9fda70-28d1-4679-bc79-33127703700a", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "939fee",
          },
          body: JSON.stringify({
            sessionId: "939fee",
            runId: "pre-fix",
            hypothesisId: "H4",
            location: "components/admin/ActivityFeed.tsx:fetch:ok",
            message: "activity API client response",
            data: {
              itemCount: data.items?.length ?? 0,
              scanBlocks: data.scanBlocks ?? null,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
        setItems(data.items ?? []);
        setScanBlocks(data.scanBlocks ?? null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to load activity";
        // #region agent log
        fetch("http://127.0.0.1:7685/ingest/8d9fda70-28d1-4679-bc79-33127703700a", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "939fee",
          },
          body: JSON.stringify({
            sessionId: "939fee",
            runId: "pre-fix",
            hypothesisId: "H4",
            location: "components/admin/ActivityFeed.tsx:fetch:error",
            message: "activity API client error",
            data: { error: msg.slice(0, 300) },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
        setError(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl">Activity feed</h2>
      <p className="text-sm text-text/50">
        Recent activity on Base
        {scanBlocks ? ` (~${Number(scanBlocks).toLocaleString()} blocks)` : ""}
      </p>

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
