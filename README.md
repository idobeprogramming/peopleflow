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
npx supabase start
npx supabase db reset
npm run dev
```

L’interface sera disponible sur `http://localhost:5173` et l’API sur
`http://localhost:3000`. Sans identifiants Supabase dans `.env`, l’API utilise
le seed fictif en mémoire. Pour tester Postgres, copiez `.env.example` vers
`.env`, puis ajoutez-y `API_URL` comme `SUPABASE_URL` et `SERVICE_ROLE_KEY`
comme `SUPABASE_SERVICE_ROLE_KEY` depuis `npx supabase status -o env`.

La clé de service reste uniquement dans l’API. Ce projet est une démo locale;
il faut ajouter l’authentification avant de l’exposer à Internet.

## Contribution

Suivre le fichier [`AGENTS.md`](./AGENTS.md) : une petite fonctionnalité, un
test écrit d’abord, les vérifications pertinentes, puis un commit isolé.
