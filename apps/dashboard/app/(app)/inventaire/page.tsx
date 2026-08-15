"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Boxes, Plus, Download, ChevronDown, ChevronRight } from "lucide-react";
import {
  createAssetSchema,
  formatFCFA,
  todayISO,
  downloadCSV,
  csvFilename,
  ASSET_CATEGORY_LABELS,
  ASSET_CONDITION_LABELS,
  type AssetCategory,
  type AssetCondition,
} from "@fitia/shared";
import type { AssetRow } from "@fitia/supabase";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import AssetHistory from "./AssetHistory";

/** Inventaire des biens de la mosquée — tapis, sonorisation, véhicule funéraire… */

const CATEGORIES = Object.keys(ASSET_CATEGORY_LABELS) as AssetCategory[];
const CONDITIONS = Object.keys(ASSET_CONDITION_LABELS) as AssetCondition[];

const CONDITION_STYLE: Record<AssetCondition, string> = {
  bon: "bg-success/15 text-success",
  moyen: "bg-warning/15 text-warning",
  mauvais: "bg-danger/15 text-danger",
  hors_service:
    "bg-light-surface-alt text-light-muted dark:bg-dark-surface-alt dark:text-dark-muted",
};

export default function InventairePage() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<AssetRow[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<AssetCategory | "tous">("tous");
  /** Bien déplié sur son journal daté. */
  const [expanded, setExpanded] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<AssetCategory>("mobilier");
  const [quantity, setQuantity] = useState("1");
  const [condition, setCondition] = useState<AssetCondition>("bon");
  const [value, setValue] = useState("");
  const [location, setLocation] = useState("");
  const [acquiredAt, setAcquiredAt] = useState("");

  const configured = isSupabaseConfigured();

  const load = useCallback(async () => {
    if (!configured) return;
    const { data } = await getSupabase().from("assets").select("*").order("name");
    setRows((data as AssetRow[]) ?? []);
  }, [configured]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(
    () => (filter === "tous" ? rows : rows.filter((r) => r.category === filter)),
    [rows, filter],
  );

  /** Valeur totale du patrimoine — chiffre attendu en assemblée. */
  const totalValue = filtered.reduce(
    (acc, r) => acc + Number(r.value_fcfa ?? 0) * r.quantity,
    0,
  );

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = createAssetSchema.safeParse({
      name,
      category,
      quantity: Number(quantity) || 1,
      condition,
      value_fcfa: value ? Number(value) : null,
      location: location || null,
      acquired_at: acquiredAt || null,
      notes: null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Formulaire invalide");
      return;
    }
    const { error: dbError } = await getSupabase()
      .from("assets")
      .insert({ ...parsed.data, created_by: profile?.id ?? null });
    if (dbError) {
      setError(dbError.message);
      return;
    }
    setName("");
    setValue("");
    setLocation("");
    setAcquiredAt("");
    setQuantity("1");
    setOpen(false);
    load();
  }

  /** L'état d'un bien change souvent : modifiable directement dans le tableau. */
  async function updateCondition(row: AssetRow, next: AssetCondition) {
    const { error: dbError } = await getSupabase()
      .from("assets")
      .update({ condition: next })
      .eq("id", row.id);
    if (dbError) setError(dbError.message);
    else load();
  }

  function exportCSV() {
    downloadCSV(
      csvFilename("inventaire-mosquee-fitia"),
      ["Bien", "Catégorie", "Quantité", "État", "Valeur unitaire", "Emplacement", "Acquis le"],
      filtered.map((r) => [
        r.name,
        ASSET_CATEGORY_LABELS[r.category],
        r.quantity,
        ASSET_CONDITION_LABELS[r.condition],
        r.value_fcfa ?? "",
        r.location ?? "",
        r.acquired_at ?? "",
      ]),
    );
  }

  const field =
    "w-full rounded-md border border-light-border bg-transparent px-3 py-2.5 text-body outline-none focus:border-primary dark:border-dark-border";

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-emerald shadow-glow">
            <Boxes className="h-5 w-5 text-white" />
          </span>
          <div>
            <h1 className="font-display text-h1">Inventaire</h1>
            <p className="text-caption text-light-muted dark:text-dark-muted">
              {filtered.length} bien(s) · valeur estimée {formatFCFA(totalValue)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-2 rounded-full border border-light-border px-4 py-2 text-caption transition hover:border-primary hover:text-primary disabled:opacity-50 dark:border-dark-border"
          >
            <Download className="h-4 w-4" /> Exporter
          </button>
          <button
            onClick={() => setOpen((o) => !o)}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 font-medium text-white transition hover:bg-primary-hover hover:shadow-glow"
          >
            <Plus className="h-4 w-4" /> {open ? "Fermer" : "Ajouter un bien"}
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-6 rounded-md border border-danger/40 bg-danger/10 p-4 text-caption text-danger">
          {error}
        </div>
      )}

      {open && (
        <form
          onSubmit={create}
          className="mb-6 rounded-lg border border-light-border bg-light-surface p-5 shadow-card dark:border-dark-border dark:bg-dark-surface"
        >
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Désignation (ex. tapis de prière)"
              className={field}
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as AssetCategory)}
              className={field}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {ASSET_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
            <input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              placeholder="Quantité"
              className={field}
            />
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value as AssetCondition)}
              className={field}
            >
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {ASSET_CONDITION_LABELS[c]}
                </option>
              ))}
            </select>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              placeholder="Valeur unitaire (FCFA)"
              className={field}
            />
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Emplacement"
              className={field}
            />
            <input
              type="date"
              value={acquiredAt}
              onChange={(e) => setAcquiredAt(e.target.value)}
              className={field}
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-medium text-white transition hover:bg-primary-hover hover:shadow-glow"
          >
            <Plus className="h-4 w-4" /> Enregistrer
          </button>
        </form>
      )}

      <div className="mb-5 flex flex-wrap gap-2">
        {(["tous", ...CATEGORIES] as const).map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c as AssetCategory | "tous")}
            className={`rounded-full px-3.5 py-2 text-caption transition ${
              filter === c
                ? "bg-primary text-white"
                : "border border-light-border text-light-muted hover:border-primary dark:border-dark-border dark:text-dark-muted"
            }`}
          >
            {c === "tous" ? "Tous" : ASSET_CATEGORY_LABELS[c as AssetCategory]}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-md border border-light-border dark:border-dark-border">
        <table className="w-full min-w-[720px] text-left text-body">
          <thead className="bg-light-surface-alt text-caption text-light-muted dark:bg-dark-surface-alt dark:text-dark-muted">
            <tr>
              <th className="px-4 py-3">Bien</th>
              <th className="px-4 py-3">Catégorie</th>
              <th className="px-4 py-3 text-right">Qté</th>
              <th className="px-4 py-3">Emplacement</th>
              <th className="px-4 py-3 text-right">Valeur</th>
              <th className="px-4 py-3">État</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              // Fragment : l'historique doit apparaître SOUS son bien, pas en fin de tableau.
              <Fragment key={r.id}>
              <tr className="border-t border-light-border dark:border-dark-border">
                <td className="px-4 py-3 font-medium">
                  <button
                    onClick={() => setExpanded((cur) => (cur === r.id ? null : r.id))}
                    className="inline-flex items-center gap-1.5 text-left transition hover:text-primary"
                  >
                    {expanded === r.id ? (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                    )}
                    {r.name}
                  </button>
                </td>
                <td className="px-4 py-3 text-caption">{ASSET_CATEGORY_LABELS[r.category]}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.quantity}</td>
                <td className="px-4 py-3 text-caption">{r.location ?? "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {r.value_fcfa ? formatFCFA(Number(r.value_fcfa) * r.quantity) : "—"}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={r.condition}
                    onChange={(e) => updateCondition(r, e.target.value as AssetCondition)}
                    className={`rounded-full px-3 py-1.5 text-caption font-medium outline-none ${CONDITION_STYLE[r.condition]}`}
                  >
                    {CONDITIONS.map((c) => (
                      <option key={c} value={c}>
                        {ASSET_CONDITION_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
              {expanded === r.id && (
                <tr>
                  <td colSpan={6} className="bg-light-surface-alt p-0 dark:bg-dark-surface-alt">
                    <AssetHistory asset={r} />
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-caption text-light-muted dark:text-dark-muted"
                >
                  Aucun bien enregistré.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
