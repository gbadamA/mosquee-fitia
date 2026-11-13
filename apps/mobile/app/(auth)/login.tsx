import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ShieldCheck, ArrowRight, Eye, EyeOff, X } from "lucide-react-native";
import { LOGIN_FAILED_MESSAGE, MOBILE_STAFF_ROLES, type Role } from "@fitia/shared";
import { supabase, isConfigured } from "../../lib/supabase";
import { useMosque, useBrand } from "../../lib/mosque";
import { useThemeColors } from "../../lib/theme";

/**
 * Connexion à l'ESPACE STAFF (2026-11-14).
 *
 * L'application est ouverte à tous sans compte ; seuls les membres du staff s'y
 * connectent, avec l'e-mail et le mot de passe que l'imam leur a créés
 * (Administration du tableau de bord) — les mêmes que pour le tableau de bord
 * quand ils en ont l'accès.
 */
export default function StaffLogin() {
  const router = useRouter();
  const colors = useThemeColors();
  const mosque = useMosque();
  const brandColors = useBrand(mosque);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setError(null);
    if (!email.trim() || !password) {
      setError("Saisissez votre e-mail et votre mot de passe.");
      return;
    }
    if (!supabase) {
      setError("Application non configurée (.env manquant).");
      return;
    }
    setBusy(true);
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (authError || !data.user) {
      setBusy(false);
      // Message unique : distinguer les cas révélerait quels comptes existent.
      setError(LOGIN_FAILED_MESSAGE);
      return;
    }
    // Un ancien compte de fidèle n'a plus d'espace sur mobile.
    const { data: profil } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
    if (!profil || !MOBILE_STAFF_ROLES.includes(profil.role as Role)) {
      await supabase.auth.signOut();
      setBusy(false);
      setError("Ce compte n'a pas accès à l'espace staff.");
      return;
    }
    setBusy(false);
    router.replace("/staff");
  }

  return (
    <View className="flex-1 bg-light-bg dark:bg-dark-bg">
      <LinearGradient colors={brandColors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} className="rounded-b-lg">
        <SafeAreaView edges={["top"]}>
          <View className="flex-row justify-end px-4 pt-2">
            <Pressable onPress={() => router.back()} accessibilityLabel="Fermer" className="p-2 active:opacity-70">
              <X color="#fff" size={24} />
            </Pressable>
          </View>
          <View className="items-center px-6 pb-8">
            <View className="mb-3 h-14 w-14 items-center justify-center rounded-lg bg-white/20">
              <ShieldCheck color="#fff" size={28} />
            </View>
            <Text className="font-display text-2xl font-bold text-white">Espace staff</Text>
            <Text className="text-white/80">{mosque?.name ?? "Mosquée Fitya"}</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Bord à bord Android : \`padding\` sur les deux plateformes, sinon le
          clavier recouvre le champ en cours de saisie. */}
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <ScrollView contentContainerClassName="px-6 pb-10 pt-8" keyboardShouldPersistTaps="handled">
          <Text className="mb-6 text-light-muted dark:text-dark-muted">
            Réservé aux membres du staff. Votre accès est créé par l&apos;imam.
          </Text>

          {!isConfigured && (
            <View className="mb-5 rounded-md border border-warning/40 bg-warning/10 p-4">
              <Text className="text-warning">Backend non configuré — renseignez .env</Text>
            </View>
          )}

          <Text className="mb-1.5 text-light-muted dark:text-dark-muted">E-mail</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            placeholder="prenom@fitia.ci"
            placeholderTextColor={colors.textMuted}
            className="mb-4 rounded-md border border-light-border dark:border-dark-border px-4 py-3.5 text-base text-light-text dark:text-dark-text"
          />

          <Text className="mb-1.5 text-light-muted dark:text-dark-muted">Mot de passe</Text>
          <View className="mb-5 flex-row items-center rounded-md border border-light-border dark:border-dark-border">
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!reveal}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              onSubmitEditing={signIn}
              className="flex-1 px-4 py-3.5 text-base text-light-text dark:text-dark-text"
            />
            <Pressable
              onPress={() => setReveal((r) => !r)}
              accessibilityLabel={reveal ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              className="px-4 py-3.5 active:opacity-60"
            >
              {reveal ? <EyeOff color={colors.textMuted} size={20} /> : <Eye color={colors.textMuted} size={20} />}
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
            Mot de passe oublié ? Adressez-vous à l&apos;imam, qui peut vous en redonner un.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
