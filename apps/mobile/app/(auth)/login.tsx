import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Moon, ArrowRight, TriangleAlert } from "lucide-react-native";
import { normalizePhoneCI } from "@fitia/shared";
import { supabase, isConfigured } from "../../lib/supabase";
import { useMosque, useBrand } from "../../lib/mosque";
import { useThemeColors } from "../../lib/theme";
import { OTP_ENABLED, OTP_DISABLED_NOTICE } from "../../lib/auth-mode";

/**
 * Connexion des fidèles.
 *
 * Deux chemins, pilotés par l'unique constante `OTP_ENABLED` (`lib/auth-mode.ts`) :
 *   - `true`  → numéro puis code reçu par SMS (comportement normal) ;
 *   - `false` → connexion directe, sans code, via l'Edge Function `dev-login`.
 *     Contournement de développement, temporaire et volontairement signalé à l'écran.
 */
export default function Login() {
  const colors = useThemeColors();
  const router = useRouter();
  const mosque = useMosque();
  const brandColors = useBrand(mosque);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Valide le numéro et renvoie sa forme normalisée, ou `null` si invalide. */
  function checkedPhone(): string | null {
    setError(null);
    const normalized = normalizePhoneCI(phone);
    if (normalized.length < 12) {
      setError("Numéro incomplet.");
      return null;
    }
    if (!supabase) {
      setError("Application non configurée (.env manquant).");
      return null;
    }
    return normalized;
  }

  /** Parcours normal : envoi du code, puis écran de vérification. */
  async function sendCode() {
    const normalized = checkedPhone();
    if (!normalized || !supabase) return;

    setBusy(true);
    const { error: authError } = await supabase.auth.signInWithOtp({ phone: normalized });
    setBusy(false);

    if (authError) {
      setError(authError.message);
      return;
    }
    router.push({ pathname: "/(auth)/verify", params: { phone: normalized } });
  }

  /**
   * Parcours sans code. `dev-login` crée ou retrouve le compte et lui attribue un
   * mot de passe éphémère, dont on se sert immédiatement pour ouvrir la session.
   * Le mot de passe est régénéré à chaque appel : il n'est jamais réutilisable.
   */
  async function signInWithoutCode() {
    const normalized = checkedPhone();
    if (!normalized || !supabase) return;

    setBusy(true);
    const { data, error: fnError } = await supabase.functions.invoke("dev-login", {
      body: { phone: normalized },
    });

    const failure = fnError?.message ?? (data as { error?: string } | null)?.error;
    if (failure) {
      setBusy(false);
      setError(failure);
      return;
    }

    const password = (data as { password?: string } | null)?.password;
    if (!password) {
      setBusy(false);
      setError("Réponse inattendue du serveur.");
      return;
    }

    const { error: authError } = await supabase.auth.signInWithPassword({
      phone: normalized,
      password,
    });
    setBusy(false);

    if (authError) {
      setError(authError.message);
      return;
    }
    // Le RootNavigator bascule vers (tabs) dès que la session existe.
    router.replace("/(tabs)");
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
          {OTP_ENABLED
            ? "Entrez votre numéro pour recevoir un code de vérification par SMS."
            : "Entrez votre numéro pour accéder à l'application."}
        </Text>

        {!isConfigured && (
          <View className="mb-5 rounded-md border border-warning/40 bg-warning/10 p-4">
            <Text className="text-warning">Backend non configuré — renseignez .env</Text>
          </View>
        )}

        {/* Le contournement doit se voir : personne ne doit le découvrir en production. */}
        {!OTP_ENABLED && (
          <View className="mb-5 flex-row items-start gap-3 rounded-md border border-warning/40 bg-warning/10 p-4">
            <TriangleAlert color="#F59E0B" size={18} />
            <Text className="flex-1 text-caption text-warning">{OTP_DISABLED_NOTICE}</Text>
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
          onPress={OTP_ENABLED ? sendCode : signInWithoutCode}
          disabled={busy}
          className="flex-row items-center justify-center gap-2 rounded-full bg-primary px-6 py-4 active:opacity-80"
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text className="text-base font-semibold text-white">
                {OTP_ENABLED ? "Recevoir le code" : "Se connecter"}
              </Text>
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
