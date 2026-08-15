import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { HandCoins, LogOut, MessageCircle, Phone, Settings, ShieldCheck, TriangleAlert, CircleCheck } from "lucide-react-native";
import {
  formatFCFA,
  formatPhoneCI,
  receiptNumber,
  cotisationStatus,
  cotisationSummary,
  formatPeriod,
  MEMBER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  DONATION_TYPE_LABELS,
  type PaymentStatus,
} from "@fitia/shared";
import type { ContributionRow, DonationRow } from "@fitia/supabase";
import { brand } from "@fitia/design-tokens";
import { supabase } from "../../lib/supabase";
import { useMosque, useBrand, callMosque, whatsappMosque } from "../../lib/mosque";
import { useAuth } from "../../lib/auth";
import { scheduleContributionReminder } from "../../lib/notifications";
import { DASHBOARD_ROLES } from "@fitia/shared";

/** Ligne d'historique unifiée : cotisations et dons se lisent de la même façon. */
type Entry = {
  id: string;
  label: string;
  amount: number;
  status: PaymentStatus;
  method: keyof typeof PAYMENT_METHOD_LABELS;
  created_at: string;
};

const STATUS_COLOR: Record<PaymentStatus, string> = {
  valide: brand.success,
  en_attente: brand.warning,
  rejete: brand.danger,
};

