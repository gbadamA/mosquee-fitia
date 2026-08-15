"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FolderArchive, Upload, Download, Trash2 } from "lucide-react";
import {
  createDocumentSchema,
  DOCUMENT_TYPE_LABELS,
  type DocumentType,
} from "@fitia/shared";
import type { DocumentRow } from "@fitia/supabase";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

/**
 * Archivage des documents de la mosquée (statuts, PV de réunion, contrats).
 *
 * Le bucket Storage `documents` est **privé** : on ne sert jamais d'URL publique.
 * Le téléchargement passe par une URL signée à durée limitée, générée à la demande.
 */

const TYPES = Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[];
const MAX_SIZE = 20 * 1024 * 1024; // 20 Mo — au-delà, c'est un mauvais canal.

export default function DocumentsPage() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<DocumentType>("proces_verbal");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const configured = isSupabaseConfigured();

  const load = useCallback(async () => {
    if (!configured) return;
    const { data } = await getSupabase()
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false });
    setRows((data as DocumentRow[]) ?? []);
  }, [configured]);

  useEffect(() => {
    load();
  }, [load]);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const parsed = createDocumentSchema.safeParse({
      title,
      type,
      description: description || null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Formulaire invalide");
      return;
    }
    if (!file) {
      setError("Choisissez un fichier.");
      return;
    }
    if (file.size > MAX_SIZE) {
      setError("Fichier trop volumineux (20 Mo maximum).");
      return;
    }

    setBusy(true);
    const supabase = getSupabase();
    // Nom neutre : le nom d'origine peut contenir des accents ou des espaces
    // qui compliquent l'URL, et il est déjà conservé dans le titre.
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const path = `${new Date().getFullYear()}/${crypto.randomUUID()}.${extension}`;

    const { error: storageError } = await supabase.storage
      .from("documents")
      .upload(path, file, { upsert: false, contentType: file.type || undefined });

    if (storageError) {
      setBusy(false);
      setError(storageError.message);
      return;
    }

    const { error: dbError } = await supabase.from("documents").insert({
      ...parsed.data,
      storage_path: path,
      file_size: file.size,
      uploaded_by: profile?.id ?? null,
    });
    setBusy(false);

    if (dbError) {
      // La ligne n'a pas été créée : on retire le fichier orphelin.
      await supabase.storage.from("documents").remove([path]);
      setError(dbError.message);
      return;
    }

    setMessage(`« ${parsed.data.title} » archivé.`);
    setTitle("");
    setDescription("");
    setFile(null);
    if (fileInput.current) fileInput.current.value = "";
    load();
  }

  /** URL signée valable 60 s — suffisant pour déclencher le téléchargement. */
  async function download(row: DocumentRow) {
    setError(null);
    const { data, error: signError } = await getSupabase()
      .storage.from("documents")
      .createSignedUrl(row.storage_path, 60);
    if (signError || !data) {
      setError(signError?.message ?? "Lien indisponible");
      return;
    }
    window.open(data.signedUrl, "_blank", "noreferrer");
  }

  async function remove(row: DocumentRow) {
    setError(null);
    const supabase = getSupabase();
    const { error: dbError } = await supabase.from("documents").delete().eq("id", row.id);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    await supabase.storage.from("documents").remove([row.storage_path]);
    load();
  }

  const field =
    "w-full rounded-md border border-light-border bg-transparent px-3 py-2.5 text-body outline-none focus:border-primary dark:border-dark-border";

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8 flex items-center gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-emerald shadow-glow">
          <FolderArchive className="h-5 w-5 text-white" />
        </span>
        <div>
          <h1 className="font-display text-h1">Documents</h1>
          <p className="text-caption text-light-muted dark:text-dark-muted">
            Statuts, procès-verbaux, contrats — accès réservé au bureau
          </p>
        </div>
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

      <form
        onSubmit={upload}
        className="mb-8 rounded-lg border border-light-border bg-light-surface p-5 shadow-card dark:border-dark-border dark:bg-dark-surface"
      >
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Intitulé du document"
            className={field}
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as DocumentType)}
            className={field}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {DOCUMENT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (facultatif)"
          className={`${field} mb-3`}
        />
        <input
          ref={fileInput}
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="mb-4 w-full text-caption text-light-muted file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-2 file:text-white dark:text-dark-muted"
        />
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-medium text-white transition hover:bg-primary-hover hover:shadow-glow disabled:opacity-50"
        >
          <Upload className="h-4 w-4" /> {busy ? "Envoi…" : "Archiver"}
        </button>
      </form>

      <ul className="space-y-2">
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center gap-3 rounded-md border border-light-border bg-light-surface p-4 dark:border-dark-border dark:bg-dark-surface"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{r.title}</p>
              <p className="text-caption text-light-muted dark:text-dark-muted">
                {DOCUMENT_TYPE_LABELS[r.type]}
                {r.file_size ? ` · ${Math.round(Number(r.file_size) / 1024)} Ko` : ""} ·{" "}
                {new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(
                  new Date(r.created_at),
                )}
              </p>
              {r.description && (
                <p className="mt-1 text-caption text-light-muted dark:text-dark-muted">
                  {r.description}
                </p>
              )}
            </div>
            <button
              onClick={() => download(r)}
              className="inline-flex items-center gap-1.5 rounded-full border border-light-border px-4 py-2 text-caption transition hover:border-primary hover:text-primary dark:border-dark-border"
            >
              <Download className="h-3.5 w-3.5" /> Télécharger
            </button>
            <button
              onClick={() => remove(r)}
              aria-label={`Supprimer ${r.title}`}
              className="inline-flex items-center rounded-full border border-light-border p-2 text-light-muted transition hover:border-danger hover:text-danger dark:border-dark-border dark:text-dark-muted"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="rounded-md border border-dashed border-light-border p-8 text-center text-caption text-light-muted dark:border-dark-border dark:text-dark-muted">
            Aucun document archivé.
          </li>
        )}
      </ul>
    </main>
  );
}
