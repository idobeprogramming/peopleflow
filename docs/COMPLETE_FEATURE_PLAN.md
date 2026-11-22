# Plan complet de PeopleFlow

## 1. R�sultat vis�

PeopleFlow devient une application RH que l'on peut installer, utiliser,
tester, d�ployer, surveiller et mettre � jour sans intervention manuelle pour
les op�rations courantes.

Le produit cible une petite organisation qui veut g�rer ses employ�s et leur
int�gration. Le premier p�rim�tre ne contient pas la paie, les �valuations de
rendement ou les donn�es m�dicales.

Le chemin de livraison vis� est le suivant.

```text
Issue GitHub
    -> agent de programmation
    -> branche et tests
    -> pull request
    -> CI
    -> migration Supabase valid�e
    -> image Docker
    -> staging
    -> production
    -> m�triques, alertes et possibilit� de retour arri�re
```

## 2. Architecture cible

| Couche | Choix pr�vu | Responsabilit� |
| --- | --- | --- |
| Interface | React, Vite, TypeScript | Navigation, formulaires, tableaux, �tats de chargement |
| API | Node.js, Hono, Zod | Autorisation, validation, r�gles m�tier et journalisation |
| Domaine | Package TypeScript partag� | Types, filtres, r�gles r�utilisables et contrats |
| Base | PostgreSQL via Supabase | Donn�es relationnelles, migrations, RLS et sauvegardes |
| Fichiers | Supabase Storage | Documents d'employ�s et pi�ces jointes, plus tard |
| Livraison | GitHub Actions, images Docker, GHCR | V�rification, publication et d�ploiement |
| Ex�cution | Conteneurs s�par�s web et API | Environnements local, staging et production |
| Observabilit� | Logs structur�s, m�triques, traces et alertes | Diagnostic et disponibilit� |

Le navigateur ne re�oit jamais la cl� `service_role`. Toutes les r�gles
d'acc�s passent par l'API ou par les politiques RLS de Supabase.

## 3. Fonctionnalit�s produit

### 3.1 Espace de travail et organisations

- Cr�er une organisation et modifier son nom, son logo, son fuseau horaire et
  ses param�tres r�gionaux.
- Isoler les donn�es par `organization_id`.
- Inviter un membre par courriel avec une invitation � dur�e limit�e.
- Accepter, refuser ou r�voquer une invitation.
- G�rer les r�les `owner`, `admin`, `manager` et `member`.
- Afficher uniquement les d�partements et employ�s autoris�s par le r�le.
- Suspendre une organisation sans supprimer ses donn�es.
- Pr�parer l'architecture multi-organisation avant d'ajouter des donn�es
  r�elles.

Crit�res de r�ussite : un utilisateur d'une organisation ne peut lire,
modifier ou supprimer aucune donn�e d'une autre organisation, y compris en
changeant un identifiant dans l'URL.

### 3.2 Authentification et profil

- Connexion par courriel et mot de passe.
- R�initialisation de mot de passe.
- V�rification du courriel.
- D�connexion de toutes les sessions.
- Session persistante et expiration contr�l�e.
- Page de profil avec nom, avatar, langue et fuseau horaire.
- Option MFA lorsque l'authentification sera stabilis�e.
- �cran clair pour les comptes suspendus et les invitations expir�es.

Crit�res de r�ussite : chaque route priv�e v�rifie la session c�t� serveur et
chaque action v�rifie le r�le requis.

### 3.3 D�partements et postes

- Cr�er, modifier, archiver et r�activer un d�partement.
- Afficher le nombre d'employ�s par d�partement.
- Emp�cher la suppression d'un d�partement encore utilis�.
- G�rer les postes ou titres r�utilisables.
- D�finir le gestionnaire d'un d�partement.
- R�affecter plusieurs employ�s � un autre d�partement.

### 3.4 Annuaire des employ�s

- Cr�er, consulter, modifier, archiver et r�activer un employ�.
- G�rer le nom, courriel professionnel, poste, d�partement, gestionnaire,
  statut, type d'emploi, date d'embauche et lieu.
- Ajouter des champs personnalis�s non sensibles.
- Rechercher par nom complet, courriel, poste ou d�partement.
- Rechercher sans tenir compte des accents et de la casse.
- Combiner recherche, statut, d�partement, type d'emploi et lieu.
- Trier par nom, date d'embauche, statut ou d�partement.
- Paginer c�t� API.
- Conserver les filtres dans l'URL.
- S�lectionner plusieurs employ�s et appliquer une action group�e.
- Importer un fichier CSV avec aper�u, validation par ligne et rapport
  d'erreurs t�l�chargeable.
