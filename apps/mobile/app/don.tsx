import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, KeyboardAvoidingView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";
import { X, CheckCircle2, Info } from "lucide-react-native";
import {
  declareDonationSchema,
  formatFCFA,
  PAYMENT_METHOD_LABELS,
  DONATION_TYPE_LABELS,
  type PaymentMethod,
  type DonationType,
} from "@fitia/shared";
import type { CampaignRow } from "@fitia/supabase";
import { brand } from "@fitia/design-tokens";
import { supabase } from "../lib/supabase";
import { useMosque, useBrand } from "../lib/mosque";
import { useThemeColors } from "../lib/theme";
import { CoordonneesDons } from "../components/CoordonneesDons";

/**
 * Dons — ouvert à TOUS, sans compte (2026-11-14).
 *
 *  1. Où donner : QR Wave, numéros Mobile Money, virement (\`CoordonneesDons\`).
 *  2. Déclarer son don : montant, moyen, numéro de transaction ; nom et numéro
 *     FACULTATIFS. La déclaration part en « en attente » : rien n'entre dans
 *     les comptes tant que le trésorier ne l'a pas validée au tableau de bord,
 *     ce qui rend inoffensive une fausse déclaration.
 *
 * Plus de cotisation ni de justificatif photo ici : ils supposaient un compte
 * de fidèle (le bureau tient désormais le registre des cotisations).
 */

type Kind = "sadaqah" | "zakat" | "campagne";

const KINDS: { key: Kind; label: string }[] = [
  { key: "sadaqah", label: DONATION_TYPE_LABELS.sadaqah },
  { key: "zakat", label: DONATION_TYPE_LABELS.zakat },
  { key: "campagne", label: "Campagne" },
];

const METHODS = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[];
/** Les paliers de l'affiche de la mosquée. */
const PRESETS = [1000, 2000, 5000, 10000, 25000];

