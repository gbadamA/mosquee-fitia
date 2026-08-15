import { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import { CATEGORY_META, type Announcement } from "@fitia/shared";
import { brand } from "@fitia/design-tokens";
import { supabase } from "../../lib/supabase";
import { useMosque, useBrand } from "../../lib/mosque";
import { readCache, writeCache, CACHE_KEYS } from "../../lib/cache";

export default function Annonces() {
  const mosque = useMosque();
  const brandColors = useBrand(mosque);
  const [items, setItems] = useState<Announcement[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from("announcements")
      .select("*")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) {
      setItems(data as Announcement[]);
      writeCache(CACHE_KEYS.announcements, data);
    }
  }, []);

  useEffect(() => {
    readCache<Announcement[]>(CACHE_KEYS.announcements).then((cached) => {
      if (cached?.length) setItems((current) => (current.length ? current : cached));
    });
    load();

    if (!supabase) return;
    const sb = supabase;
    // 🔴 Réception TEMPS RÉEL des annonces diffusées depuis le dashboard.
    const channel = sb
      .channel("mobile:announcements")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "announcements" },
        (payload) => setItems((prev) => [payload.new as Announcement, ...prev]),
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [load]);

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
            <Text className="text-white/80">{mosque?.name ?? "Mosquée"}</Text>
            <Text className="font-display text-2xl font-bold text-white">Annonces</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <FlatList
        data={items}
        keyExtractor={(a) => a.id}
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
          <Text className="mt-10 text-center text-light-muted dark:text-dark-muted">
            Aucune annonce pour le moment.
          </Text>
        }
        renderItem={({ item, index }) => {
          const meta = CATEGORY_META[item.category];
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
                {item.pinned && <Text className="ml-2 text-secondary">📌</Text>}
              </View>
              <Text className="font-display text-lg font-semibold text-light-text dark:text-dark-text">
                {item.title}
              </Text>
              <Text className="mt-0.5 text-light-muted dark:text-dark-muted">{item.body}</Text>
              <Text className="mt-2 text-caption text-light-muted dark:text-dark-muted">
                {new Intl.DateTimeFormat("fr-FR", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(item.created_at))}
              </Text>
            </Animated.View>
          );
        }}
      />
    </View>
  );
}
