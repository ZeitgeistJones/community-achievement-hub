// SERVER-ONLY MODULE. Never import this from a client component.
// Holds the voucher signing + relayed claim submission logic.
// Ports INTEGRATION.md §3–4 exactly. Both private keys stay in env vars and
// must never appear in logs, responses, or client bundles.

import {
  BaseError,
  ContractFunctionRevertedError,
  createWalletClient,
  getAddress,
  http,
  keccak256,
  parseEventLogs,
  toBytes,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  ACHIEVEMENT_BADGE_ADDRESS,
  base,
} from "./contracts";
import { getPublicClient } from "./clients";
import {
  ALREADY_CLAIMED_ERRORS,
  CLAIM_ERROR_MESSAGES,
  claimAbi,
} from "./claimAbi";

export type Voucher = {
  recipient: `0x${string}`;
  achievementId: bigint;
  eventHash: `0x${string}`;
  deadline: bigint;
};

export type ClaimResult =
  | {
      ok: true;
      alreadyClaimed?: boolean;
      txHash?: `0x${string}`;
      tokenId?: string;
      edition?: string;
      rewardPaid?: boolean;
    }
  | {
      ok: false;
      /** Plain-English, safe to show to a user. */
      error: string;
      /** true when this is an expected contract rejection (HTTP 400), not a server fault. */
      expected: boolean;
    };

// EIP-712 domain — must match the contract's EIP712("AchievementBadge", "1") exactly.
const DOMAIN = {
  name: "AchievementBadge",
  version: "1",
  chainId: 8453,
  verifyingContract: ACHIEVEMENT_BADGE_ADDRESS,
} as const;

const TYPES = {
  Voucher: [
    { name: "recipient", type: "address" },
    { name: "achievementId", type: "uint256" },
    { name: "eventHash", type: "bytes32" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

const VOUCHER_TTL_SECONDS = 600; // 10 minutes; the backend claims immediately.

function getSignerAccount() {
  const key = process.env.VOUCHER_SIGNER_PRIVATE_KEY;
  if (!key) throw new Error("VOUCHER_SIGNER_PRIVATE_KEY is not configured");
  return privateKeyToAccount(key as `0x${string}`);
}

function getRelayerAccount() {
  const key = process.env.RELAYER_PRIVATE_KEY;
  if (!key) throw new Error("RELAYER_PRIVATE_KEY is not configured");
  return privateKeyToAccount(key as `0x${string}`);
}

/**
 * Deterministic, globally-unique event hash: `${appId}:${key}:${wallet}` with
 * the wallet lowercased. Idempotent by construction — the same (app, key,
 * wallet) always produces the same hash, so a duplicate claim attempt reverts
 * harmlessly with EventHashAlreadyConsumed instead of double-minting.
 */
export function buildEventHash(
  appId: string,
  key: string,
  wallet: string
): `0x${string}` {
  return keccak256(toBytes(`${appId}:${key}:${wallet.toLowerCase()}`));
}

export function buildVoucher(
  recipient: string,
  achievementId: number,
  eventHash: `0x${string}`
): Voucher {
  return {
    recipient: getAddress(recipient),
    achievementId: BigInt(achievementId),
    eventHash,
    deadline: BigInt(Math.floor(Date.now() / 1000) + VOUCHER_TTL_SECONDS),
  };
}

export async function signVoucher(voucher: Voucher): Promise<`0x${string}`> {
  const signer = getSignerAccount();
  return signer.signTypedData({
    domain: DOMAIN,
    types: TYPES,
    primaryType: "Voucher",
    message: voucher,
  });
}

/**
 * Simulates first (so reverts are decoded and cost the relayer nothing), then
 * submits via the relayer wallet and waits for the receipt. Returns a fully
 * plain-English result — raw RPC errors never leave this function.
 */
export async function submitClaim(
  voucher: Voucher,
  signature: `0x${string}`
): Promise<ClaimResult> {
  const publicClient = getPublicClient();
  const relayer = getRelayerAccount();

  let request;
  try {
    const sim = await publicClient.simulateContract({
      account: relayer,
      address: ACHIEVEMENT_BADGE_ADDRESS,
      abi: claimAbi,
      functionName: "claimAchievement",
      args: [voucher, signature],
    });
    request = sim.request;
  } catch (e) {
    return decodeClaimError(e);
  }

  const walletClient = createWalletClient({
    account: relayer,
    chain: base,
    transport: http(process.env.ALCHEMY_RPC_URL),
  });

  try {
    const txHash = await walletClient.writeContract(request);
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    const claimed = parseEventLogs({
      abi: claimAbi,
      logs: receipt.logs,
      eventName: "AchievementClaimed",
    });
    const rewardPaidLogs = parseEventLogs({
      abi: claimAbi,
      logs: receipt.logs,
      eventName: "RewardPaid",
    });

    const claimLog = claimed[0];
    return {
      ok: true,
      txHash,
      tokenId: claimLog ? claimLog.args.tokenId.toString() : undefined,
      edition: claimLog ? claimLog.args.edition.toString() : undefined,
      rewardPaid: rewardPaidLogs.length > 0,
    };
  } catch (e) {
    return decodeClaimError(e);
  }
}

function decodeClaimError(e: unknown): ClaimResult {
  if (e instanceof BaseError) {
    const reverted = e.walk(
      (err) => err instanceof ContractFunctionRevertedError
    );
    if (reverted instanceof ContractFunctionRevertedError) {
      const name = reverted.data?.errorName;
      if (name && ALREADY_CLAIMED_ERRORS.has(name)) {
        return { ok: true, alreadyClaimed: true };
      }
      if (name && CLAIM_ERROR_MESSAGES[name]) {
        return { ok: false, error: CLAIM_ERROR_MESSAGES[name], expected: true };
      }
    }
    // Common infrastructure failures, phrased safely.
    if (/insufficient funds/i.test(e.message)) {
      return {
        ok: false,
        error:
          "The claim service is temporarily out of gas. Please try again a little later.",
        expected: false,
      };
    }
  }
  return {
    ok: false,
    error: "Something went wrong submitting the claim. Please try again.",
    expected: false,
  };
}