- Exporter l'annuaire filtr� en CSV.
- Afficher les �tats chargement, vide, erreur, permission refus�e et conflit.
- Emp�cher les doublons de courriel dans une organisation.
- Afficher une confirmation avant archivage.

### 3.5 Fiche d�taill�e d'un employ�

- Afficher les informations professionnelles et l'organigramme imm�diat.
- Afficher la date de cr�ation et la derni�re modification.
- Afficher l'historique des changements autoris�s.
- Modifier avec un formulaire partag� entre cr�ation et �dition.
- D�tecter les conflits si deux personnes modifient le m�me profil.
- Afficher les t�ches d'accueil li�es.
- Afficher les documents li�s, lorsque le stockage sera ajout�.
- Afficher un historique par employ�, filtr� c�t� API.

### 3.6 Organigramme

- Afficher la hi�rarchie sous forme de liste accessible.
- Afficher une vue graphique optionnelle.
- Naviguer du gestionnaire vers ses rapports directs.
- Refuser les boucles hi�rarchiques.
- Signaler les employ�s sans gestionnaire lorsque l'organisation l'exige.
- Afficher les postes vacants comme option future.

### 3.7 Parcours d'accueil

- Cr�er des mod�les de parcours par type de poste ou d�partement.
- G�n�rer les t�ches d'une nouvelle recrue � partir d'un mod�le.
- D�finir titre, description, responsable, �ch�ance, priorit� et ordre.
- D�finir une �ch�ance relative � la date d'embauche.
- Ajouter des d�pendances entre t�ches.
- Mettre une t�che � `pending`, `in_progress`, `done` ou `cancelled`.
- Cocher et rouvrir une t�che depuis la liste et la fiche employ�.
- Afficher progression par employ� et progression globale.
- Filtrer les t�ches en retard, aujourd'hui, cette semaine et � venir.
- Ajouter des commentaires � une t�che.
- Afficher la date de derni�re modification et l'auteur de l'action.
- R�assigner une t�che.
- Dupliquer un mod�le.
- Archiver un mod�le sans casser les parcours existants.

Crit�res de r�ussite : toute transition d'�tat est persist�e, autoris�e,
idempotente et inscrite dans le journal d'audit.

### 3.8 Tableau de bord et rapports

- Compter employ�s actifs, en accueil, en cong� et inactifs.
- Compter les arriv�es dans une p�riode choisie.
- Compter les t�ches ouvertes et en retard.
- Afficher l'activit� r�cente avec pagination.
- Afficher les prochaines arriv�es.
- Afficher la composition par d�partement et statut.
- Afficher la progression des parcours.
- Filtrer les indicateurs par p�riode, d�partement et statut.
- Exporter un rapport CSV.
- Pr�voir un export PDF lorsque les indicateurs seront stabilis�s.
- Afficher une date de derni�re actualisation.

### 3.9 Notifications

- Notifications dans l'application.
- Pr�f�rences par utilisateur.
- Rappel de t�che en retard.
- Rappel avant une date d'embauche.
- Notification lorsqu'une t�che est assign�e ou r�assign�e.
- R�sum� quotidien ou hebdomadaire configurable.
- Mod�les de courriels versionn�s.
- File de livraison avec reprise et d�duplication.
- Mode de d�veloppement qui intercepte les courriels sans les envoyer.

### 3.10 Espace employ�

- Vue limit�e de son propre profil.
- T�ches d'accueil qui lui sont assign�es.
- Confirmation de lecture d'une information.
- D�p�t de documents non sensibles, lorsque le stockage sera disponible.
- Pr�f�rences de notification.
- Aucun acc�s aux donn�es des autres employ�s sans permission.

### 3.11 Import, export et administration

- Assistant d'import CSV en quatre �tapes : fichier, correspondance,
  validation, confirmation.
- Aper�u avant �criture.
- Rapport des lignes ignor�es et des corrections propos�es.
- Export conforme aux filtres appliqu�s.
- Journal des imports et exports.
- Page d'administration avec �tat de la base, version de l'application et
  derni�re migration.
- Drapeaux de fonctionnalit�s pour activer une fonction par organisation.
- Mode d�mo avec donn�es fictives r�initialisables.

### 3.12 Accessibilit�, langue et exp�rience

