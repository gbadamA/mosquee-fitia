/**
 * ⚠️⚠️ CONNEXION SANS CODE — CONTOURNEMENT DE DÉVELOPPEMENT ⚠️⚠️
 *
 * Cette fonction ouvre une session à partir d'un simple numéro de téléphone,
 * SANS vérification par SMS. C'est, littéralement, une porte dérobée : quiconque
 * connaît un numéro peut se faire passer pour son propriétaire.
 *
 * Elle existe uniquement pour ne pas ralentir les tests sur émulateur, à la
 * demande explicite du porteur du projet, et de façon TEMPORAIRE.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * GARDE-FOU : elle refuse de s'exécuter si `SUPABASE_URL` n'est pas une adresse
 * LOCALE. En production, l'URL est `https://<ref>.supabase.co` → la fonction
 * répond 403 et ne peut rien faire. Le garde-fou est donc auto-appliqué : même
 * déployée par mégarde, elle reste inerte.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * POUR RÉTABLIR L'OTP : passer `OTP_ENABLED` à `true` dans
 * `apps/mobile/lib/auth-mode.ts`. Cette fonction peut alors être supprimée.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

/** Vrai uniquement pour une pile Supabase locale. */
function isLocalStack(url: string): boolean {
  return (
    url.includes("127.0.0.1") ||
    url.includes("localhost") ||
    url.includes("kong:") ||
    url.includes("host.docker.internal")
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  const url = Deno.env.get("SUPABASE_URL") ?? "";

  if (!isLocalStack(url)) {
    console.warn("[dev-login] refus : instance non locale", url);
    return json(
      { error: "Connexion sans code indisponible : cette instance n'est pas locale." },
      403,
    );
  }

  const { phone } = (await req.json()) as { phone?: string };
  if (!phone || !/^\+\d{8,15}$/.test(phone)) {
    return json({ error: "Numéro invalide (format attendu : +225XXXXXXXXXX)." }, 400);
  }

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Mot de passe éphémère : régénéré à CHAQUE connexion, jamais réutilisable.
  const password = `dev-${crypto.randomUUID()}`;

  // L'API admin ne permet pas de chercher par téléphone : on pagine.
  let existingId: string | null = null;
  for (let page = 1; page <= 10 && !existingId; page += 1) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (!data || data.users.length === 0) break;
    const found = data.users.find((u) => u.phone === phone.replace("+", ""));
    if (found) existingId = found.id;
    if (data.users.length < 200) break;
  }

  if (existingId) {
    const { error } = await admin.auth.admin.updateUserById(existingId, { password });
    if (error) return json({ error: error.message }, 400);
    return json({ password, created: false });
  }

  const { error } = await admin.auth.admin.createUser({
    phone,
    password,
    phone_confirm: true,
  });
  if (error) return json({ error: error.message }, 400);

  return json({ password, created: true });
});
