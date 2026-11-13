import type { ReactNode } from "react";
import { View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../lib/theme";

/**
 * Briques communes des écrans de l'espace staff.
 *
 * \`EcranStaff\` : bord à bord Android oblige, \`KeyboardAvoidingView\` en
 * \`padding\` sur les deux plateformes (sinon le clavier recouvre le champ) et
 * marge basse = zone des gestes du système. Décalé de l'en-tête de pile.
 */
export function EcranStaff({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={insets.top + 56} className="flex-1">
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function Champ({
  libelle,
  multiligne = false,
  ...props
}: { libelle: string; multiligne?: boolean } & React.ComponentProps<typeof TextInput>) {
  const colors = useThemeColors();
  return (
    <View>
      <Text className="mb-1.5 text-light-muted dark:text-dark-muted">{libelle}</Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        multiline={multiligne}
        textAlignVertical={multiligne ? "top" : "center"}
        {...props}
        className={`rounded-md border border-light-border dark:border-dark-border px-4 py-3 text-base text-light-text dark:text-dark-text ${multiligne ? "min-h-[110px]" : ""}`}
      />
    </View>
  );
}

export function Puces<T extends string>({
  options,
  valeur,
  onChange,
}: {
  options: { cle: T; libelle: string }[];
  valeur: T;
  onChange: (v: T) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((o) => {
        const actif = o.cle === valeur;
        return (
          <Pressable
            key={o.cle}
            onPress={() => onChange(o.cle)}
            className={`rounded-full px-4 py-2 ${actif ? "bg-primary" : "border border-light-border dark:border-dark-border"}`}
          >
            <Text className={actif ? "font-semibold text-white" : "text-light-muted dark:text-dark-muted"}>{o.libelle}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function BoutonPrincipal({
  titre,
  onPress,
  occupe = false,
  desactive = false,
}: {
  titre: string;
  onPress: () => void;
  occupe?: boolean;
  desactive?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={occupe || desactive}
      className="items-center rounded-full bg-primary px-6 py-4 active:opacity-80"
      style={{ opacity: occupe || desactive ? 0.5 : 1 }}
    >
      {occupe ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-semibold text-white">{titre}</Text>}
    </Pressable>
  );
}

export function Bandeau({ ton, texte }: { ton: "succes" | "erreur"; texte: string | null }) {
  if (!texte) return null;
  return (
    <View className={`rounded-md border p-3 ${ton === "succes" ? "border-success/40 bg-success/10" : "border-danger/40 bg-danger/10"}`}>
      <Text className={ton === "succes" ? "text-success" : "text-danger"}>{texte}</Text>
    </View>
  );
}
