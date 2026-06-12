import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./contexts/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#1D9E75",
          hover: "#19876A",
          50:  "#e6f7f2",
          100: "#b3e8d5",
          200: "#80d9b8",
          300: "#4dcb9b",
          400: "#26bd84",
          500: "#1D9E75",
          600: "#178060",
          700: "#11604a",
          800: "#0b4033",
          900: "#05201a",
        },
        // Surface layers
        surface: {
          base: "#080D19",
          1:    "#0F172A",
          2:    "#111827",
          3:    "#131B2C",
          nav:  "#0B1120",
        },
        // Session type colors
        session: {
          strength: "#60A5FA",
          hiit:     "#FB7185",
          cardio:   "#FBBF24",
          circuit:  "#FACC15",
        },
        // Semantic states
        status: {
          error:   "#EF4444",
          warning: "#F59E0B",
          success: "#1D9E75",
          info:    "#60A5FA",
        },
        // Keep slate for any legacy usage
        slate: {
          850: "#1a2234",
        },
      },
      borderRadius: {
        card:       "14px",
        "card-lg":  "16px",
        "card-xl":  "20px",
        "card-sm":  "10px",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
      fontSize: {
        "2xs": ["10px", { lineHeight: "1.4", fontWeight: "600" }],
      },
      boxShadow: {
        "glow-sm":   "0 0 12px rgba(29,158,117,0.25)",
        "glow-md":   "0 0 24px rgba(29,158,117,0.30)",
        "card":      "0 1px 3px rgba(0,0,0,0.40), 0 1px 2px rgba(0,0,0,0.24)",
        "card-lg":   "0 4px 12px rgba(0,0,0,0.50)",
      },
      keyframes: {
        "pulse-dot": {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.35" },
        },
        "fade-up": {
          "0%":   { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          "0%":   { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
      },
      animation: {
        "pulse-dot": "pulse-dot 2s ease-in-out infinite",
        "fade-up":   "fade-up 200ms ease-out",
        "slide-up":  "slide-up 250ms ease-out",
        shimmer:     "shimmer 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