- Interface fran�aise compl�te.
- Pr�parer les traductions anglaises derri�re un catalogue.
- Navigation clavier compl�te.
- Labels et messages compatibles avec un lecteur d'�cran.
- Contraste et �tats de focus conformes � WCAG 2.2 AA.
- Responsive t�l�phone, tablette et bureau.
- �tats de chargement avec skeletons.
- Erreurs r�cup�rables et messages exploitables.
- Confirmation pour les actions irr�versibles.
- Aucun texte de d�veloppement visible en production.

## 4. Domaine, API et PostgreSQL

### 4.1 Mod�le de donn�es

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

Chaque table m�tier contient une organisation, des cl�s �trang�res, des
contraintes et des index adapt�s aux filtres r�ellement utilis�s.

### 4.2 Migrations et seed

- Une modification de sch�ma correspond � un fichier dans
  `supabase/migrations/`.
- Une migration est idempotente lorsqu'elle doit �tre rejouable.
- Les changements destructifs passent par une migration en plusieurs �tapes.
- Ajouter une colonne nullable ou une nouvelle table avant de supprimer un
  ancien champ.
- Tester chaque migration sur une base vide et sur une base contenant des
  donn�es repr�sentatives.
- Garder `supabase/seed.sql` fictif, d�terministe et r�initialisable.
- G�n�rer les types TypeScript depuis le sch�ma lorsque le mod�le sera plus
  stable.

Supabase fournit les commandes pour ex�cuter le stack local en CI, appliquer
les migrations et charger le seed. Les changements distants doivent passer
par les migrations plut�t que par une modification manuelle du tableau de
bord. ?https://supabase.com/docs/guides/deployment/database-migrations?

### 4.3 API

- Versionner les routes publiques sous `/api/v1` lorsque le contrat sera
  utilis� par plusieurs clients.
- Valider toutes les entr�es avec Zod.
- Utiliser un format d'erreur stable avec `code`, `message`, `details` et
  `requestId`.
- Ajouter pagination par curseur aux listes importantes.
- Ajouter tri et filtres valid�s par une liste blanche.
- Refuser les identifiants inconnus avec un `404` uniforme.
- Retourner `409` pour un conflit de courriel ou de version.
- Ajouter `Idempotency-Key` aux imports et aux actions r�p�tables.
- Ajouter une limite de taille aux corps et fichiers.
- Ajouter CORS strict, timeouts, rate limiting et request ID.
- Ajouter documentation OpenAPI g�n�r�e � partir des sch�mas.
- S�parer contr�leur, service m�tier et repository.
- Garder les secrets et acc�s privil�gi�s uniquement dans l'API.

### 4.4 RLS et autorisation

- Activer RLS sur les tables expos�es.
- �crire une politique pour chaque op�ration `select`, `insert`, `update` et
  `delete` n�cessaire.
- Tester les politiques avec un utilisateur membre, gestionnaire, admin et
  sans organisation.
- Ne jamais utiliser la cl� service dans le bundle web.
- Ajouter des tests qui tentent d'acc�der � une autre organisation.

## 5. Tests et qualit�

### 5.1 Tests obligatoires

- Tests unitaires du domaine et des filtres.
- Tests de routes API avec repository m�moire.
- Tests d'int�gration API contre Supabase local.
- Tests de composants React pour les �tats et interactions critiques.
- Tests end-to-end avec Playwright sur une base seed�e.
- Test de cr�ation, modification, archivage et recherche d'employ�.
- Test de combinaison des filtres.
- Test de terminaison et r�ouverture d'une t�che.
- Test des permissions par r�le et organisation.
- Test de migration � partir d'une base vide.
- Test de migration sur un jeu de donn�es existant.
- Test de fum�e apr�s d�ploiement.
- Test de restauration de sauvegarde � chaque r�p�tition planifi�e.

### 5.2 Qualit� automatis�e

- TypeScript strict.
- ESLint et formatage automatique.
- V�rification des fichiers g�n�r�s et des migrations.
- Couverture publi�e comme artefact.
- D�tection de tests instables.
- Analyse des d�pendances et des licences.
- Analyse de secrets dans les commits.
- Analyse CodeQL et scan des images Docker.
- Rapport de taille du bundle web.
- V�rification que les actions GitHub ont des permissions minimales.

## 6. Docker et environnements

### 6.1 Images

Cr�er des images s�par�es.

- `peopleflow-api` : build TypeScript dans une �tape Node, image runtime
  minimale, utilisateur non root, `NODE_ENV=production`, endpoint de sant�.
- `peopleflow-web` : build Vite dans une �tape Node, serveur statique dans une
  image Nginx ou �quivalente, cache des assets avec hash et fallback SPA.
