#!/bin/sh
# Sauvegarde quotidienne de la Mosquée Fitya (crontab de `deploy`) :
# la base Supabase (comptes, fidèles, finances…) ET les fichiers téléversés
# (documents, justificatifs). 14 jours gardés.
set -eu
cd "$(dirname "$0")"
mkdir -p sauvegardes
horo=$(date +%Y%m%d-%H%M)
docker exec supabase-db pg_dump -U postgres -d postgres -Fc -f "/tmp/mosquee-$horo.dump"
docker cp "supabase-db:/tmp/mosquee-$horo.dump" "sauvegardes/mosquee-$horo.dump"
docker exec supabase-db rm "/tmp/mosquee-$horo.dump"
tar -czf "sauvegardes/fichiers-$horo.tgz" -C /opt/apps/mosquee/supabase/volumes storage
find ./sauvegardes -name 'mosquee-*.dump' -mtime +14 -delete
find ./sauvegardes -name 'fichiers-*.tgz' -mtime +14 -delete
echo "$(date '+%F %T') sauvegarde mosquee-$horo"
