import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { createPrayerTimesSchema, todayISO } from "@fitia/shared";
import { supabase } from "../../lib/supabase";
import { Bandeau, BoutonPrincipal, Champ, EcranStaff } from "../../components/StaffUi";

type Cle = "fajr" | "chourouk" | "dhuhr" | "asr" | "maghrib" | "isha" | "jumua";

const CHAMPS: { cle: Cle; libelle: string; facultatif?: boolean }[] = [
  { cle: "fajr", libelle: "Fajr" },
  { cle: "chourouk", libelle: "Chourouk", facultatif: true },
  { cle: "dhuhr", libelle: "Dhuhr" },
  { cle: "asr", libelle: "Asr" },
  { cle: "maghrib", libelle: "Maghrib" },
  { cle: "isha", libelle: "Isha" },
  { cle: "jumua", libelle: "Djouma (vendredi)", facultatif: true },
];

const VIDE: Record<Cle, string> = { fajr: "", chourouk: "", dhuhr: "", asr: "", maghrib: "", isha: "", jumua: "" };

/** « 5h12 », « 05:12 », « 512 » → « 05:12 ». */
function normaliser(v: string): string {
  const chiffres = v.replace(/\D/g, "");
  if (chiffres.length < 3) return v.trim();
  const hh = chiffres.slice(0, chiffres.length - 2).padStart(2, "0");
  return `${hh}:${chiffres.slice(-2)}`;
}

/**
 * Horaires de prière du JOUR. Un seul enregistrement par date (upsert) :
 * republier corrige au lieu de doubler. L'application les reçoit en direct et
 * replanifie les rappels de prière des téléphones.
 */
export default function HorairesDuJour() {
  const date = todayISO();
  const [valeurs, setValeurs] = useState<Record<Cle, string>>(VIDE);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  // Préremplit avec les horaires déjà publiés pour aujourd'hui.
  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("prayer_times")
      .select("*")
      .eq("date", date)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const v = { ...VIDE };
        for (const { cle } of CHAMPS) v[cle] = ((data as Record<string, string | null>)[cle] ?? "").slice(0, 5);
        setValeurs(v);
      });
  }, [date]);

  async function publier() {
    setErreur(null);
    setSucces(null);
    const v = Object.fromEntries(CHAMPS.map(({ cle }) => [cle, normaliser(valeurs[cle])])) as Record<Cle, string>;
    const parsed = createPrayerTimesSchema.safeParse({
      date,
      fajr: v.fajr,
      chourouk: v.chourouk || null,
      dhuhr: v.dhuhr,
      asr: v.asr,
      maghrib: v.maghrib,
      isha: v.isha,
      jumua: v.jumua || null,
    });
    if (!parsed.success) {
      setErreur("Heures attendues au format HH:MM (ex. 05:12). Fajr, Dhuhr, Asr, Maghrib et Isha sont obligatoires.");
      return;
    }
    if (!supabase) return;
    setOccupe(true);
    const { error } = await supabase.from("prayer_times").upsert(parsed.data, { onConflict: "date" });
    setOccupe(false);
    if (error) {
      setErreur("Publication refusée : vérifiez votre connexion et vos droits.");
      return;
    }
    setValeurs(v);
    setSucces("Horaires publiés : l'application les affiche déjà.");
  }

  return (
    <EcranStaff>
      <Text className="text-light-muted dark:text-dark-muted">
        Horaires du {new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
      </Text>
      <Bandeau ton="succes" texte={succes} />
      <Bandeau ton="erreur" texte={erreur} />
      <View className="flex-row flex-wrap gap-3">
        {CHAMPS.map(({ cle, libelle, facultatif }) => (
          <View key={cle} className="w-[47%]">
            <Champ
              libelle={facultatif ? `${libelle} (facult.)` : libelle}
              value={valeurs[cle]}
              onChangeText={(t) => setValeurs((x) => ({ ...x, [cle]: t }))}
              placeholder="HH:MM"
              keyboardType="numbers-and-punctuation"
            />
          </View>
        ))}
      </View>
      <BoutonPrincipal titre="Publier les horaires" onPress={publier} occupe={occupe} />
    </EcranStaff>
  );
}
