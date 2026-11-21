# PeopleFlow — plan des fonctionnalités

## But

Créer un petit produit RH full stack pour gérer une équipe et son parcours
d’accueil, avec React, Vite, TypeScript, Hono et Supabase/Postgres. L’objectif
est de pratiquer une livraison par tranches verticales et de pouvoir montrer
le travail d’un agent de programmation dans une courte démo.

## Fonctionnalités, dans l’ordre

### 0. Base du projet

- Monorepo npm avec une application web et une API.
- Configuration TypeScript, Vite, Hono, Vitest et vérifications CI.
- Documentation des commandes et conventions de contribution.
- Critères : web et API démarrent séparément; `/api/health` répond; les tests
  et le typage peuvent être lancés à la racine.

### 1. Modèle de données et seed

- Tables `departments`, `employees`, `onboarding_tasks` et `audit_events`.
- Migration SQL avec clés étrangères, contraintes et index utiles.
- Seed reproductible de départements, employés fictifs et tâches d’accueil.
- Critères : réinitialiser la base recrée les mêmes données sans doublons.

### 2. Tableau de bord RH

- Compteurs d’employés actifs, d’arrivées à venir et de tâches d’accueil en
  retard.
- Activité récente et prochaines arrivées.
- Critères : les compteurs proviennent de l’API et reflètent les données seed.

### 3. Annuaire des employés

- Liste, recherche par nom ou poste, filtre par département et statut.
- État vide, chargement et erreur visibles.
- Critères : la recherche et les filtres se combinent et sont couverts par des
  tests ciblés.

### 4. Fiche et gestion d’un employé

- Consulter les coordonnées professionnelles, le rôle, le département, le
  gestionnaire, la date d’embauche et le statut.
- Créer et modifier une fiche avec validation côté API.
- Critères : données invalides refusées avec un message exploitable; le tableau
  de bord et l’annuaire se mettent à jour après une modification.

### 5. Parcours d’accueil

- Checklist de tâches pour chaque nouvelle recrue, avec responsable, échéance
  et état.
- Cocher ou rouvrir une tâche; afficher la progression globale.
- Critères : une action sur une tâche est persistée et journalisée.

## Cadence TDD et commits

Chaque tranche suit cette boucle : test ciblé en échec, implémentation minimale,
test vert, vérification de types et revue du diff, puis un commit. Les messages
commencent par un type comme `feat:`, `fix:`, `test:`, `docs:` ou `chore:`.
Chaque étape reste petite et doit pouvoir être expliquée en moins d’une
minute.

## Hors périmètre du premier MVP

- Authentification et gestion multi-entreprise.
- Envoi réel de courriels, création de comptes externes ou actions sur des
  services tiers.
- Évaluation de rendement, paie et données sensibles de santé.
- Agent autonome en production. Le premier MVP prépare une démonstration
  contrôlée de workflow; les idées d’automatisation sont listées dans
  `docs/agent-demo-ideas.md`.
