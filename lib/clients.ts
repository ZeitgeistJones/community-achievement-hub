import { createPublicClient, http } from "viem";
import { base } from "./contracts";

export function getPublicClient() {
  const url = process.env.ALCHEMY_RPC_URL;
  if (!url) {
    throw new Error("ALCHEMY_RPC_URL is not configured");
  }
  return createPublicClient({
    chain: base,
    transport: http(url),
  });
}
