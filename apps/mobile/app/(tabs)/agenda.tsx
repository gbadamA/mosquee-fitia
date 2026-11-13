import { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, RefreshControl, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import { BellRing, Bell, MapPin } from "lucide-react-native";
import { EVENT_TYPE_META, formatEventDate, type MosqueEvent } from "@fitia/shared";
import { brand } from "@fitia/design-tokens";
import { supabase } from "../../lib/supabase";
import { useMosque, useBrand } from "../../lib/mosque";
import { scheduleEventReminders, cancelEventReminders } from "../../lib/notifications";
import { readCache, writeCache } from "../../lib/cache";
import { useSettings } from "../../lib/settings";
import { useThemeColors } from "../../lib/theme";

/** Événements pour lesquels CE téléphone a demandé un rappel. */
const CLE_RAPPELS = "fitia.rappels-evenements";

export default function Agenda() {
  const colors = useThemeColors();
  const { settings } = useSettings();
  const mosque = useMosque();
  const brandColors = useBrand(mosque);
  const [events, setEvents] = useState<MosqueEvent[]>([]);
  const [registered, setRegistered] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    const [{ data: evs }, rappels] = await Promise.all([
      supabase
        .from("events")
        .select("*")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true }),
      readCache<string[]>(CLE_RAPPELS),
    ]);
    if (evs) setEvents(evs as MosqueEvent[]);
    setRegistered(new Set(rappels ?? []));
  }, []);

  useEffect(() => {
    load();
    if (!supabase) return;
    const sb = supabase;
    const channel = sb
      .channel("mobile:events")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => load())
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [load]);

  /**
   * « Me rappeler » : l'application s'ouvre sans compte depuis le 2026-11-14,
   * l'inscription en base (liée à un compte) disparaît. Le choix est gardé SUR
   * LE TÉLÉPHONE, avec les mêmes rappels locaux (la veille et 1 h avant).
   */
  async function toggle(eventId: string) {
    setBusyId(eventId);
    const suivants = new Set(registered);
    if (suivants.has(eventId)) {
      suivants.delete(eventId);
      cancelEventReminders(eventId).catch(() => {});
    } else {
      suivants.add(eventId);
      const event = events.find((e) => e.id === eventId);
      // Respecte la préférence de l'utilisateur (écran Réglages) ; échoue en
      // silence si les notifications sont refusées.
      if (event && settings.eventReminders) scheduleEventReminders(event).catch(() => {});
    }
    setRegistered(suivants);
    await writeCache(CLE_RAPPELS, [...suivants]);
    setBusyId(null);
  }

  return (
    <View className="flex-1 bg-light-bg dark:bg-dark-bg">
      <LinearGradient
        colors={brandColors.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="rounded-b-lg"
      >
        <SafeAreaView edges={["top"]}>
          <View className="px-5 pb-6 pt-3">
            <Text className="text-white/80">Vie de la mosquée</Text>
            <Text className="font-display text-2xl font-bold text-white">Agenda</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <FlatList
        data={events}
        keyExtractor={(e) => e.id}
        contentContainerClassName="p-4 gap-3"
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
        ListEmptyComponent={
          <Text className="mt-10 text-center text-light-muted dark:text-dark-muted">Aucun événement à venir.</Text>
        }
        renderItem={({ item, index }) => {
          const meta = EVENT_TYPE_META[item.type];
          const isIn = registered.has(item.id);
          return (
            <Animated.View
              entering={FadeInDown.delay(index * 40).springify()}
              className="rounded-md border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface p-4"
            >
              <View className="mb-1.5 flex-row items-center">
                <View
                  className="rounded-full px-2 py-0.5"
                  style={{ backgroundColor: meta.color }}
                >
                  <Text className="text-[11px] font-medium text-white">
                    {meta.emoji} {meta.label}
                  </Text>
                </View>
              </View>

              <Text className="font-display text-lg font-semibold text-light-text dark:text-dark-text">
                {item.title}
              </Text>
              <Text className="text-light-muted dark:text-dark-muted">{formatEventDate(item.starts_at)}</Text>

              {item.location && (
                <View className="mt-1 flex-row items-center gap-1.5">
                  <MapPin color={colors.textMuted} size={13} />
                  <Text className="text-caption text-light-muted dark:text-dark-muted">{item.location}</Text>
                </View>
              )}

              {item.description && (
                <Text className="mt-2 text-light-muted dark:text-dark-muted">{item.description}</Text>
              )}

              <Pressable
                onPress={() => toggle(item.id)}
                disabled={busyId === item.id}
                className={`mt-3 flex-row items-center justify-center gap-2 rounded-full px-5 py-2.5 active:opacity-80 ${
                  isIn ? "border border-primary bg-primary/10" : "bg-primary"
                }`}
              >
                {busyId === item.id ? (
                  <ActivityIndicator color={isIn ? brand.primary : "#fff"} size="small" />
                ) : (
                  <>
                    {isIn ? (
                      <BellRing color={brand.primary} size={16} />
                    ) : (
                      <Bell color="#fff" size={16} />
                    )}
                    <Text
                      className={`font-semibold ${isIn ? "text-primary" : "text-white"}`}
                    >
                      {isIn ? "Rappel activé" : "Me rappeler"}
                    </Text>
                  </>
                )}
              </Pressable>
            </Animated.View>
          );
        }}
      />
    </View>
  );
}
