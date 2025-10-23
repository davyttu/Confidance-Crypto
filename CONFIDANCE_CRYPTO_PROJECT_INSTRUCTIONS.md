# 💎 CONFIDANCE CRYPTO - Instructions Projet pour Claude AI

## 🎯 CONTEXTE GÉNÉRAL

Confidance Crypto est une **plateforme DeFi de paiements programmés** déployée sur **Base Mainnet**.
Elle permet de créer des paiements en crypto qui se libèrent automatiquement à une date précise, sans intermédiaire centralisé.

**Statut actuel** : MVP fonctionnel en production (Phase Beta Privée)
**Date de dernière mise à jour** : 23 octobre 2025

---

## 🏗️ ARCHITECTURE TECHNIQUE COMPLÈTE

### 1. Smart Contracts (Solidity 0.8.20)

**Déployés sur Base Mainnet (chainId: 8453)**

#### ✅ Contrats Déployés

| Contrat | Adresse | Rôle |
|---------|---------|------|
| **PaymentFactory** | `0x523b378A11400F1A3E8A4482Deb9f0464c64A525` | Factory unifiée pour créer paiements ETH/ERC20 |
| **ScheduledPayment** | Déployé dynamiquement | Contrat individuel par paiement (ETH natif) |
| **ScheduledPaymentERC20** | Déployé dynamiquement | Contrat individuel pour tokens ERC20 |
| **ScheduledPaymentResolver** | Déployé avec chaque payment | Resolver pour automation (Gelato/Chainlink) |

#### 📋 Fonctionnalités Smart Contracts

**PaymentFactory.sol** :
- `createPaymentETH(address _payee, uint256 _releaseTime, bool _cancellable) payable`
- `createPaymentERC20(address _payee, address _token, uint256 _amount, uint256 _releaseTime, bool _cancellable)`
- `previewFees(uint256 amount)` → calcul des fees avant création
- Fee protocole : **1.79%** prélevé à l'exécution

**ScheduledPayment.sol** :
- `release()` → libère les fonds au bénéficiaire (exécuté par keeper)
- `cancel()` → annule le paiement (si `cancellable = true`)
- `getAmounts()` → prévisualise montants (payee, protocole)
- `getStatus()` → état complet du paiement
- Statuts possibles : `pending`, `released`, `cancelled`

**ScheduledPaymentResolver.sol** :
- `checker() returns (bool canExec, bytes memory execPayload)`
- Utilisé par le keeper pour savoir si un paiement est prêt

#### 💰 Système de Fees

```
Montant envoyé : 0.1 ETH
├─ Bénéficiaire : 0.09821 ETH (98.21%)
└─ Protocole    : 0.00179 ETH (1.79%)

Wallet protocole : 0xa34eDf91Cc494450000Eef08e6563062B2F115a9
```

**Important** : Fees prélevés UNIQUEMENT à l'exécution, PAS à l'annulation.

---

### 2. Base de Données (Supabase - PostgreSQL)

#### 🗄️ Table : `scheduled_payments`

```sql
CREATE TABLE scheduled_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Identifiants blockchain
  contract_address TEXT UNIQUE NOT NULL,
  transaction_hash TEXT,
  tx_hash TEXT, -- Hash de la transaction release()
  network TEXT DEFAULT 'base_mainnet',
  
  -- Acteurs
  payer_address TEXT NOT NULL,
  payee_address TEXT NOT NULL,
  
  -- Token & Montant
  token_symbol TEXT NOT NULL, -- 'ETH', 'USDC', 'DAI'...
  token_address TEXT, -- NULL pour ETH natif
  amount TEXT NOT NULL, -- En wei/smallest unit (BigInt string)
  
  -- Temporalité
  release_time BIGINT NOT NULL, -- Unix timestamp en secondes
  created_at TIMESTAMP DEFAULT NOW(),
  released_at TIMESTAMP,
  
  -- Statut
  status TEXT DEFAULT 'pending', -- pending, released, cancelled, failed
  cancellable BOOLEAN DEFAULT false,
  
  -- Métadonnées
  error_message TEXT,
  retry_count INTEGER DEFAULT 0
);

-- Index pour performances
CREATE INDEX idx_payer ON scheduled_payments(payer_address);
CREATE INDEX idx_payee ON scheduled_payments(payee_address);
CREATE INDEX idx_status ON scheduled_payments(status);
CREATE INDEX idx_release_time ON scheduled_payments(release_time);
CREATE INDEX idx_tx_hash ON scheduled_payments(tx_hash);
```

