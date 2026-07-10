// ABI surface needed for claiming, kept separate from lib/contracts.ts so the
// existing file stays untouched. Includes the custom errors so viem can decode
// reverts into readable names.

export const claimAbi = [
  {
    type: "function",
    name: "claimAchievement",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "voucher",
        type: "tuple",
        components: [
          { name: "recipient", type: "address" },
          { name: "achievementId", type: "uint256" },
          { name: "eventHash", type: "bytes32" },
          { name: "deadline", type: "uint256" },
        ],
      },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  { type: "error", name: "VoucherExpired", inputs: [] },
  { type: "error", name: "EventHashAlreadyConsumed", inputs: [] },
  { type: "error", name: "InvalidVoucherSignature", inputs: [] },
  { type: "error", name: "AchievementNotActive", inputs: [] },
  { type: "error", name: "AlreadyClaimed", inputs: [] },
  {
    type: "error",
    name: "PrerequisiteNotMet",
    inputs: [{ name: "prereqId", type: "uint256" }],
  },
  { type: "error", name: "SupplyCapExceeded", inputs: [] },
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
] as const;

/** Plain-English messages for every custom error the claim can revert with. */
export const CLAIM_ERROR_MESSAGES: Record<string, string> = {
  VoucherExpired: "This claim expired before it reached the chain — please try again.",
  EventHashAlreadyConsumed: "This badge was already claimed.",
  InvalidVoucherSignature:
    "The claim signature was rejected on-chain. (Signer mismatch — the VOUCHER_SIGNER_PRIVATE_KEY in Vercel must match the voucherSigner set on the badge contract.)",
  AchievementNotActive: "This achievement is no longer claimable.",
  AlreadyClaimed: "This badge was already claimed.",
  PrerequisiteNotMet: "A prerequisite badge hasn't been earned yet.",
  SupplyCapExceeded: "All editions of this badge have been claimed.",
};

/** Errors that mean "the badge is effectively already theirs / nothing to do". */
export const ALREADY_CLAIMED_ERRORS = new Set([
  "AlreadyClaimed",
  "EventHashAlreadyConsumed",
]);
