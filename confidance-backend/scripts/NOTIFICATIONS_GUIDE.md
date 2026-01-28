# Guide rapide - Système de notifications 🔔

## 🎯 Ce que tu dois faire

### 1. Créer la table dans Supabase

**Va sur ton Supabase Dashboard :**
1. Ouvre https://supabase.com/dashboard
2. Sélectionne ton projet
3. Clique sur **SQL Editor** dans le menu de gauche
4. Clique sur **New query**
5. Copie-colle tout le contenu du fichier `create-notifications-table.sql`
6. Clique sur **Run** (ou Ctrl+Enter)
7. ✅ Tu devrais voir "Success. No rows returned"

**Vérification :**
- Va dans **Table Editor**
- Tu devrais voir une nouvelle table `notifications`

### 2. Tester le système

Une fois la table créée, tu peux tester avec des notifications factices :

```bash
cd confidance-backend
node scripts/test-notifications.js 1
```
*(remplace "1" par l'ID d'un vrai utilisateur de ta base)*

### 3. Voir le résultat

1. Connecte-toi sur ton app avec cet utilisateur
2. Tu devrais voir un petit badge rouge avec "5" sur le bouton de ton compte en haut à droite
3. Clique sur "Notifications" dans le menu déroulant
4. Un joli panneau slide depuis la droite avec tes notifications ! 🎉

## 📱 Ce que l'utilisateur voit

### Badge de notification
- Petit cercle rouge en haut à droite du bouton compte
- Affiche le nombre de notifications non lues (ex: "2" ou "9+" si > 9)

### Panneau latéral
- S'ouvre quand on clique sur "Notifications"
- Slide depuis la droite
- Largeur : 420px (pas trop large comme demandé)
- Overlay sombre sur le reste de l'écran

### Contenu du panneau
- **Header** : "🔔 Notifications" + badge avec le nombre
- **Sous-titre** : "Consultez vos notifications et messages privés"
- **Si aucune notification** :
  ```
  🔔 Pas de notifications

  Vous êtes à jour ! Les notifications sur vos
  paiements et messages apparaîtront ici. 💜
  ```
- **Si notifications présentes** :
  - Bouton "Tout marquer comme lu" en haut
  - Liste des notifications avec icônes (💰 💜 ⚙️ ℹ️)
  - Les non lues ont un fond coloré + point bleu
  - Date relative (il y a 5 min, il y a 2h, il y a 3j...)

## 🔧 Intégrer dans ton code

### Créer une notification quand un paiement est exécuté

Dans ton keeper ou ton endpoint de paiement :

```javascript
const { notifyPaymentExecuted } = require('./services/notificationService');

// Quand un paiement est exécuté
await notifyPaymentExecuted(
  userId,              // ID de l'utilisateur
  'Loyer Janvier',     // Label du paiement
  '1000',             // Montant
  'USDC'              // Token
);
```

### Autres types de notifications disponibles

```javascript
// Paiement programmé
await notifyPaymentScheduled(userId, label, amount, token, date);

// Paiement annulé
await notifyPaymentCancelled(userId, label, amount, token);

// Paiement échoué
await notifyPaymentFailed(userId, label, reason);

// Notification système personnalisée
await notifySystem(userId, '🎉 Titre', 'Message personnalisé');
```

## 🐛 Dépannage

### Le badge ne s'affiche pas
- Vérifie que la table existe dans Supabase
- Vérifie que l'endpoint `/api/notifications` fonctionne
- Ouvre la console du navigateur pour voir les erreurs

### Les notifications ne se chargent pas
- Vérifie que tu es bien connecté
- Vérifie l'URL de ton backend dans `.env`
- Vérifie les CORS dans `confidance-backend/index.js`

### Erreur "table notifications does not exist"
- Retourne dans Supabase SQL Editor
- Exécute à nouveau le script `create-notifications-table.sql`

## 🎨 Design

- Panneau : 420px de large (desktop), full width (mobile)
- Animation : slide-in depuis la droite (300ms ease-in-out)
- Couleurs :
  - Badge : rouge #ef4444
  - Point non lu : primary-500
  - Fond non lu : primary-50/30 (light), primary-900/10 (dark)
- Icônes : 💰 payment, ⚙️ system, ℹ️ info

---

**C'est tout ! 🚀**

Le système est maintenant prêt à envoyer des notifications à tes utilisateurs.
