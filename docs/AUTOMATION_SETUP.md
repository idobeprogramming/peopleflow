# Mise en service du workflow automatisé

Tout ce qui vit dans le dépôt est prêt. Ce document liste ce qui demande tes comptes
(GitHub, OpenAI, Anthropic, hébergeur). Compter 30 à 45 minutes la première fois.

## 1. Pousser le dépôt

```powershell
git push origin main
```

## 2. Configurer GitHub (script)

Créer un jeton à grain fin limité au dépôt, avec **Administration**, **Contents**,
**Environments** et **Issues** en lecture et écriture (7 jours suffisent), puis :

```powershell
$env:GH_TOKEN = 'github_pat_...'
.\scripts\setup-github.ps1
Remove-Item Env:GH_TOKEN
```

Le script est rejouable. Il :

- règle les fusions (squash pour les fonctionnalités, commit de fusion pour la promotion),
  active l'auto-merge et la suppression des branches fusionnées;
- met `GITHUB_TOKEN` en lecture seule par défaut;
- crée les labels de `.github/labels.json`;
- crée `staging` depuis `main`;
- protège `main` et `staging` (CI obligatoire, 1 approbation, CODEOWNERS);
- crée les environnements `staging` et `production` (production exige ton approbation).

**Dépôt privé avec un compte gratuit :** GitHub refuse la protection de branches et
l'approbation des déploiements. Le script le signale et continue. L'agent n'active alors
jamais l'auto-merge (sur une branche non protégée, il fusionnerait sans attendre) : ses PR
restent ouvertes jusqu'à ta fusion. Rendre le dépôt public ou passer à GitHub Pro, puis
relancer le script, active tout.

## 3. Créer la GitHub App de l'agent

Les PR ouvertes avec `GITHUB_TOKEN` ne déclenchent pas la CI. L'agent publie donc avec une App.

1. GitHub → Settings → Developer settings → GitHub Apps → **New GitHub App**.
   - Nom : `PeopleFlow Agent` (ou autre nom libre). Homepage : l'URL du dépôt.
   - Webhook : décocher **Active**.
   - Permissions du dépôt : **Contents** lecture/écriture, **Pull requests** lecture/écriture,
     **Issues** lecture/écriture, **Metadata** lecture. Rien d'autre.
   - Installable : **Only on this account**.
2. **Generate a private key** (télécharge un `.pem`).
3. **Install App** → seulement le dépôt `peopleflow`.
4. Dans le dépôt → Settings → Secrets and variables → Actions :
   - variable `AGENT_APP_ID` = l'App ID affiché sur la page de l'App;
   - secret `AGENT_APP_PRIVATE_KEY` = le contenu complet du `.pem`.
   Supprimer ensuite le `.pem` local.

## 4. Clés des agents

| Nom | Type | Usage | Obligatoire |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | secret | Claude : triage, implémentation, correction et revue | oui |
| `AGENT_MODEL` | variable | Modèle Claude pour coder (ex. `claude-opus-5-5`) | non |
| `AGENT_TRIAGE_MODEL` | variable | Modèle plus léger pour le triage (ex. `claude-haiku-5-5`) | non |
| `AGENT_BASE_BRANCH` | variable | Branche cible (défaut `staging`) | non |
| `AI_REVIEW` | variable | `off` pour couper la revue IA | non |

Mettre une limite de dépense mensuelle sur le compte Anthropic (console.anthropic.com).

La revue IA utilise aussi Claude, dans une session séparée qui ne voit que le diff, l'issue
et ses propres consignes, jamais le raisonnement de l'implémentation. C'est moins
indépendant qu'un autre fournisseur; les garde-fous et la CI restent les vrais filets.

## 5. Déploiement (facultatif pour la démo)

Recommandé : un service web **Render** à partir d'une image (`ghcr.io/idobeprogramming/peopleflow`)
et un projet **Supabase** par environnement. N'importe quel hébergeur avec un
« deploy hook » qui accepte `imgURL` fonctionne aussi.

Variables d'environnement du service (sur l'hébergeur) :
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `BASIC_AUTH_USER`, `BASIC_AUTH_PASSWORD`.
L'image refuse de démarrer sans auth Basic : l'application n'a pas encore de connexion.

Dans GitHub, **par environnement** (`staging`, puis `production`) :

| Nom | Type | Valeur |
| --- | --- | --- |
| `APP_URL` | variable | URL publique du service |
| `SUPABASE_PROJECT_REF` | variable | Référence du projet Supabase |
| `SUPABASE_DB_PASSWORD` | secret | Mot de passe de la base |
| `DEPLOY_HOOK` | secret | URL du deploy hook de l'hébergeur |
| `BASIC_AUTH` | secret | `utilisateur:motdepasse`, pour les smoke tests |

Au niveau du dépôt : secret `SUPABASE_ACCESS_TOKEN` (jeton personnel Supabase) et variable
`STAGING_URL` (utilisée dans les commentaires et le rapport quotidien).

Chaque étape absente est sautée avec un avis dans le journal. La CI ne casse pas pour autant.

## 6. Premier essai

1. Ouvrir une issue avec le modèle **Bogue**, titrée
   « [démo] Ventes et En accueil affichent 3 personnes au lieu de Nicolas Gagnon ».
   Le préfixe `[démo]` envoie l'agent sur `demo/broken-directory-filters`, où le bug existe
   encore (il est corrigé sur `main` et `staging`).
2. Poser le label `agent:ready`.
3. Suivre : commentaire de prise en charge → plan → PR vers la branche de démo avec rapport →
   revue IA → ton approbation → fusion.

Pour un essai sur `staging` (avec déploiement), prendre une issue sans `[démo]`, par exemple
une ligne de `docs/demo-features.md` : « Recherche sans accents ».

Si la configuration est incomplète, l'agent le dit dans l'issue et s'arrête.
