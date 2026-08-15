/**
 * Vérifie que le calcul d'arriérés donne le MÊME résultat des deux côtés :
 *   - `cotisationStatus()` en TypeScript (utilisé par le mobile, qui ne voit que ses lignes) ;
 *   - `contribution_arrears()` en SQL (utilisé par le dashboard, qui voit tout le monde).
 *
 * Une divergence afficherait au fidèle un montant différent de celui réclamé par
 * le trésorier — le genre d'incohérence qui ruine la confiance.
 *
 * Usage :
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts-verif/cotisation-check.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { cotisationStatus, expectedPeriods, periodOf } from "../packages/shared/src/cotisation.ts";

const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:54131";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceKey) {
  console.error("SUPABASE_SERVICE_ROLE_KEY requise.");
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

const [{ data: mosque }, { data: profiles }, { data: contributions }, { data: sqlArrears }] =
  await Promise.all([
    db.from("mosque").select("contribution_amount").limit(1).maybeSingle(),
    db.from("profiles").select("id, full_name, joined_at").eq("role", "fidele"),
    db.from("contributions").select("member_id, period, amount, status"),
    db.rpc("contribution_arrears"),
  ]);

const reference = Number(mosque.contribution_amount);
console.log(`Montant de référence : ${reference} FCFA/mois\n`);

const sqlByMember = new Map((sqlArrears ?? []).map((r) => [r.member_id, r]));
let divergences = 0;

for (const p of profiles ?? []) {
  const mine = (contributions ?? []).filter((c) => c.member_id === p.id);
  const ts = cotisationStatus({ joinedAt: p.joined_at, contributions: mine, reference });

  // Le SQL compte TOUS les mois non couverts, mois courant inclus.
  const tsTotalDue = ts.monthsLate + (ts.currentDue ? 1 : 0);
  const sql = sqlByMember.get(p.id);
  const sqlMonths = sql ? sql.months_due : 0;

  const ok = tsTotalDue === sqlMonths;
  if (!ok) divergences += 1;

  console.log(
    `${ok ? "✓" : "✗"} ${p.full_name}  adhésion ${p.joined_at.slice(0, 10)}\n` +
      `    attendus ${expectedPeriods(p.joined_at).length} · TS : ${ts.monthsLate} en retard` +
      `${ts.currentDue ? " + mois courant" : ""} = ${tsTotalDue} · SQL : ${sqlMonths}\n` +
      `    plus ancien impayé — TS ${ts.oldestUnpaid ?? "aucun"} / SQL ${sql?.oldest_unpaid ?? "aucun"}`,
  );
}

// Cas limites, sans réseau.
console.log("\n— Cas limites —");
const now = new Date("2026-08-05T12:00:00");
const cases = [
  {
    nom: "adhésion ce mois-ci, rien payé",
    joinedAt: "2026-08-01",
    contributions: [],
    attendu: { monthsLate: 0, courant: true },
  },
  {
    nom: "3 mois d'ancienneté, rien payé",
    joinedAt: "2026-06-01",
    contributions: [],
    attendu: { monthsLate: 2, courant: true },
  },
  {
    nom: "versement partiel sur le mois courant",
    joinedAt: "2026-08-01",
    contributions: [{ period: "2026-08", amount: 800, status: "valide" }],
    attendu: { monthsLate: 0, courant: true },
  },
  {
    nom: "deux versements partiels qui couvrent le mois",
    joinedAt: "2026-08-01",
    contributions: [
      { period: "2026-08", amount: 1200, status: "valide" },
      { period: "2026-08", amount: 800, status: "valide" },
    ],
    attendu: { monthsLate: 0, courant: false },
  },
  {
    nom: "déclaration en attente : ne compte pas",
    joinedAt: "2026-08-01",
    contributions: [{ period: "2026-08", amount: 5000, status: "en_attente" }],
    attendu: { monthsLate: 0, courant: true },
  },
];

for (const c of cases) {
  const s = cotisationStatus({ ...c, reference: 2000, now });
  const ok = s.monthsLate === c.attendu.monthsLate && Boolean(s.currentDue) === c.attendu.courant;
  if (!ok) divergences += 1;
  console.log(
    `${ok ? "✓" : "✗"} ${c.nom} → ${s.monthsLate} en retard, ` +
      `mois courant ${s.currentDue ? `dû (reste ${s.remainingThisMonth})` : "couvert"}`,
  );
}

console.log(divergences === 0 ? "\n✅ TS et SQL concordent." : `\n❌ ${divergences} divergence(s).`);
process.exit(divergences === 0 ? 0 : 1);