- `.dockerignore` : exclure `.git`, `node_modules`, tests locaux, secrets et
  fichiers temporaires.
- Tags immuables par SHA et tags lisibles par version.
- Labels OCI avec d�p�t, commit, version et date de build.
- G�n�rer un SBOM et scanner les vuln�rabilit�s avant publication.

### 6.2 D�veloppement local

- `docker compose up` pour les services PeopleFlow locaux si n�cessaire.
- `supabase start` pour PostgreSQL, Auth, REST et Studio locaux.
- `supabase db reset` pour recr�er migrations et seed.
- API connect�e � Supabase local par variables g�n�r�es.
- Web connect� uniquement � l'API Hono.
- Healthchecks pour API et web.
- Volumes nomm�s pour les donn�es locales quand une conservation est utile.
- Commande `npm run dev:local` qui d�marre, migre, v�rifie et lance l'app.

### 6.3 Environnements

- `test` : base jetable dans la CI.
- `development` : Supabase local et donn�es fictives.
- `staging` : projet Supabase s�par�, donn�es fictives ou anonymis�es.
- `production` : projet Supabase s�par�, secrets et sauvegardes r�elles.
- Variables document�es dans `.env.example`.
- Aucun secret commit�.
- Build une seule fois, puis promouvoir la m�me image entre staging et
  production.

## 7. CI/CD GitHub

### 7.1 CI sur pull request et `main`

Pipeline `ci.yml`.

1. Checkout avec action maintenue.
2. Node 24 et cache npm.
3. `npm ci`.
4. Lint et formatage.
5. Tests unitaires et API.
6. Tests de d�monstration.
7. Typecheck.
8. Build web et API.
9. Supabase local, reset, seed et lint du sch�ma.
10. Tests end-to-end.
11. Build Docker des deux images.
12. Scan des images, g�n�ration SBOM et conservation des rapports.

Le pipeline doit avoir `contents: read` par d�faut et ajouter une permission
uniquement au job qui en a besoin. Les environnements GitHub peuvent limiter
les branches, secrets et validations avant un d�ploiement. ?https://docs.github.com/en/actions/concepts/workflows-and-actions/deployment-environments?

### 7.2 Publication des images

Pipeline `container.yml`.

- D�clencher apr�s une CI verte sur `main`.
- Construire avec BuildKit et `docker/build-push-action`.
- Publier sur GitHub Container Registry.
- Signer ou attester l'image lorsque le registre et l'h�bergeur le permettent.
- Utiliser le SHA du commit comme tag immuable.
- Ajouter un tag de version lors d'une release.

Docker documente l'utilisation de Buildx et de `docker/build-push-action` dans
GitHub Actions pour construire et publier des images. ?https://docs.docker.com/build/ci/github-actions/?

### 7.3 D�ploiement staging

Pipeline `deploy-staging.yml`.

- D�clencher apr�s fusion dans `main`.
- D�ployer l'image immuable correspondante.
- Appliquer les migrations au projet Supabase staging.
- Ex�cuter un smoke test HTTP et un parcours Playwright court.
- Publier l'URL de staging dans le r�sum� de la workflow.
- Retourner automatiquement � l'image pr�c�dente si le smoke test �choue.

### 7.4 D�ploiement production

Pipeline `deploy-production.yml`.

- D�clencher par tag `vX.Y.Z` ou lancement manuel contr�l�.
- V�rifier que la CI et staging sont vertes.
- Utiliser l'environnement GitHub `production`.
- Appliquer les migrations compatibles avec la version pr�c�dente.
- D�ployer l'image d�j� construite.
- Ex�cuter smoke tests, healthchecks et v�rification de version.
- Envoyer une notification de succ�s ou d'�chec.
- Garder l'image et la migration pr�c�dentes pour le rollback.

Les environnements GitHub permettent de prot�ger la production, de limiter les
branches autoris�es et de retarder l'acc�s aux secrets jusqu'� l'approbation du
job. ?https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments?

### 7.5 Maintenance automatis�e

- Dependabot pour npm et les actions GitHub.
- Workflow hebdomadaire de tests et de scans.
- Rapport des d�pendances obsol�tes.
- Suppression automatique des artefacts expir�s.
- Mise � jour des images de base apr�s validation.
- Issue automatique pour les vuln�rabilit�s ou les smoke tests �chou�s.

## 8. D�ploiement et op�rations

### 8.1 Sant� et disponibilit�

