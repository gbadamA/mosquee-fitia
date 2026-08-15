"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Plus, Users, ChevronDown, ChevronRight, UserCheck } from "lucide-react";
import {
  createEventSchema,
  formatEventDate,
  formatPhoneCI,
  EVENT_TYPE_META,
  type EventType,
  type MosqueEvent,
  type Profile,
} from "@fitia/shared";
import type { EventRegistrationRow } from "@fitia/supabase";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

const TYPES = Object.keys(EVENT_TYPE_META) as EventType[];

type Counts = Record<string, { inscrits: number; presents: number }>;

export default function EvenementsPage() {
  const { profile } = useAuth();
  const [events, setEvents] = useState<MosqueEvent[]>([]);
  const [counts, setCounts] = useState<Counts>({});
  const [registrations, setRegistrations] = useState<EventRegistrationRow[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const configured = isSupabaseConfigured();

  // Formulaire
  const [title, setTitle] = useState("");
  const [type, setType] = useState<EventType>("conference");
  const [location, setLocation] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [capacity, setCapacity] = useState("");
  const [description, setDescription] = useState("");

  const load = useCallback(async () => {
    if (!configured) return;
    const supabase = getSupabase();
    const [{ data: evs }, { data: regs }, { data: profs }] = await Promise.all([
      supabase.from("events").select("*").order("starts_at", { ascending: true }),
      supabase.from("event_registrations").select("*"),
      supabase.from("profiles").select("*"),
    ]);

    setEvents((evs as MosqueEvent[]) ?? []);
    setRegistrations((regs as EventRegistrationRow[]) ?? []);
    setMembers((profs as Profile[]) ?? []);

    const next: Counts = {};
    for (const r of regs ?? []) {
      const c = next[r.event_id] ?? { inscrits: 0, presents: 0 };
      c.inscrits += 1;
      if (r.checked_in_at) c.presents += 1;
      next[r.event_id] = c;
    }
    setCounts(next);
  }, [configured]);

  /**
   * Pointage d'un inscrit. Bascule : re-cliquer annule la présence.
   * Sans cet écran, le « taux de présence réel » affiché plus bas resterait à 0 %.
   */
  async function toggleCheckIn(registration: EventRegistrationRow) {
    setCheckingIn(registration.id);
    setError(null);
    const { error: dbError } = await getSupabase()
      .from("event_registrations")
      .update({ checked_in_at: registration.checked_in_at ? null : new Date().toISOString() })
      .eq("id", registration.id);
    setCheckingIn(null);
    if (dbError) setError(dbError.message);
    else load();
  }

  useEffect(() => {
    load();
    if (!configured) return;
    const supabase = getSupabase();
    const channel = supabase
      .channel("dashboard:events")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_registrations" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [configured, load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = createEventSchema.safeParse({
      title,
      description: description || null,
      type,
      location: location || null,
      // `datetime-local` renvoie une heure locale sans fuseau : on la normalise en ISO.
      starts_at: startsAt ? new Date(startsAt).toISOString() : "",
      capacity: capacity ? Number(capacity) : null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Formulaire invalide");
      return;
    }
    const { error: dbError } = await getSupabase()
      .from("events")
      .insert({ ...parsed.data, created_by: profile?.id ?? null });
    if (dbError) {
      setError(dbError.message);
      return;
    }
    setTitle("");
    setLocation("");
    setStartsAt("");
    setCapacity("");
    setDescription("");
    setOpen(false);
    load();
  }

  const now = Date.now();
  const upcoming = events.filter((e) => new Date(e.starts_at).getTime() >= now);
  const past = events
    .filter((e) => new Date(e.starts_at).getTime() < now)
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at));

  function card(e: MosqueEvent, isPast: boolean) {
    const meta = EVENT_TYPE_META[e.type];
    const c = counts[e.id] ?? { inscrits: 0, presents: 0 };
    const taux = c.inscrits > 0 ? Math.round((c.presents / c.inscrits) * 100) : null;
    return (
      <motion.li
        key={e.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-md border border-light-border bg-light-surface p-4 dark:border-dark-border dark:bg-dark-surface ${
          isPast ? "opacity-70" : ""
        }`}
      >
        <div className="mb-1.5 flex items-center gap-2">
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
            style={{ backgroundColor: meta.color }}
          >
            {meta.emoji} {meta.label}
          </span>
        </div>
        <p className="font-display text-h3">{e.title}</p>
        <p className="text-caption text-light-muted dark:text-dark-muted">
          {formatEventDate(e.starts_at)}
          {e.location ? ` · ${e.location}` : ""}
        </p>
        {e.description && <p className="mt-2 text-body">{e.description}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-caption text-light-muted dark:text-dark-muted">
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {c.inscrits} inscrit{c.inscrits > 1 ? "s" : ""}
            {e.capacity ? ` / ${e.capacity}` : ""}
          </span>
          {taux !== null && (
            <span className={taux >= 70 ? "text-success" : "text-warning"}>
              Présence réelle {taux}% ({c.presents}/{c.inscrits})
            </span>
          )}
          {c.inscrits > 0 && (
            <button
              onClick={() => setExpanded((current) => (current === e.id ? null : e.id))}
              className="inline-flex items-center gap-1 text-caption text-primary transition hover:underline"
            >
              {expanded === e.id ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              Pointer les présences
            </button>
          )}
        </div>

        {expanded === e.id && (
          <ul className="mt-3 space-y-1.5 border-t border-light-border pt-3 dark:border-dark-border">
            {registrations
              .filter((r) => r.event_id === e.id)
              .map((r) => {
                const m = members.find((p) => p.id === r.member_id);
                const present = Boolean(r.checked_in_at);
                return (
                  <li key={r.id} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body">{m?.full_name ?? "Fidèle"}</p>
                      <p className="text-caption text-light-muted dark:text-dark-muted">
                        {m?.member_number ?? "—"} · {formatPhoneCI(m?.phone)}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleCheckIn(r)}
                      disabled={checkingIn === r.id}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-caption font-medium transition disabled:opacity-50 ${
                        present
                          ? "bg-success/15 text-success"
                          : "border border-light-border text-light-muted hover:border-primary hover:text-primary dark:border-dark-border dark:text-dark-muted"
                      }`}
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      {present ? "Présent" : "Pointer"}
                    </button>
                  </li>
                );
              })}
          </ul>
        )}
      </motion.li>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-emerald shadow-glow">
            <CalendarDays className="h-5 w-5 text-white" />
          </span>
          <div>
            <h1 className="font-display text-h1">Événements</h1>
            <p className="text-caption text-light-muted dark:text-dark-muted">
              Djouma, conférences, Aïd, Ramadan, Janazah
            </p>
          </div>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-medium text-white transition hover:bg-primary-hover hover:shadow-glow"
        >
          <Plus className="h-4 w-4" /> {open ? "Fermer" : "Nouvel événement"}
        </button>
      </header>

      {open && (
        <form
          onSubmit={create}
          className="mb-8 rounded-lg border border-light-border bg-light-surface p-5 shadow-card dark:border-dark-border dark:bg-dark-surface"
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre de l'événement"
            className="mb-3 w-full rounded-md border border-light-border bg-transparent px-4 py-3 text-body outline-none focus:border-primary dark:border-dark-border"
          />
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as EventType)}
              className="rounded-md border border-light-border bg-transparent px-3 py-2.5 text-body outline-none focus:border-primary dark:border-dark-border"
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {EVENT_TYPE_META[t].label}
                </option>
              ))}
            </select>
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="rounded-md border border-light-border bg-transparent px-3 py-2.5 text-body outline-none focus:border-primary dark:border-dark-border"
            />
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Lieu (ex. salle principale)"
              className="rounded-md border border-light-border bg-transparent px-3 py-2.5 text-body outline-none focus:border-primary dark:border-dark-border"
            />
            <input
              value={capacity}
              onChange={(e) => setCapacity(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              placeholder="Capacité (facultatif)"
              className="rounded-md border border-light-border bg-transparent px-3 py-2.5 text-body outline-none focus:border-primary dark:border-dark-border"
            />
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Description (facultatif)"
            className="mb-4 w-full resize-none rounded-md border border-light-border bg-transparent px-4 py-3 text-body outline-none focus:border-primary dark:border-dark-border"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-medium text-white transition hover:bg-primary-hover hover:shadow-glow"
          >
            <Plus className="h-4 w-4" /> Créer
          </button>
          {error && <p className="mt-3 text-caption text-danger">{error}</p>}
        </form>
      )}

      <h2 className="mb-3 font-display text-h3">À venir</h2>
      <ul className="mb-10 space-y-3">
        {upcoming.map((e) => card(e, false))}
        {upcoming.length === 0 && (
          <li className="rounded-md border border-dashed border-light-border p-6 text-center text-caption text-light-muted dark:border-dark-border dark:text-dark-muted">
            Aucun événement à venir.
          </li>
        )}
      </ul>

      <h2 className="mb-3 font-display text-h3">Passés</h2>
      <ul className="space-y-3">
        {past.slice(0, 10).map((e) => card(e, true))}
        {past.length === 0 && (
          <li className="rounded-md border border-dashed border-light-border p-6 text-center text-caption text-light-muted dark:border-dark-border dark:text-dark-muted">
            Aucun événement passé.
          </li>
        )}
      </ul>
    </main>
  );
}
