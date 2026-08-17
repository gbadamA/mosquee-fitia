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
| Fidèle (mobile) | `+22507000000`, code OTP `123456` | app mobile |

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

### 1. Créer le projet Supabase Cloud

Sur [supabase.com](https://supabase.com), nouveau projet, région Europe.
Puis pousser le schéma depuis ce dépôt :

```bash
npx supabase@latest link --project-ref <ref-du-projet>
```

```bash
npx supabase@latest db push
```

Déployer les fonctions serveur :

```bash
npx supabase@latest functions deploy create-member send-push
```

⚠️ **Ne PAS déployer `dev-login`** : c'est le contournement OTP de développement.
Il refuse de s'exécuter hors instance locale, mais autant ne pas l'envoyer du tout.

### 2. Déployer le tableau de bord sur Render

Sur [render.com](https://render.com) → **New → Blueprint**, pointer le dépôt
`gbadamA/mosquee-fitia`. Render lit `render.yaml` et crée le service.

Renseigner ensuite les deux secrets dans l'interface Render
(**Project Settings → API** côté Supabase) :

| Variable | Valeur |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | l'URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la clé `anon` / `public` |

⚠️ Ces deux valeurs sont **inscrites dans le bundle à la construction**. Les
modifier impose de **reconstruire** le service — un redémarrage ne suffit pas.

### 3. Ce que le plan gratuit implique

- **Ne créez PAS de PostgreSQL chez Render.** Le gratuit expire et emporte les
  données — c'est ce qui a mis PREVENTIX 360 hors service. La base reste chez Supabase.
- **Le service s'endort** après ~15 min sans trafic et met ~50 s à se réveiller.
  Le bureau verra une première page lente après une pause ; aucune donnée n'est
  en jeu, tout est chez Supabase.
- **Le disque est éphémère** — sans conséquence ici : le tableau de bord n'écrit
  rien localement, les justificatifs vont dans Supabase Storage.

### 4. À faire avant la mise en service réelle

- [x] ~~Rétablir l'OTP~~ — fait le 2026-08-08, `OTP_ENABLED = true`
- [ ] **Configurer un fournisseur SMS** — sans lui, l'OTP rétabli ne peut envoyer aucun
      code et la connexion des fidèles est bloquée en production.
      Supabase Cloud → **Authentication → Providers → Phone** (Twilio, Vonage…).
      En local, seul `+22507000000` fonctionne, avec le code `123456`.
- [ ] Pointer `apps/mobile/.env` sur l'URL Supabase Cloud, puis build EAS
- [ ] Vérifier que `supabase/functions/dev-login` **n'est pas** déployée
      (`npx supabase functions list`) — elle n'a plus aucun usage.

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
