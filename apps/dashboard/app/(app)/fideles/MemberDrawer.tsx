"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { X, Save, Receipt, KeyRound } from "lucide-react";
import {
  formatFCFA,
  formatPhoneCI,
  MEMBER_STATUS_LABELS,
  MEMBER_CATEGORY_LABELS,
  ROLE_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  DONATION_TYPE_LABELS,
  type MemberStatus,
  type MemberCategory,
  type PaymentStatus,
  type Profile,
  type Role,
} from "@fitia/shared";
import type { ContributionRow, DonationRow } from "@fitia/supabase";
import { getSupabase } from "@/lib/supabase";
import { invokeEdge } from "@/lib/edge";

/**
 * Fiche détaillée d'un fidèle : informations modifiables + historique complet
 * de ses versements. Le rôle n'est modifiable que par l'administration —
 * la RLS `is_admin()` refuserait de toute façon la requête d'un secrétaire.
 */

const STATUSES = Object.keys(MEMBER_STATUS_LABELS) as MemberStatus[];
const CATEGORIES = Object.keys(MEMBER_CATEGORY_LABELS) as MemberCategory[];
const ROLES: Role[] = ["fidele", "secretaire", "tresorier", "imam", "admin"];

type Entry = {
  id: string;
  label: string;
  amount: number;
  status: PaymentStatus;
  method: keyof typeof PAYMENT_METHOD_LABELS;
  created_at: string;
};

const STATUS_COLOR: Record<PaymentStatus, string> = {
  valide: "text-success",
  en_attente: "text-warning",
  rejete: "text-danger",
};

