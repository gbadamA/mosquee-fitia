import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { Stack, useRouter } from "expo-router";
import { brand } from "@fitia/design-tokens";
import { useAuth } from "../../lib/auth";
import { useThemeColors } from "../../lib/theme";

/**
 * Espace staff : réservé aux comptes du staff (terrain et bureau). Sans session
 * de staff, retour à l'écran de connexion — l'application publique, elle, reste
 * accessible à tous.
 */
export default function StaffLayout() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const colors = useThemeColors();

  useEffect(() => {
    if (!loading && !profile) router.replace("/(auth)/login");
  }, [loading, profile, router]);

  if (loading || !profile) {
    return (
      <View className="flex-1 items-center justify-center bg-light-bg dark:bg-dark-bg">
        <ActivityIndicator color={brand.primary} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Espace staff" }} />
      <Stack.Screen name="consignes" options={{ title: "Mes consignes" }} />
      <Stack.Screen name="annonce" options={{ title: "Publier une annonce" }} />
      <Stack.Screen name="evenement" options={{ title: "Créer un événement" }} />
      <Stack.Screen name="horaires" options={{ title: "Horaires de prière" }} />
    </Stack>
  );
}
