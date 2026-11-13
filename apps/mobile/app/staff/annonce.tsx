import { useState } from "react";
import { Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  createAnnouncementSchema,
  CATEGORY_META,
  announcementCategorySchema,
  type AnnouncementCategory,
} from "@fitia/shared";
import { brand } from "@fitia/design-tokens";
import { supabase } from "../../lib/supabase";
import { Bandeau, BoutonPrincipal, Champ, EcranStaff, Puces } from "../../components/StaffUi";

const CATEGORIES = announcementCategorySchema.options.map((c) => ({
  cle: c,
  libelle: CATEGORY_META[c].label,
}));

/**
 * Publier une annonce depuis le terrain : elle apparaît aussitôt dans
 * l'application (temps réel) et part en notification sur tous les téléphones
 * inscrits — comptes ou non.
 */
export default function PublierAnnonce() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<AnnouncementCategory>("info");
  const [pinned, setPinned] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  async function publier() {
    setErreur(null);
    setSucces(null);
    const parsed = createAnnouncementSchema.safeParse({ title, body, category, pinned });
    if (!parsed.success) {
      setErreur(parsed.error.issues[0]?.message ?? "Formulaire invalide");
      return;
    }
    if (!supabase) return;
    setOccupe(true);
    const { error } = await supabase.from("announcements").insert(parsed.data);
    if (error) {
      setOccupe(false);
      setErreur("Publication refusée : vérifiez votre connexion et vos droits.");
      return;
    }
    const { data } = await supabase.functions.invoke("send-push", {
      body: { title: parsed.data.title, body: parsed.data.body.slice(0, 140) },
    });
    setOccupe(false);
    const envoyes = (data as { sent?: number } | null)?.sent ?? 0;
    setTitle("");
    setBody("");
    setPinned(false);
    setSucces(
      envoyes > 0
        ? `Annonce publiée et notifiée sur ${envoyes} téléphone(s).`
        : "Annonce publiée. Elle est visible dans l'application.",
    );
  }

  return (
    <EcranStaff>
      <Bandeau ton="succes" texte={succes} />
      <Bandeau ton="erreur" texte={erreur} />
      <Champ libelle="Titre" value={title} onChangeText={setTitle} placeholder="Ex. Collecte de vendredi" />
      <Champ libelle="Message" value={body} onChangeText={setBody} multiligne />
      <View>
        <Text className="mb-1.5 text-light-muted dark:text-dark-muted">Catégorie</Text>
        <Puces options={CATEGORIES} valeur={category} onChange={setCategory} />
      </View>
      <View className="flex-row items-center justify-between">
        <Text className="text-light-text dark:text-dark-text">Épingler en haut de la liste</Text>
        <Switch value={pinned} onValueChange={setPinned} trackColor={{ true: brand.primary, false: "#ccc" }} />
      </View>
      <BoutonPrincipal titre="Publier l'annonce" onPress={publier} occupe={occupe} desactive={!title || !body} />
      {succes ? <BoutonPrincipal titre="Retour à l'espace staff" onPress={() => router.back()} /> : null}
    </EcranStaff>
  );
}
