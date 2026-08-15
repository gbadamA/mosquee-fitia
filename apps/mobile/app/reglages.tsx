import { View, Text, Pressable, ScrollView, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { X, Bell, Sun, Moon, Smartphone, Info } from "lucide-react-native";
import { brand } from "@fitia/design-tokens";
import { useMosque, useBrand } from "../lib/mosque";
import { useTheme, useThemeColors, type ThemeMode } from "../lib/theme";
import { useSettings, PRAYER_DELAYS } from "../lib/settings";
import { schedulePrayerReminders, cancelPrayerReminders } from "../lib/notifications";
import { readCache, CACHE_KEYS } from "../lib/cache";
import type { PrayerTimes } from "@fitia/shared";

const THEMES: { key: ThemeMode; label: string; icon: typeof Sun }[] = [
  { key: "light", label: "Clair", icon: Sun },
  { key: "dark", label: "Sombre", icon: Moon },
  { key: "system", label: "Système", icon: Smartphone },
];

export default function Reglages() {
  const router = useRouter();
  const mosque = useMosque();
  const brandColors = useBrand(mosque);
  const colors = useThemeColors();
  const { mode, setMode } = useTheme();
  const { settings, update } = useSettings();

  /**
   * Toute modification des rappels de prière doit REPLANIFIER immédiatement :
   * sinon le réglage affiché ne correspondrait pas aux notifications réellement
   * en attente sur le téléphone.
   */
  async function applyPrayerReminders(enabled: boolean, minutes: number) {
    if (!enabled) {
      await cancelPrayerReminders();
      return;
    }
    const times = await readCache<PrayerTimes>(CACHE_KEYS.prayerTimes);
    if (times) await schedulePrayerReminders(times, minutes);
  }

  const card =
    "rounded-md border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface p-4";

  return (
    <View className="flex-1 bg-light-bg dark:bg-dark-bg">
      <LinearGradient colors={brandColors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={["top"]}>
          <View className="flex-row items-center justify-between px-5 pb-6 pt-3">
            <View>
              <Text className="text-white/80">{mosque?.name ?? "Mosquée"}</Text>
              <Text className="font-display text-2xl font-bold text-white">Réglages</Text>
            </View>
            <Pressable onPress={() => router.back()} className="p-2 active:opacity-70">
              <X color="#fff" size={24} />
            </Pressable>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView contentContainerClassName="p-4 gap-5">
        {/* Apparence */}
        <View>
          <Text className="mb-2 font-display text-lg font-semibold text-light-text dark:text-dark-text">
            Apparence
          </Text>
          <View className="flex-row gap-2">
            {THEMES.map(({ key, label, icon: Icon }) => {
              const active = mode === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setMode(key)}
                  className={`flex-1 items-center gap-2 rounded-md border p-4 active:opacity-80 ${
                    active
                      ? "border-primary bg-primary/10"
                      : "border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface"
                  }`}
                >
                  <Icon color={active ? brandColors.primary : colors.textMuted} size={20} />
                  <Text
                    className={
                      active
                        ? "font-semibold text-primary"
                        : "text-light-muted dark:text-dark-muted"
                    }
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Notifications */}
        <View>
          <Text className="mb-2 font-display text-lg font-semibold text-light-text dark:text-dark-text">
            Notifications
          </Text>

          <View className={`${card} mb-2 flex-row items-center gap-3`}>
            <Bell color={brandColors.primary} size={20} />
            <View className="flex-1">
              <Text className="text-base text-light-text dark:text-dark-text">
                Rappel avant chaque prière
              </Text>
              <Text className="text-caption text-light-muted dark:text-dark-muted">
                Fonctionne hors connexion
              </Text>
            </View>
            <Switch
              value={settings.prayerReminders}
              onValueChange={(v) => {
                update({ prayerReminders: v });
                applyPrayerReminders(v, settings.prayerMinutesBefore).catch(() => {});
              }}
              trackColor={{ true: brandColors.primary, false: colors.border }}
            />
          </View>

          {settings.prayerReminders && (
            <View className={`${card} mb-2`}>
              <Text className="mb-2 text-caption text-light-muted dark:text-dark-muted">
                Combien de temps avant ?
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {PRAYER_DELAYS.map((d) => {
                  const active = settings.prayerMinutesBefore === d;
                  return (
                    <Pressable
                      key={d}
                      onPress={() => {
                        update({ prayerMinutesBefore: d });
                        applyPrayerReminders(true, d).catch(() => {});
                      }}
                      className={`rounded-full px-4 py-2 ${
                        active
                          ? "bg-primary"
                          : "border border-light-border dark:border-dark-border"
                      }`}
                    >
                      <Text
                        className={
                          active
                            ? "font-semibold text-white"
                            : "text-light-muted dark:text-dark-muted"
                        }
                      >
                        {d === 0 ? "À l'heure" : `${d} min`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          <View className={`${card} mb-2 flex-row items-center gap-3`}>
            <Bell color={brandColors.primary} size={20} />
            <View className="flex-1">
              <Text className="text-base text-light-text dark:text-dark-text">
                Rappel d&apos;événement
              </Text>
              <Text className="text-caption text-light-muted dark:text-dark-muted">
                La veille et 1 h avant
              </Text>
            </View>
            <Switch
              value={settings.eventReminders}
              onValueChange={(v) => update({ eventReminders: v })}
              trackColor={{ true: brandColors.primary, false: colors.border }}
            />
          </View>

          <View className={`${card} flex-row items-center gap-3`}>
            <Bell color={brand.tertiary} size={20} />
            <View className="flex-1">
              <Text className="text-base text-light-text dark:text-dark-text">
                Annonces de la mosquée
              </Text>
              <Text className="text-caption text-light-muted dark:text-dark-muted">
                Notification à chaque nouvelle annonce
              </Text>
            </View>
            <Switch
              value={settings.announcements}
              onValueChange={(v) => update({ announcements: v })}
              trackColor={{ true: brandColors.primary, false: colors.border }}
            />
          </View>
        </View>

        {/* Avertissement honnête sur les push distantes */}
        <View className="flex-row gap-3 rounded-md border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface p-4">
          <Info color={brand.tertiary} size={18} />
          <Text className="flex-1 text-caption text-light-muted dark:text-dark-muted">
            Les rappels de prière et d&apos;événement sont calculés sur votre téléphone : ils
            fonctionnent sans réseau. Les notifications d&apos;annonces, elles, arrivent depuis la
            mosquée et ne fonctionnent que sur la version installée de l&apos;application.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
