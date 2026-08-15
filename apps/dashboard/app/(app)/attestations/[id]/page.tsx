"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Printer, ArrowLeft } from "lucide-react";
import {
  ATTESTATION_TEMPLATES,
  renderAttestation,
  formatOfficialDate,
} from "@fitia/shared";
import type { AttestationRow, MosqueRow } from "@fitia/supabase";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

/**
 * Attestation imprimable.
 *
 * Le corps du document est composé à partir du modèle partagé : le formulaire de
 * saisie et cette page lisent la même déclaration de champs, donc un champ ajouté
 * apparaît des deux côtés sans risque d'oubli.
 * Impression par `window.print()` — le navigateur sait déjà « Enregistrer en PDF ».
 */
export default function AttestationPage() {
  const params = useParams<{ id: string }>();
  const [row, setRow] = useState<AttestationRow | null>(null);
  const [mosque, setMosque] = useState<MosqueRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured() || !params?.id) {
      setLoading(false);
      return;
    }
    const supabase = getSupabase();
    (async () => {
      const [{ data: a }, { data: m }] = await Promise.all([
        supabase.from("attestations").select("*").eq("id", params.id).maybeSingle(),
        supabase.from("mosque").select("*").limit(1).maybeSingle(),
      ]);
      setRow((a as AttestationRow) ?? null);
      setMosque((m as MosqueRow) ?? null);
      setLoading(false);
    })();
  }, [params?.id]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-light-muted dark:text-dark-muted">
        Chargement…
      </main>
    );
  }

  if (!row) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16 text-center">
        <p className="text-body text-light-muted dark:text-dark-muted">
          Aucune attestation ne correspond à cet identifiant.
        </p>
        <Link href="/attestations" className="mt-4 inline-block text-primary hover:underline">
          Retour aux attestations
        </Link>
      </main>
    );
  }

  const template = ATTESTATION_TEMPLATES[row.type];

  // Les dates saisies au format ISO sont rendues en toutes lettres dans le corps.
  const raw = (row.data ?? {}) as Record<string, string>;
  const values: Record<string, string> = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [
      k,
      /^\d{4}-\d{2}-\d{2}$/.test(v) ? formatOfficialDate(v) : v,
    ]),
  );

  const body = renderAttestation(template, row.subject, values);

  return (
    <main className="mx-auto max-w-2xl px-6 py-10 print:max-w-none print:px-0 print:py-0">
      <div className="mb-5 flex items-center justify-between print:hidden">
        <Link
          href="/attestations"
          className="inline-flex items-center gap-2 text-caption text-light-muted transition hover:text-primary dark:text-dark-muted"
        >
          <ArrowLeft className="h-4 w-4" /> Attestations
        </Link>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-medium text-white transition hover:bg-primary-hover hover:shadow-glow"
        >
          <Printer className="h-4 w-4" /> Imprimer / PDF
        </button>
      </div>

      {row.cancelled && (
        <div className="mb-5 rounded-md border border-danger/40 bg-danger/10 p-4 text-caption text-danger">
          Cette attestation a été annulée. Elle ne doit pas être remise.
        </div>
      )}

      <article className="overflow-hidden rounded-lg border border-light-border bg-light-surface dark:border-dark-border dark:bg-dark-surface print:rounded-none print:border-0 print:bg-white print:text-black">
        <header className="bg-emerald p-6 print:bg-white print:text-black">
          <p className="text-caption text-white/80 print:text-neutral-600">
            {mosque?.name ?? "Mosquée"}
            {mosque?.address ? ` · ${mosque.address}` : ""}
            {mosque?.city ? `, ${mosque.city}` : ""}
          </p>
          <h1 className="font-display text-h1 text-white print:text-black">{template.title}</h1>
          <p className="font-mono text-caption text-white/90 print:text-neutral-600">
            {row.reference}
          </p>
        </header>

        <div className="p-8 print:p-6">
          <p className="mb-6 whitespace-pre-line text-body leading-relaxed">{body}</p>

          <p className="mb-10 text-body">
            Fait à {mosque?.city ?? "Abidjan"}, le {formatOfficialDate(row.issued_on)}.
          </p>

          <div className="flex justify-end">
            <div className="text-center">
              <p className="text-caption text-light-muted dark:text-dark-muted print:text-neutral-600">
                L&apos;Imam
              </p>
              <div className="mt-16 w-56 border-t border-light-border dark:border-dark-border print:border-neutral-400" />
              <p className="mt-1 text-caption text-light-muted dark:text-dark-muted print:text-neutral-600">
                Signature et cachet
              </p>
            </div>
          </div>
        </div>
      </article>
    </main>
  );
}
