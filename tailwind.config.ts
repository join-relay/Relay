import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        /* Relay brand - horizontal logo derived */
        relay: {
          bg: "#DFE8F1",
          "primary-dark": "#1B2E3B",
          "secondary-dark": "#213443",
          "deep-slate": "#314555",
          "muted-steel": "#3F5363",
          "soft-accent": "#61707D",
        },
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
      },
      borderRadius: {
        "relay-card": "10px",
        "relay-inner": "8px",
        "relay-control": "6px",
      },
      boxShadow: {
        "relay-soft": "0 1px 4px rgba(27, 46, 59, 0.06)",
        "relay-elevated": "0 2px 10px rgba(27, 46, 59, 0.07)",
      },
    },
  },
  plugins: [],
}
export default config
