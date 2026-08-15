import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { createSupabaseClient } from "@fitia/supabase";

const url =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  (Constants.expoConfig?.extra?.supabaseUrl as string | undefined) ??
  "";
const anonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  (Constants.expoConfig?.extra?.supabaseAnonKey as string | undefined) ??
  "";

export const isConfigured = Boolean(url && anonKey);

// Client unique (AsyncStorage pour la persistance de session sur RN).
export const supabase = isConfigured
  ? createSupabaseClient(url, anonKey, { storage: AsyncStorage })
  : null;
