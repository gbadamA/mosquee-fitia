import { z } from "zod";

/**
 * Attestations DÉLIVRÉES par la mosquée — à distinguer de `documents`, qui
 * archive ce qu'elle reçoit.
 *
 * Chaque type a ses propres champs (une attestation de mariage n'a rien en commun
 * avec une attestation de don). Plutôt que 20 colonnes nullables, les champs
 * spécifiques vivent dans `data`, et chaque type déclare ici les siens : le
 * formulaire et le document imprimé se construisent tous deux à partir de cette
 * déclaration, ce qui évite qu'ils divergent.
 */

export const attestationTypeSchema = z.enum([
  "mariage",
  "adhesion",
  "don",
  "residence",
  "bonne_moralite",
  "autre",
]);
export type AttestationType = z.infer<typeof attestationTypeSchema>;

export type AttestationField = {
  key: string;
  label: string;
  /** `date` rend un sélecteur de date, `long` une zone de texte. */
  kind?: "text" | "date" | "long";
  required?: boolean;
};

export type AttestationTemplate = {
  label: string;
  /** Titre porté sur le document imprimé. */
  title: string;
  /** Intitulé du champ « sujet » selon le type. */
  subjectLabel: string;
  fields: AttestationField[];
  /** Corps du document. `{{clé}}` est remplacé par la valeur correspondante. */
  body: string;
};

export const ATTESTATION_TEMPLATES: Record<AttestationType, AttestationTemplate> = {
  mariage: {
    label: "Attestation de mariage",
    title: "Attestation de mariage religieux",
    subjectLabel: "Époux",
    fields: [
      { key: "epouse", label: "Épouse", required: true },
      { key: "date_mariage", label: "Date du mariage", kind: "date", required: true },
      { key: "lieu", label: "Lieu de célébration" },
      { key: "tuteur", label: "Tuteur (wali)" },
      { key: "temoin1", label: "Premier témoin" },
      { key: "temoin2", label: "Second témoin" },
      { key: "dot", label: "Dot (mahr)" },
    ],
    body:
      "Nous soussignés, attestons que le mariage religieux (Nikah) entre {{subject}} et {{epouse}} " +
      "a été célébré le {{date_mariage}}{{#lieu}} à {{lieu}}{{/lieu}}, en présence du tuteur {{tuteur}} " +
      "et des témoins {{temoin1}} et {{temoin2}}.\n\n" +
      "La présente attestation est délivrée à l'intéressé pour servir et valoir ce que de droit.",
  },
  adhesion: {
    label: "Attestation d'adhésion",
    title: "Attestation d'adhésion",
    subjectLabel: "Fidèle",
    fields: [
      { key: "depuis", label: "Membre depuis", kind: "date" },
      { key: "qualite", label: "Qualité (membre actif, bienfaiteur…)" },
    ],
    body:
      "Nous attestons que {{subject}} est membre de notre communauté{{#depuis}} depuis le {{depuis}}{{/depuis}}" +
      "{{#qualite}}, en qualité de {{qualite}}{{/qualite}}.\n\n" +
      "La présente attestation est délivrée pour servir et valoir ce que de droit.",
  },
  don: {
    label: "Attestation de don",
    title: "Attestation de don",
    subjectLabel: "Donateur",
    fields: [
      { key: "montant", label: "Montant (FCFA)", required: true },
      { key: "objet", label: "Objet du don" },
      { key: "date_don", label: "Date du don", kind: "date" },
    ],
    body:
      "Nous attestons avoir reçu de {{subject}} la somme de {{montant}} FCFA" +
      "{{#objet}} au titre de : {{objet}}{{/objet}}{{#date_don}}, le {{date_don}}{{/date_don}}.\n\n" +
      "Nous lui exprimons notre gratitude et prions Allah de l'en récompenser.",
  },
  residence: {
    label: "Attestation de résidence",
    title: "Attestation de résidence",
    subjectLabel: "Intéressé",
    fields: [
      { key: "quartier", label: "Quartier", required: true },
      { key: "depuis", label: "Réside depuis", kind: "date" },
    ],
    body:
      "Nous attestons que {{subject}} réside au quartier {{quartier}}" +
      "{{#depuis}} depuis le {{depuis}}{{/depuis}}, et fréquente régulièrement notre mosquée.\n\n" +
      "La présente attestation est délivrée pour servir et valoir ce que de droit.",
  },
  bonne_moralite: {
    label: "Attestation de bonne moralité",
    title: "Attestation de bonne moralité",
    subjectLabel: "Intéressé",
    fields: [{ key: "connu_depuis", label: "Connu de la mosquée depuis", kind: "date" }],
    body:
      "Nous attestons que {{subject}} est connu de notre communauté" +
      "{{#connu_depuis}} depuis le {{connu_depuis}}{{/connu_depuis}} et que sa conduite " +
      "n'a jamais appelé de remarque de notre part.\n\n" +
      "La présente attestation est délivrée pour servir et valoir ce que de droit.",
  },
  autre: {
    label: "Attestation libre",
    title: "Attestation",
    subjectLabel: "Intéressé",
    fields: [{ key: "texte", label: "Contenu de l'attestation", kind: "long", required: true }],
    body: "{{texte}}",
  },
};

export const createAttestationSchema = z.object({
  type: attestationTypeSchema,
  subject: z.string().min(2, "Nom trop court").max(160),
  member_id: z.string().uuid().nullable().default(null),
  data: z.record(z.string()).default({}),
  issued_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ"),
});
export type CreateAttestation = z.infer<typeof createAttestationSchema>;

/**
 * Compose le texte final.
 *
 * Deux syntaxes seulement, volontairement minimalistes :
 *   - `{{clé}}` — remplacement direct ;
 *   - `{{#clé}}…{{/clé}}` — section conservée uniquement si la valeur est renseignée,
 *     ce qui évite les « à  » et « depuis le  » disgracieux quand un champ est vide.
 */
export function renderAttestation(
  template: AttestationTemplate,
  subject: string,
  data: Record<string, string>,
): string {
  const values: Record<string, string> = { ...data, subject };

  // Sections conditionnelles d'abord : elles peuvent contenir des remplacements.
  let out = template.body.replace(
    /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
    (_match, key: string, content: string) =>
      values[key] && values[key].trim() !== "" ? content : "",
  );

  out = out.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => values[key]?.trim() || "…");

  // Espaces doubles laissés par une section retirée.
  return out.replace(/ {2,}/g, " ").trim();
}

/** `12 avril 2026` — les dates se lisent en toutes lettres sur un document officiel. */
export function formatOfficialDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(d);
}
