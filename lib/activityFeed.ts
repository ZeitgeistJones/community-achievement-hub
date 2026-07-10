import { formatUnits, parseAbiItem } from "viem";
import { getPublicClient } from "./clients";
import {
  ACHIEVEMENT_BADGE_ADDRESS,
  CLAWD_TOKEN_ADDRESS,
  NATIVE_ETH_SENTINEL,
} from "./contracts";

export type ActivityFeedItem = {
  kind: "claimed" | "paid" | "shortfall";
  blockNumber: string;
  transactionHash: string;
  recipient: string;
  achievementId: string;
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

function tokenSymbol(token: string): string {
  const normalized = token.toLowerCase();
  if (normalized === CLAWD_TOKEN_ADDRESS.toLowerCase()) return "CLAWD";
  if (normalized === NATIVE_ETH_SENTINEL.toLowerCase()) return "ETH";
  return "tokens";
}

export async function getActivityFeed(): Promise<ActivityFeedItem[]> {
  const publicClient = getPublicClient();
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

  const feed: ActivityFeedItem[] = [];

  for (const log of claimed) {
    feed.push({
      kind: "claimed",
      blockNumber: (log.blockNumber ?? 0n).toString(),
      transactionHash: log.transactionHash!,
      recipient: log.args.recipient!,
      achievementId: log.args.achievementId!.toString(),
      detail: `Edition #${log.args.edition!.toString()}`,
    });
  }

  for (const log of paid) {
    const token = log.args.token!;
    feed.push({
      kind: "paid",
      blockNumber: (log.blockNumber ?? 0n).toString(),
      transactionHash: log.transactionHash!,
      recipient: log.args.recipient!,
      achievementId: log.args.achievementId!.toString(),
      detail: `Paid ${formatUnits(log.args.amount!, 18)} ${tokenSymbol(token)}`,
    });
  }

  for (const log of shortfall) {
    const token = log.args.token!;
    feed.push({
      kind: "shortfall",
      blockNumber: (log.blockNumber ?? 0n).toString(),
      transactionHash: log.transactionHash!,
      recipient: log.args.recipient!,
      achievementId: log.args.achievementId!.toString(),
      detail: `Pool ran dry — owed ${formatUnits(log.args.amount!, 18)} ${tokenSymbol(token)}`,
    });
  }

  feed.sort((a, b) => {
    const blockA = BigInt(a.blockNumber);
    const blockB = BigInt(b.blockNumber);
    if (blockA === blockB) return 0;
    return blockA > blockB ? -1 : 1;
  });

  return feed.slice(0, MAX_EVENTS);
}
