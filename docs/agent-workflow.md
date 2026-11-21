# Workflow de développement avec agent

Le dépôt est configuré pour qu’un agent avance sur une demande limitée sans
attendre une nouvelle consigne pour chaque sous-étape.

## Boucle pour une demande

1. Lire les consignes du dépôt, la demande et ses critères d’acceptation.
2. Résumer le résultat attendu et les fichiers probablement concernés.
3. Écrire le test de comportement avant l’implémentation.
4. Modifier le moins de code possible pour faire passer le test.
5. Lancer tests, typage et build concernés; examiner les erreurs et corriger
   celles causées par le changement.
6. Lire le diff, vérifier les données et les limites d’accès, puis créer un
   commit isolé.
7. Signaler ce qui a changé, ce qui a été vérifié, les limites restantes et
   toute décision qui nécessite une personne.

## Limites de l’agent

- Les données seed sont fictives et locales.
- L’agent ne voit aucun secret et ne contacte pas de vrais employés.
- Il peut préparer des actions et des brouillons; une personne approuve toute
  action externe ou irréversible.
- En cas de données manquantes, de doublon possible ou d’échec d’une étape, il
  arrête cette action, conserve le contexte et explique le blocage.

## Déroulé possible pour la vidéo

Choisir une issue telle que « Ajouter un filtre par département », laisser
l’agent lire les critères, écrire d’abord un test, implémenter le filtre,
lancer les vérifications et préparer un commit. Montrer ensuite une erreur
volontaire de critère ou de données, comment le test la détecte, et le point où
l’agent s’arrête pour demander une décision. Ce dépôt ne doit pas prétendre
qu’un agent a exécuté des étapes qu’on n’a pas réellement observées.