- `/api/health` : processus vivant.
- `/api/ready` : API, configuration et base accessibles.
- Timeout sur les appels externes et base de donn�es.
- Arr�t gracieux lors du remplacement du conteneur.
- Limite de concurrence et taille de pool PostgreSQL.
- Retry avec backoff seulement pour les op�rations s�res.
- V�rification externe de l'URL de production.
- SLO initial : 99,5 % de disponibilit� mensuelle et p95 API sous 500 ms.

### 8.2 Logs, m�triques et traces

- Logs JSON avec niveau, date, environnement, route, dur�e, statut et
  `requestId`.
- Ne jamais enregistrer mot de passe, token, cl� service ou document priv�.
- Compteurs de requ�tes, erreurs, t�ches en retard et latence.
- Traces API et base avec OpenTelemetry lorsque l'app sera assez stable.
- Tableau de bord staging et production.
- Alertes sur erreurs 5xx, latence, indisponibilit�, saturation et �chec de
  migration.

OpenTelemetry fournit les API et SDK JavaScript pour les traces et m�triques,
avec les logs encore en �volution dans l'impl�mentation JavaScript. ?https://opentelemetry.io/docs/languages/js/?

### 8.3 Sauvegardes et reprise

- Activer les sauvegardes Supabase adapt�es au projet.
- Documenter la r�tention et le point de restauration vis�.
- Exporter p�riodiquement le sch�ma et les donn�es n�cessaires.
- Tester une restauration dans un projet s�par�.
- Faire un exercice de restauration planifi�.
- Documenter RPO, RTO et la proc�dure d'incident.
- Ne jamais consid�rer une sauvegarde comme valide sans restauration test�e.

### 8.4 Gestion des incidents

- Runbook pour API indisponible, migration �chou�e, base indisponible,
  fuite de secret, image vuln�rable et rollback.
- Issue ou alerte avec impact, heure, version et dernier changement.
- Mode maintenance contr�l�.
- Proc�dure de rotation des secrets.
- Postmortem court pour un incident r�el.

## 9. S�curit� et confidentialit�

- Sessions et cookies s�curis�s.
- Protection CSRF si l'authentification utilise des cookies.
- CORS limit� aux domaines connus.
- Headers de s�curit� et CSP progressive.
- Rate limiting sur connexion, invitations, import et API publique.
- Validation serveur de tous les fichiers import�s.
- Limite de taille et type MIME autoris� pour les documents.
- RLS et autorisation test�es par r�le.
- Chiffrement en transit et au repos fourni par l'infrastructure.
- Rotation des secrets et tokens � dur�e limit�e.
- CodeQL, Dependabot, secret scanning et scan Docker.
- Revue OWASP ASVS comme checklist de release.
- Politique de r�tention et suppression des donn�es.
- Export et suppression d'une organisation avec confirmation forte.
- Donn�es seed uniquement fictives.

OWASP ASVS sert de base de v�rification des contr�les techniques de s�curit�
d'une application web. ?https://owasp.org/projects/asvs?

## 10. Agent de programmation autonome

### 10.1 D�clenchement

- Une issue contient objectif, contexte, crit�res d'acceptation et limites.
- Labels `feature`, `bug`, `migration`, `security` et `needs-review`.
- L'agent refuse une issue sans crit�res v�rifiables.
- L'agent cr�e une branche d�di�e.

### 10.2 Travail de l'agent

- Lire `AGENTS.md`, le plan et les contrats existants.
- Reproduire le probl�me ou �crire le test d'abord.
- Modifier UI, API, domaine et migration n�cessaires.
- Ajouter des tests cibl�s.
- Ex�cuter les commandes CI localement.
- Produire un r�sum� des fichiers, risques, migration et v�rifications.
- Ouvrir une PR li�e � l'issue.

### 10.3 Garde-fous

- L'agent ne modifie pas le workflow, les r�gles de s�curit� ou `AGENTS.md`.
- Une migration destructive demande une revue explicite.
- Aucun agent n'�crit directement dans la base de production.
- Les jobs utilisent des permissions minimales.
- Les secrets ne sont jamais inclus dans les logs, artefacts ou prompts.
- Une PR ne fusionne que si CI, migrations et smoke tests passent.
- Les changements de s�curit�, d'autorisation et de production exigent une
  revue humaine au d�but du projet.
- Les changements simples peuvent �tre fusionn�s automatiquement apr�s une
  p�riode de stabilit� et des r�gles de branche fiables.

### 10.4 Sans cl� API OpenAI

