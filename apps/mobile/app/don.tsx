import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";
import { X, CheckCircle2, Info, Paperclip, Camera, Trash2 } from "lucide-react-native";
import {
  declareContributionSchema,
  declareDonationSchema,
  formatFCFA,
  cotisationStatus,
  formatPeriod,
  PAYMENT_METHOD_LABELS,
  DONATION_TYPE_LABELS,
  type PaymentMethod,
  type DonationType,
} from "@fitia/shared";
import type { CampaignRow, ContributionRow } from "@fitia/supabase";
import { brand } from "@fitia/design-tokens";
import { supabase } from "../lib/supabase";
import { useMosque, useBrand } from "../lib/mosque";
import { pickProof, captureProof, uploadProof, type PickedProof } from "../lib/proof";
import { useAuth } from "../lib/auth";
import { useThemeColors } from "../lib/theme";

/**
 * Déclaration d'un versement Mobile Money — modèle « preuve de paiement ».
 * Aucune API de paiement n'est appelée : le fidèle effectue son transfert depuis
 * son application Mobile Money habituelle, puis saisit ici le numéro de transaction.
 * Le trésorier valide au dashboard, ce qui fait entrer le montant dans les comptes.
 */

type Kind = "cotisation" | "sadaqah" | "zakat" | "campagne";

const KINDS: { key: Kind; label: string }[] = [
  { key: "cotisation", label: "Cotisation" },
  { key: "sadaqah", label: DONATION_TYPE_LABELS.sadaqah },
  { key: "zakat", label: DONATION_TYPE_LABELS.zakat },
  { key: "campagne", label: "Campagne" },
];

const METHODS = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[];
const PRESETS = [1000, 2000, 5000, 10000, 25000];

