"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, Send, Archive, CheckCircle2, Eye, Circle } from "lucide-react";
import type { ConsigneRow, ConsigneSuiviRow } from "@fitia/supabase";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

/**
 * Consignes du bureau vers le staff de terrain (membres qui tournent auprès
 * des fidèles). Une consigne vise un membre, ou TOUT le staff de terrain ; le
 * suivi est tenu par destinataire (« reçue », « faite », compte rendu), que le
 * membre met à jour depuis l'application mobile.
 */

type Membre = { id: string; full_name: string | null; status: string };

const field =
  "w-full rounded-md border border-light-border bg-transparent px-3 py-2.5 text-body outline-none focus:border-primary dark:border-dark-border";
const label = "mb-1.5 block text-caption text-light-muted dark:text-dark-muted";

export default function ConsignesPage() {
  const configured = isSupabaseConfigured();
  const [consignes, setConsignes] = useState<ConsigneRow[]>([]);
  const [suivis, setSuivis] = useState<ConsigneSuiviRow[]>([]);
  const [staff, setStaff] = useState<Membre[]>([]);
  const [voirArchives, setVoirArchives] = useState(false);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<"normale" | "urgente">("normale");
  const [dueDate, setDueDate] = useState("");
  const [assignee, setAssignee] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!configured) return;
    const supabase = getSupabase();
    const [c, s, m] = await Promise.all([
      supabase.from("consignes").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("consigne_suivis").select("*"),
      supabase.from("profiles").select("id, full_name, status").eq("role", "membre_staff").order("full_name"),
    ]);
    setConsignes((c.data as ConsigneRow[]) ?? []);
    setSuivis((s.data as ConsigneSuiviRow[]) ?? []);
    setStaff((m.data as Membre[]) ?? []);
  }, [configured]);

  useEffect(() => {
    load();
    // Les accusés de réception arrivent en direct depuis les téléphones.
    const canal = getSupabase()
      .channel("consignes-suivi")
      .on("postgres_changes", { event: "*", schema: "public", table: "consigne_suivis" }, () => load())
      .subscribe();
    return () => {
      void getSupabase().removeChannel(canal);
    };
  }, [load]);

  const actifs = useMemo(() => staff.filter((m) => m.status !== "inactif"), [staff]);
  const nom = (id: string | null) => staff.find((m) => m.id === id)?.full_name ?? "Membre";

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (title.trim().length < 3) {
      setError("Donnez un titre d'au moins 3 caractères.");
      return;
    }
    setBusy(true);
    const supabase = getSupabase();
    const { error: dbError } = await supabase.from("consignes").insert({
      title: title.trim(),
      body: body.trim() || null,
      priority,
      due_date: dueDate || null,
      assignee_id: assignee || null,
    });
    if (dbError) {
      setBusy(false);
      setError(dbError.message);
      return;
    }
    // Notification au(x) destinataire(s) — ne part que vers l'application
    // installée (APK) ; un échec n'annule pas la consigne, déjà visible.
    const { data: push } = await supabase.functions.invoke("send-push", {
      body: {
        title: priority === "urgente" ? `Consigne urgente : ${title.trim()}` : `Nouvelle consigne : ${title.trim()}`,
        body: body.trim().slice(0, 140) || undefined,
        ...(assignee ? { member_ids: [assignee] } : { audience: "staff" }),
      },
    });
    setBusy(false);
    setTitle("");
    setBody("");
    setPriority("normale");
    setDueDate("");
    setAssignee("");
    const envoyes = (push as { sent?: number } | null)?.sent ?? 0;
    setMessage(
      envoyes > 0
        ? `Consigne envoyée et notifiée sur ${envoyes} téléphone(s).`
        : "Consigne envoyée. Elle apparaît dans l'application du staff (aucune notification n'a pu partir : application pas encore ouverte sur un téléphone).",
    );
    load();
  }

  async function archiver(c: ConsigneRow) {
    const { error: dbError } = await getSupabase().from("consignes").update({ archived: !c.archived }).eq("id", c.id);
    if (dbError) setError(dbError.message);
    else load();
  }

  const visibles = consignes.filter((c) => c.archived === voirArchives);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8 flex items-center gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-emerald shadow-glow">
          <ClipboardList className="h-5 w-5 text-white" />
        </span>
        <div>
          <h1 className="font-display text-h1">Consignes</h1>
          <p className="text-caption text-light-muted dark:text-dark-muted">
            Instructions du bureau au staff de terrain, suivies sur l&apos;application mobile
          </p>
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-md border border-danger/40 bg-danger/10 p-3 text-caption text-danger">{error}</div>
      )}
      {message && (
        <div className="mb-4 rounded-md border border-success/40 bg-success/10 p-3 text-caption text-success">{message}</div>
      )}

      <form
        onSubmit={envoyer}
        className="mb-10 rounded-lg border border-light-border bg-light-surface p-5 shadow-card dark:border-dark-border dark:bg-dark-surface"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={label} htmlFor="titre">Consigne</label>
            <input id="titre" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Accueillir les fidèles à l'entrée vendredi" className={field} />
          </div>
          <div className="sm:col-span-2">
            <label className={label} htmlFor="detail">Détails (facultatif)</label>
            <textarea id="detail" value={body} onChange={(e) => setBody(e.target.value)} rows={3} className={field} />
          </div>
          <div>
            <label className={label} htmlFor="destinataire">Destinataire</label>
            <select id="destinataire" value={assignee} onChange={(e) => setAssignee(e.target.value)} className={field}>
              <option value="">Tout le staff de terrain</option>
              {actifs.map((m) => (
                <option key={m.id} value={m.id}>{m.full_name ?? "Membre sans nom"}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="priorite">Priorité</label>
              <select id="priorite" value={priority} onChange={(e) => setPriority(e.target.value as "normale" | "urgente")} className={field}>
                <option value="normale">Normale</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
            <div>
              <label className={label} htmlFor="echeance">Pour le</label>
              <input id="echeance" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={field} />
            </div>
          </div>
        </div>
        {actifs.length === 0 && (
          <p className="mt-3 text-caption text-light-muted dark:text-dark-muted">
            Aucun membre du staff de terrain pour l&apos;instant : l&apos;imam les crée dans Administration (rôle « Membre du staff »).
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-medium text-white transition hover:bg-primary-hover hover:shadow-glow disabled:opacity-50"
        >
          <Send className="h-4 w-4" /> {busy ? "Envoi…" : "Envoyer la consigne"}
        </button>
      </form>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-h3">{voirArchives ? "Consignes archivées" : "Consignes en cours"}</h2>
        <button onClick={() => setVoirArchives((v) => !v)} className="text-caption text-primary hover:underline">
          {voirArchives ? "Voir les consignes en cours" : "Voir les archives"}
        </button>
      </div>

      <ul className="space-y-3">
        {visibles.map((c) => {
          const destinataires = c.assignee_id ? staff.filter((m) => m.id === c.assignee_id) : actifs;
          return (
            <li key={c.id} className="rounded-lg border border-light-border p-4 dark:border-dark-border">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">
                    {c.priority === "urgente" && <span className="mr-2 rounded-full bg-danger/15 px-2 py-0.5 text-caption text-danger">Urgente</span>}
                    {c.title}
                  </p>
                  <p className="text-caption text-light-muted dark:text-dark-muted">
                    {c.assignee_id ? `Pour ${nom(c.assignee_id)}` : "Pour tout le staff"}
                    {c.due_date ? ` · pour le ${new Date(c.due_date).toLocaleDateString("fr-FR")}` : ""}
                    {` · envoyée le ${new Date(c.created_at).toLocaleDateString("fr-FR")}`}
                  </p>
                  {c.body && <p className="mt-1 whitespace-pre-line text-body">{c.body}</p>}
                </div>
                <button onClick={() => archiver(c)} className="inline-flex items-center gap-1.5 text-caption text-light-muted hover:text-primary dark:text-dark-muted">
                  <Archive className="h-3.5 w-3.5" /> {c.archived ? "Désarchiver" : "Archiver"}
                </button>
              </div>

              <ul className="mt-3 space-y-1.5 border-t border-light-border pt-3 dark:border-dark-border">
                {destinataires.length === 0 && (
                  <li className="text-caption text-light-muted dark:text-dark-muted">Aucun destinataire actif.</li>
                )}
                {destinataires.map((m) => {
                  const suivi = suivis.find((s) => s.consigne_id === c.id && s.member_id === m.id);
                  return (
                    <li key={m.id} className="flex flex-wrap items-center gap-2 text-caption">
                      {suivi?.status === "faite" ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : suivi?.status === "recue" ? (
                        <Eye className="h-4 w-4 text-primary" />
                      ) : (
                        <Circle className="h-4 w-4 text-light-muted dark:text-dark-muted" />
                      )}
                      <span className="font-medium">{m.full_name ?? "Membre"}</span>
                      <span className="text-light-muted dark:text-dark-muted">
                        {suivi?.status === "faite" ? "faite" : suivi?.status === "recue" ? "bien reçue" : "pas encore lue"}
                        {suivi ? ` · ${new Date(suivi.updated_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : ""}
                      </span>
                      {suivi?.report && <span className="basis-full pl-6 italic">« {suivi.report} »</span>}
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
        {visibles.length === 0 && (
          <li className="rounded-lg border border-dashed border-light-border p-6 text-center text-caption text-light-muted dark:border-dark-border dark:text-dark-muted">
            {voirArchives ? "Aucune consigne archivée." : "Aucune consigne en cours."}
          </li>
        )}
      </ul>
    </main>
  );
}
