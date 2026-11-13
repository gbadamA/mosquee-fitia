/**
 * Changement de son propre mot de passe — même règle sur le tableau de bord et
 * sur l'application des fidèles.
 *
 * Supabase accepte `updateUser({ password })` sans demander l'ancien : un
 * téléphone laissé déverrouillé suffirait à s'approprier le compte. On vérifie
 * donc d'abord le mot de passe ACTUEL en se reconnectant avec lui.
 *
 * Le client est décrit par sa seule forme utile, pour que ce paquet n'ait pas à
 * dépendre de supabase-js.
 */

export const PASSWORD_MIN_LENGTH = 8;

type AuthLike = {
  auth: {
    getUser(): Promise<{ data: { user: { email?: string | null } | null } }>;
    signInWithPassword(c: { email: string; password: string }): Promise<{ error: { message: string } | null }>;
    updateUser(a: { password: string }): Promise<{ error: { message: string } | null }>;
  };
};

/** Motif lisible si la saisie est refusée avant tout appel, sinon `null`. */
export function checkNewPassword(current: string, next: string, confirmation: string): string | null {
  if (!current) return "Saisissez votre mot de passe actuel.";
  if (next.length < PASSWORD_MIN_LENGTH) {
    return `Le nouveau mot de passe doit faire au moins ${PASSWORD_MIN_LENGTH} caractères.`;
  }
  if (next === current) return "Le nouveau mot de passe doit être différent de l'actuel.";
  if (next !== confirmation) return "Les deux saisies du nouveau mot de passe ne correspondent pas.";
  return null;
}

/** Renvoie `null` en cas de succès, sinon un message en français. */
export async function changeOwnPassword(
  client: AuthLike,
  current: string,
  next: string,
  confirmation: string,
): Promise<string | null> {
  const refus = checkNewPassword(current, next, confirmation);
  if (refus) return refus;

  const { data } = await client.auth.getUser();
  // Pour un fidèle, c'est l'identifiant interne dérivé du numéro
  // (`225…@fitia.invalid`) : il ne le voit jamais, mais c'est lui qu'Auth connaît.
  const email = data.user?.email;
  if (!email) return "Session expirée : reconnectez-vous.";

  const verification = await client.auth.signInWithPassword({ email, password: current });
  if (verification.error) return "Mot de passe actuel incorrect.";

  const { error } = await client.auth.updateUser({ password: next });
  if (error) {
    return /should be different/i.test(error.message)
      ? "Le nouveau mot de passe doit être différent de l'actuel."
      : `Changement refusé : ${error.message}`;
  }
  return null;
}
