import { useState } from "react";
import { View, Text, Pressable, Image, Linking } from "react-native";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import { Copy, Check, ExternalLink, Landmark, ChevronDown, ChevronUp } from "lucide-react-native";
import type { MosqueRow } from "@fitia/supabase";
import { useThemeColors } from "../lib/theme";

const LOGO_WAVE = require("../assets/reseaux/wave.png");

/**
 * Où et comment donner à la mosquée : QR code Wave, numéros Mobile Money,
 * virement bancaire. Tout vient de la fiche `mosque`, que le bureau modifie au
 * tableau de bord : aucun numéro n'est écrit dans l'application.
 *
 * Le QR est GÉNÉRÉ à partir du lien enregistré, celui décodé de l'autocollant
 * « Donnez avec Wave » de la mosquée : même contenu, donc même destinataire,
 * mais net à l'écran. Un téléphone ne pouvant pas se scanner lui-même, le
 * bouton « Ouvrir Wave » est le chemin principal ; le QR sert à payer depuis
 * un autre téléphone, ou à le montrer.
 */
export function CoordonneesDons({ mosque, primary }: { mosque: MosqueRow | null; primary: string }) {
  const colors = useThemeColors();
  const [copie, setCopie] = useState<string | null>(null);
  const [banqueOuverte, setBanqueOuverte] = useState(false);

  if (!mosque) return null;
  const wave = mosque.wave_payment_url;
  const aMobileMoney = Boolean(mosque.mtn_money_number || mosque.orange_money_number);
  const aBanque = Boolean(mosque.bank_iban || mosque.bank_account_number);
  if (!wave && !aMobileMoney && !aBanque) return null;

  async function copier(cle: string, valeur: string) {
    await Clipboard.setStringAsync(valeur);
    setCopie(cle);
    setTimeout(() => setCopie((c) => (c === cle ? null : c)), 2000);
  }

  const carte = "rounded-md border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface p-4";

  const BoutonCopier = ({ cle, valeur }: { cle: string; valeur: string }) => (
    <Pressable
      onPress={() => void copier(cle, valeur)}
      accessibilityLabel={`Copier ${valeur}`}
      className="flex-row items-center gap-1.5 rounded-full border border-light-border dark:border-dark-border px-3 py-1.5 active:opacity-70"
    >
      {copie === cle ? <Check color={primary} size={14} /> : <Copy color={colors.textMuted} size={14} />}
      <Text className={copie === cle ? "text-caption text-primary" : "text-caption text-light-muted dark:text-dark-muted"}>
        {copie === cle ? "Copié" : "Copier"}
      </Text>
    </Pressable>
  );

  const LigneNumero = ({ cle, reseau, couleur, numero }: { cle: string; reseau: string; couleur: string; numero: string }) => (
    <View className="flex-row items-center gap-3 py-2">
      <View style={{ backgroundColor: couleur }} className="h-9 w-9 items-center justify-center rounded-md">
        <Text className="text-[10px] font-bold text-white">{reseau.slice(0, 3).toUpperCase()}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-caption text-light-muted dark:text-dark-muted">{reseau} · accepte aussi Wave</Text>
        <Text className="font-display text-lg font-semibold tracking-wider text-light-text dark:text-dark-text">
          {numero.replace(/(\d{2})(?=\d)/g, "$1 ")}
        </Text>
      </View>
      <BoutonCopier cle={cle} valeur={numero} />
    </View>
  );

  const LigneBanque = ({ cle, libelle, valeur }: { cle: string; libelle: string; valeur: string | null }) =>
    valeur ? (
      <View className="flex-row items-center gap-2 py-1.5">
        <View className="flex-1">
          <Text className="text-caption text-light-muted dark:text-dark-muted">{libelle}</Text>
          <Text selectable className="text-base text-light-text dark:text-dark-text">{valeur}</Text>
        </View>
        <BoutonCopier cle={cle} valeur={valeur.replace(/\s/g, cle === "adresse" ? " " : "")} />
      </View>
    ) : null;

  return (
    <View className="gap-3">
      <Text className="font-display text-lg font-semibold text-light-text dark:text-dark-text">
        Faire un don
      </Text>

      {wave ? (
        <View className={`${carte} items-center`}>
          <View className="mb-3 flex-row items-center gap-2 self-stretch">
            <Image source={LOGO_WAVE} style={{ width: 32, height: 32 }} accessibilityLabel="Wave" />
            <Text className="flex-1 font-semibold text-light-text dark:text-dark-text">Donner avec Wave</Text>
          </View>
          {/* Fond blanc et marge obligatoires : un lecteur de QR échoue sur un
              code collé au bord ou posé sur fond sombre (mode sombre). */}
          <View className="rounded-md bg-white p-3">
            <QRCode value={wave} size={200} backgroundColor="#FFFFFF" color="#000000" ecl="M" quietZone={8} />
          </View>
          <Text className="mt-2 text-center text-caption text-light-muted dark:text-dark-muted">
            Depuis un autre téléphone : scannez ce code avec Wave.
          </Text>
          <Pressable
            onPress={() => void Linking.openURL(wave)}
            className="mt-3 flex-row items-center justify-center gap-2 self-stretch rounded-full px-6 py-3.5 active:opacity-80"
            style={{ backgroundColor: "#1DC8F2" }}
          >
            <ExternalLink color="#fff" size={18} />
            <Text className="font-semibold text-white">Ouvrir Wave et donner</Text>
          </Pressable>
        </View>
      ) : null}

      {aMobileMoney ? (
        <View className={carte}>
          <Text className="mb-1 font-semibold text-light-text dark:text-dark-text">Par Mobile Money</Text>
          {mosque.mtn_money_number ? (
            <LigneNumero cle="mtn" reseau="MTN Mobile Money" couleur="#FFCB05" numero={mosque.mtn_money_number} />
          ) : null}
          {mosque.orange_money_number ? (
            <LigneNumero cle="orange" reseau="Orange Money" couleur="#FF7900" numero={mosque.orange_money_number} />
          ) : null}
        </View>
      ) : null}

      {aBanque ? (
        <View className={carte}>
          <Pressable onPress={() => setBanqueOuverte((o) => !o)} className="flex-row items-center gap-2 active:opacity-70">
            <Landmark color={primary} size={18} />
            <Text className="flex-1 font-semibold text-light-text dark:text-dark-text">
              Par virement bancaire{mosque.bank_name ? ` — ${mosque.bank_name}` : ""}
            </Text>
            {banqueOuverte ? <ChevronUp color={colors.textMuted} size={18} /> : <ChevronDown color={colors.textMuted} size={18} />}
          </Pressable>
          {banqueOuverte ? (
            <View className="mt-2">
              <LigneBanque cle="iban" libelle="IBAN" valeur={mosque.bank_iban} />
              <LigneBanque cle="compte" libelle="Numéro de compte" valeur={mosque.bank_account_number} />
              <LigneBanque cle="code" libelle="Code banque" valeur={mosque.bank_code} />
              <LigneBanque cle="guichet" libelle="Code guichet" valeur={mosque.bank_branch_code} />
              <LigneBanque cle="cle" libelle="Clé RIB" valeur={mosque.bank_rib_key} />
              <LigneBanque cle="swift" libelle="SWIFT / BIC" valeur={mosque.bank_swift} />
              <LigneBanque cle="adresse" libelle="Adresse" valeur={mosque.bank_address} />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
