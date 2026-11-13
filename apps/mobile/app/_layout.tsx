import "../global.css";
import { View, ActivityIndicator } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { brand } from "@fitia/design-tokens";
import { AuthProvider, useAuth } from "../lib/auth";
import { ThemeProvider, useTheme, useThemeColors } from "../lib/theme";
import { SettingsProvider } from "../lib/settings";

/**
 * L'application s'ouvre SANS connexion (2026-11-14) : horaires, annonces,
 * agenda et dons sont publics. Seul le staff se connecte, depuis l'onglet
 * « Plus », et retrouve ses écrans sous `/staff` (gardés par leur propre layout).
 */
function RootNavigator() {
  const { loading } = useAuth();
  const { resolved } = useTheme();
  const colors = useThemeColors();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-light-bg dark:bg-dark-bg">
        <ActivityIndicator color={brand.primary} />
      </View>
    );
  }

  return (
    <>
      {/* La barre d'état doit contraster avec le thème actif, pas être figée en clair. */}
      <StatusBar style={resolved === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" options={{ presentation: "modal" }} />
        <Stack.Screen name="staff" />
        <Stack.Screen name="don" options={{ presentation: "modal" }} />
        <Stack.Screen name="reglages" options={{ presentation: "modal" }} />
        <Stack.Screen name="administration" options={{ presentation: "modal" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <SettingsProvider>
            <AuthProvider>
              <RootNavigator />
            </AuthProvider>
          </SettingsProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
