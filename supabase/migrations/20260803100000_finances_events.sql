-- ============================================================================
-- Finances (cotisations, dons, campagnes, dépenses) + Calendrier des événements
--
-- Modèle « preuve de paiement » : le fidèle déclare son versement Mobile Money
-- avec son numéro de transaction (statut `en_attente`) ; le trésorier valide au
-- dashboard (statut `valide`). Aucune API Mobile Money n'est appelée en V1.
-- ============================================================================

create type payment_method   as enum ('orange_money', 'mtn_money', 'wave', 'especes', 'virement');
create type payment_status   as enum ('en_attente', 'valide', 'rejete');
create type donation_type    as enum ('sadaqah', 'zakat', 'campagne');
create type expense_category as enum ('entretien', 'salaires', 'factures', 'evenement', 'travaux', 'autre');
create type event_type       as enum ('djouma', 'conference', 'aid', 'ramadan', 'janazah', 'cours', 'autre');

-- ---------- Campagnes de collecte ---------------------------------------
create table public.campaigns (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 3 and 120),
  description text,
  goal_amount bigint not null check (goal_amount > 0),
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz,
  active      boolean not null default true,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ---------- Cotisations (mensuelles / annuelles) -------------------------
create table public.contributions (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references public.profiles (id) on delete cascade,
  amount       bigint not null check (amount > 0),
  method       payment_method not null,
  status       payment_status not null default 'en_attente',
  -- Numéro de transaction Mobile Money : la preuve fournie par le fidèle.
  reference    text,
  -- Mois couvert, `YYYY-MM`.
  period       text not null check (period ~ '^\d{4}-\d{2}$'),
  validated_by uuid references public.profiles (id) on delete set null,
  validated_at timestamptz,
  created_at   timestamptz not null default now()
);

create index contributions_member_idx on public.contributions (member_id);
create index contributions_status_idx on public.contributions (status);

-- ---------- Dons (Sadaqah / Zakat / campagne) ----------------------------
create table public.donations (
  id           uuid primary key default gen_random_uuid(),
  -- null = don anonyme ou saisi au guichet.
  donor_id     uuid references public.profiles (id) on delete set null,
  campaign_id  uuid references public.campaigns (id) on delete set null,
  amount       bigint not null check (amount > 0),
  type         donation_type not null default 'sadaqah',
  method       payment_method not null,
  status       payment_status not null default 'en_attente',
  reference    text,
  anonymous    boolean not null default false,
  validated_by uuid references public.profiles (id) on delete set null,
  validated_at timestamptz,
  created_at   timestamptz not null default now()
);

create index donations_donor_idx    on public.donations (donor_id);
create index donations_campaign_idx on public.donations (campaign_id);
create index donations_status_idx   on public.donations (status);

-- ---------- Dépenses -----------------------------------------------------
create table public.expenses (
  id         uuid primary key default gen_random_uuid(),
  label      text not null check (char_length(label) between 3 and 140),
  amount     bigint not null check (amount > 0),
  category   expense_category not null default 'autre',
  spent_at   date not null default current_date,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index expenses_spent_at_idx on public.expenses (spent_at desc);

-- ---------- Événements ---------------------------------------------------
create table public.events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 3 and 140),
  description text,
  type        event_type not null default 'autre',
  location    text,
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  capacity    int check (capacity is null or capacity > 0),
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index events_starts_at_idx on public.events (starts_at);

create table public.event_registrations (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events (id) on delete cascade,
  member_id     uuid not null references public.profiles (id) on delete cascade,
  checked_in_at timestamptz,
  created_at    timestamptz not null default now(),
  unique (event_id, member_id)
);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.campaigns           enable row level security;
alter table public.contributions       enable row level security;
alter table public.donations           enable row level security;
alter table public.expenses            enable row level security;
alter table public.events              enable row level security;
alter table public.event_registrations enable row level security;

-- Campagnes : visibles de tous les fidèles (elles servent à collecter).
create policy "campagnes: lecture connectés"
  on public.campaigns for select to authenticated using (true);
create policy "campagnes: écriture trésorier/admin"
  on public.campaigns for insert to authenticated
  with check (public.auth_role() in ('tresorier', 'imam', 'admin'));
create policy "campagnes: maj trésorier/admin"
  on public.campaigns for update to authenticated
  using (public.auth_role() in ('tresorier', 'imam', 'admin'));

