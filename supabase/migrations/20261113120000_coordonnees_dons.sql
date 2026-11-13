-- Coordonnées de dons de la mosquée, modifiables par le bureau (Administration).
--
-- Elles vivent dans `mosque` et non dans le code : un numéro qui change ne doit
-- pas exiger une nouvelle version de l'application.
--
-- Sources (2026-11-13) :
--   * lien Wave : DÉCODÉ depuis l'autocollant « Donnez avec Wave » de la mosquée
--     (scan CamScanner). Le QR de l'affiche « Notre mosquée a besoin de vous »
--     est illisible (image retouchée) : il ne fait PAS foi.
--   * numéros Mobile Money et coordonnées BNI : affiche de la campagne.
--     IBAN contrôlé par sa clé ISO 13616 (valide, cohérent avec code banque,
--     guichet, compte et clé RIB).

alter table public.mosque
  add column if not exists wave_payment_url    text,
  add column if not exists mtn_money_number    text,
  add column if not exists orange_money_number text,
  add column if not exists bank_name           text,
  add column if not exists bank_code           text,
  add column if not exists bank_branch_code    text,
  add column if not exists bank_account_number text,
  add column if not exists bank_rib_key        text,
  add column if not exists bank_iban           text,
  add column if not exists bank_swift          text,
  add column if not exists bank_address        text;

-- Un lien Wave qui ne mènerait pas chez Wave enverrait les dons ailleurs :
-- seul un lien de paiement Wave est accepté.
alter table public.mosque drop constraint if exists mosque_wave_payment_url_check;
alter table public.mosque add constraint mosque_wave_payment_url_check
  check (wave_payment_url is null or wave_payment_url ~ '^https://pay\.wave\.com/');

update public.mosque set
  wave_payment_url    = coalesce(wave_payment_url, 'https://pay.wave.com/mqr-tc/mqr-20hg7p3r82spa'),
  mtn_money_number    = coalesce(mtn_money_number, '0505707000'),
  orange_money_number = coalesce(orange_money_number, '0747008383'),
  bank_name           = coalesce(bank_name, 'Banque Nationale d''Investissement (BNI)'),
  bank_code           = coalesce(bank_code, 'CI092'),
  bank_branch_code    = coalesce(bank_branch_code, '01010'),
  bank_account_number = coalesce(bank_account_number, '006778510007'),
  bank_rib_key        = coalesce(bank_rib_key, '56'),
  bank_iban           = coalesce(bank_iban, 'CI93 CI09 2010 1000 6778 5100 0756'),
  bank_swift          = coalesce(bank_swift, 'CSSSCIABXXX'),
  bank_address        = coalesce(bank_address, 'Abobo Centre Petro Ivoire, 13 BP 72, 0225 Abidjan 13, Côte d''Ivoire');
