import { useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { createEventSchema, EVENT_TYPE_META, eventTypeSchema, type EventType } from "@fitia/shared";
import { supabase } from "../../lib/supabase";
import { Bandeau, BoutonPrincipal, Champ, EcranStaff, Puces } from "../../components/StaffUi";

const TYPES = eventTypeSchema.options.map((t) => ({ cle: t, libelle: EVENT_TYPE_META[t].label }));

/** Date du jour au format JJ/MM/AAAA, pour préremplir. */
function aujourdhui(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/**
 * « 25/12/2026 » + « 18:30 » → instant ISO. Abidjan est à UTC+0 toute l'année :
 * l'heure saisie EST l'heure UTC, sans calcul de fuseau ni d'heure d'été.
 */
function versIso(date: string, heure: string): string | null {
  const d = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(date.trim());
  const h = /^(\d{1,2})[:h](\d{2})$/.exec(heure.trim());
  if (!d || !h) return null;
  const [, jj, mm, aaaa] = d;
  const [, hh, mi] = h;
  const iso = new Date(Date.UTC(Number(aaaa), Number(mm) - 1, Number(jj), Number(hh), Number(mi)));
  return Number.isNaN(iso.getTime()) || iso.getUTCDate() !== Number(jj) ? null : iso.toISOString();
}

/** Créer un événement depuis le terrain : il apparaît aussitôt dans l'Agenda. */
export default function CreerEvenement() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<EventType>("autre");
  const [date, setDate] = useState(aujourdhui());
  const [heure, setHeure] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  async function creer() {
    setErreur(null);
    setSucces(null);
    const startsAt = versIso(date, heure);
    if (!startsAt) {
      setErreur("Date attendue au format JJ/MM/AAAA et heure au format HH:MM (ex. 25/12/2026 et 18:30).");
      return;
    }
    if (new Date(startsAt).getTime() < Date.now() - 60 * 60 * 1000) {
      setErreur("Cette date est déjà passée.");
      return;
    }
    const parsed = createEventSchema.safeParse({
      title,
      type,
      starts_at: startsAt,
      location: location.trim() || null,
      description: description.trim() || null,
    });
    if (!parsed.success) {
      setErreur(parsed.error.issues[0]?.message ?? "Formulaire invalide");
      return;
    }
    if (!supabase) return;
    setOccupe(true);
    const { error } = await supabase.from("events").insert(parsed.data);
    setOccupe(false);
    if (error) {
      setErreur("Création refusée : vérifiez votre connexion et vos droits.");
      return;
    }
    setTitle("");
    setHeure("");
    setLocation("");
    setDescription("");
    setSucces("Événement créé : il apparaît dans l'Agenda de l'application.");
  }

  return (
    <EcranStaff>
      <Bandeau ton="succes" texte={succes} />
      <Bandeau ton="erreur" texte={erreur} />
      <Champ libelle="Titre" value={title} onChangeText={setTitle} placeholder="Ex. Conférence après Isha" />
      <View>
        <Text className="mb-1.5 text-light-muted dark:text-dark-muted">Type</Text>
        <Puces options={TYPES} valeur={type} onChange={setType} />
      </View>
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Champ libelle="Date (JJ/MM/AAAA)" value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" />
        </View>
        <View className="flex-1">
          <Champ libelle="Heure (HH:MM)" value={heure} onChangeText={setHeure} placeholder="18:30" keyboardType="numbers-and-punctuation" />
        </View>
      </View>
      <Champ libelle="Lieu (facultatif)" value={location} onChangeText={setLocation} placeholder="Ex. Salle de prière" />
      <Champ libelle="Description (facultatif)" value={description} onChangeText={setDescription} multiligne />
      <BoutonPrincipal titre="Créer l'événement" onPress={creer} occupe={occupe} desactive={!title || !heure} />
      {succes ? <BoutonPrincipal titre="Retour à l'espace staff" onPress={() => router.back()} /> : null}
    </EcranStaff>
  );
}
