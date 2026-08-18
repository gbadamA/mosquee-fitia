# Mosquée Fitia — système de gestion

Application mobile (fidèles) + dashboard web (bureau de la mosquée), adossés à Supabase.
Architecture reprise du projet `asso-jeunes`, direction artistique « vert islamique & or ».

- 🗺️ **`claudemap.md`** — carte maîtresse : stack, DA, modèle de données, roadmap, conventions.
- 📋 **`cahier-des-charges.md`** — spec fonctionnelle.

---

## Démarrage

### 1. Dépendances

```bash
pnpm install
```

Puis, une seule fois, aligner les versions natives Expo (**ne jamais les corriger à la main**) :

```bash
pnpm --filter mobile fix
```

### 2. Backend Supabase (local)

```bash
supabase start
```

Les ports sont décalés en **5413x** (54131 API, 54133 Studio) — voir `supabase/config.toml`.
Appliquer migrations + seed :

```bash
supabase db reset
```

Régénérer les types TypeScript depuis la vraie base (le fichier livré est écrit à la main) :

```bash
pnpm db:types
```

### 3. Variables d'environnement

Copier les exemples et coller la `anon key` affichée par `supabase start` :

```bash
cp apps/dashboard/.env.example apps/dashboard/.env.local
cp apps/mobile/.env.example apps/mobile/.env
```

⚠️ Le téléphone n'atteint pas `127.0.0.1` du PC : dans `apps/mobile/.env`, utiliser l'**IP LAN**
de la machine (`ipconfig` → adresse IPv4 du Wi-Fi), par exemple `http://192.168.1.10:54131`.

### 4. Lancer

```bash
pnpm dashboard        # http://localhost:3031
pnpm mobile           # QR code -> Expo Go sur téléphone réel
```

### 5. Comptes de test

```bash
node scripts-verif/seed-accounts.mjs
```

| Compte | Identifiants | Rôle |
|---|---|---|
| Imam | `imam@fitia.ci` / `fitia1234` | accès complet |
| Trésorier | `tresorier@fitia.ci` / `fitia1234` | finances |
| Secrétaire | `secretaire@fitia.ci` / `fitia1234` | fidèles, diffusion |
| Fidèle (mobile) | `+22507000000` + mot de passe `fitia1234` | app mobile |

### 6. Connexion des fidèles — numéro + mot de passe

⚠️ **Il n'y a plus de code par SMS.** La mosquée n'a pas de fournisseur SMS :
un OTP n'enverrait aucun code et **personne** ne pourrait se connecter.

Le circuit réel est donc celui-ci :

1. Le secrétaire enregistre le fidèle dans **Fidèles → Nouveau fidèle**.
2. Le dashboard affiche **une seule fois** un mot de passe engendré par le serveur.
3. Le secrétaire le note et le remet au fidèle, qui l'a en face de lui — la
   vérification du numéro a lieu **physiquement**, au lieu d'un SMS.
4. Oubli ou fidèle enregistré avant ce changement : ouvrir sa fiche →
   **Émettre un mot de passe**. Supabase ne stocke qu'un haché, un mot de passe
   perdu ne se retrouve pas, il ne peut qu'être remplacé.

L'alphabet des mots de passe exclut `0/O` et `1/I/l` : ils sont dictés à voix
haute et recopiés à la main.

**Revenir à l'OTP** le jour où un fournisseur SMS sera souscrit : le parcours
complet (envoi du code + écran `verify.tsx`) est dans l'historique git, commit
`db27816` et ses parents.

---

## Vérifier la diffusion temps réel

C'est la colonne vertébrale du produit — à tester en premier :

1. Ouvrir le mobile sur l'onglet **Prières**.
2. Sur le dashboard, aller dans **Horaires de prière**, changer une heure du jour, publier.
3. L'écran mobile doit se mettre à jour **sans rafraîchissement**.

Même test avec **Diffusion** → l'annonce apparaît en direct dans l'onglet **Annonces**.

---

## Hébergement — Render (plan gratuit)

