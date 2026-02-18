import type { Config } from "tailwindcss";

export default {
  content: [""],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#FFFFFF",
        surface: "#F7F7F7",
        "surface-elevated": "#FFFFFF",
        "text-primary": "#1A1A1A",
        "text-secondary": "#6B6B6B",
        "text-tertiary": "#A3A3A3",
        border: "#EBEBEB",
        accent: "#1A1A1A",
        "accent-highlight": "#E8C4B8",
        "accent-highlight-soft": "#F5EBE7",
        success: "#4CAF82",
        warning: "#E5A940",
        error: "#D45555",
      },
    },
  },
  plugins: [],
} satisfies Config;
