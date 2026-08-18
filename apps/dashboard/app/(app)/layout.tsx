"use client";

import { useEffect, useState } from "react";
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
  ChevronDown,
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

type NavItem = { href: string; label: string; icon: typeof Users; roles: Role[] };
type NavGroup = { key: string; label: string; icon: typeof Users; items: NavItem[] };

/** Page d'accueil : épinglée hors des catégories — la page la plus visitée ne
 *  mérite pas un clic de plus pour ouvrir un groupe avant de l'atteindre. */
const HOME: NavItem = { href: "/", label: "Vue d'ensemble", icon: LayoutDashboard, roles: ALL };

/**
 * Menu regroupé par catégorie (même principe que le tableau de bord
 * PREVENTIX 360) : chaque groupe se déplie, se filtre par rôle, et un groupe
 * sans page autorisée disparaît entièrement.
 */
const NAV_GROUPS: NavGroup[] = [
  {
    key: "communication",
    label: "Communication",
    icon: Megaphone,
    items: [
      { href: "/annonces", label: "Diffusion", icon: Megaphone, roles: COMM },
      { href: "/communication", label: "Communication", icon: MessagesSquare, roles: COMM },
      { href: "/evenements", label: "Événements", icon: CalendarDays, roles: COMM },
    ],
  },
  {
    key: "vie-mosquee",
    label: "Vie de la mosquée",
    icon: Clock,
    items: [
      { href: "/horaires", label: "Horaires de prière", icon: Clock, roles: ADMIN },
      { href: "/frequentation", label: "Fréquentation", icon: UsersRound, roles: ALL },
    ],
  },
  {
    key: "fideles-finances",
    label: "Fidèles & finances",
    icon: Wallet,
    items: [
      { href: "/fideles", label: "Fidèles", icon: Users, roles: ALL },
      { href: "/finances", label: "Finances", icon: Wallet, roles: FINANCE },
      { href: "/campagnes", label: "Campagnes", icon: Target, roles: FINANCE },
    ],
  },
  {
    key: "patrimoine",
    label: "Patrimoine",
    icon: Boxes,
    items: [
      { href: "/inventaire", label: "Inventaire", icon: Boxes, roles: COMM },
      { href: "/entretien", label: "Entretien", icon: Wrench, roles: COMM },
      { href: "/documents", label: "Documents", icon: FolderArchive, roles: ALL },
    ],
  },
  {
    key: "rapports-admin",
    label: "Rapports & administration",
    icon: FileText,
    items: [
      { href: "/attestations", label: "Attestations", icon: Stamp, roles: COMM },
      { href: "/rapports", label: "Rapports", icon: FileText, roles: ALL },
      { href: "/administration", label: "Administration", icon: ShieldCheck, roles: ADMIN },
    ],
  },
];

const STORAGE_KEY = "fitia_menu_groupes";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { session, profile, loading, signOut } = useAuth();
  const { mode, setMode } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  // Groupes explicitement ouverts/fermés par l'utilisateur (le reste suit la
  // page active — voir `estOuvert`). Lu depuis `localStorage` après le montage :
  // le rendu serveur n'a pas accès au stockage, mais `loading` vaut `true` des
  // deux côtés, donc rien ici ne s'affiche avant l'hydratation — pas de
  // scintillement possible.
  const [ouverts, setOuverts] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const brut = localStorage.getItem(STORAGE_KEY);
      if (brut) setOuverts(JSON.parse(brut));
    } catch {
      // Stockage indisponible : l'état des groupes ne survivra pas au rechargement.
    }
  }, []);

  // Pas de session → login.
  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [loading, session, router]);

  function estActif(href: string) {
    return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
  }

  function groupeContientActif(groupe: NavGroup) {
    return groupe.items.some((item) => estActif(item.href));
  }

  /** Un groupe est ouvert si l'utilisateur l'a choisi, sinon s'il contient la page active. */
  function estOuvert(groupe: NavGroup) {
    return ouverts[groupe.key] ?? groupeContientActif(groupe);
  }

  function basculerGroupe(groupe: NavGroup) {
    // Mise à jour fonctionnelle : `ouverts` capturé par fermeture serait celui
    // du rendu en cours, pas forcément le plus récent si React regroupe
    // plusieurs bascules dans le même lot (deux clics rapprochés sur des
    // groupes différents). Sans ça, le second clic écraserait le premier.
    setOuverts((precedent) => {
      const etaitOuvert = precedent[groupe.key] ?? groupeContientActif(groupe);
      const suivant = { ...precedent, [groupe.key]: !etaitOuvert };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(suivant));
      } catch {
        // Stockage indisponible : rien à faire, le choix ne persistera pas.
      }
      return suivant;
    });
  }

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

  const groupesVisibles = NAV_GROUPS.map((groupe) => ({
    ...groupe,
    items: groupe.items.filter((item) => !profile || item.roles.includes(profile.role)),
  })).filter((groupe) => groupe.items.length > 0);

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

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {(!profile || HOME.roles.includes(profile.role)) && (
            <Link
              href={HOME.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-body transition ${
                estActif(HOME.href)
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-light-muted hover:bg-light-surface-alt dark:text-dark-muted dark:hover:bg-dark-surface-alt"
              }`}
            >
              <HOME.icon className="h-4 w-4" /> {HOME.label}
            </Link>
          )}

          <p className="mb-1 mt-3 px-3 text-[11px] font-semibold uppercase tracking-wide text-light-muted dark:text-dark-muted">
            Catégories
          </p>

          {groupesVisibles.map((groupe) => {
            const ouvert = estOuvert(groupe);
            const contientActif = groupeContientActif(groupe);
            return (
              <div key={groupe.key}>
                <button
                  type="button"
                  onClick={() => basculerGroupe(groupe)}
                  aria-expanded={ouvert}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-body font-medium transition ${
                    !ouvert && contientActif
                      ? "text-primary"
                      : "text-light-text hover:bg-light-surface-alt dark:text-dark-text dark:hover:bg-dark-surface-alt"
                  }`}
                >
                  <groupe.icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 truncate">{groupe.label}</span>
                  {!ouvert && contientActif && (
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                      aria-hidden="true"
                    />
                  )}
                  <ChevronDown
                    className={`h-3.5 w-3.5 shrink-0 text-light-muted transition-transform dark:text-dark-muted ${
                      ouvert ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {ouvert && (
                  <div className="menu-groupe__corps ml-[1.05rem] flex flex-col gap-0.5 border-l border-light-border py-0.5 pl-2.5 dark:border-dark-border">
                    {groupe.items.map((item) => {
                      const active = estActif(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-center gap-3 rounded-md px-3 py-2 text-body transition ${
                            active
                              ? "bg-primary/10 font-medium text-primary"
                              : "text-light-muted hover:bg-light-surface-alt dark:text-dark-muted dark:hover:bg-dark-surface-alt"
                          }`}
                        >
                          <item.icon className="h-4 w-4" /> {item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
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
