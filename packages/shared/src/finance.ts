import { z } from "zod";

/**
 * Finances de la mosquée — cotisations, dons (Sadaqah / Zakat), campagnes, dépenses.
 *
 * V1 = **preuve de paiement** (pas d'API Mobile Money) : le fidèle déclare son versement
 * (montant + méthode + n° de transaction) depuis le mobile ; le trésorier valide au
 * dashboard. Le port `PaymentGateway` ci-dessous fige le contrat pour brancher plus tard
 * Orange Money / Wave / MTN sans réécrire l'UI ni le schéma.
 */

export const paymentMethodSchema = z.enum([
  "orange_money",
  "mtn_money",
  "wave",
  "especes",
  "virement",
]);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  orange_money: "Orange Money",
  mtn_money: "MTN Money",
  wave: "Wave",
  especes: "Espèces",
  virement: "Virement",
};

export const paymentStatusSchema = z.enum(["en_attente", "valide", "rejete"]);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  en_attente: "En attente",
  valide: "Validé",
  rejete: "Rejeté",
};

export const donationTypeSchema = z.enum(["sadaqah", "zakat", "campagne"]);
export type DonationType = z.infer<typeof donationTypeSchema>;

export const DONATION_TYPE_LABELS: Record<DonationType, string> = {
  sadaqah: "Sadaqah",
  zakat: "Zakat",
  campagne: "Campagne",
};

export const expenseCategorySchema = z.enum([
  "entretien",
  "salaires",
  "factures",
  "evenement",
  "travaux",
  "autre",
]);
export type ExpenseCategory = z.infer<typeof expenseCategorySchema>;

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  entretien: "Entretien",
  salaires: "Salaires",
  factures: "Factures",
  evenement: "Événement",
  travaux: "Travaux",
  autre: "Autre",
};

/* --------------------------- Déclarations mobile -------------------------- */

/** Montant en FCFA — entier, pas de centimes. */
export const amountSchema = z
  .number()
  .int("Montant en FCFA entier")
  .positive("Montant invalide")
  .max(50_000_000, "Montant trop élevé");

/** Cotisation déclarée par un fidèle (mobile → Supabase, statut `en_attente`). */
export const declareContributionSchema = z.object({
  amount: amountSchema,
  method: paymentMethodSchema,
  /** Numéro de transaction Mobile Money — la preuve. */
  reference: z.string().min(4, "Référence trop courte").max(60),
  /** Mois couvert, `YYYY-MM`. */
  period: z.string().regex(/^\d{4}-\d{2}$/, "Période attendue au format AAAA-MM"),
});
export type DeclareContribution = z.infer<typeof declareContributionSchema>;

/** Don déclaré par un fidèle (Sadaqah, Zakat ou campagne). */
export const declareDonationSchema = z.object({
  amount: amountSchema,
  method: paymentMethodSchema,
  reference: z.string().min(4, "Référence trop courte").max(60),
  type: donationTypeSchema.default("sadaqah"),
  campaign_id: z.string().uuid().nullable().default(null),
  anonymous: z.boolean().default(false),
});
export type DeclareDonation = z.infer<typeof declareDonationSchema>;

/** Dépense saisie par le trésorier (dashboard). */
export const createExpenseSchema = z.object({
  label: z.string().min(3, "Libellé trop court").max(140),
  amount: amountSchema,
  category: expenseCategorySchema.default("autre"),
  /** `YYYY-MM-DD` */
  spent_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ"),
});
export type CreateExpense = z.infer<typeof createExpenseSchema>;

/** Campagne de collecte (construction, Ramadan, Waqf…). */
export const createCampaignSchema = z.object({
  name: z.string().min(3).max(120),
  description: z.string().max(1000).nullable().default(null),
  goal_amount: amountSchema,
  ends_at: z.string().nullable().default(null),
});
export type CreateCampaign = z.infer<typeof createCampaignSchema>;

/* ------------------------------- Présentation ----------------------------- */

/** `125 000 FCFA` — séparateur insécable fin, lisible sur mobile. */
export function formatFCFA(amount: number): string {
  return `${Math.round(amount).toLocaleString("fr-FR").replace(/ |\s/g, " ")} FCFA`;
}

/** Numéro de reçu lisible à partir de l'id technique. */
export function receiptNumber(id: string, prefix = "REC"): string {
  return `${prefix}-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

/* --------------------------------- Port ----------------------------------- */

/**
 * Contrat d'un fournisseur Mobile Money — **non implémenté en V1**.
 * L'adaptateur « preuve de paiement » est l'implémentation courante : il crée
 * directement une ligne `en_attente` que le trésorier valide à la main.
 * Brancher Orange Money reviendra à fournir un second adaptateur respectant ce port.
 */
export type PaymentGateway = {
  readonly name: string;
  /** Initie un paiement et renvoie une référence à stocker dans `reference`. */
  initiate(input: {
    amount: number;
    method: PaymentMethod;
    payerPhone: string;
    label: string;
  }): Promise<{ reference: string; status: PaymentStatus }>;
  /** Rejoue l'état d'un paiement (webhook ou polling). */
  status(reference: string): Promise<PaymentStatus>;
};
