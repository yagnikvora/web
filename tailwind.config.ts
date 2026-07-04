import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0a0e14",
        panel: "#121722",
        panel2: "#0e131c",
        border: "#1e2733",
        muted: "#8b98a9",
        bull: "#2ec76a",
        bear: "#e5484d",
        accent: "#4c8dff",
        chip: "#1a2230",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        panel: "0 1px 0 rgba(255,255,255,.03) inset, 0 8px 24px -12px rgba(0,0,0,.6)",
      },
    },
  },
  plugins: [],
};
export default config;
