import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { X, Send, Check, Wallet, TriangleAlert, ShieldAlert } from "lucide-react-native";
import {
  createAnnouncementSchema,
  formatFCFA,
  CATEGORY_META,
  PAYMENT_METHOD_LABELS,
  DONATION_TYPE_LABELS,
  ROLES_CAN_BROADCAST,
  ROLES_CAN_MANAGE_FINANCE,
  todayISO,
  type AnnouncementCategory,
} from "@fitia/shared";
import type { ContributionRow, DonationRow, ExpenseRow } from "@fitia/supabase";
import { brand } from "@fitia/design-tokens";
import { supabase } from "../lib/supabase";
import { useMosque, useBrand } from "../lib/mosque";
import { useThemeColors } from "../lib/theme";
import { useAuth } from "../lib/auth";

/**
 * Espace d'administration nomade (§3.6 du cahier).
 *
 * Volontairement réduit à ce qui a du sens en déplacement : consulter le solde,
 * valider une déclaration reçue, publier une annonce urgente. Le paramétrage
 * (rôles, couleurs, horaires) reste au dashboard, sur grand écran.
 *
 * ⚠️ La garde de rôle ci-dessous est du confort d'affichage : la vraie barrière
 * est la RLS Postgres, qui rejette l'écriture d'un fidèle même s'il forçait l'écran.
 */

type Pending = {
  kind: "cotisation" | "don";
  id: string;
  amount: number;
  detail: string;
  method: keyof typeof PAYMENT_METHOD_LABELS;
  reference: string | null;
  memberId: string | null;
};

const CATEGORIES: AnnouncementCategory[] = ["info", "khutba", "urgent", "collecte"];

