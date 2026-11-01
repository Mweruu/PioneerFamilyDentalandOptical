import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#F3F6FB",
          100: "#E6EDF7",
          200: "#C8D8EC",
          300: "#9EB9DA",
          400: "#6B91C2",
          500: "#3F6CA6",
          600: "#285489",
          700: "#1B4170",
          800: "#12315A",
          900: "#0B1F3A",
          950: "#071529",
        },
        sky: {
          50: "#F2F8FD",
          100: "#E4F1FA",
          200: "#C4E2F5",
          300: "#92CBEC",
          400: "#55ADDE",
          500: "#2C8DC6",
          600: "#1E71A8",
          700: "#1A5B88",
          800: "#1A4D71",
          900: "#1A415F",
        },
        teal: {
          50: "#EFFAF8",
          100: "#D6F3EE",
          200: "#ADE6DE",
          300: "#78D1C8",
          400: "#42B5AC",
          500: "#219A92",
          600: "#167C77",
          700: "#14635F",
          800: "#144F4D",
          900: "#144240",
        },
        mist: "#F5F8FC",
        line: "#DDE7F1",
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "Segoe UI",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        display: [
          "var(--font-display)",
          "Segoe UI",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(11,31,58,.04), 0 12px 32px -20px rgba(11,31,58,.18)",
        lift: "0 2px 6px rgba(11,31,58,.06), 0 24px 56px -28px rgba(11,31,58,.25)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: ".55" },
        },
      },
      animation: {
        "fade-up": "fadeUp .45s ease-out both",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
