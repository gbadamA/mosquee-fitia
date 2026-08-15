-- ============================================================================
-- Avancement des campagnes, exposé sans fuite de données individuelles.
--
-- Problème : la RLS de `donations` ne laisse un fidèle voir QUE ses propres dons.
-- Il ne peut donc pas calculer lui-même le total collecté par une campagne, et
-- l'app mobile ne pourrait afficher aucune jauge.
--
-- Solution : une fonction `security definer` qui ne renvoie que des AGRÉGATS
-- (identifiant de campagne + montant total). Aucun donateur, aucun montant
-- individuel ne transite. C'est le même patron que pour les rapports.
-- ============================================================================

create or replace function public.campaign_progress()
returns table (campaign_id uuid, collected bigint, donors bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    coalesce(sum(d.amount), 0)::bigint,
    count(distinct d.id)::bigint
  from public.campaigns c
  left join public.donations d
    on d.campaign_id = c.id
   and d.status = 'valide'
  group by c.id;
$$;

grant execute on function public.campaign_progress() to anon, authenticated, service_role;
