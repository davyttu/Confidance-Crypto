# Déploiement et vérification – Paiements récurrents (Base Sepolia)

Pour tester les paiements récurrents avec **jour du mois 1–31** (période de test), il faut redéployer la factory récurrente sur Base Sepolia et la vérifier sur Basescan.

## Prérequis

- `.env` avec `PRIVATE_KEY`, `BASE_SEPOLIA_RPC`, `BASESCAN_API_KEY`
- Node et Hardhat installés

## Étapes (à exécuter sur ta machine)

### 1. Compiler les contrats

```bash
npx hardhat compile
```

Si tu as l’erreur HH505 (solc), essaie :

```bash
npx hardhat clean --global
npx hardhat compile
```

### 2. Déployer la factory récurrente sur Base Sepolia

```bash
npm run deploy:recurring
```

ou :

```bash
npx hardhat run scripts/deployFactoryRecurring.js --network base_sepolia
```

Le script écrit l’adresse dans `factory-recurring-deployment.test.json`.

### 3. Mettre à jour l’adresse dans le frontend

```bash
npm run update-frontend:recurring
```

Cela met à jour `confidance-frontend/src/lib/contracts/addresses.ts` (base_sepolia.factory_recurring) à partir de `factory-recurring-deployment.test.json`.

### 4. Vérifier le contrat sur Basescan Sepolia

```bash
npm run verify:recurring
```

ou manuellement (en utilisant l’adresse et `secondsPerMonth` affichés après le déploiement) :

```bash
npx hardhat verify --network base_sepolia <FACTORY_ADDRESS> 300
```

---

## Résumé

| Commande | Effet |
|----------|--------|
| `npm run deploy:recurring` | Déploie PaymentFactory_Recurring sur Base Sepolia (jour 1–31) |
| `npm run update-frontend:recurring` | Met à jour l’adresse dans le frontend |
| `npm run verify:recurring` | Vérifie le contrat sur sepolia.basescan.org |

Après ces étapes, tu peux tester les paiements récurrents avec un jour du mois entre 1 et 31 sur Base Sepolia.
