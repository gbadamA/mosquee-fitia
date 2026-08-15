"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Moon, LogIn } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

/**
 * Connexion du personnel de la mosquée : email + mot de passe.
 * Les fidèles, eux, se connectent par OTP SMS depuis l'app mobile — le back-office
 * n'a pas besoin d'un canal SMS pour 4 ou 5 comptes.
 */
export default function LoginPage() {
  const { session } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (session) router.replace("/");
  }, [session, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error: authError } = await getSupabase().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (authError) {
      setError("Identifiants incorrects.");
      return;
    }
    router.replace("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-lg bg-emerald shadow-glow">
            <Moon className="h-6 w-6 text-white" />
          </span>
          <h1 className="font-display text-h1">Mosquée Fitia</h1>
          <p className="text-caption text-light-muted dark:text-dark-muted">
            Espace d&apos;administration — Petro Ivoire, Abobo
          </p>
        </div>

        {!configured && (
          <div className="mb-6 rounded-md border border-warning/40 bg-warning/10 p-4 text-caption text-warning">
            Supabase non configuré — renseigne <code>NEXT_PUBLIC_SUPABASE_URL</code> et{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> dans <code>.env.local</code>.
          </div>
        )}

        <form
          onSubmit={submit}
          className="rounded-lg border border-light-border bg-light-surface p-6 shadow-card dark:border-dark-border dark:bg-dark-surface"
        >
          <label className="mb-1.5 block text-caption text-light-muted dark:text-dark-muted">
            Adresse email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            className="mb-4 w-full rounded-md border border-light-border bg-transparent px-4 py-3 text-body outline-none focus:border-primary dark:border-dark-border"
          />

          <label className="mb-1.5 block text-caption text-light-muted dark:text-dark-muted">
            Mot de passe
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="mb-5 w-full rounded-md border border-light-border bg-transparent px-4 py-3 text-body outline-none focus:border-primary dark:border-dark-border"
          />

          <button
            type="submit"
            disabled={busy || !configured}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 font-medium text-white transition hover:bg-primary-hover hover:shadow-glow disabled:opacity-50"
          >
            <LogIn className="h-4 w-4" /> {busy ? "Connexion…" : "Se connecter"}
          </button>

          {error && <p className="mt-3 text-center text-caption text-danger">{error}</p>}
        </form>
      </div>
    </main>
  );
}
