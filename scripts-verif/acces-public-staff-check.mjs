#!/usr/bin/env node
/**
 * Application ouverte à tous + espace staff + consignes — contre la stack LOCALE.
 *
 *   node scripts-verif/acces-public-staff-check.mjs
 *   (SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY : `npx supabase status -o env`)
 *
 * Prouve, par l'API (donc par la RLS et les fonctions, pas par l'écran) :
 *  - un visiteur SANS compte lit horaires, annonces, événements, campagnes,
 *    déclare un don « en attente » mais ne peut ni le valider ni relire les dons,
 *    inscrit son téléphone aux notifications mais ne peut pas en envoyer ;
 *  - un membre du staff de terrain publie annonce / événement / horaires,
 *    ne lit pas les données du bureau, voit SES consignes et en rend compte ;
 *  - les comptes du staff ne sont créés et réinitialisés que par l'imam.
 * Tout ce qui est créé est supprimé à la fin.
 */
const BASE = process.env.SUPABASE_URL ?? "http://127.0.0.1:54131";
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STAFF_PASSWORD = process.env.SEED_PASSWORD ?? "fitia1234";
if (!ANON || !SERVICE) {
  console.error("SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY requis.");
  process.exit(1);
}
if (!/127\.0\.0\.1|localhost/.test(BASE)) {
  console.error("Refus : ce script crée et supprime des données, stack locale uniquement.");
  process.exit(1);
}

let passed = 0;
let failed = 0;
const check = (label, ok, detail = "") => {
  ok ? passed++ : failed++;
  console.log(`  ${ok ? "✔" : "✘"} ${label}${!ok && detail ? ` — ${detail}` : ""}`);
};

async function api(path, { method = "GET", token, body, prefer } = {}) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token ?? ANON}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const texte = await r.text();
  let data = null;
  try {
    data = texte ? JSON.parse(texte) : null;
  } catch {
    data = texte;
  }
  return { status: r.status, data };
}
const service = (path, opts = {}) =>
  fetch(`${BASE}${path}`, {
    method: opts.method ?? "GET",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  }).then(async (r) => ({ status: r.status, data: await r.json().catch(() => null) }));

