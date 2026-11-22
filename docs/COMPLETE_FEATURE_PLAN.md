# Plan complet de PeopleFlow

## 1. Résultat visé

PeopleFlow devient une application RH que l'on peut installer, utiliser,
tester, déployer, surveiller et mettre à jour sans intervention manuelle pour
les opérations courantes.

Le produit cible une petite organisation qui veut gérer ses employés et leur
intégration. Le premier périmètre ne contient pas la paie, les évaluations de
rendement ou les données médicales.

Le chemin de livraison visé est le suivant.

```text
Issue GitHub
    -> agent de programmation
    -> branche et tests
    -> pull request
    -> CI
    -> migration Supabase validée
    -> image Docker
    -> staging
    -> production
    -> métriques, alertes et possibilité de retour arrière
```

## 2. Architecture cible

| Couche | Choix prévu | Responsabilité |
| --- | --- | --- |
| Interface | React, Vite, TypeScript | Navigation, formulaires, tableaux, états de chargement |
| API | Node.js, Hono, Zod | Autorisation, validation, règles métier et journalisation |
| Domaine | Package TypeScript partagé | Types, filtres, règles réutilisables et contrats |
| Base | PostgreSQL via Supabase | Données relationnelles, migrations, RLS et sauvegardes |
| Fichiers | Supabase Storage | Documents d'employés et pièces jointes, plus tard |
| Livraison | GitHub Actions, images Docker, GHCR | Vérification, publication et déploiement |
| Exécution | Conteneurs séparés web et API | Environnements local, staging et production |
| Observabilité | Logs structurés, métriques, traces et alertes | Diagnostic et disponibilité |

Le navigateur ne reçoit jamais la clé `service_role`. Toutes les règles
d'accès passent par l'API ou par les politiques RLS de Supabase.

## 3. Fonctionnalités produit

### 3.1 Espace de travail et organisations

- Créer une organisation et modifier son nom, son logo, son fuseau horaire et
  ses paramètres régionaux.
- Isoler les données par `organization_id`.
- Inviter un membre par courriel avec une invitation à durée limitée.
- Accepter, refuser ou révoquer une invitation.
- Gérer les rôles `owner`, `admin`, `manager` et `member`.
- Afficher uniquement les départements et employés autorisés par le rôle.
- Suspendre une organisation sans supprimer ses données.
- Préparer l'architecture multi-organisation avant d'ajouter des données
  réelles.

Critères de réussite : un utilisateur d'une organisation ne peut lire,
modifier ou supprimer aucune donnée d'une autre organisation, y compris en
changeant un identifiant dans l'URL.

### 3.2 Authentification et profil

- Connexion par courriel et mot de passe.
- Réinitialisation de mot de passe.
- Vérification du courriel.
- Déconnexion de toutes les sessions.
- Session persistante et expiration contrôlée.
- Page de profil avec nom, avatar, langue et fuseau horaire.
- Option MFA lorsque l'authentification sera stabilisée.
- Écran clair pour les comptes suspendus et les invitations expirées.

Critères de réussite : chaque route privée vérifie la session côté serveur et
chaque action vérifie le rôle requis.

### 3.3 Départements et postes

- Créer, modifier, archiver et réactiver un département.
- Afficher le nombre d'employés par département.
- Empêcher la suppression d'un département encore utilisé.
- Gérer les postes ou titres réutilisables.
- Définir le gestionnaire d'un département.
- Réaffecter plusieurs employés à un autre département.

### 3.4 Annuaire des employés

- Créer, consulter, modifier, archiver et réactiver un employé.
- Gérer le nom, courriel professionnel, poste, département, gestionnaire,
  statut, type d'emploi, date d'embauche et lieu.
- Ajouter des champs personnalisés non sensibles.
- Rechercher par nom complet, courriel, poste ou département.
- Rechercher sans tenir compte des accents et de la casse.
- Combiner recherche, statut, département, type d'emploi et lieu.
- Trier par nom, date d'embauche, statut ou département.
- Paginer côté API.
- Conserver les filtres dans l'URL.
- Sélectionner plusieurs employés et appliquer une action groupée.
- Importer un fichier CSV avec aperçu, validation par ligne et rapport
  d'erreurs téléchargeable.
