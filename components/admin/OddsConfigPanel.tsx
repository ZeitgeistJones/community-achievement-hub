"use client";

// Drop into ManageRow in components/admin/ManageAchievements.tsx.
// Shows current odds config for an achievement key, lets the owner pick
// alternate outcomes with weights, and saves/removes via /api/admin/odds.
// Matches the existing ManageRow style exactly (same inputClass, same
// details/summary collapsible, same signAndBustCache-after-save pattern —
// except odds config changes don't need a cache bust since they live in Redis
// and take effect on the next /api/report call).

import { useCallback, useEffect, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { buildAuthMessage } from "@/lib/walletAuth";
import type { AchievementWithSupply } from "@/lib/types";

type OddsOutcome = {
  key: string;
  weight: number;
};

async function fetchConfig(
  appId: string,
  key: string
): Promise<OddsOutcome[] | null> {
  const res = await fetch(
    `/api/admin/odds?appId=${encodeURIComponent(appId)}&key=${encodeURIComponent(key)}`
  );
  const data = await res.json();
  return data?.config?.outcomes ?? null;
}

async function saveConfig(
  address: string,
  signature: string,
  timestamp: number,
  appId: string,
  key: string,
  outcomes: OddsOutcome[]
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/admin/odds", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, signature, timestamp, appId, key, outcomes }),
  });
  const data = await res.json();
  return res.ok ? { ok: true } : { ok: false, error: data.error };
}

async function removeConfig(
  address: string,
  signature: string,
  timestamp: number,
  appId: string,
  key: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/admin/odds", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, signature, timestamp, appId, key }),
  });
  const data = await res.json();
  return res.ok ? { ok: true } : { ok: false, error: data.error };
}

export function OddsConfigPanel({
  achievement,
  allAchievements,
  inputClass,
}: {
  achievement: AchievementWithSupply;
  allAchievements: AchievementWithSupply[];
  inputClass: string;
}) {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [outcomes, setOutcomes] = useState<OddsOutcome[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const config = await fetchConfig(achievement.appId, achievement.key);
    if (config) {
      setOutcomes(config);
    } else {
      // Default: show the achievement itself at weight 100 (no randomness configured)
      setOutcomes([{ key: achievement.key, weight: 100 }]);
    }
    setLoaded(true);
  }, [achievement.appId, achievement.key]);

  useEffect(() => {
    void load();
  }, [load]);

  async function sign() {
    if (!address) throw new Error("No wallet connected");
    const timestamp = Date.now();
    const message = buildAuthMessage(timestamp);
    const signature = await signMessageAsync({ message });
    return { address, signature, timestamp };
  }

  async function handleSave() {
    if (!address) return;
    setBusy(true);
    setStatus(null);
    setError(null);
    try {
      const { address: addr, signature, timestamp } = await sign();
      const result = await saveConfig(
        addr,
        signature,
        timestamp,
        achievement.appId,
        achievement.key,
        outcomes
      );
      if (result.ok) {
        setStatus("Odds config saved — takes effect on next report.");
      } else {
        setError(result.error ?? "Save failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    if (!address) return;
    setBusy(true);
    setStatus(null);
    setError(null);
    try {
      const { address: addr, signature, timestamp } = await sign();
      const result = await removeConfig(
        addr,
        signature,
        timestamp,
        achievement.appId,
        achievement.key
      );
      if (result.ok) {
        setOutcomes([{ key: achievement.key, weight: 100 }]);
        setStatus("Odds config removed — all reports will award this key directly.");
      } else {
        setError(result.error ?? "Remove failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  function addOutcome() {
    setOutcomes((prev) => [...prev, { key: "", weight: 1 }]);
  }

  function removeOutcome(i: number) {
    setOutcomes((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateOutcome(i: number, field: keyof OddsOutcome, value: string) {
    setOutcomes((prev) =>
      prev.map((o, idx) =>
        idx === i
          ? { ...o, [field]: field === "weight" ? Math.max(1, Number(value) || 1) : value }
          : o
      )
    );
  }

  const totalWeight = outcomes.reduce((s, o) => s + o.weight, 0);
  const sameAppAchievements = allAchievements.filter(
    (a) => a.appId === achievement.appId
  );

  if (!loaded) {
    return (
      <p className="mt-2 text-xs text-text/40">Loading odds config…</p>
    );
  }

  return (
    <details className="mt-4 border-t border-white/10 pt-4">
      <summary className="cursor-pointer text-sm font-medium text-text/70 hover:text-text">
        🎲 Randomize this achievement
      </summary>

      <div className="mt-3 space-y-3">
        <p className="text-xs text-text/50">
          When Build Report (or another app) reports{" "}
          <code className="rounded bg-white/5 px-1">{achievement.key}</code>,
          the Hub rolls weighted odds and may award a different badge instead.
          Weights are relative — they don&apos;t need to sum to 100.
        </p>

        {outcomes.map((outcome, i) => (
          <div key={i} className="flex items-center gap-2">
            <select
              value={outcome.key}
              onChange={(e) => updateOutcome(i, "key", e.target.value)}
              className={`${inputClass} flex-1`}
            >
              <option value="">— pick an achievement —</option>
              {sameAppAchievements.map((a) => (
                <option key={a.id} value={a.key}>
                  {a.name} ({a.key})
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={outcome.weight}
              onChange={(e) => updateOutcome(i, "weight", e.target.value)}
              className={`${inputClass} w-20`}
              title="Weight"
            />
            <span className="w-12 text-right text-xs text-text/50">
              {totalWeight > 0
                ? `${((outcome.weight / totalWeight) * 100).toFixed(1)}%`
                : "0%"}
            </span>
            {outcomes.length > 1 && (
              <button
                type="button"
                onClick={() => removeOutcome(i)}
                className="text-xs text-red-300 hover:text-red-200"
                title="Remove"
              >
                ✕
              </button>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={addOutcome}
          className="text-xs text-text/60 hover:text-text"
        >
          + Add outcome
        </button>

        {error && <p className="text-xs text-red-300">{error}</p>}
        {status && <p className="text-xs text-green-300">{status}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy || outcomes.some((o) => !o.key)}
            onClick={handleSave}
            className="rounded-lg border border-white/20 px-3 py-1.5 text-sm hover:bg-white/5 disabled:opacity-50"
          >
            Save odds
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleRemove}
            className="rounded-lg border border-red-500/30 px-3 py-1.5 text-sm text-red-300 hover:bg-red-950/20 disabled:opacity-50"
          >
            Remove randomness
          </button>
        </div>
      </div>
    </details>
  );
}
