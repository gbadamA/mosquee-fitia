import { z } from "zod";

/** Rôles — portés par `profiles.role` côté Supabase, appliqués par RLS. */
export const roleSchema = z.enum([
  "fidele", // adhérent : mobile uniquement
  "secretaire", // membres, communication, documents
  "tresorier", // module financier
  "imam", // administration complète
  "admin", // président / administrateur — accès total
]);

export type Role = z.infer<typeof roleSchema>;

export const ROLE_LABELS: Record<Role, string> = {
  fidele: "Fidèle",
  secretaire: "Secrétaire",
  tresorier: "Trésorier",
  imam: "Imam",
  admin: "Administrateur",
};

/** Accès au back-office web (les fidèles restent sur mobile). */
export const DASHBOARD_ROLES: Role[] = ["secretaire", "tresorier", "imam", "admin"];

/** Qui peut diffuser une annonce / une Khutba (écrire dans `announcements`). */
export const ROLES_CAN_BROADCAST: Role[] = ["imam", "admin", "secretaire"];

/** Qui pilote les finances (valider un don, saisir une dépense). */
export const ROLES_CAN_MANAGE_FINANCE: Role[] = ["tresorier", "imam", "admin"];

/** Qui publie les horaires de prière. */
export const ROLES_CAN_SET_PRAYER_TIMES: Role[] = ["imam", "admin"];

/** Administration pure (comptes, rôles, paramètres mosquée). */
export const ROLES_ADMIN: Role[] = ["imam", "admin"];