-- Cotisations : le fidèle voit et déclare LES SIENNES ; le trésorier voit tout et valide.
create policy "cotisations: lire les siennes ou trésorier"
  on public.contributions for select to authenticated
  using (member_id = auth.uid() or public.auth_role() in ('tresorier', 'imam', 'admin'));

create policy "cotisations: déclarer la sienne en attente"
  on public.contributions for insert to authenticated
  with check (
    (member_id = auth.uid() and status = 'en_attente')
    or public.auth_role() in ('tresorier', 'imam', 'admin')
  );

create policy "cotisations: validation trésorier"
  on public.contributions for update to authenticated
  using (public.auth_role() in ('tresorier', 'imam', 'admin'));

-- Dons : même logique. Un don anonyme reste lisible par son auteur tant qu'il est connecté.
create policy "dons: lire les siens ou trésorier"
  on public.donations for select to authenticated
  using (donor_id = auth.uid() or public.auth_role() in ('tresorier', 'imam', 'admin'));

create policy "dons: déclarer le sien en attente"
  on public.donations for insert to authenticated
  with check (
    (donor_id = auth.uid() and status = 'en_attente')
    or public.auth_role() in ('tresorier', 'imam', 'admin')
  );

create policy "dons: validation trésorier"
  on public.donations for update to authenticated
  using (public.auth_role() in ('tresorier', 'imam', 'admin'));

-- Dépenses : réservées au trésorier / administration (jamais visibles des fidèles).
create policy "dépenses: lecture trésorier/admin"
  on public.expenses for select to authenticated
  using (public.auth_role() in ('tresorier', 'imam', 'admin'));
create policy "dépenses: écriture trésorier/admin"
  on public.expenses for insert to authenticated
  with check (public.auth_role() in ('tresorier', 'imam', 'admin'));
create policy "dépenses: maj trésorier/admin"
  on public.expenses for update to authenticated
  using (public.auth_role() in ('tresorier', 'imam', 'admin'));
create policy "dépenses: suppression admin"
  on public.expenses for delete to authenticated using (public.is_admin());

-- Événements : lisibles par tous les connectés ; écrits par le staff.
create policy "événements: lecture connectés"
  on public.events for select to authenticated using (true);
create policy "événements: écriture staff"
  on public.events for insert to authenticated
  with check (public.auth_role() in ('secretaire', 'imam', 'admin'));
create policy "événements: maj staff"
  on public.events for update to authenticated
  using (public.auth_role() in ('secretaire', 'imam', 'admin'));

-- Inscriptions : chacun gère les siennes ; le staff voit tout et pointe les présences.
create policy "inscriptions: lire les siennes ou staff"
  on public.event_registrations for select to authenticated
  using (member_id = auth.uid() or public.is_staff());
create policy "inscriptions: s'inscrire soi-même"
  on public.event_registrations for insert to authenticated
  with check (member_id = auth.uid());
create policy "inscriptions: se désinscrire soi-même"
  on public.event_registrations for delete to authenticated
  using (member_id = auth.uid());
create policy "inscriptions: check-in staff"
  on public.event_registrations for update to authenticated
  using (public.is_staff());

-- ============================================================================
-- Realtime
-- ============================================================================
alter publication supabase_realtime add table public.contributions;
alter publication supabase_realtime add table public.donations;
alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.event_registrations;
alter publication supabase_realtime add table public.campaigns;

-- ---------- Seed de démonstration (dev) ---------------------------------
insert into public.campaigns (name, description, goal_amount, ends_at) values
  ('Réfection de la toiture', 'Collecte pour la rénovation de la toiture de la salle de prière.', 5000000, now() + interval '90 days'),
  ('Ramadan — Iftar collectif', 'Repas de rupture du jeûne offerts chaque soir.', 2000000, now() + interval '45 days');

insert into public.events (title, description, type, location, starts_at, capacity) values
  ('Prière du vendredi (Djouma)', 'Khutba puis prière collective.', 'djouma', 'Salle principale', date_trunc('week', now()) + interval '4 days 13 hours', null),
  ('Conférence : les mérites du Ramadan', 'Intervention de l''imam suivie de questions.', 'conference', 'Salle principale', now() + interval '10 days', 300),
  ('Cours de Tajwid', 'Ouvert aux adultes débutants.', 'cours', 'Salle annexe', now() + interval '3 days', 40);
