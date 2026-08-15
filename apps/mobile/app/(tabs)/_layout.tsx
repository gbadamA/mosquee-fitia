import { Tabs } from "expo-router";
import { Clock, Megaphone, CalendarDays, User } from "lucide-react-native";
import { useMosque, useBrand } from "../../lib/mosque";
import { useThemeColors } from "../../lib/theme";

export default function TabsLayout() {
  const mosque = useMosque();
  const brandColors = useBrand(mosque);
  const colors = useThemeColors();

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
          height: 62,
          paddingBottom: 8,
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
          title: "Profil",
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