export default function Administration() {
  const router = useRouter();
  const { profile } = useAuth();
  const mosque = useMosque();
  const brandColors = useBrand(mosque);
  const colors = useThemeColors();

  const [contributions, setContributions] = useState<ContributionRow[]>([]);
  const [donations, setDonations] = useState<DonationRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<AnnouncementCategory>("info");
  const [sending, setSending] = useState(false);

  const canBroadcast = Boolean(profile && ROLES_CAN_BROADCAST.includes(profile.role));
  const canFinance = Boolean(profile && ROLES_CAN_MANAGE_FINANCE.includes(profile.role));
  const allowed = canBroadcast || canFinance;

  const load = useCallback(async () => {
    if (!supabase || !allowed) return;
    const [{ data: c }, { data: d }, { data: e }] = await Promise.all([
      supabase.from("contributions").select("*").order("created_at", { ascending: false }),
      supabase.from("donations").select("*").order("created_at", { ascending: false }),
      supabase.from("expenses").select("*"),
    ]);
    setContributions((c as ContributionRow[]) ?? []);
    setDonations((d as DonationRow[]) ?? []);
    setExpenses((e as ExpenseRow[]) ?? []);
  }, [allowed]);

  useEffect(() => {
    load();
  }, [load]);

  if (!allowed) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-3 bg-light-bg px-8 dark:bg-dark-bg">
        <ShieldAlert color={brand.danger} size={40} />
        <Text className="text-center font-display text-xl font-semibold text-light-text dark:text-dark-text">
          Espace réservé au bureau
        </Text>
        <Pressable
          onPress={() => router.back()}
          className="mt-4 rounded-full bg-primary px-6 py-3 active:opacity-80"
        >
          <Text className="font-semibold text-white">Retour</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const sum = (rows: { amount: number; status?: string }[], onlyValid = true) =>
    rows
      .filter((r) => !onlyValid || r.status === "valide")
      .reduce((acc, r) => acc + Number(r.amount), 0);

  const entrees = sum(contributions) + sum(donations);
  const sorties = expenses.reduce((acc, e) => acc + Number(e.amount), 0);
  const solde = entrees - sorties;

  const pending: Pending[] = [
    ...contributions
      .filter((c) => c.status === "en_attente")
      .map<Pending>((c) => ({
        kind: "cotisation",
        id: c.id,
        amount: Number(c.amount),
        detail: `Cotisation ${c.period}`,
        method: c.method,
        reference: c.reference,
        memberId: c.member_id,
      })),
    ...donations
      .filter((d) => d.status === "en_attente")
      .map<Pending>((d) => ({
        kind: "don",
        id: d.id,
        amount: Number(d.amount),
        detail: DONATION_TYPE_LABELS[d.type],
        method: d.method,
        reference: d.reference,
        memberId: d.anonymous ? null : d.donor_id,
      })),
  ];

  /** Cotisations manquantes sur le mois courant — l'alerte « retard » du cahier. */
  const period = todayISO().slice(0, 7);
  const aJour = contributions.filter((c) => c.period === period && c.status === "valide").length;

  async function decide(row: Pending, approve: boolean) {
    if (!supabase) return;
    setBusyId(row.id);
    setError(null);

    const patch = {
      status: (approve ? "valide" : "rejete") as "valide" | "rejete",
      validated_by: profile?.id ?? null,
      validated_at: new Date().toISOString(),
    };

    const { error: dbError } =
      row.kind === "cotisation"
        ? await supabase.from("contributions").update(patch).eq("id", row.id)
        : await supabase.from("donations").update(patch).eq("id", row.id);

    // Seule une COTISATION validée met le fidèle « à jour ».
    if (!dbError && approve && row.kind === "cotisation" && row.memberId) {
      await supabase.from("profiles").update({ status: "actif" }).eq("id", row.memberId);
    }

    setBusyId(null);
    if (dbError) setError(dbError.message);
    else load();
  }

  async function broadcast() {
    if (!supabase) return;
    setError(null);
    const parsed = createAnnouncementSchema.safeParse({ title, body, category, pinned: false });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Formulaire invalide");
      return;
    }
    setSending(true);
    const { error: dbError } = await supabase.from("announcements").insert(parsed.data);
    setSending(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    supabase.functions
      .invoke("send-push", { body: { title: parsed.data.title, body: parsed.data.body } })
      .catch(() => {});
    setTitle("");
    setBody("");
    setSent(true);
    setTimeout(() => setSent(false), 3000);
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
              <Text className="font-display text-2xl font-bold text-white">Administration</Text>
            </View>
            <Pressable onPress={() => router.back()} className="p-2 active:opacity-70">
              <X color="#fff" size={24} />
            </Pressable>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="p-4 gap-5"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={brandColors.primary}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
            />
          }
        >
          {error && (
            <View className="rounded-md border border-danger/40 bg-danger/10 p-4">
              <Text className="text-danger">{error}</Text>
            </View>
          )}

          {/* Solde */}
          {canFinance && (
            <View className={card}>
              <View className="flex-row items-center gap-2">
                <Wallet color={brandColors.primary} size={18} />
                <Text className="text-caption text-light-muted dark:text-dark-muted">
                  Solde de la mosquée
                </Text>
              </View>
              <Text
                className={`font-display text-3xl font-bold ${
                  solde >= 0 ? "text-primary" : "text-danger"
                }`}
              >
                {formatFCFA(solde)}
              </Text>
              <Text className="mt-1 text-caption text-light-muted dark:text-dark-muted">
                {formatFCFA(entrees)} encaissés · {formatFCFA(sorties)} dépensés
              </Text>

              {solde < 0 && (
                <View className="mt-3 flex-row items-center gap-2 rounded-md border border-danger/40 bg-danger/10 p-3">
                  <TriangleAlert color={brand.danger} size={16} />
                  <Text className="flex-1 text-caption text-danger">
                    Trésorerie négative — les dépenses dépassent les encaissements.
                  </Text>
                </View>
              )}

              <View className="mt-3 flex-row items-center gap-2 rounded-md border border-light-border dark:border-dark-border p-3">
                <Text className="flex-1 text-caption text-light-muted dark:text-dark-muted">
                  {aJour} cotisation(s) encaissée(s) sur {period}
                </Text>
              </View>
            </View>
          )}

          {/* Déclarations à valider */}
          {canFinance && (
            <View>
              <Text className="mb-2 font-display text-lg font-semibold text-light-text dark:text-dark-text">
                À valider {pending.length > 0 && <Text className="text-primary">({pending.length})</Text>}
              </Text>
              <View className="gap-2">
                {pending.map((p) => (
                  <View key={p.id} className={card}>
                    <Text className="text-base font-semibold text-light-text dark:text-dark-text">
                      {formatFCFA(p.amount)} · {p.detail}
                    </Text>
                    <Text className="text-caption text-light-muted dark:text-dark-muted">
                      {PAYMENT_METHOD_LABELS[p.method]} · réf. {p.reference ?? "non fournie"}
                    </Text>
                    <View className="mt-3 flex-row gap-2">
                      <Pressable
                        onPress={() => decide(p, true)}
                        disabled={busyId === p.id}
                        className="flex-1 flex-row items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2.5 active:opacity-80"
                      >
                        {busyId === p.id ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <>
                            <Check color="#fff" size={16} />
                            <Text className="font-semibold text-white">Valider</Text>
                          </>
                        )}
                      </Pressable>
                      <Pressable
                        onPress={() => decide(p, false)}
                        disabled={busyId === p.id}
                        className="flex-1 flex-row items-center justify-center gap-1.5 rounded-full border border-light-border px-4 py-2.5 active:opacity-80 dark:border-dark-border"
                      >
                        <X color={colors.textMuted} size={16} />
                        <Text className="text-light-muted dark:text-dark-muted">Rejeter</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
                {pending.length === 0 && (
                  <Text className="py-4 text-center text-light-muted dark:text-dark-muted">
                    Aucune déclaration en attente.
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Publication d'une annonce */}
          {canBroadcast && (
            <View>
              <Text className="mb-2 font-display text-lg font-semibold text-light-text dark:text-dark-text">
                Publier une annonce
              </Text>
              <View className={card}>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Titre"
                  placeholderTextColor={colors.textMuted}
                  className="mb-2 rounded-md border border-light-border px-3 py-2.5 text-base text-light-text dark:border-dark-border dark:text-dark-text"
                />
                <TextInput
                  value={body}
                  onChangeText={setBody}
                  placeholder="Message aux fidèles…"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={3}
                  className="mb-3 rounded-md border border-light-border px-3 py-2.5 text-base text-light-text dark:border-dark-border dark:text-dark-text"
                />

                <View className="mb-3 flex-row flex-wrap gap-2">
                  {CATEGORIES.map((c) => {
                    const meta = CATEGORY_META[c];
                    const active = category === c;
                    return (
                      <Pressable
                        key={c}
                        onPress={() => setCategory(c)}
                        className="rounded-full px-3 py-1.5"
                        style={{
                          backgroundColor: active ? meta.color : "transparent",
                          borderWidth: 1,
                          borderColor: meta.color,
                        }}
                      >
                        <Text style={{ color: active ? "#fff" : meta.color }}>
                          {meta.emoji} {meta.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable
                  onPress={broadcast}
                  disabled={sending || title.trim().length < 3 || body.trim().length === 0}
                  className="flex-row items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 active:opacity-80"
                  style={{
                    opacity: title.trim().length < 3 || body.trim().length === 0 ? 0.5 : 1,
                  }}
                >
                  {sending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Send color="#fff" size={16} />
                      <Text className="font-semibold text-white">Diffuser</Text>
                    </>
                  )}
                </Pressable>

                {sent && (
                  <Text className="mt-2 text-center text-success">
                    Annonce diffusée aux fidèles.
                  </Text>
                )}
              </View>
            </View>
          )}

          <View className="h-6" />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
