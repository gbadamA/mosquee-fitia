/**
 * Vérifie la colonne vertébrale du produit : la diffusion dashboard → mobile.
 *
 * Deux canaux, deux niveaux d'accès — le script reproduit les deux tels qu'ils
 * existent vraiment dans l'app :
 *   1. `prayer_times` : lisible par un client ANONYME (l'accueil mobile affiche
 *      les horaires avant même le login).
 *   2. `announcements` : réservé aux connectés — un écouteur anonyme ne doit
 *      RIEN recevoir, c'est la RLS qui fait son travail. On ouvre donc une
 *      session de fidèle pour ce second canal.
 *
 * Usage :
 *   SUPABASE_URL=http://127.0.0.1:54131 \
 *   SUPABASE_ANON_KEY=<anon key> \
 *   SUPABASE_SERVICE_ROLE_KEY=<service key> \
 *   node scripts-verif/realtime-check.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:54131";
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!anonKey || !serviceKey) {
  console.error("SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY sont requises.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Laisse le serveur finir de câbler le filtre postgres_changes après SUBSCRIBED. */
const SETTLE_MS = 2000;
const TIMEOUT_MS = 25_000;

const results = { horaires: false, annonces: false, rlsAnonyme: true };

function subscribed(channel) {
  return new Promise((resolve, reject) => {
    channel.subscribe((status, err) => {
      if (status === "SUBSCRIBED") setTimeout(resolve, SETTLE_MS);
      else if (err) reject(err);
    });
  });
}

// ---------------------------------------------------------------- 1. Horaires
const anonClient = createClient(url, anonKey);
const anonChannel = anonClient
  .channel("verif:horaires-anonyme")
  .on("postgres_changes", { event: "*", schema: "public", table: "prayer_times" }, (p) => {
    results.horaires = true;
    console.log(`✓ horaires reçus par un client ANONYME : ${p.new?.date} fajr ${p.new?.fajr}`);
  })
  .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, () => {
    // Ne doit JAMAIS arriver : les annonces sont réservées aux connectés.
    results.rlsAnonyme = false;
    console.error("✗ FUITE RLS : un client anonyme a reçu une annonce !");
  });

// ---------------------------------------------------------------- 2. Annonces
// Un fidèle connecté, comme dans l'app mobile.
const email = `verif-${Date.now()}@fitia.test`;
const password = "verif1234";
const { error: createError } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: "Fidèle de vérification" },
});
if (createError) {
  console.error("Impossible de créer le fidèle de test :", createError.message);
  process.exit(1);
}

const memberClient = createClient(url, anonKey, { auth: { persistSession: false } });
const { error: signInError } = await memberClient.auth.signInWithPassword({ email, password });
if (signInError) {
  console.error("Connexion du fidèle de test impossible :", signInError.message);
  process.exit(1);
}

const memberChannel = memberClient
  .channel("verif:annonces-fidele")
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "announcements" }, (p) => {
    results.annonces = true;
    console.log(`✓ annonce reçue par un FIDÈLE connecté : « ${p.new?.title} »`);
  });

await Promise.all([subscribed(anonChannel), subscribed(memberChannel)]);
console.log("abonnés, écriture depuis le dashboard…");

// ------------------------------------------------------- 3. Écritures dashboard
const today = new Date().toISOString().slice(0, 10);
const { error: prayerError } = await admin.from("prayer_times").upsert(
  {
    date: today,
    fajr: "05:13",
    dhuhr: "12:25",
    asr: "15:40",
    maghrib: "18:25",
    isha: "19:35",
  },
  { onConflict: "date" },
);
if (prayerError) console.error("✗ écriture horaires :", prayerError.message);

const { error: annError } = await admin.from("announcements").insert({
  title: "Test de diffusion",
  body: "Message généré par realtime-check.mjs",
  category: "info",
});
if (annError) console.error("✗ écriture annonce :", annError.message);

// ------------------------------------------------------------------- 4. Bilan
setTimeout(async () => {
  await anonClient.removeChannel(anonChannel);
  await memberClient.removeChannel(memberChannel);

  const ok = results.horaires && results.annonces && results.rlsAnonyme;
  console.log("\n— Bilan —");
  console.log(`horaires → client anonyme      : ${results.horaires ? "OK" : "ÉCHEC"}`);
  console.log(`annonces → fidèle connecté     : ${results.annonces ? "OK" : "ÉCHEC"}`);
  console.log(`annonces cachées à l'anonyme   : ${results.rlsAnonyme ? "OK" : "FUITE"}`);
  console.log(ok ? "\n✅ Diffusion vérifiée de bout en bout." : "\n❌ Diffusion incomplète.");
  process.exit(ok ? 0 : 1);
}, TIMEOUT_MS);
