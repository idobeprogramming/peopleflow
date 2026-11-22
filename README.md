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

Le workflow `.github/workflows/issue-agent.yml` traite les issues ouvertes ou
rouvertes par un membre du projet. Codex prépare le changement. Un autre runner
vérifie le patch, les tests, le typage, la compilation et les migrations sur une
instance Supabase jetable. Après validation, le workflow ouvre une PR et tente
une fusion squash. Un échec est signalé sur l’issue avec le journal GitHub Actions.

Pour activer ce workflow sur le dépôt GitHub, publier cette branche comme branche
par défaut, activer Actions et la création de PR par GitHub Actions, autoriser les
fusions squash et configurer le secret Actions `OPENAI_API_KEY`. Les règles de
protection de branche doivent permettre cette fusion. La première issue de la
démo peut porter sur les filtres Ventes et En accueil.

Pour tenir également le PC de démo à jour, démarrer Docker Desktop et ouvrir
PowerShell dans un clone dédié de la branche main avec accès en lecture à origin.
Lancer `.\scripts\serve-main.ps1` une fois et laisser ce terminal ouvert.
Toutes les 30 secondes le script récupère main. À chaque nouvelle version, il
relance PeopleFlow et applique les migrations locales. Une modification locale
ou une divergence suspend la synchronisation. Les journaux de l’application
sont dans `peopleflow-local.log` et `peopleflow-local-error.log`.
