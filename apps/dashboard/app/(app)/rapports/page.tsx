"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Printer, Download } from "lucide-react";
import {
  formatFCFA,
  DONATION_TYPE_LABELS,
  EXPENSE_CATEGORY_LABELS,
  PAYMENT_METHOD_LABELS,
  downloadCSV,
  type ExpenseCategory,
} from "@fitia/shared";
import type { ContributionRow, DonationRow, ExpenseRow, MosqueRow } from "@fitia/supabase";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

/**
 * Rapport financier périodique — destiné à être imprimé et présenté à l'assemblée
 * des fidèles. C'est l'exigence de transparence du cahier des charges.
 *
 * Seuls les montants VALIDÉS entrent dans le rapport : une déclaration en attente
 * n'est pas de l'argent encaissé, l'afficher fausserait la reddition de comptes.
 * Graphique en SVG écrit à la main — aucune bibliothèque à installer.
 */

const MONTHS = [
  "Jan",
  "Fév",
  "Mar",
  "Avr",
  "Mai",
  "Juin",
  "Juil",
  "Août",
  "Sep",
  "Oct",
  "Nov",
  "Déc",
];

type Movement = {
  date: string;
  nature: string;
  detail: string;
  method: string;
  amount: number;
  sens: "entree" | "sortie";
};

