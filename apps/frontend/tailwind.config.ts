import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#7c3aed",
          fg: "#ede9fe",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