export default function MemberDrawer({
  member,
  canEditRole,
  onClose,
  onSaved,
}: {
  member: Profile;
  canEditRole: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fullName, setFullName] = useState(member.full_name ?? "");
  const [quartier, setQuartier] = useState(member.quartier ?? "");
  const [email, setEmail] = useState(member.email ?? "");
  const [status, setStatus] = useState<MemberStatus>(member.status);
  const [category, setCategory] = useState<MemberCategory>(member.category);
  const [role, setRole] = useState<Role>(member.role);

  const [entries, setEntries] = useState<Entry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  /** Mot de passe fraîchement émis — visible une seule fois. */
  const [issued, setIssued] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    (async () => {
      const [{ data: c }, { data: d }] = await Promise.all([
        supabase.from("contributions").select("*").eq("member_id", member.id),
        supabase.from("donations").select("*").eq("donor_id", member.id),
      ]);

      const merged: Entry[] = [
        ...((c as ContributionRow[]) ?? []).map((r) => ({
          id: r.id,
          label: `Cotisation ${r.period}`,
          amount: Number(r.amount),
          status: r.status,
          method: r.method,
          created_at: r.created_at,
        })),
        ...((d as DonationRow[]) ?? []).map((r) => ({
          id: r.id,
          label: DONATION_TYPE_LABELS[r.type],
          amount: Number(r.amount),
          status: r.status,
          method: r.method,
          created_at: r.created_at,
        })),
      ].sort((a, b) => b.created_at.localeCompare(a.created_at));

      setEntries(merged);
    })();
  }, [member.id]);

  const totalValide = entries
    .filter((e) => e.status === "valide")
    .reduce((acc, e) => acc + e.amount, 0);

  /**
   * Réémet un mot de passe. Indispensable pour les fidèles enregistrés avant
   * l'abandon de l'OTP — ils n'en ont aucun — et pour tous les oublis ensuite.
   * Supabase ne stockant qu'un haché, un mot de passe perdu ne se retrouve pas :
   * il ne peut être que remplacé.
   */
  async function reissuePassword() {
    setIssuing(true);
    setError(null);
    setIssued(null);

    const { data, error: failure } = await invokeEdge<{ password?: string }>("create-member", {
      kind: "reset_password",
      member_id: member.id,
    });
    setIssuing(false);

    if (failure) {
      setError(failure);
      return;
    }
    setIssued(data?.password ?? null);
  }

  async function save() {
    setError(null);
    setSaved(false);
    setBusy(true);

    const base = {
      full_name: fullName.trim() || null,
      quartier: quartier.trim() || null,
      email: email.trim() || null,
      status,
      category,
    };
    // On n'envoie `role` que si l'utilisateur a le droit de le changer :
    // l'inclure sans droit ferait échouer TOUTE la mise à jour.
    const patch = canEditRole ? { ...base, role } : base;

    const { error: dbError } = await getSupabase()
      .from("profiles")
      .update(patch)
      .eq("id", member.id);
    setBusy(false);

    if (dbError) {
      setError(dbError.message);
      return;
    }
    setSaved(true);
    onSaved();
  }

  const field =
    "w-full rounded-md border border-light-border bg-transparent px-3 py-2.5 text-body outline-none focus:border-primary dark:border-dark-border";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Voile cliquable pour fermer */}
      <button
        aria-label="Fermer la fiche"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />

      <motion.aside
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.18 }}
        className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-light-border bg-light-surface dark:border-dark-border dark:bg-dark-surface"
      >
        <header className="bg-emerald p-5">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="text-caption text-white/80">
                {member.member_number ?? "Sans numéro"}
              </p>
              <h2 className="truncate font-display text-h2 text-white">
                {member.full_name ?? "Fidèle"}
              </h2>
              <p className="text-caption text-white/80">
                {formatPhoneCI(member.phone)} · {ROLE_LABELS[member.role]}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Fermer"
              className="rounded-full p-1.5 text-white transition hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 flex gap-4 text-white">
            <div>
              <p className="text-caption text-white/70">Total contribué</p>
              <p className="font-display text-h3">{formatFCFA(totalValide)}</p>
            </div>
            <div>
              <p className="text-caption text-white/70">Versements</p>
              <p className="font-display text-h3">{entries.length}</p>
            </div>
          </div>
        </header>

        <div className="flex-1 p-5">
          {error && (
            <div className="mb-4 rounded-md border border-danger/40 bg-danger/10 p-3 text-caption text-danger">
              {error}
            </div>
          )}
          {saved && (
            <div className="mb-4 rounded-md border border-success/40 bg-success/10 p-3 text-caption text-success">
              Fiche enregistrée.
            </div>
          )}

          <div className="mb-4 grid gap-3">
            <div>
              <label className="mb-1.5 block text-caption text-light-muted dark:text-dark-muted">
                Nom et prénoms
              </label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={field} />
            </div>
            <div>
              <label className="mb-1.5 block text-caption text-light-muted dark:text-dark-muted">
                Quartier
              </label>
              <input value={quartier} onChange={(e) => setQuartier(e.target.value)} className={field} />
            </div>
            <div>
              <label className="mb-1.5 block text-caption text-light-muted dark:text-dark-muted">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={field}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-caption text-light-muted dark:text-dark-muted">
                  Statut
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as MemberStatus)}
                  className={field}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {MEMBER_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-caption text-light-muted dark:text-dark-muted">
                  Catégorie
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as MemberCategory)}
                  className={field}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {MEMBER_CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {canEditRole && (
              <div>
                <label className="mb-1.5 block text-caption text-light-muted dark:text-dark-muted">
                  Rôle
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className={field}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <button
            onClick={save}
            disabled={busy}
            className="mb-8 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-medium text-white transition hover:bg-primary-hover hover:shadow-glow disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> {busy ? "Enregistrement…" : "Enregistrer"}
          </button>

          {/* Accès à l'application */}
          <h3 className="mb-2 font-display text-h3">Accès à l&apos;application</h3>
          <div className="mb-8 rounded-md border border-light-border p-4 dark:border-dark-border">
            <p className="mb-3 text-caption text-light-muted dark:text-dark-muted">
              Le fidèle se connecte avec son numéro et un mot de passe. En cas d&apos;oubli,
              émettez-en un nouveau : l&apos;ancien devient aussitôt caduc.
            </p>

            {issued ? (
              <div className="rounded-md border-2 border-secondary bg-secondary/10 p-3">
                <p className="text-caption text-light-muted dark:text-dark-muted">
                  Nouveau mot de passe — à remettre <strong>maintenant</strong>, il ne
                  sera plus affiché :
                </p>
                <p className="font-mono text-h2 tracking-widest">{issued}</p>
              </div>
            ) : (
              <button
                onClick={reissuePassword}
                disabled={issuing}
                className="inline-flex items-center gap-2 rounded-full border border-light-border px-4 py-2 text-caption transition hover:border-primary hover:text-primary disabled:opacity-50 dark:border-dark-border"
              >
                <KeyRound className="h-3.5 w-3.5" />
                {issuing ? "Émission…" : "Émettre un mot de passe"}
              </button>
            )}
          </div>

          <h3 className="mb-2 font-display text-h3">Historique des versements</h3>
          <ul className="space-y-2">
            {entries.map((e) => (
              <li
                key={e.id}
                className="flex items-center gap-3 rounded-md border border-light-border p-3 dark:border-dark-border"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body">{e.label}</p>
                  <p className="text-caption text-light-muted dark:text-dark-muted">
                    {PAYMENT_METHOD_LABELS[e.method]} ·{" "}
                    {new Intl.DateTimeFormat("fr-FR").format(new Date(e.created_at))}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-medium tabular-nums">{formatFCFA(e.amount)}</p>
                  <p className={`text-caption ${STATUS_COLOR[e.status]}`}>
                    {PAYMENT_STATUS_LABELS[e.status]}
                  </p>
                </div>
                {e.status === "valide" && (
                  <Link
                    href={`/recu/${e.id}`}
                    aria-label="Voir le reçu"
                    className="shrink-0 rounded-full border border-light-border p-2 text-primary transition hover:border-primary dark:border-dark-border"
                  >
                    <Receipt className="h-3.5 w-3.5" />
                  </Link>
                )}
              </li>
            ))}
            {entries.length === 0 && (
              <li className="rounded-md border border-dashed border-light-border p-6 text-center text-caption text-light-muted dark:border-dark-border dark:text-dark-muted">
                Aucun versement enregistré.
              </li>
            )}
          </ul>
        </div>
      </motion.aside>
    </div>
  );
}
