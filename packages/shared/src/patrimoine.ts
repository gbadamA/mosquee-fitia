import { z } from "zod";

/**
 * Patrimoine et vie matérielle : documents, inventaire des biens, entretien,
 * relevés de fréquentation. Réservé au personnel de la mosquée.
 */

/* -------------------------------- Documents ------------------------------- */

export const documentTypeSchema = z.enum([
  "statuts",
  "proces_verbal",
  "contrat",
  "facture",
  "autre",
]);
export type DocumentType = z.infer<typeof documentTypeSchema>;

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  statuts: "Statuts",
  proces_verbal: "Procès-verbal",
  contrat: "Contrat",
  facture: "Facture",
  autre: "Autre",
};

export const createDocumentSchema = z.object({
  title: z.string().min(3, "Titre trop court").max(160),
  type: documentTypeSchema.default("autre"),
  description: z.string().max(1000).nullable().default(null),
});
export type CreateDocument = z.infer<typeof createDocumentSchema>;

/* -------------------------------- Inventaire ------------------------------ */

export const assetCategorySchema = z.enum([
  "tapis",
  "sonorisation",
  "mobilier",
  "vehicule",
  "informatique",
  "climatisation",
  "autre",
]);
export type AssetCategory = z.infer<typeof assetCategorySchema>;

export const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  tapis: "Tapis",
  sonorisation: "Sonorisation",
  mobilier: "Mobilier",
  vehicule: "Véhicule",
  informatique: "Informatique",
  climatisation: "Climatisation",
  autre: "Autre",
};

export const assetConditionSchema = z.enum(["bon", "moyen", "mauvais", "hors_service"]);
export type AssetCondition = z.infer<typeof assetConditionSchema>;

export const ASSET_CONDITION_LABELS: Record<AssetCondition, string> = {
  bon: "Bon état",
  moyen: "État moyen",
  mauvais: "Mauvais état",
  hors_service: "Hors service",
};

export const createAssetSchema = z.object({
  name: z.string().min(2, "Nom trop court").max(140),
  category: assetCategorySchema.default("autre"),
  quantity: z.number().int().positive("Quantité invalide").default(1),
  condition: assetConditionSchema.default("bon"),
  value_fcfa: z.number().int().nonnegative().nullable().default(null),
  location: z.string().max(140).nullable().default(null),
  acquired_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ")
    .nullable()
    .default(null),
  notes: z.string().max(1000).nullable().default(null),
});
export type CreateAsset = z.infer<typeof createAssetSchema>;

/* ------------------------- Suivi daté d'un bien --------------------------- */

/**
 * Journal d'un bien. L'inventaire seul ne dit que l'état ACTUEL : sans ces
 * événements on ne sait ni depuis quand un bien est en panne, ni ce qu'il a
 * déjà coûté en réparations.
 */
export const assetEventTypeSchema = z.enum([
  "acquisition",
  "controle",
  "reparation",
  "deplacement",
  "changement_etat",
  "sortie",
  "autre",
]);
export type AssetEventType = z.infer<typeof assetEventTypeSchema>;

export const ASSET_EVENT_LABELS: Record<AssetEventType, string> = {
  acquisition: "Acquisition",
  controle: "Contrôle",
  reparation: "Réparation",
  deplacement: "Déplacement",
  changement_etat: "Changement d'état",
  sortie: "Sortie d'inventaire",
  autre: "Autre",
};

export const createAssetEventSchema = z.object({
  asset_id: z.string().uuid(),
  type: assetEventTypeSchema.default("autre"),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ"),
  note: z.string().max(1000).nullable().default(null),
  condition_after: assetConditionSchema.nullable().default(null),
  cost_fcfa: z.number().int().nonnegative().nullable().default(null),
});
export type CreateAssetEvent = z.infer<typeof createAssetEventSchema>;

/* --------------------------------- Entretien ------------------------------ */