async function login(email, password) {
  const r = await api("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password } });
  return { ok: r.status === 200, token: r.data?.access_token, id: r.data?.user?.id };
}

const nettoyage = { annonces: [], evenements: [], consignes: [], dons: [], comptes: [] };

console.log("Visiteur sans compte");
for (const table of ["prayer_times", "announcements", "events", "campaigns", "mosque"]) {
  const r = await api(`/rest/v1/${table}?select=*&limit=1`);
  check(`lit ${table}`, r.status === 200 && Array.isArray(r.data), `${r.status} ${JSON.stringify(r.data).slice(0, 120)}`);
}
const ref = `TEST${Date.now()}`;
const don = await api("/rest/v1/donations", {
  method: "POST",
  body: { amount: 2000, method: "wave", reference: ref, type: "sadaqah", status: "en_attente", donor_name: "Visiteur Test", donor_phone: "0700000099" },
});
check("déclare un don en attente (201)", don.status === 201, `${don.status} ${JSON.stringify(don.data)}`);
const donValide = await api("/rest/v1/donations", {
  method: "POST",
  body: { amount: 2000, method: "wave", reference: `${ref}V`, type: "sadaqah", status: "valide" },
});
check("ne peut PAS déclarer un don déjà « validé »", donValide.status >= 400, `${donValide.status}`);
const lireDons = await api("/rest/v1/donations?select=id&limit=5");
check("ne relit aucun don", lireDons.status === 200 ? lireDons.data.length === 0 : lireDons.status >= 400, JSON.stringify(lireDons.data));
const jeton = `ExponentPushToken[test-${Date.now()}]`;
const inscrit = await api("/rest/v1/rpc/register_push_device", { method: "POST", body: { p_token: jeton } });
check("inscrit son téléphone aux notifications", inscrit.status === 204 || inscrit.status === 200, `${inscrit.status} ${JSON.stringify(inscrit.data)}`);
const faux = await api("/rest/v1/rpc/register_push_device", { method: "POST", body: { p_token: "pas-un-jeton" } });
const nbFaux = await service("/rest/v1/push_devices?token=eq.pas-un-jeton&select=token");
check("un faux jeton n'est pas enregistré", faux.status < 300 && nbFaux.data?.length === 0);
const lirePush = await api("/rest/v1/push_devices?select=token");
check("ne lit pas la liste des téléphones", lirePush.status >= 400 || lirePush.data?.length === 0, `${lirePush.status}`);
const pushAnon = await api("/functions/v1/send-push", { method: "POST", body: { title: "Spam" } });
check("ne peut PAS envoyer de notification (401)", pushAnon.status === 401, `${pushAnon.status} ${JSON.stringify(pushAnon.data)}`);
const consAnon = await api("/rest/v1/consignes?select=id");
check("ne lit pas les consignes", consAnon.status >= 400 || consAnon.data?.length === 0, `${consAnon.status}`);

console.log("\nComptes du staff");
const imam = await login("imam@fitia.ci", STAFF_PASSWORD);
const secretaire = await login("secretaire@fitia.ci", STAFF_PASSWORD);
check("imam et secrétaire se connectent", imam.ok && secretaire.ok);
const emailStaff = `terrain${Date.now()}@fitia.ci`;
const parSecr = await api("/functions/v1/create-member", {
  method: "POST",
  token: secretaire.token,
  body: { kind: "staff", full_name: "Terrain Refusé", email: `x${emailStaff}`, password: "Terrain2026x", role: "membre_staff" },
});
check("un secrétaire ne crée PAS de compte staff (403)", parSecr.status === 403, `${parSecr.status}`);
const cree = await api("/functions/v1/create-member", {
  method: "POST",
  token: imam.token,
  body: { kind: "staff", full_name: "Membre Terrain", email: emailStaff, password: "Terrain2026x", role: "membre_staff" },
});
check("l'imam crée un membre du staff de terrain", cree.status === 200 && cree.data?.profile?.role === "membre_staff", `${cree.status} ${JSON.stringify(cree.data).slice(0, 160)}`);
const idTerrain = cree.data?.profile?.id;
if (idTerrain) nettoyage.comptes.push(idTerrain);
const terrain = await login(emailStaff, "Terrain2026x");
check("il se connecte (e-mail + mot de passe)", terrain.ok);

const resetImam = await api("/functions/v1/create-member", {
  method: "POST",
  token: secretaire.token,
  body: { kind: "reset_password", member_id: imam.id },
});
check("un secrétaire ne redonne PAS de mot de passe à l'imam (403)", resetImam.status === 403, `${resetImam.status} ${JSON.stringify(resetImam.data)}`);

console.log("\nStaff de terrain : publications");
const annonce = await api("/rest/v1/announcements", {
  method: "POST",
  token: terrain.token,
  prefer: "return=representation",
  body: { title: "Annonce test terrain", body: "Corps de test", category: "info", pinned: false },
});
check("publie une annonce", annonce.status === 201, `${annonce.status} ${JSON.stringify(annonce.data)}`);
if (annonce.data?.[0]?.id) nettoyage.annonces.push(annonce.data[0].id);
const evt = await api("/rest/v1/events", {
  method: "POST",
  token: terrain.token,
  prefer: "return=representation",
  body: { title: "Événement test terrain", type: "autre", starts_at: new Date(Date.now() + 86400000).toISOString() },
});
check("crée un événement", evt.status === 201, `${evt.status} ${JSON.stringify(evt.data)}`);
if (evt.data?.[0]?.id) nettoyage.evenements.push(evt.data[0].id);
const jour = "2099-12-31";
const horaires = await api("/rest/v1/prayer_times?on_conflict=date", {
  method: "POST",
  token: terrain.token,
  prefer: "resolution=merge-duplicates",
  body: { date: jour, fajr: "05:10", dhuhr: "12:30", asr: "15:50", maghrib: "18:20", isha: "19:35" },
});
check("publie des horaires", horaires.status === 201 || horaires.status === 200, `${horaires.status} ${JSON.stringify(horaires.data)}`);
const pushTerrain = await api("/functions/v1/send-push", { method: "POST", token: terrain.token, body: { title: "Test", member_ids: [terrain.id] } });
check("peut notifier (connecté, staff)", pushTerrain.status === 200, `${pushTerrain.status} ${JSON.stringify(pushTerrain.data)}`);
const docs = await api("/rest/v1/documents?select=id&limit=1", { token: terrain.token });
check("ne lit PAS les documents du bureau", docs.status === 200 ? docs.data.length === 0 : true, JSON.stringify(docs.data));
const fideles = await api("/rest/v1/profiles?select=id&role=eq.fidele&limit=5", { token: terrain.token });
check("ne lit PAS le registre des fidèles", fideles.status === 200 ? fideles.data.length === 0 : true, `${fideles.data?.length}`);
const consTerrain = await api("/rest/v1/consignes", { method: "POST", token: terrain.token, body: { title: "Consigne interdite" } });
check("ne crée PAS de consigne (réservé au bureau)", consTerrain.status >= 400, `${consTerrain.status}`);

console.log("\nConsignes");
const pourTous = await api("/rest/v1/consignes", {
  method: "POST",
  token: secretaire.token,
  prefer: "return=representation",
  body: { title: "Accueil vendredi", body: "Être à l'entrée à 12 h", priority: "urgente" },
});
check("le bureau envoie une consigne à tout le staff", pourTous.status === 201, `${pourTous.status} ${JSON.stringify(pourTous.data)}`);
const idTous = pourTous.data?.[0]?.id;
const autre = await api("/rest/v1/consignes", {
  method: "POST",
  token: secretaire.token,
  prefer: "return=representation",
  body: { title: "Consigne pour un autre", assignee_id: imam.id },
});
const idAutre = autre.data?.[0]?.id;
nettoyage.consignes.push(idTous, idAutre);
const vues = await api("/rest/v1/consignes?select=id", { token: terrain.token });
const idsVus = (vues.data ?? []).map((c) => c.id);
check("le membre voit la consigne adressée à tous", idsVus.includes(idTous));
check("il ne voit PAS celle adressée à un autre", !idsVus.includes(idAutre));
const recue = await api("/rest/v1/consigne_suivis", {
  method: "POST",
  token: terrain.token,
  prefer: "resolution=merge-duplicates",
  body: { consigne_id: idTous, member_id: terrain.id, status: "recue" },
});
check("« Bien reçu »", recue.status === 201 || recue.status === 200, `${recue.status} ${JSON.stringify(recue.data)}`);
const faite = await api("/rest/v1/consigne_suivis?on_conflict=consigne_id,member_id", {
  method: "POST",
  token: terrain.token,
  prefer: "resolution=merge-duplicates",
  body: { consigne_id: idTous, member_id: terrain.id, status: "faite", report: "Fait avec deux bénévoles" },
});
check("« C'est fait » avec compte rendu", faite.status === 201 || faite.status === 200, `${faite.status} ${JSON.stringify(faite.data)}`);
const suiviBureau = await api(`/rest/v1/consigne_suivis?consigne_id=eq.${idTous}&select=status,report`, { token: secretaire.token });
check("le bureau lit le suivi et le compte rendu", suiviBureau.data?.[0]?.status === "faite" && /bénévoles/.test(suiviBureau.data?.[0]?.report ?? ""), JSON.stringify(suiviBureau.data));
const suiviInterdit = await api("/rest/v1/consigne_suivis", {
  method: "POST",
  token: terrain.token,
  body: { consigne_id: idAutre, member_id: terrain.id, status: "recue" },
});
check("ne rend PAS compte d'une consigne qui ne le vise pas", suiviInterdit.status >= 400, `${suiviInterdit.status}`);

// ------------------------------------------------------------ nettoyage
for (const id of nettoyage.consignes.filter(Boolean)) await service(`/rest/v1/consignes?id=eq.${id}`, { method: "DELETE" });
for (const id of nettoyage.annonces) await service(`/rest/v1/announcements?id=eq.${id}`, { method: "DELETE" });
for (const id of nettoyage.evenements) await service(`/rest/v1/events?id=eq.${id}`, { method: "DELETE" });
await service(`/rest/v1/prayer_times?date=eq.${jour}`, { method: "DELETE" });
await service(`/rest/v1/donations?reference=like.${ref}*`, { method: "DELETE" });
await service(`/rest/v1/push_devices?token=eq.${encodeURIComponent(jeton)}`, { method: "DELETE" });
for (const id of nettoyage.comptes) {
  await fetch(`${BASE}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } });
}

console.log(`\n${passed} vérifications passées · ${failed} échouées`);
process.exitCode = failed ? 1 : 0;
