"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { buildAuthMessage } from "@/lib/walletAuth";
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

function cropToSquarePng(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const size = 1024;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not available"));
        return;
      }
      const scale = Math.max(size / img.width, size / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const dx = (size - drawW) / 2;
      const dy = (size - drawH) / 2;
      ctx.drawImage(img, dx, dy, drawW, drawH);
      canvas.toBlob(
        (blob) => {
          if (!blob) reject(new Error("Failed to export PNG"));
          else resolve(blob);
        },
        "image/png"
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image"));
    };
    img.src = objectUrl;
  });
}

export function CreateAchievementForm({
  existingIds,
  onSuccess,
}: {
  existingIds: { id: number; name: string }[];
  onSuccess: () => void;
}) {
  const { address } = useAccount();
  const [form, setForm] = useState(defaultForm);
  const [pasteConfig, setPasteConfig] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [showCapWarning, setShowCapWarning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [bustedTx, setBustedTx] = useState<`0x${string}` | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  async function handleImageFile(file: File) {
    if (!address) {
      setUploadError("Connect the owner wallet to upload");
      return;
    }
    setUploadError(null);
    setUploading(true);
    try {
      const png = await cropToSquarePng(file);
      const timestamp = Date.now();
      const message = buildAuthMessage(timestamp);
      const signature = await signMessageAsync({ message });

      const body = new FormData();
      body.append(
        "file",
        new File([png], "badge.png", { type: "image/png" })
      );
      body.append("address", address);
      body.append("signature", signature);
      body.append("timestamp", String(timestamp));

      const res = await fetch("/api/admin/upload-image", {
        method: "POST",
        body,
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setUploadError(data.error ?? "Upload failed");
        return;
      }
      update("imageURI", data.url);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function onImagePaste(e: React.ClipboardEvent) {
    const files = e.clipboardData.files;
    if (files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith("image/")) return;
    e.preventDefault();
    void handleImageFile(file);
  }

  function onImageDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith("image/")) return;
    void handleImageFile(file);
  }

  function loadPasteConfig() {
    setPasteError(null);
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(pasteConfig) as Record<string, unknown>;
    } catch (e) {
      setPasteError(e instanceof Error ? e.message : "Invalid JSON");
      return;
    }

    if (
      "tier" in parsed &&
      parsed.tier !== 1 &&
      parsed.tier !== 2 &&
      parsed.tier !== 3
    ) {
      setPasteError("tier must be 1, 2, or 3");
      return;
    }
    if (
      "rewardToken" in parsed &&
      parsed.rewardToken !== "none" &&
      parsed.rewardToken !== "clawd" &&
      parsed.rewardToken !== "eth"
    ) {
      setPasteError('rewardToken must be "none", "clawd", or "eth"');
      return;
    }
    if ("maxSupply" in parsed && typeof parsed.maxSupply !== "string") {
      setPasteError("maxSupply must be a string");
      return;
    }
    if ("rewardAmount" in parsed && typeof parsed.rewardAmount !== "string") {
      setPasteError("rewardAmount must be a string");
      return;
    }
    if ("prerequisites" in parsed) {
      if (
        !Array.isArray(parsed.prerequisites) ||
        !parsed.prerequisites.every((p) => typeof p === "number")
      ) {
        setPasteError("prerequisites must be an array of numbers");
        return;
      }
    }

    setForm((prev) => ({ ...prev, ...parsed }));
    setPasteConfig("");
    setPasteError(null);
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

        <details className="space-y-2">
          <summary className="cursor-pointer text-sm text-text/60">
            Paste config
          </summary>
          <textarea
            rows={4}
            value={pasteConfig}
            onChange={(e) => setPasteConfig(e.target.value)}
            className={inputClass}
            placeholder='{"appId":"hub","key":"showman",...}'
          />
          <button
            type="button"
            onClick={loadPasteConfig}
            className="rounded-lg border border-white/10 px-4 py-1.5 text-sm hover:bg-white/5"
          >
            Load
          </button>
          {pasteError && <p className="text-sm text-red-300">{pasteError}</p>}
        </details>

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

        <div className="space-y-2">
          <span className="text-sm text-text/60">Badge image</span>
          <div
            tabIndex={0}
            onPaste={onImagePaste}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onImageDrop}
            onClick={() => !uploading && fileInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-white/20 bg-black/20 px-4 py-8 text-center text-sm text-text/60 hover:border-white/40"
          >
            {uploading
              ? "Uploading…"
              : "Paste, drop, or click to upload a square badge image"}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void handleImageFile(file);
              }}
            />
          </div>
          {uploadError && <p className="text-sm text-red-300">{uploadError}</p>}
          <label className="block space-y-1 text-sm">
            <span className="text-text/60">Image URL</span>
            <input
              value={form.imageURI}
              onChange={(e) => update("imageURI", e.target.value)}
              className={inputClass}
              placeholder="https://..."
            />
          </label>
        </div>

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
