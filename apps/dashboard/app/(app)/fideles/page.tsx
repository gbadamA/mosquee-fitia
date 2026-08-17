"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Users, Search, Download, UserPlus, FileUp } from "lucide-react";
import {
  MEMBER_STATUS_LABELS,
  MEMBER_CATEGORY_LABELS,
  ROLE_LABELS,
  ROLES_ADMIN,
  normalizePhoneCI,
  formatPhoneCI,
  formatFCFA,
  formatPeriod,
  downloadCSV,
  csvFilename,
  type MemberCategory,
  type MemberStatus,
  type Profile,
  type Role,
} from "@fitia/shared";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { invokeEdge } from "@/lib/edge";
import { useAuth } from "@/lib/auth";
import MemberDrawer from "./MemberDrawer";

const STATUS_STYLE: Record<MemberStatus, string> = {
  actif: "bg-success/15 text-success",
  en_attente: "bg-warning/15 text-warning",
  inactif: "bg-light-surface-alt text-light-muted dark:bg-dark-surface-alt dark:text-dark-muted",
};

/** Qui peut enregistrer un nouveau fidèle. */
const CAN_CREATE: Role[] = ["secretaire", "imam", "admin"];

const CATEGORIES = Object.keys(MEMBER_CATEGORY_LABELS) as MemberCategory[];

