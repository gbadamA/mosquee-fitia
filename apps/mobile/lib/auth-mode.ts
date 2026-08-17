/**
 * MODE DE CONNEXION DES FIDÈLES — INTERRUPTEUR UNIQUE
 *
 * `OTP_ENABLED = true` : parcours normal. Le fidèle saisit son numéro, reçoit un
 * code par SMS, puis le saisit sur l'écran de vérification. C'est le seul mode
 * acceptable pour une version distribuée aux fidèles.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * L'INVERSE (`false`) DÉSACTIVE LA VÉRIFICATION PAR SMS et ouvre une session à
 * partir du seul numéro, via l'Edge Function `dev-login`. C'est un
 * CONTOURNEMENT DE DÉVELOPPEMENT : n'importe qui connaissant un numéro peut
 * alors se faire passer pour son propriétaire. À ne remettre à `false` que
 * temporairement, et jamais dans une version livrée.
 *
 * Basculer cette constante suffit : l'écran de connexion, l'écran de
 * vérification et le bandeau d'avertissement s'adaptent automatiquement.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Filet de sécurité côté serveur : `dev-login` refuse de s'exécuter si la pile
 * Supabase n'est pas locale. Même livrée par erreur avec ce drapeau à `false`,
 * l'application ne pourrait pas contourner l'OTP en production.
 *
 * ⚠️ En production, l'envoi réel des SMS suppose un fournisseur configuré :
 * Supabase Cloud → Authentication → Providers → Phone (Twilio, Vonage…).
 * Sans lui, « Recevoir le code » échouera pour tout numéro absent de
 * `[auth.sms.test_otp]` (en local : `+22507000000`, code `123456`).
 */
export const OTP_ENABLED = true;

/** Texte du bandeau affiché tant que l'OTP est désactivé. */
export const OTP_DISABLED_NOTICE =
  "Connexion sans code — mode développement. La vérification par SMS est désactivée.";
