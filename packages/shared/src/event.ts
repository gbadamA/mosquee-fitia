import { z } from "zod";

/** Calendrier de la mosquée : Djouma, conférences, Aïd, Ramadan, Janazah… */

export const eventTypeSchema = z.enum([
  "djouma",
  "conference",
  "aid",
  "ramadan",
  "janazah",
  "cours",
  "autre",
]);
export type EventType = z.infer<typeof eventTypeSchema>;

export const EVENT_TYPE_META: Record<EventType, { label: string; emoji: string; color: string }> = {
  djouma: { label: "Djouma", emoji: "🕌", color: "#0B7A3B" },
  conference: { label: "Conférence", emoji: "🎙️", color: "#0E9F6E" },
  aid: { label: "Aïd", emoji: "🌙", color: "#C9A227" },
  ramadan: { label: "Ramadan", emoji: "🌙", color: "#4C1D95" },
  janazah: { label: "Salat al-Janazah", emoji: "🤲", color: "#5B6B62" },
  cours: { label: "Cours", emoji: "📖", color: "#1E3A8A" },
  autre: { label: "Autre", emoji: "📌", color: "#C2410C" },
};

export const createEventSchema = z.object({
  title: z.string().min(3, "Titre trop court").max(140),
  description: z.string().max(2000).nullable().default(null),
  type: eventTypeSchema.default("autre"),
  location: z.string().max(140).nullable().default(null),
  /** ISO 8601 */
  starts_at: z.string().min(1, "Date de début requise"),
  ends_at: z.string().nullable().default(null),
  capacity: z.number().int().positive().nullable().default(null),
});
export type CreateEvent = z.infer<typeof createEventSchema>;

export const eventSchema = createEventSchema.extend({
  id: z.string().uuid(),
  created_by: z.string().uuid().nullable(),
  created_at: z.string(),
});
export type MosqueEvent = z.infer<typeof eventSchema>;

/** `ven. 8 août · 13:00` — format court FR pour listes mobiles. */
export function formatEventDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