#### 🔐 Row Level Security (RLS)

```sql
-- Activer RLS
ALTER TABLE scheduled_payments ENABLE ROW LEVEL SECURITY;

-- Politique : Utilisateur voit ses paiements (envoyés + reçus)
CREATE POLICY "Users can view their payments"
ON scheduled_payments
FOR SELECT
USING (
  payer_address = current_setting('request.jwt.claim.wallet_address', true)
  OR payee_address = current_setting('request.jwt.claim.wallet_address', true)
);

-- Politique : Keeper peut tout lire/modifier
CREATE POLICY "Keeper full access"
ON scheduled_payments
FOR ALL
USING (current_setting('request.jwt.claim.role', true) = 'keeper');
```

#### 📊 Requêtes SQL Utiles

```sql
-- Paiements à exécuter maintenant
SELECT * FROM scheduled_payments
WHERE status = 'pending'
  AND release_time <= EXTRACT(EPOCH FROM NOW())
ORDER BY release_time ASC;

-- Statistiques utilisateur
SELECT 
  COUNT(*) as total_payments,
  SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
  SUM(CASE WHEN status = 'released' THEN 1 ELSE 0 END) as released
FROM scheduled_payments
WHERE payer_address = '0x...';
```

---

### 3. API Backend (Node.js + Express)

**Localisation** : `confidance-backend/`

#### 🛣️ Routes API

```javascript
// Health check
GET /health
Response: { status: 'ok', supabase: true, keeper: 'running' }

// Créer un paiement (appelé par frontend après transaction blockchain)
POST /api/payments
Body: {
  contract_address: '0x...',
  payer_address: '0x...',
  payee_address: '0x...',
  token_symbol: 'ETH',
  token_address: null,
  amount: '100000000000000', // En wei
  release_time: 1729728000,
  cancellable: false,
  network: 'base_mainnet',
  transaction_hash: '0x...'
}
Response: { success: true, payment: { id: 'uuid', ... } }

// Lister les paiements d'un utilisateur
GET /api/payments/:walletAddress
Response: { payments: [...] }

// Obtenir un paiement spécifique
GET /api/payments/contract/:contractAddress
Response: { payment: { ... } }

// Mettre à jour le statut (interne keeper)
PUT /api/payments/:id/status
Body: { status: 'released', tx_hash: '0x...', released_at: '2025-10-23T00:52:00Z' }
Response: { success: true }
```

#### 🔑 Variables d'Environnement (.env)

```env
# Supabase
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...

# API
PORT=3001
NODE_ENV=production

# Blockchain (pour keeper intégré)
BASE_RPC=https://mainnet.base.org
PRIVATE_KEY=0x... (wallet keeper)
CHECK_INTERVAL=60000 # 60 secondes
```

#### 📦 Dépendances (package.json)

```json
{
  "name": "confidance-backend",
  "version": "1.0.0",
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "@supabase/supabase-js": "^2.38.0",
    "ethers": "^6.9.0"
  }
}
```

---

### 4. Keeper Cloud (Service de surveillance 24/7)

**Localisation** : `keeper-cloud/index.js`
**Déployé sur** : Render.com (ou Railway en backup)

#### 🤖 Fonctionnement du Keeper

```javascript
// Boucle principale (toutes les 60 secondes)
setInterval(async () => {
  // 1. Charger paiements pending depuis Supabase
  const payments = await loadPendingPayments();
  
  // 2. Pour chaque paiement
  for (const payment of payments) {
    // 3. Vérifier si releaseTime atteint
    if (now >= payment.release_time) {
      // 4. Exécuter release() sur la blockchain
      const tx = await contract.release();
      await tx.wait();
      
      // 5. Mettre à jour Supabase
      await updatePaymentStatus(payment.id, {
        status: 'released',
        tx_hash: tx.hash,
        released_at: new Date()
      });
    }
  }
}, 60000);
```

#### 🔧 Fonctionnalités Keeper

- **Self-ping** : Se ping lui-même toutes les 5 minutes pour éviter le sleep Render
- **Health check** : Endpoint `/health` pour monitoring
- **Balance check** : Vérifie le solde du wallet keeper
- **Error handling** : Retry automatique en cas d'échec
- **Logs détaillés** : Timestamp, montant, statut, tx hash

#### ⚙️ Configuration Keeper (.env)

