import { z } from "zod";

/**
 * Diffusion vers les fidèles — trois canaux, trois natures très différentes :
 *
 * - **push** : notification dans l'app. Passe par l'Edge Function `send-push`.
 *   ⚠️ Nécessite un build EAS pour être reçue (Expo Go ne reçoit plus les push
 *   distantes sur Android depuis le SDK 53).
 * - **whatsapp** : canal roi en Côte d'Ivoire, mais l'API WhatsApp Business exige
 *   un compte marchand que la mosquée n'a pas. On génère donc des liens `wa.me`
 *   pré-remplis, un par destinataire : zéro contrat, utilisable tout de suite.
 * - **sms** : idem, via des liens `sms:` et l'export des numéros.
 *
 * Le port `BulkMessenger` en bas fige le contrat pour brancher un vrai
 * fournisseur (Twilio, WhatsApp Business API) sans réécrire l'interface.
 */

export const messageChannelSchema = z.enum(["push", "whatsapp", "sms"]);
export type MessageChannel = z.infer<typeof messageChannelSchema>;

export const CHANNEL_LABELS: Record<MessageChannel, string> = {
  push: "Notification",
  whatsapp: "WhatsApp",
  sms: "SMS",
};

export const messageAudienceSchema = z.enum(["tous", "retardataires", "evenement"]);
export type MessageAudience = z.infer<typeof messageAudienceSchema>;

export const AUDIENCE_LABELS: Record<MessageAudience, string> = {
  tous: "Tous les fidèles",
  retardataires: "Cotisations en retard",
  evenement: "Inscrits à un événement",
};

export const sendMessageSchema = z.object({
  title: z.string().min(3, "Titre trop court").max(140),
  body: z.string().min(1, "Message vide").max(2000),
  channel: messageChannelSchema,
  audience: messageAudienceSchema.default("tous"),
  event_id: z.string().uuid().nullable().default(null),
});
export type SendMessage = z.infer<typeof sendMessageSchema>;

/* ------------------------------- Modèles prêts ---------------------------- */

/** Messages types — la relance de cotisation est le cas d'usage le plus fréquent. */
export const MESSAGE_TEMPLATES: {
  key: string;
  label: string;
  audience: MessageAudience;
  title: string;
  body: string;
}[] = [
  {
    key: "cotisation",
    label: "Relance de cotisation",
    audience: "retardataires",
    title: "Rappel de cotisation",
    body: "As-salâmu ʿalaykum. Votre cotisation du mois n'a pas encore été enregistrée. Vous pouvez la régler à la mosquée ou depuis l'application. Qu'Allah vous récompense.",
  },
  {
    key: "evenement",
    label: "Rappel d'événement",
    audience: "evenement",
    title: "Rappel — événement à venir",
    body: "As-salâmu ʿalaykum. Nous vous rappelons votre inscription à l'événement. Merci d'arriver quelques minutes en avance.",
  },
  {
    key: "collecte",
    label: "Appel à la collecte",
    audience: "tous",
    title: "Appel à la générosité",
    body: "As-salâmu ʿalaykum. La mosquée lance une collecte. Chaque contribution compte, même modeste. Qu'Allah accepte de vous.",
  },
];

/* --------------------------------- Liens ---------------------------------- */

/**
 * Lien WhatsApp pré-rempli.
 * ⚠️ `wa.me` exige le numéro SANS « + », espaces ni tirets.
 */
export function whatsappLink(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/** Lien SMS pré-rempli. Le séparateur `?body=` fonctionne sur Android et iOS récents. */
export function smsLink(phone: string, message: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  return `sms:${digits}?body=${encodeURIComponent(message)}`;
}

/** Assemble titre + corps en un message texte unique pour WhatsApp / SMS. */
export function composeText(title: string, body: string): string {
  return `${title}\n\n${body}`;
}

/* ---------------------------------- Port ---------------------------------- */

/**
 * Contrat d'un fournisseur d'envoi en masse — **non implémenté en V1**.
 * L'implémentation courante est « assistée » : on ouvre WhatsApp/SMS pré-rempli,
 * destinataire par destinataire. Brancher Twilio ou WhatsApp Business API
 * reviendra à fournir un adaptateur respectant ce port.
 */
export type BulkMessenger = {
  readonly channel: MessageChannel;
  send(input: {
    recipients: { phone: string; name?: string }[];
    title: string;
    body: string;
  }): Promise<{ accepted: number; failed: number }>;
};
