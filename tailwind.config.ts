import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        pixel: ["var(--font-pixel)", "Courier New", "monospace"],
      },
      colors: {
        pixel: {
          bg: "#f1f5f9",
          panel: "#ffffff",
          "panel-dark": "#0f172a",
          border: "#334155",
          face: "#fef3c7",
          hp: "#059669",
          stress: "#b91c1c",
          highlight: "#0d9488",
        },
      },
      boxShadow: {
        pixel: "0 4px 6px -1px var(--pixel-shadow), 0 2px 4px -2px var(--pixel-shadow)",
        "pixel-inner": "inset 0 1px 2px 0 var(--pixel-shadow)",
      },
    },
  },
  plugins: [],
};
export default config;
