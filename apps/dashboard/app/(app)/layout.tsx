"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Clock,
  Megaphone,
  MessagesSquare,
  Users,
  Wallet,
  CalendarDays,
  Target,
  FileText,
  FolderArchive,
  Stamp,
  Boxes,
  Wrench,
  UsersRound,
  ShieldCheck,
  LogOut,
  ShieldAlert,
  Moon,
  Sun,
  MonitorSmartphone,
} from "lucide-react";
import { ROLE_LABELS, type Role } from "@fitia/shared";
import { useAuth, DASHBOARD_ROLES } from "@/lib/auth";
import { useTheme, type ThemeMode } from "@/lib/theme";

const THEMES: { key: ThemeMode; label: string; icon: typeof Sun }[] = [
  { key: "light", label: "Clair", icon: Sun },
  { key: "dark", label: "Sombre", icon: Moon },
  { key: "system", label: "Système", icon: MonitorSmartphone },
];

const ALL: Role[] = ["secretaire", "tresorier", "imam", "admin"];
const ADMIN: Role[] = ["imam", "admin"];
const FINANCE: Role[] = ["tresorier", "imam", "admin"];
const COMM: Role[] = ["secretaire", "imam", "admin"];

const NAV: { href: string; label: string; icon: typeof Users; roles: Role[] }[] = [
  { href: "/", label: "Vue d'ensemble", icon: LayoutDashboard, roles: ALL },
  { href: "/horaires", label: "Horaires de prière", icon: Clock, roles: ADMIN },
  { href: "/annonces", label: "Diffusion", icon: Megaphone, roles: COMM },
  { href: "/communication", label: "Communication", icon: MessagesSquare, roles: COMM },
  { href: "/evenements", label: "Événements", icon: CalendarDays, roles: COMM },
  { href: "/fideles", label: "Fidèles", icon: Users, roles: ALL },
  { href: "/finances", label: "Finances", icon: Wallet, roles: FINANCE },
  { href: "/campagnes", label: "Campagnes", icon: Target, roles: FINANCE },
  { href: "/frequentation", label: "Fréquentation", icon: UsersRound, roles: ALL },
  { href: "/inventaire", label: "Inventaire", icon: Boxes, roles: COMM },
  { href: "/entretien", label: "Entretien", icon: Wrench, roles: COMM },
  { href: "/documents", label: "Documents", icon: FolderArchive, roles: ALL },
  { href: "/attestations", label: "Attestations", icon: Stamp, roles: COMM },
  { href: "/rapports", label: "Rapports", icon: FileText, roles: ALL },
  { href: "/administration", label: "Administration", icon: ShieldCheck, roles: ADMIN },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { session, profile, loading, signOut } = useAuth();
  const { mode, setMode } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  // Pas de session → login.
  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center text-light-muted dark:text-dark-muted">
        Chargement…
      </div>
    );
  }

  // Session mais rôle non autorisé (ex. un fidèle) → accès refusé.
  if (profile && !DASHBOARD_ROLES.includes(profile.role)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <ShieldAlert className="h-10 w-10 text-danger" />
        <h1 className="font-display text-h2">Accès réservé au bureau de la mosquée</h1>
        <p className="text-body text-light-muted dark:text-dark-muted">
          Votre compte n&apos;a pas les droits nécessaires pour le back-office.
        </p>
        <button
          onClick={signOut}
          className="mt-2 rounded-full border border-light-border px-5 py-2 text-body dark:border-dark-border"
        >
          Se déconnecter
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Menu latéral */}
      <aside className="hidden w-64 flex-col border-r border-light-border bg-light-surface p-4 dark:border-dark-border dark:bg-dark-surface md:flex print:hidden">
        <div className="mb-8 flex items-center gap-2.5 px-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-emerald">
            <Moon className="h-4 w-4 text-white" />
          </span>
          <span className="font-display text-lg font-bold leading-tight">
            Mosquée Fitia
            <span className="block text-[11px] font-normal text-light-muted dark:text-dark-muted">
              Petro Ivoire · Abobo
            </span>
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV.filter((n) => !profile || n.roles.includes(profile.role)).map(
            ({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-body transition ${
                    active
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-light-muted hover:bg-light-surface-alt dark:text-dark-muted dark:hover:bg-dark-surface-alt"
                  }`}
                >
                  <Icon className="h-4 w-4" /> {label}
                </Link>
              );
            },
          )}
        </nav>

        <div className="mt-4 border-t border-light-border pt-4 dark:border-dark-border">
          {/* Sélecteur de thème — sans lui, la moitié claire du design system serait morte. */}
          <div className="mb-4 flex gap-1 rounded-full bg-light-surface-alt p-1 dark:bg-dark-surface-alt">
            {THEMES.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setMode(key)}
                title={label}
                aria-label={`Thème ${label}`}
                aria-pressed={mode === key}
                className={`flex flex-1 items-center justify-center rounded-full py-1.5 transition ${
                  mode === key
                    ? "bg-light-surface text-primary shadow-sm dark:bg-dark-surface"
                    : "text-light-muted hover:text-primary dark:text-dark-muted"
                }`}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>

          <p className="px-3 text-body font-medium">{profile?.full_name ?? "Compte"}</p>
          <p className="mb-3 px-3 text-caption text-primary">
            {profile ? ROLE_LABELS[profile.role] : ""}
          </p>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-caption text-light-muted transition hover:text-danger dark:text-dark-muted"
          >
            <LogOut className="h-4 w-4" /> Se déconnecter
          </button>
        </div>
      </aside>

      <div className="flex-1">{children}</div>
    </div>
  );
}
