"use client";

// The magic moment. Tier-scaled celebration:
//   Tier 1 (Common)    → bottom-right toast, slide-in
//   Tier 2 (Rare)      → dimmed centered modal, badge flip-in
//   Tier 3 (Legendary) → full-screen takeover with burst + confetti
// Entirely backend-submitted: tapping Claim calls /api/claim and the badge
// mints with ZERO wallet popups and zero gas for the user.

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { formatRewardLine } from "@/lib/format";
import { getTierConfig } from "@/lib/tiers";
import type { PendingAchievement } from "@/lib/pendingTypes";

type ClaimResponse = {
  ok?: boolean;
  alreadyClaimed?: boolean;
  txHash?: string | null;
  edition?: string | null;
  maxSupply?: string;
  rewardPaid?: boolean;
  error?: string;
};

type Phase = "ready" | "claiming" | "success" | "error";

export function UnlockOverlay({
  achievement,
  wallet,
  onDone,
}: {
  achievement: PendingAchievement;
  wallet: string;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [error, setError] = useState<string | null>(null);
  const [claim, setClaim] = useState<ClaimResponse | null>(null);

  const tier = getTierConfig(achievement.tier);
  const rewardLine = useMemo(
    () =>
      formatRewardLine(achievement.rewardToken, BigInt(achievement.rewardAmount)),
    [achievement.rewardToken, achievement.rewardAmount]
  );

  async function doClaim() {
    setPhase("claiming");
    setError(null);
    try {
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, achievementId: achievement.id }),
      });
      const data = (await res.json()) as ClaimResponse;
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setPhase("error");
        return;
      }
      setClaim(data);
      setPhase("success");
      if (achievement.tier === 1) {
        setTimeout(onDone, 5000); // toast auto-dismisses
      }
    } catch {
      setError("Couldn't reach the claim service. Please try again.");
      setPhase("error");
    }
  }

  const editionLine =
    phase === "success" &&
    claim?.edition &&
    achievement.maxSupply !== "0"
      ? `You are #${claim.edition} of ${achievement.maxSupply}`
      : null;

  const badgeArt = (
    <div
      className={`relative mx-auto flex aspect-square items-center justify-center overflow-hidden rounded-xl border-2 ${tier.borderClass} ${tier.bgClass} ${tier.glowClass}`}
      style={{ width: achievement.tier === 3 ? 220 : 140 }}
    >
      {achievement.imageURI ? (
        <Image
          src={achievement.imageURI}
          alt={achievement.name}
          fill
          className="object-cover"
          unoptimized
        />
      ) : (
        <span className="font-display text-4xl" style={{ color: tier.light }}>
          ★
        </span>
      )}
      <span className="unlock-shine pointer-events-none absolute inset-0" />
    </div>
  );

  const body = (
    <>
      {phase !== "success" ? (
        <>
          <p
            className="text-xs font-medium uppercase tracking-widest"
            style={{ color: tier.light }}
          >
            Achievement Unlocked
          </p>
          <h3 className="font-display text-xl text-text">{achievement.name}</h3>
          <p className="text-sm text-text/60">{achievement.description}</p>
          {rewardLine && (
            <p
              className="rounded-lg px-3 py-1.5 text-sm"
              style={{
                backgroundColor: `${tier.primary}1a`,
                color: tier.light,
              }}
            >
              {rewardLine}
            </p>
          )}
          {phase === "error" && error && (
            <p className="text-sm text-red-300">{error}</p>
          )}
          <button
            onClick={doClaim}
            disabled={phase === "claiming"}
            className="mt-1 w-full rounded-lg px-5 py-2.5 text-sm font-semibold text-bg transition hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: tier.light }}
          >
            {phase === "claiming" ? (
              <span className="inline-flex items-center gap-2">
                <span className="unlock-spinner" /> Claiming…
              </span>
            ) : phase === "error" ? (
              "Retry"
            ) : (
              "Claim"
            )}
          </button>
        </>
      ) : (
        <>
          <p className="text-lg font-semibold" style={{ color: tier.light }}>
            ✓ Added to your Trophy Case
          </p>
          {claim?.alreadyClaimed && (
            <p className="text-sm text-text/60">
              (This badge was already yours.)
            </p>
          )}
          {editionLine && (
            <p className="text-sm text-text/80">{editionLine}</p>
          )}
          {rewardLine && claim?.rewardPaid && (
            <p className="text-sm text-text/80">{rewardLine} — paid ✓</p>
          )}
          <Link
            href={`/achievement/${achievement.id}`}
            className="text-sm underline decoration-white/30 underline-offset-4 hover:decoration-white"
            style={{ color: tier.light }}
          >
            View badge page
          </Link>
          {achievement.tier !== 1 && (
            <button
              onClick={onDone}
              className="mt-2 rounded-lg border border-white/15 px-5 py-2 text-sm text-text/80 hover:border-white/30"
            >
              Continue
            </button>
          )}
        </>
      )}
    </>
  );

  const card = (
    <div
      className={`unlock-card relative flex flex-col items-center gap-3 rounded-2xl border bg-surface p-6 text-center shadow-2xl ${tier.borderClass}`}
      style={{ maxWidth: achievement.tier === 3 ? 420 : 340 }}
    >
      {badgeArt}
      {body}
    </div>
  );

  return (
    <>
      <style>{overlayCss}</style>

      {achievement.tier === 1 && (
        <div className="unlock-toast fixed bottom-4 right-4 z-50">{card}</div>
      )}

      {achievement.tier === 2 && (
        <div className="unlock-dim fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          {card}
        </div>
      )}

      {achievement.tier === 3 && (
        <div className="unlock-dim fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
          {phase !== "error" && <Confetti color={tier.light} />}
          <div className="unlock-burst absolute h-64 w-64 rounded-full"
            style={{ boxShadow: `0 0 120px 40px ${tier.primary}55` }}
          />
          {card}
        </div>
      )}
    </>
  );
}

