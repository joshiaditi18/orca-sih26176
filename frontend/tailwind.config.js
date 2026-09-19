/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // "Living nautical chart": warm chart paper, marine ink, shallow-water
        // teal, and buoy/signal colours. Everything reads like a drafted sheet.
        paper: {
          50: "#FBF7ED",
          100: "#F5EEDD",
          150: "#EFE6CF",
          200: "#E6DABD",
          300: "#D6C7A2",
          400: "#B9A67C",
        },
        ink: {
          900: "#12212D",
          800: "#1B2F3E",
          700: "#263B4D",
          500: "#42596D",
          400: "#5D7386",
          300: "#82949F",
        },
        chart: {
          700: "#174F68",
          600: "#1E5F7A",
          500: "#2A7391",
          300: "#7FA9BC",
          100: "#D8E7EB",
        },
        signal: "#C7442E",
        risk: {
          low: "#1D7A50",
          moderate: "#A17000",
          high: "#BF4E12",
          extreme: "#AF2318",
        },
      },
      fontFamily: {
        display: [
          '"Fraunces Variable"',
          '"Noto Serif Devanagari Variable"',
          "Georgia",
          "serif",
        ],
        sans: [
          '"Archivo Variable"',
          '"Segoe UI"',
          '"Nirmala UI"',
          "system-ui",
          "sans-serif",
        ],
        mono: ['"Spline Sans Mono Variable"', '"Nirmala UI"', "Consolas", "monospace"],
      },
      // Transform-only entrances, deliberately: an animation that starts at
      // opacity 0 with fill-mode both leaves content INVISIBLE if animations
      // never run (hidden tab, some projectors) — and these carry safety data.
      keyframes: {
        rise: {
          "0%": { transform: "translateY(8px)" },
          "100%": { transform: "translateY(0)" },
        },
        stampIn: {
          "0%": { transform: "scale(1.3) rotate(-5deg)" },
          "60%": { transform: "scale(0.96) rotate(-1.4deg)" },
          "100%": { transform: "scale(1) rotate(-2deg)" },
        },
      },
      animation: {
        rise: "rise .35s ease-out both",
        stampIn: "stampIn .45s cubic-bezier(.2,.9,.3,1.2) both",
      },
    },
  },
  plugins: [],
};
