"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Stamp, Plus, Printer, Ban } from "lucide-react";
import {
  createAttestationSchema,
  ATTESTATION_TEMPLATES,
  formatOfficialDate,
  todayISO,
  type AttestationType,
  type Profile,
} from "@fitia/shared";
import type { AttestationRow } from "@fitia/supabase";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

/**
 * Attestations délivrées PAR la mosquée (mariage, adhésion, don, résidence…).
 *
 * À distinguer de « Documents », qui archive ce que la mosquée reçoit.
 * Les champs propres à chaque type sont déclarés une seule fois dans
 * `ATTESTATION_TEMPLATES` : le formulaire ci-dessous et le document imprimé s'y
 * réfèrent tous les deux, ce qui les empêche de diverger.
 */

const TYPES = Object.keys(ATTESTATION_TEMPLATES) as AttestationType[];

export default function AttestationsPage() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<AttestationRow[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [type, setType] = useState<AttestationType>("mariage");
  const [subject, setSubject] = useState("");
  const [memberId, setMemberId] = useState("");
  const [issuedOn, setIssuedOn] = useState(todayISO());
  const [data, setData] = useState<Record<string, string>>({});

  const configured = isSupabaseConfigured();
  const template = ATTESTATION_TEMPLATES[type];

  const load = useCallback(async () => {
    if (!configured) return;
    const supabase = getSupabase();
    const [{ data: a }, { data: p }] = await Promise.all([
      supabase.from("attestations").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").order("full_name"),
    ]);
    setRows((a as AttestationRow[]) ?? []);
    setMembers((p as Profile[]) ?? []);
  }, [configured]);

  useEffect(() => {
    load();
  }, [load]);

  // Changer de type vide les champs : ceux de l'ancien type n'ont plus de sens.
  useEffect(() => {
    setData({});
  }, [type]);

  async function issue(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const missing = template.fields.find((f) => f.required && !data[f.key]?.trim());
    if (missing) {
      setError(`Champ obligatoire : ${missing.label}.`);
      return;
    }

    const parsed = createAttestationSchema.safeParse({
      type,
      subject: subject.trim(),
      member_id: memberId || null,
      data,
      issued_on: issuedOn,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Formulaire invalide");
      return;
    }

    setBusy(true);
    const { data: created, error: dbError } = await getSupabase()
      .from("attestations")
      .insert({ ...parsed.data, issued_by: profile?.id ?? null })
      .select()
      .single();
    setBusy(false);

    if (dbError) {
      setError(dbError.message);
      return;
    }
    setMessage(`Attestation ${(created as AttestationRow).reference} délivrée.`);
    setSubject("");
    setData({});
    setOpen(false);
    load();
  }

  /** Une attestation délivrée par erreur s'annule, elle ne se supprime jamais. */
  async function cancel(row: AttestationRow) {
    const { error: dbError } = await getSupabase()
      .from("attestations")
      .update({ cancelled: !row.cancelled })
      .eq("id", row.id);
    if (dbError) setError(dbError.message);
    else load();
  }

  const field =
    "w-full rounded-md border border-light-border bg-transparent px-3 py-2.5 text-body outline-none focus:border-primary dark:border-dark-border";

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-emerald shadow-glow">
            <Stamp className="h-5 w-5 text-white" />
          </span>
          <div>
            <h1 className="font-display text-h1">Attestations</h1>
            <p className="text-caption text-light-muted dark:text-dark-muted">
              Documents délivrés par la mosquée — mariage, adhésion, don…
            </p>
          </div>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-medium text-white transition hover:bg-primary-hover hover:shadow-glow"
        >
          <Plus className="h-4 w-4" /> {open ? "Fermer" : "Délivrer une attestation"}
        </button>
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

      {open && (
        <form
          onSubmit={issue}
          className="mb-8 rounded-lg border border-light-border bg-light-surface p-5 shadow-card dark:border-dark-border dark:bg-dark-surface"
        >
          <div className="mb-4 flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => setType(t)}
                className={`rounded-full px-4 py-1.5 text-caption font-medium transition ${
                  type === t
                    ? "bg-primary text-white"
                    : "border border-light-border text-light-muted hover:border-primary dark:border-dark-border dark:text-dark-muted"
                }`}
              >
                {ATTESTATION_TEMPLATES[t].label}
              </button>
            ))}
          </div>

          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-caption text-light-muted dark:text-dark-muted">
                {template.subjectLabel}
              </label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Nom et prénoms"
                className={field}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-caption text-light-muted dark:text-dark-muted">
                Rattacher à un fidèle (facultatif)
              </label>
              <select
                value={memberId}
                onChange={(e) => {
                  setMemberId(e.target.value);
                  // Pré-remplit le nom : la plupart des attestations visent un adhérent.
                  const m = members.find((x) => x.id === e.target.value);
                  if (m?.full_name) setSubject(m.full_name);
                }}
                className={field}
              >
                <option value="">Non rattachée</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name ?? "Sans nom"}
                    {m.member_number ? ` · ${m.member_number}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Champs propres au type choisi */}
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            {template.fields.map((f) => (
              <div key={f.key} className={f.kind === "long" ? "sm:col-span-2" : ""}>
                <label className="mb-1.5 block text-caption text-light-muted dark:text-dark-muted">
                  {f.label}
                  {f.required && <span className="text-danger"> *</span>}
                </label>
                {f.kind === "long" ? (
                  <textarea
                    rows={4}
                    value={data[f.key] ?? ""}
                    onChange={(e) => setData({ ...data, [f.key]: e.target.value })}
                    className={`${field} resize-none`}
                  />
                ) : (
                  <input
                    type={f.kind === "date" ? "date" : "text"}
                    value={data[f.key] ?? ""}
                    onChange={(e) => setData({ ...data, [f.key]: e.target.value })}
                    className={field}
                  />
                )}
              </div>
            ))}
            <div>
              <label className="mb-1.5 block text-caption text-light-muted dark:text-dark-muted">
                Date de délivrance
              </label>
              <input
                type="date"
                value={issuedOn}
                onChange={(e) => setIssuedOn(e.target.value)}
                className={field}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={busy || subject.trim().length < 2}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-medium text-white transition hover:bg-primary-hover hover:shadow-glow disabled:opacity-50"
          >
            <Stamp className="h-4 w-4" /> {busy ? "Délivrance…" : "Délivrer"}
          </button>
        </form>
      )}

      <ul className="space-y-2">
        {rows.map((r) => (
          <li
            key={r.id}
            className={`flex flex-wrap items-center gap-3 rounded-md border border-light-border bg-light-surface p-4 dark:border-dark-border dark:bg-dark-surface ${
              r.cancelled ? "opacity-60" : ""
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {r.subject}
                {r.cancelled && <span className="ml-2 text-caption text-danger">annulée</span>}
              </p>
              <p className="text-caption text-light-muted dark:text-dark-muted">
                <span className="font-mono text-primary">{r.reference}</span> ·{" "}
                {ATTESTATION_TEMPLATES[r.type].label} · {formatOfficialDate(r.issued_on)}
              </p>
            </div>
            <Link
              href={`/attestations/${r.id}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-light-border px-4 py-2 text-caption transition hover:border-primary hover:text-primary dark:border-dark-border"
            >
              <Printer className="h-3.5 w-3.5" /> Imprimer
            </Link>
            <button
              onClick={() => cancel(r)}
              aria-label={r.cancelled ? "Rétablir" : "Annuler"}
              className="inline-flex items-center rounded-full border border-light-border p-2 text-light-muted transition hover:border-danger hover:text-danger dark:border-dark-border dark:text-dark-muted"
            >
              <Ban className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="rounded-md border border-dashed border-light-border p-8 text-center text-caption text-light-muted dark:border-dark-border dark:text-dark-muted">
            Aucune attestation délivrée.
          </li>
        )}
      </ul>
    </main>
  );
}
