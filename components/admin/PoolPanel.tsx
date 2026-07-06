"use client";

import { useCallback, useEffect, useState } from "react";
import {
  useAccount,
  usePublicClient,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { formatUnits, parseUnits } from "viem";
import {
  ACHIEVEMENT_BADGE_ADDRESS,
  CLAWD_TOKEN_ADDRESS,
  NATIVE_ETH_SENTINEL,
  achievementBadgeAbi,
  erc20Abi,
} from "@/lib/contracts";
import { truncateAddress } from "@/lib/format";

export function PoolPanel() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash });

  const [ethBalance, setEthBalance] = useState<bigint | null>(null);
  const [clawdBalance, setClawdBalance] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [fundToken, setFundToken] = useState<"eth" | "clawd">("eth");
  const [fundAmount, setFundAmount] = useState("0.01");
  const [withdrawToken, setWithdrawToken] = useState<"eth" | "clawd">("eth");
  const [withdrawAmount, setWithdrawAmount] = useState("0");
  const [withdrawTo, setWithdrawTo] = useState("");

  const loadBalances = useCallback(async () => {
    if (!publicClient) return;
    setLoading(true);
    try {
      const [eth, clawd] = await Promise.all([
        publicClient.getBalance({ address: ACHIEVEMENT_BADGE_ADDRESS }),
        publicClient.readContract({
          address: CLAWD_TOKEN_ADDRESS,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [ACHIEVEMENT_BADGE_ADDRESS],
        }),
      ]);
      setEthBalance(eth);
      setClawdBalance(clawd);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load balances");
    } finally {
      setLoading(false);
    }
  }, [publicClient]);

  useEffect(() => {
    void loadBalances();
  }, [loadBalances, txHash]);

  useEffect(() => {
    if (address && !withdrawTo) setWithdrawTo(address);
  }, [address, withdrawTo]);

  async function fundEth() {
    setError(null);
    setStatus(null);
    const amount = parseUnits(fundAmount, 18);
    try {
      await writeContractAsync({
        address: ACHIEVEMENT_BADGE_ADDRESS,
        abi: achievementBadgeAbi,
        functionName: "fundPool",
        args: [NATIVE_ETH_SENTINEL, amount],
        value: amount,
      });
      setStatus("Funding ETH…");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fund failed");
    }
  }

  async function approveClawd() {
    setError(null);
    setStatus(null);
    const amount = parseUnits(fundAmount, 18);
    try {
      await writeContractAsync({
        address: CLAWD_TOKEN_ADDRESS,
        abi: erc20Abi,
        functionName: "approve",
        args: [ACHIEVEMENT_BADGE_ADDRESS, amount],
      });
      setStatus("Approval submitted. Confirm, then click Fund CLAWD.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve failed");
    }
  }

  async function fundClawd() {
    setError(null);
    setStatus(null);
    const amount = parseUnits(fundAmount, 18);
    try {
      await writeContractAsync({
        address: ACHIEVEMENT_BADGE_ADDRESS,
        abi: achievementBadgeAbi,
        functionName: "fundPool",
        args: [CLAWD_TOKEN_ADDRESS, amount],
      });
      setStatus("Funding CLAWD…");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fund failed");
    }
  }

  async function withdraw() {
    setError(null);
    setStatus(null);
    const token =
      withdrawToken === "eth" ? NATIVE_ETH_SENTINEL : CLAWD_TOKEN_ADDRESS;
    const amount = parseUnits(withdrawAmount, 18);
    const to = (withdrawTo || address) as `0x${string}`;
    if (!to) {
      setError("Enter a withdrawal address");
      return;
    }
    try {
      await writeContractAsync({
        address: ACHIEVEMENT_BADGE_ADDRESS,
        abi: achievementBadgeAbi,
        functionName: "withdrawPool",
        args: [token, amount, to],
      });
      setStatus("Withdrawal submitted…");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Withdraw failed");
    }
  }

  const inputClass =
    "rounded-lg border border-white/10 bg-bg px-3 py-2 text-sm text-text";

  return (
    <div className="space-y-6">
      <h2 className="font-display text-xl">Reward pool</h2>

      {loading ? (
        <p className="text-text/50">Loading balances…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-surface p-4">
            <p className="text-sm text-text/60">ETH balance</p>
            <p className="text-2xl font-medium">
              {ethBalance !== null ? formatUnits(ethBalance, 18) : "—"} ETH
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-surface p-4">
            <p className="text-sm text-text/60">CLAWD balance</p>
            <p className="text-2xl font-medium">
              {clawdBalance !== null ? formatUnits(clawdBalance, 18) : "—"} CLAWD
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-white/10 p-4">
          <h3 className="font-medium">Fund pool</h3>
          <select
            value={fundToken}
            onChange={(e) => setFundToken(e.target.value as "eth" | "clawd")}
            className={inputClass}
          >
            <option value="eth">ETH</option>
            <option value="clawd">CLAWD</option>
          </select>
          <input
            value={fundAmount}
            onChange={(e) => setFundAmount(e.target.value)}
            className={`${inputClass} w-full`}
            placeholder="Amount"
          />
          {fundToken === "eth" ? (
            <button
              type="button"
              disabled={isPending || isConfirming}
              onClick={() => void fundEth()}
              className="rounded-lg bg-legendary px-4 py-2 text-sm text-bg disabled:opacity-50"
            >
              Fund ETH
            </button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isPending || isConfirming}
                onClick={() => void approveClawd()}
                className="rounded-lg border border-white/20 px-4 py-2 text-sm disabled:opacity-50"
              >
                1. Approve CLAWD
              </button>
              <button
                type="button"
                disabled={isPending || isConfirming}
                onClick={() => void fundClawd()}
                className="rounded-lg bg-legendary px-4 py-2 text-sm text-bg disabled:opacity-50"
              >
                2. Fund CLAWD
              </button>
            </div>
          )}
        </div>

        <div className="space-y-3 rounded-xl border border-white/10 p-4">
          <h3 className="font-medium">Withdraw</h3>
          <select
            value={withdrawToken}
            onChange={(e) => setWithdrawToken(e.target.value as "eth" | "clawd")}
            className={`${inputClass} w-full`}
          >
            <option value="eth">ETH</option>
            <option value="clawd">CLAWD</option>
          </select>
          <input
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            className={`${inputClass} w-full`}
            placeholder="Amount"
          />
          <input
            value={withdrawTo}
            onChange={(e) => setWithdrawTo(e.target.value)}
            className={`${inputClass} w-full font-mono text-xs`}
            placeholder="Recipient address"
          />
          <button
            type="button"
            disabled={isPending || isConfirming}
            onClick={() => void withdraw()}
            className="rounded-lg border border-white/20 px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-50"
          >
            Withdraw to {withdrawTo ? truncateAddress(withdrawTo) : "address"}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}
      {status && <p className="text-sm text-green-300">{status}</p>}
    </div>
  );
}
