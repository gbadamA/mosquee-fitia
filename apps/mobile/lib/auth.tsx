import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { MOBILE_STAFF_ROLES, type Profile } from "@fitia/shared";
import { supabase } from "./supabase";
import { registerDevicePush, registerPushToken } from "./push";

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  session: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Depuis le 2026-11-14 seul le STAFF se connecte : une ancienne session de
   * fidèle restée sur un téléphone est fermée, l'application reste ouverte en
   * accès libre.
   */
  async function loadProfile(userId: string) {
    if (!supabase) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
    const p = (data as Profile) ?? null;
    if (!p || !MOBILE_STAFF_ROLES.includes(p.role)) {
      await supabase.auth.signOut();
      setProfile(null);
      return;
    }
    setProfile(p);
    registerPushToken(userId).catch(() => {});
  }

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    // Tout téléphone reçoit les annonces, connecté ou non.
    registerDevicePush().catch(() => {});
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) await loadProfile(data.session.user.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) loadProfile(s.user.id);
      else setProfile(null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        refreshProfile: async () => {
          if (session) await loadProfile(session.user.id);
        },
        signOut: async () => {
          await supabase?.auth.signOut();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
