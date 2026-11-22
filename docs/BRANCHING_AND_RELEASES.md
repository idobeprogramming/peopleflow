# Branches et livraisons

## Règle générale

`main` représente la production. Les pushes directs sont refusés après
l'activation de la protection de branche. Tout changement arrive par une pull
request.

`staging` représente l'environnement d'intégration. Les nouvelles fonctions y
sont assemblées, testées et déployées avant la production.

## Parcours normal

1. Ouvrir une issue avec le comportement attendu et les critères de réussite.
2. Créer une branche depuis `staging`, par exemple `feature/onboarding-template`
   ou `fix/directory-filters`.
3. Implémenter le changement et sa migration éventuelle.
4. Ouvrir une pull request vers `staging`.
5. Attendre la CI, les tests Supabase et les smoke tests.
6. Fusionner la pull request dans `staging`.
7. Vérifier l'environnement staging.
8. Ouvrir une pull request de `staging` vers `main`.
9. Fusionner après les vérifications de production.
10. Déployer l'image et les migrations validées en production.

L'agent d'issue cible `staging`. Sa pull request est donc vérifiée avant la
promotion vers `main`.

## Rôle des branches

| Branche | Usage | Source des changements |
| --- | --- | --- |
| `main` | Production | Pull request depuis `staging` |
| `staging` | Intégration et préproduction | Pull requests de fonctionnalités |
| `feature/*` | Nouvelle fonctionnalité | Issue |
| `fix/*` | Correction | Issue ou incident |
| `agent/*` | Branche temporaire de l'agent | Workflow issue |
| `demo/broken-directory-filters` | Bug volontaire pour la démonstration | Branche isolée |

## Protection de main et staging

Le script `scripts/setup-github.ps1` active les règles suivantes :

- pull request obligatoire;
- une approbation obligatoire;
- revue du propriétaire pour les fichiers sensibles;
- CI obligatoire;
- branche à jour avant fusion, sur `staging` seulement : chaque promotion ajoute à `main`
  un commit de fusion que `staging` (linéaire) ne peut pas contenir, et la CI de la PR teste
  déjà `staging` fusionnée dans `main`;
- historique linéaire sur `staging` (squash); commit de fusion pour la PR de promotion vers `main`;
- conversations résolues;
- force push et suppression interdits;
- règles appliquées aux administrateurs.

Une personne ayant un jeton GitHub administrateur du dépôt exécute une seule fois :

~~~powershell
$env:GH_TOKEN = 'github_pat_...'
.\scripts\setup-github.ps1
~~~

Le jeton reste dans la session PowerShell et ne doit pas être ajouté au dépôt.
Le script peut recevoir un autre dépôt avec `-Repository owner/repository`.

## Approbations

`staging` exige une PR et les 4 checks, sans approbation et sans exception pour les admins :
seul sur le dépôt, le propriétaire ne peut pas approuver ses propres PR, et une règle qu'on
contourne à chaque fois ne protège rien. Les PR de l'agent n'activent jamais l'auto-merge : le
clic de fusion d'une personne est la revue. `main` exige en plus une approbation, possible
puisque la PR de promotion est ouverte par l'App de l'agent.

## Synchronisation de la démo

`demo-sync.yml` fusionne `main` dans `demo/broken-directory-filters` à chaque push sur `main`,
puis vérifie que le test de démo échoue toujours. Un conflit ou un bug disparu fait échouer le
run, et le signalement automatique ouvre une issue.

## Fusions

Les PR de fonctionnalités vers `staging` sont fusionnées en squash. La PR
`staging → main`, ouverte par `promote.yml`, utilise un commit de fusion : `main`
contient alors toujours `staging`, et la comparaison suivante ne montre que les
nouveaux changements.

## Correctif urgent

Même chemin, en plus court : branche `fix/...` depuis `staging`, PR vers `staging`
(CI complète), puis la PR de promotion vers `main` s'ouvre toute seule. Personne ne
pousse directement sur `main`, même l'administrateur : la protection s'applique aux
admins. Un retour arrière se fait par une PR qui annule le commit (`git revert`), jamais
par un force push.

## Déploiement

Le pipeline est dans `ci.yml` : checks, puis déploiement de `staging` à chaque fusion et
de `main` après approbation de l'environnement `production`. Il est désactivé tant que la
variable `DEPLOY_ENABLED` ne vaut pas `true`.

## Migrations de base

Une modification PostgreSQL ajoute un fichier dans
`supabase/migrations/`. La pull request doit réussir le reset Supabase,
le seed et le lint du schéma. La migration est appliquée à staging après la
fusion, puis à production lors de la promotion. Les migrations destructives
sont séparées en étapes compatibles avec l'ancienne version de l'API.

## Bug de démonstration

La branche `demo/broken-directory-filters` contient volontairement le bug
dans `packages/domain/src/directory.ts`. Les branches `main` et `staging`
contiennent la correction.

Pour la vidéo, ouvrir une issue dont le titre commence par `[démo]`, par exemple
« [démo] Ventes et En accueil affichent trois personnes au lieu de Nicolas Gagnon ».
Le workflow prépare la correction et sa PR sur `demo/broken-directory-filters`.
Les autres issues ciblent `staging`.
