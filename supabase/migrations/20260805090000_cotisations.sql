-- ============================================================================
-- Cotisations périodiques + justificatifs de paiement.
--
-- Deux besoins distincts :
--   1. Le fidèle joint une PREUVE (photo du reçu Mobile Money) à sa déclaration ;
--      le trésorier la consulte avant de confirmer.
--   2. La cotisation est PÉRIODIQUE : le système doit savoir quels mois sont dus,
--      cumuler les arriérés et relancer dès l'entrée dans un nouveau mois.
--
-- Le montant de référence vit dans `mosque` : une mosquée fixe un montant, pas
-- un par fidèle. Le point de départ des cotisations d'un fidèle est son adhésion
-- (`profiles.joined_at`) — on ne réclame pas les mois antérieurs à son arrivée.
-- ============================================================================

-- ---------- Montant et jour de référence ---------------------------------
alter table public.mosque
  add column contribution_amount bigint not null default 1000
    check (contribution_amount >= 0),
  -- Jour du mois où la cotisation est attendue : sert au libellé du rappel.
  add column contribution_due_day int not null default 5
    check (contribution_due_day between 1 and 28);

comment on column public.mosque.contribution_amount is
  'Montant mensuel de référence en FCFA. Un mois est couvert quand la somme des cotisations VALIDÉES de ce mois atteint ce montant.';

-- ---------- Justificatifs -------------------------------------------------
-- Chemin dans le bucket `justificatifs`. Nullable : une saisie au guichet par le
-- trésorier n'a pas de pièce jointe, l'argent est déjà en main.
alter table public.contributions add column proof_path text;
alter table public.donations     add column proof_path text;

-- ============================================================================
-- Stockage des justificatifs — bucket PRIVÉ.
-- Convention de chemin : `<uid du fidèle>/<uuid>.<ext>`.
-- Le premier segment porte la propriété, ce qui permet une policy simple.
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'justificatifs',
  'justificatifs',
  false,
  5242880, -- 5 Mo : une photo de reçu, pas un scan haute définition
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- Dépôt : le fidèle ne peut écrire QUE dans son propre dossier.
create policy "justificatifs: dépôt par le propriétaire"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'justificatifs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Lecture : son propre justificatif, ou n'importe lequel pour la trésorerie.
create policy "justificatifs: lecture propriétaire ou trésorerie"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'justificatifs'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.auth_role() in ('tresorier', 'imam', 'admin')
    )
  );

create policy "justificatifs: suppression admin"
  on storage.objects for delete to authenticated
  using (bucket_id = 'justificatifs' and public.is_admin());

-- ============================================================================
-- Arriérés de cotisation, exposés sans fuite de données individuelles.
--
-- Un fidèle ne voit que SES cotisations (RLS) : il peut donc calculer ses propres
-- arriérés côté client. Le dashboard, lui, a besoin du décompte pour TOUS les
-- fidèles d'un coup — d'où cette fonction, qui ne renvoie que des agrégats.
--
-- Règle : un mois est « couvert » quand la somme des cotisations validées de ce
-- mois atteint le montant de référence. Les versements partiels s'additionnent.
-- ============================================================================
create or replace function public.contribution_arrears()
returns table (
  member_id uuid,
  months_due int,
  amount_due bigint,
  oldest_unpaid text
)
language sql
stable
security definer
set search_path = public
as $$
  with reference as (
    select contribution_amount from public.mosque limit 1
  ),
  -- Tous les mois attendus de chaque fidèle : de son adhésion au mois courant.
  attendus as (
    select
      p.id as member_id,
      to_char(mois, 'YYYY-MM') as periode
    from public.profiles p
    cross join lateral generate_series(
      date_trunc('month', p.joined_at),
      date_trunc('month', now()),
      interval '1 month'
    ) as mois
    where p.role = 'fidele'
  ),
  -- Ce qui a été effectivement encaissé, mois par mois.
  regles as (
    select c.member_id, c.period, sum(c.amount) as total
    from public.contributions c
    where c.status = 'valide'
    group by c.member_id, c.period
  )
  select
    a.member_id,
    count(*)::int,
    (count(*) * (select contribution_amount from reference))::bigint,
    min(a.periode)
  from attendus a
  left join regles r
    on r.member_id = a.member_id and r.period = a.periode
  where coalesce(r.total, 0) < (select contribution_amount from reference)
  group by a.member_id;
$$;

grant execute on function public.contribution_arrears() to authenticated, service_role;
