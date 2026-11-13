import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { HandCoins, MessageCircle, Phone, Settings, ShieldCheck, MapPin, ChevronRight } from "lucide-react-native";
import { ROLE_LABELS } from "@fitia/shared";
import { brand } from "@fitia/design-tokens";
import { useMosque, useBrand, callMosque, whatsappMosque } from "../../lib/mosque";
import { useAuth } from "../../lib/auth";
import { useThemeColors } from "../../lib/theme";

/**
 * Onglet « Plus » — ouvert à tous (2026-11-14) : la mosquée, les dons, les
 * réglages, et l'entrée de l'espace staff. Il remplace la carte de fidèle :
 * plus de compte fidèle dans l'application, le registre est tenu par le bureau.
 */
export default function Plus() {
  const router = useRouter();
  const colors = useThemeColors();
  const mosque = useMosque();
  const brandColors = useBrand(mosque);
  const { profile } = useAuth();

  const ligne =
    "flex-row items-center gap-3 rounded-md border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface p-4 active:opacity-80";
  const adresse = [mosque?.address, mosque?.city].filter(Boolean).join(" · ");

  return (
    <View className="flex-1 bg-light-bg dark:bg-dark-bg">
      <ScrollView>
        <LinearGradient colors={brandColors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} className="rounded-b-lg">
          <SafeAreaView edges={["top"]}>
            <View className="px-5 pb-7 pt-3">
              <Text className="text-white/80">Bienvenue à la</Text>
              <Text className="font-display text-2xl font-bold text-white">{mosque?.name ?? "Mosquée Fitya"}</Text>
              {adresse ? (
                <View className="mt-2 flex-row items-center gap-1.5">
                  <MapPin color="rgba(255,255,255,0.8)" size={14} />
                  <Text className="text-white/80">{adresse}</Text>
                </View>
              ) : null}
            </View>
          </SafeAreaView>
        </LinearGradient>

        <View className="gap-2 p-4">
          <Pressable onPress={() => router.push("/don")} className={`${ligne} border-primary bg-primary/10`}>
            <HandCoins color={brand.primary} size={20} />
            <Text className="flex-1 text-base font-semibold text-primary">Faire un don à la mosquée</Text>
            <ChevronRight color={brand.primary} size={18} />
          </Pressable>

          {/* Contacts issus de la fiche mosquée : masqués tant qu'ils ne sont pas
              renseignés au tableau de bord, plutôt que d'appeler un faux numéro. */}
          {(mosque?.whatsapp || mosque?.phone) && (
            <Pressable onPress={() => whatsappMosque(mosque)} className={ligne}>
              <MessageCircle color={brand.tertiary} size={20} />
              <Text className="flex-1 text-base text-light-text dark:text-dark-text">Écrire à la mosquée sur WhatsApp</Text>
            </Pressable>
          )}
          {mosque?.phone && (
            <Pressable onPress={() => callMosque(mosque)} className={ligne}>
              <Phone color={brand.tertiary} size={20} />
              <Text className="flex-1 text-base text-light-text dark:text-dark-text">Appeler la mosquée</Text>
            </Pressable>
          )}

          <Pressable onPress={() => router.push("/reglages")} className={ligne}>
            <Settings color={brand.tertiary} size={20} />
            <Text className="flex-1 text-base text-light-text dark:text-dark-text">Réglages et notifications</Text>
          </Pressable>

          {/* Espace staff : discret pour le public, direct pour un membre connecté. */}
          <View className="mt-6">
            {profile ? (
              <Pressable onPress={() => router.push("/staff")} className={`${ligne} border-primary`}>
                <ShieldCheck color={brand.primary} size={20} />
                <View className="flex-1">
                  <Text className="text-base font-semibold text-light-text dark:text-dark-text">Espace staff</Text>
                  <Text className="text-caption text-light-muted dark:text-dark-muted">
                    {profile.full_name ?? "Membre"} · {ROLE_LABELS[profile.role]}
                  </Text>
                </View>
                <ChevronRight color={colors.textMuted} size={18} />
              </Pressable>
            ) : (
              <Pressable
                onPress={() => router.push("/(auth)/login")}
                className="flex-row items-center justify-center gap-2 py-3 active:opacity-70"
              >
                <ShieldCheck color={colors.textMuted} size={16} />
                <Text className="text-light-muted dark:text-dark-muted">Connexion staff</Text>
              </Pressable>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
