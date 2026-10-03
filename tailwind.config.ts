import type { Config } from "tailwindcss";

/**
 * Design tokens.
 *
 * Surfaces and motion are defined once here so every component draws from the
 * same small set, instead of each picking its own shadow or easing curve:
 *
 *  - Radius:  controls (buttons, chips, inputs) are pills/`rounded-full` or
 *             `rounded-xl`; cards and panels are `rounded-2xl`.
 *  - Shadow:  `shadow-card` at rest, `shadow-lift` on hover/raised, `shadow-glow`
 *             only on the primary call to action. Navy-tinted, never flat grey.
 *  - Easing:  `ease-premium` for anything entering or responding to the
 *             pointer; `ease-standard` for colour/opacity changes.
 *  - Timing:  150ms micro-feedback, 250ms hover, 600ms reveals. See the motion
 *             system in globals.css for the keyframes that use these.
 */
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
        // Self-hosted via @fontsource-variable (imported in layout.tsx), so it
        // is served from our own origin and satisfies the CSP's font-src 'self'.
        sans: [
          "Plus Jakarta Sans Variable",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgb(17 27 48 / 0.04), 0 1px 3px rgb(17 27 48 / 0.06)",
        lift: "0 18px 40px -12px rgb(17 27 48 / 0.18), 0 6px 12px -6px rgb(17 27 48 / 0.08)",
        glow: "0 10px 30px -10px rgb(192 57 43 / 0.55)",
        "glow-navy": "0 10px 30px -10px rgb(40 69 119 / 0.55)",
      },
      transitionTimingFunction: {
        premium: "cubic-bezier(0.22, 1, 0.36, 1)",
        standard: "cubic-bezier(0.2, 0, 0, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
