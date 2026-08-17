import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Moon, ArrowRight } from "lucide-react-native";
import { normalizePhoneCI } from "@fitia/shared";
import { supabase, isConfigured } from "../../lib/supabase";
import { useMosque, useBrand } from "../../lib/mosque";
import { useThemeColors } from "../../lib/theme";

/**
 * Connexion des fidèles : numéro de téléphone, puis code reçu par SMS.
 *
 * Il n'existe volontairement qu'UN SEUL chemin. Un contournement « sans code »
 * a existé pour accélérer les tests sur émulateur (constante `OTP_ENABLED` +
 * Edge Function `dev-login`) ; il a été retiré le 2026-08-08 avec la fonction
 * qui le servait. Le rétablir signifierait réintroduire une porte dérobée : le
 * code se retrouve dans l'historique git (commit `708864e` et ses parents).
 */
export default function Login() {
  const colors = useThemeColors();
  const router = useRouter();
  const mosque = useMosque();
  const brandColors = useBrand(mosque);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    setError(null);

    const normalized = normalizePhoneCI(phone);
    if (normalized.length < 12) {
      setError("Numéro incomplet.");
      return;
    }
    if (!supabase) {
      setError("Application non configurée (.env manquant).");
      return;
    }

    setBusy(true);
    const { error: authError } = await supabase.auth.signInWithOtp({ phone: normalized });
    setBusy(false);

    if (authError) {
      setError(authError.message);
      return;
    }
    router.push({ pathname: "/(auth)/verify", params: { phone: normalized } });
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
          <View className="items-center px-6 pb-10 pt-8">
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-lg bg-white/20">
              <Moon color="#fff" size={30} />
            </View>
            <Text className="font-display text-2xl font-bold text-white">
              {mosque?.name ?? "Mosquée Fitia"}
            </Text>
            <Text className="text-white/80">
              {[mosque?.address, mosque?.city].filter(Boolean).join(" · ") || "Abobo · Abidjan"}
            </Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 px-6 pt-8"
      >
        <Text className="mb-1 font-display text-xl font-semibold text-light-text dark:text-dark-text">
          Bienvenue
        </Text>
        <Text className="mb-6 text-light-muted dark:text-dark-muted">
          Entrez votre numéro pour recevoir un code de vérification par SMS.
        </Text>

        {!isConfigured && (
          <View className="mb-5 rounded-md border border-warning/40 bg-warning/10 p-4">
            <Text className="text-warning">Backend non configuré — renseignez .env</Text>
          </View>
        )}

        <Text className="mb-1.5 text-light-muted dark:text-dark-muted">Numéro de téléphone</Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="07 00 00 00 00"
          placeholderTextColor={colors.textMuted}
          className="mb-5 rounded-md border border-light-border dark:border-dark-border px-4 py-3.5 text-base text-light-text dark:text-dark-text"
        />

        <Pressable
          onPress={sendCode}
          disabled={busy}
          className="flex-row items-center justify-center gap-2 rounded-full bg-primary px-6 py-4 active:opacity-80"
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text className="text-base font-semibold text-white">Recevoir le code</Text>
              <ArrowRight color="#fff" size={18} />
            </>
          )}
        </Pressable>

        {error && <Text className="mt-3 text-center text-danger">{error}</Text>}

        <Text className="mt-6 text-center text-caption text-light-muted dark:text-dark-muted">
          En continuant, vous acceptez que la mosquée conserve votre numéro pour vous
          transmettre les informations de la communauté.
        </Text>
      </KeyboardAvoidingView>
    </View>
  );
}
