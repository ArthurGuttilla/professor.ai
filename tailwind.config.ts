import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Temas institucionais sobrescrevem estas CSS vars (M4/M10).
        brand: {
          DEFAULT: "var(--brand, #2563eb)",
          fg: "var(--brand-fg, #ffffff)",
        },
      },
    },
  },
  plugins: [],
};

export default config;
