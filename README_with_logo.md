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

## 🤝 Licence

Projet open-source sous licence MIT.  
© 2025 — *Confidance Crypto Team*
