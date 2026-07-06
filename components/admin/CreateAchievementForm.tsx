"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useSignMessage,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { parseUnits } from "viem";
import { LivePreviewCard } from "./LivePreviewCard";
import { PermanentWarningModal } from "./PermanentWarningModal";
import { signAndBustCache } from "@/lib/adminAuth";
import {
  ACHIEVEMENT_REGISTRY_ADDRESS,
  CLAWD_TOKEN_ADDRESS,
  NATIVE_ETH_SENTINEL,
  ZERO_ADDRESS,
  achievementRegistryAbi,
} from "@/lib/contracts";
import type { AchievementWithSupply } from "@/lib/types";

const defaultForm = {
  appId: "",
  key: "",
  name: "",
  description: "",
  tier: 1,
  imageURI: "",
  maxSupply: "0",
  capLocked: false,
  rewardToken: "none" as "none" | "clawd" | "eth",
  rewardAmount: "0",
  prerequisites: [] as number[],
  hidden: false,
  active: true,
};

export function CreateAchievementForm({
  existingIds,
  onSuccess,
}: {
  existingIds: { id: number; name: string }[];
  onSuccess: () => void;
}) {
  const { address } = useAccount();
  const [form, setForm] = useState(defaultForm);
  const [showCapWarning, setShowCapWarning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bustedTx, setBustedTx] = useState<`0x${string}` | null>(null);

  const { writeContractAsync, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });
  const { signMessageAsync } = useSignMessage();

  const preview: AchievementWithSupply = useMemo(
    () => ({
      id: 0,
      appId: form.appId || "preview",
      key: form.key || "preview",
      name: form.name || "New Achievement",
      description: form.description || "Description preview",
      tier: form.tier,
      imageURI: form.imageURI,
      maxSupply: BigInt(form.maxSupply || "0"),
      capLocked: form.capLocked,
      rewardToken:
        form.rewardToken === "clawd"
          ? CLAWD_TOKEN_ADDRESS
          : form.rewardToken === "eth"
            ? NATIVE_ETH_SENTINEL
            : ZERO_ADDRESS,
      rewardAmount: parseUnits(form.rewardAmount || "0", 18),
      prerequisites: form.prerequisites.map((p) => BigInt(p)),
      hidden: form.hidden,
      active: form.active,
      remainingSupply: BigInt(form.maxSupply || "0"),
    }),
    [form]
  );

  useEffect(() => {
    if (!isSuccess || !txHash || bustedTx === txHash || !address) return;

    void (async () => {
      setStatus("Refreshing cache…");
      const result = await signAndBustCache(signMessageAsync, address);
      if (!result.ok) {
        setError(result.error ?? "Cache refresh failed");
        return;
      }
      setBustedTx(txHash);
      setStatus("Achievement created successfully.");
      setForm(defaultForm);
      onSuccess();
    })();
  }, [isSuccess, txHash, bustedTx, address, signMessageAsync, onSuccess]);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function togglePrereq(id: number) {
    setForm((prev) => ({
      ...prev,
      prerequisites: prev.prerequisites.includes(id)
        ? prev.prerequisites.filter((p) => p !== id)
        : [...prev.prerequisites, id],
    }));
  }

  async function doSubmit() {
    setError(null);
    setStatus(null);

    const rewardToken =
      form.rewardToken === "clawd"
        ? CLAWD_TOKEN_ADDRESS
        : form.rewardToken === "eth"
          ? NATIVE_ETH_SENTINEL
          : ZERO_ADDRESS;

    try {
      await writeContractAsync({
        address: ACHIEVEMENT_REGISTRY_ADDRESS,
        abi: achievementRegistryAbi,
        functionName: "createAchievement",
        args: [
          {
            appId: form.appId,
            key: form.key,
            name: form.name,
            description: form.description,
            tier: form.tier,
            imageURI: form.imageURI,
            maxSupply: BigInt(form.maxSupply || "0"),
            capLocked: form.capLocked,
            rewardToken,
            rewardAmount: parseUnits(form.rewardAmount || "0", 18),
            prerequisites: form.prerequisites.map((p) => BigInt(p)),
            hidden: form.hidden,
            active: form.active,
          },
        ],
      });
      setStatus("Transaction submitted…");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transaction failed");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.capLocked) {
      setShowCapWarning(true);
      return;
    }
    void doSubmit();
  }

  const inputClass =
    "w-full rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm text-text";

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form onSubmit={handleSubmit} className="space-y-4">
        <h2 className="font-display text-xl">Create achievement</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-text/60">App ID</span>
            <input
              required
              value={form.appId}
              onChange={(e) => update("appId", e.target.value)}
              className={inputClass}
              placeholder="hub"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-text/60">Key</span>
            <input
              required
              value={form.key}
              onChange={(e) => update("key", e.target.value)}
              className={inputClass}
              placeholder="showman"
            />
          </label>
        </div>

        <label className="block space-y-1 text-sm">
          <span className="text-text/60">Name</span>
          <input
            required
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="text-text/60">Description</span>
          <textarea
            required
            rows={3}
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            className={inputClass}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-text/60">Tier</span>
            <select
              value={form.tier}
              onChange={(e) => update("tier", Number(e.target.value))}
              className={inputClass}
            >
              <option value={1}>Common</option>
              <option value={2}>Rare</option>
              <option value={3}>Legendary</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-text/60">Max supply (0 = unlimited)</span>
            <input
              type="number"
              min={0}
              value={form.maxSupply}
              onChange={(e) => update("maxSupply", e.target.value)}
              className={inputClass}
            />
          </label>
        </div>

        <label className="block space-y-1 text-sm">
          <span className="text-text/60">Image URL</span>
          <input
            value={form.imageURI}
            onChange={(e) => update("imageURI", e.target.value)}
            className={inputClass}
            placeholder="https://..."
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-text/60">Reward token</span>
            <select
              value={form.rewardToken}
              onChange={(e) =>
                update("rewardToken", e.target.value as typeof form.rewardToken)
              }
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
              type="text"
              value={form.rewardAmount}
              onChange={(e) => update("rewardAmount", e.target.value)}
              className={inputClass}
            />
          </label>
        </div>

        {existingIds.length > 0 && (
          <fieldset className="space-y-2">
            <legend className="text-sm text-text/60">Prerequisites</legend>
            <div className="flex flex-wrap gap-2">
              {existingIds.map(({ id, name }) => (
                <label
                  key={id}
                  className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={form.prerequisites.includes(id)}
                    onChange={() => togglePrereq(id)}
                  />
                  #{id} {name}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.capLocked}
              onChange={(e) => update("capLocked", e.target.checked)}
            />
            Lock supply cap permanently
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.hidden}
              onChange={(e) => update("hidden", e.target.checked)}
            />
            Hidden
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => update("active", e.target.checked)}
            />
            Active
          </label>
        </div>

        {error && <p className="text-sm text-red-300">{error}</p>}
        {status && <p className="text-sm text-green-300">{status}</p>}

        <button
          type="submit"
          disabled={isPending || isConfirming}
          className="rounded-lg bg-legendary px-6 py-2.5 text-sm font-medium text-bg hover:bg-legendary-light disabled:opacity-50"
        >
          {isPending || isConfirming ? "Submitting…" : "Create achievement"}
        </button>
      </form>

      <LivePreviewCard achievement={preview} />

      <PermanentWarningModal
        open={showCapWarning}
        title="Lock supply cap?"
        message="Once capLocked is set to true, it cannot be undone. The maximum supply becomes permanent."
        onCancel={() => setShowCapWarning(false)}
        onConfirm={() => {
          setShowCapWarning(false);
          void doSubmit();
        }}
      />
    </div>
  );
}
