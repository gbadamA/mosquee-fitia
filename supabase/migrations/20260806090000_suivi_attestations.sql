-- ============================================================================
-- 1. Suivi daté des biens  2. Attestations délivrées par la mosquée
-- ============================================================================

-- ---------------------------------------------------------------- Biens ----
/**
 * Journal d'un bien : acquisition, contrôle, réparation, déplacement, sortie.
 * Sans lui, l'inventaire ne dit que l'état ACTUEL — on ne sait ni depuis quand
 * la sonorisation est en panne, ni combien elle a déjà coûté en réparations.
 */
create type asset_event_type as enum (
  'acquisition',
  'controle',
  'reparation',
  'deplacement',
  'changement_etat',
  'sortie',
  'autre'
);

create table public.asset_events (
  id              uuid primary key default gen_random_uuid(),
  asset_id        uuid not null references public.assets (id) on delete cascade,
  type            asset_event_type not null default 'autre',
  occurred_on     date not null default current_date,
  note            text,
  /** État constaté APRÈS l'intervention, quand elle en change un. */
  condition_after asset_condition,
  /** Coût de l'intervention en FCFA, pour le cumul d'entretien d'un bien. */
  cost_fcfa       bigint check (cost_fcfa is null or cost_fcfa >= 0),
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now()
);

create index asset_events_asset_idx on public.asset_events (asset_id, occurred_on desc);

alter table public.asset_events enable row level security;

create policy "suivi biens: lecture staff"
  on public.asset_events for select to authenticated using (public.is_staff());
create policy "suivi biens: écriture staff"
  on public.asset_events for insert to authenticated
  with check (public.auth_role() in ('secretaire', 'imam', 'admin'));
create policy "suivi biens: suppression admin"
  on public.asset_events for delete to authenticated using (public.is_admin());

/**
 * Un changement d'état saisi directement dans le tableau doit laisser une trace :
 * sinon l'historique aurait des trous exactement là où il est le plus utile.
 */
create or replace function public.log_asset_condition_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.condition is distinct from old.condition then
    insert into public.asset_events (asset_id, type, note, condition_after, created_by)
    values (
      new.id,
      'changement_etat',
      format('État passé de « %s » à « %s »', old.condition, new.condition),
      new.condition,
      auth.uid()
    );
  end if;
  return new;
end;
$$;

create trigger on_asset_condition_change
  after update of condition on public.assets
  for each row execute function public.log_asset_condition_change();

-- ----------------------------------------------------------- Attestations ---
/**
 * Documents délivrés PAR la mosquée (à distinguer de `documents`, qui archive
 * ce qu'elle reçoit). Les champs propres à chaque type vivent dans `data` :
 * une attestation de mariage n'a rien en commun avec une attestation de don,
 * et figer 20 colonnes nullables serait pire que du JSON.
 */
create type attestation_type as enum (
  'mariage',
  'adhesion',
  'don',
  'residence',
  'bonne_moralite',
  'autre'
);

create sequence public.attestation_number_seq start 1;

create table public.attestations (
  id         uuid primary key default gen_random_uuid(),
  type       attestation_type not null default 'autre',
  /** Numéro lisible et unique, cité sur le document délivré. */
  reference  text not null unique
    default 'ATT-' || to_char(now(), 'YYYY') || '-'
            || lpad(nextval('public.attestation_number_seq')::text, 4, '0'),
  /** Fidèle concerné, quand l'attestation en vise un. */
  member_id  uuid references public.profiles (id) on delete set null,
  /** Nom porté sur le document : permet de délivrer à un non-adhérent. */
  subject    text not null check (char_length(subject) between 2 and 160),
  /** Champs propres au type : époux/épouse/témoins pour un mariage, etc. */
  data       jsonb not null default '{}'::jsonb,
  issued_on  date not null default current_date,
  issued_by  uuid references public.profiles (id) on delete set null,
  /** Une attestation annulée reste tracée, elle n'est jamais supprimée. */
  cancelled  boolean not null default false,
  created_at timestamptz not null default now()
);

create index attestations_created_at_idx on public.attestations (created_at desc);
create index attestations_member_idx on public.attestations (member_id);

alter table public.attestations enable row level security;

-- Le personnel délivre et consulte. Un fidèle voit les siennes.
create policy "attestations: lecture staff ou concerné"
  on public.attestations for select to authenticated
  using (public.is_staff() or member_id = auth.uid());
create policy "attestations: délivrance staff"
  on public.attestations for insert to authenticated
  with check (public.auth_role() in ('secretaire', 'imam', 'admin'));
create policy "attestations: annulation staff"
  on public.attestations for update to authenticated
  using (public.auth_role() in ('secretaire', 'imam', 'admin'));
