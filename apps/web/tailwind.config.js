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
        background: "#090c11",
        surface: "#0c1016",
        raised: "#10151c",
        card: "#10151c",
        border: "#27313a",
        accent: "#00e59b",
        secondary: "#8f67ff",
        caution: "#fbbf24",
        "risk-high": "#fb7185",
        muted: "#94a3b8",
      },
      fontFamily: {
        brand: ["Space Grotesk", "ui-sans-serif", "system-ui", "sans-serif"],
        data: ["IBM Plex Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};
