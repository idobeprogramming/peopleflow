# Démo PeopleFlow

## Incident préparé sur `demo/broken-directory-filters`

Dans Employés, sélectionner Ventes et En accueil, avec une recherche vide.
Le seed contient une seule recrue des ventes, Nicolas Gagnon. Jade Mercier
est déjà active et Sarah Karam travaille aux opérations. Elles apparaissent
toutes les deux en trop.

Le défaut se trouve dans `filterEmployees`, dans `packages/domain/src/directory.ts`.
Quand les deux filtres sont renseignés, une correspondance sur un seul des
deux champs suffit. L’annuaire React et la route Hono partagent cette fonction.
`main` et `staging` contiennent la correction; seule la branche de démo garde le bug.
Une issue dont le titre commence par `[démo]` y envoie l’agent.

## Tâche à donner à l’agent

> Une gestionnaire choisit Ventes et En accueil dans l’annuaire et voit trois
> personnes. Le seed en prévoit une seule. Reproduis le problème, trouve la cause
> et corrige-la. Préserve la recherche par nom et les filtres utilisés seuls.
> Montre les résultats avant et après et le diff final.

Le signal de départ est `npm run test:demo` (Node 22.13 ou ultérieur).
Cette commande fonctionne sans installer de dépendances et sans démarrer la base.
Pour la vidéo, montrer la sortie rouge, laisser l’agent travailler, puis montrer
le même test au vert. Avec les dépendances installées, lancer aussi
`npm run check` et confirmer le résultat dans l’annuaire. Intervenir si l’agent
modifie les données fictives ou assouplit le résultat attendu.

## Fonctionnalités à confier à l’agent pendant une autre démo

| Fonctionnalité | Critère de réussite visible |
| --- | --- |
| Filtrer les tâches en retard | Hier apparaît, aujourd’hui est exclu et terminer une tâche la retire du résultat. |
| Ajouter une tâche d’accueil à une recrue | La tâche reçoit un responsable et une échéance et reste visible après rechargement en mode Supabase. |
| Historique par employé | La fiche affiche uniquement les événements de cet employé, du plus récent au plus ancien. |
| Recherche sans accents | Saisir « loic » retrouve Loïc Tremblay et les filtres actifs restent appliqués. |
