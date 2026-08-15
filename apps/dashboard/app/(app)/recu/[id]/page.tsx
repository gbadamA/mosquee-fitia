"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";
import {
  formatFCFA,
  receiptNumber,
  PAYMENT_METHOD_LABELS,
  DONATION_TYPE_LABELS,
  type Profile,
} from "@fitia/shared";
import type { ContributionRow, DonationRow, MosqueRow } from "@fitia/supabase";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

/**
 * Reçu imprimable d'une entrée validée.
 *
 * L'identifiant peut désigner une cotisation OU un don : on interroge les deux tables
 * (les UUID ne se chevauchent pas). Impression via `window.print()` — aucune dépendance
 * PDF à embarquer, et le navigateur sait déjà « Enregistrer au format PDF ».
 */

type Receipt = {
  id: string;
  nature: string;
  amount: number;
  method: keyof typeof PAYMENT_METHOD_LABELS;
  reference: string | null;
  createdAt: string;
  validatedAt: string | null;
  memberId: string | null;
  anonymous: boolean;
};

export default function RecuPage() {
  const params = useParams<{ id: string }>();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [member, setMember] = useState<Profile | null>(null);
  const [mosque, setMosque] = useState<MosqueRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured() || !params?.id) {
      setLoading(false);
      return;
    }
    const supabase = getSupabase();

    (async () => {
      const [{ data: contribution }, { data: donation }, { data: m }] = await Promise.all([
        supabase.from("contributions").select("*").eq("id", params.id).maybeSingle(),
        supabase.from("donations").select("*").eq("id", params.id).maybeSingle(),
        supabase.from("mosque").select("*").limit(1).maybeSingle(),
      ]);

      setMosque((m as MosqueRow) ?? null);

      let found: Receipt | null = null;
      if (contribution) {
        const c = contribution as ContributionRow;
        found = {
          id: c.id,
          nature: `Cotisation — ${c.period}`,
          amount: Number(c.amount),
          method: c.method,
          reference: c.reference,
          createdAt: c.created_at,
          validatedAt: c.validated_at,
          memberId: c.member_id,
          anonymous: false,
        };
      } else if (donation) {
        const d = donation as DonationRow;
        found = {
          id: d.id,
          nature: DONATION_TYPE_LABELS[d.type],
          amount: Number(d.amount),
          method: d.method,
          reference: d.reference,
          createdAt: d.created_at,
          validatedAt: d.validated_at,
          memberId: d.donor_id,
          anonymous: d.anonymous,
        };
      }

      setReceipt(found);

      if (found?.memberId && !found.anonymous) {
        const { data: p } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", found.memberId)
          .maybeSingle();
        setMember((p as Profile) ?? null);
      }
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

  if (!receipt) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16 text-center">
        <p className="text-body text-light-muted dark:text-dark-muted">
          Aucune entrée ne correspond à cet identifiant.
        </p>
        <Link href="/finances" className="mt-4 inline-block text-primary hover:underline">
          Retour aux finances
        </Link>
      </main>
    );
  }

  const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(
    new Date(receipt.validatedAt ?? receipt.createdAt),
  );

  const line = (label: string, value: string) => (
    <div className="flex justify-between border-b border-light-border py-2.5 dark:border-dark-border print:border-neutral-300">
      <span className="text-light-muted dark:text-dark-muted print:text-neutral-600">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );

  return (
    <main className="mx-auto max-w-xl px-6 py-10 print:max-w-none print:px-0 print:py-0">
      <div className="mb-5 flex items-center justify-between print:hidden">
        <Link
          href="/finances"
          className="inline-flex items-center gap-2 text-caption text-light-muted transition hover:text-primary dark:text-dark-muted"
        >
          <ArrowLeft className="h-4 w-4" /> Finances
        </Link>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-medium text-white transition hover:bg-primary-hover hover:shadow-glow"
        >
          <Printer className="h-4 w-4" /> Imprimer / PDF
        </button>
      </div>

      <article className="overflow-hidden rounded-lg border border-light-border bg-light-surface dark:border-dark-border dark:bg-dark-surface print:rounded-none print:border-0 print:bg-white print:text-black">
        {/* En-tête */}
        <header className="bg-emerald p-6 print:bg-white print:text-black">
          <div className="pattern-islamic print:hidden" />
          <p className="text-caption text-white/80 print:text-neutral-600">
            {mosque?.name ?? "Mosquée"}
          </p>
          <h1 className="font-display text-h1 text-white print:text-black">Reçu de versement</h1>
          <p className="text-caption text-white/80 print:text-neutral-600">
            {[mosque?.address, mosque?.city].filter(Boolean).join(" · ")}
          </p>
        </header>

        <div className="p-6">
          <p className="mb-5 font-mono text-h3 text-primary print:text-black">
            {receiptNumber(receipt.id)}
          </p>

          {line("Date", date)}
          {line(
            "Reçu de",
            receipt.anonymous ? "Donateur anonyme" : (member?.full_name ?? "Fidèle"),
          )}
          {!receipt.anonymous && member?.member_number && line("N° adhérent", member.member_number)}
          {line("Nature", receipt.nature)}
          {line("Moyen de paiement", PAYMENT_METHOD_LABELS[receipt.method])}
          {receipt.reference && line("Référence", receipt.reference)}

          <div className="mt-5 flex items-baseline justify-between rounded-md bg-light-surface-alt p-4 dark:bg-dark-surface-alt print:bg-neutral-100">
            <span className="text-body">Montant reçu</span>
            <span className="font-display text-h1 text-primary print:text-black">
              {formatFCFA(receipt.amount)}
            </span>
          </div>

          <p className="mt-6 text-caption leading-relaxed text-light-muted dark:text-dark-muted print:text-neutral-600">
            La mosquée accuse réception de la somme ci-dessus et vous en remercie.
            Qu&apos;Allah accepte votre contribution.
          </p>

          <div className="mt-8 flex justify-between text-caption text-light-muted dark:text-dark-muted print:text-neutral-600">
            <span>Document généré le {new Intl.DateTimeFormat("fr-FR").format(new Date())}</span>
            <span>Signature et cachet</span>
          </div>
        </div>
      </article>
    </main>
  );
}
