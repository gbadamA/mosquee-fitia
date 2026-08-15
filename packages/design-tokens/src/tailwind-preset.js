/**
 * Preset Tailwind partagé — importé par le dashboard (Tailwind) ET le mobile (NativeWind).
 * Miroir des tokens de `index.ts` au format Tailwind. Une seule DA pour les deux plateformes.
 *
 * Usage (tailwind.config.js) :
 *   module.exports = { presets: [require('@fitia/design-tokens/tailwind-preset')], content: [...] }
 *
 * Thème : classes `dark:` (ex. `bg-light-bg dark:bg-dark-bg`).
 *
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  theme: {
    extend: {
      colors: {
        // Marque (indépendant du thème)
        primary: { DEFAULT: "#0B7A3B", hover: "#086130" },
        secondary: { DEFAULT: "#C9A227", hover: "#A9871C" },
        tertiary: "#0E9F6E",
        success: "#12B76A",
        warning: "#F59E0B",
        danger: "#DC2626",
        // Dégradé signature
        emerald: { start: "#064E3B", mid: "#0B7A3B", end: "#C9A227" },
        // Prières
        prayer: {
          fajr: "#1E3A8A",
          dhuhr: "#0E9F6E",
          asr: "#C9A227",
          maghrib: "#C2410C",
          isha: "#4C1D95",
        },
        // Neutres — clair
        light: {
          bg: "#F6FAF7",
          surface: "#FFFFFF",
          "surface-alt": "#EEF4F0",
          border: "#DCE7E0",
          text: "#0C1912",
          muted: "#5B6B62",
        },
        // Neutres — sombre
        dark: {
          bg: "#071410",
          surface: "#0F211A",
          "surface-alt": "#162C23",
          border: "#244134",
          text: "#EAF3ED",
          muted: "#8FA79A",
        },
      },
      borderRadius: {
        sm: "10px",
        md: "16px",
        lg: "24px",
      },
      fontFamily: {
        display: ["ClashDisplay", "Satoshi", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        arabic: ["Amiri", "Scheherazade New", "serif"],
      },
      fontSize: {
        display: ["34px", { lineHeight: "40px", fontWeight: "700" }],
        h1: ["28px", { lineHeight: "34px", fontWeight: "700" }],
        h2: ["22px", { lineHeight: "28px", fontWeight: "600" }],
        h3: ["18px", { lineHeight: "24px", fontWeight: "600" }],
        body: ["15px", { lineHeight: "22px" }],
        caption: ["13px", { lineHeight: "18px" }],
      },
      backgroundImage: {
        emerald: "linear-gradient(135deg, #064E3B 0%, #0B7A3B 55%, #C9A227 100%)",
        "emerald-deep": "linear-gradient(135deg, #053A2C 0%, #0B7A3B 100%)",
      },
      boxShadow: {
        card: "0 8px 24px rgba(11, 122, 59, 0.12)",
        glow: "0 0 20px rgba(11, 122, 59, 0.35)",
        gold: "0 0 18px rgba(201, 162, 39, 0.35)",
      },
    },
  },
};
