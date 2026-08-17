import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Moon, ArrowRight, Eye, EyeOff } from "lucide-react-native";
import { normalizePhoneCI } from "@fitia/shared";
import { supabase, isConfigured } from "../../lib/supabase";
import { useMosque, useBrand } from "../../lib/mosque";
import { useThemeColors } from "../../lib/theme";

/**
 * Connexion des fidèles : numéro de téléphone + mot de passe.
 *
 * POURQUOI PAS DE CODE PAR SMS. La mosquée n'a pas de fournisseur SMS ; l'OTP
 * ne pourrait envoyer aucun code et personne ne se connecterait. Le numéro reste
 * l'identifiant — c'est ce qui parle aux fidèles — et un mot de passe remplace
 * le code. Il est engendré par l'Edge Function `create-member` et remis en main
 * propre par le secrétaire, qui a vu le fidèle : la vérification du numéro a donc
 * bien eu lieu, physiquement plutôt que par SMS.
 *
 * REVENIR À L'OTP le jour où un fournisseur sera configuré : le parcours complet
 * (envoi du code + écran de vérification) est dans l'historique git, commit
 * `db27816` et ses parents.
 */
export default function Login() {
  const colors = useThemeColors();
  const router = useRouter();
  const mosque = useMosque();
  const brandColors = useBrand(mosque);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setError(null);

    const normalized = normalizePhoneCI(phone);
    if (normalized.length < 12) {
      setError("Numéro incomplet.");
      return;
    }
    if (!password) {
      setError("Saisissez votre mot de passe.");
      return;
    }
    if (!supabase) {
      setError("Application non configurée (.env manquant).");
      return;
    }

    setBusy(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      phone: normalized,
      password,
    });
    setBusy(false);

    if (authError) {
      // Message unique volontairement : distinguer « numéro inconnu » de
      // « mauvais mot de passe » indiquerait à un inconnu quels numéros sont
      // enregistrés à la mosquée.
      setError("Numéro ou mot de passe incorrect.");
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
          Connectez-vous avec le numéro et le mot de passe remis par la mosquée.
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
          className="mb-4 rounded-md border border-light-border dark:border-dark-border px-4 py-3.5 text-base text-light-text dark:text-dark-text"
        />

        <Text className="mb-1.5 text-light-muted dark:text-dark-muted">Mot de passe</Text>
        <View className="mb-5 flex-row items-center rounded-md border border-light-border dark:border-dark-border">
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!reveal}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
            className="flex-1 px-4 py-3.5 text-base tracking-widest text-light-text dark:text-dark-text"
          />
          {/* Un mot de passe engendré se recopie à la main : pouvoir le relire
              évite bien des échecs de saisie. */}
          <Pressable
            onPress={() => setReveal((r) => !r)}
            accessibilityLabel={reveal ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            className="px-4 py-3.5 active:opacity-60"
          >
            {reveal ? (
              <EyeOff color={colors.textMuted} size={20} />
            ) : (
              <Eye color={colors.textMuted} size={20} />
            )}
          </Pressable>
        </View>

        <Pressable
          onPress={signIn}
          disabled={busy}
          className="flex-row items-center justify-center gap-2 rounded-full bg-primary px-6 py-4 active:opacity-80"
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text className="text-base font-semibold text-white">Se connecter</Text>
              <ArrowRight color="#fff" size={18} />
            </>
          )}
        </Pressable>

        {error && <Text className="mt-3 text-center text-danger">{error}</Text>}

        <Text className="mt-6 text-center text-caption text-light-muted dark:text-dark-muted">
          Mot de passe oublié ou jamais reçu ? Adressez-vous au secrétariat de la
          mosquée, qui vous en remettra un nouveau.
        </Text>
      </KeyboardAvoidingView>
    </View>
  );
}