```env
# Blockchain
PRIVATE_KEY=0x... (wallet keeper avec ETH pour gas)
BASE_RPC=https://mainnet.base.org
NETWORK=base

# Supabase
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...

# Intervals
CHECK_INTERVAL=60000 # 1 minute
HEALTH_CHECK_INTERVAL=300000 # 5 minutes

# Server
PORT=10000
```

#### 🚨 Monitoring Keeper

**Indicateurs clés** :
- ✅ Uptime > 99%
- ✅ Balance keeper > 0.001 ETH
- ✅ Connexion Supabase OK
- ✅ RPC endpoint disponible

**Alertes à configurer** :
- Balance keeper < 0.001 ETH → recharge nécessaire
- Échec transaction > 3 fois → investigation
- Keeper offline > 10 min → redémarrage

---

### 5. Frontend (Next.js 14 + Wagmi + RainbowKit)

**Localisation** : `confidance-frontend/`

#### 🎨 Stack Frontend

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "wagmi": "^2.0.0",
    "@rainbow-me/rainbowkit": "^2.0.0",
    "viem": "^2.0.0",
    "tailwindcss": "^3.3.0"
  }
}
```

#### 📱 Pages Principales

```
/                    → Landing page
/create              → Créer un paiement
/dashboard           → Mes paiements (envoyés + reçus)
/payment/[address]   → Détails d'un paiement
```

#### 🔌 Hooks Wagmi Personnalisés

**useCreatePayment.ts** :
```typescript
const { createPayment, status, contractAddress } = useCreatePayment();

await createPayment({
  tokenSymbol: 'ETH',
  beneficiary: '0x...',
  amount: BigInt('100000000000000'),
  releaseTime: timestamp,
  cancellable: false
});
```

**useTokenApproval.ts** :
```typescript
const { approve, isAllowanceSufficient } = useTokenApproval({
  tokenSymbol: 'USDC',
  spenderAddress: FACTORY_ADDRESS,
  amount: BigInt('1000000') // 1 USDC
});
```

#### 🎯 Workflow Création Paiement

```
1. Utilisateur connecte wallet (RainbowKit)
2. Remplit formulaire (bénéficiaire, montant, date)
3. Frontend calcule releaseTime (timestamp Unix)

Si ETH natif :
  4a. Transaction createPaymentETH() → Blockchain
  5a. Attente confirmation
  6a. Extraction contract address
  7a. POST /api/payments → Supabase

Si ERC20 :
  4b. Transaction approve() → Blockchain
  5b. Attente confirmation approve
  6b. Transaction createPaymentERC20() → Blockchain
  7b. Attente confirmation
  8b. Extraction contract address
  9b. POST /api/payments → Supabase

8/10. Affichage modal succès avec lien Basescan
```

#### 🎨 Composants UI

```typescript
// Modal de progression
<PaymentProgressModal
  status="creating"
  currentStep={1}
  totalSteps={2}
  progressMessage="Création du paiement..."
  createTxHash="0x..."
/>

// Card paiement
<PaymentCard
  amount="0.1 ETH"
  beneficiary="0x..."
  releaseTime={timestamp}
  status="pending"
  onViewDetails={() => {}}
