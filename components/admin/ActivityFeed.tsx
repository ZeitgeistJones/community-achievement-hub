"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { formatUnits, parseAbiItem } from "viem";
import {
  ACHIEVEMENT_BADGE_ADDRESS,
  CLAWD_TOKEN_ADDRESS,
  NATIVE_ETH_SENTINEL,
} from "@/lib/contracts";
import { truncateAddress } from "@/lib/format";

type FeedItem = {
  kind: "claimed" | "paid" | "shortfall";
  blockNumber: bigint;
  transactionHash: `0x${string}`;
  recipient: string;
  achievementId: bigint;
  detail: string;
};

const BLOCK_RANGE = 50_000n;
const MAX_EVENTS = 100;

const claimedEvent = parseAbiItem(
  "event AchievementClaimed(address indexed recipient, uint256 indexed achievementId, uint256 indexed tokenId, uint256 edition, bytes32 eventHash)"
);
const paidEvent = parseAbiItem(
  "event RewardPaid(address indexed recipient, uint256 indexed achievementId, address token, uint256 amount)"
);
const shortfallEvent = parseAbiItem(
  "event RewardShortfall(address indexed recipient, uint256 indexed achievementId, address token, uint256 amount)"
);

export function ActivityFeed() {
  const publicClient = usePublicClient();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!publicClient) return;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const latest = await publicClient.getBlockNumber();
        const fromBlock = latest > BLOCK_RANGE ? latest - BLOCK_RANGE : 0n;

        const [claimed, paid, shortfall] = await Promise.all([
          publicClient.getLogs({
            address: ACHIEVEMENT_BADGE_ADDRESS,
            event: claimedEvent,
            fromBlock,
            toBlock: latest,
          }),
          publicClient.getLogs({
            address: ACHIEVEMENT_BADGE_ADDRESS,
            event: paidEvent,
            fromBlock,
            toBlock: latest,
          }),
          publicClient.getLogs({
            address: ACHIEVEMENT_BADGE_ADDRESS,
            event: shortfallEvent,
            fromBlock,
            toBlock: latest,
          }),
        ]);

        const feed: FeedItem[] = [];

        for (const log of claimed) {
          feed.push({
            kind: "claimed",
            blockNumber: log.blockNumber ?? 0n,
            transactionHash: log.transactionHash!,
            recipient: log.args.recipient!,
            achievementId: log.args.achievementId!,
            detail: `Edition #${log.args.edition!.toString()}`,
          });
        }

        for (const log of paid) {
          const token = log.args.token!;
          const symbol =
            token.toLowerCase() === CLAWD_TOKEN_ADDRESS.toLowerCase()
              ? "CLAWD"
              : token.toLowerCase() === NATIVE_ETH_SENTINEL.toLowerCase()
                ? "ETH"
                : "tokens";
          feed.push({
            kind: "paid",
            blockNumber: log.blockNumber ?? 0n,
            transactionHash: log.transactionHash!,
            recipient: log.args.recipient!,
            achievementId: log.args.achievementId!,
            detail: `Paid ${formatUnits(log.args.amount!, 18)} ${symbol}`,
          });
        }

        for (const log of shortfall) {
          const token = log.args.token!;
          const symbol =
            token.toLowerCase() === CLAWD_TOKEN_ADDRESS.toLowerCase()
              ? "CLAWD"
              : token.toLowerCase() === NATIVE_ETH_SENTINEL.toLowerCase()
                ? "ETH"
                : "tokens";
          feed.push({
            kind: "shortfall",
            blockNumber: log.blockNumber ?? 0n,
            transactionHash: log.transactionHash!,
            recipient: log.args.recipient!,
            achievementId: log.args.achievementId!,
            detail: `Pool ran dry — owed ${formatUnits(log.args.amount!, 18)} ${symbol}`,
          });
        }

        feed.sort((a, b) => {
          if (a.blockNumber === b.blockNumber) return 0;
          return a.blockNumber > b.blockNumber ? -1 : 1;
        });

        setItems(feed.slice(0, MAX_EVENTS));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load activity");
      } finally {
        setLoading(false);
      }
    })();
  }, [publicClient]);

  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl">Activity feed</h2>
      <p className="text-sm text-text/50">Last ~50,000 blocks on Base</p>

      {loading && <p className="text-text/50">Loading events…</p>}
      {error && <p className="text-sm text-red-300">{error}</p>}

      {!loading && items.length === 0 && (
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
                Block {item.blockNumber.toString()}
              </span>
            </div>
            <p className="mt-1 text-text/70">
              Achievement #{item.achievementId.toString()} ·{" "}
              {truncateAddress(item.recipient)} · {item.detail}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