export default function RapportsPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [contributions, setContributions] = useState<ContributionRow[]>([]);
  const [donations, setDonations] = useState<DonationRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [mosque, setMosque] = useState<MosqueRow | null>(null);
  const configured = isSupabaseConfigured();

  const load = useCallback(async () => {
    if (!configured) return;
    const supabase = getSupabase();
    const from = `${year}-01-01`;
    const to = `${year}-12-31`;

    const [{ data: c }, { data: d }, { data: e }, { data: m }] = await Promise.all([
      supabase
        .from("contributions")
        .select("*")
        .eq("status", "valide")
        .gte("created_at", from)
        .lte("created_at", `${to}T23:59:59`),
      supabase
        .from("donations")
        .select("*")
        .eq("status", "valide")
        .gte("created_at", from)
        .lte("created_at", `${to}T23:59:59`),
      supabase.from("expenses").select("*").gte("spent_at", from).lte("spent_at", to),
      supabase.from("mosque").select("*").limit(1).maybeSingle(),
    ]);

    setContributions((c as ContributionRow[]) ?? []);
    setDonations((d as DonationRow[]) ?? []);
    setExpenses((e as ExpenseRow[]) ?? []);
    setMosque((m as MosqueRow) ?? null);
  }, [configured, year]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    const sum = (rows: { amount: number }[]) =>
      rows.reduce((acc, r) => acc + Number(r.amount), 0);

    const cotisations = sum(contributions);
    const sadaqah = sum(donations.filter((d) => d.type === "sadaqah"));
    const zakat = sum(donations.filter((d) => d.type === "zakat"));
    const campagnes = sum(donations.filter((d) => d.type === "campagne"));
    const depenses = sum(expenses);
    const entrees = cotisations + sadaqah + zakat + campagnes;

    const parCategorie = (Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[])
      .map((cat) => ({
        cat,
        montant: sum(expenses.filter((e) => e.category === cat)),
      }))
      .filter((r) => r.montant > 0)
      .sort((a, b) => b.montant - a.montant);

    return { cotisations, sadaqah, zakat, campagnes, entrees, depenses, solde: entrees - depenses, parCategorie };
  }, [contributions, donations, expenses]);

  /** Agrégats mensuels pour le graphique. */
  const monthly = useMemo(() => {
    const entrees = Array<number>(12).fill(0);
    const sorties = Array<number>(12).fill(0);

    for (const c of contributions) entrees[new Date(c.created_at).getMonth()] += Number(c.amount);
    for (const d of donations) entrees[new Date(d.created_at).getMonth()] += Number(d.amount);
    for (const e of expenses) {
      sorties[new Date(`${e.spent_at}T12:00:00`).getMonth()] += Number(e.amount);
    }
    return { entrees, sorties, max: Math.max(1, ...entrees, ...sorties) };
  }, [contributions, donations, expenses]);

  /** Toutes les écritures de l'exercice, pour l'export comptable. */
  const movements = useMemo<Movement[]>(
    () =>
      [
        ...contributions.map<Movement>((c) => ({
          date: c.created_at.slice(0, 10),
          nature: "Cotisation",
          detail: c.period,
          method: PAYMENT_METHOD_LABELS[c.method],
          amount: Number(c.amount),
          sens: "entree",
        })),
        ...donations.map<Movement>((d) => ({
          date: d.created_at.slice(0, 10),
          nature: DONATION_TYPE_LABELS[d.type],
          detail: d.reference ?? "",
          method: PAYMENT_METHOD_LABELS[d.method],
          amount: Number(d.amount),
          sens: "entree",
        })),
        ...expenses.map<Movement>((e) => ({
          date: e.spent_at,
          nature: EXPENSE_CATEGORY_LABELS[e.category],
          detail: e.label,
          method: "—",
          amount: Number(e.amount),
          sens: "sortie",
        })),
      ].sort((a, b) => a.date.localeCompare(b.date)),
    [contributions, donations, expenses],
  );

  /** Export comptable — séparateur `;` et BOM pour qu'Excel FR ouvre sans assistant. */
  /** Export comptable de l'exercice. */
  function exportCSV() {
    downloadCSV(
      `rapport-financier-${year}.csv`,
      ["Date", "Sens", "Nature", "Détail", "Moyen", "Montant FCFA"],
      movements.map((m) => [
        m.date,
        m.sens === "entree" ? "Entrée" : "Sortie",
        m.nature,
        m.detail,
        m.method,
        m.amount,
      ]),
    );
  }

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  // Graphique : barres appairées entrées / dépenses.
  const W = 720;
  const H = 220;
  const pad = 28;
  const slot = (W - pad * 2) / 12;
  const barW = slot / 2 - 3;
  const scale = (v: number) => ((H - pad * 2) * v) / monthly.max;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10 print:max-w-none print:px-0">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-emerald shadow-glow">
            <FileText className="h-5 w-5 text-white" />
          </span>
          <div>
            <h1 className="font-display text-h1">Rapport financier</h1>
            <p className="text-caption text-light-muted dark:text-dark-muted">
              À présenter à l&apos;assemblée des fidèles
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-md border border-light-border bg-transparent px-3 py-2 text-body outline-none focus:border-primary dark:border-dark-border"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                Exercice {y}
              </option>
            ))}
          </select>
          <button
            onClick={exportCSV}
            disabled={movements.length === 0}
            className="inline-flex items-center gap-2 rounded-full border border-light-border px-4 py-2 text-caption transition hover:border-primary hover:text-primary disabled:opacity-50 dark:border-dark-border"
          >
            <Download className="h-4 w-4" /> Export comptable
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 font-medium text-white transition hover:bg-primary-hover hover:shadow-glow"
          >
            <Printer className="h-4 w-4" /> Imprimer / PDF
          </button>
        </div>
      </header>

      {/* En-tête d'impression */}
      <div className="mb-6 hidden print:block">
        <p className="text-caption">{mosque?.name ?? "Mosquée"}</p>
        <h1 className="font-display text-h1">Rapport financier — exercice {year}</h1>
        <p className="text-caption">
          Édité le {new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date())}
        </p>
      </div>

      {/* Synthèse */}
      <section className="mb-8 grid gap-4 sm:grid-cols-3">
        <article className="rounded-md border border-light-border bg-light-surface p-5 dark:border-dark-border dark:bg-dark-surface">
          <p className="text-caption text-light-muted dark:text-dark-muted">Total des entrées</p>
          <p className="font-display text-h2 text-success">{formatFCFA(totals.entrees)}</p>
        </article>
        <article className="rounded-md border border-light-border bg-light-surface p-5 dark:border-dark-border dark:bg-dark-surface">
          <p className="text-caption text-light-muted dark:text-dark-muted">Total des dépenses</p>
          <p className="font-display text-h2 text-danger">{formatFCFA(totals.depenses)}</p>
        </article>
        <article className="rounded-md border border-light-border bg-light-surface p-5 dark:border-dark-border dark:bg-dark-surface">
          <p className="text-caption text-light-muted dark:text-dark-muted">Solde de l&apos;exercice</p>
          <p
            className={`font-display text-h2 ${totals.solde >= 0 ? "text-primary" : "text-danger"}`}
          >
            {formatFCFA(totals.solde)}
          </p>
        </article>
      </section>

      {/* Détail des entrées */}
      <h2 className="mb-3 font-display text-h3">Origine des entrées</h2>
      <div className="mb-8 overflow-x-auto rounded-md border border-light-border dark:border-dark-border">
        <table className="w-full text-left text-body">
          <tbody>
            {[
              ["Cotisations des membres", totals.cotisations],
              ["Sadaqah", totals.sadaqah],
              ["Zakat", totals.zakat],
              ["Dons de campagne", totals.campagnes],
            ].map(([label, montant]) => (
              <tr
                key={String(label)}
                className="border-b border-light-border last:border-0 dark:border-dark-border"
              >
                <td className="px-4 py-3">{label}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatFCFA(Number(montant))}
                </td>
                <td className="w-24 px-4 py-3 text-right text-caption text-light-muted dark:text-dark-muted">
                  {totals.entrees > 0
                    ? `${Math.round((Number(montant) / totals.entrees) * 100)}%`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Détail des dépenses */}
      <h2 className="mb-3 font-display text-h3">Répartition des dépenses</h2>
      <div className="mb-8 overflow-x-auto rounded-md border border-light-border dark:border-dark-border">
        <table className="w-full text-left text-body">
          <tbody>
            {totals.parCategorie.map(({ cat, montant }) => (
              <tr
                key={cat}
                className="border-b border-light-border last:border-0 dark:border-dark-border"
              >
                <td className="px-4 py-3">{EXPENSE_CATEGORY_LABELS[cat]}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatFCFA(montant)}</td>
                <td className="w-24 px-4 py-3 text-right text-caption text-light-muted dark:text-dark-muted">
                  {totals.depenses > 0 ? `${Math.round((montant / totals.depenses) * 100)}%` : "—"}
                </td>
              </tr>
            ))}
            {totals.parCategorie.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-center text-caption text-light-muted dark:text-dark-muted">
                  Aucune dépense sur l&apos;exercice.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Évolution mensuelle */}
      <h2 className="mb-3 font-display text-h3">Évolution mensuelle</h2>
      <div className="mb-8 overflow-x-auto rounded-md border border-light-border bg-light-surface p-4 dark:border-dark-border dark:bg-dark-surface">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-56 w-full min-w-[640px]" role="img"
          aria-label={`Entrées et dépenses mois par mois pour l'exercice ${year}`}>
          <line
            x1={pad}
            y1={H - pad}
            x2={W - pad}
            y2={H - pad}
            className="stroke-light-border dark:stroke-dark-border"
            strokeWidth={1}
          />
          {MONTHS.map((label, i) => {
            const x = pad + i * slot;
            const hIn = scale(monthly.entrees[i] ?? 0);
            const hOut = scale(monthly.sorties[i] ?? 0);
            return (
              <g key={label}>
                <rect
                  x={x + 2}
                  y={H - pad - hIn}
                  width={barW}
                  height={hIn}
                  rx={2}
                  className="fill-primary"
                />
                <rect
                  x={x + barW + 5}
                  y={H - pad - hOut}
                  width={barW}
                  height={hOut}
                  rx={2}
                  className="fill-danger"
                />
                <text
                  x={x + slot / 2}
                  y={H - pad + 14}
                  textAnchor="middle"
                  className="fill-light-muted text-[10px] dark:fill-dark-muted"
                >
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="mt-2 flex gap-4 text-caption text-light-muted dark:text-dark-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary" /> Entrées
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-danger" /> Dépenses
          </span>
          <span>Échelle max : {formatFCFA(monthly.max)}</span>
        </div>
      </div>

      <p className="text-caption text-light-muted dark:text-dark-muted print:text-neutral-600">
        Seules les entrées validées par le trésorier figurent dans ce rapport.
        {movements.length > 0 && ` ${movements.length} écritures sur l'exercice.`}
      </p>
    </main>
  );
}
