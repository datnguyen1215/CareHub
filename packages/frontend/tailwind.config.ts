import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{html,js,svelte,ts}"],
  theme: {
    extend: {
      colors: {
        primary: "#4A90D9",
        success: "#5CB85C",
        warning: "#F0AD4E",
        danger: "#D9534F",
        background: "#F5F5F5",
        surface: "#FFFFFF",
        "text-primary": "#333333",
        "text-secondary": "#666666",
      },
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      spacing: {
        // 8px base unit — Tailwind's default spacing scale uses 4px,
        // so we add named aliases for the 8px system used in the design.
        "unit-1": "8px",
        "unit-2": "16px",
        "unit-3": "24px",
        "unit-4": "32px",
      },
      borderRadius: {
        card: "8px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.12)",
      },
      fontSize: {
        base: ["1rem", { lineHeight: "1.5" }],
        sm: ["0.875rem", { lineHeight: "1.4" }],
        h3: ["1.25rem", { lineHeight: "1.3" }],
        h2: ["1.5rem", { lineHeight: "1.3" }],
        h1: ["1.75rem", { lineHeight: "1.2" }],
      },
    },
  },
  plugins: [],
} satisfies Config;
