import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Préférences de notification du fidèle (§3.7 du cahier : « choisir quelles alertes recevoir »).
 *
 * Stockées sur le téléphone, pas en base : ce sont des réglages d'appareil, et
 * les rappels sont planifiés localement de toute façon. Un fidèle qui change de
 * téléphone repart des valeurs par défaut, ce qui est le comportement attendu.
 */

export type Settings = {
  /** Rappel avant chaque prière. */
  prayerReminders: boolean;
  /** Délai d'avance du rappel de prière, en minutes. */
  prayerMinutesBefore: number;
  /** Rappels la veille et 1 h avant un événement auquel on est inscrit. */
  eventReminders: boolean;
  /** Notifications d'annonces de l'imam (nécessite un build EAS). */
  announcements: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  prayerReminders: false,
  prayerMinutesBefore: 10,
  eventReminders: true,
  announcements: true,
};

export const PRAYER_DELAYS = [0, 5, 10, 15, 30] as const;

const STORAGE_KEY = "fitia:settings";

type SettingsState = {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  ready: boolean;
};

const SettingsContext = createContext<SettingsState>({
  settings: DEFAULT_SETTINGS,
  update: () => {},
  ready: false,
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          // Fusion avec les valeurs par défaut : un réglage ajouté plus tard
          // ne doit pas rester `undefined` sur un téléphone déjà installé.
          setSettings({ ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) });
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  function update(patch: Partial<Settings>) {
    setSettings((current) => {
      const next = { ...current, ...patch };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }

  return (
    <SettingsContext.Provider value={{ settings, update, ready }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
