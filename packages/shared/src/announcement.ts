import { z } from "zod";

/**
 * Contrat de l'annonce — le message diffusé du dashboard vers le mobile
 * (Khutba, information communautaire, appel à cotisation, alerte).
 * Le dashboard valide avec `createAnnouncementSchema` avant l'INSERT ;
 * le mobile reçoit un `Announcement` via Supabase Realtime.
 */

export const announcementCategorySchema = z.enum([
  "info",
  "khutba",
  "evenement",
  "urgent",
  "collecte",
]);
export type AnnouncementCategory = z.infer<typeof announcementCategorySchema>;

export const CATEGORY_META: Record<
  AnnouncementCategory,
  { label: string; color: string; emoji: string }
> = {
  info: { label: "Info", color: "#0E9F6E", emoji: "📢" },
  khutba: { label: "Khutba", color: "#0B7A3B", emoji: "🕌" },
  evenement: { label: "Événement", color: "#C9A227", emoji: "📅" },
  urgent: { label: "Urgent", color: "#DC2626", emoji: "🚨" },
  collecte: { label: "Collecte", color: "#4C1D95", emoji: "🤲" },
};

/** Payload de création (dashboard → Supabase). */
export const createAnnouncementSchema = z.object({
  title: z.string().min(3, "Titre trop court").max(120),
  body: z.string().min(1, "Message vide").max(2000),
  category: announcementCategorySchema.default("info"),
  pinned: z.boolean().default(false),
});
export type CreateAnnouncement = z.infer<typeof createAnnouncementSchema>;

/** Ligne telle que stockée / reçue par le mobile. */
export const announcementSchema = createAnnouncementSchema.extend({
  id: z.string().uuid(),
  author_id: z.string().uuid().nullable(),
  created_at: z.string(),
});
export type Announcement = z.infer<typeof announcementSchema>;
