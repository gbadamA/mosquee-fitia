"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Megaphone, Send, Pin } from "lucide-react";
import {
  createAnnouncementSchema,
  CATEGORY_META,
  type AnnouncementCategory,
  type Announcement,
} from "@fitia/shared";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

const CATEGORIES: AnnouncementCategory[] = [
  "info",
  "khutba",
  "evenement",
  "urgent",
  "collecte",
];

export default function AnnoncesPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<AnnouncementCategory>("info");
  const [pinned, setPinned] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Announcement[]>([]);
  const configured = isSupabaseConfigured();

  // Historique + abonnement temps réel (le même flux que reçoit le mobile).
  useEffect(() => {
    if (!configured) return;
    const supabase = getSupabase();

    supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => data && setItems(data as Announcement[]));

    const channel = supabase
      .channel("dashboard:announcements")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "announcements" },
        (payload) => setItems((prev) => [payload.new as Announcement, ...prev]),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [configured]);

  async function broadcast(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = createAnnouncementSchema.safeParse({ title, body, category, pinned });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Formulaire invalide");
      return;
    }

    setSending(true);
    const supabase = getSupabase();
    const { error: dbError } = await supabase.from("announcements").insert(parsed.data);
    setSending(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }

    // Notification push (Edge Function). Sans effet si la fonction n'est pas déployée.
    supabase.functions
      .invoke("send-push", {
        body: { title: parsed.data.title, body: parsed.data.body },
      })
      .catch(() => {});

    setTitle("");
    setBody("");
    setPinned(false);
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <header className="mb-8 flex items-center gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-emerald shadow-glow">
          <Megaphone className="h-5 w-5 text-white" />
        </span>
        <div>
          <h1 className="font-display text-h1">Diffusion</h1>
          <p className="text-caption text-light-muted dark:text-dark-muted">
            Khutba, informations et appels à la collecte — reçus en direct par les fidèles
          </p>
        </div>
      </header>

      {!configured && (
        <div className="mb-6 rounded-md border border-warning/40 bg-warning/10 p-4 text-caption text-warning">
          Supabase non configuré — renseigne <code>NEXT_PUBLIC_SUPABASE_URL</code> et{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> dans <code>.env.local</code>.
        </div>
      )}

      <form
        onSubmit={broadcast}
        className="rounded-lg border border-light-border bg-light-surface p-5 shadow-card dark:border-dark-border dark:bg-dark-surface"
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre de l'annonce"
          className="mb-3 w-full rounded-md border border-light-border bg-transparent px-4 py-3 text-body outline-none focus:border-primary dark:border-dark-border"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Votre message aux fidèles…"
          rows={4}
          className="mb-4 w-full resize-none rounded-md border border-light-border bg-transparent px-4 py-3 text-body outline-none focus:border-primary dark:border-dark-border"
        />

        <div className="mb-4 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const meta = CATEGORY_META[c];
            const active = category === c;
            return (
              <button
                type="button"
                key={c}
                onClick={() => setCategory(c)}
                className="rounded-full px-3 py-1.5 text-caption font-medium transition"
                style={{
                  backgroundColor: active ? meta.color : "transparent",
                  color: active ? "#fff" : meta.color,
                  border: `1px solid ${meta.color}`,
                }}
              >
                {meta.emoji} {meta.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-caption text-light-muted dark:text-dark-muted">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
            />
            <Pin className="h-3.5 w-3.5" /> Épingler
          </label>
          <button
            type="submit"
            disabled={sending || !configured}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-medium text-white transition hover:bg-primary-hover hover:shadow-glow disabled:opacity-50"
          >
            <Send className="h-4 w-4" /> {sending ? "Envoi…" : "Diffuser"}
          </button>
        </div>
        {error && <p className="mt-3 text-caption text-danger">{error}</p>}
      </form>

      <h2 className="mb-3 mt-8 font-display text-h3">Aperçu du fil</h2>
      <ul className="space-y-3">
        <AnimatePresence initial={false}>
          {items.map((a) => {
            const meta = CATEGORY_META[a.category];
            return (
              <motion.li
                key={a.id}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-md border border-light-border bg-light-surface p-4 dark:border-dark-border dark:bg-dark-surface"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                    style={{ backgroundColor: meta.color }}
                  >
                    {meta.emoji} {meta.label}
                  </span>
                  {a.pinned && <Pin className="h-3.5 w-3.5 text-primary" />}
                </div>
                <p className="font-display text-h3">{a.title}</p>
                <p className="text-body text-light-muted dark:text-dark-muted">{a.body}</p>
              </motion.li>
            );
          })}
        </AnimatePresence>
        {items.length === 0 && (
          <li className="rounded-md border border-dashed border-light-border p-6 text-center text-caption text-light-muted dark:border-dark-border dark:text-dark-muted">
            Aucune annonce pour le moment.
          </li>
        )}
      </ul>
    </main>
  );
}
