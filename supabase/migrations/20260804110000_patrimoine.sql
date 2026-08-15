-- ============================================================================
-- Patrimoine et vie matérielle de la mosquée (§2.6 et §2.7 du cahier d'origine).
--
--   documents          — statuts, procès-verbaux, contrats
--   assets             — inventaire des biens (tapis, sonorisation, véhicule…)
--   maintenance_tasks  — planification de l'entretien, adossée ou non à un bien
--   attendance_records — relevés de fréquentation, pour les statistiques
--
-- Tout est RÉSERVÉ AU PERSONNEL : un fidèle n'a aucune raison de voir les contrats
-- de la mosquée ni la valeur de son matériel.
-- ============================================================================

create type document_type as enum ('statuts', 'proces_verbal', 'contrat', 'facture', 'autre');

create type asset_category as enum (
  'tapis',
  'sonorisation',
  'mobilier',
  'vehicule',
  'informatique',
  'climatisation',
  'autre'
);

create type asset_condition as enum ('bon', 'moyen', 'mauvais', 'hors_service');

create type maintenance_kind as enum (
  'nettoyage',
  'climatisation',
  'sonorisation',
  'plomberie',
  'electricite',
  'batiment',
  'autre'
);

/** Périodicité d'une tâche d'entretien. `ponctuel` = pas de réarmement. */
create type maintenance_recurrence as enum (
  'ponctuel',
  'hebdomadaire',
  'mensuel',
  'trimestriel',
  'annuel'
);

/** Moment du relevé de fréquentation. */
create type attendance_moment as enum (
  'fajr',
  'dhuhr',
  'asr',
  'maghrib',
  'isha',
  'jumua',
  'evenement'
);

-- ---------- Documents ----------------------------------------------------
create table public.documents (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 3 and 160),
  type        document_type not null default 'autre',
  description text,
  /** Chemin dans le bucket Storage `documents`. */
  storage_path text not null,
  file_size    bigint check (file_size is null or file_size >= 0),
  uploaded_by  uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index documents_created_at_idx on public.documents (created_at desc);

-- ---------- Inventaire ---------------------------------------------------
create table public.assets (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(name) between 2 and 140),
  category      asset_category not null default 'autre',
  quantity      int not null default 1 check (quantity > 0),
  condition     asset_condition not null default 'bon',
  /** Valeur estimée EN FCFA, pour l'assurance et le rapport d'assemblée. */
  value_fcfa    bigint check (value_fcfa is null or value_fcfa >= 0),
  location      text,
  acquired_at   date,
  notes         text,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);

create index assets_category_idx on public.assets (category);

-- ---------- Entretien ----------------------------------------------------
create table public.maintenance_tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 3 and 160),
  kind        maintenance_kind not null default 'autre',
  /** Bien concerné, quand la tâche en vise un. */
  asset_id    uuid references public.assets (id) on delete set null,
  recurrence  maintenance_recurrence not null default 'ponctuel',
  due_on      date not null,
  last_done_on date,
  assignee    text,
  notes       text,
  done        boolean not null default false,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index maintenance_due_idx on public.maintenance_tasks (due_on);

-- ---------- Fréquentation ------------------------------------------------
create table public.attendance_records (
  id          uuid primary key default gen_random_uuid(),
  date        date not null default current_date,
  moment      attendance_moment not null,
  event_id    uuid references public.events (id) on delete set null,
  /** Nombre de fidèles comptés. */
  count       int not null check (count >= 0),
  recorded_by uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  -- Un seul relevé par date et par moment : re-saisir corrige au lieu d'empiler.
  unique (date, moment)
);

create index attendance_date_idx on public.attendance_records (date desc);

-- ============================================================================
-- Row Level Security — tout est réservé au personnel.
-- ============================================================================
alter table public.documents          enable row level security;
alter table public.assets             enable row level security;
alter table public.maintenance_tasks  enable row level security;
alter table public.attendance_records enable row level security;

-- Documents : lecture staff, écriture secrétaire/imam/admin, suppression admin.
create policy "documents: lecture staff"
  on public.documents for select to authenticated using (public.is_staff());
create policy "documents: écriture staff"
  on public.documents for insert to authenticated
  with check (public.auth_role() in ('secretaire', 'imam', 'admin'));
create policy "documents: suppression admin"
  on public.documents for delete to authenticated using (public.is_admin());

-- Inventaire et entretien : lecture staff, écriture secrétaire/imam/admin.
create policy "biens: lecture staff"
  on public.assets for select to authenticated using (public.is_staff());
create policy "biens: écriture staff"
  on public.assets for insert to authenticated
  with check (public.auth_role() in ('secretaire', 'imam', 'admin'));
create policy "biens: maj staff"
  on public.assets for update to authenticated
  using (public.auth_role() in ('secretaire', 'imam', 'admin'));
create policy "biens: suppression admin"
  on public.assets for delete to authenticated using (public.is_admin());

create policy "entretien: lecture staff"
  on public.maintenance_tasks for select to authenticated using (public.is_staff());
create policy "entretien: écriture staff"
  on public.maintenance_tasks for insert to authenticated
  with check (public.auth_role() in ('secretaire', 'imam', 'admin'));
create policy "entretien: maj staff"
  on public.maintenance_tasks for update to authenticated
  using (public.auth_role() in ('secretaire', 'imam', 'admin'));
create policy "entretien: suppression admin"
  on public.maintenance_tasks for delete to authenticated using (public.is_admin());

-- Fréquentation : lecture staff, saisie et correction par le staff.
create policy "fréquentation: lecture staff"
  on public.attendance_records for select to authenticated using (public.is_staff());
create policy "fréquentation: écriture staff"
  on public.attendance_records for insert to authenticated with check (public.is_staff());
create policy "fréquentation: maj staff"
  on public.attendance_records for update to authenticated using (public.is_staff());

-- ============================================================================
-- Stockage des documents — bucket PRIVÉ.
-- Les statuts et contrats de la mosquée ne doivent jamais être servis en public.
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "documents storage: lecture staff"
  on storage.objects for select to authenticated
  using (bucket_id = 'documents' and public.is_staff());

create policy "documents storage: dépôt staff"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and public.auth_role() in ('secretaire', 'imam', 'admin')
  );

create policy "documents storage: suppression admin"
  on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and public.is_admin());

-- Realtime pour l'entretien : une tâche cochée sur un poste se voit sur l'autre.
alter publication supabase_realtime add table public.maintenance_tasks;