⚠️ **Ce déploiement ne ressemble pas à celui de HadjChanges, et c'est normal.**
HadjChanges héberge une API NestJS qu'il faut faire tourner quelque part. Ici,
**Supabase EST le backend** : il n'y a pas d'API à héberger.

| Composant | Où |
|---|---|
| Tableau de bord Next.js | **Render** (`render.yaml`, plan gratuit) |
| Base, Auth, Realtime, Storage | **Supabase Cloud** (plan gratuit) |
| Edge Functions `create-member`, `send-push` | **Supabase**, pas Render |
| Application mobile | build **EAS** — aucun serveur web |

### 1. Le projet Supabase Cloud

Projet créé sur le **second compte Supabase** de l'utilisateur (décision du 2026-08-18) :

| | |
|---|---|
| Référence du projet | `rjumgzqcqbdukvgnfyok` |
| Région | `eu-central-1` (Francfort) |
| URL de l'API | `https://rjumgzqcqbdukvgnfyok.supabase.co` |

> ✅ La région colle à celle du service Render (`frankfurt`) : le tableau de bord
> et la base sont dans le même datacenter, la latence reste minimale.

#### ⚠️ `DATABASE_URL` / `DIRECT_URL` ne servent PAS à ce projet

Les deux chaînes de connexion proposées par Supabase (onglet **Connect → ORMs**)
s'adressent à Prisma, Drizzle ou TypeORM. **Ce projet n'en utilise aucun** : il
parle à Supabase en HTTP via `@supabase/supabase-js`, et les migrations passent
par le CLI. Il n'existe aucune variable `DATABASE_URL` dans le dépôt — inutile
d'en déclarer une chez Render, elle ne serait jamais lue.

Ce dont l'application a besoin, ce sont uniquement l'**URL du projet** et la
**clé `anon`** (Project Settings → API).

La `DIRECT_URL` garde toutefois une utilité ponctuelle : voir l'encadré IPv6 ci-dessous.

#### Pousser le schéma

```bash
npx supabase@latest link --project-ref rjumgzqcqbdukvgnfyok
```

```bash
npx supabase@latest db push
```

> 💡 **Si `db push` échoue en « connection refused » / « network unreachable »** :
> les connexions directes à Postgres sont en **IPv6**, que beaucoup de FAI ne
> routent pas. C'est là que sert la `DIRECT_URL` (pooler en mode session, IPv4,
> port **5432** — surtout pas 6543, le mode transaction ne sait pas exécuter de
> migrations) :
>
> ```bash
> npx supabase@latest db push --db-url "postgresql://postgres.rjumgzqcqbdukvgnfyok:MOT_DE_PASSE@aws-0-eu-central-1.pooler.supabase.com:5432/postgres"
> ```
>
> ⛔ Ne jamais écrire ce mot de passe dans un fichier du dépôt.

#### Déployer les fonctions serveur

```bash
npx supabase@latest functions deploy create-member send-push
```

Ce sont les deux seules fonctions du projet. `create-member` est
**indispensable** : sans elle, impossible de créer un fidèle ni d'émettre un
mot de passe, donc personne ne peut se connecter à l'application mobile.

### ⛔ BLOCAGE CONNU : la connexion par téléphone exige un fournisseur SMS *déclaré*

**Mesuré le 2026-08-18, pas supposé.** En passant `[auth.sms.twilio] enabled = false`
dans `config.toml` puis en redémarrant la stack locale, `signInWithPassword({phone})`
répond :

```
Phone logins are disabled
```

Autrement dit : le bloc Twilio en placeholder n'est **pas** décoratif — c'est lui qui
ouvre le canal téléphone. Supabase n'active la connexion par téléphone que si un
fournisseur SMS est déclaré, **même quand aucun SMS n'est jamais envoyé** (ce qui est
notre cas : mot de passe, pas OTP).