export const maintenanceKindSchema = z.enum([
  "nettoyage",
  "climatisation",
  "sonorisation",
  "plomberie",
  "electricite",
  "batiment",
  "autre",
]);
export type MaintenanceKind = z.infer<typeof maintenanceKindSchema>;

export const MAINTENANCE_KIND_LABELS: Record<MaintenanceKind, string> = {
  nettoyage: "Nettoyage",
  climatisation: "Climatisation",
  sonorisation: "Sonorisation",
  plomberie: "Plomberie",
  electricite: "Électricité",
  batiment: "Bâtiment",
  autre: "Autre",
};

export const maintenanceRecurrenceSchema = z.enum([
  "ponctuel",
  "hebdomadaire",
  "mensuel",
  "trimestriel",
  "annuel",
]);
export type MaintenanceRecurrence = z.infer<typeof maintenanceRecurrenceSchema>;

export const MAINTENANCE_RECURRENCE_LABELS: Record<MaintenanceRecurrence, string> = {
  ponctuel: "Ponctuel",
  hebdomadaire: "Chaque semaine",
  mensuel: "Chaque mois",
  trimestriel: "Chaque trimestre",
  annuel: "Chaque année",
};

export const createMaintenanceSchema = z.object({
  title: z.string().min(3, "Titre trop court").max(160),
  kind: maintenanceKindSchema.default("autre"),
  asset_id: z.string().uuid().nullable().default(null),
  recurrence: maintenanceRecurrenceSchema.default("ponctuel"),
  due_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ"),
  assignee: z.string().max(140).nullable().default(null),
  notes: z.string().max(1000).nullable().default(null),
});
export type CreateMaintenance = z.infer<typeof createMaintenanceSchema>;

/** Jours ajoutés à l'échéance quand une tâche récurrente est cochée. */
const RECURRENCE_DAYS: Record<MaintenanceRecurrence, number> = {
  ponctuel: 0,
  hebdomadaire: 7,
  mensuel: 30,
  trimestriel: 91,
  annuel: 365,
};

/**
 * Prochaine échéance après exécution d'une tâche.
 * Renvoie `null` pour une tâche ponctuelle : elle est close, pas réarmée.
 * On repart de la date d'exécution, pas de l'ancienne échéance — sinon une tâche
 * faite en retard resterait éternellement en retard.
 */
export function nextDueDate(
  recurrence: MaintenanceRecurrence,
  doneOn: string,
): string | null {
  const days = RECURRENCE_DAYS[recurrence];
  if (days === 0) return null;
  const d = new Date(`${doneOn}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** `en retard` / `aujourd'hui` / `dans 5 j` — statut lisible d'une échéance. */
export function dueLabel(dueOn: string, today: string): { label: string; late: boolean } {
  const due = new Date(`${dueOn}T12:00:00`).getTime();
  const now = new Date(`${today}T12:00:00`).getTime();
  const days = Math.round((due - now) / 86_400_000);
  if (days < 0) return { label: `en retard de ${Math.abs(days)} j`, late: true };
  if (days === 0) return { label: "aujourd'hui", late: false };
  return { label: `dans ${days} j`, late: false };
}

/* ------------------------------- Fréquentation ---------------------------- */

export const attendanceMomentSchema = z.enum([
  "fajr",
  "dhuhr",
  "asr",
  "maghrib",
  "isha",
  "jumua",
  "evenement",
]);
export type AttendanceMoment = z.infer<typeof attendanceMomentSchema>;

export const ATTENDANCE_MOMENT_LABELS: Record<AttendanceMoment, string> = {
  fajr: "Fajr",
  dhuhr: "Dhuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha",
  jumua: "Djouma",
  evenement: "Événement",
};

export const createAttendanceSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ"),
  moment: attendanceMomentSchema,
  event_id: z.string().uuid().nullable().default(null),
  count: z.number().int().nonnegative("Effectif invalide").max(100_000),
});
export type CreateAttendance = z.infer<typeof createAttendanceSchema>;
