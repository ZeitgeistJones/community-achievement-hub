import { formatUnits } from "viem";
import {
  CLAWD_TOKEN_ADDRESS,
  NATIVE_ETH_SENTINEL,
  ZERO_ADDRESS,
} from "./contracts";

export function truncateAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function formatRewardLine(
  rewardToken: string,
  rewardAmount: bigint
): string | null {
  if (rewardAmount === 0n) return null;
  const amount = formatUnits(rewardAmount, 18);
  const normalized = rewardToken.toLowerCase();
  if (normalized === ZERO_ADDRESS.toLowerCase()) return null;
  if (normalized === CLAWD_TOKEN_ADDRESS.toLowerCase()) {
    return `Comes with ${amount} CLAWD`;
  }
  if (normalized === NATIVE_ETH_SENTINEL.toLowerCase()) {
    return `Comes with ${amount} ETH`;
  }
  return `Comes with ${amount} tokens`;
}

export function formatTokenAmount(amount: bigint): string {
  return formatUnits(amount, 18);
}
