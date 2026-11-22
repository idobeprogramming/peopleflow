# Sécurité

## Signaler une vulnérabilité

Ne pas ouvrir d'issue publique. Utiliser **Security → Report a vulnerability** sur ce dépôt.
Réponse visée : 7 jours.

## Modèle d'accès

| Action | Qui |
| --- | --- |
| Ouvrir une issue, commenter | tout le monde (dépôt public) |
| Lancer l'agent (`agent:ready`) | droit d'écriture, revérifié par l'API dans le workflow |
| `/agent fix` sur une PR | droit d'écriture, revérifié par l'API |
| Fusionner dans `staging` ou `main` | PR, 4 checks verts, approbation du propriétaire (CODEOWNERS) |
| Déployer en production | approbation de l'environnement `production` |

## Ce que l'agent peut et ne peut pas faire

- Le texte d'une issue est passé à Claude comme fichier de données, jamais interpolé
  dans un workflow.
- Les jobs où Claude travaille n'ont que `contents: read`, sans identifiants git
  persistés. Seul le job de publication pousse, avec un jeton d'App d'une heure, et
  seulement un patch qui a passé les garde-fous et la vérification complète.
- Les garde-fous (`scripts/agent/lib.mjs`, testés) rejettent un patch qui touche
  `.github/`, `AGENTS.md` ou `scripts/agent/`, ajoute un secret ou du code sans test, et
  demandent une décision humaine pour un test affaibli, une dépendance, le seed, une
  migration ou un diff de plus de 400 lignes.
- Les actions tierces qui reçoivent des secrets sont épinglées par SHA de commit.

## Risque résiduel accepté

Claude exécute les tests du dépôt (`npm run …`) pendant qu'il a accès au jeton de
l'abonnement. Une issue piégée pourrait en théorie lui faire exécuter du code qui lit
ce jeton. C'est pourquoi seul un collaborateur peut lancer l'agent : relire une issue
externe avant de lui poser `agent:ready`. En cas de doute, révoquer le jeton
(`claude setup-token` en génère un nouveau).
