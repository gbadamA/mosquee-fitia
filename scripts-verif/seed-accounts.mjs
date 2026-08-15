/**
 * Crée les comptes de test du bureau de la mosquée.
 *
 * Les comptes passent par l'API Auth (pas par SQL) : le trigger `handle_new_user`
 * crée le profil, puis on lui applique le bon rôle avec la clé service_role.
 *
 * Usage :
 *   SUPABASE_URL=http://127.0.0.1:54131 \
 *   SUPABASE_SERVICE_ROLE_KEY=<clé affichée par `supabase start`> \
 *   node scripts-verif/seed-accounts.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:54131";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceKey) {
  console.error(
    "SUPABASE_SERVICE_ROLE_KEY manquante. Récupère-la dans la sortie de `supabase start`.",
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ACCOUNTS = [
  { email: "imam@fitia.ci", full_name: "Imam El Hadj Traoré", role: "imam" },
  { email: "tresorier@fitia.ci", full_name: "Trésorier Koné", role: "tresorier" },
  { email: "secretaire@fitia.ci", full_name: "Secrétaire Diaby", role: "secretaire" },
];

const PASSWORD = "fitia1234";

for (const account of ACCOUNTS) {
  const { data, error } = await admin.auth.admin.createUser({
    email: account.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: account.full_name },
  });

  if (error) {
    // Déjà créé : on récupère l'utilisateur pour quand même corriger son rôle.
    if (!/already/i.test(error.message)) {
      console.error(`✗ ${account.email} :`, error.message);
      continue;
    }
    const { data: list } = await admin.auth.admin.listUsers();
    const existing = list?.users.find((u) => u.email === account.email);
    if (!existing) {
      console.error(`✗ ${account.email} : introuvable`);
      continue;
    }
    await admin
      .from("profiles")
      .update({ role: account.role, full_name: account.full_name, status: "actif" })
      .eq("id", existing.id);
    console.log(`= ${account.email} (existait déjà) → rôle ${account.role}`);
    continue;
  }

  const { error: roleError } = await admin
    .from("profiles")
    .update({ role: account.role, full_name: account.full_name, status: "actif" })
    .eq("id", data.user.id);

  if (roleError) console.error(`✗ rôle ${account.email} :`, roleError.message);
  else console.log(`✓ ${account.email} / ${PASSWORD} → ${account.role}`);
}

console.log("\nFidèle mobile : +22507000000, code OTP 123456 (numéro de test local).");
