# 🕌 CLAUDEMAP — Mosquée Fitia (Petro Ivoire, Abobo)

> Carte maîtresse du projet. Lue en priorité par Claude Code au démarrage de chaque session.
> Elle définit **quoi** construire, **avec quelle stack**, **dans quel ordre**, et surtout **à quoi ça doit ressembler**.
> Les specs fonctionnelles d'origine sont dans `cahier-des-charges.md` (fusion des deux cahiers : back-office + mobile).

---

## 1. Identité du projet

| | |
|---|---|
| **Nom de travail** | MOSQUÉE FITIA |
| **Établissement** | Mosquée Fitia, dite « Petro Ivoire » — Abobo, Abidjan (CI) |
| **Type** | App mobile (Android priorité, iOS ensuite) + Dashboard web back-office |
| **Cible** | Fidèles, imam, trésorier, secrétaire, comité de gestion |
| **Marché** | Côte d'Ivoire / Afrique de l'Ouest francophone |
| **Langue produit** | Français (option arabe prévue — voir §9) |
| **Contraintes locales** | Mobile Money, faible data, connectivité intermittente, WhatsApp roi, **pas de fournisseur SMS** |
| **Statut** | 🟡 Phase 0 — socle en cours de scaffolding |

**Promesse produit :** une app de mosquée qui inspire le respect — sobre, digne, chaleureuse — et qui rend un service quotidien réel : *savoir quand est la prochaine prière, ce que dit l'imam, et où va l'argent de la communauté.*

### Décisions verrouillées avec le porteur du projet
1. **Palette « vert islamique »** (voir §3) — inspirée du vert Petro Ivoire, l'or en accent.
2. **Pas de module École coranique / madrassa** — retiré du périmètre *et* du modèle de données (ni rôle `enseignant`, ni catégorie `étudiant coranique`). Ne pas le réintroduire sans demande explicite.
3. **Paiement par preuve, pas par API** — le fidèle déclare son versement Mobile Money avec son n° de transaction ; le trésorier valide au dashboard. Le port `PaymentGateway` (`packages/shared/src/finance.ts`) fige le contrat pour brancher Orange Money plus tard sans réécrire.

---

## 2. Stack technique (verrouillée)

> Reprise fidèle de l'architecture **asso-jeunes** (`projets/asso-jeunes/`) : même monorepo, même
> découpage de packages, même backbone Supabase Realtime. Ce qui change : la DA et le domaine métier.

### Mobile — `apps/mobile`
| Rôle | Choix | Note |
|---|---|---|
| Framework | **Expo SDK 54** (React Native) | 1 seule base de code Android + iOS |
| Navigation | **Expo Router** | routing basé fichiers |
| Styling | **NativeWind v4** | tokens partagés avec le dashboard |
| Animations | **Reanimated 4** (+ `react-native-worklets`) | micro-interactions |
| Dégradés | **expo-linear-gradient** | bannières, carte de fidèle |
| Icônes | **Lucide** (`lucide-react-native`) | cohérence mobile ↔ web |
| Notifications | **Expo Notifications** (FCM) | rappel avant chaque prière |
| Cache offline | **AsyncStorage** | derniers horaires + dernières annonces |
| Build / OTA | **EAS Build + EAS Update** | maj sans repasser par les stores |
| **Test** | **Expo Go sur téléphone réel** | ⚠️ pas d'émulateur — QR code + `npx expo start` |

> ⚠️ **Versions natives** : ne JAMAIS épingler à la main. Toujours `npx expo install` / `expo install --fix`.
> Le projet asso-jeunes s'est cassé le bundle Metro exactement sur cette erreur (SDK 57).
> Babel : le plugin est `react-native-worklets/plugin` (**pas** `react-native-reanimated/plugin`), en dernier.
> Metro : config par défaut Expo, **sans** `watchFolders`/`nodeModulesPaths` manuels (Expo gère les monorepos depuis SDK 52).

### Dashboard web — `apps/dashboard`
| Rôle | Choix |
|---|---|
| Framework | **Next.js 15** (App Router) + React 19 |
| Styling | **Tailwind CSS** (mêmes tokens que le mobile, via preset partagé) |
| Animations | **Framer Motion** |
| Graphiques | **SVG maison** (pas de Recharts — install trop lente sur ce réseau) |
| Icônes | **Lucide** (`lucide-react`) |
| Port | **3031** (3030 est déjà pris par ouatt-telecom dans `.claude/launch.json`) |

