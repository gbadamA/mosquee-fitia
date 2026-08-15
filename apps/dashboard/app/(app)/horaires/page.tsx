"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, Save, CalendarClock } from "lucide-react";
import {
  createPrayerTimesSchema,
  PRAYER_KEYS,
  PRAYER_META,
  todayISO,
  type PrayerTimes,
} from "@fitia/shared";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

/**
 * Publication des horaires de prière. Un `upsert` sur la colonne unique `date` :
 * republier le même jour corrige la ligne au lieu d'en créer une seconde.
 * Le mobile reçoit l'INSERT/UPDATE via Realtime — c'est la diffusion.
 */

type Form = {
  date: string;
  fajr: string;
  chourouk: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
  jumua: string;
  note: string;
};

const EMPTY: Form = {
  date: todayISO(),
  fajr: "05:15",
  chourouk: "06:25",
  dhuhr: "12:25",
  asr: "15:40",
  maghrib: "18:25",
  isha: "19:35",
  jumua: "",
  note: "",
};

export default function HorairesPage() {
  const [form, setForm] = useState<Form>(EMPTY);
  const [rows, setRows] = useState<PrayerTimes[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const configured = isSupabaseConfigured();

  const loadHistory = useCallback(async () => {
    if (!configured) return;
    const { data } = await getSupabase()
      .from("prayer_times")
      .select("*")
      .gte("date", todayISO())
      .order("date", { ascending: true })
      .limit(14);
    if (data) setRows(data as PrayerTimes[]);
  }, [configured]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Pré-remplit le formulaire quand la date choisie a déjà des horaires publiés.
  useEffect(() => {
    const existing = rows.find((r) => r.date === form.date);
    if (!existing) return;
    setForm({
      date: existing.date,
      fajr: existing.fajr,
      chourouk: existing.chourouk ?? "",
      dhuhr: existing.dhuhr,
      asr: existing.asr,
      maghrib: existing.maghrib,
      isha: existing.isha,
      jumua: existing.jumua ?? "",
      note: existing.note ?? "",
    });
    // `rows` seul : on ne veut pas réécraser la saisie en cours à chaque frappe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.date, rows.length]);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const parsed = createPrayerTimesSchema.safeParse({
      ...form,
      chourouk: form.chourouk || null,
      jumua: form.jumua || null,
      note: form.note || null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Formulaire invalide");
      return;
    }

    setBusy(true);
    const { error: dbError } = await getSupabase()
      .from("prayer_times")
      .upsert(parsed.data, { onConflict: "date" });
    setBusy(false);

    if (dbError) {
      setError(dbError.message);
      return;
    }
    setSaved(true);
    loadHistory();
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8 flex items-center gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-emerald shadow-glow">
          <Clock className="h-5 w-5 text-white" />
        </span>
        <div>
          <h1 className="font-display text-h1">Horaires de prière</h1>
          <p className="text-caption text-light-muted dark:text-dark-muted">
            Publiés en temps réel vers l&apos;application des fidèles
          </p>
        </div>
      </header>

      {!configured && (
        <div className="mb-6 rounded-md border border-warning/40 bg-warning/10 p-4 text-caption text-warning">
          Supabase non configuré — la publication est désactivée.
        </div>
      )}

      <form
        onSubmit={publish}
        className="rounded-lg border border-light-border bg-light-surface p-5 shadow-card dark:border-dark-border dark:bg-dark-surface"
      >
        <label className="mb-1.5 block text-caption text-light-muted dark:text-dark-muted">
          Date
        </label>
        <input
          type="date"
          value={form.date}
          onChange={set("date")}
          className="mb-5 w-full rounded-md border border-light-border bg-transparent px-4 py-3 text-body outline-none focus:border-primary dark:border-dark-border"
        />

        <div className="mb-5 grid gap-4 sm:grid-cols-3">
          {PRAYER_KEYS.map((k) => (
            <div key={k}>
              <label className="mb-1.5 flex items-center gap-2 text-caption">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: PRAYER_META[k].color }}
                />
                {PRAYER_META[k].label}
                <span className="arabic text-light-muted dark:text-dark-muted">
                  {PRAYER_META[k].arabic}
                </span>
              </label>
              <input
                type="time"
                value={form[k]}
                onChange={set(k)}
                className="w-full rounded-md border border-light-border bg-transparent px-3 py-2.5 text-body outline-none focus:border-primary dark:border-dark-border"
              />
            </div>
          ))}

          <div>
            <label className="mb-1.5 block text-caption text-light-muted dark:text-dark-muted">
              Chourouk (lever)
            </label>
            <input
              type="time"
              value={form.chourouk}
              onChange={set("chourouk")}
              className="w-full rounded-md border border-light-border bg-transparent px-3 py-2.5 text-body outline-none focus:border-primary dark:border-dark-border"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-caption text-secondary">Djouma (vendredi)</label>
            <input
              type="time"
              value={form.jumua}
              onChange={set("jumua")}
              className="w-full rounded-md border border-secondary/50 bg-transparent px-3 py-2.5 text-body outline-none focus:border-secondary"
            />
          </div>
        </div>

        <label className="mb-1.5 block text-caption text-light-muted dark:text-dark-muted">
          Note affichée aux fidèles (facultatif)
        </label>
        <input
          value={form.note}
          onChange={set("note")}
          placeholder="Ex. : horaires ajustés pour le Ramadan"
          className="mb-5 w-full rounded-md border border-light-border bg-transparent px-4 py-3 text-body outline-none focus:border-primary dark:border-dark-border"
        />

        <div className="flex items-center justify-between">
          <p className="text-caption text-light-muted dark:text-dark-muted">
            Republier la même date met à jour les horaires existants.
          </p>
          <button
            type="submit"
            disabled={busy || !configured}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-medium text-white transition hover:bg-primary-hover hover:shadow-glow disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> {busy ? "Publication…" : "Publier"}
          </button>
        </div>

        {error && <p className="mt-3 text-caption text-danger">{error}</p>}
        {saved && <p className="mt-3 text-caption text-success">Horaires publiés.</p>}
      </form>

      <h2 className="mb-3 mt-8 flex items-center gap-2 font-display text-h3">
        <CalendarClock className="h-4 w-4 text-primary" /> Programmés
      </h2>
      <div className="overflow-x-auto rounded-md border border-light-border dark:border-dark-border">
        <table className="w-full min-w-[560px] text-left text-body">
          <thead className="bg-light-surface-alt text-caption text-light-muted dark:bg-dark-surface-alt dark:text-dark-muted">
            <tr>
              <th className="px-4 py-3">Date</th>
              {PRAYER_KEYS.map((k) => (
                <th key={k} className="px-3 py-3">
                  {PRAYER_META[k].label}
                </th>
              ))}
              <th className="px-3 py-3">Djouma</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className="border-t border-light-border dark:border-dark-border"
              >
                <td className="px-4 py-3 font-medium">
                  {new Intl.DateTimeFormat("fr-FR", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  }).format(new Date(`${r.date}T12:00:00`))}
                </td>
                {PRAYER_KEYS.map((k) => (
                  <td key={k} className="px-3 py-3 tabular-nums">
                    {r[k]}
                  </td>
                ))}
                <td className="px-3 py-3 tabular-nums text-secondary">{r.jumua ?? "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-caption text-light-muted dark:text-dark-muted"
                >
                  Aucun horaire programmé.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
