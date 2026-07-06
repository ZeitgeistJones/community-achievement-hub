import { defineChain } from "viem";

export const CHAIN_ID = 8453;

export const base = defineChain({
  id: CHAIN_ID,
  name: "Base",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://mainnet.base.org"] },
  },
  blockExplorers: {
    default: { name: "Basescan", url: "https://basescan.org" },
  },
});

export const ACHIEVEMENT_REGISTRY_ADDRESS =
  "0xE6731a953268EC0bDc73dF01C7d73Dd09C28207C" as const;

export const ACHIEVEMENT_BADGE_ADDRESS =
  "0x79350955160a24bE0FA18243Af6FA5F53CBEcCCa" as const;

export const OWNER_ADDRESS =
  "0xf2c44aF68aE2a983d1331b2D3aEF3c516Ae4a0Fc" as const;

export const CLAWD_TOKEN_ADDRESS =
  "0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07" as const;

export const NATIVE_ETH_SENTINEL =
  "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" as const;

export const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000" as const;

export const achievementRegistryAbi = [
  {
    type: "function",
    name: "createAchievement",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "def",
        type: "tuple",
        components: [
          { name: "appId", type: "string" },
          { name: "key", type: "string" },
          { name: "name", type: "string" },
          { name: "description", type: "string" },
          { name: "tier", type: "uint8" },
          { name: "imageURI", type: "string" },
          { name: "maxSupply", type: "uint256" },
          { name: "capLocked", type: "bool" },
          { name: "rewardToken", type: "address" },
          { name: "rewardAmount", type: "uint256" },
          { name: "prerequisites", type: "uint256[]" },
          { name: "hidden", type: "bool" },
          { name: "active", type: "bool" },
        ],
      },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "function",
    name: "editAchievement",
    stateMutability: "nonpayable",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "name", type: "string" },
      { name: "description", type: "string" },
      { name: "tier", type: "uint8" },
      { name: "imageURI", type: "string" },
      { name: "rewardToken", type: "address" },
      { name: "rewardAmount", type: "uint256" },
      { name: "prerequisites", type: "uint256[]" },
      { name: "hidden", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setMaxSupply",
    stateMutability: "nonpayable",
    inputs: [
      { name: "id", type: "uint256" },
      { name: "newMaxSupply", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "lockSupplyCap",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "deactivateAchievement",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "activateAchievement",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getAchievement",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "appId", type: "string" },
          { name: "key", type: "string" },
          { name: "name", type: "string" },
          { name: "description", type: "string" },
          { name: "tier", type: "uint8" },
          { name: "imageURI", type: "string" },
          { name: "maxSupply", type: "uint256" },
          { name: "capLocked", type: "bool" },
          { name: "rewardToken", type: "address" },
          { name: "rewardAmount", type: "uint256" },
          { name: "prerequisites", type: "uint256[]" },
          { name: "hidden", type: "bool" },
          { name: "active", type: "bool" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "exists",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "totalAchievements",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getPrerequisites",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    type: "event",
    name: "AchievementActiveStatusChanged",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "active", type: "bool", indexed: false },
    ],
  },
  {
    type: "event",
    name: "AchievementCapLocked",
    inputs: [{ name: "id", type: "uint256", indexed: true }],
  },
  {
    type: "event",
    name: "AchievementCreated",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "appId", type: "string", indexed: false },
      { name: "key", type: "string", indexed: false },
      { name: "name", type: "string", indexed: false },
      { name: "tier", type: "uint8", indexed: false },
      { name: "maxSupply", type: "uint256", indexed: false },
      { name: "capLocked", type: "bool", indexed: false },
      { name: "rewardToken", type: "address", indexed: false },
      { name: "rewardAmount", type: "uint256", indexed: false },
      { name: "prerequisites", type: "uint256[]", indexed: false },
    ],
  },
  {
    type: "event",
    name: "AchievementEdited",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "name", type: "string", indexed: false },
      { name: "description", type: "string", indexed: false },
      { name: "tier", type: "uint8", indexed: false },
      { name: "imageURI", type: "string", indexed: false },
      { name: "rewardToken", type: "address", indexed: false },
      { name: "rewardAmount", type: "uint256", indexed: false },
      { name: "prerequisites", type: "uint256[]", indexed: false },
      { name: "hidden", type: "bool", indexed: false },
    ],
  },
  {
    type: "event",
    name: "AchievementSupplyUpdated",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "newMaxSupply", type: "uint256", indexed: false },
    ],
  },
] as const;

export const achievementBadgeAbi = [
  {
    type: "function",
    name: "achievementsOfWallet",
    stateMutability: "view",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "holdersOfAchievement",
    stateMutability: "view",
    inputs: [{ name: "achievementId", type: "uint256" }],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    type: "function",
    name: "tokenMeta",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "achievementId", type: "uint256" },
          { name: "edition", type: "uint256" },
          { name: "earnedAt", type: "uint256" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "remainingSupply",
    stateMutability: "view",
    inputs: [{ name: "achievementId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "perAppBadgeCount",
    stateMutability: "view",
    inputs: [
      { name: "wallet", type: "address" },
      { name: "appId", type: "string" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "claimCount",
    stateMutability: "view",
    inputs: [{ name: "achievementId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "hasClaimed",
    stateMutability: "view",
    inputs: [
      { name: "achievementId", type: "uint256" },
      { name: "wallet", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "fundPool",
    stateMutability: "payable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "withdrawPool",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "to", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "revokeBadge",
    stateMutability: "nonpayable",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "setVoucherSigner",
    stateMutability: "nonpayable",
    inputs: [{ name: "newSigner", type: "address" }],
    outputs: [],
  },
  {
    type: "event",
    name: "AchievementClaimed",
    inputs: [
      { name: "recipient", type: "address", indexed: true },
      { name: "achievementId", type: "uint256", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "edition", type: "uint256", indexed: false },
      { name: "eventHash", type: "bytes32", indexed: false },
    ],
  },
  {
    type: "event",
    name: "RewardPaid",
    inputs: [
      { name: "recipient", type: "address", indexed: true },
      { name: "achievementId", type: "uint256", indexed: true },
      { name: "token", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "RewardShortfall",
    inputs: [
      { name: "recipient", type: "address", indexed: true },
      { name: "achievementId", type: "uint256", indexed: true },
      { name: "token", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PoolFunded",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "from", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "PoolWithdrawn",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "to", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "BadgeRevoked",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "holder", type: "address", indexed: true },
      { name: "achievementId", type: "uint256", indexed: true },
    ],
  },
] as const;

export const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
