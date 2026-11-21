# Idées de démonstration d’un workflow automatisé

Ces idées sont prévues pour des étapes ultérieures. Elles ne sont pas encore
implémentées dans le MVP.

## Meilleure première démo : préparer l’accueil d’une recrue

Déclencheur : une personne RH crée une fiche avec une date d’entrée.

L’agent peut ensuite, sans solliciter une nouvelle consigne à chaque tâche :

1. vérifier que les champs nécessaires sont présents;
2. repérer les doublons possibles et arrêter si le résultat est ambigu;
3. créer une checklist selon le département et le type de poste;
4. proposer un responsable et des échéances à partir de règles explicites;
5. rédiger un message d’accueil et un résumé pour le gestionnaire;
6. vérifier que les tâches sont cohérentes et présenter un récapitulatif.

Une personne approuve le message avant tout envoi. La démo montre clairement le
déclencheur, les actions automatiques, les vérifications et le résultat pour
RH et la recrue.

## Autres ajouts utiles

- Générer les tâches d’équipement et d’accès selon le rôle, avec approbation
  avant toute demande réelle au service informatique.
- Résumer les tâches en retard et suggérer les prochaines relances sans les
  envoyer automatiquement.
- Détecter les fiches probablement en double et demander une confirmation.
- Préparer le parcours de départ d’un employé avec révocation d’accès en étape
  manuelle et vérifiable.
- Ajouter une simulation d’exécution afin de montrer les actions prévues sans
  toucher aux données réelles.

## Détection et reprise

Chaque étape devrait avoir une entrée attendue, une sortie vérifiable, un état
`en attente / réussi / bloqué / à approuver`, et un journal horodaté. En cas
d’échec, l’agent conserve les étapes réussies, évite de créer des doublons lors
d’une reprise et explique ce qu’une personne doit décider.
