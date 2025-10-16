<p align="center">
  <img src="assets/logo.png" alt="Confidance Crypto" width="160"/>
</p>

# 💎 Confidance Crypto

**Confidance Crypto** est une plateforme de paiements programmés sécurisés par la blockchain Core DAO.  
Elle permet de programmer des transferts crypto à effet de temps :  
cadeaux, salaires différés, épargne bloquée, héritages, et abonnements.

---

## 🚀 Fonctionnalités principales

- 🎁 **Cadeaux programmés** : envoyer 1000 $ à Jean le jour de son anniversaire.  
- 📆 **Abonnements / mensualités** : payer 50 $ à Louis tous les 10 du mois.  
- 🪙 **Épargne différée** : s’envoyer 500 $ à soi-même dans 1 an.  
- 💼 **Salaires différés** : libérer 2000 $ à un freelance après 3 mois.  
- 🕊️ **Transmission crypto** : transférer automatiquement X $ dans Y années.

---

## 🧱 Structure du projet

```
ConfidanceCrypto/
├── assets/           # Logo, icônes et visuels
├── contracts/        # Smart contracts Solidity
├── hardhat/          # Environnement de déploiement Core DAO
├── frontend/         # Application web React + Tailwind
├── keeper/           # Node.js scheduler pour paiements
└── docs/             # Maquettes, moodboard, livre d'or
```

---

## ⚙️ Installation

```bash
git clone https://github.com/tonprofil/confidance-crypto.git
cd confidance-crypto
```

### 1. Déployer les contrats
```bash
cd hardhat
npm install
npx hardhat compile
npx hardhat run scripts/deploy-testnet.js --network core_testnet
```

### 2. Lancer le frontend
```bash
cd ../frontend
npm install
npm run dev
```

### 3. Démarrer le keeper
```bash
cd ../keeper
npm install
node index.js
```

---

## 🔒 Sécurité

Chaque paiement est scellé dans un **smart contract unique** sur la blockchain Core DAO.  
Aucun tiers ne peut intercepter, modifier ou retarder le transfert.  
La confiance est dans le code.

---

# 💎 Confidance Crypto

**Plateforme DeFi pour programmer des paiements automatiques on-chain**

