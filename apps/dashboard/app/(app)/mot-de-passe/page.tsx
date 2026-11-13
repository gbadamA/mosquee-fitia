"use client";

import { useState, type FormEvent } from "react";
import { KeyRound, CheckCircle2 } from "lucide-react";
import { changeOwnPassword, PASSWORD_MIN_LENGTH } from "@fitia/shared";
import { getSupabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

/**
 * Changement de son propre mot de passe, pour tout compte du bureau.
 *
 * Les comptes naissent avec un mot de passe tiré au hasard et remis de la main à
 * la main : sans cet écran, chacun gardait celui qu'on lui avait dicté.
 * L'ancien est vérifié avant tout changement (cf. `changeOwnPassword`).
 */
export default function MotDePasse() {
  const { profile } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setDone(false);
    const failure = await changeOwnPassword(getSupabase(), current, next, confirmation);
    setBusy(false);
    if (failure) {
      setError(failure);
      return;
    }
    setCurrent("");
    setNext("");
    setConfirmation("");
    setDone(true);
  }

  const field =
    "w-full rounded-md border border-light-border bg-transparent px-3 py-2.5 text-body outline-none focus:border-primary dark:border-dark-border";
  const label = "mb-1.5 block text-caption text-light-muted dark:text-dark-muted";

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <header className="mb-8 flex items-center gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-emerald shadow-glow">
          <KeyRound className="h-5 w-5 text-white" />
        </span>
        <div>
          <h1 className="font-display text-h1">Mon mot de passe</h1>
          <p className="text-caption text-light-muted dark:text-dark-muted">
            {profile?.full_name ?? "Votre compte"}
          </p>
        </div>
      </header>

      <form
        onSubmit={submit}
        className="rounded-lg border border-light-border bg-light-surface p-6 dark:border-dark-border dark:bg-dark-surface"
      >
        {done && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-success/40 bg-success/10 p-3 text-caption text-success">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Mot de passe changé. Utilisez le nouveau à votre prochaine connexion.
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-md border border-danger/40 bg-danger/10 p-3 text-caption text-danger">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className={label} htmlFor="actuel">Mot de passe actuel</label>
          <input
            id="actuel"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className={field}
          />
        </div>
        <div className="mb-4">
          <label className={label} htmlFor="nouveau">Nouveau mot de passe</label>
          <input
            id="nouveau"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className={field}
          />
          <p className="mt-1 text-caption text-light-muted dark:text-dark-muted">
            {PASSWORD_MIN_LENGTH} caractères minimum.
          </p>
        </div>
        <div className="mb-6">
          <label className={label} htmlFor="confirmation">Confirmer le nouveau mot de passe</label>
          <input
            id="confirmation"
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            className={field}
          />
        </div>

        <button
          type="submit"
          disabled={busy || !current || !next || !confirmation}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-medium text-white transition hover:bg-primary-hover hover:shadow-glow disabled:opacity-50"
        >
          <KeyRound className="h-4 w-4" />
          {busy ? "Vérification…" : "Changer le mot de passe"}
        </button>
      </form>
    </main>
  );
}