- Exporter l'annuaire filtré en CSV.
- Afficher les états chargement, vide, erreur, permission refusée et conflit.
- Empêcher les doublons de courriel dans une organisation.
- Afficher une confirmation avant archivage.

### 3.5 Fiche détaillée d'un employé

- Afficher les informations professionnelles et l'organigramme immédiat.
- Afficher la date de création et la dernière modification.
- Afficher l'historique des changements autorisés.
- Modifier avec un formulaire partagé entre création et édition.
- Détecter les conflits si deux personnes modifient le même profil.
- Afficher les tâches d'accueil liées.
- Afficher les documents liés, lorsque le stockage sera ajouté.
- Afficher un historique par employé, filtré côté API.

### 3.6 Organigramme

- Afficher la hiérarchie sous forme de liste accessible.
- Afficher une vue graphique optionnelle.
- Naviguer du gestionnaire vers ses rapports directs.
- Refuser les boucles hiérarchiques.
- Signaler les employés sans gestionnaire lorsque l'organisation l'exige.
- Afficher les postes vacants comme option future.

### 3.7 Parcours d'accueil

- Créer des modèles de parcours par type de poste ou département.
- Générer les tâches d'une nouvelle recrue à partir d'un modèle.
- Définir titre, description, responsable, échéance, priorité et ordre.
- Définir une échéance relative à la date d'embauche.
- Ajouter des dépendances entre tâches.
- Mettre une tâche à `pending`, `in_progress`, `done` ou `cancelled`.
- Cocher et rouvrir une tâche depuis la liste et la fiche employé.
- Afficher progression par employé et progression globale.
- Filtrer les tâches en retard, aujourd'hui, cette semaine et à venir.
- Ajouter des commentaires à une tâche.
- Afficher la date de dernière modification et l'auteur de l'action.
- Réassigner une tâche.
- Dupliquer un modèle.
- Archiver un modèle sans casser les parcours existants.

Critères de réussite : toute transition d'état est persistée, autorisée,
idempotente et inscrite dans le journal d'audit.

### 3.8 Tableau de bord et rapports

- Compter employés actifs, en accueil, en congé et inactifs.
- Compter les arrivées dans une période choisie.
- Compter les tâches ouvertes et en retard.
- Afficher l'activité récente avec pagination.
- Afficher les prochaines arrivées.
- Afficher la composition par département et statut.
- Afficher la progression des parcours.
- Filtrer les indicateurs par période, département et statut.
- Exporter un rapport CSV.
- Prévoir un export PDF lorsque les indicateurs seront stabilisés.
- Afficher une date de dernière actualisation.

### 3.9 Notifications

- Notifications dans l'application.
- Préférences par utilisateur.
- Rappel de tâche en retard.
- Rappel avant une date d'embauche.
- Notification lorsqu'une tâche est assignée ou réassignée.
- Résumé quotidien ou hebdomadaire configurable.
- Modèles de courriels versionnés.
- File de livraison avec reprise et déduplication.
- Mode de développement qui intercepte les courriels sans les envoyer.

### 3.10 Espace employé

- Vue limitée de son propre profil.
- Tâches d'accueil qui lui sont assignées.
- Confirmation de lecture d'une information.
- Dépôt de documents non sensibles, lorsque le stockage sera disponible.
- Préférences de notification.
- Aucun accès aux données des autres employés sans permission.

### 3.11 Import, export et administration

- Assistant d'import CSV en quatre étapes : fichier, correspondance,
  validation, confirmation.
- Aperçu avant écriture.
- Rapport des lignes ignorées et des corrections proposées.
- Export conforme aux filtres appliqués.
- Journal des imports et exports.
- Page d'administration avec état de la base, version de l'application et
  dernière migration.
- Drapeaux de fonctionnalités pour activer une fonction par organisation.
- Mode démo avec données fictives réinitialisables.

### 3.12 Accessibilité, langue et expérience

- Interface française complète.
- Préparer les traductions anglaises derrière un catalogue.
- Navigation clavier complète.
- Labels et messages compatibles avec un lecteur d'écran.
- Contraste et états de focus conformes à WCAG 2.2 AA.
- Responsive téléphone, tablette et bureau.
- États de chargement avec skeletons.
- Erreurs récupérables et messages exploitables.
- Confirmation pour les actions irréversibles.
- Aucun texte de développement visible en production.

