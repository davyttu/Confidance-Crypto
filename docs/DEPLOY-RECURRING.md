# Déploiement et vérification – Paiements récurrents (Base Mainnet / Sepolia)

Ce document couvre le déploiement en **testnet (Base Sepolia)** et en **prod (Base Mainnet)**.
La factory accepte `secondsPerMonth` :
- **Testnet** : 300 (5 minutes)
- **Mainnet** : 2592000 (30 jours)

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

### 3. Mettre à jour l’adresse dans le frontend (testnet)

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

## Déploiement prod (Base Mainnet)

### 1. Déployer la factory récurrente sur Base Mainnet

```bash
npx hardhat run scripts/deployFactoryRecurring.js --network base_mainnet
```

Le script écrit l’adresse dans `factory-recurring-deployment.json`.

### 2. Mettre à jour l’adresse dans le frontend (prod)

- Mettre à jour `confidance-frontend/src/lib/contracts/addresses.ts` (fallback mainnet)
- Mettre à jour `NEXT_PUBLIC_PAYMENT_FACTORY_RECURRING` dans `.env.local`

### 3. Vérifier le contrat sur Basescan Mainnet

```bash
npx hardhat verify --network base_mainnet <FACTORY_ADDRESS> 2592000
```

---

## Résumé

| Commande | Effet |
|----------|--------|
| `npm run deploy:recurring` | Déploie PaymentFactory_Recurring sur Base Sepolia (jour 1–31) |
| `npm run update-frontend:recurring` | Met à jour l’adresse dans le frontend |
| `npm run verify:recurring` | Vérifie le contrat sur sepolia.basescan.org |

### Mainnet

| Commande | Effet |
|----------|--------|
| `npx hardhat run scripts/deployFactoryRecurring.js --network base_mainnet` | Déploie PaymentFactory_Recurring sur Base Mainnet (30 jours) |
| `npx hardhat verify --network base_mainnet <FACTORY_ADDRESS> 2592000` | Vérifie le contrat sur basescan.org |

Après ces étapes, tu peux tester les paiements récurrents sur Base Sepolia ou passer en prod sur Base Mainnet.
