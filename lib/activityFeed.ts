import { formatUnits, parseAbiItem, type PublicClient } from "viem";
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

/** Alchemy free tier allows 10 blocks per eth_getLogs request. */
const LOG_CHUNK_SIZE = BigInt(process.env.ACTIVITY_LOG_CHUNK_SIZE ?? "10");
const MAX_SCAN_BLOCKS = BigInt(process.env.ACTIVITY_FEED_BLOCK_RANGE ?? "2000");
const MAX_EVENTS = 100;
const CHUNK_CONCURRENCY = 5;

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

function blockRanges(
  fromBlock: bigint,
  toBlock: bigint,
  chunkSize: bigint
): { fromBlock: bigint; toBlock: bigint }[] {
  const ranges: { fromBlock: bigint; toBlock: bigint }[] = [];
  for (let start = fromBlock; start <= toBlock; start += chunkSize) {
    const end =
      start + chunkSize - 1n > toBlock ? toBlock : start + chunkSize - 1n;
    ranges.push({ fromBlock: start, toBlock: end });
  }
  return ranges;
}

async function fetchClaimedLogs(
  publicClient: PublicClient,
  from: bigint,
  to: bigint
) {
  return publicClient.getLogs({
    address: ACHIEVEMENT_BADGE_ADDRESS,
    event: claimedEvent,
    fromBlock: from,
    toBlock: to,
  });
}

async function fetchPaidLogs(
  publicClient: PublicClient,
  from: bigint,
  to: bigint
) {
  return publicClient.getLogs({
    address: ACHIEVEMENT_BADGE_ADDRESS,
    event: paidEvent,
    fromBlock: from,
    toBlock: to,
  });
}

async function fetchShortfallLogs(
  publicClient: PublicClient,
  from: bigint,
  to: bigint
) {
  return publicClient.getLogs({
    address: ACHIEVEMENT_BADGE_ADDRESS,
    event: shortfallEvent,
    fromBlock: from,
    toBlock: to,
  });
}

type ClaimedLogs = Awaited<ReturnType<typeof fetchClaimedLogs>>;
type PaidLogs = Awaited<ReturnType<typeof fetchPaidLogs>>;
type ShortfallLogs = Awaited<ReturnType<typeof fetchShortfallLogs>>;

async function getLogsInChunks(
  publicClient: PublicClient,
  fromBlock: bigint,
  toBlock: bigint,
  maxLogs: number
) {
  const ranges = blockRanges(fromBlock, toBlock, LOG_CHUNK_SIZE).reverse();
  const claimed: ClaimedLogs = [];
  const paid: PaidLogs = [];
  const shortfall: ShortfallLogs = [];

  for (let i = 0; i < ranges.length; i += CHUNK_CONCURRENCY) {
    const batch = ranges.slice(i, i + CHUNK_CONCURRENCY);

    for (const { fromBlock: from, toBlock: to } of batch) {
      const [chunkClaimed, chunkPaid, chunkShortfall] = await Promise.all([
        fetchClaimedLogs(publicClient, from, to),
        fetchPaidLogs(publicClient, from, to),
        fetchShortfallLogs(publicClient, from, to),
      ]);

      claimed.push(...chunkClaimed);
      paid.push(...chunkPaid);
      shortfall.push(...chunkShortfall);
    }

    if (claimed.length + paid.length + shortfall.length >= maxLogs) {
      break;
    }
  }

  return { claimed, paid, shortfall };
}

export function getActivityFeedScanBlocks(): bigint {
  return MAX_SCAN_BLOCKS;
}

export async function getActivityFeed(): Promise<ActivityFeedItem[]> {
  const publicClient = getPublicClient();
  const latest = await publicClient.getBlockNumber();
  const fromBlock =
    latest > MAX_SCAN_BLOCKS ? latest - MAX_SCAN_BLOCKS : 0n;

  const { claimed, paid, shortfall } = await getLogsInChunks(
    publicClient,
    fromBlock,
    latest,
    MAX_EVENTS
  );

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
