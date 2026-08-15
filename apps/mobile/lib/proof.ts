import * as ImagePicker from "expo-image-picker";
import { supabase } from "./supabase";

/**
 * Justificatif de paiement : le fidèle photographie son reçu Mobile Money, la
 * trésorerie le consulte avant de confirmer.
 *
 * Convention de chemin : `<uid>/<horodatage>.<ext>`. Le premier segment porte la
 * propriété — c'est sur lui que s'appuie la policy Storage, qui interdit d'écrire
 * dans le dossier d'un autre.
 */

export type PickedProof = {
  uri: string;
  /** Extension déduite, pour nommer le fichier déposé. */
  extension: string;
  mimeType: string;
};

/** Ouvre la galerie. `null` si l'utilisateur annule ou refuse l'accès. */
export async function pickProof(): Promise<PickedProof | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.6, // un reçu reste lisible compressé, et l'upload passe en 3G
    allowsEditing: false,
  });
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const mimeType = asset.mimeType ?? "image/jpeg";
  const extension = mimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
  return { uri: asset.uri, extension, mimeType };
}

/** Prend la photo directement, sans passer par la galerie. */
export async function captureProof(): Promise<PickedProof | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchCameraAsync({ quality: 0.6 });
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const mimeType = asset.mimeType ?? "image/jpeg";
  const extension = mimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
  return { uri: asset.uri, extension, mimeType };
}

/**
 * Dépose le justificatif et renvoie son chemin, à stocker dans `proof_path`.
 *
 * ⚠️ React Native n'a pas de `File` : on passe par `ArrayBuffer`. Utiliser
 * directement l'URI `file://` produirait un objet vide côté Storage.
 */
export async function uploadProof(
  userId: string,
  proof: PickedProof,
): Promise<{ path: string } | { error: string }> {
  if (!supabase) return { error: "Application non configurée." };

  try {
    const response = await fetch(proof.uri);
    const bytes = await response.arrayBuffer();

    if (bytes.byteLength === 0) return { error: "Fichier illisible." };
    if (bytes.byteLength > 5 * 1024 * 1024) {
      return { error: "Image trop lourde (5 Mo maximum)." };
    }

    const path = `${userId}/${Date.now()}.${proof.extension}`;
    const { error } = await supabase.storage
      .from("justificatifs")
      .upload(path, bytes, { contentType: proof.mimeType, upsert: false });

    if (error) return { error: error.message };
    return { path };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Envoi impossible." };
  }
}
