import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Cache local minimal — l'app doit rester utile hors connexion.
 * Les horaires de prière du jour et les dernières annonces sont écrits ici
 * à chaque réception ; ils sont relus immédiatement au démarrage, AVANT le
 * moindre appel réseau, pour que l'écran d'accueil ne soit jamais vide.
 */

const PREFIX = "fitia:";

export async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function writeCache(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Cache indisponible : ce n'est jamais bloquant.
  }
}

export const CACHE_KEYS = {
  prayerTimes: "prayer-times",
  announcements: "announcements",
} as const;
