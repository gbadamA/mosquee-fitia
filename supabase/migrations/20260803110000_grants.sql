-- ============================================================================
-- GRANTs de table pour les rôles Supabase.
-- RLS gouverne l'accès aux LIGNES ; ces GRANTs donnent l'accès aux TABLES.
-- (service_role bypasse la RLS mais a quand même besoin du GRANT.)
-- ============================================================================
grant usage on schema public to anon, authenticated, service_role;

grant select on all tables in schema public to anon;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

grant execute on function public.auth_role() to anon, authenticated, service_role;
grant execute on function public.is_staff()  to anon, authenticated, service_role;
grant execute on function public.is_admin()  to anon, authenticated, service_role;

-- Tables/séquences futures : mêmes droits par défaut.
alter default privileges in schema public
  grant select on tables to anon;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;
