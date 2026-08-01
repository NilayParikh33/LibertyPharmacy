import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Liberty brand — deep navy primary with a warm red accent.
        navy: {
          50: "#f0f4fa",
          100: "#dce5f3",
          200: "#c0d0e8",
          300: "#95b1d8",
          400: "#638bc4",
          500: "#406dae",
          600: "#2f5592",
          700: "#284577",
          800: "#253c63",
          900: "#1b2a47",
          950: "#111b30",
        },
        liberty: {
          red: "#c0392b",
          redDark: "#a93226",
          gold: "#d4a848",
        },
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
