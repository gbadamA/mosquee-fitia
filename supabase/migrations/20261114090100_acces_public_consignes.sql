-- Application ouverte à tous + espace staff (2026-11-14).
--
--  1. Lecture publique (sans compte) : annonces, événements, campagnes.
--     Les horaires et la fiche mosquée l'étaient déjà.
--  2. Don déclaré sans compte : le trésorier valide, rien n'est compté avant.
--  3. Téléphones anonymes inscrits pour les notifications d'annonces.
--  4. Staff mobile (`membre_staff` + bureau) : annonces, événements, horaires.
--  5. Consignes du bureau vers le staff de terrain, suivies par destinataire.
--
-- ⚠️ `membre_staff` n'entre PAS dans `is_staff()` : cette fonction garde les
-- données du bureau (documents, inventaire, attestations, fidèles…).

-- ---------------------------------------------------------------- rôles
create or replace function public.is_mobile_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.auth_role() in ('membre_staff', 'secretaire', 'tresorier', 'imam', 'admin');
$$;

/** Membres du bureau : ceux qui donnent les consignes. */
create or replace function public.is_bureau()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.auth_role() in ('secretaire', 'tresorier', 'imam', 'admin');
$$;

grant execute on function public.is_mobile_staff() to anon, authenticated, service_role;
grant execute on function public.is_bureau()       to anon, authenticated, service_role;

-- ------------------------------------------------- 1. lecture publique
drop policy if exists "annonces: lecture connectés" on public.announcements;
create policy "annonces: lecture publique"
  on public.announcements for select to anon, authenticated using (true);

drop policy if exists "événements: lecture connectés" on public.events;
create policy "événements: lecture publique"
  on public.events for select to anon, authenticated using (true);

drop policy if exists "campagnes: lecture connectés" on public.campaigns;
create policy "campagnes: lecture publique"
  on public.campaigns for select to anon, authenticated using (true);

-- --------------------------------------- 4. écriture par le staff mobile
drop policy if exists "annonces: diffusion staff" on public.announcements;
create policy "annonces: diffusion staff"
  on public.announcements for insert to authenticated
  with check (public.auth_role() in ('imam', 'admin', 'secretaire', 'membre_staff'));

drop policy if exists "annonces: maj staff" on public.announcements;
create policy "annonces: maj staff"
  on public.announcements for update to authenticated
  using (public.auth_role() in ('imam', 'admin', 'secretaire', 'membre_staff'));

drop policy if exists "événements: écriture staff" on public.events;
create policy "événements: écriture staff"
  on public.events for insert to authenticated
  with check (public.auth_role() in ('secretaire', 'imam', 'admin', 'membre_staff'));

drop policy if exists "événements: maj staff" on public.events;
create policy "événements: maj staff"
  on public.events for update to authenticated
  using (public.auth_role() in ('secretaire', 'imam', 'admin', 'membre_staff'));

drop policy if exists "horaires: publication imam" on public.prayer_times;
create policy "horaires: publication imam"
  on public.prayer_times for insert to authenticated
  with check (public.auth_role() in ('imam', 'admin', 'membre_staff'));

drop policy if exists "horaires: maj imam" on public.prayer_times;
create policy "horaires: maj imam"
  on public.prayer_times for update to authenticated
  using (public.auth_role() in ('imam', 'admin', 'membre_staff'));

-- -------------------------------------------- 2. don sans compte
alter table public.donations
  add column if not exists donor_name  text,
  add column if not exists donor_phone text;

-- Un visiteur ne peut écrire QU'UNE déclaration en attente, à son nom
-- facultatif : ni validation, ni rattachement à un compte, ni justificatif
-- (le stockage des justificatifs reste réservé aux comptes).
create policy "dons: déclaration publique en attente"
  on public.donations for insert to anon
  with check (
    status = 'en_attente'
    and donor_id is null
    and validated_by is null
    and validated_at is null
    and proof_path is null
    and amount between 100 and 100000000
    and coalesce(length(donor_name), 0) <= 120
    and coalesce(length(donor_phone), 0) <= 30
    and coalesce(length(reference), 0) <= 80
  );
grant insert on public.donations to anon;

-- ------------------------------ 3. téléphones inscrits aux notifications
create table if not exists public.push_devices (
  token        text primary key,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
alter table public.push_devices enable row level security;
-- Aucune policy : personne ne lit ni n'écrit directement. L'inscription passe
-- par la fonction ci-dessous, la lecture par la fonction send-push (service_role).

create or replace function public.register_push_device(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.push_devices (token)
  select p_token
  where p_token like 'ExponentPushToken[%]' and length(p_token) <= 200
  on conflict (token) do update set last_seen_at = now();
$$;
grant execute on function public.register_push_device(text) to anon, authenticated;

-- ------------------------------------------------------- 5. consignes
create table if not exists public.consignes (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (length(title) between 3 and 160),
  body        text check (length(body) <= 4000),
  priority    text not null default 'normale' check (priority in ('normale', 'urgente')),
  due_date    date,
  -- null = adressée à TOUT le staff de terrain.
  assignee_id uuid references public.profiles (id) on delete set null,
  created_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists consignes_assignee_idx on public.consignes (assignee_id);

-- Suivi PAR destinataire : une consigne à tout le staff a un suivi par membre.
create table if not exists public.consigne_suivis (
  consigne_id uuid not null references public.consignes (id) on delete cascade,
  member_id   uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  status      text not null check (status in ('recue', 'faite')),
  report      text check (length(report) <= 2000),
  updated_at  timestamptz not null default now(),
  primary key (consigne_id, member_id)
);

alter table public.consignes       enable row level security;
alter table public.consigne_suivis enable row level security;

create policy "consignes: lecture destinataire ou bureau"
  on public.consignes for select to authenticated
  using (
    public.is_bureau()
    or (public.is_mobile_staff() and (assignee_id is null or assignee_id = auth.uid()))
  );
create policy "consignes: écriture bureau"
  on public.consignes for insert to authenticated with check (public.is_bureau());
create policy "consignes: maj bureau"
  on public.consignes for update to authenticated using (public.is_bureau());
create policy "consignes: suppression bureau"
  on public.consignes for delete to authenticated using (public.is_bureau());

create policy "suivis: lecture le sien ou bureau"
  on public.consigne_suivis for select to authenticated
  using (member_id = auth.uid() or public.is_bureau());
-- Un membre ne suit QUE ses propres consignes, et seulement celles qu'il voit.
create policy "suivis: le sien"
  on public.consigne_suivis for insert to authenticated
  with check (
    member_id = auth.uid()
    and exists (
      select 1 from public.consignes c
      where c.id = consigne_id and (c.assignee_id is null or c.assignee_id = auth.uid())
    )
  );
create policy "suivis: maj le sien"
  on public.consigne_suivis for update to authenticated
  using (member_id = auth.uid());

grant select, insert, update, delete on public.consignes       to authenticated;
grant select, insert, update         on public.consigne_suivis to authenticated;
revoke all on public.consignes, public.consigne_suivis, public.push_devices from anon;

-- Temps réel : une consigne apparaît sur le téléphone sans recharger.
do $$
begin
  alter publication supabase_realtime add table public.consignes;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.consigne_suivis;
exception when duplicate_object then null;
end $$;
