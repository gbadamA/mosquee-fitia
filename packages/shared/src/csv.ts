/**
 * Génération et téléchargement de CSV — un seul chemin pour tous les exports.
 *
 * Trois pièges sont traités ici une fois pour toutes :
 *
 * 1. **BOM UTF-8** en tête, sinon Excel FR affiche « MosquÃ©e » au lieu de « Mosquée ».
 * 2. **Séparateur `;`** : avec `,` Excel FR met toute la ligne dans une seule colonne.
 * 3. **L'ancre doit être DANS le document** avant `click()`. Un `<a>` détaché ne
 *    déclenche pas le téléchargement sur plusieurs navigateurs — le bouton semble
 *    alors ne rien faire. Et l'URL objet ne doit être révoquée qu'après coup,
 *    sinon le téléchargement est annulé avant d'avoir démarré.
 */

/** Échappe une valeur pour le format CSV (guillemets doublés). */
function escapeCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

/** Assemble un CSV à partir d'un en-tête et de lignes. */
export function buildCSV(header: string[], rows: unknown[][]): string {
  const lines = [header.map(escapeCell).join(";")];
  for (const row of rows) lines.push(row.map(escapeCell).join(";"));
  return `﻿${lines.join("\r\n")}`;
}

/**
 * Déclenche le téléchargement d'un CSV dans le navigateur.
 * @returns `false` si l'environnement ne permet pas le téléchargement (SSR).
 */
export function downloadCSV(filename: string, header: string[], rows: unknown[][]): boolean {
  if (typeof document === "undefined") return false;

  const blob = new Blob([buildCSV(header, rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  // ⚠️ L'ancre DOIT être dans le document : un élément détaché ne télécharge pas.
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Révocation différée : révoquer tout de suite annule le téléchargement.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

/** `fideles-2026-08-05.csv` — nom de fichier daté. */
export function csvFilename(prefix: string): string {
  return `${prefix}-${new Date().toISOString().slice(0, 10)}.csv`;
}
