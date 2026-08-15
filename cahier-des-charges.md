# Cahier des charges — Système de gestion de la Mosquée Fitia

> Fusion des deux cahiers d'origine (`cahier-des-charges-gestion-mosquee.md` pour le back-office
> et `cahier-des-charges-mobile-mosquee.md` pour l'application mobile), ajustée aux décisions
> prises avec le porteur du projet. Source de vérité **fonctionnelle** ; la source de vérité
> **technique** est `claudemap.md`.

---

## 1. Contexte

La **Mosquée Fitia**, dite « Petro Ivoire », à **Abobo (Abidjan, Côte d'Ivoire)**, souhaite gérer
de manière centralisée ses activités administratives, financières et communautaires, et offrir à
ses fidèles un service quotidien simple : connaître les horaires de prière, recevoir les annonces
de l'imam, et contribuer financièrement en toute transparence.

Deux produits, un seul backend :
- une **application mobile** pour les fidèles (Android en priorité) ;
- un **dashboard web** pour l'imam, le trésorier et le secrétaire.

### Écarts assumés par rapport aux cahiers d'origine

| Point d'origine | Décision retenue | Raison |
|---|---|---|
| Module École coranique / madrassa | **Retiré du périmètre et du modèle de données** | demande explicite du porteur du projet |
| Intégration API Mobile Money | **Preuve de paiement** en V1 (n° de transaction + validation trésorier) | aucune API n'est activable sans accord marchand ; le port `PaymentGateway` permet de brancher l'API plus tard sans réécrire |
| Horaires calculés par GPS | **Publiés par l'imam** depuis le dashboard | l'iqama réelle d'une mosquée ne suit pas le calcul astronomique ; la mosquée fait autorité sur ses horaires |
| Interface bilingue français/arabe | Français en V1, **arabe prévu** (chaînes centralisées, police Amiri et classe `.arabic` déjà en place) | ne pas retarder la mise en service |

---

## 2. Utilisateurs et rôles

| Rôle | Surface | Droits |
|---|---|---|
| **Fidèle** | Mobile | Horaires, annonces, agenda + inscription, déclaration de don/cotisation, profil et historique |
| **Secrétaire** | Dashboard | Fidèles, diffusion d'annonces, événements |
| **Trésorier** | Dashboard | Finances : validation des versements, dépenses, campagnes |
| **Imam** | Dashboard | Tout le back-office + publication des horaires de prière |
| **Administrateur** | Dashboard | Accès total : comptes, rôles, paramètres de la mosquée |

Les droits sont appliqués par **Row Level Security PostgreSQL**, pas par le client.
Point sensible : les **dépenses** ne sont jamais lisibles par un fidèle.

---

## 3. Modules fonctionnels

### 3.1 Horaires de prière *(cœur du produit)*
- Publication par l'imam d'une ligne par date : Fajr, Chourouk, Dhuhr, Asr, Maghrib, Isha, Djouma.
- Note libre affichée aux fidèles (ex. ajustement Ramadan).
- Programmation à l'avance ; republier une date corrige les horaires existants.
- **Diffusion temps réel** vers tous les téléphones (Supabase Realtime).
- Mobile : compte à rebours vivant jusqu'à la prochaine prière, date grégorienne + Hijri.
- Mobile : **rappel local** configurable (10 min avant), fonctionnant hors connexion.
- Mobile : **cache local** — les derniers horaires restent lisibles sans réseau.

### 3.2 Annonces et communication
- Diffusion d'annonces catégorisées : Info · Khutba · Événement · Urgent · Collecte.
- Épinglage des annonces importantes.
- Réception temps réel + notification push (Edge Function `send-push`).
- Contact direct de la mosquée depuis l'app : appel et WhatsApp.
- *(Phase ultérieure : diffusion groupée WhatsApp Business / SMS.)*

### 3.3 Fidèles
- Fiche : nom, téléphone, email, quartier, catégorie (membre actif / bienfaiteur / staff), statut d'adhésion.
- Numéro d'adhérent lisible attribué automatiquement (`FIT-00001`).
- Recherche, filtre par statut, **export CSV** (compatible Excel FR).
- Création automatique du profil à la première connexion OTP.

### 3.4 Finances
- **Cotisations** mensuelles : déclarées par le fidèle (montant + moyen + n° de transaction + mois couvert), validées par le trésorier. Une cotisation validée fait passer le fidèle « à jour ».
- **Dons** : Sadaqah, Zakat, ou don fléché sur une campagne ; possibilité d'anonymat.
- **Campagnes de collecte** : objectif chiffré, période, description (toiture, Ramadan, Waqf…).
- **Dépenses** : libellé, montant, catégorie (entretien, salaires, factures, événement, travaux), date.
- **Tableau de bord** : cotisations, dons, dépenses, solde — **seuls les montants validés comptent**.
- Historique personnel côté mobile avec numéro de reçu.
- *(Phase ultérieure : reçus PDF imprimables, rapports périodiques exportables pour l'assemblée des fidèles.)*

### 3.5 Événements
- Types : Djouma, conférence, Aïd, Ramadan, Salat al-Janazah, cours, autre.
- Création par le staff : titre, type, lieu, date/heure, capacité, description.
- Inscription en un geste depuis le mobile, désinscription possible.
- Dashboard : nombre d'inscrits, capacité, **taux de présence réel** (check-in / inscrits) sur les événements passés.

### 3.6 Administration
- Gestion des comptes du bureau et de leurs rôles (auto-modification bloquée).
- Paramètres de la mosquée : nom, adresse, ville, téléphone, WhatsApp.
- **Personnalisation visuelle** : couleur principale et couleur d'accent, surchargeant les tokens de marque.

---

## 4. Exigences techniques

- **Mobile-first** : le dashboard est responsive, mais l'usage majoritaire est le téléphone.
- **Android en priorité**, iOS ensuite (base de code unique Expo / React Native).
- **Connexions faibles et instables** : cache local, pas de dépendance graphique lourde, bundle optimisé.
- **Hors connexion partiel** : horaires et dernières annonces consultables sans réseau.
- **Authentification** : OTP SMS pour les fidèles (simple, pas de mot de passe à retenir) ; email + mot de passe pour le staff.
- **Sécurité** : RLS par rôle sur chaque table, fonctions `security definer` pour éviter la récursion.
- **Hébergement** : Supabase managé (Postgres + Auth + Realtime + Storage + Edge Functions), sauvegardes incluses.
- **Notifications** : rappels de prière en **local** (fonctionnent dans Expo Go et hors ligne) ; annonces en **push distante** (nécessite un build EAS — Expo Go ne reçoit plus les push distantes depuis Android SDK 53+).
- **Export** : CSV pour les fidèles ; PDF prévu pour les reçus et rapports.
- **Accessibilité** : contraste WCAG AA en mode clair et sombre, animations désactivables.

---

## 5. Priorisation

**Phase 1 — MVP**
- Horaires de prière + compte à rebours + rappels locaux
- Annonces (diffusion temps réel)
- Déclaration de don/cotisation + validation trésorier
- Fidèles (liste, export)

**Phase 2**
- Événements + inscriptions + présence
- Finances complètes (campagnes, dépenses, KPIs)
- Administration (rôles, paramètres)

**Phase 3**
- Push distantes (build EAS), canal WhatsApp
- Reçus PDF et rapports financiers pour l'assemblée des fidèles
- Interface arabe
- Mode hors-ligne avancé (file d'attente d'actions), version iOS

---

## 6. Points à confirmer avec la mosquée

- Nom exact à afficher et logo officiel.
- Coordonnées GPS précises (le seed utilise un centroïde d'Abobo, à corriger).
- Numéros de téléphone et WhatsApp officiels (actuellement des placeholders dans l'app mobile).
- Montant et périodicité de la cotisation de référence.
- Comptes Mobile Money marchands destinataires des versements.
- Nombre estimé de fidèles utilisateurs (dimensionnement du plan Supabase).
