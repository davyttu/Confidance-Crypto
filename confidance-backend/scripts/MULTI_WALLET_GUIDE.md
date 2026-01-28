# Guide : Support Multi-Wallets 🔗💼

## 🎯 Ce qui a été implémenté

### Fonctionnalités
- ✅ **Un utilisateur peut avoir plusieurs wallets** (MetaMask, Coinbase, etc.)
- ✅ **Liaison automatique** des wallets au compte
- ✅ **Un wallet principal** (primary) par utilisateur
- ✅ **Dashboard unifié** : voir tous les paiements de tous les wallets
- ✅ **Notifications** : peu importe quel wallet crée le lien, la notification va au bon compte
- ✅ **Gestion des wallets** : ajouter, supprimer, définir comme principal

### Architecture
- Table `user_wallets` : stocke plusieurs wallets par utilisateur
- API endpoints pour gérer les wallets
- Recherche multi-sources pour les notifications (user_wallets + users.primary_wallet legacy)

---

## 🚀 Installation (À FAIRE MAINTENANT)

### Étape 1 : Créer la table user_wallets

Va sur **Supabase Dashboard** → **SQL Editor** → Copie-colle et exécute :

```sql
-- Le contenu complet du fichier create-user-wallets-table.sql
```

Ou exécute directement :
```bash
# Copie le contenu du fichier dans Supabase SQL Editor
cat scripts/create-user-wallets-table.sql
```

**Ce que fait ce SQL :**
- ✅ Crée la table `user_wallets`
- ✅ Crée les index pour performances
- ✅ Migre automatiquement les wallets existants de `users.primary_wallet`
- ✅ Crée les contraintes (un wallet = un seul user, un seul primary par user)

### Étape 2 : Redémarrer le backend

```bash
# Arrête (Ctrl+C) et relance
node index.js
```

### Étape 3 : Reconnecter Paul et Ali

**Important** : Paul et Ali doivent se reconnecter avec **CHAQUE** wallet qu'ils veulent utiliser.

**Exemple pour Paul :**
1. Se connecte avec compte email/mdp
2. Connecte wallet 0x8cc0... (Paul 1) → Auto-lié
3. Change de wallet dans MetaMask → 0xea1b... (Paul 2)
4. Rafraîchit la page → Auto-lié aussi !

Maintenant Paul a **2 wallets liés** à son compte ! 🎉

---

## 📋 API Endpoints disponibles

### GET /api/link-wallet
Récupère tous les wallets de l'utilisateur

**Réponse :**
```json
{
  "success": true,
  "wallets": [
    {
      "id": 1,
      "user_id": "abc-123",
      "wallet_address": "0x8cc0...",
      "label": "MetaMask Pro",
      "is_primary": true,
      "created_at": "2024-01-27T10:00:00Z"
    },
    {
      "id": 2,
      "user_id": "abc-123",
      "wallet_address": "0xea1b...",
      "label": "Coinbase",
      "is_primary": false,
      "created_at": "2024-01-27T10:05:00Z"
    }
  ],
  "primary_wallet": "0x8cc0..."
}
```

### POST /api/link-wallet
Lie un nouveau wallet

**Body :**
```json
{
  "wallet_address": "0x...",
  "label": "Mon wallet MetaMask" // optionnel
}
```

### PATCH /api/link-wallet/:walletAddress/primary
Définir un wallet comme principal

**Exemple :**
```bash
curl -X PATCH http://localhost:3001/api/link-wallet/0x8cc0.../primary \
  -H "Cookie: token=..." \
  -H "Content-Type: application/json"
```

### DELETE /api/link-wallet/:walletAddress
Supprimer un wallet

**Note :** Impossible de supprimer le dernier wallet principal

---

## 🧪 Comment tester

### Test 1 : Lier plusieurs wallets

1. **Paul se connecte** avec son compte
2. **Paul connecte wallet A** (0x8cc0...)
   - Attends 2 secondes
   - Log backend : `✅ [LINK-WALLET] Wallet lié (primary)`
3. **Paul change de wallet** dans MetaMask → wallet B (0xea1b...)
4. **Paul rafraîchit la page**
   - Attends 2 secondes
   - Log backend : `✅ [LINK-WALLET] Wallet lié (secondary)`
5. **Vérifie** :
   ```bash
   node scripts/check-users-table.js
   ```
   Paul devrait avoir 2 wallets !

### Test 2 : Notification multi-wallets