/** Mois courant au format `YYYY-MM`. */
function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Don() {
  const colors = useThemeColors();
  const router = useRouter();
  const { session, profile } = useAuth();
  const mosque = useMosque();
  const brandColors = useBrand(mosque);
  const [kind, setKind] = useState<Kind>("sadaqah");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("orange_money");
  const [reference, setReference] = useState("");
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  /** Avancement par campagne — agrégat renvoyé par `campaign_progress()` :
      la RLS interdit au fidèle de sommer lui-même les dons des autres. */
  const [progress, setProgress] = useState<Record<string, number>>({});
  /** Mois couvert par la cotisation déclarée. */
  const [period, setPeriod] = useState(currentPeriod());
  /** Mes cotisations : servent à proposer les mois encore dus. */
  const [myContributions, setMyContributions] = useState<ContributionRow[]>([]);
  /** Justificatif choisi, pas encore déposé. */
  const [proof, setProof] = useState<PickedProof | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("campaigns")
      .select("*")
      .eq("active", true)
      .then(({ data }) => {
        const rows = (data as CampaignRow[]) ?? [];
        setCampaigns(rows);
        setCampaignId((c) => c ?? rows[0]?.id ?? null);
      });

    supabase
      .from("contributions")
      .select("*")
      .then(({ data }) => setMyContributions((data as ContributionRow[]) ?? []));

    supabase.rpc("campaign_progress").then(({ data }) => {
      if (!data) return;
      setProgress(
        Object.fromEntries(data.map((r) => [r.campaign_id, Number(r.collected)])),
      );
    });
  }, []);

  /**
   * Mois encore dus, du plus ancien au plus récent.
   * On les propose explicitement : sans ça un fidèle en retard ne pourrait régler
   * que le mois courant, et ses arriérés resteraient impossibles à solder.
   */
  const cotisation =
    mosque && profile
      ? cotisationStatus({
          joinedAt: profile.joined_at,
          contributions: myContributions,
          reference: Number(mosque.contribution_amount),
        })
      : null;

  const duePeriods = cotisation
    ? [...cotisation.late, ...(cotisation.currentDue ? [cotisation.currentDue] : [])]
    : [];

  // Présélectionne le mois le plus ancien : on solde ses dettes dans l'ordre.
  useEffect(() => {
    if (duePeriods.length > 0 && !duePeriods.includes(period)) setPeriod(duePeriods[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duePeriods.join(",")]);

  /** Choix du justificatif — galerie ou appareil photo. */
  async function attachProof(fromCamera: boolean) {
    setError(null);
    const picked = fromCamera ? await captureProof() : await pickProof();
    if (!picked) {
      setError("Accès aux images refusé ou sélection annulée.");
      return;
    }
    setProof(picked);
  }

  async function submit() {
    setError(null);
    if (!supabase || !session) {
      setError("Session expirée, reconnectez-vous.");
      return;
    }

    const value = Number(amount);
    setBusy(true);

    // Dépôt du justificatif AVANT l'insertion : si l'envoi échoue, on n'écrit
    // aucune ligne, plutôt que de créer une déclaration orpheline de sa preuve.
    let proofPath: string | null = null;
    if (proof) {
      const uploaded = await uploadProof(session.user.id, proof);
      if ("error" in uploaded) {
        setBusy(false);
        setError(`Justificatif : ${uploaded.error}`);
        return;
      }
      proofPath = uploaded.path;
    }

    if (kind === "cotisation") {
      const parsed = declareContributionSchema.safeParse({
        amount: value,
        method,
        reference,
        period,
      });
      if (!parsed.success) {
        setBusy(false);
        setError(parsed.error.issues[0]?.message ?? "Formulaire invalide");
        return;
      }
      const { error: dbError } = await supabase
        .from("contributions")
        .insert({
          ...parsed.data,
          member_id: session.user.id,
          status: "en_attente",
          proof_path: proofPath,
        });
      setBusy(false);
      if (dbError) {
        setError(dbError.message);
        return;
      }
    } else {
      const type: DonationType = kind === "campagne" ? "campagne" : kind;
      const parsed = declareDonationSchema.safeParse({
        amount: value,
        method,
        reference,
        type,
        campaign_id: kind === "campagne" ? campaignId : null,
        anonymous: false,
      });
      if (!parsed.success) {
        setBusy(false);
        setError(parsed.error.issues[0]?.message ?? "Formulaire invalide");
        return;
      }
      const { error: dbError } = await supabase
        .from("donations")
        .insert({
          ...parsed.data,
          donor_id: session.user.id,
          status: "en_attente",
          proof_path: proofPath,
        });
      setBusy(false);
      if (dbError) {
        setError(dbError.message);
        return;
      }
    }

    setDone(true);
  }

  if (done) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-light-bg dark:bg-dark-bg px-8">
        <Animated.View entering={FadeIn.springify()} className="items-center">
          <CheckCircle2 color={brand.success} size={64} />
          <Text className="mt-5 text-center font-display text-xl font-bold text-light-text dark:text-dark-text">
            Déclaration enregistrée
          </Text>
          <Text className="mt-2 text-center text-light-muted dark:text-dark-muted">
            {formatFCFA(Number(amount))} — en attente de validation par le trésorier.
            Vous retrouverez le reçu dans votre profil une fois validé.
          </Text>
          <Text className="mt-4 text-center text-caption text-light-muted dark:text-dark-muted">
            Qu&apos;Allah accepte votre contribution.
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="mt-8 rounded-full bg-primary px-8 py-3.5 active:opacity-80"
          >
            <Text className="font-semibold text-white">Terminer</Text>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    );
  }

  const chip = (active: boolean) =>
    `rounded-full px-4 py-2 ${active ? "bg-primary" : "border border-light-border dark:border-dark-border"}`;
  const chipText = (active: boolean) =>
    active ? "font-semibold text-white" : "text-light-muted dark:text-dark-muted";

  return (
    <View className="flex-1 bg-light-bg dark:bg-dark-bg">
      <LinearGradient colors={brandColors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={["top"]}>
          <View className="flex-row items-center justify-between px-5 pb-6 pt-3">
            <View>
              <Text className="text-white/80">{mosque?.name ?? "Mosquée"}</Text>
              <Text className="font-display text-2xl font-bold text-white">
                Contribuer
              </Text>
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
        <ScrollView contentContainerClassName="p-4 gap-5">
          {/* Mode d'emploi — indispensable, c'est un flux en 2 temps. */}
          <View className="flex-row gap-3 rounded-md border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface p-4">
            <Info color={brand.tertiary} size={18} />
            <Text className="flex-1 text-caption text-light-muted dark:text-dark-muted">
              Effectuez d&apos;abord le transfert depuis votre application Mobile Money,
              puis saisissez ici le <Text className="text-light-text dark:text-dark-text">numéro de transaction</Text> reçu
              par SMS. Le trésorier valide ensuite votre versement.
            </Text>
          </View>

          <View>
            <Text className="mb-2 text-light-muted dark:text-dark-muted">Nature du versement</Text>
            <View className="flex-row flex-wrap gap-2">
              {KINDS.map((k) => (
                <Pressable
                  key={k.key}
                  onPress={() => setKind(k.key)}
                  className={chip(kind === k.key)}
                >
                  <Text className={chipText(kind === k.key)}>{k.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {kind === "campagne" && (
            <View>
              <Text className="mb-2 text-light-muted dark:text-dark-muted">Campagne</Text>
              <View className="gap-2">
                {campaigns.map((c) => {
                  const goalAmount = Number(c.goal_amount);
                  const collected = progress[c.id] ?? 0;
                  const pct =
                    goalAmount > 0 ? Math.min(100, Math.round((collected / goalAmount) * 100)) : 0;
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => setCampaignId(c.id)}
                      className={`rounded-md border p-4 ${
                        campaignId === c.id
                          ? "border-primary bg-primary/10"
                          : "border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface"
                      }`}
                    >
                      <Text className="font-semibold text-light-text dark:text-dark-text">{c.name}</Text>
                      {c.description && (
                        <Text className="mt-0.5 text-caption text-light-muted dark:text-dark-muted">{c.description}</Text>
                      )}

                      <View className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-light-surface-alt dark:bg-dark-surface-alt">
                        <View
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: brandColors.primary }}
                        />
                      </View>
                      <Text className="mt-1.5 text-caption text-light-muted dark:text-dark-muted">
                        {formatFCFA(collected)} collectés sur {formatFCFA(goalAmount)} · {pct}%
                      </Text>
                    </Pressable>
                  );
                })}
                {campaigns.length === 0 && (
                  <Text className="text-caption text-light-muted dark:text-dark-muted">
                    Aucune campagne en cours.
                  </Text>
                )}
              </View>
            </View>
          )}

          <View>
            <Text className="mb-2 text-light-muted dark:text-dark-muted">Montant (FCFA)</Text>
            <TextInput
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/\D/g, ""))}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              className="mb-2 rounded-md border border-light-border dark:border-dark-border px-4 py-3.5 text-xl text-light-text dark:text-dark-text"
            />
            <View className="flex-row flex-wrap gap-2">
              {PRESETS.map((p) => (
                <Pressable
                  key={p}
                  onPress={() => setAmount(String(p))}
                  className={chip(amount === String(p))}
                >
                  <Text className={chipText(amount === String(p))}>
                    {p.toLocaleString("fr-FR")}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View>
            <Text className="mb-2 text-light-muted dark:text-dark-muted">Moyen de paiement</Text>
            <View className="flex-row flex-wrap gap-2">
              {METHODS.map((m) => (
                <Pressable key={m} onPress={() => setMethod(m)} className={chip(method === m)}>
                  <Text className={chipText(method === m)}>{PAYMENT_METHOD_LABELS[m]}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {kind === "cotisation" && duePeriods.length > 0 && (
            <View>
              <Text className="mb-2 text-light-muted dark:text-dark-muted">
                Mois à régler
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {duePeriods.map((p) => {
                  const active = period === p;
                  const isLate = cotisation ? cotisation.late.includes(p) : false;
                  return (
                    <Pressable key={p} onPress={() => setPeriod(p)} className={chip(active)}>
                      <Text className={chipText(active)}>
                        {formatPeriod(p)}
                        {isLate ? " ⚠️" : ""}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {cotisation && cotisation.monthsLate > 0 && (
                <Text className="mt-2 text-caption text-danger">
                  {cotisation.monthsLate} mois en retard · {formatFCFA(cotisation.amountLate)} à
                  rattraper. Les mois marqués ⚠️ sont échus.
                </Text>
              )}
            </View>
          )}

          <View>
            <Text className="mb-2 text-light-muted dark:text-dark-muted">
              Justificatif (photo du reçu)
            </Text>
            {proof ? (
              <View className="flex-row items-center gap-3 rounded-md border border-primary bg-primary/10 p-4">
                <Paperclip color={brandColors.primary} size={18} />
                <Text className="flex-1 text-light-text dark:text-dark-text">
                  Justificatif joint
                </Text>
                <Pressable onPress={() => setProof(null)} className="p-1 active:opacity-70">
                  <Trash2 color={brand.danger} size={18} />
                </Pressable>
              </View>
            ) : (
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => attachProof(true)}
                  className="flex-1 flex-row items-center justify-center gap-2 rounded-md border border-light-border dark:border-dark-border p-4 active:opacity-80"
                >
                  <Camera color={brandColors.primary} size={18} />
                  <Text className="text-light-text dark:text-dark-text">Photographier</Text>
                </Pressable>
                <Pressable
                  onPress={() => attachProof(false)}
                  className="flex-1 flex-row items-center justify-center gap-2 rounded-md border border-light-border dark:border-dark-border p-4 active:opacity-80"
                >
                  <Paperclip color={brandColors.primary} size={18} />
                  <Text className="text-light-text dark:text-dark-text">Galerie</Text>
                </Pressable>
              </View>
            )}
            <Text className="mt-1.5 text-caption text-light-muted dark:text-dark-muted">
              Facultatif, mais le trésorier valide beaucoup plus vite avec la preuve sous
              les yeux.
            </Text>
          </View>

          <View>
            <Text className="mb-2 text-light-muted dark:text-dark-muted">Numéro de transaction</Text>
            <TextInput
              value={reference}
              onChangeText={setReference}
              autoCapitalize="characters"
              placeholder="Ex. OM250803.1234.A56789"
              placeholderTextColor={colors.textMuted}
              className="rounded-md border border-light-border dark:border-dark-border px-4 py-3.5 text-base text-light-text dark:text-dark-text"
            />
          </View>

          {error && <Text className="text-center text-danger">{error}</Text>}

          <Pressable
            onPress={submit}
            disabled={busy || !amount || reference.trim().length < 4}
            className="mb-8 items-center rounded-full bg-primary px-6 py-4 active:opacity-80"
            style={{ opacity: busy || !amount || reference.trim().length < 4 ? 0.5 : 1 }}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-base font-semibold text-white">
                Déclarer {amount ? formatFCFA(Number(amount)) : ""}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