## 4. Domaine, API et PostgreSQL

### 4.1 Modèle de données

Tables de base :

- `organizations`
- `organization_members`
- `departments`
- `employees`
- `employee_custom_fields`
- `onboarding_templates`
- `onboarding_template_tasks`
- `onboarding_instances`
- `onboarding_tasks`
- `task_comments`
- `notifications`
- `notification_preferences`
- `audit_events`
- `file_assets`
- `feature_flags`

Chaque table métier contient une organisation, des clés étrangères, des
contraintes et des index adaptés aux filtres réellement utilisés.

### 4.2 Migrations et seed

- Une modification de schéma correspond à un fichier dans
  `supabase/migrations/`.
- Une migration est idempotente lorsqu'elle doit être rejouable.
- Les changements destructifs passent par une migration en plusieurs étapes.
- Ajouter une colonne nullable ou une nouvelle table avant de supprimer un
  ancien champ.
- Tester chaque migration sur une base vide et sur une base contenant des
  données représentatives.
- Garder `supabase/seed.sql` fictif, déterministe et réinitialisable.
- Générer les types TypeScript depuis le schéma lorsque le modèle sera plus
  stable.

Supabase fournit les commandes pour exécuter le stack local en CI, appliquer
les migrations et charger le seed. Les changements distants doivent passer
par les migrations plutôt que par une modification manuelle du tableau de
bord. https://supabase.com/docs/guides/deployment/database-migrations

### 4.3 API

- Versionner les routes publiques sous `/api/v1` lorsque le contrat sera
  utilisé par plusieurs clients.
- Valider toutes les entrées avec Zod.
- Utiliser un format d'erreur stable avec `code`, `message`, `details` et
  `requestId`.
- Ajouter pagination par curseur aux listes importantes.
- Ajouter tri et filtres validés par une liste blanche.
- Refuser les identifiants inconnus avec un `404` uniforme.
- Retourner `409` pour un conflit de courriel ou de version.
- Ajouter `Idempotency-Key` aux imports et aux actions répétables.
- Ajouter une limite de taille aux corps et fichiers.
- Ajouter CORS strict, timeouts, rate limiting et request ID.
- Ajouter documentation OpenAPI générée à partir des schémas.
- Séparer contrôleur, service métier et repository.
- Garder les secrets et accès privilégiés uniquement dans l'API.

### 4.4 RLS et autorisation

- Activer RLS sur les tables exposées.
- Écrire une politique pour chaque opération `select`, `insert`, `update` et
  `delete` nécessaire.
- Tester les politiques avec un utilisateur membre, gestionnaire, admin et
  sans organisation.
- Ne jamais utiliser la clé service dans le bundle web.
- Ajouter des tests qui tentent d'accéder à une autre organisation.

## 5. Tests et qualité

### 5.1 Tests obligatoires

- Tests unitaires du domaine et des filtres.
- Tests de routes API avec repository mémoire.
- Tests d'intégration API contre Supabase local.
- Tests de composants React pour les états et interactions critiques.
- Tests end-to-end avec Playwright sur une base seedée.
- Test de création, modification, archivage et recherche d'employé.
- Test de combinaison des filtres.
- Test de terminaison et réouverture d'une tâche.
- Test des permissions par rôle et organisation.
- Test de migration à partir d'une base vide.
- Test de migration sur un jeu de données existant.
- Test de fumée après déploiement.
- Test de restauration de sauvegarde à chaque répétition planifiée.

### 5.2 Qualité automatisée

- TypeScript strict.
- ESLint et formatage automatique.
- Vérification des fichiers générés et des migrations.
- Couverture publiée comme artefact.
- Détection de tests instables.
- Analyse des dépendances et des licences.
- Analyse de secrets dans les commits.
- Analyse CodeQL et scan des images Docker.
- Rapport de taille du bundle web.
- Vérification que les actions GitHub ont des permissions minimales.

## 6. Docker et environnements

### 6.1 Images

Créer des images séparées.

- `peopleflow-api` : build TypeScript dans une étape Node, image runtime
  minimale, utilisateur non root, `NODE_ENV=production`, endpoint de santé.
