/**
 * Vérifie le circuit de connexion « numéro + mot de passe » de bout en bout,
 * contre la vraie base locale — pas de simulacre.
 *
 *   1. Le secrétaire crée un fidèle       → un mot de passe est renvoyé
 *   2. Le fidèle se connecte avec         → session ouverte
 *      (par le helper PARTAGÉ `phoneToAuthEmail`, alors que la création est
 *       passée par la COPIE de l'Edge Function : toute divergence casse ici)
 *   3. Un mauvais mot de passe            → refusé
 *   4. Le secrétaire réémet un mot de passe → l'ANCIEN doit cesser de marcher
 *   5. Un fidèle ne peut pas en créer un autre (contrôle de rôle serveur)
 *
 * Lancement : node scripts-verif/auth-password-check.mjs
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const URL = "http://127.0.0.1:54131";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const client = () => createClient(URL, ANON);
const results = [];
const check = (label, ok, detail = "") => {
  results.push({ label, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
};

/**
 * La règle de dérivation de l'identifiant, écrite ici une troisième fois.
 *
 * On ne peut pas importer `packages/shared` : Node ne résout pas les imports TS
 * sans extension, et le lien `@fitia/shared` n'existe que dans `apps/*`. Cette
 * troisième copie n'est donc pas une négligence — c'est ce qui rend le contrôle
 * de concordance ci-dessous possible et utile.
 */
function phoneToAuthEmail(phone) {
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.startsWith("225") ? digits : `225${digits}`;
  return `${normalized}@${DOMAIN}`;
}
const DOMAIN = "fitia.invalid";

// Contrôle de concordance : les trois définitions doivent porter le MÊME domaine.
// Si elles divergent, un fidèle est créé sous un identifiant que l'écran de
// connexion ne sait pas reconstruire — il ne peut plus jamais entrer, et aucun
// message d'erreur ne dit pourquoi.
{
  const sources = {
    "packages/shared/src/profile.ts": "packages/shared/src/profile.ts",
    "supabase/functions/create-member": "supabase/functions/create-member/index.ts",
  };
  const domains = Object.entries(sources).map(([label, file]) => {
    // ⚠️ Pas de `new URL(...)` ici : la constante `URL` ci-dessus masque le
    // constructeur global. On résout depuis la racine du dépôt.
    const text = fs.readFileSync(path.join(ROOT, file), "utf8");
    const found = text.match(/AUTH_EMAIL_DOMAIN\s*=\s*"([^"]+)"/);
    return [label, found?.[1]];
  });
  const allAgree = domains.every(([, d]) => d === DOMAIN);
  check(
    "le domaine d'identifiant est identique dans les 3 définitions",
    allAgree,
    domains.map(([l, d]) => `${l}=${d}`).join("  ") + `  script=${DOMAIN}`,
  );
}

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
// Même piège que côté dashboard : `.message` est toujours le texte générique
// « non-2xx status code ». Le motif réel n'est que dans `error.context`.
const createDetail = createErr?.context
  ? `HTTP ${createErr.context.status} — ${JSON.stringify(
      await createErr.context.json().catch(() => createErr.context.text().catch(() => null)),
    )}`
  : createErr?.message;
const password = created?.password;
check(
  "création d'un fidèle → mot de passe renvoyé une fois",
  Boolean(password) && !createErr,
  createDetail ?? (password ? `8 caractères : ${password.length === 8}` : "aucun mot de passe"),
);
if (!password) process.exit(1);

check(
  "alphabet sans caractères ambigus (0/O, 1/I/l)",
  /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/.test(password),
  password,
);

// 2. Le fidèle se connecte.
const fidele = client();
const authEmail = phoneToAuthEmail(phone);
const { data: session, error: signErr } = await fidele.auth.signInWithPassword({
  email: authEmail,
  password,
});
check(
  "le fidèle se connecte avec numéro + mot de passe",
  Boolean(session?.session) && !signErr,
  signErr?.message ?? "",
);

// 3. Mauvais mot de passe refusé.
const intrus = client();
const { data: bad } = await intrus.auth.signInWithPassword({
  email: authEmail,
  password: "MAUVAIS99",
});
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
const { data: ancien } = await apresReset.auth.signInWithPassword({ email: authEmail, password });
check("l'ANCIEN mot de passe ne fonctionne plus", !ancien?.session);

const { data: neuf } = await client().auth.signInWithPassword({ email: authEmail, password: nouveau });
check("le NOUVEAU mot de passe fonctionne", Boolean(neuf?.session));

check(
  "le profil garde le VRAI numéro (pas l'identifiant interne)",
  created?.profile?.phone === phone && !created?.profile?.email,
  `phone=${created?.profile?.phone} email=${JSON.stringify(created?.profile?.email)}`,
);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} vérifications passées`);
process.exit(failed.length ? 1 : 0);