/>
```

---

## 🔐 SÉCURITÉ & BONNES PRATIQUES

### Smart Contracts

✅ **Implémenté** :
- `ReentrancyGuard` sur toutes fonctions payables
- Checks-Effects-Interactions pattern
- Validations strictes (address(0), montant > 0, etc.)
- Events pour toutes actions critiques

⏳ **À faire** :
- Audit professionnel (prévu Q2 2025)
- Tests fuzzing avec Foundry
- Bug bounty program

### Backend & Keeper

✅ **Implémenté** :
- Private keys dans .env (jamais commit)
- Supabase RLS (Row Level Security)
- CORS configuré
- Rate limiting (à venir)

⏳ **À faire** :
- JWT authentication
- API key pour frontend
- Webhook signatures

### Frontend

✅ **Implémenté** :
- Connexion wallet sécurisée (RainbowKit)
- Validation inputs (montant, adresse, date)
- Affichage gas estimé
- Confirmation utilisateur avant tx

---

## 📊 MÉTRIQUES & KPIs

### Actuellement

| Métrique | Valeur |
|----------|--------|
| Paiements créés | 15+ |
| Taux de succès | 100% |
| Uptime keeper | 99.9% |
| Montant total traité | ~0.005 ETH (tests) |
| Utilisateurs actifs | 1 (MVP mono-user) |

### Objectifs Q1 2025

- 100+ paiements créés
- 10+ utilisateurs actifs
- Support 3 tokens (ETH, USDC, DAI)
- Dashboard analytics complet

---

## 🚀 ROADMAP

### ✅ Phase 1 : MVP Core (TERMINÉ)
- [x] Smart contracts ETH natif
- [x] Keeper automatique
- [x] Base de données Supabase
- [x] Frontend création paiement
- [x] Workflow end-to-end fonctionnel

### 🚧 Phase 2 : Multi-utilisateurs (EN COURS)
- [x] API backend REST
- [x] Enregistrement paiements dans DB
- [ ] Dashboard utilisateur
- [ ] Filtrage paiements (envoyés/reçus)
- [ ] Authentification wallet

### 📅 Phase 3 : Features avancées (Q1 2025)
- [ ] Support ERC20 (USDC, DAI)
- [ ] Paiements récurrents (mensuels)
- [ ] Paiements annulables
- [ ] Notifications email
- [ ] Multi-chain (Polygon, Arbitrum)

### 🎯 Phase 4 : Production publique (Q2 2025)
- [ ] Audit sécurité professionnel
- [ ] Landing page marketing
- [ ] Documentation complète
- [ ] Beta publique
- [ ] Support client

---

## 🛠️ COMMANDES UTILES

### Développement Local

```bash
# Compiler les smart contracts
cd hardhat
npx hardhat compile

# Déployer sur Base Mainnet (test)
npx hardhat run scripts/deployBaseMainnet.js --network base_mainnet

# Lancer API backend
cd confidance-backend
npm run dev # Port 3001

# Lancer frontend
cd confidance-frontend
npm run dev # Port 3000

# Lancer keeper local
cd keeper-cloud
node index.js # Port 10000
```

### Production

```bash
# Déployer + Git + Push automatique
node scripts/deployAndAutomate.js

# Vérifier health API
curl http://localhost:3001/health

# Vérifier health Keeper
curl http://localhost:10000/health
```

### Supabase

```bash
# Se connecter
npx supabase login

# Lancer localement
npx supabase start

