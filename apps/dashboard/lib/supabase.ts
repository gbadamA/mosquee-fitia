"use client";

import { createSupabaseClient, type Client } from "@fitia/supabase";

let client: Client | null = null;

/** Client Supabase côté navigateur (singleton). */
export function getSupabase(): Client {
  if (client) return client;
  client = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    { detectSessionInUrl: true },
  );
  return client;
}

export const isSupabaseConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