- Pour une action GitHub h�berg�e, le workflow doit disposer d'une m�thode
  d'authentification au mod�le.
- Pour utiliser un abonnement ChatGPT, employer un runner priv� contr�l� par
  le propri�taire, connecter Codex avec `codex login`, puis lancer le travail
  avec `codex exec`.
- Garder l'authentification du runner dans son stockage local s�curis�.
- Ne pas utiliser cette configuration sur un d�p�t public ou un runner partag�.
- Pr�voir une alternative avec une cl� API si le runner priv� est indisponible.

## 11. Documentation et maintenance

- README avec d�marrage local, Supabase, tests, Docker et d�ploiement.
- `AGENTS.md` avec conventions et limites de l'agent.
- ADR pour les choix structurants.
- Contrat API et exemples de requ�tes.
- Sch�ma de donn�es et diagramme des relations.
- Guide de migration.
- Runbook d'incident et rollback.
- Guide de rotation des secrets.
- Changelog automatique par release.
- Guide de contribution et d�finition de termin�.

## 12. Ordre de r�alisation recommand�

### Phase 0 - Base reproductible

- Nettoyer les fichiers g�n�r�s du d�p�t.
- Stabiliser les scripts npm et le lockfile.
- Ajouter lint, formatage et v�rification TypeScript.
- Corriger le bug volontaire apr�s la d�monstration.
- Faire passer la CI de base au vert.

### Phase 1 - MVP m�tier

- Finir CRUD employ�s et d�partements.
- Finir l'annuaire avec pagination, URL et filtres combin�s.
- Finir la fiche et l'�dition.
- Finir les t�ches d'accueil persist�es.
- Finir journal et tableau de bord.
- Ajouter tests API et composants.

### Phase 2 - Authentification et organisations

- Auth Supabase.
- Organisations et membres.
- R�les et politiques RLS.
- Invitations et profil utilisateur.
- Tests d'isolation entre organisations.

### Phase 3 - Parcours d'accueil complet

- Mod�les, d�pendances, commentaires et notifications.
- Progression par recrue.
- Rappels et pr�f�rences.
- Espace employ� limit�.

### Phase 4 - Conteneurs et qualit�

- Dockerfiles multi-�tapes.
- Compose local.
- Tests end-to-end.
- Scan d�pendances, CodeQL, scan images et SBOM.
- Healthchecks et logs structur�s.

### Phase 5 - Staging automatis�

- Projet Supabase staging.
- GHCR.
- D�ploiement apr�s merge.
- Migrations staging.
- Smoke tests et rollback.

### Phase 6 - Production contr�l�e

- Projet Supabase production.
- Environnement GitHub prot�g�.
- Sauvegardes et exercice de restauration.
- D�ploiement par tag.
- Alertes et runbooks.

### Phase 7 - Agent autonome

- Issue templates.
- Agent issue  branche  PR.
- Commentaires de progression et artefacts.
- Garde-fous sur migrations et s�curit�.
- Runner priv� si l'authentification ChatGPT sans cl� API est retenue.

### Phase 8 - Fonctions avanc�es

- Import/export CSV.
- Documents et stockage.
- Organigramme graphique.
- Rapports avanc�s.
- API publique ou int�grations tierces.
- Recherche PostgreSQL am�lior�e.
- Fonctionnalit�s de workflow configurables.

## 13. D�finition de termin� pour chaque feature

Une feature est termin�e seulement si elle poss�de :

- une issue avec crit�res d'acceptation;
- un test qui �choue avant l'impl�mentation;
- les types, validation et r�gles m�tier n�cessaires;
- une migration versionn�e si le sch�ma change;
- l'interface avec chargement, vide, erreur et succ�s;
- les permissions et contr�les d'acc�s;
- les tests automatis�s;
- une mise � jour de la documentation;
- une v�rification locale et CI;
- un plan de rollback si elle change les donn�es ou le d�ploiement.

## 14. �tat actuel et prochaines t�ches

D�j� pr�sent : monorepo, interface React, API Hono, migrations de base,
seed fictif, employ�s, annuaire, cr�ation et modification de profils,
parcours d'accueil, journal d'activit�, workflow d'issue, CI GitHub, tests de
migrations et Dependabot.

A faire en premier : corriger le bug volontaire de combinaison des filtres,
ajouter lint et formatage, stabiliser les tests, puis impl�menter
l'authentification et l'isolation par organisation. Le Dockerfile, les images
GHCR et le d�ploiement staging viennent imm�diatement apr�s.


