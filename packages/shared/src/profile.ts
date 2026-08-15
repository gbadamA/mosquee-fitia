import { z } from "zod";
import { roleSchema } from "./roles";

/** Statut d'adhésion d'un fidèle. */
export const memberStatusSchema = z.enum(["actif", "en_attente", "inactif"]);
export type MemberStatus = z.infer<typeof memberStatusSchema>;

/**
 * ⚠️ `actif` décrit l'ADHÉSION, pas le paiement.
 * Le libellé était « À jour », ce qui entrait en contradiction directe avec la
 * colonne Cotisation : un fidèle pouvait afficher « À jour » avec 4 mois d'arriéré.
 * La situation de paiement se lit désormais uniquement dans le calcul d'arriérés.
 */
export const MEMBER_STATUS_LABELS: Record<MemberStatus, string> = {
  actif: "Adhésion active",
  en_attente: "En attente",
  inactif: "Inactif",
};

/** Catégorisation demandée au cahier des charges (§2.1), sans le volet madrassa. */
export const memberCategorySchema = z.enum(["membre_actif", "bienfaiteur", "staff"]);
export type MemberCategory = z.infer<typeof memberCategorySchema>;

export const MEMBER_CATEGORY_LABELS: Record<MemberCategory, string> = {
  membre_actif: "Membre actif",
  bienfaiteur: "Bienfaiteur",
  staff: "Staff",
};

/** Fiche fidèle telle que stockée dans `profiles`. */
export const profileSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  quartier: z.string().nullable(),
  photo_url: z.string().nullable(),
  member_number: z.string().nullable(),
  role: roleSchema,
  status: memberStatusSchema,
  category: memberCategorySchema,
  push_token: z.string().nullable(),
  joined_at: z.string(),
  created_at: z.string(),
});
export type Profile = z.infer<typeof profileSchema>;

/** Normalise un numéro ivoirien en +225XXXXXXXXXX. */
export function normalizePhoneCI(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("225")) return `+${digits}`;
  return `+225${digits}`;
}

/**
 * `+225 07 09 11 22 33` — lisible à l'écran.
 * ⚠️ Supabase Auth stocke le numéro **sans** le « + » (ex. `2250709112233`) :
 * l'affichage brut est illisible, on regroupe donc par paires.
 */
export function formatPhoneCI(raw: string | null | undefined): string {
  if (!raw) return "—";
  const digits = raw.replace(/\D/g, "");
  const local = digits.startsWith("225") ? digits.slice(3) : digits;
  if (!local) return "—";
  return `+225 ${local.replace(/(\d{2})(?=\d)/g, "$1 ")}`;
}
