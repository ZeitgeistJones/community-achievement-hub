"use client";

import { useEffect, useState } from "react";
import {
  useAccount,
  useSignMessage,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { parseUnits } from "viem";
import { PermanentWarningModal } from "./PermanentWarningModal";
import { OddsConfigPanel } from "./OddsConfigPanel";
import { signAndBustCache } from "@/lib/adminAuth";
import {
  ACHIEVEMENT_REGISTRY_ADDRESS,
  CLAWD_TOKEN_ADDRESS,
  NATIVE_ETH_SENTINEL,
  ZERO_ADDRESS,
  achievementRegistryAbi,
} from "@/lib/contracts";
import type { AchievementWithSupply } from "@/lib/types";
import { getTierName } from "@/lib/tiers";

export function ManageAchievements({
  achievements,
  onRefresh,
}: {
  achievements: AchievementWithSupply[];
  onRefresh: () => void;
}) {
  const { address } = useAccount();
  const { writeContractAsync, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });
  const { signMessageAsync } = useSignMessage();
  const [bustedTx, setBustedTx] = useState<`0x${string}` | null>(null);
  const [lockId, setLockId] = useState<number | null>(null);
  const [maxSupplyInputs, setMaxSupplyInputs] = useState<Record<number, string>>(
    {}
  );
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSuccess || !txHash || bustedTx === txHash || !address) return;
    void (async () => {
      const result = await signAndBustCache(signMessageAsync, address);
      if (result.ok) {
        setBustedTx(txHash);
        setStatus("Updated successfully.");
        onRefresh();
      } else {
        setError(result.error ?? "Cache refresh failed");
      }
    })();
  }, [isSuccess, txHash, bustedTx, address, signMessageAsync, onRefresh]);

  async function runTx(
    fn: Parameters<typeof writeContractAsync>[0]
  ) {
    setError(null);
    setStatus(null);
    try {
      await writeContractAsync(fn);
      setStatus("Transaction submitted…");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transaction failed");
    }
  }

  const inputClass =
    "w-full rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm text-text";

  if (achievements.length === 0) {
    return (
      <p className="text-text/60">No achievements to manage yet. Create one above.</p>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="font-display text-xl">Manage achievements</h2>
      {error && <p className="text-sm text-red-300">{error}</p>}
      {status && <p className="text-sm text-green-300">{status}</p>}

      {achievements.map((a) => (
        <ManageRow
          key={a.id}
          achievement={a}
          inputClass={inputClass}
          maxSupplyInput={maxSupplyInputs[a.id] ?? String(a.maxSupply)}
          onMaxSupplyChange={(v) =>
            setMaxSupplyInputs((prev) => ({ ...prev, [a.id]: v }))
          }
          allAchievements={achievements}
          disabled={isPending || isConfirming}
          onEdit={(fields) =>
            runTx({
              address: ACHIEVEMENT_REGISTRY_ADDRESS,
              abi: achievementRegistryAbi,
              functionName: "editAchievement",
              args: [
                BigInt(a.id),
                fields.name,
                fields.description,
                fields.tier,
                fields.imageURI,
                fields.rewardToken,
                fields.rewardAmount,
                fields.prerequisites,
                fields.hidden,
              ],
            })
          }
          onActivate={() =>
            runTx({
              address: ACHIEVEMENT_REGISTRY_ADDRESS,
              abi: achievementRegistryAbi,
              functionName: "activateAchievement",
              args: [BigInt(a.id)],
            })
          }
          onDeactivate={() =>
            runTx({
              address: ACHIEVEMENT_REGISTRY_ADDRESS,
              abi: achievementRegistryAbi,
              functionName: "deactivateAchievement",
              args: [BigInt(a.id)],
            })
          }
          onSetMaxSupply={() => {
            const newMax = BigInt(maxSupplyInputs[a.id] ?? a.maxSupply.toString());
            if (a.claimCount !== undefined && newMax < a.claimCount) {
              setError(
                `Cannot set max supply below current claim count (${a.claimCount}).`
              );
              return;
            }
            runTx({
              address: ACHIEVEMENT_REGISTRY_ADDRESS,
              abi: achievementRegistryAbi,
              functionName: "setMaxSupply",
              args: [BigInt(a.id), newMax],
            });
          }}
          onLockSupplyCap={() => setLockId(a.id)}
        />
      ))}

      <PermanentWarningModal
        open={lockId !== null}
        title="Lock supply cap?"
        message="This permanently locks the supply cap for this achievement. It cannot be undone."
        onCancel={() => setLockId(null)}
        onConfirm={() => {
          if (lockId === null) return;
          const id = lockId;
          setLockId(null);
          runTx({
            address: ACHIEVEMENT_REGISTRY_ADDRESS,
            abi: achievementRegistryAbi,
            functionName: "lockSupplyCap",
            args: [BigInt(id)],
          });
        }}
      />
    </div>
  );
}

