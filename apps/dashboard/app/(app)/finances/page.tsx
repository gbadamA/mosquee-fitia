"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Wallet,
  Check,
  X,
  Plus,
  TrendingUp,
  TrendingDown,
  HandCoins,
  Receipt,
  Image as ImageIcon,
  ImageOff,
} from "lucide-react";
import {
  formatFCFA,
  createExpenseSchema,
  amountSchema,
  PAYMENT_METHOD_LABELS,
  DONATION_TYPE_LABELS,
  EXPENSE_CATEGORY_LABELS,
  todayISO,
  type ExpenseCategory,
  type PaymentMethod,
  type Profile,
} from "@fitia/shared";
import type { CampaignRow, ContributionRow, DonationRow, ExpenseRow } from "@fitia/supabase";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

/** Ligne « en attente » unifiée : une cotisation et un don se valident pareil. */
type Pending = {
  kind: "cotisation" | "don";
  id: string;
  amount: number;
  method: keyof typeof PAYMENT_METHOD_LABELS;
  reference: string | null;
  detail: string;
  created_at: string;
  /** Pour une cotisation : le fidèle à passer en `actif` une fois validé. */
  memberId: string | null;
  /** Justificatif joint par le fidèle depuis le mobile (bucket `justificatifs`). */
  proofPath: string | null;
};

const EXPENSE_CATEGORIES = Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[];
const METHODS = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[];

/** Natures d'entrée saisissables au guichet. */
type EntryKind = "cotisation" | "sadaqah" | "zakat" | "campagne";
const ENTRY_KINDS: { key: EntryKind; label: string }[] = [
  { key: "cotisation", label: "Cotisation" },
  { key: "sadaqah", label: DONATION_TYPE_LABELS.sadaqah },
  { key: "zakat", label: DONATION_TYPE_LABELS.zakat },
  { key: "campagne", label: "Campagne" },
];

/** Mois courant, `YYYY-MM`. */
function currentPeriod(): string {
  return todayISO().slice(0, 7);
}

