import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, TextInput, RefreshControl, ScrollView, KeyboardAvoidingView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Eye, CheckCircle2, Circle, AlertTriangle } from "lucide-react-native";
import type { ConsigneRow, ConsigneSuiviRow } from "@fitia/supabase";
import { brand } from "@fitia/design-tokens";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { useThemeColors } from "../../lib/theme";

/**
 * Consignes du bureau, côté staff de terrain : on les lit, on accuse
 * réception (« Bien reçu »), puis on signale qu'elles sont faites, avec un
 * court compte rendu que le bureau lit au tableau de bord. Mise à jour en
 * direct : une nouvelle consigne apparaît sans recharger.
 */
export default function MesConsignes() {
  const { profile } = useAuth();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [consignes, setConsignes] = useState<ConsigneRow[]>([]);
  const [suivis, setSuivis] = useState<Record<string, ConsigneSuiviRow>>({});
  const [rapports, setRapports] = useState<Record<string, string>>({});
  const [occupe, setOccupe] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [actualisation, setActualisation] = useState(false);

  const charger = useCallback(async () => {
    if (!supabase || !profile) return;
    const [{ data: c }, { data: s }] = await Promise.all([
      supabase.from("consignes").select("*").eq("archived", false).order("created_at", { ascending: false }),
      supabase.from("consigne_suivis").select("*").eq("member_id", profile.id),
    ]);
    // Le bureau voit toutes les consignes ; ici, seulement celles qui ME visent.
    setConsignes(((c as ConsigneRow[]) ?? []).filter((x) => x.assignee_id === null || x.assignee_id === profile.id));
    setSuivis(Object.fromEntries(((s as ConsigneSuiviRow[]) ?? []).map((x) => [x.consigne_id, x])));
  }, [profile]);

  useEffect(() => {
    void charger();
    if (!supabase) return;
    const sb = supabase;
    const canal = sb
      .channel("mobile:consignes")
      .on("postgres_changes", { event: "*", schema: "public", table: "consignes" }, () => void charger())
      .subscribe();
    return () => {
      void sb.removeChannel(canal);
    };
  }, [charger]);

  async function suivre(c: ConsigneRow, status: "recue" | "faite") {
    if (!supabase || !profile) return;
    setOccupe(c.id);
    setErreur(null);
    const report = status === "faite" ? rapports[c.id]?.trim() || null : suivis[c.id]?.report ?? null;
    const { error } = await supabase
      .from("consigne_suivis")
      .upsert(
        { consigne_id: c.id, member_id: profile.id, status, report, updated_at: new Date().toISOString() },
        { onConflict: "consigne_id,member_id" },
      );
    setOccupe(null);
    if (error) {
      setErreur("Mise à jour impossible : vérifiez votre connexion.");
      return;
    }
    void charger();
  }

  return (
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={insets.top + 56} className="flex-1">
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={actualisation}
            tintColor={brand.primary}
            onRefresh={async () => {
              setActualisation(true);
              await charger();
              setActualisation(false);
            }}
          />
        }
      >
        {erreur && <Text className="text-center text-danger">{erreur}</Text>}
        {consignes.length === 0 && (
          <Text className="py-10 text-center text-light-muted dark:text-dark-muted">Aucune consigne pour le moment.</Text>
        )}

        {consignes.map((c) => {
          const suivi = suivis[c.id];
          const faite = suivi?.status === "faite";
          return (
            <View
              key={c.id}
              className={`rounded-md border p-4 ${
                c.priority === "urgente" && !faite ? "border-danger/60 bg-danger/5" : "border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface"
              }`}
            >
              <View className="flex-row items-start gap-2">
                {faite ? (
                  <CheckCircle2 color={brand.success} size={20} />
                ) : suivi?.status === "recue" ? (
                  <Eye color={brand.primary} size={20} />
                ) : c.priority === "urgente" ? (
                  <AlertTriangle color={brand.danger} size={20} />
                ) : (
                  <Circle color={colors.textMuted} size={20} />
                )}
                <View className="flex-1">
                  <Text className="text-base font-semibold text-light-text dark:text-dark-text">{c.title}</Text>
                  <Text className="text-caption text-light-muted dark:text-dark-muted">
                    {c.priority === "urgente" ? "Urgente · " : ""}
                    {c.assignee_id ? "Pour vous" : "Pour tout le staff"}
                    {c.due_date ? ` · pour le ${new Date(c.due_date).toLocaleDateString("fr-FR")}` : ""}
                  </Text>
                </View>
              </View>
              {c.body ? <Text className="mt-2 text-light-text dark:text-dark-text">{c.body}</Text> : null}

              {faite ? (
                <Text className="mt-3 text-caption text-success">
                  Faite{suivi?.report ? ` — « ${suivi.report} »` : ""}
                </Text>
              ) : (
                <View className="mt-3 gap-2">
                  {suivi?.status !== "recue" && (
                    <Pressable
                      onPress={() => suivre(c, "recue")}
                      disabled={occupe === c.id}
                      className="items-center rounded-full border border-primary px-4 py-2.5 active:opacity-70"
                    >
                      <Text className="font-semibold text-primary">Bien reçu</Text>
                    </Pressable>
                  )}
                  <TextInput
                    value={rapports[c.id] ?? ""}
                    onChangeText={(t) => setRapports((r) => ({ ...r, [c.id]: t }))}
                    placeholder="Compte rendu (facultatif)"
                    placeholderTextColor={colors.textMuted}
                    className="rounded-md border border-light-border dark:border-dark-border px-3 py-2.5 text-light-text dark:text-dark-text"
                  />
                  <Pressable
                    onPress={() => suivre(c, "faite")}
                    disabled={occupe === c.id}
                    className="items-center rounded-full bg-primary px-4 py-2.5 active:opacity-80"
                    style={{ opacity: occupe === c.id ? 0.5 : 1 }}
                  >
                    <Text className="font-semibold text-white">C&apos;est fait</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
