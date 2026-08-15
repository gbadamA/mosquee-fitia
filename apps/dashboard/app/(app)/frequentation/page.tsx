"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Users, Save, Download } from "lucide-react";
import {
  createAttendanceSchema,
  todayISO,
  downloadCSV,
  csvFilename,
  ATTENDANCE_MOMENT_LABELS,
  type AttendanceMoment,
} from "@fitia/shared";
import type { AttendanceRow } from "@fitia/supabase";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

/**
 * Statistiques de fréquentation (§2.7 du cahier).
 *
 * La mosquée compte les rangs et saisit un effectif par prière. Modèle volontairement
 * simple : une ligne par date et par moment, contrainte d'unicité en base — ressaisir
 * corrige au lieu d'empiler, ce qui évite les doublons quand deux personnes comptent.
 */

const MOMENTS = Object.keys(ATTENDANCE_MOMENT_LABELS) as AttendanceMoment[];
/** Les 5 prières + Djouma : ce qu'on relève au quotidien. */
const DAILY: AttendanceMoment[] = ["fajr", "dhuhr", "asr", "maghrib", "isha", "jumua"];

export default function FrequentationPage() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [date, setDate] = useState(todayISO());
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const configured = isSupabaseConfigured();

  const load = useCallback(async () => {
    if (!configured) return;
    const { data } = await getSupabase()
      .from("attendance_records")
      .select("*")
      .order("date", { ascending: false })
      .limit(400);
    setRows((data as AttendanceRow[]) ?? []);
  }, [configured]);

  useEffect(() => {
    load();
  }, [load]);

  // Pré-remplit le formulaire avec les relevés déjà saisis pour la date choisie.
  useEffect(() => {
    const forDate = rows.filter((r) => r.date === date);
    setCounts(Object.fromEntries(forDate.map((r) => [r.moment, String(r.count)])));
  }, [date, rows]);

  async function save() {
    setError(null);
    setMessage(null);

    const payload = DAILY.filter((m) => counts[m] !== undefined && counts[m] !== "").map((m) => ({
      date,
      moment: m,
      event_id: null,
      count: Number(counts[m]),
    }));

    if (payload.length === 0) {
      setError("Saisissez au moins un effectif.");
      return;
    }
    for (const p of payload) {
      const parsed = createAttendanceSchema.safeParse(p);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Saisie invalide");
        return;
      }
    }

    setBusy(true);
    // `upsert` sur (date, moment) : la contrainte d'unicité fait la correction.
    const { error: dbError } = await getSupabase()
      .from("attendance_records")
      .upsert(
        payload.map((p) => ({ ...p, recorded_by: profile?.id ?? null })),
        { onConflict: "date,moment" },
      );
    setBusy(false);

    if (dbError) {
      setError(dbError.message);
      return;
    }
    setMessage(`${payload.length} relevé(s) enregistré(s) pour le ${date}.`);
    load();
  }

  /** Moyenne par moment sur les 30 derniers relevés de chaque type. */
  const averages = useMemo(() => {
    return DAILY.map((m) => {
      const list = rows.filter((r) => r.moment === m).slice(0, 30);
      const total = list.reduce((acc, r) => acc + r.count, 0);
      return {
        moment: m,
        moyenne: list.length > 0 ? Math.round(total / list.length) : 0,
        releves: list.length,
        max: list.length > 0 ? Math.max(...list.map((r) => r.count)) : 0,
      };
    });
  }, [rows]);

  const maxMoyenne = Math.max(1, ...averages.map((a) => a.moyenne));

  /** Derniers jours avec au moins un relevé. */
  const recentDays = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const r of rows) byDate.set(r.date, (byDate.get(r.date) ?? 0) + r.count);
    return [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 14);
  }, [rows]);

  function exportCSV() {
    downloadCSV(
      csvFilename("frequentation"),
      ["Date", "Moment", "Effectif"],
      rows.map((r) => [r.date, ATTENDANCE_MOMENT_LABELS[r.moment], r.count]),
    );
  }

  const field =
    "w-full rounded-md border border-light-border bg-transparent px-3 py-2.5 text-body outline-none focus:border-primary dark:border-dark-border";

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-emerald shadow-glow">
            <Users className="h-5 w-5 text-white" />
          </span>
          <div>
            <h1 className="font-display text-h1">Fréquentation</h1>
            <p className="text-caption text-light-muted dark:text-dark-muted">
              {rows.length} relevé(s) enregistré(s)
            </p>
          </div>
        </div>
        <button
          onClick={exportCSV}
          disabled={rows.length === 0}
          className="inline-flex items-center gap-2 rounded-full border border-light-border px-4 py-2 text-caption transition hover:border-primary hover:text-primary disabled:opacity-50 dark:border-dark-border"
        >
          <Download className="h-4 w-4" /> Exporter
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

      {/* Saisie */}
      <section className="mb-8 rounded-lg border border-light-border bg-light-surface p-5 shadow-card dark:border-dark-border dark:bg-dark-surface">
        <label className="mb-1.5 block text-caption text-light-muted dark:text-dark-muted">
          Date du relevé
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={`${field} mb-4`}
        />

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          {DAILY.map((m) => (
            <div key={m}>
              <label className="mb-1.5 block text-caption text-light-muted dark:text-dark-muted">
                {ATTENDANCE_MOMENT_LABELS[m]}
              </label>
              <input
                value={counts[m] ?? ""}
                onChange={(e) =>
                  setCounts((c) => ({ ...c, [m]: e.target.value.replace(/\D/g, "") }))
                }
                inputMode="numeric"
                placeholder="—"
                className={field}
              />
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-caption text-light-muted dark:text-dark-muted">
            Ressaisir une date déjà relevée corrige les chiffres au lieu de les ajouter.
          </p>
          <button
            onClick={save}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-medium text-white transition hover:bg-primary-hover hover:shadow-glow disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> {busy ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </section>

      {/* Moyennes */}
      <h2 className="mb-3 font-display text-h3">Affluence moyenne</h2>
      <div className="mb-8 rounded-md border border-light-border bg-light-surface p-5 dark:border-dark-border dark:bg-dark-surface">
        <ul className="space-y-3">
          {averages.map((a) => (
            <li key={a.moment}>
              <div className="mb-1 flex items-baseline justify-between text-caption">
                <span className="font-medium">{ATTENDANCE_MOMENT_LABELS[a.moment]}</span>
                <span className="text-light-muted dark:text-dark-muted">
                  {a.releves > 0
                    ? `${a.moyenne} en moyenne · pic ${a.max} · ${a.releves} relevé(s)`
                    : "aucun relevé"}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-light-surface-alt dark:bg-dark-surface-alt">
                <div
                  className="h-full rounded-full bg-emerald"
                  style={{ width: `${Math.round((a.moyenne / maxMoyenne) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Historique */}
      <h2 className="mb-3 font-display text-h3">Derniers jours</h2>
      <div className="overflow-x-auto rounded-md border border-light-border dark:border-dark-border">
        <table className="w-full text-left text-body">
          <thead className="bg-light-surface-alt text-caption text-light-muted dark:bg-dark-surface-alt dark:text-dark-muted">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Détail</th>
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {recentDays.map(([d, total]) => (
              <tr key={d} className="border-t border-light-border dark:border-dark-border">
                <td className="px-4 py-3 tabular-nums">
                  {new Intl.DateTimeFormat("fr-FR", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  }).format(new Date(`${d}T12:00:00`))}
                </td>
                <td className="px-4 py-3 text-caption text-light-muted dark:text-dark-muted">
                  {rows
                    .filter((r) => r.date === d)
                    .map((r) => `${ATTENDANCE_MOMENT_LABELS[r.moment]} ${r.count}`)
                    .join(" · ")}
                </td>
                <td className="px-4 py-3 text-right font-medium tabular-nums">{total}</td>
              </tr>
            ))}
            {recentDays.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-10 text-center text-caption text-light-muted dark:text-dark-muted"
                >
                  Aucun relevé. Saisissez les effectifs ci-dessus.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-caption text-light-muted dark:text-dark-muted">
        Moments disponibles : {MOMENTS.map((m) => ATTENDANCE_MOMENT_LABELS[m]).join(" · ")}.
      </p>
    </main>
  );
}