- `peopleflow-web` : build Vite dans une étape Node, serveur statique dans une
  image Nginx ou équivalente, cache des assets avec hash et fallback SPA.
- `.dockerignore` : exclure `.git`, `node_modules`, tests locaux, secrets et
  fichiers temporaires.
- Tags immuables par SHA et tags lisibles par version.
- Labels OCI avec dépôt, commit, version et date de build.
- Générer un SBOM et scanner les vulnérabilités avant publication.

### 6.2 Développement local

- `docker compose up` pour les services PeopleFlow locaux si nécessaire.
- `supabase start` pour PostgreSQL, Auth, REST et Studio locaux.
- `supabase db reset` pour recréer migrations et seed.
- API connectée à Supabase local par variables générées.
- Web connecté uniquement à l'API Hono.
- Healthchecks pour API et web.
- Volumes nommés pour les données locales quand une conservation est utile.
- Commande `npm run dev:local` qui démarre, migre, vérifie et lance l'app.

### 6.3 Environnements

- `test` : base jetable dans la CI.
- `development` : Supabase local et données fictives.
- `staging` : projet Supabase séparé, données fictives ou anonymisées.
- `production` : projet Supabase séparé, secrets et sauvegardes réelles.
- Variables documentées dans `.env.example`.
- Aucun secret commité.
- Build une seule fois, puis promouvoir la même image entre staging et
  production.

## 7. CI/CD GitHub

### 7.1 CI sur pull request et `main`

Pipeline `ci.yml`.

1. Checkout avec action maintenue.
2. Node 24 et cache npm.
3. `npm ci`.
4. Lint et formatage.
5. Tests unitaires et API.
6. Tests de démonstration.
7. Typecheck.
8. Build web et API.
9. Supabase local, reset, seed et lint du schéma.
10. Tests end-to-end.
11. Build Docker des deux images.
12. Scan des images, génération SBOM et conservation des rapports.

Le pipeline doit avoir `contents: read` par défaut et ajouter une permission
uniquement au job qui en a besoin. Les environnements GitHub peuvent limiter
les branches, secrets et validations avant un déploiement. https://docs.github.com/en/actions/concepts/workflows-and-actions/deployment-environments

### 7.2 Publication des images

Pipeline `container.yml`.

- Déclencher après une CI verte sur `main`.
- Construire avec BuildKit et `docker/build-push-action`.
- Publier sur GitHub Container Registry.
- Signer ou attester l'image lorsque le registre et l'hébergeur le permettent.
- Utiliser le SHA du commit comme tag immuable.
- Ajouter un tag de version lors d'une release.

Docker documente l'utilisation de Buildx et de `docker/build-push-action` dans
GitHub Actions pour construire et publier des images. https://docs.docker.com/build/ci/github-actions/

### 7.3 Déploiement staging

Pipeline `deploy-staging.yml`.

- Déclencher après fusion dans `main`.
- Déployer l'image immuable correspondante.
- Appliquer les migrations au projet Supabase staging.
- Exécuter un smoke test HTTP et un parcours Playwright court.
- Publier l'URL de staging dans le résumé de la workflow.
- Retourner automatiquement à l'image précédente si le smoke test échoue.

### 7.4 Déploiement production

Pipeline `deploy-production.yml`.

- Déclencher par tag `vX.Y.Z` ou lancement manuel contrôlé.
- Vérifier que la CI et staging sont vertes.
- Utiliser l'environnement GitHub `production`.
- Appliquer les migrations compatibles avec la version précédente.
- Déployer l'image déjà construite.
- Exécuter smoke tests, healthchecks et vérification de version.
- Envoyer une notification de succès ou d'échec.
- Garder l'image et la migration précédentes pour le rollback.

Les environnements GitHub permettent de protéger la production, de limiter les
branches autorisées et de retarder l'accès aux secrets jusqu'à l'approbation du
job. https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments

### 7.5 Maintenance automatisée

- Dependabot pour npm et les actions GitHub.
- Workflow hebdomadaire de tests et de scans.
- Rapport des dépendances obsolètes.
- Suppression automatique des artefacts expirés.
- Mise à jour des images de base après validation.
- Issue automatique pour les vulnérabilités ou les smoke tests échoués.

## 8. Déploiement et opérations