function ManageRow({
  achievement: a,
  inputClass,
  maxSupplyInput,
  onMaxSupplyChange,
  allAchievements,
  disabled,
  onEdit,
  onActivate,
  onDeactivate,
  onSetMaxSupply,
  onLockSupplyCap,
}: {
  achievement: AchievementWithSupply;
  inputClass: string;
  maxSupplyInput: string;
  onMaxSupplyChange: (v: string) => void;
  allAchievements: AchievementWithSupply[];
  disabled: boolean;
  onEdit: (fields: {
    name: string;
    description: string;
    tier: number;
    imageURI: string;
    rewardToken: `0x${string}`;
    rewardAmount: bigint;
    prerequisites: bigint[];
    hidden: boolean;
  }) => void;
  onActivate: () => void;
  onDeactivate: () => void;
  onSetMaxSupply: () => void;
  onLockSupplyCap: () => void;
}) {
  const [name, setName] = useState(a.name);
  const [description, setDescription] = useState(a.description);
  const [tier, setTier] = useState(a.tier);
  const [imageURI, setImageURI] = useState(a.imageURI);
  const [rewardToken, setRewardToken] = useState<"none" | "clawd" | "eth">(
    a.rewardToken.toLowerCase() === CLAWD_TOKEN_ADDRESS.toLowerCase()
      ? "clawd"
      : a.rewardToken.toLowerCase() === NATIVE_ETH_SENTINEL.toLowerCase()
        ? "eth"
        : "none"
  );
  const [rewardAmount, setRewardAmount] = useState(
    (Number(a.rewardAmount) / 1e18).toString()
  );
  const [prerequisites, setPrerequisites] = useState<number[]>(
    a.prerequisites.map((p) => Number(p))
  );
  const [hidden, setHidden] = useState(a.hidden);

  const otherIds = allAchievements.filter((x) => x.id !== a.id);

  function resolveRewardToken(): `0x${string}` {
    if (rewardToken === "clawd") return CLAWD_TOKEN_ADDRESS;
    if (rewardToken === "eth") return NATIVE_ETH_SENTINEL;
    return ZERO_ADDRESS;
  }

  const claimCount = a.claimCount ?? 0n;
  const newMax = BigInt(maxSupplyInput || "0");
  const maxSupplyWarning =
    a.maxSupply > 0n && newMax < claimCount
      ? `Warning: ${newMax} is below ${claimCount} already claimed.`
      : null;

  return (
    <details className="rounded-xl border border-white/10 bg-surface p-4" open>
      <summary className="cursor-pointer font-medium">
        #{a.id} {a.name}{" "}
        <span className="text-text/50">
          · {getTierName(a.tier)} · {a.active ? "active" : "inactive"}
          {a.capLocked ? " · cap locked" : ""}
        </span>
      </summary>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm sm:col-span-2">
          <span className="text-text/60">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </label>
        <label className="space-y-1 text-sm sm:col-span-2">
          <span className="text-text/60">Description</span>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-text/60">Tier</span>
          <select
            value={tier}
            onChange={(e) => setTier(Number(e.target.value))}
            className={inputClass}
          >
            <option value={1}>Common</option>
            <option value={2}>Rare</option>
            <option value={3}>Legendary</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-text/60">Image URL</span>
          <input value={imageURI} onChange={(e) => setImageURI(e.target.value)} className={inputClass} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-text/60">Reward token</span>
          <select
            value={rewardToken}
            onChange={(e) => setRewardToken(e.target.value as typeof rewardToken)}
            className={inputClass}
          >
            <option value="none">None</option>
            <option value="clawd">CLAWD</option>
            <option value="eth">ETH</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-text/60">Reward amount</span>
          <input
            value={rewardAmount}
            onChange={(e) => setRewardAmount(e.target.value)}
            className={inputClass}
          />
        </label>

        {otherIds.length > 0 && (
          <fieldset className="space-y-2 sm:col-span-2">
            <legend className="text-sm text-text/60">Prerequisites</legend>
            <div className="flex flex-wrap gap-2">
              {otherIds.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-2 rounded border border-white/10 px-2 py-1 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={prerequisites.includes(p.id)}
                    onChange={() =>
                      setPrerequisites((prev) =>
                        prev.includes(p.id)
                          ? prev.filter((x) => x !== p.id)
                          : [...prev, p.id]
                      )
                    }
                  />
                  #{p.id}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={hidden}
            onChange={(e) => setHidden(e.target.checked)}
          />
          Hidden
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            onEdit({
              name,
              description,
              tier,
              imageURI,
              rewardToken: resolveRewardToken(),
              rewardAmount: parseUnits(rewardAmount || "0", 18),
              prerequisites: prerequisites.map((p) => BigInt(p)),
              hidden,
            })
          }
          className="rounded-lg border border-white/20 px-3 py-1.5 text-sm hover:bg-white/5 disabled:opacity-50"
        >
          Save edits
        </button>
        {a.active ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onDeactivate}
            className="rounded-lg border border-red-500/40 px-3 py-1.5 text-sm text-red-300 hover:bg-red-950/30 disabled:opacity-50"
          >
            Deactivate
          </button>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={onActivate}
            className="rounded-lg border border-green-500/40 px-3 py-1.5 text-sm text-green-300 hover:bg-green-950/30 disabled:opacity-50"
          >
            Activate
          </button>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-white/10 pt-4">
        <label className="space-y-1 text-sm">
          <span className="text-text/60">Max supply</span>
          <input
            type="number"
            min={0}
            value={maxSupplyInput}
            onChange={(e) => onMaxSupplyChange(e.target.value)}
            className={`${inputClass} w-32`}
            disabled={a.capLocked}
          />
        </label>
        {maxSupplyWarning && (
          <p className="text-xs text-amber-300">{maxSupplyWarning}</p>
        )}
        <button
          type="button"
          disabled={disabled || a.capLocked}
          onClick={onSetMaxSupply}
          className="rounded-lg border border-white/20 px-3 py-1.5 text-sm hover:bg-white/5 disabled:opacity-50"
        >
          Set max supply
        </button>
        {!a.capLocked && (
          <button
            type="button"
            disabled={disabled}
            onClick={onLockSupplyCap}
            className="rounded-lg border border-red-500/40 px-3 py-1.5 text-sm text-red-300 hover:bg-red-950/30 disabled:opacity-50"
          >
            Lock cap permanently
          </button>
        )}
        <span className="text-xs text-text/50">
          Claimed: {claimCount.toString()}
          {a.maxSupply > 0n ? ` / ${a.maxSupply.toString()}` : ""}
        </span>
      </div>

      <OddsConfigPanel
        achievement={a}
        allAchievements={allAchievements}
        inputClass={inputClass}
      />
    </details>
  );
}
