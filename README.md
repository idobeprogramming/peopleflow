# PeopleFlow

Application de démonstration de gestion d’employés avec React, Vite, Hono et
Supabase/Postgres. L’interface est en français; le code est en anglais.

Le plan priorisé est dans [`FEATURE_PLAN.md`](./FEATURE_PLAN.md). Le processus
de travail assisté par agents est décrit dans
[`docs/agent-workflow.md`](./docs/agent-workflow.md), et des idées de démo
automatisée sont dans [`docs/agent-demo-ideas.md`](./docs/agent-demo-ideas.md).

## Démarrage

Prérequis : Node.js 22.12 ou plus récent et Docker Desktop pour la base locale
Supabase.

```powershell
npm install
npm run dev:local
```

L’interface sera disponible sur `http://localhost:5173` et l’API sur
`http://localhost:3000`. La commande applique les migrations en attente, vérifie les quatre tables
et transmet la clé locale au processus serveur. Pour une démo en mémoire,
utilisez `npm run dev` avec les variables Supabase absentes.

La clé de service reste uniquement dans l’API. Ce projet est une démo locale;
il faut ajouter l’authentification avant de l’exposer à Internet.

## Contribution

Suivre le fichier [`AGENTS.md`](./AGENTS.md) : une petite fonctionnalité, un
test écrit d’abord, les vérifications pertinentes, puis un commit isolé.

## Livraison depuis une issue

Une issue créée avec un modèle (Fonctionnalité ou Bogue) devient une PR vers `staging`
quand un collaborateur pose le label `agent:ready` :

```text
agent:ready → triage (plan ou questions) → implémentation Codex → garde-fous
→ vérification sur un runner neuf (tests, Supabase, E2E, secrets) → PR + rapport
→ revue IA → approbation humaine → auto-merge → déploiement staging → smoke tests
```

Une issue dont le titre commence par `[démo]` cible plutôt la branche
`demo/broken-directory-filters`, qui garde volontairement le bug des filtres pour la vidéo.

Si la CI échoue sur une PR de l'agent, ou sur `/agent fix <consigne>` en commentaire,
l'agent corrige sur la même branche, deux fois au maximum, puis passe la main avec
le label `needs-human`. La promotion `staging → main` reste une PR approuvée.

Détails : [`docs/AUTOMATION_PLAN.md`](./docs/AUTOMATION_PLAN.md). Mise en service
(GitHub App, clés, déploiement) : [`docs/AUTOMATION_SETUP.md`](./docs/AUTOMATION_SETUP.md).

| Commande | Vérifie |
| --- | --- |
| `npm run check` | tests unitaires, typage, build |
| `npm run test:demo` | le scénario de la démo (sans dépendances) |
| `npm run test:agent` | les garde-fous et rapports de l'agent |
| `npm run test:e2e` | annuaire, création d'employé, tâche d'accueil (Playwright) |
| `npm run test:integration` | le dépôt Supabase contre la base locale (`npm run db:start`) |

Pour faire avancer plusieurs agents en local : `.\scripts\agent-worktree.ps1 -Issue 12`
crée un worktree isolé avec ses propres ports; `.\scripts\agent-cleanup.ps1` supprime
ceux dont la PR est fusionnée.

Pour tenir également le PC de démo à jour, démarrer Docker Desktop et ouvrir
PowerShell dans un clone dédié de la branche main avec accès en lecture à origin.
Lancer `.\scripts\serve-main.ps1` une fois et laisser ce terminal ouvert.
Toutes les 30 secondes le script récupère main. À chaque nouvelle version, il
relance PeopleFlow et applique les migrations locales. Une modification locale
ou une divergence suspend la synchronisation. Les journaux de l’application
sont dans `peopleflow-local.log` et `peopleflow-local-error.log`.