export default function FidelesPage() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Profile[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<MemberStatus | "tous">("tous");
  const [loading, setLoading] = useState(true);
  const configured = isSupabaseConfigured();

  // Formulaire de création
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [quartier, setQuartier] = useState("");
  const [category, setCategory] = useState<MemberCategory>("membre_actif");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  /** Arriérés par fidèle — agrégat SQL `contribution_arrears()`. */
  const [arrears, setArrears] = useState<Map<string, { months: number; amount: number; oldest: string | null }>>(new Map());

  // Fiche détaillée
  const [selected, setSelected] = useState<Profile | null>(null);

  /** Identifiants à remettre au fidèle — affichés UNE SEULE FOIS après création. */
  const [credentials, setCredentials] = useState<{
    nom: string;
    phone: string;
    password: string;
  } | null>(null);

  // Import en masse
  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState<string[] | null>(null);

  const canCreate = Boolean(profile && CAN_CREATE.includes(profile.role));

  const load = useCallback(async () => {
    if (!configured) {
      setLoading(false);
      return;
    }
    const supabase = getSupabase();
    const [{ data }, { data: due }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.rpc("contribution_arrears"),
    ]);

    setRows((data as Profile[]) ?? []);
    setArrears(
      new Map(
        (due ?? []).map((r) => [
          r.member_id,
          { months: r.months_due, amount: Number(r.amount_due), oldest: r.oldest_unpaid },
        ]),
      ),
    );
    setLoading(false);
  }, [configured]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * La création passe par l'Edge Function `create-member` : un profil ne peut pas
   * exister sans utilisateur `auth`, et créer un utilisateur exige la clé
   * service_role — qui ne doit jamais atteindre le navigateur.
   */
  async function createFidele(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (fullName.trim().length < 3) {
      setError("Nom trop court.");
      return;
    }
    const normalized = normalizePhoneCI(phone);
    if (normalized.length < 12) {
      setError("Numéro de téléphone incomplet.");
      return;
    }

    setBusy(true);
    const { data, error: failure } = await invokeEdge<{ password?: string }>("create-member", {
      kind: "fidele",
      full_name: fullName.trim(),
      phone: normalized,
      quartier: quartier.trim() || null,
      category,
    });
    setBusy(false);

    if (failure) {
      setError(failure);
      return;
    }

    const issued = data?.password;
    if (issued) {
      // Supabase ne conserve ce mot de passe que haché : c'est le seul instant où
      // il est lisible. S'il n'est pas noté maintenant, il faudra en émettre un
      // nouveau depuis la fiche du fidèle.
      setCredentials({ nom: fullName.trim(), phone: normalized, password: issued });
    }
    setMessage(`${fullName.trim()} enregistré.`);
    setFullName("");
    setPhone("");
    setQuartier("");
    setOpen(false);
    load();
  }


  /**
   * Import en masse depuis un fichier CSV (§2.1 du cahier).
   *
   * Colonnes attendues, dans cet ordre : nom ; téléphone ; quartier ; catégorie.
   * Une première ligne d'en-tête est détectée et ignorée. Le séparateur est
   * deviné (`;` d'Excel FR ou `,`).
   *
   * Les créations passent une par une par l'Edge Function — c'est plus lent qu'un
   * INSERT en lot, mais c'est le seul chemin qui crée aussi l'utilisateur `auth`,
   * et ça permet de rapporter précisément quelle ligne a échoué.
   */
  async function importCSV(file: File) {
    setError(null);
    setMessage(null);
    setImportReport(null);
    setImporting(true);

    const text = await file.text();
    const lines = text
      .replace(/^﻿/, "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      setImporting(false);
      setError("Fichier vide.");
      return;
    }

    const separator = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
    const split = (line: string) =>
      line.split(separator).map((c) => c.trim().replace(/^"|"$/g, ""));

    // En-tête : on la reconnaît à un intitulé, pas à un numéro de téléphone.
    const first = split(lines[0]);
    const hasHeader = /nom|name/i.test(first[0] ?? "");
    const dataLines = hasHeader ? lines.slice(1) : lines;

    const report: string[] = [];
    let created = 0;
    const supabase = getSupabase();

    for (const [index, line] of dataLines.entries()) {
      const numero = hasHeader ? index + 2 : index + 1;
      const [nom, tel, quartierCsv, categorieCsv] = split(line);

      if (!nom || nom.length < 3) {
        report.push(`Ligne ${numero} : nom manquant ou trop court — ignorée.`);
        continue;
      }
      const normalized = normalizePhoneCI(tel ?? "");
      if (normalized.length < 12) {
        report.push(`Ligne ${numero} (${nom}) : numéro invalide — ignorée.`);
        continue;
      }

      // Catégorie tolérante : on accepte le libellé français ou la clé technique.
      const cat =
        CATEGORIES.find(
          (c) =>
            c === categorieCsv?.toLowerCase() ||
            MEMBER_CATEGORY_LABELS[c].toLowerCase() === categorieCsv?.toLowerCase(),
        ) ?? "membre_actif";

      const { error: failure } = await invokeEdge("create-member", {
        kind: "fidele",
        full_name: nom,
        phone: normalized,
        quartier: quartierCsv || null,
        category: cat,
      });

      if (failure) report.push(`Ligne ${numero} (${nom}) : ${failure}`);
      else created += 1;
    }

    setImporting(false);
    setMessage(`${created} fidèle(s) importé(s) sur ${dataLines.length} ligne(s).`);
    if (report.length > 0) setImportReport(report);
    load();
  }

  /** Modèle CSV à remplir — évite les erreurs de colonnes. */
  function downloadTemplate() {
    const content =
      "\ufeffNom;Telephone;Quartier;Categorie\n" +
      "Ibrahim Konate;0709112233;Abobo Sagbe;Membre actif\n";
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modele-import-fideles.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "tous" && r.status !== status) return false;
      if (!q) return true;
      return [r.full_name, r.phone, r.quartier, r.member_number]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rows, query, status]);

  /** Export CSV — le helper partagé gère BOM, séparateur et déclenchement réel. */
  /** Export CSV — le helper partagé gère le BOM, le séparateur et le déclenchement réel. */
  function exportCSV() {
    downloadCSV(
      csvFilename("fideles-mosquee-fitia"),
      ["N° adhérent", "Nom", "Téléphone", "Quartier", "Catégorie", "Mois dus", "Arriéré FCFA", "Statut", "Rôle"],
      filtered.map((r) => [
        r.member_number ?? "",
        r.full_name ?? "",
        formatPhoneCI(r.phone),
        r.quartier ?? "",
        MEMBER_CATEGORY_LABELS[r.category],
        arrears.get(r.id)?.months ?? 0,
        arrears.get(r.id)?.amount ?? 0,
        MEMBER_STATUS_LABELS[r.status],
        ROLE_LABELS[r.role],
      ]),
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-emerald shadow-glow">
            <Users className="h-5 w-5 text-white" />
          </span>
          <div>
            <h1 className="font-display text-h1">Fidèles</h1>
            <p className="text-caption text-light-muted dark:text-dark-muted">
              {filtered.length} sur {rows.length} inscrits
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-2 rounded-full border border-light-border px-4 py-2 text-caption transition hover:border-primary hover:text-primary disabled:opacity-50 dark:border-dark-border"
          >
            <Download className="h-4 w-4" /> Exporter CSV
          </button>
          {canCreate && (
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-light-border px-4 py-2 text-caption transition hover:border-primary hover:text-primary dark:border-dark-border">
              <FileUp className="h-4 w-4" />
              {importing ? "Import en cours…" : "Importer CSV"}
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                disabled={importing}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importCSV(f);
                  e.target.value = "";
                }}
              />
            </label>
          )}
          {canCreate && (
            <button
              onClick={() => setOpen((o) => !o)}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 font-medium text-white transition hover:bg-primary-hover hover:shadow-glow"
            >
              <UserPlus className="h-4 w-4" /> {open ? "Fermer" : "Ajouter un fidèle"}
            </button>
          )}
        </div>
      </header>

      {message && (
        <div className="mb-5 rounded-md border border-success/40 bg-success/10 p-4 text-caption text-success">
          {message}
        </div>
      )}

      {/* Identifiants à recopier AVANT de fermer : ils ne réapparaîtront pas. */}
      {credentials && (
        <section className="mb-5 rounded-lg border-2 border-secondary bg-secondary/10 p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-h3">
                Identifiants de {credentials.nom}
              </p>
              <p className="text-caption text-light-muted dark:text-dark-muted">
                Notez-les et remettez-les au fidèle <strong>maintenant</strong> :
                ce mot de passe ne sera plus jamais affiché.
              </p>
            </div>
            <button
              onClick={() => setCredentials(null)}
              className="shrink-0 rounded-full border border-light-border px-4 py-1.5 text-caption transition hover:border-primary dark:border-dark-border"
            >
              J&apos;ai noté
            </button>
          </div>
          <dl className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-md bg-light-surface p-3 dark:bg-dark-surface">
              <dt className="text-caption text-light-muted dark:text-dark-muted">
                Numéro de connexion
              </dt>
              <dd className="font-mono text-h3">{formatPhoneCI(credentials.phone)}</dd>
            </div>
            <div className="rounded-md bg-light-surface p-3 dark:bg-dark-surface">
              <dt className="text-caption text-light-muted dark:text-dark-muted">
                Mot de passe
              </dt>
              <dd className="font-mono text-h3 tracking-widest">{credentials.password}</dd>
            </div>
          </dl>
        </section>
      )}

      {open && canCreate && (
        <form
          onSubmit={createFidele}
          className="mb-6 rounded-lg border border-light-border bg-light-surface p-5 shadow-card dark:border-dark-border dark:bg-dark-surface"
        >
          <p className="mb-4 text-caption text-light-muted dark:text-dark-muted">
            Pour un fidèle qui n&apos;installera pas l&apos;application. Le numéro sert
            d&apos;identifiant : s&apos;il installe l&apos;app plus tard, il retrouvera ce même
            compte en se connectant avec ce numéro.
          </p>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nom et prénoms"
              className="rounded-md border border-light-border bg-transparent px-3 py-2.5 text-body outline-none focus:border-primary dark:border-dark-border"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              placeholder="Téléphone (07 00 00 00 00)"
              className="rounded-md border border-light-border bg-transparent px-3 py-2.5 text-body outline-none focus:border-primary dark:border-dark-border"
            />
            <input
              value={quartier}
              onChange={(e) => setQuartier(e.target.value)}
              placeholder="Quartier (facultatif)"
              className="rounded-md border border-light-border bg-transparent px-3 py-2.5 text-body outline-none focus:border-primary dark:border-dark-border"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as MemberCategory)}
              className="rounded-md border border-light-border bg-transparent px-3 py-2.5 text-body outline-none focus:border-primary dark:border-dark-border"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {MEMBER_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-medium text-white transition hover:bg-primary-hover hover:shadow-glow disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4" /> {busy ? "Enregistrement…" : "Enregistrer"}
          </button>
          {error && <p className="mt-3 text-caption text-danger">{error}</p>}
        </form>
      )}

      <div className="mb-5 flex flex-wrap gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-light-muted dark:text-dark-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nom, téléphone, quartier, n° adhérent…"
            className="w-full rounded-md border border-light-border bg-transparent py-2.5 pl-9 pr-4 text-body outline-none focus:border-primary dark:border-dark-border"
          />
        </div>
        <div className="flex gap-2">
          {(["tous", "actif", "en_attente", "inactif"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-full px-3.5 py-2 text-caption transition ${
                status === s
                  ? "bg-primary text-white"
                  : "border border-light-border text-light-muted hover:border-primary dark:border-dark-border dark:text-dark-muted"
              }`}
            >
              {s === "tous" ? "Tous" : MEMBER_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-light-border dark:border-dark-border">
        <table className="w-full min-w-[720px] text-left text-body">
          <thead className="bg-light-surface-alt text-caption text-light-muted dark:bg-dark-surface-alt dark:text-dark-muted">
            <tr>
              <th className="px-4 py-3">N° adhérent</th>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Téléphone</th>
              <th className="px-4 py-3">Quartier</th>
              <th className="px-4 py-3">Catégorie</th>
              <th className="px-4 py-3">Cotisation</th>
              <th className="px-4 py-3">Statut</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.id}
                onClick={() => setSelected(r)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(r);
                  }
                }}
                className="cursor-pointer border-t border-light-border transition hover:bg-light-surface-alt dark:border-dark-border dark:hover:bg-dark-surface-alt"
              >
                <td className="px-4 py-3 font-mono text-caption text-primary">
                  {r.member_number ?? "—"}
                </td>
                <td className="px-4 py-3 font-medium">{r.full_name ?? "Sans nom"}</td>
                <td className="px-4 py-3 tabular-nums">{formatPhoneCI(r.phone)}</td>
                <td className="px-4 py-3">{r.quartier ?? "—"}</td>
                <td className="px-4 py-3 text-caption">{MEMBER_CATEGORY_LABELS[r.category]}</td>
                <td className="px-4 py-3">
                  {(() => {
                    // Le personnel ne cotise pas : afficher « À jour » serait trompeur.
                    if (r.role !== "fidele") {
                      return (
                        <span className="text-caption text-light-muted dark:text-dark-muted">
                          —
                        </span>
                      );
                    }
                    const a = arrears.get(r.id);
                    if (!a || a.months === 0) {
                      return <span className="text-caption text-success">À jour</span>;
                    }
                    return (
                      <span className="text-caption text-danger">
                        {a.months} mois · {formatFCFA(a.amount)}
                        {a.oldest && (
                          <span className="block text-light-muted dark:text-dark-muted">
                            depuis {formatPeriod(a.oldest)}
                          </span>
                        )}
                      </span>
                    );
                  })()}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-caption font-medium ${STATUS_STYLE[r.status]}`}
                  >
                    {MEMBER_STATUS_LABELS[r.status]}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-caption text-light-muted dark:text-dark-muted"
                >
                  {loading ? "Chargement…" : "Aucun fidèle ne correspond à ces critères."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {importReport && (
        <section className="mt-6 rounded-md border border-warning/40 bg-warning/10 p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-caption font-medium text-warning">
              {importReport.length} ligne(s) non importée(s)
            </p>
            <button
              onClick={() => setImportReport(null)}
              className="text-caption text-warning hover:underline"
            >
              Masquer
            </button>
          </div>
          <ul className="space-y-1 text-caption text-warning">
            {importReport.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </section>
      )}

      {canCreate && (
        <p className="mt-4 text-caption text-light-muted dark:text-dark-muted">
          Import en masse : colonnes <code>Nom ; Téléphone ; Quartier ; Catégorie</code>.{" "}
          <button onClick={downloadTemplate} className="text-primary hover:underline">
            Télécharger un modèle
          </button>
        </p>
      )}

      {selected && (
        <MemberDrawer
          member={selected}
          canEditRole={Boolean(profile && ROLES_ADMIN.includes(profile.role))}
          onClose={() => setSelected(null)}
          onSaved={load}
        />
      )}
    </main>
  );
}
