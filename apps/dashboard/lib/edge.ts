import { getSupabase } from "./supabase";

/**
 * Appelle une Edge Function et remonte le VRAI message d'erreur.
 *
 * POURQUOI CE DÉTOUR. Sur un statut non-2xx, `functions.invoke` de supabase-js
 * laisse `data` à `null` et renvoie un `FunctionsHttpError` dont le `.message`
 * est toujours le même texte générique : « Edge Function returned a non-2xx
 * status code ». Le corps JSON — celui qui contient « Numéro déjà utilisé » ou
 * « Droits insuffisants » — n'est lisible que dans `error.context`, la réponse
 * `fetch` brute.
 *
 * Sans ce détour, le rapport d'import CSV afficherait le même charabia anglais
 * sur chaque ligne rejetée, et le secrétaire n'aurait aucun moyen de savoir
 * laquelle corriger.
 */
export async function invokeEdge<T = unknown>(
  name: string,
  body: Record<string, unknown>,
): Promise<{ data: T | null; error: string | null }> {
  const { data, error } = await getSupabase().functions.invoke(name, { body });

  if (error) {
    // `context` est la Response ; son corps porte le motif exact du refus.
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === "function") {
      const payload = await context.json().catch(() => null);
      const detail = (payload as { error?: string } | null)?.error;
      if (detail) return { data: null, error: detail };
    }
    return { data: null, error: error.message };
  }

  // Une fonction peut aussi répondre 200 en signalant un échec dans le corps.
  const inline = (data as { error?: string } | null)?.error;
  if (inline) return { data: null, error: inline };

  return { data: data as T, error: null };
}
