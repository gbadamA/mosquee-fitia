-- Nouveau rôle : membre du staff de TERRAIN (2026-11-14).
--
-- Ceux qui tournent auprès des fidèles et appliquent les consignes du bureau.
-- Comptes créés par l'imam (Administration) ; connexion sur l'application mobile
-- seulement — pas d'accès au tableau de bord.
--
-- Migration isolée : une valeur d'enum ajoutée ne peut pas servir dans la même
-- transaction que son ajout.
alter type public.user_role add value if not exists 'membre_staff';
