-- ============================================================================
-- Seed de développement — horaires de prière de la semaine.
-- Rejoué à chaque `supabase db reset`. Les comptes de test sont créés par
-- `scripts-verif/seed-accounts.mjs` (ils passent par l'API Auth, pas par SQL).
-- ============================================================================

-- Horaires indicatifs pour Abidjan (fuseau GMT). L'imam les corrige au dashboard.
insert into public.prayer_times (date, fajr, chourouk, dhuhr, asr, maghrib, isha, jumua)
select
  d::date,
  '05:15', '06:25', '12:25', '15:40', '18:25', '19:35',
  case when extract(dow from d) = 5 then '13:00' else null end
from generate_series(current_date - interval '1 day', current_date + interval '7 days', interval '1 day') as d
on conflict (date) do nothing;

insert into public.announcements (title, body, category, pinned) values
  ('Khutba du vendredi', 'Thème : la patience (as-sabr) dans les épreuves. Prière à 13h00, merci d''arriver 15 minutes en avance.', 'khutba', true),
  ('Collecte pour la toiture', 'La collecte pour la réfection de la toiture est ouverte. Vous pouvez contribuer depuis l''application.', 'collecte', false),
  ('Horaires du Ramadan', 'Les horaires seront ajustés dès le premier jour du mois béni. Restez attentifs aux notifications.', 'info', false)
on conflict do nothing;
