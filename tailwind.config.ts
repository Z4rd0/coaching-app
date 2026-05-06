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
          50: "#e6f7f2",
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
        slate: {
          850: "#1a2234",
        },
      },
    },
  },
  plugins: [],
};
export default config;
