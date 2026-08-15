"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Target, Plus, Power, ChevronDown, ChevronRight, Check, X, Users } from "lucide-react";
import {
  createCampaignSchema,
  formatFCFA,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  type PaymentStatus,
  type Profile,
} from "@fitia/shared";
import type { CampaignRow, DonationRow } from "@fitia/supabase";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

/**
 * Campagnes de collecte (toiture, Ramadan, Waqf…).
 * Le montant collecté est calculé depuis les dons VALIDÉS rattachés à la campagne :
 * une promesse en attente ne doit pas gonfler la jauge affichée aux fidèles.
 */
export default function CampagnesPage() {
  const { profile } = useAuth();
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [donations, setDonations] = useState<DonationRow[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  /** Campagne dépliée sur la liste de ses bienfaiteurs. */
  const [expanded, setExpanded] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [goal, setGoal] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const configured = isSupabaseConfigured();

  const load = useCallback(async () => {
    if (!configured) return;
    const supabase = getSupabase();
    // On charge TOUS les dons, pas seulement les validés : la page sert aussi
    // à valider les promesses en attente, campagne par campagne.
    const [{ data: c }, { data: d }, { data: p }] = await Promise.all([
      supabase.from("campaigns").select("*").order("created_at", { ascending: false }),
      supabase.from("donations").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("*"),
    ]);
    setCampaigns((c as CampaignRow[]) ?? []);
    setDonations((d as DonationRow[]) ?? []);
    setMembers((p as Profile[]) ?? []);
  }, [configured]);

  useEffect(() => {
    load();
    if (!configured) return;
    const supabase = getSupabase();
    const channel = supabase
      .channel("dashboard:campaigns")
      .on("postgres_changes", { event: "*", schema: "public", table: "donations" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "campaigns" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [configured, load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = createCampaignSchema.safeParse({
      name,
      description: description || null,
      goal_amount: Number(goal),
      ends_at: endsAt ? new Date(endsAt).toISOString() : null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Formulaire invalide");
      return;
    }
    setBusy(true);
    const { error: dbError } = await getSupabase()
      .from("campaigns")
      .insert({ ...parsed.data, created_by: profile?.id ?? null });
    setBusy(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    setName("");
    setDescription("");
    setGoal("");
    setEndsAt("");
    setOpen(false);
    load();
  }

  async function toggleActive(campaign: CampaignRow) {
    const { error: dbError } = await getSupabase()
      .from("campaigns")
      .update({ active: !campaign.active })
      .eq("id", campaign.id);
    if (dbError) setError(dbError.message);
    else load();
  }

  /** Seuls les dons VALIDÉS entrent dans la jauge : une promesse n'est pas un encaissement. */
  const collected = (campaignId: string) =>
    donations
      .filter((d) => d.campaign_id === campaignId && d.status === "valide")
      .reduce((acc, d) => acc + Number(d.amount), 0);

  /** Dons rattachés à une campagne, toutes situations confondues. */
  const donorsOf = (campaignId: string) =>
    donations.filter((d) => d.campaign_id === campaignId);

  const donorName = (d: DonationRow) =>
    d.anonymous
      ? "Donateur anonyme"
      : (members.find((m) => m.id === d.donor_id)?.full_name ?? "Bienfaiteur");

  /** Validation d'une promesse depuis la campagne, sans passer par Finances. */
  async function decideDonation(donation: DonationRow, approve: boolean) {
    setDecidingId(donation.id);
    setError(null);
    const { error: dbError } = await getSupabase()
      .from("donations")
      .update({
        status: approve ? "valide" : "rejete",
        validated_by: profile?.id ?? null,
        validated_at: new Date().toISOString(),
      })
      .eq("id", donation.id);
    setDecidingId(null);
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
            <Target className="h-5 w-5 text-white" />
          </span>
          <div>
            <h1 className="font-display text-h1">Campagnes</h1>
            <p className="text-caption text-light-muted dark:text-dark-muted">
              Collectes fléchées — visibles des fidèles dans l&apos;application
            </p>
          </div>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-medium text-white transition hover:bg-primary-hover hover:shadow-glow"
        >
          <Plus className="h-4 w-4" /> {open ? "Fermer" : "Nouvelle campagne"}
        </button>
      </header>

      {error && (
        <div className="mb-6 rounded-md border border-danger/40 bg-danger/10 p-4 text-caption text-danger">
          {error}
        </div>
      )}

      {open && (
        <form
          onSubmit={create}
          className="mb-8 rounded-lg border border-light-border bg-light-surface p-5 shadow-card dark:border-dark-border dark:bg-dark-surface"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom de la campagne (ex. réfection de la toiture)"
            className={`${field} mb-3`}
          />
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <input
              value={goal}
              onChange={(e) => setGoal(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              placeholder="Objectif (FCFA)"
              className={field}
            />
            <input
              type="date"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className={field}
            />
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="À quoi servira l'argent collecté ?"
            className={`${field} mb-4 resize-none`}
          />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-medium text-white transition hover:bg-primary-hover hover:shadow-glow disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> {busy ? "Création…" : "Créer"}
          </button>
        </form>
      )}

      <ul className="space-y-4">
        {campaigns.map((c, i) => {
          const total = collected(c.id);
          const goalAmount = Number(c.goal_amount);
          const pct = goalAmount > 0 ? Math.min(100, Math.round((total / goalAmount) * 100)) : 0;
          return (
            <motion.li
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`rounded-md border border-light-border bg-light-surface p-5 dark:border-dark-border dark:bg-dark-surface ${
                c.active ? "" : "opacity-60"
              }`}
            >
              <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-h3">{c.name}</p>
                  {c.ends_at && (
                    <p className="text-caption text-light-muted dark:text-dark-muted">
                      Jusqu&apos;au{" "}
                      {new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(
                        new Date(c.ends_at),
                      )}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => toggleActive(c)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-caption font-medium transition ${
                    c.active
                      ? "bg-success/15 text-success"
                      : "border border-light-border text-light-muted dark:border-dark-border dark:text-dark-muted"
                  }`}
                >
                  <Power className="h-3.5 w-3.5" /> {c.active ? "En cours" : "Clôturée"}
                </button>
              </div>

              {c.description && (
                <p className="mb-3 text-body text-light-muted dark:text-dark-muted">
                  {c.description}
                </p>
              )}

              {/* Jauge d'avancement */}
              <div className="mb-1.5 flex items-baseline justify-between text-caption">
                <span className="font-medium text-primary">{formatFCFA(total)} collectés</span>
                <span className="text-light-muted dark:text-dark-muted">
                  objectif {formatFCFA(goalAmount)}
                </span>
              </div>
              <div
                className="h-2.5 w-full overflow-hidden rounded-full bg-light-surface-alt dark:bg-dark-surface-alt"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Avancement de la campagne ${c.name}`}
              >
                <div
                  className="h-full rounded-full bg-emerald transition-[width] duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-1.5 text-caption text-light-muted dark:text-dark-muted">
                {pct}% de l&apos;objectif
                {total < goalAmount && ` · reste ${formatFCFA(goalAmount - total)}`}
              </p>

              {/* Bienfaiteurs de la campagne — suivi nominatif et validation. */}
              {(() => {
                const list = donorsOf(c.id);
                const pending = list.filter((d) => d.status === "en_attente");
                if (list.length === 0) {
                  return (
                    <p className="mt-3 text-caption text-light-muted dark:text-dark-muted">
                      Aucun bienfaiteur pour l&apos;instant.
                    </p>
                  );
                }
                return (
                  <div className="mt-3">
                    <button
                      onClick={() => setExpanded((cur) => (cur === c.id ? null : c.id))}
                      className="inline-flex items-center gap-1.5 text-caption text-primary transition hover:underline"
                    >
                      {expanded === c.id ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                      <Users className="h-3.5 w-3.5" />
                      {list.length} bienfaiteur(s)
                      {pending.length > 0 && (
                        <span className="text-warning">· {pending.length} à valider</span>
                      )}
                    </button>

                    {expanded === c.id && (
                      <ul className="mt-3 space-y-2 border-t border-light-border pt-3 dark:border-dark-border">
                        {list.map((d) => {
                          const status = d.status as PaymentStatus;
                          return (
                            <li key={d.id} className="flex flex-wrap items-center gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-body">
                                  {donorName(d)} · {formatFCFA(Number(d.amount))}
                                </p>
                                <p className="text-caption text-light-muted dark:text-dark-muted">
                                  {PAYMENT_METHOD_LABELS[d.method]} ·{" "}
                                  {new Intl.DateTimeFormat("fr-FR").format(new Date(d.created_at))}
                                  {d.reference ? ` · réf. ${d.reference}` : ""}
                                </p>
                              </div>

                              {status === "en_attente" ? (
                                <div className="flex shrink-0 gap-2">
                                  <button
                                    onClick={() => decideDonation(d, true)}
                                    disabled={decidingId === d.id}
                                    className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-caption font-medium text-white transition hover:bg-primary-hover disabled:opacity-50"
                                  >
                                    <Check className="h-3.5 w-3.5" /> Valider
                                  </button>
                                  <button
                                    onClick={() => decideDonation(d, false)}
                                    disabled={decidingId === d.id}
                                    className="inline-flex items-center rounded-full border border-light-border p-1.5 text-light-muted transition hover:border-danger hover:text-danger disabled:opacity-50 dark:border-dark-border dark:text-dark-muted"
                                    aria-label="Rejeter ce don"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <span
                                  className={`shrink-0 rounded-full px-3 py-1 text-caption font-medium ${
                                    status === "valide"
                                      ? "bg-success/15 text-success"
                                      : "bg-danger/15 text-danger"
                                  }`}
                                >
                                  {PAYMENT_STATUS_LABELS[status]}
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })()}
            </motion.li>
          );
        })}
        {campaigns.length === 0 && (
          <li className="rounded-md border border-dashed border-light-border p-8 text-center text-caption text-light-muted dark:border-dark-border dark:text-dark-muted">
            Aucune campagne. Créez-en une pour flécher les dons vers un projet précis.
          </li>
        )}
      </ul>
    </main>
  );
}
