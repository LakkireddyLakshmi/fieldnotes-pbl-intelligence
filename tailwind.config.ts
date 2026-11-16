import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#101114",
        panel: "#17191e",
        raised: "#202329",
        line: "#2b2e35",
        muted: "#a2a7b0",
        quiet: "#707783",
        gold: {
          DEFAULT: "#e6b75a",
          hover: "#f0cc7e",
          deep: "#47381e",
        },
      },
      boxShadow: {
        panel: "0 16px 42px rgba(0, 0, 0, 0.18)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Manrope", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
