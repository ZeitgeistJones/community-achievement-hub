import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0d0f14",
        surface: "#161a22",
        text: "#e8e6df",
        common: {
          DEFAULT: "#b0713b",
          light: "#d99a5b",
        },
        rare: {
          DEFAULT: "#7fa8c9",
          light: "#b9d4ea",
        },
        legendary: {
          DEFAULT: "#d4a017",
          light: "#ffd75e",
        },
        hidden: "#1a1a1f",
      },
      fontFamily: {
        display: ["var(--font-bungee)", "system-ui", "sans-serif"],
        body: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        legendary: "0 0 24px rgba(255, 215, 94, 0.35)",
      },
      keyframes: {
        legendaryShine: {
          "0%, 100%": { boxShadow: "0 0 24px rgba(255, 215, 94, 0.25)" },
          "50%": { boxShadow: "0 0 32px rgba(255, 215, 94, 0.45)" },
        },
      },
      animation: {
        legendaryShine: "legendaryShine 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