# Appliquer migrations
npx supabase db push
```

---

## 🐛 RÉSOLUTION DE PROBLÈMES COURANTS

### Erreur : "Keeper s'arrête après 15 min"
**Cause** : Plan gratuit Render sleep après inactivité
**Solution** : Self-ping toutes les 5 minutes (déjà implémenté)

### Erreur : "Cannot find column tx_hash"
**Cause** : Migration SQL manquante
**Solution** :
```sql
ALTER TABLE scheduled_payments ADD COLUMN tx_hash TEXT;
CREATE INDEX idx_tx_hash ON scheduled_payments(tx_hash);
```

### Erreur : "Transaction underpriced"
**Cause** : Gas price trop bas sur Base
**Solution** : Augmenter maxFeePerGas dans keeper
```javascript
const tx = await contract.release({
  maxFeePerGas: ethers.parseUnits('0.1', 'gwei')
});
```

### Erreur : "Insufficient funds for gas"
**Cause** : Wallet keeper à sec
**Solution** : Envoyer 0.01 ETH sur wallet keeper
```
Keeper address: 0x7A764F9dED8CA54A5514023643fE117c6eAddD90
```

---

## 📚 RESSOURCES EXTERNES

### Documentation
- **Base Network** : https://docs.base.org
- **Hardhat** : https://hardhat.org/docs
- **Wagmi** : https://wagmi.sh
- **Supabase** : https://supabase.com/docs
- **Ethers.js v6** : https://docs.ethers.org/v6/

### Explorateurs
- **Basescan** : https://basescan.org
- **Factory Contract** : https://basescan.org/address/0x523b378A11400F1A3E8A4482Deb9f0464c64A525

### Services
- **Render** : https://dashboard.render.com
- **Supabase Dashboard** : https://supabase.com/dashboard

---

## 💡 CONTEXTE UTILISATEUR

### Wallet Keeper (Technique)
```
Address: 0x7A764F9dED8CA54A5514023643fE117c6eAddD90
Role: Déploie contrats + exécute release()
Balance recommandée: > 0.01 ETH
```

### Wallet Bénéficiaire (Test)
```
Address: 0x8CC0D8f899b0eF553459Aac249b14A95F0470cE9
Role: Reçoit les paiements de test
```

### Wallet Protocole (Fees)
```
Address: 0xa34eDf91Cc494450000Eef08e6563062B2F115a9
Role: Reçoit les 1.79% de fees
```

---

## 🎯 OBJECTIFS BUSINESS

### Vision
Devenir la référence des **paiements programmés décentralisés** sur Base et autres L2.

### Use Cases
1. 💼 **Salaires automatiques** : Freelance payé tous les 1er du mois
2. 🏠 **Loyers programmés** : Locataire paie automatiquement son loyer
3. 💳 **Abonnements DeFi** : Paiements récurrents sans carte bancaire
4. 🎁 **Cadeaux futurs** : Envoyer 0.5 ETH à quelqu'un dans 1 an
5. 📊 **Vesting crypto** : Débloquer tokens progressivement

### Monétisation
- **Fees protocole** : 1.79% par transaction (déjà implémenté)
- **Premium features** : Paiements récurrents, multi-sig (à venir)
- **API entreprise** : Intégration pour payroll crypto (futur)

### Concurrence
- **Sablier** : Focus streaming, pas de paiements one-time
- **Superfluid** : Streaming only, complexe
- **Confidance** : Simple, one-time + récurrent, UX optimale

---

## ✅ CHECKLIST DÉPLOIEMENT PRODUCTION

### Smart Contracts
- [x] Compilés sans warnings
- [x] Testés manuellement
- [ ] Tests unitaires Hardhat
- [ ] Audit professionnel
- [x] Déployés sur Base Mainnet
- [x] Vérifiés sur Basescan

### Backend
- [x] API fonctionnelle
- [x] Variables d'environnement configurées
- [ ] Rate limiting
- [ ] Monitoring (Sentry/Datadog)
- [x] Déployé sur Render

### Frontend
- [x] Build Next.js sans erreurs
- [x] Wallet connection fonctionne
- [x] Création paiement ETH OK
- [ ] Support ERC20
- [ ] Tests E2E (Playwright)
- [ ] SEO optimisé

### Keeper
- [x] Surveillance active
- [x] Self-ping implémenté
- [x] Connexion Supabase OK
- [ ] Alerting configuré
- [ ] Backup keeper (Railway)

### Database
- [x] Tables créées
- [x] Index optimisés
- [x] RLS configuré
- [ ] Backups automatiques
- [ ] Migration prod

---

## 🆘 CONTACT & SUPPORT

### Développeur Principal
- **GitHub** : @tonprofil (à mettre à jour)
- **Email** : contact@confidance.crypto (à créer)

### Communauté
- **Discord** : À créer
- **Twitter** : À créer
- **Documentation** : À rédiger

---

## 📝 NOTES IMPORTANTES POUR CLAUDE

### Ton & Style
- **Enthousiaste mais pragmatique** : Célèbre les victoires, reste réaliste sur les défis
- **Technique mais accessible** : Explique clairement sans jargon excessif
- **Proactif** : Propose des solutions concrètes, pas juste des diagnostics

### Priorités Actuelles (Octobre 2025)
1. Finaliser colonne `tx_hash` dans Supabase ✅
2. Créer dashboard utilisateur (affichage paiements)
3. Tester workflow ERC20 (USDC)
4. Déployer keeper backup sur Railway
5. Documenter API pour futurs développeurs

### Ce que Claude DOIT savoir
- ✅ Le système fonctionne END-TO-END en production
- ✅ 15+ paiements exécutés avec succès
- ✅ Keeper opérationnel 24/7 sur Render
- 🚧 Phase actuelle = Multi-utilisateurs
- 🎯 Objectif = Beta publique Q1 2025

### Ce que Claude PEUT aider à faire
- Débugger erreurs Solidity/TypeScript/SQL
- Optimiser architecture (gas, DB, API)
- Proposer nouvelles fonctionnalités
- Rédiger documentation technique
- Créer tests unitaires/intégration
- Améliorer UX frontend

### Ce que Claude NE PEUT PAS faire
- Accéder directement aux services (Supabase, Render)
- Modifier les smart contracts déployés
- Transférer des fonds
- Garantir l'absence de bugs en production

---

## 🎉 ÉTAT D'ESPRIT

> "Nous construisons l'infrastructure des paiements crypto de demain.
> Chaque ligne de code doit être simple, sécurisée, et scalable."

**Principe clé** : Mieux vaut un système simple qui fonctionne qu'un système complexe qui échoue.

---

*Dernière mise à jour : 23 octobre 2025*
*Version : 1.0.0-beta*
*Status : MVP Fonctionnel ✅*
