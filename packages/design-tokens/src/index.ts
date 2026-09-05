/**
 * Source de vérité visuelle — consommée par le mobile (NativeWind) ET le dashboard (Tailwind).
 * Aucune couleur / rayon en dur ailleurs dans le code : tout part d'ici.
 *
 * DA tirée du LOGO officiel — emblème circulaire « FITYA D'ABOBO / MOSQUEE FITYA ».
 * L'identité y tient à deux couleurs : le vert forêt de l'anneau et du nom, l'or
 * de l'arc intérieur et du sous-titre. Le vert clair n'appartient qu'au bâtiment
 * illustré à l'intérieur de l'emblème — c'est un détail d'illustration, pas la
 * couleur de marque : le prendre pour tel donnerait une interface vert pomme,
 * là où le logo est sobre et profond.
 *
 * Valeurs échantillonnées directement dans le fichier du logo, pas estimées à
 * l'œil : l'anneau et le nom donnent `primary`, l'arc et le sous-titre donnent
 * `secondary`, le bâtiment illustré donne `building`.
 *
 * ⚠️ Contraste mesuré sur blanc, non négociable : `secondary` (2,60:1) et
 * `building` (2,91:1) sont ILLISIBLES sous du texte blanc. Ils ne portent que
 * du texte sombre, ou aucun texte. Seul `primary` (10,28:1) porte du blanc.
 */

/** Dégradé signature (135°) : bannières, en-têtes, carte de fidèle, boutons primaires. */
export const gradient = {
  /** Forêt → bâtiment → or : l'emblème lu de l'anneau vers son centre. */
  emerald: ["#093A19", "#5DA85A", "#C29C29"] as const,
  /** Variante sobre (sans or) pour les grandes surfaces. */
  deep: ["#072F14", "#0C4B20"] as const,
  angle: 135,
};

/**
 * Couleurs de marque (indépendantes du thème).
 * ⚠️ Contraste : `secondary` (or) et `building` ne portent QUE du texte sombre
 *    (`palette.light.text`). Le vert `primary` ne porte QUE du texte blanc.
 */
export const brand = {
  primary: "#0C4B20", // vert forêt du logo — actions (10,28:1 sur blanc)
  primaryHover: "#093A19",
  /** Vert du bâtiment dans l'emblème — décor uniquement, jamais sous du blanc. */
  building: "#5DA85A",
  secondary: "#C29C29", // or du logo — accents, décor, badges
  secondaryHover: "#A78420",
  tertiary: "#15803D", // vert moyen — liens, anneaux de focus (5,02:1)
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
  asr: "#C29C29", // après-midi — or du logo
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
  card: "0 8px 24px rgba(12, 75, 32, 0.12)",
  glow: "0 0 20px rgba(12, 75, 32, 0.35)",
  gold: "0 0 18px rgba(194, 156, 41, 0.35)",
};

export type ThemeName = keyof typeof palette;
export type PrayerColorKey = keyof typeof prayerColors;