### 8.1 Santé et disponibilité

- `/api/health` : processus vivant.
- `/api/ready` : API, configuration et base accessibles.
- Timeout sur les appels externes et base de données.
- Arrêt gracieux lors du remplacement du conteneur.
- Limite de concurrence et taille de pool PostgreSQL.
- Retry avec backoff seulement pour les opérations sûres.
- Vérification externe de l'URL de production.
- SLO initial : 99,5 % de disponibilité mensuelle et p95 API sous 500 ms.

### 8.2 Logs, métriques et traces

- Logs JSON avec niveau, date, environnement, route, durée, statut et
  `requestId`.
- Ne jamais enregistrer mot de passe, token, clé service ou document privé.
- Compteurs de requêtes, erreurs, tâches en retard et latence.
- Traces API et base avec OpenTelemetry lorsque l'app sera assez stable.
- Tableau de bord staging et production.
- Alertes sur erreurs 5xx, latence, indisponibilité, saturation et échec de
  migration.

OpenTelemetry fournit les API et SDK JavaScript pour les traces et métriques,
avec les logs encore en évolution dans l'implémentation JavaScript. https://opentelemetry.io/docs/languages/js/

### 8.3 Sauvegardes et reprise

- Activer les sauvegardes Supabase adaptées au projet.
- Documenter la rétention et le point de restauration visé.
- Exporter périodiquement le schéma et les données nécessaires.
- Tester une restauration dans un projet séparé.
- Faire un exercice de restauration planifié.
- Documenter RPO, RTO et la procédure d'incident.
- Ne jamais considérer une sauvegarde comme valide sans restauration testée.

### 8.4 Gestion des incidents

- Runbook pour API indisponible, migration échouée, base indisponible,
  fuite de secret, image vulnérable et rollback.
- Issue ou alerte avec impact, heure, version et dernier changement.
- Mode maintenance contrôlé.
- Procédure de rotation des secrets.
- Postmortem court pour un incident réel.

## 9. Sécurité et confidentialité

- Sessions et cookies sécurisés.
- Protection CSRF si l'authentification utilise des cookies.
- CORS limité aux domaines connus.
- Headers de sécurité et CSP progressive.
- Rate limiting sur connexion, invitations, import et API publique.
- Validation serveur de tous les fichiers importés.
- Limite de taille et type MIME autorisé pour les documents.
- RLS et autorisation testées par rôle.
- Chiffrement en transit et au repos fourni par l'infrastructure.
- Rotation des secrets et tokens à durée limitée.
- CodeQL, Dependabot, secret scanning et scan Docker.
- Revue OWASP ASVS comme checklist de release.
- Politique de rétention et suppression des données.
- Export et suppression d'une organisation avec confirmation forte.
- Données seed uniquement fictives.

OWASP ASVS sert de base de vérification des contrôles techniques de sécurité
d'une application web. https://owasp.org/projects/asvs

## 10. Agent de programmation autonome

### 10.1 Déclenchement

- Une issue contient objectif, contexte, critères d'acceptation et limites.
- Labels `feature`, `bug`, `migration`, `security` et `needs-review`.
- L'agent refuse une issue sans critères vérifiables.
- L'agent crée une branche dédiée.

### 10.2 Travail de l'agent

- Lire `AGENTS.md`, le plan et les contrats existants.
- Reproduire le problème ou écrire le test d'abord.
- Modifier UI, API, domaine et migration nécessaires.
- Ajouter des tests ciblés.
- Exécuter les commandes CI localement.
- Produire un résumé des fichiers, risques, migration et vérifications.
- Ouvrir une PR liée à l'issue.

### 10.3 Garde-fous

- L'agent ne modifie pas le workflow, les règles de sécurité ou `AGENTS.md`.
- Une migration destructive demande une revue explicite.
- Aucun agent n'écrit directement dans la base de production.
- Les jobs utilisent des permissions minimales.
- Les secrets ne sont jamais inclus dans les logs, artefacts ou prompts.
- Une PR ne fusionne que si CI, migrations et smoke tests passent.
- Les changements de sécurité, d'autorisation et de production exigent une
  revue humaine au début du projet.
- Les changements simples peuvent être fusionnés automatiquement après une
  période de stabilité et des règles de branche fiables.

