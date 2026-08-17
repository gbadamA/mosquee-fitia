# syntax=docker/dockerfile:1
#
# Tableau de bord Mosquée Fitia — image pour Render (plan gratuit).
#
# ⚠️ LE CONTEXTE DE BUILD EST LA RACINE DU DÉPÔT, pas `apps/dashboard`.
# Le tableau de bord dépend de `packages/design-tokens`, `packages/shared` et
# `packages/supabase` : un contexte limité à `apps/dashboard` ne les verrait pas
# et la construction échouerait sur des imports `@fitia/*` introuvables.
# C'est `render.yaml` qui fixe `dockerContext: .`.

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# ────────────────────────────────────────────── construction ──
FROM base AS build

# Les manifestes AVANT le code : cette couche ne se reconstruit que si une
# dépendance change, pas à chaque commit.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/dashboard/package.json          apps/dashboard/
# ⚠️ Le manifeste du mobile est REQUIS même si l'app mobile n'est pas déployée :
# le lockfile le déclare comme membre de l'espace de travail, et `--frozen-lockfile`
# refuse d'installer si un membre manque.
COPY apps/mobile/package.json             apps/mobile/
COPY packages/design-tokens/package.json  packages/design-tokens/
COPY packages/shared/package.json         packages/shared/
COPY packages/supabase/package.json       packages/supabase/

# ⚠️ L'INSTALLATION DOIT AVOIR LIEU DANS L'ÉTAPE QUI CONSTRUIT.
# Tentation naturelle : installer dans une étape `deps` séparée puis copier le
# seul `/app/node_modules`. Ça échoue — pnpm place les liens vers les paquets
# d'espace de travail dans `apps/dashboard/node_modules`, pas uniquement à la
# racine. Sans eux, `tailwind.config.ts` ne résout pas
# `@fitia/design-tokens/tailwind-preset` et le build casse sur `globals.css`.
#
# `--filter dashboard...` = le tableau de bord ET ses dépendances d'espace de
# travail, rien de plus : Expo et React Native ne sont pas téléchargés.
#
# `--package-import-method=hardlink` neutralise le `copy` imposé par le `.npmrc`
# du dépôt : ce `copy` contourne un problème OneDrive PROPRE AU POSTE Windows,
# sans objet dans un conteneur Linux où il ne ferait que gonfler l'image.
RUN pnpm install --frozen-lockfile --filter dashboard... --package-import-method=hardlink

# Le code ensuite. `node_modules` est écarté par `.dockerignore`, donc cette
# copie n'écrase pas l'installation qui précède.
COPY . .

# ⚠️ Les variables `NEXT_PUBLIC_*` sont INSCRITES DANS LE BUNDLE au moment du
# build : elles doivent exister ICI, pas seulement à l'exécution. Les changer
# impose de RECONSTRUIRE le service, pas seulement de le redémarrer.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter dashboard build

# ──────────────────────────────────────────────── exécution ──
FROM base AS run
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Utilisateur non privilégié : rien dans ce service n'exige root.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# La sortie `standalone` reproduit l'arborescence du monorepo sous
# `.next/standalone`, d'où le chemin `apps/dashboard/server.js` au démarrage.
COPY --from=build --chown=nextjs:nodejs /app/apps/dashboard/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/apps/dashboard/.next/static      ./apps/dashboard/.next/static

USER nextjs

# Render impose le port par la variable PORT ; le serveur Next la lit.
# `HOSTNAME` à 0.0.0.0 est obligatoire : par défaut le serveur standalone
# n'écoute que sur localhost et Render le déclarerait en échec de santé.
ENV PORT=3031
ENV HOSTNAME=0.0.0.0
EXPOSE 3031

CMD ["node", "apps/dashboard/server.js"]
