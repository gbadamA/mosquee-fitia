import { useEffect, useMemo, useState } from "react";
import { Linking } from "react-native";
import type { MosqueRow } from "@fitia/supabase";
import { brandGradient, darken } from "@fitia/shared";
import { brand, gradient as defaultGradient } from "@fitia/design-tokens";
import { supabase } from "./supabase";
import { readCache, writeCache } from "./cache";

/**
 * Paramètres de la mosquée (nom, contacts, couleurs), édités depuis le dashboard.
 * Lecture publique : disponible avant même la connexion, comme les horaires.
 * Mis en cache pour que « Appeler la mosquée » fonctionne hors connexion.
 */

const CACHE_KEY = "mosque";

export function useMosque(): MosqueRow | null {
  const [mosque, setMosque] = useState<MosqueRow | null>(null);

  useEffect(() => {
    readCache<MosqueRow>(CACHE_KEY).then((cached) => {
      if (cached) setMosque((current) => current ?? cached);
    });

    if (!supabase) return;
    supabase
      .from("mosque")
      .select("*")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setMosque(data as MosqueRow);
          writeCache(CACHE_KEY, data);
        }
      });
  }, []);

  return mosque;
}

/**
 * Couleurs de marque effectives — celles de la mosquée si elles sont renseignées,
 * sinon les tokens par défaut. Utilisées pour les surfaces peintes en JS
 * (dégradés `LinearGradient`, teintes d'icônes, indicateurs d'onglet).
 *
 * ⚠️ Portée : les classes NativeWind (`bg-primary`, `text-primary`…) restent sur la
 * palette compilée. Ce sont les grandes surfaces de marque qui suivent la
 * personnalisation, pas encore chaque classe utilitaire.
 */
export function useBrand(mosque: MosqueRow | null) {
  return useMemo(() => {
    const primary = mosque?.primary_color || brand.primary;
    const secondary = mosque?.secondary_color || brand.secondary;
    return {
      primary,
      primaryHover: darken(primary),
      secondary,
      // Tuple explicite : `LinearGradient` exige au moins deux couleurs typées.
      gradient: (mosque
        ? brandGradient(primary, secondary)
        : [...defaultGradient.emerald]) as [string, string, string],
    };
  }, [mosque?.primary_color, mosque?.secondary_color, mosque]);
}

/** Ouvre l'appli téléphone. Sans numéro configuré, ne fait rien plutôt que d'appeler un faux numéro. */
export function callMosque(mosque: MosqueRow | null): void {
  const digits = mosque?.phone?.replace(/\s/g, "");
  if (!digits) return;
  Linking.openURL(`tel:${digits}`);
}

/** Ouvre WhatsApp. `wa.me` exige le numéro SANS « + » ni espaces. */
export function whatsappMosque(mosque: MosqueRow | null): void {
  const digits = (mosque?.whatsapp ?? mosque?.phone ?? "").replace(/\D/g, "");
  if (!digits) return;
  Linking.openURL(`https://wa.me/${digits}`);
}
