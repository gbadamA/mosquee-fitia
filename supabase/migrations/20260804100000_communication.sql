-- ============================================================================
-- Communication — journal des messages diffusés.
--
-- Sert à deux choses :
--   1. garder une trace de ce qui a été envoyé, à qui et par quel canal
--      (le cahier demande des « stats d'engagement ») ;
--   2. éviter les doublons de relance : on voit d'un coup d'œil si les
--      retardataires ont déjà été relancés ce mois-ci.
--
-- Le contenu n'est PAS lisible des fidèles : c'est un outil de bureau.
-- ============================================================================

create type message_channel  as enum ('push', 'whatsapp', 'sms');
create type message_audience as enum ('tous', 'retardataires', 'evenement');

create table public.message_log (
  id               uuid primary key default gen_random_uuid(),
  channel          message_channel not null,
  audience         message_audience not null default 'tous',
  /** Ciblage d'un événement précis quand `audience = 'evenement'`. */
  event_id         uuid references public.events (id) on delete set null,
  title            text not null check (char_length(title) between 3 and 140),
  body             text not null check (char_length(body) between 1 and 2000),
  /** Nombre de destinataires visés au moment de l'envoi. */
  recipients_count int not null default 0 check (recipients_count >= 0),
  /** Nombre d'envois réellement acceptés (renseigné pour le push). */
  delivered_count  int check (delivered_count is null or delivered_count >= 0),
  sent_by          uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now()
);

create index message_log_created_at_idx on public.message_log (created_at desc);

alter table public.message_log enable row level security;

-- Réservé au personnel : lecture ET écriture.
create policy "messages: lecture staff"
  on public.message_log for select to authenticated
  using (public.is_staff());

create policy "messages: écriture staff"
  on public.message_log for insert to authenticated
  with check (public.auth_role() in ('secretaire', 'imam', 'admin'));

alter publication supabase_realtime add table public.message_log;
