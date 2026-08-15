/**
 * Utilitaires couleur — servent à appliquer VRAIMENT les couleurs personnalisées
 * de la mosquée (table `mosque`) par-dessus les tokens par défaut.
 *
 * Côté web, Tailwind consomme les couleurs de marque sous forme de variables CSS
 * exprimées en canaux RVB séparés par des espaces (`11 122 59`), ce qui permet à
 * `rgb(var(--c-primary) / <alpha-value>)` de continuer à gérer l'opacité (`bg-primary/10`).
 */

/** `#0B7A3B` → `{ r: 11, g: 122, b: 59 }` ; null si la chaîne n'est pas un hex valide. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.trim().replace(/^#/, "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/** `#0B7A3B` → `"11 122 59"` (format attendu par `rgb(var(--x) / <alpha>)`). */
export function hexToRgbChannels(hex: string, fallback: string): string {
  const rgb = hexToRgb(hex) ?? hexToRgb(fallback);
  return rgb ? `${rgb.r} ${rgb.g} ${rgb.b}` : "0 0 0";
}

/** Assombrit une couleur d'un ratio (0–1). Sert à dériver l'état `hover`. */
export function darken(hex: string, ratio = 0.18): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const f = (v: number) => Math.max(0, Math.round(v * (1 - ratio)));
  return `#${[f(rgb.r), f(rgb.g), f(rgb.b)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
}

/** Éclaircit une couleur vers le blanc — utilisé pour le début du dégradé. */
export function lighten(hex: string, ratio = 0.18): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const f = (v: number) => Math.min(255, Math.round(v + (255 - v) * ratio));
  return `#${[f(rgb.r), f(rgb.g), f(rgb.b)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
}

/**
 * Dégradé signature dérivé des deux couleurs de la mosquée :
 * une version foncée de la principale → la principale → l'accent.
 */
export function brandGradient(primary: string, secondary: string): [string, string, string] {
  return [darken(primary, 0.45), primary, secondary];
}
