#!/usr/bin/env node
/**
 * Désactivation d'un membre et changement de son propre mot de passe — contre la
 * stack LOCALE (les comptes de seed-accounts.mjs doivent exister).
 *
 *   node scripts-verif/access-password-check.mjs
 *
 * Crée un fidèle jetable par `create-member`, puis prouve :
 *  - qu'un fidèle désactivé ne peut PLUS se connecter, et qu'il le peut de
 *    nouveau une fois réactivé ;
 *  - qu'un secrétaire ne peut pas désactiver l'imam ni se désactiver lui-même ;
 *  - que le changement de mot de passe exige l'ancien, et que le nouveau marche.
 * Le fidèle jetable est supprimé à la fin.
 */
const BASE = process.env.SUPABASE_URL ?? "http://127.0.0.1:54131";
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STAFF_PASSWORD = process.env.SEED_PASSWORD ?? "fitia1234";
if (!ANON || !SERVICE) {
  console.error("SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY requis (npx supabase status -o env).");
  process.exit(1);
}
if (!/127\.0\.0\.1|localhost/.test(BASE)) {
  console.error("Refus : ce script crée et supprime des comptes, il ne tourne que sur la stack locale.");
  process.exit(1);
}

let passed = 0;
let failed = 0;
const check = (label, ok, detail = "") => {
  ok ? passed++ : failed++;
  console.log(`  ${ok ? "✔" : "✘"} ${label}${!ok && detail ? ` — ${detail}` : ""}`);
};

async function login(email, password) {
  const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, token: body.access_token, user: body.user, body };
}

async function edge(token, body) {
  const r = await fetch(`${BASE}/functions/v1/create-member`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

async function asUser(token, path, init = {}) {
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: { apikey: ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

// Même dérivation que `phoneToAuthEmail` (paquet partagé et Edge Function).
const authEmail = (phone) => `${phone.replace(/\D/g, "")}@fitia.invalid`;

const imam = await login("imam@fitia.ci", STAFF_PASSWORD);
const secretaire = await login("secretaire@fitia.ci", STAFF_PASSWORD);
if (!imam.ok || !secretaire.ok) {
  console.error("Comptes du bureau introuvables : lancez d'abord seed-accounts.mjs.");
  process.exit(1);
}

console.log("Désactivation d'un membre");
const phone = `+22507${String(Date.now()).slice(-8)}`;
const created = await edge(secretaire.token, { kind: "fidele", full_name: "Fidèle Jetable", phone });
const memberId = created.body.profile?.id;
const initial = created.body.password;
check("fidèle jetable créé", created.status === 200 && memberId && initial, JSON.stringify(created.body));
check("il se connecte", (await login(authEmail(phone), initial)).ok);

const off = await edge(secretaire.token, { kind: "set_access", member_id: memberId, active: false });
check("le secrétaire le désactive", off.status === 200 && off.body.active === false, JSON.stringify(off.body));
const blocked = await login(authEmail(phone), initial);
check("désactivé : connexion refusée", !blocked.ok, `${blocked.status}`);
// Auth révèle la suspension même avec un faux mot de passe : c'est pourquoi les
// écrans de connexion n'affichent qu'UN message (LOGIN_FAILED_MESSAGE). Si ce
// contrôle échoue un jour, Auth a changé — le message unique reste correct.
const wrongWhileBanned = await login(authEmail(phone), "faux-mot-de-passe");
check("désactivé + faux mot de passe : refusé aussi", !wrongWhileBanned.ok, JSON.stringify(wrongWhileBanned.body));
const svc = await fetch(`${BASE}/rest/v1/profiles?id=eq.${memberId}&select=status`, {
  headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
}).then((r) => r.json());
check("statut passé à « inactif »", svc[0]?.status === "inactif", JSON.stringify(svc));

const on = await edge(secretaire.token, { kind: "set_access", member_id: memberId, active: true });
check("réactivation", on.status === 200 && on.body.active === true);
check("réactivé : il se reconnecte", (await login(authEmail(phone), initial)).ok);

const imamProfile = await asUser(imam.token, `/rest/v1/profiles?id=eq.${imam.user.id}&select=id`).then((r) => r.json());
const vsImam = await edge(secretaire.token, { kind: "set_access", member_id: imamProfile[0]?.id, active: false });
check("un secrétaire ne désactive pas l'imam (403)", vsImam.status === 403, `${vsImam.status} ${JSON.stringify(vsImam.body)}`);
const self = await edge(secretaire.token, { kind: "set_access", member_id: secretaire.user.id, active: false });
check("personne ne se désactive lui-même (400)", self.status === 400);
const fideleSession = await login(authEmail(phone), initial);
const byFidele = await edge(fideleSession.token, { kind: "set_access", member_id: memberId, active: false });
check("un fidèle ne désactive personne (403)", byFidele.status === 403);

console.log("\nChangement de son mot de passe (règle du paquet partagé)");
// Rejoue `changeOwnPassword` : vérification de l'ancien PUIS mise à jour.
async function changeOwn(email, current, next) {
  if ((await login(email, current)).ok === false) return "Mot de passe actuel incorrect.";
  const session = await login(email, current);
  const r = await asUser(session.token, "/auth/v1/user", { method: "PUT", body: JSON.stringify({ password: next }) });
  return r.ok ? null : `refus ${r.status}`;
}
check("ancien mot de passe faux : refusé", (await changeOwn(authEmail(phone), "faux-mot-de-passe", "nouveaumdp2026")) !== null);
const nouveau = "nouveau-mdp-2026";
check("bon ancien mot de passe : accepté", (await changeOwn(authEmail(phone), initial, nouveau)) === null);
check("le nouveau (en minuscules) fonctionne", (await login(authEmail(phone), nouveau)).ok);
check("l'ancien ne fonctionne plus", !(await login(authEmail(phone), initial)).ok);

await fetch(`${BASE}/auth/v1/admin/users/${memberId}`, {
  method: "DELETE",
  headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
});

console.log(`\n${passed} vérifications passées · ${failed} échouées`);
process.exitCode = failed ? 1 : 0;
