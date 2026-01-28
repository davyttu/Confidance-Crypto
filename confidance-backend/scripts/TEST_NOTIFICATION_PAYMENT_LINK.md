# Test : Notification quand un lien de paiement est validé 🔔

## Ce qui a été codé

Quand quelqu'un valide ton lien de paiement, tu reçois automatiquement une notification :

**Notification :**
- **Titre** : 💰 Lien de paiement validé !
- **Message** : `0x1234...5678 a payé votre lien "Loyer Janvier" de 1000 USDC.`

## Comment tester

### 1️⃣ Préparer la base de données

Crée la table notifications dans Supabase (si pas déjà fait) :
```sql
-- Copie le contenu de create-notifications-table.sql et exécute-le dans Supabase SQL Editor
```

### 2️⃣ Scénario de test

**Rôle A : TOI (Créateur du lien)**
1. Connecte-toi à l'app avec ton compte
2. Va sur `/links/new` (ou clique sur "Créer un lien de paiement")
3. Crée un lien de paiement :
   - Montant : 10 USDC
   - Type : Instantané
   - Label : "Test notification"
4. Copie le lien généré (ex: `https://ton-app.com/links/pay/abc123xyz`)

**Rôle B : Destinataire (Quelqu'un d'autre)**
1. Ouvre le lien dans un autre navigateur ou en navigation privée
2. Connecte ton wallet (MetaMask)
3. Valide le paiement
4. ✅ La transaction est confirmée

**Rôle A : TOI (Vérification)**
1. Retourne sur ton compte
2. Clique sur ton bouton de compte en haut à droite
3. 🎉 **TU DOIS VOIR** :
   - Un badge rouge avec "1" sur le bouton de compte
   - Clique sur "Notifications" dans le menu déroulant
   - Le panneau latéral s'ouvre depuis la droite
   - Ta notification apparaît : "💰 Lien de paiement validé !"

### 3️⃣ Test manuel (sans vraie transaction)

Si tu veux tester sans faire de vraie transaction blockchain, tu peux simuler en appelant directement l'API :

```bash
# Remplace ces valeurs :
# - LINK_ID : l'ID de ton lien de paiement
# - PAYER_ADDRESS : une adresse wallet fictive

curl -X PATCH http://localhost:3001/api/payment-links/LINK_ID \
  -H "Content-Type: application/json" \
  -d '{
    "status": "paid",
    "payer_address": "0x1234567890123456789012345678901234567890"
  }'
```

Ensuite, va voir tes notifications dans l'app !

### 4️⃣ Test avec le script

Ou utilise le script de test :

```bash
cd confidance-backend

# D'abord, crée quelques notifications de test pour ton user_id
node scripts/test-notifications.js <TON_USER_ID>

# Ensuite vérifie dans l'app
```

## Ce qui se passe dans le code

### Backend (`confidance-backend/routes/paymentLinks.js`)

Quand `PATCH /api/payment-links/:id` est appelé avec `status: "paid"` :

1. ✅ Récupère les infos du lien (créateur, montant, token, label)
2. ✅ Trouve le `user_id` du créateur via son wallet address
3. ✅ Crée une notification :
   ```javascript
   createNotification(
     userData.id,
     'payment',
     '💰 Lien de paiement validé !',
     `${payerShort} a payé votre lien "${label}" de ${amount} ${token}.`
   );
   ```

### Frontend (`useNotifications` hook)

1. ✅ Récupère automatiquement les notifications toutes les X secondes
2. ✅ Compte les non lues → affiche le badge
3. ✅ Affiche dans le panneau latéral

## Débug

### La notification n'apparaît pas ?

1. **Vérifie dans Supabase** que la notification a été créée :
   ```sql
   SELECT * FROM notifications ORDER BY created_at DESC LIMIT 10;
   ```

2. **Vérifie la console du backend** :
   - Tu devrais voir : `✅ Notification envoyée au créateur (user X) pour le lien Y`
   - Ou : `⚠️ Créateur 0x... non trouvé dans la base users`

3. **Si le créateur n'est pas trouvé** :
   - Vérifie que ton adresse wallet est bien dans la table `users`
   - Vérifie que le champ `primary_wallet` correspond à l'adresse `creator` du lien

4. **Vérifie la console frontend** :
   - Ouvre les DevTools (F12)
   - Tu devrais voir les requêtes vers `/api/notifications`

## Structure de la notification

```json
{
  "id": 123,
  "user_id": 1,
  "type": "payment",
  "title": "💰 Lien de paiement validé !",
  "message": "0x1234...5678 a payé votre lien \"Test\" de 10 USDC.",
  "read": false,
  "created_at": "2024-01-27T10:30:00Z"
}
```

## Améliorations futures

- [ ] Notification par email en plus
- [ ] Notification push (Progressive Web App)
- [ ] Historique des paiements du lien
- [ ] Statistiques sur les liens (nombre de vues, taux de conversion, etc.)

---

**Prêt pour le test ! 🚀**

Lance ton test et viens me dire si ça fonctionne !
