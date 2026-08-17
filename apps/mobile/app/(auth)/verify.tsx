import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ShieldCheck } from "lucide-react-native";
import { supabase } from "../../lib/supabase";
import { useThemeColors } from "../../lib/theme";

export default function Verify() {
  const colors = useThemeColors();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify() {
    setError(null);
    if (!supabase || !phone) return;

    setBusy(true);
    const { error: authError } = await supabase.auth.verifyOtp({
      phone,
      token: code.trim(),
      type: "sms",
    });
    setBusy(false);

    if (authError) {
      setError("Code incorrect ou expiré.");
      return;
    }
    // Le RootNavigator redirige vers (tabs) dès que la session existe.
    router.replace("/(tabs)");
  }

  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-dark-bg px-6">
      <View className="mt-16 items-center">
        <View className="mb-5 h-14 w-14 items-center justify-center rounded-lg bg-primary/20">
          <ShieldCheck color="#12B76A" size={26} />
        </View>
        <Text className="mb-1 font-display text-xl font-semibold text-light-text dark:text-dark-text">
          Code de vérification
        </Text>
        <Text className="mb-8 text-center text-light-muted dark:text-dark-muted">
          Envoyé au {phone}
        </Text>
      </View>

      <TextInput
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        maxLength={6}
        placeholder="000000"
        placeholderTextColor={colors.textMuted}
        className="mb-5 rounded-md border border-light-border dark:border-dark-border px-4 py-4 text-center text-2xl tracking-[8px] text-light-text dark:text-dark-text"
      />

      <Pressable
        onPress={verify}
        disabled={busy || code.length < 4}
        className="items-center rounded-full bg-primary px-6 py-4 active:opacity-80"
        style={{ opacity: code.length < 4 ? 0.5 : 1 }}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-base font-semibold text-white">Vérifier</Text>
        )}
      </Pressable>

      {error && <Text className="mt-3 text-center text-danger">{error}</Text>}
    </SafeAreaView>
  );
}
