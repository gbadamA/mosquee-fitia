/**
 * Edge Function `send-push` — notification distante vers les fidèles.
 *
 * Appelée par le dashboard : à la diffusion d'une annonce, et depuis l'écran
 * Communication (relance de cotisation, rappel d'événement…).
 *
 * ⚠️ Les push DISTANTES ne fonctionnent plus dans Expo Go depuis Android SDK 53+ :
 * il faut un build EAS pour les recevoir. Les rappels de prière et d'événement,
 * eux, sont des notifications LOCALES planifiées côté app — elles fonctionnent
 * partout, y compris hors connexion.
 *
 * Corps accepté :
 *   { title: string, body?: string, member_ids?: string[] }
 * Sans `member_ids`, le message part à tous les profils porteurs d'un jeton.
 *
 * Déploiement : `supabase functions deploy send-push`
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BATCH_SIZE = 100; // limite de l'API Expo

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  const { title, body, member_ids } = (await req.json()) as {
    title?: string;
    body?: string;
    member_ids?: string[];
  };

  if (!title) return json({ error: "title requis" }, 400);

  // service_role : nécessaire pour lire les jetons de tous les fidèles.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  let query = supabase.from("profiles").select("push_token").not("push_token", "is", null);
  if (Array.isArray(member_ids) && member_ids.length > 0) {
    query = query.in("id", member_ids);
  }

  const { data, error } = await query;
  if (error) return json({ error: error.message }, 500);

  const tokens = (data ?? [])
    .map((r: { push_token: string | null }) => r.push_token)
    .filter((t): t is string => Boolean(t));

  if (tokens.length === 0) {
    // Cas normal tant qu'aucun build EAS n'est installé : on le dit explicitement
    // plutôt que de laisser croire à un envoi réussi.
    return json({ sent: 0, targeted: member_ids?.length ?? null, reason: "aucun jeton enregistré" });
  }

  let sent = 0;
  const failures: string[] = [];

  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE).map((to) => ({
      to,
      title,
      body: body ?? "",
      sound: "default",
      channelId: "annonces",
    }));

    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(batch),
      });
      if (res.ok) {
        // Expo répond 200 même quand certains jetons sont invalides : on lit les tickets.
        const payload = (await res.json()) as { data?: { status: string; message?: string }[] };
        for (const ticket of payload.data ?? []) {
          if (ticket.status === "ok") sent += 1;
          else if (ticket.message) failures.push(ticket.message);
        }
      } else {
        failures.push(`HTTP ${res.status}`);
      }
    } catch (e) {
      failures.push(e instanceof Error ? e.message : "échec réseau");
    }
  }

  return json({ sent, tokens: tokens.length, failures: failures.slice(0, 5) });
});
