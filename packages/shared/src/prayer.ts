import { z } from "zod";

/**
 * Horaires de prière — LE cœur de l'app mobile.
 *
 * Choix d'architecture : les horaires sont **publiés depuis le dashboard** par l'imam
 * (table `prayer_times`, une ligne par date) et reçus par le mobile via Supabase Realtime,
 * exactement comme les annonces. Raisons :
 *   1. la mosquée fait autorité sur ses propres horaires (iqama réelle ≠ calcul astronomique) ;
 *   2. aucun calcul embarqué à maintenir côté mobile → bundle léger, pas de dérive ;
 *   3. le mobile met la dernière ligne reçue en cache → fonctionne hors connexion.
 * Un calcul automatique (coordonnées d'Abobo) peut pré-remplir la saisie côté dashboard.
 */

export const PRAYER_KEYS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;
export type PrayerKey = (typeof PRAYER_KEYS)[number];

export const PRAYER_META: Record<
  PrayerKey,
  { label: string; arabic: string; color: string }
> = {
  fajr: { label: "Fajr", arabic: "الفجر", color: "#1E3A8A" },
  dhuhr: { label: "Dhuhr", arabic: "الظهر", color: "#0E9F6E" },
  asr: { label: "Asr", arabic: "العصر", color: "#C9A227" },
  maghrib: { label: "Maghrib", arabic: "المغرب", color: "#C2410C" },
  isha: { label: "Isha", arabic: "العشاء", color: "#4C1D95" },
};

/** `HH:MM` (l'heure telle que saisie par l'imam, fuseau de la mosquée). */
export const timeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure attendue au format HH:MM");

/** Payload de publication (dashboard → Supabase). */
export const createPrayerTimesSchema = z.object({
  /** `YYYY-MM-DD` — une ligne par jour. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ"),
  fajr: timeOfDaySchema,
  chourouk: timeOfDaySchema.nullable().default(null),
  dhuhr: timeOfDaySchema,
  asr: timeOfDaySchema,
  maghrib: timeOfDaySchema,
  isha: timeOfDaySchema,
  /** Heure de la Djouma — pertinent le vendredi uniquement. */
  jumua: timeOfDaySchema.nullable().default(null),
  note: z.string().max(280).nullable().default(null),
});
export type CreatePrayerTimes = z.infer<typeof createPrayerTimesSchema>;

/** Ligne telle que stockée / reçue par le mobile. */
export const prayerTimesSchema = createPrayerTimesSchema.extend({
  id: z.string().uuid(),
  created_at: z.string(),
});
export type PrayerTimes = z.infer<typeof prayerTimesSchema>;

/* -------------------------------------------------------------------------- */
/* Helpers purs — partagés mobile ↔ dashboard, testables sans réseau.          */
/* -------------------------------------------------------------------------- */

/** Combine `date` (YYYY-MM-DD) + `HH:MM` en Date locale. */
export function toDate(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
}

export type NextPrayer = {
  key: PrayerKey;
  /** Instant de la prière. */
  at: Date;
  /** Millisecondes restantes (≥ 0). */
  msUntil: number;
  /** Vrai si la prière tombe le lendemain (après Isha, on vise le Fajr suivant). */
  tomorrow: boolean;
};

/**
 * Prochaine prière à partir de `now`.
 * Après Isha, renvoie le Fajr du lendemain en réutilisant l'heure du jour courant
 * (approximation d'une minute près, suffisante pour un compte à rebours ; la vraie
 * ligne du lendemain remplace le calcul dès qu'elle est publiée).
 */
export function nextPrayer(times: PrayerTimes, now: Date = new Date()): NextPrayer {
  for (const key of PRAYER_KEYS) {
    const at = toDate(times.date, times[key]);
    if (at.getTime() > now.getTime()) {
      return { key, at, msUntil: at.getTime() - now.getTime(), tomorrow: false };
    }
  }
  // Toutes les prières du jour sont passées → Fajr de demain.
  const at = toDate(times.date, times.fajr);
  at.setDate(at.getDate() + 1);
  return {
    key: "fajr",
    at,
    msUntil: Math.max(0, at.getTime() - now.getTime()),
    tomorrow: true,
  };
}

/** `2h 07min` / `43min 12s` — format court pour le compte à rebours. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}min`;
  if (m > 0) return `${m}min ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

/** Date du jour au format `YYYY-MM-DD` en heure locale (pas d'UTC : décalage Abidjan). */
export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Date Hijri lisible — via Intl, aucune dépendance externe. */
export function hijriDate(now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("fr-TN-u-ca-islamic", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(now);
  } catch {
    return "";
  }
}
