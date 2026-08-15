import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { supabase } from "./supabase";
import { requestPermission } from "./notifications";

/**
 * Enregistre le jeton de push Expo du téléphone dans `profiles.push_token`,
 * pour que l'Edge Function `send-push` puisse notifier les annonces de l'imam.
 *
 * ⚠️ Échoue proprement dans Expo Go sur Android (SDK 53+ : plus de push distantes
 * sans build EAS). Les rappels de prière ne dépendent pas de cette fonction —
 * ils sont planifiés en local (`lib/notifications.ts`).
 */
export async function registerPushToken(userId: string): Promise<string | null> {
  // C'est ICI que `Device.isDevice` a un sens : un émulateur ne peut pas obtenir
  // de jeton de push distante. Les notifications locales, elles, ne passent pas
  // par cette fonction et restent disponibles partout.
  if (!supabase || !Device.isDevice) return null;

  const granted = await requestPermission();
  if (!granted) return null;

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId ??
      undefined;

    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );

    await supabase.from("profiles").update({ push_token: token }).eq("id", userId);
    return token;
  } catch {
    // Expo Go / émulateur / permission refusée : on n'empêche jamais le login.
    return null;
  }
}
