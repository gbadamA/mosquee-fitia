/**
 * Vérifie le circuit de connexion « numéro + mot de passe » de bout en bout,
 * contre la vraie base locale — pas de simulacre.
 *
 *   1. Le secrétaire crée un fidèle       → un mot de passe est renvoyé
 *   2. Le fidèle se connecte avec         → session ouverte
 *   3. Un mauvais mot de passe            → refusé
 *   4. Le secrétaire réémet un mot de passe → l'ANCIEN doit cesser de marcher
 *   5. Un fidèle ne peut pas en créer un autre (contrôle de rôle serveur)
 *
 * Lancement : node scripts-verif/auth-password-check.mjs
 */
import { createClient } from "@supabase/supabase-js";

const URL = "http://127.0.0.1:54131";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const client = () => createClient(URL, ANON);
const results = [];
const check = (label, ok, detail = "") => {
  results.push({ label, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
};

// Numéro unique : le script doit pouvoir être relancé sans nettoyage manuel.
const phone = `+2250700${String(Date.now()).slice(-6)}`;

// 1. Le secrétaire crée un fidèle.
const secretaire = client();
const { error: loginErr } = await secretaire.auth.signInWithPassword({
  email: "secretaire@fitia.ci",
  password: "fitia1234",
});
if (loginErr) {
  console.error("Connexion secrétaire impossible :", loginErr.message);
  console.error("Lancer d'abord : node scripts-verif/seed-accounts.mjs");
  process.exit(1);
}

const { data: created, error: createErr } = await secretaire.functions.invoke("create-member", {
  body: { kind: "fidele", full_name: "Fidèle Vérification", phone, quartier: "Abobo" },
});
const password = created?.password;
check(
  "création d'un fidèle → mot de passe renvoyé une fois",
  Boolean(password) && !createErr,
  createErr?.message ?? (password ? `8 caractères : ${password.length === 8}` : "aucun mot de passe"),
);
if (!password) process.exit(1);

check(
  "alphabet sans caractères ambigus (0/O, 1/I/l)",
  /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/.test(password),
  password,
);

// 2. Le fidèle se connecte.
const fidele = client();
const { data: session, error: signErr } = await fidele.auth.signInWithPassword({ phone, password });
check(
  "le fidèle se connecte avec numéro + mot de passe",
  Boolean(session?.session) && !signErr,
  signErr?.message ?? "",
);

// 3. Mauvais mot de passe refusé.
const intrus = client();
const { data: bad } = await intrus.auth.signInWithPassword({ phone, password: "MAUVAIS99" });
check("un mauvais mot de passe est refusé", !bad?.session);

// 5. Un fidèle ne peut pas créer de membre (avant réémission, sa session est valide).
//
// ⚠️ Sur un statut non-2xx, `functions.invoke` renvoie l'échec dans `error`
// (FunctionsHttpError) et laisse `data` à null : lire seulement `data.error`
// ferait passer un refus pour un succès. On lit le corps de la réponse HTTP.
const { data: escalade, error: escaladeErr } = await fidele.functions.invoke("create-member", {
  body: { kind: "fidele", full_name: "Tentative Escalade", phone: "+22507999999" },
});
const refusBody = escaladeErr?.context ? await escaladeErr.context.json().catch(() => null) : null;
check(
  "un fidèle ne peut PAS créer de membre (rôle revérifié côté serveur)",
  escaladeErr?.context?.status === 403 && refusBody?.error === "Droits insuffisants",
  escaladeErr
    ? `HTTP ${escaladeErr.context?.status} — ${refusBody?.error ?? escaladeErr.message}`
    : `aucune erreur, profil créé : ${JSON.stringify(escalade)} — FAILLE`,
);

// 4. Réémission : l'ancien mot de passe doit mourir.
const memberId = created?.profile?.id;
const { data: reset } = await secretaire.functions.invoke("create-member", {
  body: { kind: "reset_password", member_id: memberId },
});
const nouveau = reset?.password;
check("réémission d'un mot de passe", Boolean(nouveau) && nouveau !== password, reset?.error ?? "");

const apresReset = client();
const { data: ancien } = await apresReset.auth.signInWithPassword({ phone, password });
check("l'ANCIEN mot de passe ne fonctionne plus", !ancien?.session);

const { data: neuf } = await client().auth.signInWithPassword({ phone, password: nouveau });
check("le NOUVEAU mot de passe fonctionne", Boolean(neuf?.session));

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} vérifications passées`);
process.exit(failed.length ? 1 : 0);
