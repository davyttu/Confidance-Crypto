# Confidance Vocabulary Freeze v1.0

## 1. Introduction
### Vision Confidance
Confidance est un protocole de paiements programmables centré sur la clarté, la traçabilité et l’explicabilité des paiements.

### Pourquoi un vocabulaire figé est nécessaire
Un vocabulaire stable garantit des définitions identiques pour tous les usages (produit, technique, support, IA). Il évite les ambiguïtés et permet l’interopérabilité des données.

### Règle : on ajoute, on ne renomme jamais
Une fois un terme défini, il ne doit jamais être renommé. Les évolutions se font par ajout de nouveaux termes et par versioning.

## 2. Concept central : Payment
### Définition précise
Un Payment est une intention persistante de paiement, créée par un utilisateur, qui définit quoi payer, à qui, quand et selon quelles règles.

### Différence Payment vs Execution vs Transaction
- Payment : intention persistante et paramétrée.
- Execution : tentative d’exécuter un Payment à un instant donné.
- Transaction : opération technique enregistrée sur le réseau (ou équivalent) à la suite d’une Execution.

### Notion d’intention persistante
Un Payment existe indépendamment de son exécution. Il peut générer zéro, une ou plusieurs Executions selon son type.

## 3. Types de paiement (Payment Type)
### instant
Paiement exécuté immédiatement après création.

### scheduled
Paiement unique exécuté à une date planifiée.

### recurring
Paiement exécuté mensuellement sur une durée limitée.
- Durée limitée : le nombre de mensualités est défini à la création.
- Première mensualité différente : un montant initial peut être distinct des mensualités suivantes.
- Annulation à tout moment : le Payment peut être annulé avant une exécution future.

## 4. Identité d’un paiement (Payment Identity)
### label
Nom lisible par l’humain qui décrit le Payment.

### category
Catégorie fonctionnelle associée au Payment.

### caractère obligatoire
`label` et `category` sont obligatoires pour chaque Payment.

### rôle pour l’IA et l’analytics
Ils permettent l’explication, la classification et la création d’insights.

## 5. Participants
### payer
Le compte qui initie et finance le Payment.

### beneficiaries
Les comptes qui reçoivent le paiement.

### multi-bénéficiaires
Un Payment peut répartir un montant total entre plusieurs beneficiaries.

### règles de répartition
La somme des montants répartis doit correspondre au montant total défini par le Payment.

## 6. Statuts de paiement (Payment Status)
### draft
Payment créé mais non activé, aucune Execution possible.

### active
Payment actif, des Executions peuvent être générées selon la règle.

### paused
Payment temporairement suspendu, aucune Execution ne doit être lancée.

### cancelled
Payment annulé définitivement, aucune Execution future.

### completed
Payment terminé (toutes les Executions prévues ont eu lieu).

## 7. Execution
### définition
Une Execution est une tentative d’appliquer les règles d’un Payment à une date donnée.

### lien avec Payment
Une Execution est toujours rattachée à un Payment unique.

### Execution Status
- success : l’exécution a abouti.
- failed : l’exécution a échoué.
- pending : l’exécution est en attente de finalisation.

## 8. Timeline explicative
### définition
La Timeline est l’historique explicatif des événements d’un Payment.

### rôle
Elle garantit la traçabilité et la justification de chaque changement.

### règle “tout changement = event”
Tout changement d’état ou d’exécution d’un Payment doit créer un événement dans la Timeline.

### liste officielle des event_type
- payment_created
- payment_scheduled
- payment_executed
- payment_cancelled
- payment_failed
- payment_completed

### règles d’échec récurrent (skip)
Un `last_execution_hash` qui commence par `skipped_` signifie une Execution échouée.
Cet échec doit produire un event `payment_failed` (et ne doit jamais être compté comme `payment_executed`).

## 9. Catégories de paiement
### Liste officielle Confidance v1
- housing
- salary
- subscription
- utilities
- services
- transfer
- other

### Avertissement sur le sens sémantique
Ces catégories portent un sens métier précis et ne doivent pas être utilisées comme synonymes ou approximations.

## 10. Frais
### Gas Fee
Frais techniques nécessaires à l’exécution.

### Protocol Fee
Frais appliqués par Confidance pour le service.

### règles de transparence
Les frais doivent être affichés et tracés séparément.

## 11. Analytics
### Monthly Analytics
Vue mensuelle des paiements et exécutions.

### source unique : Timeline
La Timeline est la source de vérité des analytics.

### rôle explicatif
Les analytics doivent être justifiables à partir des événements.

## 12. Insights
### définition
Un Insight est une observation explicative non bloquante.

### non-bloquants
Un Insight ne modifie pas un Payment ni son exécution.

### exemples
- “Vos paiements services ont augmenté ce mois-ci.”
- “Vous avez annulé plusieurs paiements récents.”

## 13. IA Confidance
### Advisory AI
L’IA est uniquement conseillère et en lecture seule.

### limites strictes
L’IA ne crée ni n’exécute de paiements.

### traçabilité
Chaque conseil doit être traçable à des données explicites.

### confirmation humaine obligatoire
Toute action doit être confirmée par un humain.

## 14. Règles fondamentales Confidance
- Un paiement n’est pas une transaction.
- Une IA n’exécute jamais seule.
- Toute exécution est explicable.
- Tout chiffre est justifiable.
- Tout paiement est annulable avant exécution.

## 15. Versioning
### notion de version (v1.0)
Ce document définit la version officielle du vocabulaire Confidance v1.0.

### compatibilité future
Les futures versions doivent rester compatibles avec les définitions existantes.

### règle de non-régression sémantique
Aucune définition existante ne peut changer de sens dans une version ultérieure.
