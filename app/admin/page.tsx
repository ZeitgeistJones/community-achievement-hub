"use client";

import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useSignMessage } from "wagmi";
import { CreateAchievementForm } from "@/components/admin/CreateAchievementForm";
import { ManageAchievements } from "@/components/admin/ManageAchievements";
import { PoolPanel } from "@/components/admin/PoolPanel";
import { ActivityFeed } from "@/components/admin/ActivityFeed";
import { useAchievementsList } from "@/hooks/useAchievementsList";
import { signAndBustCache } from "@/lib/adminAuth";
import { OWNER_ADDRESS } from "@/lib/contracts";

export default function AdminPage() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { achievements, loading, error, refresh } = useAchievementsList();
  const [cacheStatus, setCacheStatus] = useState<string | null>(null);

  const isOwner =
    isConnected &&
    address?.toLowerCase() === OWNER_ADDRESS.toLowerCase();

  async function handleCacheRefresh() {
    if (!address) return;
    setCacheStatus("Signing…");
    const result = await signAndBustCache(signMessageAsync, address);
    if (result.ok) {
      setCacheStatus("Cache refreshed.");
      refresh();
    } else {
      setCacheStatus(result.error ?? "Failed");
    }
  }

  if (!isConnected) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
        <h1 className="font-display text-2xl">Admin</h1>
        <p className="text-text/60">Connect your wallet to manage achievements.</p>
        <div className="flex justify-center">
          <ConnectButton />
        </div>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
        <h1 className="font-display text-2xl">Admin</h1>
        <p className="text-text/60">
          Owner wallet required. Connected:{" "}
          <span className="font-mono text-text/80">
            {address?.slice(0, 6)}…{address?.slice(-4)}
          </span>
        </p>
        <ConnectButton />
      </div>
    );
  }

  const existingIds = achievements.map((a) => ({ id: a.id, name: a.name }));

  return (
    <div className="space-y-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Admin</h1>
          <p className="mt-1 text-sm text-text/50">
            Create and manage on-chain achievements
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void handleCacheRefresh()}
            className="rounded-lg border border-white/20 px-4 py-2 text-sm hover:bg-white/5"
          >
            Refresh cache
          </button>
          <ConnectButton />
        </div>
      </div>

      {cacheStatus && (
        <p className="text-sm text-text/60">{cacheStatus}</p>
      )}

      {loading && <p className="text-text/50">Loading achievements…</p>}
      {error && <p className="text-sm text-red-300">{error}</p>}

      <section className="rounded-xl border border-white/10 bg-surface/50 p-6">
        <CreateAchievementForm existingIds={existingIds} onSuccess={refresh} />
      </section>

      <section className="rounded-xl border border-white/10 bg-surface/50 p-6">
        <ManageAchievements achievements={achievements} onRefresh={refresh} />
      </section>

      <section className="rounded-xl border border-white/10 bg-surface/50 p-6">
        <PoolPanel />
      </section>

      <section className="rounded-xl border border-white/10 bg-surface/50 p-6">
        <ActivityFeed />
      </section>
    </div>
  );
}
