/**
 * ⚠️ MODE DE CONNEXION DES FIDÈLES — INTERRUPTEUR UNIQUE ⚠️
 *
 * `OTP_ENABLED = false` désactive la vérification par SMS : le fidèle saisit son
 * numéro et entre directement. C'est un CONTOURNEMENT DE DÉVELOPPEMENT, demandé
 * explicitement et de façon temporaire pour accélérer les tests sur émulateur.
 *
 * Ce que ça implique, sans détour : n'importe qui connaissant un numéro peut se
 * faire passer pour son propriétaire. À ne jamais laisser dans une version
 * distribuée aux fidèles.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POUR RÉTABLIR L'OTP : passer la constante ci-dessous à `true`.
 * C'est la SEULE modification nécessaire — l'écran de connexion, l'écran de
 * vérification et le bandeau d'avertissement s'adaptent automatiquement.
 * La fonction `supabase/functions/dev-login` peut alors être supprimée.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Filet de sécurité côté serveur : `dev-login` refuse de s'exécuter si la pile
 * Supabase n'est pas locale. Même livrée par erreur avec ce drapeau à `false`,
 * l'application ne pourra pas contourner l'OTP en production — elle affichera
 * une erreur explicite au lieu d'ouvrir une session.
 */
export const OTP_ENABLED = false;

/** Texte du bandeau affiché tant que l'OTP est désactivé. */
export const OTP_DISABLED_NOTICE =
  "Connexion sans code — mode développement. La vérification par SMS est désactivée.";
