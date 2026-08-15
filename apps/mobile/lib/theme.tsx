import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useColorScheme } from "nativewind";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { palette } from "@fitia/design-tokens";

/**
 * Thème clair / sombre du mobile.
 *
 * NativeWind pilote les variantes `dark:` via `setColorScheme` (le preset est en
 * `darkMode: "class"`). Mais les propriétés natives qui prennent une couleur en JS
 * — `placeholderTextColor`, teintes d'icônes, fond de la barre d'onglets,
 * `contentStyle` du Stack — ne passent pas par les classes : d'où `useThemeColors()`.
 */

export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "fitia:theme";

type ThemeState = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  /** Thème effectivement appliqué (résout « système »). */
  resolved: "light" | "dark";
};

const ThemeContext = createContext<ThemeState>({
  mode: "system",
  setMode: () => {},
  resolved: "dark",
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { colorScheme, setColorScheme } = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        const next = (stored as ThemeMode | null) ?? "system";
        setModeState(next);
        setColorScheme(next);
      })
      .catch(() => {
        // Stockage indisponible : on reste sur « système ».
      });
  }, [setColorScheme]);

  const setMode = useCallback(
    (next: ThemeMode) => {
      setModeState(next);
      setColorScheme(next);
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
    },
    [setColorScheme],
  );

  const resolved = colorScheme === "light" ? "light" : "dark";

  return (
    <ThemeContext.Provider value={{ mode, setMode, resolved }}>{children}</ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

/** Palette de neutres correspondant au thème actif — pour les props natives. */
export function useThemeColors() {
  const { resolved } = useTheme();
  return palette[resolved];
}