### 10.4 Sans clé API OpenAI

- Pour une action GitHub hébergée, le workflow doit disposer d'une méthode
  d'authentification au modèle.
- Pour utiliser un abonnement ChatGPT, employer un runner privé contrôlé par
  le propriétaire, connecter Codex avec `codex login`, puis lancer le travail
  avec `codex exec`.
- Garder l'authentification du runner dans son stockage local sécurisé.
- Ne pas utiliser cette configuration sur un dépôt public ou un runner partagé.
- Prévoir une alternative avec une clé API si le runner privé est indisponible.

## 11. Documentation et maintenance

- README avec démarrage local, Supabase, tests, Docker et déploiement.
- `AGENTS.md` avec conventions et limites de l'agent.
- ADR pour les choix structurants.
- Contrat API et exemples de requêtes.
- Schéma de données et diagramme des relations.
- Guide de migration.
- Runbook d'incident et rollback.
- Guide de rotation des secrets.
- Changelog automatique par release.
- Guide de contribution et définition de terminé.

## 12. Ordre de réalisation recommandé

### Phase 0 — Base reproductible

- Nettoyer les fichiers générés du dépôt.
- Stabiliser les scripts npm et le lockfile.
- Ajouter lint, formatage et vérification TypeScript.
- Corriger le bug volontaire après la démonstration.
- Faire passer la CI de base au vert.

### Phase 1 — MVP métier

- Finir CRUD employés et départements.
- Finir l'annuaire avec pagination, URL et filtres combinés.
- Finir la fiche et l'édition.
- Finir les tâches d'accueil persistées.
- Finir journal et tableau de bord.
- Ajouter tests API et composants.

### Phase 2 — Authentification et organisations

- Auth Supabase.
- Organisations et membres.
- Rôles et politiques RLS.
- Invitations et profil utilisateur.
- Tests d'isolation entre organisations.

### Phase 3 — Parcours d'accueil complet

- Modèles, dépendances, commentaires et notifications.
- Progression par recrue.
- Rappels et préférences.
- Espace employé limité.

### Phase 4 — Conteneurs et qualité

- Dockerfiles multi-étapes.
- Compose local.
- Tests end-to-end.
- Scan dépendances, CodeQL, scan images et SBOM.
- Healthchecks et logs structurés.

### Phase 5 — Staging automatisé

- Projet Supabase staging.
- GHCR.
- Déploiement après merge.
- Migrations staging.
- Smoke tests et rollback.

### Phase 6 — Production contrôlée

- Projet Supabase production.
- Environnement GitHub protégé.
- Sauvegardes et exercice de restauration.
- Déploiement par tag.
- Alertes et runbooks.

### Phase 7 — Agent autonome

- Issue templates.
- Agent issue → branche → PR.
- Commentaires de progression et artefacts.
- Garde-fous sur migrations et sécurité.
- Runner privé si l'authentification ChatGPT sans clé API est retenue.

### Phase 8 — Fonctions avancées

- Import/export CSV.
- Documents et stockage.
- Organigramme graphique.
- Rapports avancés.
- API publique ou intégrations tierces.
- Recherche PostgreSQL améliorée.
- Fonctionnalités de workflow configurables.

## 13. Définition de terminé pour chaque feature

Une feature est terminée seulement si elle possède :

- une issue avec critères d'acceptation;
- un test qui échoue avant l'implémentation;
- les types, validation et règles métier nécessaires;
- une migration versionnée si le schéma change;
- l'interface avec chargement, vide, erreur et succès;
- les permissions et contrôles d'accès;
- les tests automatisés;
- une mise à jour de la documentation;
- une vérification locale et CI;
- un plan de rollback si elle change les données ou le déploiement.

## 14. État actuel et prochaines tâches

Déjà présent : monorepo, interface React, API Hono, migrations de base,
seed fictif, employés, annuaire, création et modification de profils,
parcours d'accueil, journal d'activité, workflow d'issue, CI GitHub, tests de
migrations et Dependabot.

À faire en premier : corriger le bug volontaire de combinaison des filtres,
ajouter lint et formatage, stabiliser les tests, puis implémenter
l'authentification et l'isolation par organisation. Le Dockerfile, les images
GHCR et le déploiement staging viennent immédiatement après.

