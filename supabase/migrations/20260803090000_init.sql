-- ============================================================================
-- Phase 0 — Socle Mosquée Fitia
-- Tables : mosque (paramètres), profiles (fidèles + rôles), announcements,
--          prayer_times (horaires publiés par l'imam).
-- Sécurité : RLS par rôle. Temps réel : announcements + prayer_times.
-- ============================================================================

-- ---------- Types --------------------------------------------------------
create type user_role as enum (
  'fidele',
  'secretaire',
  'tresorier',
  'imam',
  'admin'
);

create type member_status   as enum ('actif', 'en_attente', 'inactif');
create type member_category as enum ('membre_actif', 'bienfaiteur', 'staff');
create type announcement_category as enum ('info', 'khutba', 'evenement', 'urgent', 'collecte');

-- ---------- Paramètres de la mosquée (ligne unique) ----------------------
create table public.mosque (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  address         text,
  city            text,
  latitude        double precision,
  longitude       double precision,
  phone           text,
  whatsapp        text,
  logo_url        text,
  -- Personnalisation visuelle : surcharge les tokens brand côté client.
  primary_color   text not null default '#0B7A3B',
  secondary_color text not null default '#C9A227',
  singleton       boolean not null default true,
  created_at      timestamptz not null default now(),
  -- Garantit une seule ligne de paramètres.
  constraint mosque_singleton_unique unique (singleton)
);

insert into public.mosque (name, address, city, latitude, longitude)
values ('Mosquée Fitia (Petro Ivoire)', 'Abobo', 'Abidjan', 5.4167, -4.0167);

-- ---------- Profils (1-1 avec auth.users) --------------------------------
create sequence public.member_number_seq start 1;

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  full_name     text,
  phone         text,
  email         text,
  quartier      text,
  photo_url     text,
  member_number text unique
    default 'FIT-' || lpad(nextval('public.member_number_seq')::text, 5, '0'),
  role          user_role       not null default 'fidele',
  status        member_status   not null default 'en_attente',
  category      member_category not null default 'membre_actif',
  push_token    text,
  joined_at     timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index profiles_role_idx   on public.profiles (role);
create index profiles_status_idx on public.profiles (status);

-- Helper : rôle de l'utilisateur courant.
-- `security definer` + search_path figé → évite la récursion RLS sur profiles.
create or replace function public.auth_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

/** Vrai pour tout compte du personnel de la mosquée (accès back-office). */
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.auth_role() in ('secretaire', 'tresorier', 'imam', 'admin');
$$;

/** Vrai pour l'administration (imam / président). */
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.auth_role() in ('imam', 'admin');
$$;

-- ---------- Annonces (canal de diffusion dashboard -> mobile) ------------
create table public.announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (char_length(title) between 3 and 120),
  body       text not null check (char_length(body) between 1 and 2000),
  category   announcement_category not null default 'info',
  pinned     boolean not null default false,
  author_id  uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index announcements_created_at_idx on public.announcements (created_at desc);

-- ---------- Horaires de prière (publiés par l'imam) ----------------------
-- Une ligne par jour. Heures stockées en `text` HH:MM : ce sont les heures
-- d'iqama affichées par la mosquée, pas un instant UTC — pas de conversion.
create table public.prayer_times (
  id         uuid primary key default gen_random_uuid(),
  date       date not null unique,
  fajr       text not null check (fajr     ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  chourouk   text          check (chourouk ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  dhuhr      text not null check (dhuhr    ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  asr        text not null check (asr      ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  maghrib    text not null check (maghrib  ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  isha       text not null check (isha     ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  jumua      text          check (jumua    ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  note       text check (note is null or char_length(note) <= 280),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index prayer_times_date_idx on public.prayer_times (date desc);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.mosque        enable row level security;
alter table public.profiles      enable row level security;
alter table public.announcements enable row level security;
alter table public.prayer_times  enable row level security;

-- Mosquée : lisible par tous (y compris anonyme, pour l'écran d'accueil mobile).
create policy "mosque: lecture publique"
  on public.mosque for select to anon, authenticated using (true);
create policy "mosque: modif admin"
  on public.mosque for update to authenticated using (public.is_admin());

-- Profils : chacun lit/modifie le sien ; le staff lit tout ; l'admin modifie tout.
create policy "profil: lire le sien ou staff"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());

create policy "profil: modifier le sien"
  on public.profiles for update to authenticated
  using (id = auth.uid());

create policy "profil: modifier par admin"
  on public.profiles for update to authenticated
  using (public.is_admin());

-- Annonces — LECTURE : tout fidèle connecté.
create policy "annonces: lecture connectés"
  on public.announcements for select to authenticated using (true);

-- Annonces — ÉCRITURE : imam / admin / secrétaire.
create policy "annonces: diffusion staff"
  on public.announcements for insert to authenticated
  with check (public.auth_role() in ('imam', 'admin', 'secretaire'));

create policy "annonces: maj staff"
  on public.announcements for update to authenticated
  using (public.auth_role() in ('imam', 'admin', 'secretaire'));

create policy "annonces: suppression admin"
  on public.announcements for delete to authenticated
  using (public.is_admin());

-- Horaires — LECTURE publique (l'app affiche les horaires avant même le login).
create policy "horaires: lecture publique"
  on public.prayer_times for select to anon, authenticated using (true);

-- Horaires — ÉCRITURE : imam / admin uniquement.
create policy "horaires: publication imam"
  on public.prayer_times for insert to authenticated
  with check (public.is_admin());

create policy "horaires: maj imam"
  on public.prayer_times for update to authenticated
  using (public.is_admin());

create policy "horaires: suppression imam"
  on public.prayer_times for delete to authenticated
  using (public.is_admin());

-- ============================================================================
-- Realtime : le mobile s'abonne aux INSERT/UPDATE
-- ============================================================================
alter publication supabase_realtime add table public.announcements;
alter publication supabase_realtime add table public.prayer_times;

-- ---------- Création auto du profil à l'inscription ----------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, email)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.phone,
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
