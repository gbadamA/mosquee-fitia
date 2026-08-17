/**
 * Edge Function `create-member` — création d'un fidèle ou d'un compte du bureau.
 *
 * Pourquoi une fonction serveur : `public.profiles.id` référence `auth.users(id)`.
 * Un profil ne peut donc pas exister sans utilisateur d'authentification, et créer
 * un utilisateur exige la clé `service_role` — qui ne doit JAMAIS atteindre le navigateur.
 *
 * Le rôle de l'appelant est **revérifié côté serveur** : ne jamais faire confiance au
 * client, même si le dashboard cache déjà le bouton aux rôles non autorisés.
 *   - fidèle       → secrétaire, imam, admin
 *   - compte staff → imam, admin uniquement
 *
 * Déploiement : `supabase functions deploy create-member`
 * En local, `supabase start` sert automatiquement les fonctions de `supabase/functions/`.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Payload = {
  /** `reset_password` redonne un mot de passe à un fidèle déjà enregistré. */
  kind: "fidele" | "staff" | "reset_password";
  full_name?: string;
  /** Fidèle : requis, format +225XXXXXXXXXX. */
  phone?: string;
  quartier?: string | null;
  category?: "membre_actif" | "bienfaiteur" | "staff";
  /** Staff : requis. */
  email?: string;
  password?: string;
  role?: "secretaire" | "tresorier" | "imam" | "admin";
  /** `reset_password` : le fidèle concerné. */
  member_id?: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

/**
 * Mot de passe court, lisible à voix haute et sans ambiguïté.
 *
 * L'alphabet exclut volontairement `0/O` et `1/I/l` : ce mot de passe sera dicté
 * ou recopié à la main par des fidèles, souvent peu à l'aise avec l'écrit. Un
 * caractère confondu, c'est un fidèle qui n'entre pas et rappelle la mosquée.
 */
function makePassword(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Non authentifié" }, 401);

  // 1. Qui appelle ? (client porteur du JWT de l'appelant)
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) return json({ error: "Session invalide" }, 401);

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: callerProfile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  const callerRole = callerProfile?.role as string | undefined;
  if (!callerRole) return json({ error: "Profil introuvable" }, 403);

  // 2. Vérification du droit, côté serveur.
  const payload = (await req.json()) as Payload;
  const allowed =
    payload.kind === "staff"
      ? ["imam", "admin"]
      : ["secretaire", "imam", "admin"];
  if (!allowed.includes(callerRole)) {
    return json({ error: "Droits insuffisants" }, 403);
  }

  // Réattribution d'un mot de passe à un fidèle existant. Nécessaire pour tous
  // ceux enregistrés avant le passage au mot de passe : sans ça, ils resteraient
  // définitivement enfermés dehors.
  if (payload.kind === "reset_password") {
    if (!payload.member_id) return json({ error: "Fidèle non précisé" }, 400);

    const password = makePassword();
    const { error: resetError } = await admin.auth.admin.updateUserById(payload.member_id, {
      password,
    });
    if (resetError) return json({ error: resetError.message }, 400);
    return json({ password });
  }

  if (!payload.full_name || payload.full_name.trim().length < 3) {
    return json({ error: "Nom trop court" }, 400);
  }

  // 3. Création de l'utilisateur. Le trigger `handle_new_user` crée le profil.
  //
  // ⚠️ Le fidèle reçoit un MOT DE PASSE, pas un code SMS. La mosquée n'a pas de
  // fournisseur SMS : sans mot de passe, personne ne pourrait se connecter.
  // `phone_confirm: true` marque le numéro comme vérifié — c'est le secrétaire
  // qui l'a saisi en face du fidèle, la vérification a eu lieu physiquement.
  //
  // Généré ici plutôt que saisi : un mot de passe choisi par le secrétaire pour
  // des dizaines de fidèles finirait invariablement identique pour tous.
  const generatedPassword =
    payload.kind === "fidele" ? payload.password || makePassword() : undefined;

  const createArgs =
    payload.kind === "staff"
      ? {
          email: payload.email,
          password: payload.password,
          email_confirm: true,
          user_metadata: { full_name: payload.full_name },
        }
      : {
          phone: payload.phone,
          password: generatedPassword,
          phone_confirm: true,
          user_metadata: { full_name: payload.full_name },
        };

  if (payload.kind === "staff" && (!payload.email || !payload.password)) {
    return json({ error: "Email et mot de passe requis" }, 400);
  }
  if (payload.kind === "fidele" && !payload.phone) {
    return json({ error: "Numéro de téléphone requis" }, 400);
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser(createArgs);
  if (createError || !created.user) {
    return json({ error: createError?.message ?? "Création impossible" }, 400);
  }

  // 4. Complément du profil (le trigger n'a posé que le nom et les identifiants).
  const patch =
    payload.kind === "staff"
      ? { role: payload.role ?? "secretaire", status: "actif", category: "staff" }
      : {
          quartier: payload.quartier ?? null,
          category: payload.category ?? "membre_actif",
          status: "en_attente",
        };

  const { error: patchError } = await admin.from("profiles").update(patch).eq("id", created.user.id);
  if (patchError) return json({ error: patchError.message }, 400);

  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", created.user.id)
    .single();

  // Le mot de passe n'est renvoyé QU'ICI, une seule fois : Supabase ne le stocke
  // que haché, il sera irrécupérable ensuite. Le secrétaire doit le noter et le
  // remettre au fidèle — l'écran Fidèles l'affiche en conséquence.
  return json({ profile, password: generatedPassword });
});
