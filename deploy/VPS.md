# Mosquée Fitya sur le VPS FITYA (Contabo)

Mis en service le 2026-11-13, **base neuve**.

| Adresse | Service |
|---|---|
| <https://mosquee.fityalogisticgroup.com> | tableau de bord (bureau) |
| <https://api-mosquee.fityalogisticgroup.com> | Supabase auto-hébergé (application mobile, tableau de bord) |

Serveur `13.140.134.153`, accès `ssh fitya`. Tout vit dans `/opt/apps/mosquee` :

- `supabase/` — Supabase auto-hébergé, version de référence `self-hosted/v0.8.4`
  (`setup.sh` officiel), projet Compose **`mosquee-supabase`**, 11 conteneurs
  `supabase-*`. Adaptations FITYA dans `docker-compose.fitya.yml` (chargé par
  `COMPOSE_FILE` du `.env`) : **aucun port publié** (Docker contourne UFW : la base
  serait ouverte à tous) et passerelle `supabase-envoy` sur le réseau `web`.
  `.env` : inscriptions fermées (`DISABLE_SIGNUP=true`, les comptes sont créés par
  le bureau via `create-member`), téléphone désactivé, adresses publiques.
- `supabase/volumes/functions/` — `create-member` et `send-push` (copiés de
  `supabase/functions/`). Modifier une fonction = recopier puis
  `docker compose restart functions`.
- `migrations/` — les migrations appliquées à la main, dans l'ordre, par
  `psql -U postgres --single-transaction`. Une nouvelle migration s'applique de même.
- `app/` — ce dépôt ; `app/deploy/vps/` construit le tableau de bord
  (projet `mosquee-dashboard`), clé **anon** seulement.

Caddy (`/opt/proxy/sites/mosquee.caddy`) ne laisse passer que `/auth/v1`, `/rest/v1`,
`/realtime/v1`, `/storage/v1`, `/functions/v1`, `/graphql/v1`. Le **Studio** n'est
joignable que par tunnel :

    ssh fitya "docker run --rm -it --network mosquee-supabase_default -p 127.0.0.1:8000:8000 alpine/socat tcp-listen:8000,fork,reuseaddr tcp:supabase-envoy:8000"
    # puis, dans un 2e terminal : ssh -L 8000:127.0.0.1:8000 fitya  → http://localhost:8000

Identifiants du Studio : `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` de `supabase/.env`.

## Comptes

imam@ / tresorier@ / secretaire@fitia.ci, mots de passe aléatoires dans
`/opt/apps/mosquee/identifiants.secret` (600) et `identifiants-production.secret.md`
sur le poste (hors dépôt). ⚠️ Ne pas lancer `supabase/seed.sql` (données de démo).

## Application mobile

`apps/mobile/.env` : `EXPO_PUBLIC_SUPABASE_URL=https://api-mosquee.fityalogisticgroup.com`
et la clé anon ; la configuration locale est gardée dans `.env.dev-local`. Puis
`expo prebuild --platform android` et `gradlew assembleRelease`.

## Sauvegarde

`deploy/vps/sauvegarde.sh` à 3 h 00 (crontab de `deploy`) : base complète
(`pg_dump` de `supabase-db`) + fichiers (`supabase/volumes/storage`), 14 jours.
