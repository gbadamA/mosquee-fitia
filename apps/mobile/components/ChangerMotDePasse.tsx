import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { KeyRound, Eye, EyeOff, CheckCircle2 } from "lucide-react-native";
import { changeOwnPassword, PASSWORD_MIN_LENGTH } from "@fitia/shared";
import { supabase } from "../lib/supabase";
import { useThemeColors } from "../lib/theme";

/**
 * Bloc « Mot de passe » des Réglages : le fidèle remplace celui que le bureau
 * lui a remis. L'ancien est vérifié d'abord (cf. `changeOwnPassword`) : un
 * téléphone prêté ne doit pas suffire à s'approprier le compte.
 */
export function ChangerMotDePasse({ primary }: { primary: string }) {
  const colors = useThemeColors();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    if (!supabase) {
      setError("Application non configurée.");
      return;
    }
    setBusy(true);
    setError(null);
    setDone(false);
    const failure = await changeOwnPassword(supabase, current, next, confirmation);
    setBusy(false);
    if (failure) {
      setError(failure);
      return;
    }
    setCurrent("");
    setNext("");
    setConfirmation("");
    setDone(true);
  }

  const input =
    "mb-3 rounded-md border border-light-border dark:border-dark-border px-4 py-3 text-base text-light-text dark:text-dark-text";
  const champ = (value: string, onChange: (v: string) => void, placeholder: string) => (
    <TextInput
      value={value}
      onChangeText={(v) => {
        onChange(v);
        setDone(false);
      }}
      secureTextEntry={!reveal}
      autoCapitalize="none"
      autoCorrect={false}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      className={input}
    />
  );

  return (
    <View className="rounded-md border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface p-4">
      {done && (
        <View className="mb-3 flex-row items-center gap-2 rounded-md bg-success/10 p-3">
          <CheckCircle2 color={primary} size={18} />
          <Text className="flex-1 text-success">
            Mot de passe changé. Utilisez le nouveau à la prochaine connexion.
          </Text>
        </View>
      )}
      {error && (
        <View className="mb-3 rounded-md border border-danger/40 bg-danger/10 p-3">
          <Text className="text-danger">{error}</Text>
        </View>
      )}

      {champ(current, setCurrent, "Mot de passe actuel")}
      {champ(next, setNext, `Nouveau (${PASSWORD_MIN_LENGTH} caractères minimum)`)}
      {champ(confirmation, setConfirmation, "Confirmer le nouveau")}

      <Pressable
        onPress={() => setReveal((r) => !r)}
        className="mb-4 flex-row items-center gap-2 self-start active:opacity-60"
      >
        {reveal ? <EyeOff color={colors.textMuted} size={18} /> : <Eye color={colors.textMuted} size={18} />}
        <Text className="text-caption text-light-muted dark:text-dark-muted">
          {reveal ? "Masquer" : "Afficher"} les mots de passe
        </Text>
      </Pressable>

      <Pressable
        onPress={submit}
        disabled={busy || !current || !next || !confirmation}
        className={`flex-row items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 active:opacity-80 ${
          busy || !current || !next || !confirmation ? "opacity-50" : ""
        }`}
      >
        {busy ? <ActivityIndicator color="#fff" /> : <KeyRound color="#fff" size={18} />}
        <Text className="font-semibold text-white">
          {busy ? "Vérification…" : "Changer le mot de passe"}
        </Text>
      </Pressable>
    </View>
  );
}