1. **Paul crée un lien avec wallet A** (0x8cc0...)
2. **Ali valide le lien** avec n'importe quel wallet
3. **Paul reçoit la notification** immédiatement ! 🎉
4. **Paul crée un lien avec wallet B** (0xea1b...)
5. **Ali valide ce lien**
6. **Paul reçoit encore la notification** ! 🎉

### Test 3 : Dashboard unifié

1. **Paul crée des liens avec wallet A**
2. **Paul crée des liens avec wallet B**
3. **Paul va dans son dashboard**
4. **Il voit TOUS les paiements** des 2 wallets ! ✅

---

## 🔍 Vérifications

### Script de diagnostic complet

```bash
node scripts/check-notification-setup.js
```

Tu devrais voir :
```
✅ 0x8cc0d8f899b0ef553459aac249b14a95f0470ce9
   → User ID: abc-123, Email: paul@email.com

✅ 0xea1bc6fe868111ba08edcc27b62619008dac1a13
   → User ID: abc-123, Email: paul@email.com (MÊME USER!)
```

### Vérifier dans Supabase

```sql
-- Voir tous les wallets de Paul
SELECT * FROM user_wallets
WHERE user_id = (SELECT id FROM users WHERE email = 'paul@email.com');
```

Tu devrais voir plusieurs lignes, une par wallet !

---

## 🎨 Interface utilisateur (Dashboard)

### Composant de gestion des wallets

L'utilisateur peut :
- ✅ Voir la liste de tous ses wallets
- ✅ Voir quel est le wallet principal (badge "Principal")
- ✅ Renommer un wallet ("MetaMask Pro", "Coinbase Personnel", etc.)
- ✅ Définir un wallet comme principal
- ✅ Supprimer un wallet (sauf le dernier)
- ✅ Voir la date d'ajout de chaque wallet

**Exemple d'interface :**
```
┌─────────────────────────────────────────┐
│ 📱 Mes Wallets                          │
├─────────────────────────────────────────┤
│ 💼 MetaMask Pro                   [🌟]  │
│    0x8cc0...0ce9                        │
│    Principal • Ajouté le 27/01/2024     │
│    [Renommer] [Supprimer]               │
├─────────────────────────────────────────┤
│ 🏦 Coinbase Personnel                   │
│    0xea1b...1a13                        │
│    Ajouté le 27/01/2024                 │
│    [Définir comme principal]            │
│    [Renommer] [Supprimer]               │
└─────────────────────────────────────────┘
```

---

## 🐛 Dépannage

### Les wallets ne se lient pas automatiquement

**Vérifications :**
1. La table `user_wallets` existe dans Supabase ?
2. Le backend est redémarré ?
3. Tu vois les logs `[LINK-WALLET]` ?

**Solution :**
```bash
# Relance le backend
node index.js

# Vérifie la table
node scripts/check-users-table.js
```

### Les notifications ne marchent pas

**Vérifications :**
1. Les wallets sont bien dans `user_wallets` ?
2. Tu vois les logs `[NOTIF DEBUG]` ?
3. Le wallet du créateur du lien est lié à un compte ?

**Solution :**
```bash
# Diagnostic complet
node scripts/check-notification-setup.js

# Forcer une notification de test
node scripts/force-test-notification.js <link_id>
```

### Un wallet est lié au mauvais utilisateur

**C'est normal** : Un wallet ne peut être lié qu'à UN SEUL utilisateur (contrainte de sécurité).

**Solution :** Supprime le wallet du mauvais compte d'abord, puis relie-le au bon compte.

---

## ✅ Checklist de déploiement

- [ ] SQL exécuté dans Supabase (table `user_wallets` créée)
- [ ] Backend redémarré
- [ ] Paul reconnecte tous ses wallets
- [ ] Ali reconnecte tous ses wallets
- [ ] Test : Paul crée un lien avec wallet A → Ali paie → Paul reçoit notification
- [ ] Test : Paul crée un lien avec wallet B → Ali paie → Paul reçoit notification
- [ ] Vérifier dans Supabase que `user_wallets` contient plusieurs wallets par user

---

## 🚀 C'est prêt !

Maintenant ton système supporte :
- ✅ Plusieurs wallets par utilisateur
- ✅ Dashboard unifié (tous les paiements de tous les wallets)
- ✅ Notifications qui fonctionnent peu importe le wallet
- ✅ Gestion complète des wallets via API

**Lance l'installation et teste ! 🎉**