export default function FinancesPage() {
  const { profile } = useAuth();
  const [contributions, setContributions] = useState<ContributionRow[]>([]);
  const [donations, setDonations] = useState<DonationRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const configured = isSupabaseConfigured();

  // Formulaire dépense
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("entretien");
  const [spentAt, setSpentAt] = useState(todayISO());

  // Formulaire d'entrée (guichet)
  const [members, setMembers] = useState<Profile[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [entryKind, setEntryKind] = useState<EntryKind>("cotisation");
  const [entryAmount, setEntryAmount] = useState("");
  const [entryMethod, setEntryMethod] = useState<PaymentMethod>("especes");
  const [entryMember, setEntryMember] = useState("");
  const [entryReference, setEntryReference] = useState("");
  const [entryPeriod, setEntryPeriod] = useState(currentPeriod());
  const [entryCampaign, setEntryCampaign] = useState("");
  const [entryBusy, setEntryBusy] = useState(false);
  const [entryMessage, setEntryMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!configured) return;
    const supabase = getSupabase();
    const [c, d, e, m, ca] = await Promise.all([
      supabase.from("contributions").select("*").order("created_at", { ascending: false }),
      supabase.from("donations").select("*").order("created_at", { ascending: false }),
      supabase.from("expenses").select("*").order("spent_at", { ascending: false }),
      supabase.from("profiles").select("*").eq("role", "fidele").order("full_name"),
      supabase.from("campaigns").select("*").eq("active", true).order("name"),
    ]);
    setContributions((c.data as ContributionRow[]) ?? []);
    setDonations((d.data as DonationRow[]) ?? []);
    setExpenses((e.data as ExpenseRow[]) ?? []);
    setMembers((m.data as Profile[]) ?? []);
    setCampaigns((ca.data as CampaignRow[]) ?? []);
  }, [configured]);

  useEffect(() => {
    load();
    if (!configured) return;
    const supabase = getSupabase();
    // Une déclaration faite depuis le mobile apparaît sans rafraîchir la page.
    const channel = supabase
      .channel("dashboard:finances")
      .on("postgres_changes", { event: "*", schema: "public", table: "contributions" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "donations" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [configured, load]);

  const sum = (rows: { amount: number; status?: string }[], onlyValid = true) =>
    rows
      .filter((r) => !onlyValid || r.status === "valide")
      .reduce((acc, r) => acc + Number(r.amount), 0);

  const totalCotisations = sum(contributions);
  const totalDons = sum(donations);
  const totalDepenses = expenses.reduce((acc, r) => acc + Number(r.amount), 0);
  const solde = totalCotisations + totalDons - totalDepenses;

  const pending: Pending[] = [
    ...contributions
      .filter((c) => c.status === "en_attente")
      .map<Pending>((c) => ({
        kind: "cotisation",
        id: c.id,
        amount: Number(c.amount),
        method: c.method,
        reference: c.reference,
        proofPath: c.proof_path,
        detail: `Cotisation ${c.period}`,
        created_at: c.created_at,
        memberId: c.member_id,
      })),
    ...donations
      .filter((d) => d.status === "en_attente")
      .map<Pending>((d) => ({
        kind: "don",
        id: d.id,
        amount: Number(d.amount),
        method: d.method,
        reference: d.reference,
        proofPath: d.proof_path,
        detail: DONATION_TYPE_LABELS[d.type],
        created_at: d.created_at,
        // Sert à l'affichage du nom ; un don peut être anonyme.
        memberId: d.donor_id,
      })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at));

  /** Entrées validées, toutes natures confondues — la source des reçus. */
  const validated: Pending[] = [
    ...contributions
      .filter((c) => c.status === "valide")
      .map<Pending>((c) => ({
        kind: "cotisation",
        id: c.id,
        amount: Number(c.amount),
        method: c.method,
        reference: c.reference,
        proofPath: c.proof_path,
        detail: `Cotisation ${c.period}`,
        created_at: c.created_at,
        memberId: c.member_id,
      })),
    ...donations
      .filter((d) => d.status === "valide")
      .map<Pending>((d) => ({
        kind: "don",
        id: d.id,
        amount: Number(d.amount),
        method: d.method,
        reference: d.reference,
        proofPath: d.proof_path,
        detail: DONATION_TYPE_LABELS[d.type],
        created_at: d.created_at,
        memberId: d.anonymous ? null : d.donor_id,
      })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at));

  /**
   * Ouvre le justificatif joint par le fidèle.
   * Le bucket est privé : on génère une URL signée courte plutôt que d'exposer
   * les reçus de paiement de toute la communauté derrière une adresse devinable.
   */
  async function viewProof(row: Pending) {
    if (!row.proofPath) return;
    setError(null);
    const { data, error: signError } = await getSupabase()
      .storage.from("justificatifs")
      .createSignedUrl(row.proofPath, 120);
    if (signError || !data) {
      setError(signError?.message ?? "Justificatif introuvable");
      return;
    }
    window.open(data.signedUrl, "_blank", "noreferrer");
  }

  async function decide(row: Pending, approve: boolean) {
    setBusyId(row.id);
    setError(null);
    const supabase = getSupabase();
    // Deux appels distincts plutôt qu'un `from(table)` paramétré : passer une union
    // de noms de tables à supabase-js fait s'effondrer le typage du payload.
    const patch = {
      status: (approve ? "valide" : "rejete") as "valide" | "rejete",
      validated_by: profile?.id ?? null,
      validated_at: new Date().toISOString(),
    };

    const { error: dbError } =
      row.kind === "cotisation"
        ? await supabase.from("contributions").update(patch).eq("id", row.id)
        : await supabase.from("donations").update(patch).eq("id", row.id);

    // Une COTISATION validée met le fidèle « à jour » — un don, non.
    if (!dbError && approve && row.kind === "cotisation" && row.memberId) {
      await supabase.from("profiles").update({ status: "actif" }).eq("id", row.memberId);
    }

    setBusyId(null);
    if (dbError) setError(dbError.message);
    else load();
  }

  /**
   * Enregistrement direct d'une entrée par le trésorier (espèces au guichet,
   * transfert reçu, don de la main à la main…).
   * Statut `valide` d'emblée : l'argent est déjà encaissé, il n'y a rien à valider.
   */
  async function recordEntry(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEntryMessage(null);

    const parsedAmount = amountSchema.safeParse(Number(entryAmount));
    if (!parsedAmount.success) {
      setError(parsedAmount.error.issues[0]?.message ?? "Montant invalide");
      return;
    }
    if (entryKind === "cotisation" && !entryMember) {
      setError("Une cotisation doit être rattachée à un fidèle.");
      return;
    }
    if (entryKind === "campagne" && !entryCampaign) {
      setError("Choisissez la campagne concernée.");
      return;
    }

    setEntryBusy(true);
    const supabase = getSupabase();
    const validation = {
      status: "valide" as const,
      validated_by: profile?.id ?? null,
      validated_at: new Date().toISOString(),
    };

    const { error: dbError } =
      entryKind === "cotisation"
        ? await supabase.from("contributions").insert({
            member_id: entryMember,
            amount: parsedAmount.data,
            method: entryMethod,
            reference: entryReference.trim() || null,
            period: entryPeriod,
            ...validation,
          })
        : await supabase.from("donations").insert({
            donor_id: entryMember || null,
            campaign_id: entryKind === "campagne" ? entryCampaign : null,
            amount: parsedAmount.data,
            type: entryKind === "campagne" ? "campagne" : entryKind,
            method: entryMethod,
            reference: entryReference.trim() || null,
            anonymous: !entryMember,
            ...validation,
          });

    setEntryBusy(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }

    // Une cotisation encaissée met le fidèle « à jour ».
    if (entryKind === "cotisation" && entryMember) {
      await supabase.from("profiles").update({ status: "actif" }).eq("id", entryMember);
    }

    setEntryMessage(`${formatFCFA(parsedAmount.data)} enregistré.`);
    setEntryAmount("");
    setEntryReference("");
    load();
  }

  async function addExpense(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = createExpenseSchema.safeParse({
      label,
      amount: Number(amount),
      category,
      spent_at: spentAt,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Formulaire invalide");
      return;
    }
    const { error: dbError } = await getSupabase()
      .from("expenses")
      .insert({ ...parsed.data, created_by: profile?.id ?? null });
    if (dbError) {
      setError(dbError.message);
      return;
    }
    setLabel("");
    setAmount("");
    load();
  }

  /**
   * Cotisation déjà encaissée pour ce fidèle et ce mois ?
   * On avertit sans bloquer : un versement en deux fois reste légitime, mais
   * ressaisir la même cotisation par inadvertance ferait payer deux fois.
   */
  const doublon =
    entryKind === "cotisation" && entryMember
      ? contributions.find(
          (c) => c.member_id === entryMember && c.period === entryPeriod && c.status === "valide",
        )
      : undefined;

  const kpis = [
    { label: "Cotisations", value: formatFCFA(totalCotisations), icon: TrendingUp, tone: "text-success" },
    { label: "Dons & Zakat", value: formatFCFA(totalDons), icon: TrendingUp, tone: "text-success" },
    { label: "Dépenses", value: formatFCFA(totalDepenses), icon: TrendingDown, tone: "text-danger" },
    {
      label: "Solde",
      value: formatFCFA(solde),
      icon: Wallet,
      tone: solde >= 0 ? "text-primary" : "text-danger",
    },
  ];

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8 flex items-center gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-emerald shadow-glow">
          <Wallet className="h-5 w-5 text-white" />
        </span>
        <div>
          <h1 className="font-display text-h1">Finances</h1>
          <p className="text-caption text-light-muted dark:text-dark-muted">
            Seuls les montants <strong>validés</strong> entrent dans les totaux
          </p>
        </div>
      </header>

      {error && (
        <div className="mb-6 rounded-md border border-danger/40 bg-danger/10 p-4 text-caption text-danger">
          {error}
        </div>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(({ label: l, value, icon: Icon, tone }) => (
          <article
            key={l}
            className="rounded-md border border-light-border bg-light-surface p-5 dark:border-dark-border dark:bg-dark-surface"
          >
            <Icon className={`mb-3 h-4 w-4 ${tone}`} />
            <p className="text-caption text-light-muted dark:text-dark-muted">{l}</p>
            <p className={`font-display text-h3 ${tone}`}>{value}</p>
          </article>
        ))}
      </div>

      {/* Saisie directe — le cas le plus courant : espèces reçues à la mosquée */}
      <h2 className="mb-3 flex items-center gap-2 font-display text-h3">
        <HandCoins className="h-4 w-4 text-primary" /> Enregistrer une entrée
      </h2>
      <form
        onSubmit={recordEntry}
        className="mb-10 rounded-lg border border-light-border bg-light-surface p-5 shadow-card dark:border-dark-border dark:bg-dark-surface"
      >
        <div className="mb-4 flex flex-wrap gap-2">
          {ENTRY_KINDS.map((k) => (
            <button
              type="button"
              key={k.key}
              onClick={() => setEntryKind(k.key)}
              className={`rounded-full px-4 py-1.5 text-caption font-medium transition ${
                entryKind === k.key
                  ? "bg-primary text-white"
                  : "border border-light-border text-light-muted hover:border-primary dark:border-dark-border dark:text-dark-muted"
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-caption text-light-muted dark:text-dark-muted">
              Montant (FCFA)
            </label>
            <input
              value={entryAmount}
              onChange={(e) => setEntryAmount(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              placeholder="0"
              className="w-full rounded-md border border-light-border bg-transparent px-3 py-2.5 text-body outline-none focus:border-primary dark:border-dark-border"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-caption text-light-muted dark:text-dark-muted">
              Moyen de paiement
            </label>
            <select
              value={entryMethod}
              onChange={(e) => setEntryMethod(e.target.value as PaymentMethod)}
              className="w-full rounded-md border border-light-border bg-transparent px-3 py-2.5 text-body outline-none focus:border-primary dark:border-dark-border"
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABELS[m]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-caption text-light-muted dark:text-dark-muted">
              Fidèle {entryKind === "cotisation" ? "" : "(laisser vide = anonyme)"}
            </label>
            <select
              value={entryMember}
              onChange={(e) => setEntryMember(e.target.value)}
              className="w-full rounded-md border border-light-border bg-transparent px-3 py-2.5 text-body outline-none focus:border-primary dark:border-dark-border"
            >
              <option value="">
                {entryKind === "cotisation" ? "— choisir —" : "Donateur anonyme"}
              </option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name ?? "Sans nom"}
                  {m.member_number ? ` · ${m.member_number}` : ""}
                </option>
              ))}
            </select>
          </div>

          {entryKind === "cotisation" && (
            <div>
              <label className="mb-1.5 block text-caption text-light-muted dark:text-dark-muted">
                Mois couvert
              </label>
              <input
                type="month"
                value={entryPeriod}
                onChange={(e) => setEntryPeriod(e.target.value)}
                className="w-full rounded-md border border-light-border bg-transparent px-3 py-2.5 text-body outline-none focus:border-primary dark:border-dark-border"
              />
            </div>
          )}

          {entryKind === "campagne" && (
            <div>
              <label className="mb-1.5 block text-caption text-light-muted dark:text-dark-muted">
                Campagne
              </label>
              <select
                value={entryCampaign}
                onChange={(e) => setEntryCampaign(e.target.value)}
                className="w-full rounded-md border border-light-border bg-transparent px-3 py-2.5 text-body outline-none focus:border-primary dark:border-dark-border"
              >
                <option value="">— choisir —</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-caption text-light-muted dark:text-dark-muted">
              Référence / reçu (facultatif)
            </label>
            <input
              value={entryReference}
              onChange={(e) => setEntryReference(e.target.value)}
              placeholder="N° de transaction ou de reçu"
              className="w-full rounded-md border border-light-border bg-transparent px-3 py-2.5 text-body outline-none focus:border-primary dark:border-dark-border"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-caption text-light-muted dark:text-dark-muted">
            Saisie par le trésorier : l&apos;entrée compte immédiatement dans le solde.
          </p>
          <button
            type="submit"
            disabled={entryBusy || !entryAmount}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-medium text-white transition hover:bg-primary-hover hover:shadow-glow disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> {entryBusy ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
        {doublon && (
          <p className="mt-3 rounded-md border border-warning/40 bg-warning/10 p-3 text-caption text-warning">
            ⚠️ Une cotisation de {formatFCFA(Number(doublon.amount))} est déjà enregistrée pour ce
            fidèle sur {entryPeriod}. Vérifiez avant d&apos;encaisser une seconde fois.
          </p>
        )}
        {entryMessage && <p className="mt-3 text-caption text-success">{entryMessage}</p>}
      </form>

      {/* Validation des déclarations venues du mobile */}
      <h2 className="mb-3 font-display text-h3">
        À valider {pending.length > 0 && <span className="text-primary">({pending.length})</span>}
      </h2>
      <ul className="mb-10 space-y-3">
        {pending.map((p) => (
          <li
            key={p.id}
            className="flex flex-wrap items-center gap-4 rounded-md border border-light-border bg-light-surface p-4 dark:border-dark-border dark:bg-dark-surface"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {formatFCFA(p.amount)} · {p.detail}
              </p>
              <p className="text-caption text-light-muted dark:text-dark-muted">
                {p.memberId
                  ? (members.find((m) => m.id === p.memberId)?.full_name ?? "Fidèle")
                  : "Donateur anonyme"}{" "}
                ·{" "}
                {PAYMENT_METHOD_LABELS[p.method]} · réf.{" "}
                <span className="font-mono">{p.reference ?? "non fournie"}</span>
              </p>
            </div>
            <div className="flex gap-2">
              {p.proofPath ? (
                <button
                  onClick={() => viewProof(p)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-tertiary/60 px-4 py-2 text-caption font-medium text-tertiary transition hover:border-tertiary"
                >
                  <ImageIcon className="h-3.5 w-3.5" /> Justificatif
                </button>
              ) : (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-light-border px-4 py-2 text-caption text-light-muted dark:border-dark-border dark:text-dark-muted"
                  title="Le fidèle n'a joint aucune preuve de paiement"
                >
                  <ImageOff className="h-3.5 w-3.5" /> Sans preuve
                </span>
              )}
              <button
                onClick={() => decide(p, true)}
                disabled={busyId === p.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-caption font-medium text-white transition hover:bg-primary-hover disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" /> Valider
              </button>
              <button
                onClick={() => decide(p, false)}
                disabled={busyId === p.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-light-border px-4 py-2 text-caption transition hover:border-danger hover:text-danger disabled:opacity-50 dark:border-dark-border"
              >
                <X className="h-3.5 w-3.5" /> Rejeter
              </button>
            </div>
          </li>
        ))}
        {pending.length === 0 && (
          <li className="rounded-md border border-dashed border-light-border p-6 text-center text-caption text-light-muted dark:border-dark-border dark:text-dark-muted">
            Aucune déclaration en attente.
          </li>
        )}
      </ul>

      {/* Saisie d'une dépense */}
      <h2 className="mb-3 font-display text-h3">Enregistrer une dépense</h2>
      <form
        onSubmit={addExpense}
        className="mb-10 grid gap-3 rounded-lg border border-light-border bg-light-surface p-5 shadow-card sm:grid-cols-[2fr_1fr_1fr_1fr_auto] dark:border-dark-border dark:bg-dark-surface"
      >
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Libellé (ex. facture CIE)"
          className="rounded-md border border-light-border bg-transparent px-3 py-2.5 text-body outline-none focus:border-primary dark:border-dark-border"
        />
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
          inputMode="numeric"
          placeholder="Montant"
          className="rounded-md border border-light-border bg-transparent px-3 py-2.5 text-body outline-none focus:border-primary dark:border-dark-border"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
          className="rounded-md border border-light-border bg-transparent px-3 py-2.5 text-body outline-none focus:border-primary dark:border-dark-border"
        >
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {EXPENSE_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={spentAt}
          onChange={(e) => setSpentAt(e.target.value)}
          className="rounded-md border border-light-border bg-transparent px-3 py-2.5 text-body outline-none focus:border-primary dark:border-dark-border"
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 font-medium text-white transition hover:bg-primary-hover hover:shadow-glow"
        >
          <Plus className="h-4 w-4" /> Ajouter
        </button>
      </form>

      {/* Journal des entrées validées — chacune donne droit à un reçu imprimable. */}
      <h2 className="mb-3 font-display text-h3">Dernières entrées</h2>
      <div className="mb-10 overflow-x-auto rounded-md border border-light-border dark:border-dark-border">
        <table className="w-full min-w-[680px] text-left text-body">
          <thead className="bg-light-surface-alt text-caption text-light-muted dark:bg-dark-surface-alt dark:text-dark-muted">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Nature</th>
              <th className="px-4 py-3">De</th>
              <th className="px-4 py-3">Moyen</th>
              <th className="px-4 py-3 text-right">Montant</th>
              <th className="px-4 py-3 text-right">Reçu</th>
            </tr>
          </thead>
          <tbody>
            {validated.slice(0, 15).map((v) => (
              <tr key={v.id} className="border-t border-light-border dark:border-dark-border">
                <td className="px-4 py-3 tabular-nums">
                  {new Intl.DateTimeFormat("fr-FR").format(new Date(v.created_at))}
                </td>
                <td className="px-4 py-3 font-medium">{v.detail}</td>
                <td className="px-4 py-3 text-caption">
                  {v.memberId
                    ? (members.find((m) => m.id === v.memberId)?.full_name ?? "Fidèle")
                    : "Anonyme"}
                </td>
                <td className="px-4 py-3 text-caption">{PAYMENT_METHOD_LABELS[v.method]}</td>
                <td className="px-4 py-3 text-right tabular-nums text-success">
                  +{formatFCFA(v.amount)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/recu/${v.id}`}
                    className="inline-flex items-center gap-1.5 text-caption text-primary hover:underline"
                  >
                    <Receipt className="h-3.5 w-3.5" /> Reçu
                  </Link>
                </td>
              </tr>
            ))}
            {validated.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-caption text-light-muted dark:text-dark-muted"
                >
                  Aucune entrée validée.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Journal des dépenses */}
      <h2 className="mb-3 font-display text-h3">Dernières dépenses</h2>
      <div className="overflow-x-auto rounded-md border border-light-border dark:border-dark-border">
        <table className="w-full min-w-[560px] text-left text-body">
          <thead className="bg-light-surface-alt text-caption text-light-muted dark:bg-dark-surface-alt dark:text-dark-muted">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Libellé</th>
              <th className="px-4 py-3">Catégorie</th>
              <th className="px-4 py-3 text-right">Montant</th>
            </tr>
          </thead>
          <tbody>
            {expenses.slice(0, 15).map((e) => (
              <tr key={e.id} className="border-t border-light-border dark:border-dark-border">
                <td className="px-4 py-3 tabular-nums">
                  {new Intl.DateTimeFormat("fr-FR").format(new Date(`${e.spent_at}T12:00:00`))}
                </td>
                <td className="px-4 py-3 font-medium">{e.label}</td>
                <td className="px-4 py-3 text-caption">{EXPENSE_CATEGORY_LABELS[e.category]}</td>
                <td className="px-4 py-3 text-right tabular-nums text-danger">
                  −{formatFCFA(Number(e.amount))}
                </td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-caption text-light-muted dark:text-dark-muted"
                >
                  Aucune dépense enregistrée.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
