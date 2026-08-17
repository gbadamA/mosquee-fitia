"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, Save, Building2, UserPlus } from "lucide-react";
import { ROLE_LABELS, roleSchema, type Profile, type Role } from "@fitia/shared";
import type { MosqueRow } from "@fitia/supabase";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { invokeEdge } from "@/lib/edge";
import { useAuth } from "@/lib/auth";

const ROLES = roleSchema.options as readonly Role[];
/** Rôles attribuables à un compte de back-office (un fidèle n'a pas d'accès web). */
const STAFF_ROLES: Role[] = ["secretaire", "tresorier", "imam", "admin"];

export default function AdministrationPage() {
  const { profile } = useAuth();
  const [people, setPeople] = useState<Profile[]>([]);
  const [mosque, setMosque] = useState<MosqueRow | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const configured = isSupabaseConfigured();

  // Formulaire de création d'un compte du bureau
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<Role>("secretaire");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!configured) return;
    const supabase = getSupabase();
    const [{ data: profiles }, { data: m }] = await Promise.all([
      supabase.from("profiles").select("*").neq("role", "fidele").order("full_name"),
      supabase.from("mosque").select("*").limit(1).maybeSingle(),
    ]);
    setPeople((profiles as Profile[]) ?? []);
    setMosque((m as MosqueRow) ?? null);
  }, [configured]);

  useEffect(() => {
    load();
  }, [load]);

  async function changeRole(id: string, role: Role) {
    setError(null);
    setMessage(null);
    // Garde-fou côté client ; la RLS `is_admin()` reste la vraie barrière.
    if (id === profile?.id) {
      setError("Vous ne pouvez pas modifier votre propre rôle.");
      return;
    }
    const { error: dbError } = await getSupabase().from("profiles").update({ role }).eq("id", id);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    setMessage("Rôle mis à jour.");
    load();
  }

  /** Création d'un accès back-office — passe par l'Edge Function (clé service_role). */
  async function createStaff(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (newName.trim().length < 3) {
      setError("Nom trop court.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Mot de passe : 8 caractères minimum.");
      return;
    }

    setBusy(true);
    const { error: failure } = await invokeEdge("create-member", {
      kind: "staff",
      full_name: newName.trim(),
      email: newEmail.trim(),
      password: newPassword,
      role: newRole,
    });
    setBusy(false);

    if (failure) {
      setError(failure);
      return;
    }

    setMessage(`Compte ${newEmail.trim()} créé (${ROLE_LABELS[newRole]}).`);
    setNewName("");
    setNewEmail("");
    setNewPassword("");
    setOpen(false);
    load();
  }

  async function saveMosque(e: React.FormEvent) {
    e.preventDefault();
    if (!mosque) return;
    setError(null);
    setMessage(null);
    const { error: dbError } = await getSupabase()
      .from("mosque")
      .update({
        name: mosque.name,
        address: mosque.address,
        city: mosque.city,
        phone: mosque.phone,
        whatsapp: mosque.whatsapp,
        primary_color: mosque.primary_color,
        secondary_color: mosque.secondary_color,
        contribution_amount: mosque.contribution_amount,
        contribution_due_day: mosque.contribution_due_day,
      })
      .eq("id", mosque.id);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    setMessage("Paramètres enregistrés.");
  }

  const field =
    "w-full rounded-md border border-light-border bg-transparent px-3 py-2.5 text-body outline-none focus:border-primary dark:border-dark-border";

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8 flex items-center gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-emerald shadow-glow">
          <ShieldCheck className="h-5 w-5 text-white" />
        </span>
        <div>
          <h1 className="font-display text-h1">Administration</h1>
          <p className="text-caption text-light-muted dark:text-dark-muted">
            Comptes du bureau et paramètres de la mosquée
          </p>
        </div>
      </header>

      {message && (
        <div className="mb-6 rounded-md border border-success/40 bg-success/10 p-4 text-caption text-success">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-6 rounded-md border border-danger/40 bg-danger/10 p-4 text-caption text-danger">
          {error}
        </div>
      )}

      {/* Gestion des accès */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-h3">Accès au back-office</h2>
        <button
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 font-medium text-white transition hover:bg-primary-hover hover:shadow-glow"
        >
          <UserPlus className="h-4 w-4" /> {open ? "Fermer" : "Nouveau compte"}
        </button>
      </div>

      {open && (
        <form
          onSubmit={createStaff}
          className="mb-6 rounded-lg border border-light-border bg-light-surface p-5 shadow-card dark:border-dark-border dark:bg-dark-surface"
        >
          <p className="mb-4 text-caption text-light-muted dark:text-dark-muted">
            Le personnel se connecte par email et mot de passe. Communiquez le mot de passe de
            façon sûre : il ne sera plus affiché ensuite.
          </p>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nom et prénoms"
              className={field}
            />
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              autoComplete="off"
              placeholder="Adresse email"
              className={field}
            />
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="off"
              placeholder="Mot de passe (8 caractères min.)"
              className={field}
            />
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as Role)}
              className={field}
            >
              {STAFF_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-medium text-white transition hover:bg-primary-hover hover:shadow-glow disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4" /> {busy ? "Création…" : "Créer le compte"}
          </button>
        </form>
      )}
      <div className="mb-10 overflow-x-auto rounded-md border border-light-border dark:border-dark-border">
        <table className="w-full min-w-[520px] text-left text-body">
          <thead className="bg-light-surface-alt text-caption text-light-muted dark:bg-dark-surface-alt dark:text-dark-muted">
            <tr>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Rôle</th>
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id} className="border-t border-light-border dark:border-dark-border">
                <td className="px-4 py-3 font-medium">
                  {p.full_name ?? "Sans nom"}
                  {p.id === profile?.id && (
                    <span className="ml-2 text-caption text-primary">(vous)</span>
                  )}
                </td>
                <td className="px-4 py-3 text-caption text-light-muted dark:text-dark-muted">
                  {p.email ?? p.phone ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={p.role}
                    disabled={p.id === profile?.id}
                    onChange={(e) => changeRole(p.id, e.target.value as Role)}
                    className="rounded-md border border-light-border bg-transparent px-3 py-2 text-caption outline-none focus:border-primary disabled:opacity-50 dark:border-dark-border"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {people.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-8 text-center text-caption text-light-muted dark:text-dark-muted"
                >
                  Aucun compte de bureau. Créez-en un avec{" "}
                  <code>scripts-verif/seed-accounts.mjs</code>.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paramètres de la mosquée */}
      <h2 className="mb-3 flex items-center gap-2 font-display text-h3">
        <Building2 className="h-4 w-4 text-primary" /> Paramètres de la mosquée
      </h2>
      {mosque ? (
        <form
          onSubmit={saveMosque}
          className="rounded-lg border border-light-border bg-light-surface p-5 shadow-card dark:border-dark-border dark:bg-dark-surface"
        >
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-caption text-light-muted dark:text-dark-muted">
                Nom
              </label>
              <input
                value={mosque.name}
                onChange={(e) => setMosque({ ...mosque, name: e.target.value })}
                className={field}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-caption text-light-muted dark:text-dark-muted">
                Adresse
              </label>
              <input
                value={mosque.address ?? ""}
                onChange={(e) => setMosque({ ...mosque, address: e.target.value })}
                className={field}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-caption text-light-muted dark:text-dark-muted">
                Ville
              </label>
              <input
                value={mosque.city ?? ""}
                onChange={(e) => setMosque({ ...mosque, city: e.target.value })}
                className={field}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-caption text-light-muted dark:text-dark-muted">
                Téléphone
              </label>
              <input
                value={mosque.phone ?? ""}
                onChange={(e) => setMosque({ ...mosque, phone: e.target.value })}
                placeholder="+225…"
                className={field}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-caption text-light-muted dark:text-dark-muted">
                WhatsApp
              </label>
              <input
                value={mosque.whatsapp ?? ""}
                onChange={(e) => setMosque({ ...mosque, whatsapp: e.target.value })}
                placeholder="+225…"
                className={field}
              />
            </div>
          </div>

          {/* Cotisation de référence — pilote tout le calcul des arriérés. */}
          <div className="mb-5 rounded-md border border-light-border p-4 dark:border-dark-border">
            <p className="mb-1 font-medium">Cotisation mensuelle</p>
            <p className="mb-3 text-caption text-light-muted dark:text-dark-muted">
              Un mois est considéré comme réglé quand la somme des cotisations validées de
              ce mois atteint ce montant. Changer ce montant recalcule immédiatement les
              arriérés de tous les fidèles.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-caption text-light-muted dark:text-dark-muted">
                  Montant de référence (FCFA)
                </label>
                <input
                  value={String(mosque.contribution_amount ?? "")}
                  onChange={(e) =>
                    setMosque({
                      ...mosque,
                      contribution_amount: Number(e.target.value.replace(/\D/g, "")) || 0,
                    })
                  }
                  inputMode="numeric"
                  className={field}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-caption text-light-muted dark:text-dark-muted">
                  Jour d&apos;échéance dans le mois
                </label>
                <input
                  value={String(mosque.contribution_due_day ?? "")}
                  onChange={(e) => {
                    const v = Number(e.target.value.replace(/\D/g, "")) || 1;
                    // Borné à 28 : au-delà, le jour n'existe pas tous les mois.
                    setMosque({ ...mosque, contribution_due_day: Math.min(28, Math.max(1, v)) });
                  }}
                  inputMode="numeric"
                  className={field}
                />
              </div>
            </div>
          </div>

          <p className="mb-2 text-caption text-light-muted dark:text-dark-muted">
            Couleurs de la mosquée — elles surchargent les tokens de marque côté mobile et web.
          </p>
          <div className="mb-5 flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-caption">
              Principale
              <input
                type="color"
                value={mosque.primary_color}
                onChange={(e) => setMosque({ ...mosque, primary_color: e.target.value })}
                className="h-9 w-14 cursor-pointer rounded-md border border-light-border bg-transparent dark:border-dark-border"
              />
              <span className="font-mono">{mosque.primary_color}</span>
            </label>
            <label className="flex items-center gap-2 text-caption">
              Accent
              <input
                type="color"
                value={mosque.secondary_color}
                onChange={(e) => setMosque({ ...mosque, secondary_color: e.target.value })}
                className="h-9 w-14 cursor-pointer rounded-md border border-light-border bg-transparent dark:border-dark-border"
              />
              <span className="font-mono">{mosque.secondary_color}</span>
            </label>
          </div>

          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-medium text-white transition hover:bg-primary-hover hover:shadow-glow"
          >
            <Save className="h-4 w-4" /> Enregistrer
          </button>
        </form>
      ) : (
        <p className="rounded-md border border-dashed border-light-border p-6 text-center text-caption text-light-muted dark:border-dark-border dark:text-dark-muted">
          Paramètres indisponibles (Supabase non configuré ou base vide).
        </p>
      )}
    </main>
  );
}