export default function Don() {
  const colors = useThemeColors();
  const router = useRouter();
  const mosque = useMosque();
  const brandColors = useBrand(mosque);
  const [kind, setKind] = useState<Kind>("sadaqah");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("orange_money");
  const [reference, setReference] = useState("");
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  /** Avancement par campagne (\`campaign_progress()\`, lisible sans compte). */
  const [progress, setProgress] = useState<Record<string, number>>({});
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
    supabase.rpc("campaign_progress").then(({ data }) => {
      if (!data) return;
      setProgress(Object.fromEntries(data.map((r) => [r.campaign_id, Number(r.collected)])));
    });
  }, []);

  async function submit() {
    setError(null);
    if (!supabase) {
      setError("Application non configurée.");
      return;
    }
    const type: DonationType = kind === "campagne" ? "campagne" : kind;
    const parsed = declareDonationSchema.safeParse({
      amount: Number(amount),
      method,
      reference,
      type,
      campaign_id: kind === "campagne" ? campaignId : null,
      anonymous: !nom.trim(),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Formulaire invalide");
      return;
    }
    setBusy(true);
    // Sans \`.select()\` : un visiteur peut DÉCLARER, il ne peut rien relire.
    const { error: dbError } = await supabase.from("donations").insert({
      ...parsed.data,
      donor_name: nom.trim() || null,
      donor_phone: telephone.trim() || null,
      status: "en_attente",
    });
    setBusy(false);
    if (dbError) {
      setError("La déclaration n'a pas pu être envoyée. Vérifiez votre connexion et réessayez.");
      return;
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
            {formatFCFA(Number(amount))} — en attente de vérification par le trésorier.
          </Text>
          <Text className="mt-4 text-center text-caption text-light-muted dark:text-dark-muted">
            Qu&apos;Allah accepte votre don.
          </Text>
          <Pressable onPress={() => router.back()} className="mt-8 rounded-full bg-primary px-8 py-3.5 active:opacity-80">
            <Text className="font-semibold text-white">Terminer</Text>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    );
  }

  const chip = (active: boolean) =>
    `rounded-full px-4 py-2 ${active ? "bg-primary" : "border border-light-border dark:border-dark-border"}`;
  const chipText = (active: boolean) => (active ? "font-semibold text-white" : "text-light-muted dark:text-dark-muted");
  const input =
    "rounded-md border border-light-border dark:border-dark-border px-4 py-3.5 text-base text-light-text dark:text-dark-text";
  const pret = Boolean(amount) && reference.trim().length >= 4;

  return (
    <View className="flex-1 bg-light-bg dark:bg-dark-bg">
      <LinearGradient colors={brandColors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={["top"]}>
          <View className="flex-row items-center justify-between px-5 pb-6 pt-3">
            <View>
              <Text className="text-white/80">{mosque?.name ?? "Mosquée"}</Text>
              <Text className="font-display text-2xl font-bold text-white">Faire un don</Text>
            </View>
            <Pressable onPress={() => router.back()} accessibilityLabel="Fermer" className="p-2 active:opacity-70">
              <X color="#fff" size={24} />
            </Pressable>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Bord à bord Android : \`padding\` partout, sinon le clavier recouvre le champ. */}
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <ScrollView contentContainerClassName="p-4 gap-5 pb-10" keyboardShouldPersistTaps="handled">
          {/* 1. Où donner. */}
          <CoordonneesDons mosque={mosque} primary={brandColors.primary} />

          {/* 2. Déclarer. */}
          <View className="flex-row gap-3 rounded-md border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface p-4">
            <Info color={brand.tertiary} size={18} />
            <Text className="flex-1 text-caption text-light-muted dark:text-dark-muted">
              Après votre don, vous pouvez le déclarer ci-dessous avec le{" "}
              <Text className="text-light-text dark:text-dark-text">numéro de transaction</Text> reçu par SMS : le
              trésorier le vérifie et l&apos;enregistre. Votre nom est facultatif.
            </Text>
          </View>

          <Text className="font-display text-lg font-semibold text-light-text dark:text-dark-text">Déclarer mon don</Text>

          <View>
            <Text className="mb-2 text-light-muted dark:text-dark-muted">Nature du don</Text>
            <View className="flex-row flex-wrap gap-2">
              {KINDS.map((k) => (
                <Pressable key={k.key} onPress={() => setKind(k.key)} className={chip(kind === k.key)}>
                  <Text className={chipText(kind === k.key)}>{k.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {kind === "campagne" && (
            <View className="gap-2">
              {campaigns.map((c) => {
                const goalAmount = Number(c.goal_amount);
                const collected = progress[c.id] ?? 0;
                const pct = goalAmount > 0 ? Math.min(100, Math.round((collected / goalAmount) * 100)) : 0;
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
                      <View className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: brandColors.primary }} />
                    </View>
                    <Text className="mt-1.5 text-caption text-light-muted dark:text-dark-muted">
                      {formatFCFA(collected)} collectés sur {formatFCFA(goalAmount)} · {pct}%
                    </Text>
                  </Pressable>
                );
              })}
              {campaigns.length === 0 && (
                <Text className="text-caption text-light-muted dark:text-dark-muted">Aucune campagne en cours.</Text>
              )}
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
                <Pressable key={p} onPress={() => setAmount(String(p))} className={chip(amount === String(p))}>
                  <Text className={chipText(amount === String(p))}>{p.toLocaleString("fr-FR")}</Text>
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

          <View>
            <Text className="mb-2 text-light-muted dark:text-dark-muted">Numéro de transaction</Text>
            <TextInput
              value={reference}
              onChangeText={setReference}
              autoCapitalize="characters"
              placeholder="Ex. OM250803.1234.A56789"
              placeholderTextColor={colors.textMuted}
              className={input}
            />
          </View>

          <View className="gap-2">
            <Text className="text-light-muted dark:text-dark-muted">Votre nom (facultatif)</Text>
            <TextInput value={nom} onChangeText={setNom} autoCapitalize="words" placeholder="Laisser vide pour rester anonyme" placeholderTextColor={colors.textMuted} className={input} />
            <Text className="text-light-muted dark:text-dark-muted">Votre numéro (facultatif)</Text>
            <TextInput value={telephone} onChangeText={setTelephone} keyboardType="phone-pad" placeholder="Pour être recontacté si besoin" placeholderTextColor={colors.textMuted} className={input} />
          </View>

          {error && <Text className="text-center text-danger">{error}</Text>}

          <Pressable
            onPress={submit}
            disabled={busy || !pret}
            className="items-center rounded-full bg-primary px-6 py-4 active:opacity-80"
            style={{ opacity: busy || !pret ? 0.5 : 1 }}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-base font-semibold text-white">Déclarer {amount ? formatFCFA(Number(amount)) : ""}</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
