/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#090A0F",
        surface: "#12141F",
        card: "#181B2B",
        border: "#23273D",
        accent: "#00FFA3", // Solana Cyan/Green
        primary: "#9945FF", // Solana Purple
        danger: "#FF3B69",
        warning: "#FFB020",
      },
    },
  },
  plugins: [],
};
