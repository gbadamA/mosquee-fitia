import { useCallback, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ClipboardList, Megaphone, CalendarPlus, Clock, ShieldCheck, LogOut, ChevronRight, KeyRound } from "lucide-react-native";
import {
  ROLE_LABELS,
  ROLES_BUREAU,
  ROLES_CAN_BROADCAST,
  ROLES_CAN_MANAGE_EVENTS,
  ROLES_CAN_SET_PRAYER_TIMES,
} from "@fitia/shared";
import { brand } from "@fitia/design-tokens";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { useThemeColors } from "../../lib/theme";

/**
 * Accueil de l'espace staff : chaque membre ne voit que ce que son rôle permet.
 * Le staff de terrain y trouve d'abord ses consignes (compteur des consignes
 * pas encore faites), puis annonces, événements et horaires.
 */
export default function StaffAccueil() {
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { profile, signOut } = useAuth();
  const [aFaire, setAFaire] = useState<number | null>(null);

  const compter = useCallback(async () => {
    if (!supabase || !profile) return;
    const [{ data: consignes }, { data: suivis }] = await Promise.all([
      supabase.from("consignes").select("id, assignee_id").eq("archived", false),
      supabase.from("consigne_suivis").select("consigne_id, status").eq("member_id", profile.id),
    ]);
    const faites = new Set((suivis ?? []).filter((s) => s.status === "faite").map((s) => s.consigne_id));
    // Le bureau voit TOUTES les consignes : on ne compte que celles qui le visent.
    const miennes = (consignes ?? []).filter((c) => c.assignee_id === null || c.assignee_id === profile.id);
    setAFaire(miennes.filter((c) => !faites.has(c.id)).length);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      void compter();
    }, [compter]),
  );

  if (!profile) return null;
  const peut = (roles: string[]) => roles.includes(profile.role);
  const tuile =
    "flex-row items-center gap-3 rounded-md border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface p-4 active:opacity-80";

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 + insets.bottom }}>
      <View className="mb-2 rounded-md bg-primary/10 p-4">
        <Text className="font-display text-lg font-semibold text-light-text dark:text-dark-text">{profile.full_name ?? "Membre"}</Text>
        <Text className="text-light-muted dark:text-dark-muted">{ROLE_LABELS[profile.role]}</Text>
      </View>

      <Pressable onPress={() => router.push("/staff/consignes")} className={tuile}>
        <ClipboardList color={brand.primary} size={22} />
        <View className="flex-1">
          <Text className="text-base font-semibold text-light-text dark:text-dark-text">Mes consignes</Text>
          <Text className="text-caption text-light-muted dark:text-dark-muted">Instructions du bureau à appliquer</Text>
        </View>
        {aFaire ? (
          <View className="min-w-[26px] items-center rounded-full bg-danger px-2 py-0.5">
            <Text className="text-caption font-bold text-white">{aFaire}</Text>
          </View>
        ) : null}
        <ChevronRight color={colors.textMuted} size={18} />
      </Pressable>

      {peut(ROLES_CAN_BROADCAST) && (
        <Pressable onPress={() => router.push("/staff/annonce")} className={tuile}>
          <Megaphone color={brand.primary} size={22} />
          <Text className="flex-1 text-base text-light-text dark:text-dark-text">Publier une annonce</Text>
          <ChevronRight color={colors.textMuted} size={18} />
        </Pressable>
      )}
      {peut(ROLES_CAN_MANAGE_EVENTS) && (
        <Pressable onPress={() => router.push("/staff/evenement")} className={tuile}>
          <CalendarPlus color={brand.primary} size={22} />
          <Text className="flex-1 text-base text-light-text dark:text-dark-text">Créer un événement</Text>
          <ChevronRight color={colors.textMuted} size={18} />
        </Pressable>
      )}
      {peut(ROLES_CAN_SET_PRAYER_TIMES) && (
        <Pressable onPress={() => router.push("/staff/horaires")} className={tuile}>
          <Clock color={brand.primary} size={22} />
          <Text className="flex-1 text-base text-light-text dark:text-dark-text">Horaires de prière</Text>
          <ChevronRight color={colors.textMuted} size={18} />
        </Pressable>
      )}
      {/* Le bureau garde son espace d'administration (finances, validation…). */}
      {peut(ROLES_BUREAU) && (
        <Pressable onPress={() => router.push("/administration")} className={tuile}>
          <ShieldCheck color={brand.primary} size={22} />
          <Text className="flex-1 text-base text-light-text dark:text-dark-text">Administration (bureau)</Text>
          <ChevronRight color={colors.textMuted} size={18} />
        </Pressable>
      )}

      <Pressable onPress={() => router.push("/reglages")} className={tuile}>
        <KeyRound color={brand.tertiary} size={22} />
        <Text className="flex-1 text-base text-light-text dark:text-dark-text">Changer mon mot de passe</Text>
        <ChevronRight color={colors.textMuted} size={18} />
      </Pressable>

      <Pressable
        onPress={async () => {
          await signOut();
          router.replace("/(tabs)/profil");
        }}
        className="mt-4 flex-row items-center justify-center gap-2 rounded-full border border-light-border dark:border-dark-border px-6 py-3.5 active:opacity-80"
      >
        <LogOut color={brand.danger} size={18} />
        <Text className="font-semibold text-danger">Se déconnecter</Text>
      </Pressable>
    </ScrollView>
  );
}
