"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, Wallet, CalendarDays, Clock } from "lucide-react";
import {
  PRAYER_META,
  PRAYER_KEYS,
  formatFCFA,
  formatEventDate,
  hijriDate,
  todayISO,
  nextPrayer,
  formatCountdown,
  type PrayerTimes,
  type MosqueEvent,
} from "@fitia/shared";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

type Stats = {
  fideles: number;
  fidelesAJour: number;
  collecte: number;
  depenses: number;
};

export default function VueEnsemble() {
  const [stats, setStats] = useState<Stats>({
    fideles: 0,
    fidelesAJour: 0,
    collecte: 0,
    depenses: 0,
  });
  const [times, setTimes] = useState<PrayerTimes | null>(null);
  const [events, setEvents] = useState<MosqueEvent[]>([]);
  const [tick, setTick] = useState(Date.now());
  const configured = isSupabaseConfigured();

  // Le compte à rebours se rafraîchit à la seconde.
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!configured) return;
    const supabase = getSupabase();

    (async () => {
      const [profiles, contributions, donations, expenses, prayer, upcoming] = await Promise.all([
        supabase.from("profiles").select("id, status").eq("role", "fidele"),
        supabase.from("contributions").select("amount").eq("status", "valide"),
        supabase.from("donations").select("amount").eq("status", "valide"),
        supabase.from("expenses").select("amount"),
        supabase.from("prayer_times").select("*").eq("date", todayISO()).maybeSingle(),
        supabase
          .from("events")
          .select("*")
          .gte("starts_at", new Date().toISOString())
          .order("starts_at", { ascending: true })
          .limit(4),
      ]);

      const rows = profiles.data ?? [];
      const sum = (list: { amount: number }[] | null) =>
        (list ?? []).reduce((acc, r) => acc + Number(r.amount), 0);

      setStats({
        fideles: rows.length,
        fidelesAJour: rows.filter((r) => r.status === "actif").length,
        collecte: sum(contributions.data) + sum(donations.data),
        depenses: sum(expenses.data),
      });
      if (prayer.data) setTimes(prayer.data as PrayerTimes);
      if (upcoming.data) setEvents(upcoming.data as MosqueEvent[]);
    })();
  }, [configured]);

  const next = times ? nextPrayer(times, new Date(tick)) : null;
  const solde = stats.collecte - stats.depenses;

  const cards = [
    {
      label: "Fidèles inscrits",
      value: String(stats.fideles),
      hint: `${stats.fidelesAJour} à jour de cotisation`,
      icon: Users,
    },
    {
      label: "Collecté (validé)",
      value: formatFCFA(stats.collecte),
      hint: "Cotisations + dons",
      icon: Wallet,
    },
    {
      label: "Dépenses",
      value: formatFCFA(stats.depenses),
      hint: "Toutes catégories",
      icon: Wallet,
    },
    {
      label: "Solde",
      value: formatFCFA(solde),
      hint: solde >= 0 ? "Trésorerie positive" : "Trésorerie négative",
      icon: Wallet,
    },
  ];

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <h1 className="font-display text-h1">Vue d&apos;ensemble</h1>
        <p className="text-caption text-light-muted dark:text-dark-muted">
          {new Intl.DateTimeFormat("fr-FR", { dateStyle: "full" }).format(new Date())}
          {hijriDate() && ` · ${hijriDate()}`}
        </p>
      </header>

      {!configured && (
        <div className="mb-6 rounded-md border border-warning/40 bg-warning/10 p-4 text-caption text-warning">
          Supabase non configuré — les chiffres restent à zéro.
        </div>
      )}

      {/* Bandeau prochaine prière */}
      <section className="mb-8 overflow-hidden rounded-lg bg-emerald shadow-card">
        <div className="pattern-islamic p-6">
          {next && times ? (
            <>
              <p className="text-caption text-white/80">
                Prochaine prière{next.tomorrow ? " (demain)" : ""}
              </p>
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="font-display text-display text-white">
                  {PRAYER_META[next.key].label}
                </span>
                <span className="arabic text-2xl text-white/90">
                  {PRAYER_META[next.key].arabic}
                </span>
                <span className="text-h2 font-semibold text-white">
                  {times[next.key]}
                </span>
              </div>
              <p className="mt-1 text-body text-white/90">
                dans <strong>{formatCountdown(next.msUntil)}</strong>
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {PRAYER_KEYS.map((k) => (
                  <span
                    key={k}
                    className={`rounded-full px-3 py-1.5 text-caption ${
                      next.key === k
                        ? "bg-white font-semibold text-primary"
                        : "bg-white/15 text-white"
                    }`}
                  >
                    {PRAYER_META[k].label} · {times[k]}
                  </span>
                ))}
                {times.jumua && (
                  <span className="rounded-full bg-secondary px-3 py-1.5 text-caption font-semibold text-light-text">
                    Djouma · {times.jumua}
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3 text-white">
              <Clock className="h-5 w-5" />
              <p className="text-body">
                Aucun horaire publié pour aujourd&apos;hui — renseignez-les dans{" "}
                <strong>Horaires de prière</strong>.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* KPIs */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ label, value, hint, icon: Icon }, i) => (
          <motion.article
            key={label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-md border border-light-border bg-light-surface p-5 dark:border-dark-border dark:bg-dark-surface"
          >
            <Icon className="mb-3 h-4 w-4 text-primary" />
            <p className="text-caption text-light-muted dark:text-dark-muted">{label}</p>
            <p className="font-display text-h2">{value}</p>
            <p className="mt-1 text-caption text-light-muted dark:text-dark-muted">{hint}</p>
          </motion.article>
        ))}
      </div>

      {/* Prochains événements */}
      <h2 className="mb-3 font-display text-h3">Prochains événements</h2>
      <ul className="space-y-3">
        {events.map((e) => (
          <li
            key={e.id}
            className="flex items-center gap-4 rounded-md border border-light-border bg-light-surface p-4 dark:border-dark-border dark:bg-dark-surface"
          >
            <CalendarDays className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{e.title}</p>
              <p className="text-caption text-light-muted dark:text-dark-muted">
                {formatEventDate(e.starts_at)}
                {e.location ? ` · ${e.location}` : ""}
              </p>
            </div>
          </li>
        ))}
        {events.length === 0 && (
          <li className="rounded-md border border-dashed border-light-border p-6 text-center text-caption text-light-muted dark:border-dark-border dark:text-dark-muted">
            Aucun événement à venir.
          </li>
        )}
      </ul>
    </main>
  );
}
