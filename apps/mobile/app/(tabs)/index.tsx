import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, RefreshControl, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { HandCoins, Phone, BellRing, BellOff, WifiOff } from "lucide-react-native";
import {
  PRAYER_KEYS,
  PRAYER_META,
  nextPrayer,
  formatCountdown,
  todayISO,
  hijriDate,
  type PrayerTimes,
} from "@fitia/shared";
import { brand } from "@fitia/design-tokens";
import { supabase, isConfigured } from "../../lib/supabase";
import { readCache, writeCache, CACHE_KEYS } from "../../lib/cache";
import { schedulePrayerReminders, cancelPrayerReminders } from "../../lib/notifications";
import { useMosque, useBrand, callMosque } from "../../lib/mosque";
import { useAuth } from "../../lib/auth";
import { useSettings } from "../../lib/settings";
import { useThemeColors } from "../../lib/theme";

export default function Prieres() {
  const colors = useThemeColors();
  const { profile } = useAuth();
  const mosque = useMosque();
  const brandColors = useBrand(mosque);
  const router = useRouter();
  const [times, setTimes] = useState<PrayerTimes | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(Date.now());
  const { settings, update } = useSettings();

  // Compte à rebours vivant.
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from("prayer_times")
      .select("*")
      .eq("date", todayISO())
      .maybeSingle();
    if (data) {
      setTimes(data as PrayerTimes);
      setFromCache(false);
      writeCache(CACHE_KEYS.prayerTimes, data);
    }
  }, []);

  useEffect(() => {
    // 1. Cache d'abord : l'écran n'est jamais vide, même sans réseau.
    readCache<PrayerTimes>(CACHE_KEYS.prayerTimes).then((cached) => {
      if (cached) {
        setTimes((current) => current ?? cached);
        setFromCache(true);
      }
    });
    // 2. Puis le réseau.
    load();

    if (!supabase) return;
    // 3. Puis le temps réel : l'imam corrige un horaire → l'écran suit sans rafraîchir.
    const sb = supabase;
    const channel = sb
      .channel("mobile:prayer_times")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "prayer_times" },
        (payload) => {
          const row = payload.new as PrayerTimes;
          if (row?.date === todayISO()) {
            setTimes(row);
            setFromCache(false);
            writeCache(CACHE_KEYS.prayerTimes, row);
          }
        },
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [load]);

  /** Bascule rapide depuis l'accueil — le réglage fin vit dans l'écran Réglages. */
  async function toggleReminders() {
    if (!times) return;
    if (settings.prayerReminders) {
      await cancelPrayerReminders();
      update({ prayerReminders: false });
      return;
    }
    const count = await schedulePrayerReminders(times, settings.prayerMinutesBefore);
    update({ prayerReminders: count > 0 });
  }

  const next = times ? nextPrayer(times, new Date(tick)) : null;
  const hijri = hijriDate(new Date(tick));

  return (
    <View className="flex-1 bg-light-bg dark:bg-dark-bg">
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={brand.primary}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        {/* En-tête : prochaine prière */}
        <LinearGradient
          colors={brandColors.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="rounded-b-lg"
        >
          <SafeAreaView edges={["top"]}>
            <View className="px-5 pb-7 pt-3">
              <Text className="text-white/80">
                As-salâmu ʿalaykum{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
              </Text>
              <Text className="mb-4 text-caption text-white/70">
                {new Intl.DateTimeFormat("fr-FR", { dateStyle: "full" }).format(new Date(tick))}
                {hijri ? ` · ${hijri}` : ""}
              </Text>

              {next && times ? (
                <>
                  <Text className="text-white/80">
                    Prochaine prière{next.tomorrow ? " (demain)" : ""}
                  </Text>
                  <View className="flex-row items-end justify-between">
                    <View>
                      <Text className="font-display text-3xl font-bold text-white">
                        {PRAYER_META[next.key].label}
                      </Text>
                      <Text className="text-lg text-white/90">
                        {PRAYER_META[next.key].arabic}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className="font-display text-3xl font-bold text-white">
                        {times[next.key]}
                      </Text>
                      <Text className="text-white/90">
                        dans {formatCountdown(next.msUntil)}
                      </Text>
                    </View>
                  </View>
                </>
              ) : (
                <Text className="text-white">
                  Aucun horaire publié pour aujourd&apos;hui.
                </Text>
              )}
            </View>
          </SafeAreaView>
        </LinearGradient>

        <View className="p-4">
          {!isConfigured && (
            <View className="mb-4 rounded-md border border-warning/40 bg-warning/10 p-4">
              <Text className="text-warning">Backend non configuré — renseignez .env</Text>
            </View>
          )}

          {fromCache && (
            <View className="mb-4 flex-row items-center gap-2 rounded-md border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface p-3">
              <WifiOff color={colors.textMuted} size={16} />
              <Text className="flex-1 text-caption text-light-muted dark:text-dark-muted">
                Horaires en mémoire — dernière synchronisation hors ligne.
              </Text>
            </View>
          )}

          {/* Grille des 5 prières */}
          {times && (
            <View className="mb-4 gap-2">
              {PRAYER_KEYS.map((k, i) => {
                const active = next?.key === k && !next.tomorrow;
                return (
                  <Animated.View
                    key={k}
                    entering={FadeInDown.delay(i * 50).springify()}
                    className={`flex-row items-center rounded-md border p-4 ${
                      active
                        ? "border-primary bg-primary/10"
                        : "border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface"
                    }`}
                  >
                    <View
                      className="mr-3 h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: PRAYER_META[k].color }}
                    />
                    <Text
                      className={`flex-1 text-base ${
                        active ? "font-semibold text-primary" : "text-light-text dark:text-dark-text"
                      }`}
                    >
                      {PRAYER_META[k].label}
                    </Text>
                    <Text className="mr-3 text-light-muted dark:text-dark-muted">{PRAYER_META[k].arabic}</Text>
                    <Text
                      className={`text-base tabular-nums ${
                        active ? "font-bold text-primary" : "text-light-text dark:text-dark-text"
                      }`}
                    >
                      {times[k]}
                    </Text>
                  </Animated.View>
                );
              })}

              {times.jumua && (
                <View className="flex-row items-center rounded-md border border-secondary/50 bg-secondary/10 p-4">
                  <Text className="flex-1 text-base font-semibold text-secondary">
                    Djouma (vendredi)
                  </Text>
                  <Text className="text-base font-bold tabular-nums text-secondary">
                    {times.jumua}
                  </Text>
                </View>
              )}

              {times.note && (
                <Text className="mt-1 px-1 text-caption text-light-muted dark:text-dark-muted">{times.note}</Text>
              )}
            </View>
          )}

          {/* Rappels */}
          <Pressable
            onPress={toggleReminders}
            disabled={!times}
            className="mb-4 flex-row items-center gap-3 rounded-md border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface p-4 active:opacity-80"
          >
            {settings.prayerReminders ? (
              <BellRing color={brand.primary} size={20} />
            ) : (
              <BellOff color={colors.textMuted} size={20} />
            )}
            <View className="flex-1">
              <Text className="text-base text-light-text dark:text-dark-text">
                Rappel avant chaque prière
              </Text>
              <Text className="text-caption text-light-muted dark:text-dark-muted">
                {settings.prayerReminders
                  ? `Activé · ${settings.prayerMinutesBefore} min avant`
                  : "Désactivé"}
              </Text>
            </View>
          </Pressable>

          {/* Accès rapides */}
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => router.push("/don")}
              className="flex-1 overflow-hidden rounded-md active:opacity-80"
            >
              <LinearGradient
                colors={brandColors.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View className="items-center gap-2 p-5">
                  <HandCoins color="#fff" size={24} />
                  <Text className="font-semibold text-white">Faire un don</Text>
                </View>
              </LinearGradient>
            </Pressable>

            <Pressable
              onPress={() => callMosque(mosque)}
              disabled={!mosque?.phone}
              className="flex-1 items-center gap-2 rounded-md border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface p-5 active:opacity-80"
              style={{ opacity: mosque?.phone ? 1 : 0.5 }}
            >
              <Phone color={brand.primary} size={24} />
              <Text className="font-semibold text-light-text dark:text-dark-text">Contacter</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
