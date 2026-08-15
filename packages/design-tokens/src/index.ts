/**
 * Source de vérité visuelle — consommée par le mobile (NativeWind) ET le dashboard (Tailwind).
 * Aucune couleur / rayon en dur ailleurs dans le code : tout part d'ici.
 *
 * DA « vert islamique & or » — Mosquée Fitia (Petro Ivoire, Abobo).
 * Le vert profond porte l'identité cultuelle et fait écho au vert de Petro Ivoire ;
 * l'or sert d'accent rare (calligraphie, motifs, bordures), jamais de fond de texte clair.
 */

/** Dégradé signature (135°) : bannières, en-têtes, carte de fidèle, boutons primaires. */
export const gradient = {
  emerald: ["#064E3B", "#0B7A3B", "#C9A227"] as const,
  /** Variante sobre (sans or) pour les grandes surfaces. */
  deep: ["#053A2C", "#0B7A3B"] as const,
  angle: 135,
};

/**
 * Couleurs de marque (indépendantes du thème).
 * ⚠️ Contraste : `secondary` (or) ne porte QUE du texte sombre (`palette.light.text`).
 *    Le vert `primary` ne porte QUE du texte blanc.
 */
export const brand = {
  primary: "#0B7A3B", // vert profond — actions
  primaryHover: "#086130",
  secondary: "#C9A227", // or — accents, décor, badges
  secondaryHover: "#A9871C",
  tertiary: "#0E9F6E", // émeraude clair — liens / focus
  success: "#12B76A",
  warning: "#F59E0B",
  danger: "#DC2626",
};

/** Neutres par thème — teintés très légèrement vert pour l'unité chromatique. */
export const palette = {
  light: {
    bg: "#F6FAF7",
    surface: "#FFFFFF",
    surfaceAlt: "#EEF4F0",
    border: "#DCE7E0",
    text: "#0C1912",
    textMuted: "#5B6B62",
  },
  dark: {
    bg: "#071410",
    surface: "#0F211A",
    surfaceAlt: "#162C23",
    border: "#244134",
    text: "#EAF3ED",
    textMuted: "#8FA79A",
  },
} as const;

/** Couleur dédiée à chacune des 5 prières (pastilles, compte à rebours, agenda). */
export const prayerColors = {
  fajr: "#1E3A8A", // aube — bleu nuit
  dhuhr: "#0E9F6E", // midi — émeraude
  asr: "#C9A227", // après-midi — or
  maghrib: "#C2410C", // coucher — cuivre
  isha: "#4C1D95", // nuit — violet profond
} as const;

export const radii = {
  sm: 10,
  md: 16,
  lg: 24,
  full: 999,
};

/** Espacement en base 4. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  "2xl": 48,
};

export const typography = {
  fonts: {
    display: "ClashDisplay", // titres — forte personnalité
    body: "Inter", // texte courant
    arabic: "Amiri", // sourates, noms de prières en arabe, date Hijri
  },
  sizes: {
    display: 34,
    h1: 28,
    h2: 22,
    h3: 18,
    body: 15,
    caption: 13,
  },
  weights: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
} as const;

/** Ombres douces teintées vert plutôt que noires pures. */
export const shadows = {
  card: "0 8px 24px rgba(11, 122, 59, 0.12)",
  glow: "0 0 20px rgba(11, 122, 59, 0.35)",
  gold: "0 0 18px rgba(201, 162, 39, 0.35)",
};

export type ThemeName = keyof typeof palette;
export type PrayerColorKey = keyof typeof prayerColors;