function Confetti({ color }: { color: string }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        left: `${(i * 41) % 100}%`,
        delay: `${(i % 8) * 0.15}s`,
        duration: `${2 + (i % 5) * 0.4}s`,
        rotate: `${(i * 137) % 360}deg`,
        hue: i % 3,
      })),
    []
  );
  const palette = [color, "#e8e6df", "#7fa8c9"];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="unlock-confetti absolute top-[-5%] block h-2.5 w-1.5 rounded-sm"
          style={{
            left: p.left,
            backgroundColor: palette[p.hue],
            animationDelay: p.delay,
            animationDuration: p.duration,
            transform: `rotate(${p.rotate})`,
          }}
        />
      ))}
    </div>
  );
}

const overlayCss = `
@keyframes unlockSlideIn {
  from { transform: translateX(120%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
@keyframes unlockPop {
  0% { transform: scale(0.6); opacity: 0; }
  70% { transform: scale(1.06); opacity: 1; }
  100% { transform: scale(1); }
}
@keyframes unlockBurst {
  from { transform: scale(0.2); opacity: 1; }
  to { transform: scale(1.6); opacity: 0; }
}
@keyframes unlockShine {
  from { transform: translateX(-150%) skewX(-20deg); }
  to { transform: translateX(250%) skewX(-20deg); }
}
@keyframes unlockFall {
  from { transform: translateY(-5vh) rotate(0deg); opacity: 1; }
  to { transform: translateY(110vh) rotate(540deg); opacity: 0.6; }
}
@keyframes unlockSpin { to { transform: rotate(360deg); } }
.unlock-toast { animation: unlockSlideIn 0.45s cubic-bezier(0.2, 0.9, 0.3, 1); }
.unlock-dim { animation: none; }
.unlock-card { animation: unlockPop 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.2); }
.unlock-burst { animation: unlockBurst 1.1s ease-out forwards; }
.unlock-shine::after {
  content: "";
  position: absolute;
  top: 0; bottom: 0; width: 40%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent);
  animation: unlockShine 1.6s ease-in-out 0.3s;
}
.unlock-confetti { animation-name: unlockFall; animation-timing-function: linear; animation-iteration-count: 1; animation-fill-mode: forwards; }
.unlock-spinner {
  display: inline-block; width: 14px; height: 14px;
  border: 2px solid rgba(0,0,0,0.25); border-top-color: rgba(0,0,0,0.8);
  border-radius: 50%; animation: unlockSpin 0.8s linear infinite;
}
`;
