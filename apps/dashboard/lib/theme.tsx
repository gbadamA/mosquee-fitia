"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { hexToRgbChannels, darken, brandGradient } from "@fitia/shared";
import { getSupabase, isSupabaseConfigured } from "./supabase";

/**
 * Deux thèmes distincts, volontairement séparés :
 *
 * 1. **Marque** — les couleurs choisies par la mosquée (table `mosque`). Elles sont
 *    poussées dans des variables CSS lues par Tailwind (`rgb(var(--c-primary) / …)`),
 *    donc elles s'appliquent réellement, opacités comprises.
 * 2. **Clair / sombre** — préférence de l'utilisateur, stockée localement.
 *    Sans ce sélecteur, les tokens `light-*` resteraient du code mort.
 */

export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "fitia:theme";

/** Script injecté avant le rendu : évite le flash de thème au chargement. */
export const themeBootstrapScript = `
(function () {
  try {
    var stored = localStorage.getItem('${STORAGE_KEY}') || 'system';
    var dark = stored === 'dark' ||
      (stored === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {}
})();
`;

type ThemeState = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeState>({ mode: "system", setMode: () => {} });

function applyMode(mode: ThemeMode) {
  const dark =
    mode === "dark" ||
    (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("system");

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Stockage indisponible (navigation privée) : le choix ne survit pas, sans plus.
    }
    applyMode(next);
  }, []);

  useEffect(() => {
    let stored: ThemeMode = "system";
    try {
      stored = (localStorage.getItem(STORAGE_KEY) as ThemeMode) ?? "system";
    } catch {
      /* ignore */
    }
    setModeState(stored);
    applyMode(stored);

    // Suivre le réglage système tant que l'utilisateur n'a pas tranché.
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (stored === "system") applyMode("system");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  // Couleurs de la mosquée → variables CSS.
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    getSupabase()
      .from("mosque")
      .select("primary_color, secondary_color")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const primary = data.primary_color;
        const secondary = data.secondary_color;
        const root = document.documentElement.style;

        root.setProperty("--c-primary", hexToRgbChannels(primary, "#0B7A3B"));
        root.setProperty("--c-primary-hover", hexToRgbChannels(darken(primary), "#086130"));
        root.setProperty("--c-secondary", hexToRgbChannels(secondary, "#C9A227"));
        root.setProperty("--c-secondary-hover", hexToRgbChannels(darken(secondary), "#A9871C"));

        const [start, mid, end] = brandGradient(primary, secondary);
        root.setProperty("--g-start", start);
        root.setProperty("--g-mid", mid);
        root.setProperty("--g-end", end);
      });
  }, []);

  return <ThemeContext.Provider value={{ mode, setMode }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