### Backend — **Supabase** (managé, pas de serveur à héberger)
| Rôle | Choix |
|---|---|
| Base de données | **PostgreSQL** managé |
| **Diffusion dashboard → mobile** | **Supabase Realtime** — le mobile s'abonne à `prayer_times`, `announcements`, `events` et reçoit les nouveautés instantanément ; complété par push Expo |
| Auth | **Supabase Auth** — téléphone + **mot de passe** (fidèles), email + mot de passe (staff) |

> ✅ **Un seul chemin de connexion.** Le contournement « sans code » (constante
> `OTP_ENABLED` + Edge Function `dev-login`) a été **entièrement retiré le 2026-08-08**,
> code client compris. Le réintroduire signifierait rouvrir une porte dérobée.
>
> 🔑 **Plus d'OTP depuis le 2026-08-17 : numéro + mot de passe.** La mosquée n'a pas de
> fournisseur SMS ; un OTP n'enverrait aucun code et **personne** ne pourrait se connecter.
> Le numéro reste l'identifiant — c'est ce qui parle aux fidèles — et un mot de passe
> remplace le code :
>
> - `create-member` engendre le mot de passe (8 caractères, alphabet **sans** `0/O` ni
>   `1/I/l` : il est dicté à voix haute et recopié à la main) et le renvoie **une seule
>   fois** ; Supabase n'en garde qu'un haché.
> - Le secrétaire le remet au fidèle qu'il a en face de lui : la vérification du numéro
>   a lieu **physiquement**, au lieu d'un SMS. D'où `phone_confirm: true`.
> - Oubli, ou fidèle créé avant ce changement → fiche du fidèle → **Émettre un mot de
>   passe**. Un mot de passe perdu ne se retrouve pas, il ne peut qu'être remplacé.
>
> Le parcours OTP complet (envoi + écran `verify.tsx`) est dans l'historique git, commit
> `db27816` et ses parents, si un fournisseur SMS est un jour souscrit.
>
> 🪪 **Et sous le capot, ce n'est PAS l'auth téléphone (2026-08-18).** Mesuré, pas supposé :
> avec `[auth.sms.twilio] enabled = false`, Supabase répond « Phone logins are disabled ».
> **Le canal téléphone n'existe que si un fournisseur SMS est DÉCLARÉ**, même sans jamais
> envoyer un seul SMS. La mosquée n'en a pas → `phoneToAuthEmail()` dérive
> `2250700000000@fitia.invalid` (`.invalid` = RFC 2606, ne résout jamais) et l'authentification
> **e-mail** prend le relais, elle n'exige aucun fournisseur.
>
> - Le fidèle ne voit **que son numéro** ; l'identifiant interne ne s'affiche nulle part.
> - Le vrai numéro vit dans `profiles.phone`, colonne indépendante d'`auth.users`.
>   `create-member` réécrit `phone` + `email: null` dans le profil après le trigger, qui
>   aurait sinon recopié l'identifiant interne.
> - ⚠️ **La règle est écrite TROIS fois** (paquet partagé, Edge Function Deno qui ne peut pas
>   l'importer, script de vérification). `auth-password-check.mjs` contrôle que les trois
>   portent le même domaine : si elles divergeaient, un fidèle serait créé sous un identifiant
>   que l'écran de connexion ne saurait pas reconstruire — il n'entrerait plus jamais, sans
>   le moindre message d'erreur.
> - ⚠️ **La stack LOCALE n'a plus de fournisseur SMS non plus** : elle reflète exactement la
>   production. Ne pas réactiver Twilio « pour que ça marche en local » — ce serait remasquer
>   la contrainte et croire à tort que tout va bien.
| Sécurité | **Row Level Security** par rôle, via les fonctions `auth_role()` / `is_staff()` / `is_admin()` |
| Fichiers | **Supabase Storage** (photos, reçus PDF) |
| Logique serveur | **Edge Functions** (Deno) — push, création de compte staff, reçus |
| Accès données | `@supabase/supabase-js` côté mobile **et** dashboard (mêmes types générés) |

> **Pourquoi Supabase :** la diffusion des horaires et des annonces vers le mobile devient quasi-gratuite
> grâce à Realtime. L'imam publie les horaires au dashboard → tous les téléphones les reçoivent en direct.

> **Monorepo** : `pnpm` workspaces. Trois sources de vérité partagées : `packages/design-tokens` (visuel),
> `packages/shared` (schémas Zod + logique métier pure) et `packages/supabase` (client + types DB).

⚠️ **Ports Supabase = 5413x** (54131 API, 54132 db, 54133 studio, 54134 inbucket, 54137 analytics).
Raison : Windows réserve dynamiquement 54287-54386 (Hyper-V/WSL) et 5412x est déjà pris par asso-jeunes.
Les deux stacks peuvent donc tourner en parallèle.

---

## 3. 🎨 Direction artistique — « vert islamique & or »

> Objectif : **digne, sobre, chaleureux, intemporel**. Mode clair ET sombre natifs.
> Les valeurs ci-dessous sont les **tokens réels** de `packages/design-tokens`.

### 3.1 Palette

```
Dégradé signature (135°)
  --emerald-start  #064E3B   (vert nuit)
  --emerald-mid    #0B7A3B   (vert profond — écho au vert Petro Ivoire)
  --emerald-end    #C9A227   (or)
  → utilisé sur bannières, en-tête « prochaine prière », carte de fidèle

Primaire (actions)        #0B7A3B  / hover #086130
Secondaire (accents, or)  #C9A227  / hover #A9871C
Tertiaire (liens/focus)   #0E9F6E  (émeraude clair)
Succès                    #12B76A
Alerte                    #F59E0B
Erreur                    #DC2626

Couleur par prière (pastilles, agenda, compte à rebours)
  Fajr #1E3A8A · Dhuhr #0E9F6E · Asr #C9A227 · Maghrib #C2410C · Isha #4C1D95

Neutres — mode CLAIR (légèrement teintés vert)
  bg          #F6FAF7        surface      #FFFFFF
  surface-alt #EEF4F0        border       #DCE7E0
  text        #0C1912        text-muted   #5B6B62

Neutres — mode SOMBRE (natif, pas un after-thought)
  bg          #071410        surface      #0F211A
  surface-alt #162C23        border       #244134
  text        #EAF3ED        text-muted   #8FA79A
```

**Règles de contraste (WCAG AA, non négociable) :**
- le **vert** `primary` ne porte que du texte **blanc** ;
- l'**or** `secondary` ne porte que du texte **sombre** (`#0C1912`) — jamais de blanc sur or ;
- jamais de texte coloré sur fond coloré.

### 3.2 Typographie
- **Titres / display :** `ClashDisplay` (fallback `Satoshi`).
- **Texte courant :** `Inter`.
- **Arabe :** `Amiri` (noms de prières, date Hijri) — classe `.arabic`, `direction: rtl`.
- Échelle : `display 34/40` · `h1 28` · `h2 22` · `h3 18` · `body 15` · `caption 13`.

### 3.3 Formes, motifs & profondeur
- Rayons : `sm 10` · `md 16` · `lg 24` · `full 999`.
- Ombres douces **teintées vert** (`rgba(11,122,59,.12)`), jamais de noir pur.
- **Motif géométrique islamique** en trame discrète sur les en-têtes en dégradé
  (classe `.pattern-islamic`, SVG inline en data URI — aucun asset externe, aucune requête réseau).
- Pas de figuration humaine ni animale dans l'iconographie — icônes géométriques et symboles uniquement.

### 3.4 Micro-interactions — Mobile
- **Compte à rebours** vivant jusqu'à la prochaine prière (rafraîchi à la seconde).
- Transitions d'écran fluides, `FadeInDown` en cascade sur les listes.
- **Carte de fidèle** en verre dépoli + numéro d'adhérent.
- **Check animé** après déclaration d'un don / d'une cotisation.
- **Skeleton loaders** animés (jamais de spinner nu).
- **Pull-to-refresh** aux couleurs de la mosquée.
- **Feedback haptique** léger sur les actions clés.

### 3.5 Micro-interactions — Dashboard
- **Soulèvement des cadres au survol** (`translateY(-4px)` + ombre verte) sur toutes les cartes —
  implémenté globalement dans `globals.css`, sous `prefers-reduced-motion: no-preference`,
  et **exclu** sur les champs de saisie et les zones défilantes.
- Menu latéral : indicateur actif sur fond `primary/10`.
- Listes temps réel animées à l'arrivée (Framer Motion `AnimatePresence`).

> **Mode clair — dashboard ET mobile : FAIT.**
> - Dashboard : sélecteur clair / sombre / système dans le menu latéral (`lib/theme.tsx`),
>   préférence stockée localement, script anti-flash injecté dans `<head>`.
>   Contrastes mesurés en clair : titre 17,1:1 · texte secondaire 5,2:1 · bouton primaire 5,4:1.
> - Mobile : `lib/theme.tsx` pilote NativeWind via `setColorScheme`, sélecteur dans l'écran
>   Réglages, préférence en AsyncStorage. Toutes les classes sont passées en `light-* dark:dark-*`.
>   ⚠️ Les props natives qui prennent une couleur en JS (`placeholderTextColor`, teintes d'icônes,
>   barre d'onglets, `contentStyle` du Stack) ne suivent PAS les classes → utiliser `useThemeColors()`.

> **Couleurs personnalisables — dashboard : FAIT et vérifié.** Les couleurs de la table `mosque`
> alimentent des variables CSS en canaux RVB (`rgb(var(--c-primary) / <alpha-value>)`), donc les
> opacités Tailwind (`bg-primary/10`) continuent de fonctionner. Preuve : passer `primary_color`
> à `#1D4ED8` fait calculer `rgb(29, 78, 216)` au bouton primaire.
> Sur **mobile**, elles pilotent les dégradés et les teintes JS (`useBrand`) — **pas** les classes
> NativeWind, qui restent sur la palette compilée.

### 3.6 Accessibilité & perf (non négociable)
- Respect de « réduire les animations » système → toutes les animations désactivables.
- Mode allégé data : pas de dépendance graphique lourde, bundle optimisé, cache local.
- Contraste AA sur 100 % des écrans, en clair **et** en sombre.

---

## 4. Structure du monorepo

```
mosquee-fitia/
├─ claudemap.md              ← ce fichier
├─ cahier-des-charges.md     ← spec fonctionnelle fusionnée (web + mobile)
├─ apps/
│  ├─ mobile/                Expo SDK 54 — app fidèle
│  └─ dashboard/             Next.js — back-office imam / trésorier / secrétaire (port 3030)
├─ packages/
│  ├─ design-tokens/         couleurs, typo, espacements + preset Tailwind (source visuelle unique)
│  ├─ shared/                schémas Zod + logique métier pure (rôles, prières, finances, événements)
│  └─ supabase/              client + types DB générés
├─ supabase/                 config CLI (ports 5413x), migrations, seed, edge functions
└─ pnpm-workspace.yaml
```

> Pas d'`apps/api` : Supabase **est** le backend. La logique serveur vit dans `supabase/functions/`.

---

## 5. Modèle de données

| Table | Rôle |
|---|---|
| `mosque` | ligne unique — nom, adresse, GPS, contacts, **logo + couleurs personnalisables** |
| `profiles` | fidèles et staff (1-1 avec `auth.users`), rôle, statut d'adhésion, n° `FIT-00001`, `push_token` |
| `prayer_times` | **une ligne par date** — fajr / chourouk / dhuhr / asr / maghrib / isha / jumua + note |
| `announcements` | canal de diffusion (info · khutba · événement · urgent · collecte) |
| `campaigns` | collectes fléchées (toiture, Ramadan, Waqf…) avec objectif |
| `contributions` | cotisations mensuelles — statut `en_attente` → `valide` par le trésorier |
| `donations` | Sadaqah / Zakat / don de campagne, possiblement anonyme |
| `expenses` | dépenses (entretien, salaires, factures, travaux…) — **invisibles des fidèles** |
| `events` | Djouma, conférences, Aïd, Ramadan, Janazah, cours |
| `event_registrations` | inscriptions + check-in |

**Choix structurant — les horaires viennent du dashboard, pas d'un calcul embarqué.**
L'iqama réelle d'une mosquée ne coïncide pas avec le calcul astronomique : la mosquée fait autorité
sur ses propres horaires. Le mobile n'embarque donc aucun moteur de calcul (bundle léger, zéro dérive)
et met en cache la dernière ligne reçue pour fonctionner hors connexion.

---

## 6. Rôles & permissions

| Rôle | Accès |
|---|---|
| **Fidèle** | App mobile — horaires, annonces, dons/cotisations, événements, profil |
| **Secrétaire** | Dashboard — fidèles, diffusion, événements |
| **Trésorier** | Dashboard — finances (valide les paiements, saisit les dépenses) |
| **Imam** | Dashboard complet + publication des horaires |
| **Administrateur** | Accès total, y compris gestion des comptes et paramètres |

> La sécurité vit dans Postgres (RLS), jamais dans le client. Les fonctions `auth_role()`,
> `is_staff()` et `is_admin()` sont `security definer` pour éviter la récursion RLS sur `profiles`.
> Point de vigilance : les **dépenses** ne sont lisibles que par trésorier/imam/admin.

---

## 7. Carte des fonctionnalités

### 📱 Mobile (fidèle)
- **Accueil** : horaires du jour, compte à rebours prochaine prière, date grégorienne + Hijri, fil d'annonces.
- **Notifications** : rappel avant chaque prière, nouvelle annonce, rappel de cotisation.
- **Dons & cotisations** : déclaration Mobile Money avec n° de transaction, historique personnel, reçu.
- **Événements** : calendrier, inscription en 1 clic, rappel avant l'événement.
- **Profil** : informations, n° d'adhérent, statut d'adhésion, historique, réglages de notifications.
- **Contact** : appel / WhatsApp de la mosquée en un geste (numéros lus dans la table `mosque`).
- **Réglages** (`app/reglages.tsx`) : thème clair/sombre/système, activation des rappels de prière
  et choix du délai (0/5/10/15/30 min), rappels d'événement, annonces. Stockés en AsyncStorage.
- **Espace administration** (`app/administration.tsx`, staff uniquement) : solde + alerte trésorerie,
  validation des déclarations reçues, publication d'une annonce depuis le mobile.
- **Hors-ligne** : derniers horaires et dernières annonces consultables sans réseau.

### 🖥️ Dashboard (staff)
- **Vue d'ensemble** : prochaine prière, fidèles inscrits, collecté / dépenses / solde, prochains événements.
- **Horaires de prière** : publication par date (upsert), programmation à l'avance, Djouma.
- **Diffusion** : annonces catégorisées, épinglage, aperçu du fil en direct.
- **Fidèles** : liste filtrable, recherche, export CSV, **enregistrement d'un fidèle** (pour ceux qui n'installeront pas l'app — le n° de téléphone sert d'identifiant, ils retrouvent ce compte s'ils installent l'app plus tard), **import en masse CSV** (en-tête détecté, séparateur deviné, rapport ligne par ligne des rejets), **fiche détaillée** en tiroir (édition + historique des versements + accès aux reçus).
- **Fréquentation** : relevé d'effectif par date et par moment (5 prières + Djouma), affluence moyenne et pic par moment, historique, export CSV. Contrainte d'unicité `(date, moment)` : ressaisir corrige au lieu d'empiler.
- **Inventaire** : biens de la mosquée (tapis, sonorisation, véhicule…), quantité, état modifiable en ligne, valeur estimée totale, export CSV, et **journal daté par bien** (acquisition, contrôle, réparation, déplacement, sortie) avec cumul des frais. ⚠️ Un changement d'état saisi dans le tableau est journalisé **automatiquement** par un déclencheur Postgres (`log_asset_condition_change`) : l'historique n'a pas de trou là où il sert le plus.
- **Entretien** : tâches planifiées, adossées ou non à un bien, avec récurrence. Cocher une tâche récurrente la **réarme depuis la date d'exécution** (pas depuis l'ancienne échéance) — sinon une tâche faite en retard resterait éternellement en retard.
- **Documents** : archivage des statuts, PV et contrats dans un bucket Storage **privé**. Téléchargement par URL signée à durée limitée ; jamais d'URL publique.
- **Finances** : KPIs, **saisie directe des entrées au guichet** (cotisation / Sadaqah / Zakat / campagne, espèces ou Mobile Money, donateur nommé ou anonyme), validation des déclarations venues du mobile, saisie des dépenses, campagnes.
- **Événements** : création, inscriptions, **pointage des présences** (déplier un événement → liste des inscrits, bouton Pointer/Présent réversible) → le taux de présence affiché est réel.
- **Campagnes** : création, objectif, date de fin, activation/clôture, **jauge d'avancement** calculée sur les dons validés, et **suivi nominatif des bienfaiteurs** — déplier une campagne liste ses donateurs (ou « anonyme ») avec validation des promesses sur place, sans passer par Finances. Une promesse en attente ne gonfle jamais la jauge.
- **Attestations** : documents **délivrés par** la mosquée (mariage, adhésion, don, résidence, bonne moralité, libre), numérotés `ATT-2026-0001`, imprimables. À ne pas confondre avec Documents, qui archive ce que la mosquée **reçoit**. Les champs propres à chaque type sont déclarés une seule fois dans `ATTESTATION_TEMPLATES` : le formulaire et le document imprimé s'y réfèrent tous les deux, donc ils ne peuvent pas diverger. Une attestation erronée s'**annule**, elle ne se supprime jamais.
- **Rapports** : rapport financier par exercice (origine des entrées, répartition des dépenses, évolution mensuelle en SVG maison), **export comptable CSV**, impression/PDF.
- **Reçus** : `/recu/[id]` imprimable pour toute entrée validée (cotisation ou don, nominatif ou anonyme).
- **Communication** : modèles prêts (relance de cotisation, rappel d'événement, appel à la collecte),
  audiences calculées (tous / cotisations en retard / inscrits à un événement), trois canaux, journal des envois.

> **Canaux de diffusion — ce qui marche vraiment aujourd'hui :**
> - **WhatsApp / SMS : envoi ASSISTÉ.** L'API WhatsApp Business exige un compte marchand que la
>   mosquée n'a pas ; attendre ce contrat bloquerait la mise en service. Le dashboard génère donc
>   un lien `wa.me` / `sms:` pré-rempli par destinataire — le secrétaire clique, l'appli s'ouvre
>   avec le message déjà écrit. Port `BulkMessenger` prêt pour brancher Twilio plus tard.
> - **Push distantes : plomberie vérifiée, livraison NON.** `send-push` répond correctement
>   (`{"sent":0,"reason":"aucun jeton enregistré"}`), mais aucun téléphone n'aura de jeton tant
>   qu'il n'y a pas de **build EAS** — Expo Go ne reçoit plus les push distantes sur Android SDK 53+.
>   L'écran l'affiche explicitement au lieu de faire croire à un envoi réussi.
> - **Rappels de prière et d'événement : LOCAUX.** Planifiés sur le téléphone, donc ils
>   fonctionnent hors connexion, dans Expo Go **et sur émulateur Android**. Annulation ciblée
>   par identifiant (`prayer:<clé>`, `event:<id>:<minutes>`) — ⚠️ ne jamais revenir à
>   `cancelAllScheduledNotificationsAsync()`, qui effacerait les deux familles à la fois.
>
> ⚠️ **Où placer `Device.isDevice`** : uniquement dans `lib/push.ts`, avant d'obtenir un
> jeton de push distante — un émulateur n'en obtiendra jamais. Le mettre dans
> `requestPermission()` (`lib/notifications.ts`) rendrait les rappels **locaux** intestables
> hors téléphone physique, alors qu'ils fonctionnent parfaitement sur émulateur.
- **Administration** : **création de comptes du bureau** (email + mot de passe + rôle), changement de rôle, paramètres de la mosquée (logo, couleurs).

> **Cotisations périodiques.** La mosquée fixe un montant mensuel (`mosque.contribution_amount`).
> Un fidèle doit une cotisation par mois **depuis son adhésion** (`profiles.joined_at`) — jamais
> avant. Un mois est **couvert** quand la somme de ses cotisations VALIDÉES de ce mois atteint le
> montant : les versements partiels s'additionnent.
> Deux situations à ne jamais confondre dans l'UI : **en retard** (mois échus non couverts, c'est
> l'arriéré) et **mois courant** (dû mais pas encore en retard, c'est un simple rappel).
> Même calcul des deux côtés : `cotisationStatus()` en TS (mobile, ne voit que ses lignes) et
> `contribution_arrears()` en SQL `security definer` (dashboard, voit tout le monde).
> `scripts-verif/cotisation-check.mjs` vérifie qu'ils concordent — à relancer après toute évolution.
>
> ⚠️ `profiles.status` décrit l'**adhésion**, pas le paiement. Son libellé `actif` était
> « À jour », ce qui contredisait la colonne Cotisation (un fidèle « À jour » avec 4 mois
> d'arriéré). Il dit maintenant « Adhésion active ».

> **Justificatifs.** Le fidèle joint une photo de son reçu Mobile Money (bucket privé
> `justificatifs`, chemin `<uid>/<horodatage>.<ext>` — le premier segment porte la propriété et
> fonde la policy). Le trésorier l'ouvre par URL signée avant de confirmer. Le dépôt se fait
> **avant** l'insertion : si l'envoi échoue, aucune ligne n'est créée, pas de déclaration
> orpheline de sa preuve.

> **Deux chemins pour l'argent, à ne pas confondre :**
> 1. *Guichet* (majoritaire) — le trésorier saisit dans Finances → statut `valide` d'emblée,
>    l'argent est déjà encaissé, il n'y a rien à valider.
> 2. *Mobile* — le fidèle déclare son transfert → statut `en_attente` → le trésorier valide.
>
> Dans les deux cas, une **cotisation** validée fait passer le fidèle « à jour » ; un **don**, non.

> **Création de comptes** : `profiles.id` référence `auth.users(id)`, donc un profil ne peut pas
> exister sans utilisateur d'authentification — et créer un utilisateur exige la clé `service_role`,
> qui ne doit jamais atteindre le navigateur. D'où l'Edge Function **`create-member`**, qui
> **revérifie le rôle de l'appelant côté serveur** (fidèle → secrétaire/imam/admin ; compte staff → imam/admin).

---

## 8. Roadmap de build

| Phase | Contenu | Sortie attendue |
|---|---|---|
| **0 — Socle** ✅ | Monorepo pnpm, `design-tokens`, `shared`, `supabase` + migrations, scaffolds Next + Expo, **diffusion horaires/annonces temps réel** | dashboard et mobile typecheckent à 0 erreur ; reste à lancer Supabase pour vérifier la diffusion de bout en bout |
| **1 — MVP** | Auth fidèle (numéro + mot de passe) + email staff, accueil horaires + compte à rebours, fil d'annonces, déclaration de don/cotisation + validation trésorier | boucle fidèle complète |
| **2 — Dashboard** | Fidèles (liste/export), finances (KPIs + validation + dépenses), événements | pilotage du bureau |
| **3 — Notifications** | Push Expo avant chaque prière, nouvelle annonce, rappel de cotisation ; canal WhatsApp | engagement |
| **4 — Transparence** | Reçus PDF, rapports financiers exportables pour l'assemblée des fidèles, campagnes avec jauge | confiance de la communauté |
| **5 — Livraison** | Mode hors-ligne avancé, i18n arabe, EAS Build + Supabase cloud, déploiement edge functions | mise en production |

---

## 8 bis. Hébergement — Render (plan gratuit)

⚠️ **Ne pas calquer sur HadjChanges.** HadjChanges déploie DEUX services car il a une
API NestJS à héberger. Ici **Supabase EST le backend** : il n'y a pas d'API à déployer.

| Composant | Où |
|---|---|
| Tableau de bord Next.js | **Render** — `render.yaml` + `apps/dashboard/Dockerfile` |
| PostgreSQL, Auth, Realtime, Storage | **Supabase Cloud** |
| Edge Functions `create-member`, `send-push` | **Supabase**, jamais Render |
| Application mobile | build **EAS** — aucun serveur web |

**Projet Supabase Cloud (décidé le 2026-08-18) — sur le SECOND compte Supabase de
l'utilisateur** : ref `rjumgzqcqbdukvgnfyok`, région `eu-central-1` (Francfort),
URL `https://rjumgzqcqbdukvgnfyok.supabase.co`. Même région que le service Render
(`frankfurt`), donc latence minimale entre le tableau de bord et la base.

⚠️ **Ne JAMAIS créer de PostgreSQL chez Render** : le plan gratuit expire et emporte
les données. C'est ce qui a mis PREVENTIX 360 hors service.

⛔ **`DATABASE_URL` / `DIRECT_URL` ne servent à RIEN ici.** Les chaînes de connexion
Postgres affichées par Supabase (onglet Connect → ORMs) s'adressent à Prisma, Drizzle
ou TypeORM ; ce projet n'en utilise aucun — vérifié, le mot `DATABASE_URL` n'apparaît
nulle part dans le dépôt. Tout passe par `@supabase/supabase-js` en HTTP, et les
migrations par le CLI. Ne pas déclarer ces variables chez Render : elles ne seraient
jamais lues et y coller le mot de passe Postgres l'exposerait pour rien.
Seule utilité de la `DIRECT_URL` : `supabase db push --db-url "<…pooler…:5432…>"` si la
connexion directe échoue, les connexions Postgres directes étant en **IPv6** (beaucoup
de FAI ne le routent pas). Port **5432** (mode session) et non 6543 — le mode
transaction ne sait pas exécuter de migrations.

⚠️ **Amorçage : `create-member` ne peut PAS créer le premier compte.** Elle exige un
appelant déjà imam/admin, et une base neuve n'en a aucun. Le seul chemin est
`scripts-verif/seed-accounts.mjs` avec la clé `service_role` (qui ignore la RLS). Le
script **refuse de tourner hors localhost sans `SEED_PASSWORD`** : son défaut
`fitia1234` est publié dans le README, il laisserait les comptes du bureau ouverts.

Les deux seules fonctions à déployer sont `create-member` et `send-push`.

**Trois contraintes de construction, toutes découvertes à l'usage :**
1. `dockerContext: .` — la racine du dépôt, pas `apps/dashboard`, sinon les imports
   `@fitia/*` sont introuvables.
2. **L'installation pnpm doit avoir lieu dans l'étape qui construit.** Installer dans une
   étape `deps` séparée puis copier le seul `/app/node_modules` échoue : pnpm place les
   liens d'espace de travail dans `apps/dashboard/node_modules`. Sans eux,
   `tailwind.config.ts` ne résout pas `@fitia/design-tokens/tailwind-preset` et le build
   casse sur `globals.css`.
3. `outputFileTracingRoot` remonté à la racine du dépôt dans `next.config.mjs`, sinon la
   sortie `standalone` oublie `packages/*` et le serveur plante au démarrage.

✅ **Vérifié le 2026-08-08** : image construite (322 Mo), conteneur démarré, `/login`
répond **HTTP 200**, prêt en 327 ms.

---

## 9. Points d'attention contexte local
- **Data faible** : images compressées, bundle optimisé, cache local systématique.
- **Connectivité intermittente** : les horaires doivent rester lisibles **hors ligne** (cache AsyncStorage).
- **Mobile Money** : Orange Money / Wave / MTN. V1 = preuve de paiement ; API réelle = Phase ultérieure.
- **WhatsApp** : canal complémentaire au push (adoption plus forte que l'email).
- **Pas de SMS** : la mosquée n'a pas de fournisseur, d'où le mot de passe plutôt que l'OTP.
  Le mot de passe est remis **de la main à la main** par le secrétaire — un circuit qui colle
  à la réalité locale, où le bureau connaît personnellement les fidèles.
- **Arabe** : prévu en option ; les chaînes doivent rester centralisées pour permettre l'i18n sans refonte.

---

## 10. Conventions & commandes

```bash
# Installer tout le workspace
pnpm install

# Supabase (base + migrations + realtime) — ports 5413x
supabase start
supabase db reset                   # applique migrations + seed
pnpm db:types                       # régénère packages/supabase/src/database.types.ts

# Dashboard
pnpm dashboard                      # http://localhost:3031

# Mobile — test sur téléphone réel via Expo Go (scanner le QR)
pnpm mobile
```

- **Design d'abord** : toute UI part des tokens `packages/design-tokens` — **aucune** couleur/rayon en dur.
- **Diffusion = INSERT/UPSERT Supabase** : le dashboard écrit, le mobile reçoit via Realtime. Pas de canal ad hoc.
- **Clair + sombre** : écrire systématiquement les deux jeux de classes (`bg-light-* dark:bg-dark-*`), même si seul le sombre est actif aujourd'hui (cf. §3.5).
- **Animations** derrière le réglage « réduire les animations ».
- Logique métier pure (calculs, formats, validations) → `packages/shared`, jamais dupliquée dans une page.
- Types DB → `packages/supabase`, **régénérés après chaque migration** (`pnpm db:types`).
- **RLS obligatoire** sur chaque table.
- ⚠️ Ne pas `rm -rf apps/dashboard/.next` pendant que `next dev` tourne (corrompt le build → 500).

---

## 11. État vérifié au 2026-08-03

✅ `pnpm install` · dashboard et mobile **typecheck 0 erreur** (contre les types régénérés depuis la vraie base)
✅ **Bundle Android** exporté : 3277 modules, 6,86 Mo Hermes, 0 erreur
✅ `supabase start` : 3 migrations + seed appliqués sans erreur, stack saine sur les ports 5413x
✅ **Diffusion temps réel vérifiée de bout en bout** (`scripts-verif/realtime-check.mjs`) :
   horaires reçus par un client **anonyme**, annonces reçues par un **fidèle connecté**,
   et annonces **invisibles** de l'anonyme — la frontière RLS tient.
✅ Dashboard : login imam, publication d'une annonce depuis l'UI, apparition instantanée dans le fil.

⛔ Pas encore fait : app mobile jamais lancée sur téléphone (Expo Go), écrans Finances/Événements/
Fidèles jamais exercés avec des données réelles, mode clair inaccessible (cf. §3.5).

### Prochaines étapes
1. Lancer `pnpm mobile` et scanner le QR depuis un téléphone réel — **seul vrai test** de l'app.
   Penser à mettre l'**IP LAN** (pas `127.0.0.1`) dans `apps/mobile/.env`.
2. Exercer Finances (déclaration mobile → validation trésorier) et Événements avec des données.
3. Ajouter un sélecteur de thème pour rendre le mode clair atteignable.
4. Confirmer avec la mosquée : nom exact, logo, coordonnées GPS, numéros téléphone/WhatsApp
   (aujourd'hui des placeholders `+2250700000000` dans le mobile).
5. Décider du moment de bascule vers une **vraie API Mobile Money** (accord marchand nécessaire).
