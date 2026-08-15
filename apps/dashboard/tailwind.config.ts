import type { Config } from "tailwindcss";
// Preset partagé mobile <-> web : une seule DA.
import preset from "@fitia/design-tokens/tailwind-preset";

const config: Config = {
  presets: [preset],
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/**/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      // Les couleurs de MARQUE passent par des variables CSS pour que les couleurs
      // choisies par la mosquée (table `mosque`) s'appliquent réellement à l'exécution.
      // Format « canaux RVB » obligatoire pour conserver l'opacité Tailwind (`bg-primary/10`).
      // Les neutres restent statiques : ils ne sont pas personnalisables.
      colors: {
        primary: {
          DEFAULT: "rgb(var(--c-primary) / <alpha-value>)",
          hover: "rgb(var(--c-primary-hover) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "rgb(var(--c-secondary) / <alpha-value>)",
          hover: "rgb(var(--c-secondary-hover) / <alpha-value>)",
        },
      },
      backgroundImage: {
        emerald:
          "linear-gradient(135deg, var(--g-start) 0%, var(--g-mid) 55%, var(--g-end) 100%)",
      },
      // Ombres teintées : elles suivent aussi la couleur principale de la mosquée.
      boxShadow: {
        card: "0 8px 24px rgb(var(--c-primary) / 0.12)",
        glow: "0 0 20px rgb(var(--c-primary) / 0.35)",
        gold: "0 0 18px rgb(var(--c-secondary) / 0.35)",
      },
    },
  },
};

export default config;