![Status](https://img.shields.io/badge/status-production-success)
![Network](https://img.shields.io/badge/network-Base%20Mainnet-blue)
![Solidity](https://img.shields.io/badge/solidity-0.8.20-orange)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 🎯 Vision

Confidance Crypto permet de programmer des paiements en cryptomonnaie qui s'exécutent automatiquement à une date précise, sans intermédiaire centralisé.

**Use cases :**
- 💼 Salaires automatiques
- 🏠 Loyers programmés
- 💳 Abonnements décentralisés
- 🎁 Cadeaux futurs
- 📊 Pensions alimentaires

---

## ✨ Fonctionnalités

### ✅ Implémentées

- **Paiements programmés** : ETH verrouillé jusqu'à une date précise
- **Système de fees automatique** : 1.79% prélevé lors de l'exécution
- **Keeper automatique 24/7** : Surveillance et exécution automatique
- **Multi-paiements** : Gestion de plusieurs paiements simultanés
- **Database Supabase** : Architecture scalable
- **Multichain ready** : Base Mainnet (Polygon, Arbitrum à venir)

### 🚧 En développement

- **Paiements annulables** : Option de remboursement avant échéance
- **Frontend React** : Interface utilisateur web
- **Paiements récurrents** : Mensuels, hebdomadaires
- **Support multi-tokens** : USDC, DAI, USDT

---

## 🏗️ Architecture

```
┌─────────────────────────────────────┐
│   Frontend (Next.js - Coming Soon) │
│   - Création paiements              │
│   - Dashboard utilisateur           │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Supabase Database                 │
│   - scheduled_payments              │
│   - Multi-user support              │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Keeper Cloud (Render.com)         │
│   - Surveillance 24/7               │
│   - Exécution automatique           │
│   - Health check endpoint           │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Smart Contracts (Solidity)        │
│   - ScheduledPayment.sol            │
│   - ScheduledPaymentResolver.sol    │
│   - PaymentFactory.sol              │
└─────────────────────────────────────┘
```

---

## 🚀 Installation

### Prérequis

- Node.js >= 18.0.0
- npm ou yarn
- Compte Supabase (gratuit)
- Wallet avec ETH sur Base Mainnet

### Setup

```bash
# Clone le repo
git clone https://github.com/TON_USERNAME/confidance-crypto.git
cd confidance-crypto

# Installe les dépendances
npm install

# Configure les variables d'environnement
cp .env.example .env
# Remplis .env avec tes clés

# Compile les contrats
npx hardhat compile

# Configure Supabase
# 1. Crée un projet sur https://supabase.com
# 2. Exécute le SQL dans supabase-schema.sql
# 3. Ajoute SUPABASE_URL et SUPABASE_KEY dans .env
```

---

## 📦 Déploiement

### Déployer un paiement test

```bash
# Sur Base Mainnet (8 minutes)
npx hardhat run scripts/deployBaseMainnet.js --network base_mainnet
```

### Lancer le keeper local

```bash
cd keeper-cloud
node index.js
```

### Déployer le keeper sur Render

1. Connecte ton repo GitHub à Render
2. Configure les variables d'environnement
3. Deploy automatique à chaque push

---

## 💰 Business Model

**Fees protocole : 1.79% par transaction**

Répartition lors de l'exécution d'un paiement de 0.1 ETH :
- Bénéficiaire : 0.09821 ETH (98.21%)
- Protocole : 0.00179 ETH (1.79%)

**Wallet protocole :** `0xa34eDf91Cc494450000Eef08e6563062B2F115a9`

---

## 🔧 Stack Technique

### Smart Contracts
- Solidity 0.8.20
- OpenZeppelin (ReentrancyGuard)
- Hardhat

### Backend
- Node.js + Express
- Ethers.js v6
- Supabase (PostgreSQL)

### Infrastructure
- Render.com (Keeper 24/7)
- Base Mainnet (chainId: 8453)
- Basescan (Explorer)

### Frontend (Coming Soon)
- Next.js 14
- Wagmi v2 + RainbowKit
- TailwindCSS + Shadcn/ui

---

## 📊 Statistiques

- **Paiements exécutés** : 15+
- **Taux de succès** : 100%
- **Networks** : Base Mainnet
- **Uptime keeper** : 99.9%

---

## 🧪 Tests

```bash
# Tests unitaires
npx hardhat test

# Test local du système complet
npx hardhat run scripts/testLocalFees.js

# Test d'annulation
npx hardhat run scripts/testCancelPayment.js

# Vérifier un contrat déployé
npx hardhat run scripts/checkContractVersion.js --network base_mainnet
```

---

## 📝 Smart Contracts

### ScheduledPayment.sol

Contrat principal qui :
- Verrouille l'ETH jusqu'à `releaseTime`
- Prélève 1.79% de fees lors du `release()`
- Distribue automatiquement aux 2 parties

**Fonctions principales :**
- `constructor(address _payee, uint256 _releaseTime) payable`
- `release() external nonReentrant`
- `getAmounts() external view returns (...)`

### ScheduledPaymentResolver.sol

Utilisé par les systèmes d'automation (Gelato, Chainlink) :
- `checker() external view returns (bool canExec, bytes memory execPayload)`

---

## 🔐 Sécurité

### Audits
- ✅ Testé en production (15+ paiements)
- ✅ ReentrancyGuard sur toutes les fonctions critiques
- ✅ Checks-Effects-Interactions pattern
- ⏳ Audit professionnel prévu (Q2 2025)

### Best Practices
- Variables privées jamais commitées (`.env` dans `.gitignore`)
- Wallet keeper séparé du wallet protocole
- Vérification des contrats sur Basescan
- Tests avant chaque déploiement

---

## 🗺️ Roadmap

### Q1 2025
- [x] Smart contracts avec fees
- [x] Keeper automatique
- [x] Database Supabase
- [x] Tests production validés
- [ ] Paiements annulables
- [ ] Frontend MVP

### Q2 2025
- [ ] Support Polygon + Arbitrum
- [ ] Paiements récurrents
- [ ] Support USDC/DAI
- [ ] Beta publique
- [ ] Audit sécurité

### Q3 2025
- [ ] Mobile app
- [ ] API publique
- [ ] Split payments
- [ ] V2 tokenomics

---

## 👥 Équipe

**Fondateur :** [Ton nom]
- Smart Contract Developer
- DeFi Architect

**Contributeurs :** Les contributions sont les bienvenues !

---

## 📄 License

MIT License - Voir [LICENSE](LICENSE) pour plus de détails

---

## 🔗 Liens

- **Website** : Coming soon
- **Twitter** : Coming soon
- **Discord** : Coming soon
- **Basescan** : [Contracts](https://basescan.org)
- **Supabase** : [Database](https://supabase.com)

---

## 🤝 Contributing

Les contributions sont les bienvenues ! 

1. Fork le projet
2. Crée une branche (`git checkout -b feature/AmazingFeature`)
3. Commit tes changements (`git commit -m 'Add AmazingFeature'`)
4. Push sur la branche (`git push origin feature/AmazingFeature`)
5. Ouvre une Pull Request

---

## 💬 Support

- GitHub Issues : [Report a bug](https://github.com/TON_USERNAME/confidance-crypto/issues)
- Email : ton@email.com

---

## ⚠️ Disclaimer

**Ce projet est en développement actif.** Utilise-le à tes propres risques. Les smart contracts n'ont pas encore été audités professionnellement. Ne dépose pas de montants importants sans faire tes propres recherches (DYOR).

---

**Made with ❤️ by Confidance Crypto Team**

*Empowering DeFi payments, one block at a time* 🚀
