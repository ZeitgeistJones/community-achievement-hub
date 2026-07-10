"use client";

// /test — owner-only test console for the claim pipeline. Lets you run the
// full end-to-end flow (report → pending → claim → mint) entirely in the
// browser, no curl needed.
//
// How to use:
//   1. In /admin, create an achievement with appId "hub" and key "test_claim"
//      (tier 1, no reward, uncapped is fine — tier 3 if you want fireworks).
//   2. Connect your owner wallet here and press "Report to my wallet".
//   3. Press "Check pending" — the achievement should appear.
//   4. Press "Unlock" and tap Claim in the overlay. The badge mints for real.
//   5. Clean up afterwards on Basescan with revokeBadge(tokenId) if you don't
//      want the test badge in your collection.

import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { UnlockOverlay } from "@/components/UnlockOverlay";
import { buildAuthMessage } from "@/lib/walletAuth";
import { OWNER_ADDRESS } from "@/lib/contracts";
import type { PendingAchievement } from "@/lib/pendingTypes";

export default function TestConsolePage() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [appId, setAppId] = useState("hub");
  const [key, setKey] = useState("test_claim");
  const [log, setLog] = useState<string[]>([]);
  const [pending, setPending] = useState<PendingAchievement[]>([]);
  const [active, setActive] = useState<PendingAchievement | null>(null);
  const [busy, setBusy] = useState(false);

  const isOwner =
    isConnected &&
    !!address &&
    address.toLowerCase() === OWNER_ADDRESS.toLowerCase();

  function addLog(line: string) {
    setLog((prev) => [
      `${new Date().toLocaleTimeString()} — ${line}`,
      ...prev.slice(0, 19),
    ]);
  }

  async function reportToSelf() {
    if (!address) return;
    setBusy(true);
    try {
      const timestamp = Date.now();
      const signature = await signMessageAsync({
        message: buildAuthMessage(timestamp),
      });
      const res = await fetch("/api/admin/test-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          signature,
          timestamp,
          targetWallet: address,
          appId,
          key,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        addLog(`Report failed: ${data.error ?? res.status}`);
      } else if (data.alreadyClaimed) {
        addLog(
          `Already claimed on-chain (achievement #${data.achievementId}) — revoke it on Basescan to re-test.`
        );
      } else {
        addLog(
          `Reported ${appId}/${key} → achievement #${data.achievementId}${data.alreadyEarned ? " (was already recorded)" : ""}`
        );
      }
    } catch (e) {
      addLog(`Report error: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setBusy(false);
    }
  }

  async function checkPending() {
    if (!address) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/pending?wallet=${address}`);
      const data = await res.json();
      if (!res.ok) {
        addLog(`Pending failed: ${data.error ?? res.status}`);
        return;
      }
      setPending(data.pending ?? []);
      addLog(`Pending: ${data.pending?.length ?? 0} achievement(s)`);
    } catch (e) {
      addLog(`Pending error: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setBusy(false);
    }
  }

  if (!isConnected) {
    return (
      <p className="text-text/60">
        Connect your wallet to use the test console.
      </p>
    );
  }
  if (!isOwner) {
    return (
      <p className="text-text/60">
        This page is only available to the owner wallet.
      </p>
    );
  }

  const inputClass =
    "w-full rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm text-text";

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="font-display text-3xl">Claim pipeline test console</h1>
        <p className="mt-2 text-sm text-text/60">
          Owner-only. Runs the full report → pending → claim flow against the
          real contracts. Create the target achievement in /admin first.
        </p>
      </div>

      <section className="space-y-3 rounded-xl border border-white/10 bg-surface p-5">
        <h2 className="font-display text-lg">1. Report an earn to my wallet</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-text/60">App ID</span>
            <input
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-text/60">Key</span>
            <input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        <button
          onClick={reportToSelf}
          disabled={busy}
          className="rounded-lg bg-legendary px-5 py-2 text-sm font-medium text-bg hover:bg-legendary-light disabled:opacity-50"
        >
          Report to my wallet
        </button>
      </section>

      <section className="space-y-3 rounded-xl border border-white/10 bg-surface p-5">
        <h2 className="font-display text-lg">2. Check pending & claim</h2>
        <button
          onClick={checkPending}
          disabled={busy}
          className="rounded-lg border border-white/15 px-5 py-2 text-sm text-text hover:border-white/30 disabled:opacity-50"
        >
          Check pending
        </button>
        {pending.length > 0 && (
          <ul className="space-y-2">
            {pending.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-lg border border-white/10 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-text/50">
                    #{p.id} · {p.appId}/{p.key} · tier {p.tier}
                  </p>
                </div>
                <button
                  onClick={() => setActive(p)}
                  className="rounded-lg bg-rare px-4 py-1.5 text-sm font-medium text-bg hover:bg-rare-light"
                >
                  Unlock
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2 rounded-xl border border-white/10 bg-surface p-5">
        <h2 className="font-display text-lg">Log</h2>
        {log.length === 0 ? (
          <p className="text-sm text-text/40">Nothing yet.</p>
        ) : (
          <ul className="space-y-1 font-mono text-xs text-text/70">
            {log.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        )}
      </section>

      {active && address && (
        <UnlockOverlay
          achievement={active}
          wallet={address}
          onDone={() => {
            setActive(null);
            void checkPending();
          }}
        />
      )}
    </div>
  );
}
