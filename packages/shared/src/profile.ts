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
 * Domaine des identifiants internes des fidèles.
 *
 * `.invalid` est réservé par la RFC 2606 et ne résout JAMAIS : aucun courriel ne
 * peut partir vers ces adresses, ni y arriver. C'est exactement ce qu'on veut —
 * ce n'est pas une adresse, c'est un identifiant.
 */
export const AUTH_EMAIL_DOMAIN = "fitia.invalid";

/**
 * Traduit un numéro en identifiant d'authentification interne.
 *
 * POURQUOI CE DÉTOUR. Supabase n'ouvre la connexion par téléphone que si un
 * fournisseur SMS est **déclaré** — vérifié le 2026-08-18 : sans lui,
 * `signInWithPassword({phone})` répond « Phone logins are disabled ». Or la
 * mosquée n'a pas de fournisseur, et n'en a pas besoin puisqu'on n'envoie aucun
 * SMS (mot de passe, pas OTP). L'authentification e-mail, elle, ne demande rien.
 *
 * Le fidèle continue donc de saisir SON NUMÉRO à l'écran ; il ne voit jamais
 * cette adresse. Le vrai numéro reste dans `profiles.phone`, colonne
 * indépendante d'`auth.users`.
 *
 * ⚠️ Cette règle est dupliquée dans `supabase/functions/create-member` (Deno ne
 * peut pas importer ce paquet). Les deux DOIVENT rester identiques, sinon un
 * fidèle serait créé sous un identifiant que l'écran de connexion ne saurait pas
 * reconstruire. `scripts-verif/auth-password-check.mjs` le prouve à chaque
 * exécution : il crée par la fonction, puis se connecte par ce helper.
 */
export function phoneToAuthEmail(phone: string): string {
  // On repart du numéro normalisé, sans le « + » : un même numéro doit toujours
  // produire le même identifiant, quelle que soit sa saisie.
  const digits = normalizePhoneCI(phone).replace(/\D/g, "");
  return `${digits}@${AUTH_EMAIL_DOMAIN}`;
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
