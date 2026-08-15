import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export type { Database } from "./database.types";
export type Client = SupabaseClient<Database>;

type Tables = Database["public"]["Tables"];

export type AnnouncementRow = Tables["announcements"]["Row"];
export type AnnouncementInsert = Tables["announcements"]["Insert"];
export type PrayerTimesRow = Tables["prayer_times"]["Row"];
export type PrayerTimesInsert = Tables["prayer_times"]["Insert"];
export type ProfileRow = Tables["profiles"]["Row"];
export type ContributionRow = Tables["contributions"]["Row"];
export type DonationRow = Tables["donations"]["Row"];
export type ExpenseRow = Tables["expenses"]["Row"];
export type CampaignRow = Tables["campaigns"]["Row"];
export type EventRow = Tables["events"]["Row"];
export type EventRegistrationRow = Tables["event_registrations"]["Row"];
export type DocumentRow = Tables["documents"]["Row"];
export type AssetRow = Tables["assets"]["Row"];
export type MaintenanceTaskRow = Tables["maintenance_tasks"]["Row"];
export type AttendanceRow = Tables["attendance_records"]["Row"];
export type MessageLogRow = Tables["message_log"]["Row"];
export type AssetEventRow = Tables["asset_events"]["Row"];
export type AttestationRow = Tables["attestations"]["Row"];
export type MosqueRow = Tables["mosque"]["Row"];

/**
 * Factory unique du client, utilisée par le mobile (Expo) ET le dashboard (Next.js).
 * On passe `storage` pour brancher AsyncStorage côté RN, `localStorage` côté web.
 */
export function createSupabaseClient(
  url: string,
  anonKey: string,
  options?: { storage?: unknown; detectSessionInUrl?: boolean },
): Client {
  if (!url || !anonKey) {
    throw new Error(
      "[supabase] URL / anon key manquants. Renseigne .env (voir .env.example).",
    );
  }
  return createClient<Database>(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: options?.detectSessionInUrl ?? false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(options?.storage ? { storage: options.storage as any } : {}),
    },
  });
}

/** Noms de canaux Realtime — partagés dashboard/mobile pour éviter les collisions. */
export const CHANNELS = {
  announcements: "public:announcements",
  prayerTimes: "public:prayer_times",
  contributions: "public:contributions",
  donations: "public:donations",
  events: "public:events",
} as const;
