import { z } from "zod";

/** Rôles — portés par `profiles.role` côté Supabase, appliqués par RLS. */
export const roleSchema = z.enum([
  "fidele", // adhérent : registre tenu par le bureau (plus de compte mobile)
  "membre_staff", // staff de TERRAIN : mobile uniquement, applique les consignes
  "secretaire", // membres, communication, documents
  "tresorier", // module financier
  "imam", // administration complète
  "admin", // président / administrateur — accès total
]);

export type Role = z.infer<typeof roleSchema>;

export const ROLE_LABELS: Record<Role, string> = {
  fidele: "Fidèle",
  membre_staff: "Membre du staff",
  secretaire: "Secrétaire",
  tresorier: "Trésorier",
  imam: "Imam",
  admin: "Administrateur",
};

/** Accès au back-office web (les fidèles restent sur mobile). */
export const DASHBOARD_ROLES: Role[] = ["secretaire", "tresorier", "imam", "admin"];

/**
 * Qui se connecte sur l'APPLICATION MOBILE (depuis le 2026-11-14, l'app est
 * ouverte à tous sans compte ; seul le staff s'y connecte).
 */
export const MOBILE_STAFF_ROLES: Role[] = ["membre_staff", "secretaire", "tresorier", "imam", "admin"];

/** Le bureau : donne les consignes au staff de terrain. */
export const ROLES_BUREAU: Role[] = ["secretaire", "tresorier", "imam", "admin"];

/** Qui peut diffuser une annonce / une Khutba (écrire dans `announcements`). */
export const ROLES_CAN_BROADCAST: Role[] = ["imam", "admin", "secretaire", "membre_staff"];

/** Qui crée et modifie les événements. */
export const ROLES_CAN_MANAGE_EVENTS: Role[] = ["imam", "admin", "secretaire", "membre_staff"];

/** Qui pilote les finances (valider un don, saisir une dépense). */
export const ROLES_CAN_MANAGE_FINANCE: Role[] = ["tresorier", "imam", "admin"];

/** Qui publie les horaires de prière. */
export const ROLES_CAN_SET_PRAYER_TIMES: Role[] = ["imam", "admin", "membre_staff"];

/** Administration pure (comptes, rôles, paramètres mosquée). */
export const ROLES_ADMIN: Role[] = ["imam", "admin"];
