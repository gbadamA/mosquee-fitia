import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Clock, Megaphone, CalendarDays, LayoutGrid } from "lucide-react-native";
import { useMosque, useBrand } from "../../lib/mosque";
import { useThemeColors } from "../../lib/theme";

export default function TabsLayout() {
  const mosque = useMosque();
  const brandColors = useBrand(mosque);
  const colors = useThemeColors();
  // Sur un téléphone à gestes, la barre système occupe le bas de l'écran.
  // Fixer `height` et `paddingBottom` en dur neutralise la compensation
  // automatique de React Navigation : nos onglets passaient alors SOUS la
  // barre d'Android, et les deux se confondaient. On réintègre donc l'inset.
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Teinte active = couleur de la mosquée ; fond = thème actif.
        tabBarActiveTintColor: brandColors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 62 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Prières",
          tabBarIcon: ({ color, size }) => <Clock color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="annonces"
        options={{
          title: "Annonces",
          tabBarIcon: ({ color, size }) => <Megaphone color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="agenda"
        options={{
          title: "Agenda",
          tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: "Plus",
          tabBarIcon: ({ color, size }) => <LayoutGrid color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
