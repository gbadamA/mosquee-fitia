"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, History } from "lucide-react";
import {
  createAssetEventSchema,
  formatFCFA,
  todayISO,
  ASSET_EVENT_LABELS,
  ASSET_CONDITION_LABELS,
  type AssetEventType,
  type AssetCondition,
} from "@fitia/shared";
import type { AssetEventRow, AssetRow } from "@fitia/supabase";
import { getSupabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

/**
 * Journal daté d'un bien : acquisition, contrôles, réparations, déplacements.
 *
 * L'inventaire seul ne dit que l'état ACTUEL. Ce journal répond aux questions qui
 * comptent en assemblée : depuis quand la sonorisation est-elle en panne, et
 * combien a-t-elle déjà coûté en réparations ?
 *
 * Les changements d'état saisis dans le tableau y arrivent automatiquement, via
 * un déclencheur Postgres — l'historique n'a donc pas de trou là où on en a le
 * plus besoin.
 */

const TYPES = Object.keys(ASSET_EVENT_LABELS) as AssetEventType[];
const CONDITIONS = Object.keys(ASSET_CONDITION_LABELS) as AssetCondition[];

const TYPE_COLOR: Record<AssetEventType, string> = {
  acquisition: "bg-primary/15 text-primary",
  controle: "bg-tertiary/15 text-tertiary",
  reparation: "bg-warning/15 text-warning",
  deplacement: "bg-light-surface-alt text-light-muted dark:bg-dark-surface-alt dark:text-dark-muted",
  changement_etat: "bg-secondary/20 text-secondary",
  sortie: "bg-danger/15 text-danger",
  autre: "bg-light-surface-alt text-light-muted dark:bg-dark-surface-alt dark:text-dark-muted",
};

export default function AssetHistory({ asset }: { asset: AssetRow }) {
  const { profile } = useAuth();
  const [events, setEvents] = useState<AssetEventRow[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [type, setType] = useState<AssetEventType>("controle");
  const [occurredOn, setOccurredOn] = useState(todayISO());
  const [note, setNote] = useState("");
  const [cost, setCost] = useState("");
  const [conditionAfter, setConditionAfter] = useState<AssetCondition | "">("");

  const load = useCallback(async () => {
    const { data } = await getSupabase()
      .from("asset_events")
      .select("*")
      .eq("asset_id", asset.id)
      .order("occurred_on", { ascending: false });
    setEvents((data as AssetEventRow[]) ?? []);
  }, [asset.id]);

  useEffect(() => {
    load();
  }, [load]);

  /** Cumul des réparations — le chiffre qui justifie un remplacement. */
  const totalCost = events.reduce((acc, e) => acc + Number(e.cost_fcfa ?? 0), 0);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = createAssetEventSchema.safeParse({
      asset_id: asset.id,
      type,
      occurred_on: occurredOn,
      note: note.trim() || null,
      condition_after: conditionAfter || null,
      cost_fcfa: cost ? Number(cost) : null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Formulaire invalide");
      return;
    }

    setBusy(true);
    const supabase = getSupabase();
    const { error: dbError } = await supabase
      .from("asset_events")
      .insert({ ...parsed.data, created_by: profile?.id ?? null });

    // Si l'intervention change l'état constaté, on met le bien à jour aussi :
    // le tableau et le journal doivent raconter la même chose.
    if (!dbError && parsed.data.condition_after) {
      await supabase
        .from("assets")
        .update({ condition: parsed.data.condition_after })
        .eq("id", asset.id);
    }

    setBusy(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    setNote("");
    setCost("");
    setConditionAfter("");
    setOpen(false);
    load();
  }

  const field =
    "w-full rounded-md border border-light-border bg-transparent px-3 py-2 text-caption outline-none focus:border-primary dark:border-dark-border";

  return (
    <div className="border-t border-light-border p-4 dark:border-dark-border">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 text-caption font-medium">
          <History className="h-3.5 w-3.5 text-primary" />
          Historique — {events.length} intervention(s)
          {totalCost > 0 && (
            <span className="text-light-muted dark:text-dark-muted">
              · {formatFCFA(totalCost)} de frais cumulés
            </span>
          )}
        </p>
        <button
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 rounded-full border border-light-border px-3.5 py-1.5 text-caption transition hover:border-primary hover:text-primary dark:border-dark-border"
        >
          <Plus className="h-3.5 w-3.5" /> {open ? "Fermer" : "Consigner"}
        </button>
      </div>

      {error && <p className="mb-3 text-caption text-danger">{error}</p>}

      {open && (
        <form onSubmit={add} className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as AssetEventType)}
            className={field}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {ASSET_EVENT_LABELS[t]}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value)}
            className={field}
          />
          <input
            value={cost}
            onChange={(e) => setCost(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            placeholder="Coût (FCFA)"
            className={field}
          />
          <select
            value={conditionAfter}
            onChange={(e) => setConditionAfter(e.target.value as AssetCondition | "")}
            className={field}
          >
            <option value="">État inchangé</option>
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                Après : {ASSET_CONDITION_LABELS[c]}
              </option>
            ))}
          </select>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Détail de l'intervention"
            className={`${field} sm:col-span-2 lg:col-span-3`}
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-primary px-4 py-2 text-caption font-medium text-white transition hover:bg-primary-hover disabled:opacity-50"
          >
            {busy ? "…" : "Enregistrer"}
          </button>
        </form>
      )}

      {events.length === 0 ? (
        <p className="text-caption text-light-muted dark:text-dark-muted">
          Aucune intervention consignée.
        </p>
      ) : (
        <ol className="space-y-2">
          {events.map((e) => (
            <li key={e.id} className="flex flex-wrap items-baseline gap-2 text-caption">
              <span className="tabular-nums text-light-muted dark:text-dark-muted">
                {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(
                  new Date(`${e.occurred_on}T12:00:00`),
                )}
              </span>
              <span className={`rounded-full px-2 py-0.5 font-medium ${TYPE_COLOR[e.type]}`}>
                {ASSET_EVENT_LABELS[e.type]}
              </span>
              {e.note && <span className="flex-1">{e.note}</span>}
              {e.cost_fcfa ? (
                <span className="text-danger">−{formatFCFA(Number(e.cost_fcfa))}</span>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
