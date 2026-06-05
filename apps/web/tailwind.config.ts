import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "Inter", "system-ui", "sans-serif"],
      },
      colors: {
        background: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-hover": "rgb(var(--surface-hover) / <alpha-value>)",
        elevated: "rgb(var(--elevated) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        "border-medium": "rgb(var(--border-medium) / <alpha-value>)",
        text: "rgb(var(--text) / <alpha-value>)",
        "text-medium": "rgb(var(--text-medium) / <alpha-value>)",
        "text-light": "rgb(var(--text-light) / <alpha-value>)",
        "accent-blue": "rgb(var(--accent-blue) / <alpha-value>)",
        "accent-blue-bg": "rgb(var(--accent-blue-bg) / <alpha-value>)",
        "success-green": "rgb(var(--success-green) / <alpha-value>)",
        "success-green-bg": "rgb(var(--success-green-bg) / <alpha-value>)",
        purple: "rgb(var(--purple) / <alpha-value>)",
        "purple-bg": "rgb(var(--purple-bg) / <alpha-value>)",
        amber: "rgb(var(--amber) / <alpha-value>)",
        "amber-bg": "rgb(var(--amber-bg) / <alpha-value>)",
      },
      borderRadius: {
        DEFAULT: "6px",
      },
      fontSize: {
        xs: ["11px", { lineHeight: "16px" }],
        sm: ["12px", { lineHeight: "18px" }],
        base: ["14px", { lineHeight: "20px" }],
        md: ["14px", { lineHeight: "20px" }],
        lg: ["16px", { lineHeight: "24px" }],
        xl: ["18px", { lineHeight: "28px" }],
        "2xl": ["20px", { lineHeight: "28px" }],
      },
    },
  },
  plugins: [],
};

export default config;
