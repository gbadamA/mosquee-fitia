import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { PRAYER_KEYS, PRAYER_META, toDate, type PrayerTimes } from "@fitia/shared";

/**
 * Rappels avant chaque prière — **notifications LOCALES planifiées**, pas de push serveur.
 *
 * Pourquoi local : le rappel de prière est déterministe (on connaît déjà l'heure), il doit
 * fonctionner hors connexion, et surtout les push distantes ne marchent plus dans Expo Go
 * depuis Android SDK 53+ (il faut un build EAS). Le local, lui, fonctionne dans Expo Go.
 * Les push distantes restent réservées aux annonces de l'imam (Edge Function `send-push`).
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // `shouldShowAlert` est déprécié depuis expo-notifications 0.31 au profit de
    // `shouldShowBanner`/`shouldShowList` ; on fournit les trois pour rester
    // compatible quelle que soit la version alignée par `expo install --fix`.
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Demande l'autorisation de notifier et prépare le canal Android.
 *
 * ⚠️ Pas de garde `Device.isDevice` ici : les notifications LOCALES fonctionnent
 * très bien sur un émulateur Android, et bloquer dessus rendait les rappels de
 * prière intestables hors téléphone physique. Cette garde n'a de sens que pour
 * obtenir un **jeton de push distante** — elle vit donc dans `lib/push.ts`.
 */
export async function requestPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (status !== "granted") {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("prieres", {
      name: "Rappels de prière",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#0B7A3B",
    });
  }
  return status === "granted";
}

/**
 * Replanifie tous les rappels du jour.
 * On annule tout avant de replanifier : c'est la seule façon simple de rester
 * cohérent quand l'imam corrige un horaire en cours de journée.
 *
 * @param minutesBefore délai d'avance du rappel (0 = à l'heure exacte).
 */
export async function schedulePrayerReminders(
  times: PrayerTimes,
  minutesBefore = 10,
): Promise<number> {
  const granted = await requestPermission();
  if (!granted) return 0;

  // ⚠️ Annulation CIBLÉE : `cancelAllScheduledNotificationsAsync()` effacerait
  // aussi les rappels d'événement planifiés par `scheduleEventReminders`.
  await cancelPrayerReminders();

  const now = Date.now();
  let scheduled = 0;

  for (const key of PRAYER_KEYS) {
    const at = toDate(times.date, times[key]);
    const trigger = new Date(at.getTime() - minutesBefore * 60_000);
    if (trigger.getTime() <= now) continue;

    await Notifications.scheduleNotificationAsync({
      // Identifiant stable : permet de replanifier sans toucher aux autres rappels.
      identifier: `prayer:${key}`,
      content: {
        title: `${PRAYER_META[key].label} dans ${minutesBefore} min`,
        body: `Heure de la prière : ${times[key]}`,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: trigger,
        channelId: "prieres",
      },
    });
    scheduled += 1;
  }

  return scheduled;
}

/** Annule uniquement les rappels de prière, pas les rappels d'événement. */
export async function cancelPrayerReminders(): Promise<void> {
  for (const key of PRAYER_KEYS) {
    try {
      await Notifications.cancelScheduledNotificationAsync(`prayer:${key}`);
    } catch {
      // Rien de planifié pour cette prière : cas normal.
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Rappels d'événement                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Planifie deux rappels pour un événement auquel le fidèle vient de s'inscrire :
 * la veille (24 h avant) et juste avant (1 h avant).
 *
 * Locaux eux aussi : la date est connue au moment de l'inscription, donc rien
 * n'exige le réseau — et ça marche dans Expo Go, contrairement aux push distantes.
 *
 * ⚠️ On n'annule PAS les autres notifications ici : `cancelAllScheduled…` effacerait
 * les rappels de prière. Le désabonnement passe par `cancelEventReminders`.
 */
export async function scheduleEventReminders(event: {
  id: string;
  title: string;
  starts_at: string;
  location?: string | null;
}): Promise<number> {
  const granted = await requestPermission();
  if (!granted) return 0;

  const start = new Date(event.starts_at);
  if (Number.isNaN(start.getTime())) return 0;

  const now = Date.now();
  const offsets: { minutes: number; label: string }[] = [
    { minutes: 24 * 60, label: "demain" },
    { minutes: 60, label: "dans 1 heure" },
  ];

  let scheduled = 0;
  for (const { minutes, label } of offsets) {
    const at = new Date(start.getTime() - minutes * 60_000);
    if (at.getTime() <= now) continue;

    await Notifications.scheduleNotificationAsync({
      // L'identifiant encode l'événement : il permet d'annuler ciblé.
      identifier: `event:${event.id}:${minutes}`,
      content: {
        title: event.title,
        body: `C'est ${label}${event.location ? ` · ${event.location}` : ""}.`,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: at,
        channelId: "prieres",
      },
    });
    scheduled += 1;
  }
  return scheduled;
}

/* -------------------------------------------------------------------------- */
/* Rappel de cotisation                                                       */
/* -------------------------------------------------------------------------- */

const CONTRIBUTION_REMINDER_ID = "contribution:mensuel";

/**
 * Programme le rappel de cotisation au **1er du mois prochain**.
 *
 * Pourquoi une date fixe recalculée à chaque ouverture plutôt qu'un déclencheur
 * récurrent : les types de déclencheurs mensuels varient selon les versions
 * d'expo-notifications, alors qu'une date absolue se comporte pareil partout.
 * L'app réarme le rappel à chaque lancement — c'est robuste et sans surprise.
 *
 * @param monthsLate nombre de mois déjà en retard, pour formuler le message.
 */
export async function scheduleContributionReminder(monthsLate: number): Promise<boolean> {
  await cancelContributionReminder();

  const granted = await requestPermission();
  if (!granted) return false;

  const now = new Date();
  // 1er du mois suivant, à 9 h — une heure raisonnable pour une relance.
  const at = new Date(now.getFullYear(), now.getMonth() + 1, 1, 9, 0, 0, 0);

  const body =
    monthsLate > 0
      ? `Un nouveau mois commence. Vous avez ${monthsLate} mois de cotisation en retard.`
      : "Un nouveau mois commence : pensez à votre cotisation.";

  await Notifications.scheduleNotificationAsync({
    identifier: CONTRIBUTION_REMINDER_ID,
    content: { title: "Cotisation de la mosquée", body, sound: true },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: at,
      channelId: "prieres",
    },
  });
  return true;
}

export async function cancelContributionReminder(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(CONTRIBUTION_REMINDER_ID);
  } catch {
    // Rien de planifié : cas normal.
  }
}

/** Annule les rappels d'un événement (désinscription). */
export async function cancelEventReminders(eventId: string): Promise<void> {
  for (const minutes of [24 * 60, 60]) {
    try {
      await Notifications.cancelScheduledNotificationAsync(`event:${eventId}:${minutes}`);
    } catch {
      // Aucun rappel planifié pour cet identifiant : rien à faire.
    }
  }
}
