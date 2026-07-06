export type TierId = 1 | 2 | 3;

export const TIER_CONFIG: Record<
  TierId,
  {
    name: string;
    primary: string;
    light: string;
    glowClass: string;
    borderClass: string;
    bgClass: string;
  }
> = {
  1: {
    name: "Common",
    primary: "#b0713b",
    light: "#d99a5b",
    glowClass: "",
    borderClass: "border-common/40",
    bgClass: "bg-common/10",
  },
  2: {
    name: "Rare",
    primary: "#7fa8c9",
    light: "#b9d4ea",
    glowClass: "",
    borderClass: "border-rare/40",
    bgClass: "bg-rare/10",
  },
  3: {
    name: "Legendary",
    primary: "#d4a017",
    light: "#ffd75e",
    glowClass: "shadow-legendary animate-legendaryShine",
    borderClass: "border-legendary/50",
    bgClass: "bg-legendary/10",
  },
};

export function getTierConfig(tier: number) {
  const id = (tier >= 1 && tier <= 3 ? tier : 1) as TierId;
  return TIER_CONFIG[id];
}

export function getTierName(tier: number): string {
  return getTierConfig(tier).name;
}
