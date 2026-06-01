import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        background: "#ffffff",
        surface: "#f7f7f5",
        "surface-hover": "#f1f1ef",
        border: "#e9e9e7",
        "border-medium": "#d3d3d0",
        text: "#1a1a19",
        "text-medium": "#5a5a58",
        "text-light": "#9b9b98",
        "accent-blue": "#2383e2",
        "accent-blue-bg": "#edf3fc",
        "success-green": "#0f7b6c",
        "success-green-bg": "#edf9f6",
        purple: "#6940a5",
        "purple-bg": "#f4f0fb",
        amber: "#ad5700",
        "amber-bg": "#fdf4ec",
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