export default function Profil() {
  const { profile, session, signOut, refreshProfile } = useAuth();
  const mosque = useMosque();
  const brandColors = useBrand(mosque);
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  /** Cotisations brutes : nécessaires au calcul des arriérés (période + statut). */
  const [rawContributions, setRawContributions] = useState<ContributionRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !session) return;
    const [{ data: contributions }, { data: donations }] = await Promise.all([
      supabase.from("contributions").select("*").order("created_at", { ascending: false }),
      supabase.from("donations").select("*").order("created_at", { ascending: false }),
    ]);

    setRawContributions((contributions as ContributionRow[]) ?? []);

    // La RLS restreint déjà ces deux requêtes à mes propres lignes.
    const merged: Entry[] = [
      ...((contributions as ContributionRow[]) ?? []).map((c) => ({
        id: c.id,
        label: `Cotisation ${c.period}`,
        amount: Number(c.amount),
        status: c.status,
        method: c.method,
        created_at: c.created_at,
      })),
      ...((donations as DonationRow[]) ?? []).map((d) => ({
        id: d.id,
        label: DONATION_TYPE_LABELS[d.type],
        amount: Number(d.amount),
        status: d.status,
        method: d.method,
        created_at: d.created_at,
      })),
    ].sort((a, b) => b.created_at.localeCompare(a.created_at));

    setEntries(merged);
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);


  /**
   * Situation de cotisation du fidèle. Le montant de référence vient de la
   * mosquée : tant qu'il n'est pas chargé, on n'affiche rien plutôt que
   * d'annoncer un arriéré faux calculé sur une valeur par défaut.
   */
  const cotisation =
    mosque && profile
      ? cotisationStatus({
          joinedAt: profile.joined_at,
          contributions: rawContributions,
          reference: Number(mosque.contribution_amount),
        })
      : null;

  const monthsLate = cotisation?.monthsLate ?? 0;
  const upToDate = cotisation?.upToDate ?? true;

  // Rappel replanifié au 1er du mois prochain à chaque ouverture du profil.
  useEffect(() => {
    if (upToDate) return;
    scheduleContributionReminder(monthsLate).catch(() => {});
  }, [monthsLate, upToDate]);

  const totalValide = entries
    .filter((e) => e.status === "valide")
    .reduce((acc, e) => acc + e.amount, 0);

  return (
    <View className="flex-1 bg-light-bg dark:bg-dark-bg">
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={brand.primary}
            onRefresh={async () => {
              setRefreshing(true);
              await Promise.all([load(), refreshProfile()]);
              setRefreshing(false);
            }}
          />
        }
      >
        {/* Carte de fidèle */}
        <LinearGradient
          colors={brandColors.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="rounded-b-lg"
        >
          <SafeAreaView edges={["top"]}>
            <View className="px-5 pb-7 pt-3">
              <Text className="text-white/80">Carte de fidèle</Text>
              <Text className="font-display text-2xl font-bold text-white">
                {profile?.full_name ?? "Fidèle"}
              </Text>

              <View className="mt-5 rounded-md border border-white/25 bg-white/15 p-4">
                <View className="flex-row justify-between">
                  <View>
                    <Text className="text-caption text-white/70">N° adhérent</Text>
                    <Text className="font-display text-lg font-bold tracking-wider text-white">
                      {profile?.member_number ?? "—"}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-caption text-white/70">Statut</Text>
                    <Text className="text-lg font-semibold text-white">
                      {profile ? MEMBER_STATUS_LABELS[profile.status] : "—"}
                    </Text>
                  </View>
                </View>
                <View className="mt-4 flex-row justify-between">
                  <View>
                    <Text className="text-caption text-white/70">Téléphone</Text>
                    <Text className="text-white">{formatPhoneCI(profile?.phone)}</Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-caption text-white/70">Total contribué</Text>
                    <Text className="text-white">{formatFCFA(totalValide)}</Text>
                  </View>
                </View>
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>

        <View className="p-4">
          {/* Actions */}
          <View className="mb-5 gap-2">
            {profile && DASHBOARD_ROLES.includes(profile.role) && (
              <Pressable
                onPress={() => router.push("/administration")}
                className="flex-row items-center gap-3 rounded-md border border-primary bg-primary/10 p-4 active:opacity-80"
              >
                <ShieldCheck color={brand.primary} size={20} />
                <Text className="flex-1 text-base font-semibold text-primary">
                  Espace administration
                </Text>
              </Pressable>
            )}

            <Pressable
              onPress={() => router.push("/reglages")}
              className="flex-row items-center gap-3 rounded-md border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface p-4 active:opacity-80"
            >
              <Settings color={brand.tertiary} size={20} />
              <Text className="flex-1 text-base text-light-text dark:text-dark-text">
                Réglages et notifications
              </Text>
            </Pressable>

            <Pressable
              onPress={() => router.push("/don")}
              className="flex-row items-center gap-3 rounded-md border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface p-4 active:opacity-80"
            >
              <HandCoins color={brand.primary} size={20} />
              <Text className="flex-1 text-base text-light-text dark:text-dark-text">
                Déclarer un don ou une cotisation
              </Text>
            </Pressable>

            {/* Contacts issus des paramètres de la mosquée : masqués tant qu'ils ne
                sont pas renseignés au dashboard, plutôt que d'appeler un faux numéro. */}
            {(mosque?.whatsapp || mosque?.phone) && (
              <Pressable
                onPress={() => whatsappMosque(mosque)}
                className="flex-row items-center gap-3 rounded-md border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface p-4 active:opacity-80"
              >
                <MessageCircle color={brand.tertiary} size={20} />
                <Text className="flex-1 text-base text-light-text dark:text-dark-text">
                  Écrire à la mosquée sur WhatsApp
                </Text>
              </Pressable>
            )}

            {mosque?.phone && (
              <Pressable
                onPress={() => callMosque(mosque)}
                className="flex-row items-center gap-3 rounded-md border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface p-4 active:opacity-80"
              >
                <Phone color={brand.tertiary} size={20} />
                <Text className="flex-1 text-base text-light-text dark:text-dark-text">Appeler la mosquée</Text>
              </Pressable>
            )}
          </View>

          {/* Historique */}
          <Text className="mb-2 font-display text-lg font-semibold text-light-text dark:text-dark-text">
            Mes contributions
          </Text>
          <View className="gap-2">
            {entries.map((e) => (
              <View
                key={e.id}
                className="flex-row items-center rounded-md border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface p-4"
              >
                <View className="flex-1">
                  <Text className="text-base text-light-text dark:text-dark-text">{e.label}</Text>
                  <Text className="text-caption text-light-muted dark:text-dark-muted">
                    {PAYMENT_METHOD_LABELS[e.method]} ·{" "}
                    {new Intl.DateTimeFormat("fr-FR").format(new Date(e.created_at))}
                    {e.status === "valide" && ` · ${receiptNumber(e.id)}`}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-base font-semibold text-light-text dark:text-dark-text">
                    {formatFCFA(e.amount)}
                  </Text>
                  <Text className="text-caption" style={{ color: STATUS_COLOR[e.status] }}>
                    {PAYMENT_STATUS_LABELS[e.status]}
                  </Text>
                </View>
              </View>
            ))}
            {entries.length === 0 && (
              <Text className="py-6 text-center text-light-muted dark:text-dark-muted">
                Aucune contribution enregistrée.
              </Text>
            )}
          </View>

          <Pressable
            onPress={signOut}
            className="mb-8 mt-6 flex-row items-center justify-center gap-2 rounded-full border border-light-border dark:border-dark-border px-6 py-3.5 active:opacity-80"
          >
            <LogOut color={brand.danger} size={18} />
            <Text className="font-semibold text-danger">Se déconnecter</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