Conséquence pour le projet Cloud : il faudra soit déclarer un fournisseur SMS (un
compte Twilio d'essai suffit — aucun SMS ne partant jamais, il ne sera pas facturé),
soit changer d'identifiant d'authentification. **À trancher avant `config push`.**

⚠️ Et surtout : **ne pas lancer `supabase config push` tel quel**. Il enverrait vers la
production le bloc Twilio en placeholder *et* le numéro de test `[auth.sms.test_otp]`.

### 2. Créer le premier compte du bureau

⚠️ **Sans cette étape, personne ne peut entrer.** L'Edge Function `create-member`
exige un appelant déjà imam/admin ; sur une base neuve il n'en existe aucun.
Le seul moyen d'amorcer est le script de seed, qui utilise la clé `service_role`
(elle ignore la RLS) :

```bash
SUPABASE_URL=https://rjumgzqcqbdukvgnfyok.supabase.co SUPABASE_SERVICE_ROLE_KEY="<service_role>" SEED_PASSWORD="<mot de passe fort>" node scripts-verif/seed-accounts.mjs
```

Le script **refuse de s'exécuter** sur une instance non locale sans `SEED_PASSWORD` :
le mot de passe par défaut (`fitia1234`) est publié dans ce README, il laisserait
les comptes du bureau ouverts à qui l'a lu. Le fidèle de test `+22507000000` n'est
créé qu'en local.

⛔ La clé `service_role` contourne toute la sécurité : jamais dans le dépôt, jamais
chez Render, jamais dans un bundle client. Elle ne sert qu'à cette commande.

Ensuite, tout se fait depuis l'interface : le compte imam crée les autres comptes
du bureau (Administration) et les fidèles (Fidèles).

### 3. Déployer le tableau de bord sur Render

Sur [render.com](https://render.com) → **New → Blueprint**, pointer le dépôt
`gbadamA/mosquee-fitia`. Render lit `render.yaml` et crée le service.

Renseigner ensuite les deux secrets dans l'interface Render
(**Project Settings → API** côté Supabase) :

| Variable | Valeur |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://rjumgzqcqbdukvgnfyok.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la clé `anon` / `public` du projet |

⛔ **Ne pas ajouter `DATABASE_URL` ni `DIRECT_URL` chez Render** : rien ne les lit
(voir plus haut), et y coller le mot de passe Postgres l'exposerait sans raison.

⚠️ Ces deux valeurs sont **inscrites dans le bundle à la construction**. Les
modifier impose de **reconstruire** le service — un redémarrage ne suffit pas.

### 4. Ce que le plan gratuit implique

- **Ne créez PAS de PostgreSQL chez Render.** Le gratuit expire et emporte les
  données — c'est ce qui a mis PREVENTIX 360 hors service. La base reste chez Supabase.
- **Le service s'endort** après ~15 min sans trafic et met ~50 s à se réveiller.
  Le bureau verra une première page lente après une pause ; aucune donnée n'est
  en jeu, tout est chez Supabase.
- **Le disque est éphémère** — sans conséquence ici : le tableau de bord n'écrit
  rien localement, les justificatifs vont dans Supabase Storage.

### 5. À faire avant la mise en service réelle

- [x] ~~Retirer le contournement de connexion~~ — `dev-login` et le code client
      supprimés le 2026-08-08 ; il n'existe plus qu'un seul chemin de connexion
- [x] ~~Rendre la connexion possible sans fournisseur SMS~~ — passage au
      **numéro + mot de passe** le 2026-08-17 (voir « Connexion des fidèles »).
      Aucun fournisseur SMS n'est donc requis pour la mise en service.
- [ ] *(facultatif)* Revenir à l'OTP si un fournisseur SMS est un jour souscrit :
      Supabase Cloud → **Authentication → Providers → Phone** (Twilio, Vonage…),
      puis restaurer le parcours depuis le commit `db27816`.
- [ ] **Émettre un mot de passe pour les fidèles déjà enregistrés** — ceux créés
      avant le 2026-08-17 n'en ont aucun. Fiche du fidèle → *Émettre un mot de passe*.
      (Sans objet si la base Cloud part de zéro : les 9 profils de test ne vivent
      que dans la stack locale, `db push` ne pousse que le schéma, pas les données.)
- [ ] Pointer `apps/mobile/.env` sur `https://rjumgzqcqbdukvgnfyok.supabase.co`,
      puis **reconstruire** (les `EXPO_PUBLIC_*` sont figées dans le bundle)

---

## Pièges connus (hérités d'`asso-jeunes`)

- Ne **jamais** épingler les versions natives Expo à la main → `expo install --fix`.
- Babel : le plugin est `react-native-worklets/plugin` (pas `react-native-reanimated/plugin`), **en dernier**.
- Metro : garder la config Expo par défaut, sans `watchFolders`/`nodeModulesPaths` manuels.
- `node-linker=hoisted` dans `.npmrc` est **requis** pour React Native + pnpm.
- ⚠️ **Ce projet vit dans `C:\dev\mosquee-fitia`, PAS sous OneDrive — et ce n'est pas un détail.**
  Déplacé le 2026-08-07 parce qu'Expo ne démarrait plus :
  `Failed to construct transformer: Failed to start watch mode`, suivi d'un
  `TypeError ... getSha1` dans `react-native-css-interop`.
  Le `getSha1` est une **conséquence**, pas la cause — nativewind patche un système de
  fichiers que Metro n'a jamais fini de construire. Ne pas chercher du côté de nativewind.
  Cause réelle : `metro-file-map` a un délai en dur de **4 min** ; `NativeWatcher` n'existe
  que sur macOS, donc Windows sans watchman utilise `FallbackWatcher`, qui ouvre **un handle
  par répertoire** — 6 702 ici, chacun traversant le pilote de synchronisation OneDrive
  (14 784 fichiers sur 20 000 étaient des placeholders).
  **Ne pas remettre ce projet sous OneDrive.** Si un jour c'est inévitable, installer
  watchman (`choco install watchman -y`, terminal admin) : une seule surveillance récursive
  au lieu de 6 702 handles.
- **Après tout déplacement du projet, refaire `pnpm install`.** Les liens de workspace
  (`node_modules/@fitia/*`) sont des symlinks en **chemin absolu** : ils continuent de
  pointer vers l'ancien emplacement et deviennent morts. Symptôme au build :
  `Cannot find module '@fitia/design-tokens/tailwind-preset'` — alors que `tsc` passe
  sans broncher, parce qu'il résout par les `paths` du tsconfig, pas par `node_modules`.
  Le build Docker, lui, réinstalle dans le conteneur : **il masque complètement ce
  problème**. Ne pas conclure d'un build Docker vert que le poste local est sain.
- **`pnpm install` peut sortir en code 0 sans rien installer.** S'il décide de purger
  `node_modules`, il demande confirmation ; sans TTY il abandonne avec
  `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` — **et rend quand même 0**. Toujours
  lire la sortie. Remède : `CI=true pnpm install`.
- Ne pas supprimer `apps/dashboard/.next` pendant que `next dev` tourne.
  En revanche, **si Next refuse de démarrer** avec `EINVAL: invalid argument, readlink '.next/...'`,
  c'est que le dossier est corrompu (arrêt brutal, ou synchronisation OneDrive). Serveur arrêté,
  `rm -rf apps/dashboard/.next` puis relancer : c'est le remède.
- **Nouvelle Edge Function → relancer TOUTE la stack** (`supabase stop && supabase start`).
  La liste des fonctions est calculée par le CLI au démarrage et passée au conteneur :
  redémarrer seulement `supabase_edge_runtime_*` ne suffit pas, l'appel répond `404 Function not found`.
- Premier appel d'une Edge Function : le graphe de dépendances est téléchargé depuis esm.sh et
  peut dépasser le délai de l'isolat sur réseau lent (`early termination has been triggered`).
  Réessayer une fois le cache Deno chaud.
- **Toutes les fonctions répondent 500, même une inexistante ?** Le runtime est coincé
  (arrive après une longue inactivité). Un simple redémarrage du conteneur suffit — inutile de
  relancer toute la stack tant que la liste des fonctions n'a pas changé :
  `docker restart supabase_edge_runtime_mosquee-fitia`. Compter ~10 s puis réessayer
  (le tout premier appel après redémarrage peut encore renvoyer 502).
- Le CLI Supabase n'est pas installé globalement sur ce poste : passer par `npx supabase@latest …`,
  et **sans pipe PowerShell** (`| Select-Object` bufferise et donne l'illusion d'un blocage).
