# Branches et livraisons

## R�gle g�n�rale

`main` repr�sente la production. Les pushes directs sont refus�s apr�s
l'activation de la protection de branche. Tout changement arrive par une pull
request.

`staging` repr�sente l'environnement d'int�gration. Les nouvelles fonctions y
sont assembl�es, test�es et d�ploy�es avant la production.

## Parcours normal

1. Ouvrir une issue avec le comportement attendu et les crit�res de r�ussite.
2. Cr�er une branche depuis `staging`, par exemple `feature/onboarding-template`
   ou `fix/directory-filters`.
3. Impl�menter le changement et sa migration �ventuelle.
4. Ouvrir une pull request vers `staging`.
5. Attendre la CI, les tests Supabase et les smoke tests.
6. Fusionner la pull request dans `staging`.
7. V�rifier l'environnement staging.
8. Ouvrir une pull request de `staging` vers `main`.
9. Fusionner apr�s les v�rifications de production.
10. D�ployer l'image et les migrations valid�es en production.

L'agent d'issue cible `staging`. Sa pull request est donc v�rifi�e avant la
promotion vers `main`.

## R�le des branches

| Branche | Usage | Source des changements |
| --- | --- | --- |
| `main` | Production | Pull request depuis `staging` |
| `staging` | Int�gration et pr�production | Pull requests de fonctionnalit�s |
| `feature/*` | Nouvelle fonctionnalit� | Issue |
| `fix/*` | Correction | Issue ou incident |
| `agent/*` | Branche temporaire de l'agent | Workflow issue |
| `demo/broken-directory-filters` | Bug volontaire pour la d�monstration | Branche isol�e |

## Protection de main

Le script `scripts/protect-main.ps1` active les r�gles suivantes :

- pull request obligatoire;
- une approbation obligatoire;
- revue du propri�taire pour les fichiers sensibles;
- CI obligatoire;
- branche � jour avant fusion;
- historique lin�aire;
- conversations r�solues;
- force push et suppression interdits;
- r�gles appliqu�es aux administrateurs.

Une personne ayant un jeton GitHub administrateur du d�p�t ex�cute une seule fois :

~~~powershell
$env:GH_TOKEN = 'github_pat_...'
.\scripts\protect-main.ps1
~~~

Le jeton reste dans la session PowerShell et ne doit pas �tre ajout� au d�p�t.
Le script peut recevoir un autre d�p�t avec `-Repository owner/repository`.

## Migrations de base

Une modification PostgreSQL ajoute un fichier dans
`supabase/migrations/`. La pull request doit r�ussir le reset Supabase,
le seed et le lint du sch�ma. La migration est appliqu�e � staging apr�s la
fusion, puis � production lors de la promotion. Les migrations destructives
sont s�par�es en �tapes compatibles avec l'ancienne version de l'API.

## Bug de d�monstration

La branche `demo/broken-directory-filters` contient volontairement le bug
dans `packages/domain/src/directory.ts`. Les branches `main` et `staging`
contiennent la correction.

Pour la vid�o, ouvrir une issue d�crivant que les filtres � Ventes � et
� En accueil � affichent trois personnes au lieu de Nicolas Gagnon. Le workflow
de l'agent doit cr�er une branche depuis `staging`, reproduire le test,
corriger le filtre, faire passer la CI et ouvrir la pull request.

