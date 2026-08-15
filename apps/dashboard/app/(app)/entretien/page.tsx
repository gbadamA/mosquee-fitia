"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Wrench, Plus, Check, RotateCw } from "lucide-react";
import {
  createMaintenanceSchema,
  nextDueDate,
  dueLabel,
  todayISO,
  MAINTENANCE_KIND_LABELS,
  MAINTENANCE_RECURRENCE_LABELS,
  ASSET_CATEGORY_LABELS,
  type MaintenanceKind,
  type MaintenanceRecurrence,
} from "@fitia/shared";
import type { AssetRow, MaintenanceTaskRow } from "@fitia/supabase";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

/**
 * Planification de l'entretien (nettoyage, climatisation, sonorisation…).
 *
 * Cocher une tâche récurrente ne la clôt pas : elle se **réarme** à la date
 * suivante calculée depuis le jour d'exécution — sinon une tâche faite en retard
 * resterait éternellement en retard.
 */

const KINDS = Object.keys(MAINTENANCE_KIND_LABELS) as MaintenanceKind[];
const RECURRENCES = Object.keys(MAINTENANCE_RECURRENCE_LABELS) as MaintenanceRecurrence[];

export default function EntretienPage() {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<MaintenanceTaskRow[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<MaintenanceKind>("nettoyage");
  const [recurrence, setRecurrence] = useState<MaintenanceRecurrence>("mensuel");
  const [dueOn, setDueOn] = useState(todayISO());
  const [assetId, setAssetId] = useState("");
  const [assignee, setAssignee] = useState("");

  const configured = isSupabaseConfigured();
  const today = todayISO();

  const load = useCallback(async () => {
    if (!configured) return;
    const supabase = getSupabase();
    const [{ data: t }, { data: a }] = await Promise.all([
      supabase.from("maintenance_tasks").select("*").order("due_on"),
      supabase.from("assets").select("*").order("name"),
    ]);
    setTasks((t as MaintenanceTaskRow[]) ?? []);
    setAssets((a as AssetRow[]) ?? []);
  }, [configured]);

  useEffect(() => {
    load();
    if (!configured) return;
    const supabase = getSupabase();
    const channel = supabase
      .channel("dashboard:maintenance")
      .on("postgres_changes", { event: "*", schema: "public", table: "maintenance_tasks" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [configured, load]);

  const { aFaire, faites } = useMemo(
    () => ({
      aFaire: tasks.filter((t) => !t.done),
      faites: tasks.filter((t) => t.done),
    }),
    [tasks],
  );

  const enRetard = aFaire.filter((t) => t.due_on < today).length;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = createMaintenanceSchema.safeParse({
      title,
      kind,
      asset_id: assetId || null,
      recurrence,
      due_on: dueOn,
      assignee: assignee || null,
      notes: null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Formulaire invalide");
      return;
    }
    const { error: dbError } = await getSupabase()
      .from("maintenance_tasks")
      .insert({ ...parsed.data, created_by: profile?.id ?? null });
    if (dbError) {
      setError(dbError.message);
      return;
    }
    setTitle("");
    setAssignee("");
    setOpen(false);
    load();
  }

  async function markDone(task: MaintenanceTaskRow) {
    setBusyId(task.id);
    setError(null);

    const next = nextDueDate(task.recurrence, today);
    const { error: dbError } = await getSupabase()
      .from("maintenance_tasks")
      .update(
        next
          ? // Récurrente : on la réarme à la prochaine échéance.
            { last_done_on: today, due_on: next, done: false }
          : // Ponctuelle : elle est close.
            { last_done_on: today, done: true },
      )
      .eq("id", task.id);

    setBusyId(null);
    if (dbError) setError(dbError.message);
    else load();
  }

  const field =
    "w-full rounded-md border border-light-border bg-transparent px-3 py-2.5 text-body outline-none focus:border-primary dark:border-dark-border";

  function card(t: MaintenanceTaskRow, closed: boolean) {
    const asset = assets.find((a) => a.id === t.asset_id);
    const due = dueLabel(t.due_on, today);
    return (
      <motion.li
        key={t.id}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex flex-wrap items-center gap-3 rounded-md border p-4 ${
          closed
            ? "border-light-border bg-light-surface opacity-60 dark:border-dark-border dark:bg-dark-surface"
            : due.late
              ? "border-danger/50 bg-danger/5"
              : "border-light-border bg-light-surface dark:border-dark-border dark:bg-dark-surface"
        }`}
      >
        <div className="min-w-0 flex-1">
          <p className="font-medium">{t.title}</p>
          <p className="text-caption text-light-muted dark:text-dark-muted">
            {MAINTENANCE_KIND_LABELS[t.kind]} · {MAINTENANCE_RECURRENCE_LABELS[t.recurrence]}
            {asset ? ` · ${asset.name} (${ASSET_CATEGORY_LABELS[asset.category]})` : ""}
            {t.assignee ? ` · ${t.assignee}` : ""}
          </p>
          <p className={`mt-1 text-caption ${due.late ? "font-medium text-danger" : "text-light-muted dark:text-dark-muted"}`}>
            Échéance{" "}
            {new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(
              new Date(`${t.due_on}T12:00:00`),
            )}{" "}
            · {closed ? "terminée" : due.label}
            {t.last_done_on &&
              ` · dernière fois le ${new Intl.DateTimeFormat("fr-FR").format(new Date(`${t.last_done_on}T12:00:00`))}`}
          </p>
        </div>
        {!closed && (
          <button
            onClick={() => markDone(t)}
            disabled={busyId === t.id}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-caption font-medium text-white transition hover:bg-primary-hover disabled:opacity-50"
          >
            {t.recurrence === "ponctuel" ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <RotateCw className="h-3.5 w-3.5" />
            )}
            Fait
          </button>
        )}
      </motion.li>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-emerald shadow-glow">
            <Wrench className="h-5 w-5 text-white" />
          </span>
          <div>
            <h1 className="font-display text-h1">Entretien</h1>
            <p className="text-caption text-light-muted dark:text-dark-muted">
              {aFaire.length} tâche(s) planifiée(s)
              {enRetard > 0 && (
                <span className="text-danger"> · {enRetard} en retard</span>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-medium text-white transition hover:bg-primary-hover hover:shadow-glow"
        >
          <Plus className="h-4 w-4" /> {open ? "Fermer" : "Nouvelle tâche"}
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
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Intitulé (ex. nettoyage de la salle de prière)"
            className={`${field} mb-3`}
          />
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as MaintenanceKind)}
              className={field}
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {MAINTENANCE_KIND_LABELS[k]}
                </option>
              ))}
            </select>
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as MaintenanceRecurrence)}
              className={field}
            >
              {RECURRENCES.map((r) => (
                <option key={r} value={r}>
                  {MAINTENANCE_RECURRENCE_LABELS[r]}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={dueOn}
              onChange={(e) => setDueOn(e.target.value)}
              className={field}
            />
            <select
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
              className={field}
            >
              <option value="">Aucun bien précis</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <input
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder="Responsable (facultatif)"
              className={field}
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-medium text-white transition hover:bg-primary-hover hover:shadow-glow"
          >
            <Plus className="h-4 w-4" /> Planifier
          </button>
        </form>
      )}

      <h2 className="mb-3 font-display text-h3">À faire</h2>
      <ul className="mb-10 space-y-2">
        {aFaire.map((t) => card(t, false))}
        {aFaire.length === 0 && (
          <li className="rounded-md border border-dashed border-light-border p-8 text-center text-caption text-light-muted dark:border-dark-border dark:text-dark-muted">
            Aucune tâche planifiée.
          </li>
        )}
      </ul>

      {faites.length > 0 && (
        <>
          <h2 className="mb-3 font-display text-h3">Terminées</h2>
          <ul className="space-y-2">{faites.slice(0, 10).map((t) => card(t, true))}</ul>
        </>
      )}
    </main>
  );
}
