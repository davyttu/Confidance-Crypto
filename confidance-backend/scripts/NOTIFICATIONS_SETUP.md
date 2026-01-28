# Configuration du système de notifications

## Installation

### 1. Créer la table notifications dans Supabase

#### Option A : Via l'interface Supabase (recommandé)

1. Connectez-vous à votre projet Supabase : https://supabase.com/dashboard
2. Allez dans **SQL Editor**
3. Copiez-collez le contenu du fichier `create-notifications-table.sql`
4. Cliquez sur **Run** pour exécuter le script

#### Option B : Via script Node.js

```bash
cd confidance-backend
node scripts/create-notifications-table.js
```

La table créée contient :
- `id` (clé primaire auto-incrémentée)
- `user_id` (référence à la table users)
- `type` ('payment', 'system', 'info')
- `title` (titre de la notification, max 255 caractères)
- `message` (message de la notification)
- `read` (boolean, par défaut false)
- `created_at` (timestamp de création)
- `updated_at` (timestamp de mise à jour)
- Index sur `user_id`, `read`, et `created_at` pour optimiser les performances

### 2. Vérifier l'installation

Vérifiez que tout fonctionne :
- Dans Supabase, vérifiez que la table `notifications` existe
- Testez la route `/api/notifications` depuis le frontend
- Le badge de notifications doit apparaître sur le bouton du compte client

## Utilisation

### Frontend

```typescript
import { useNotifications } from '@/hooks/useNotifications';

function MyComponent() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  return (
    <div>
      <p>Vous avez {unreadCount} notification(s) non lue(s)</p>
      {notifications.map(notif => (
        <div key={notif.id} onClick={() => markAsRead(notif.id)}>
          {notif.title}: {notif.message}
        </div>
      ))}
    </div>
  );
}
```

### Backend

Pour créer des notifications, utilisez le service de notification :

```javascript
const { notifyPaymentExecuted } = require('../services/notificationService');

// Exemple : notifier l'utilisateur qu'un paiement a été exécuté
await notifyPaymentExecuted(
  userId,           // ID de l'utilisateur
  'Loyer Janvier',  // Label du paiement
  '1000',          // Montant
  'USDC'           // Token
);
```

### Fonctions disponibles

- `notifyPaymentExecuted(userId, label, amount, token)` - Paiement exécuté
- `notifyPaymentScheduled(userId, label, amount, token, date)` - Paiement programmé
- `notifyPaymentCancelled(userId, label, amount, token)` - Paiement annulé
- `notifyPaymentFailed(userId, label, reason)` - Paiement échoué
- `notifySystem(userId, title, message)` - Notification système personnalisée
- `createNotification(userId, type, title, message)` - Créer une notification personnalisée

## API Endpoints

### GET /api/notifications
Récupère les notifications de l'utilisateur connecté (max 50)

### PATCH /api/notifications/:id/read
Marque une notification comme lue

### PATCH /api/notifications/read-all
Marque toutes les notifications comme lues

## Interface utilisateur

### Badge de notifications

Le badge s'affiche automatiquement sur le bouton du compte client dans la navbar quand il y a des notifications non lues.

- Affiche le nombre de notifications non lues (max "9+")
- Position : en haut à droite du bouton du compte client
- Couleur : rouge vif (#ef4444)

### Panneau latéral de notifications

Quand l'utilisateur clique sur "Notifications" dans le menu déroulant :
- Un panneau latéral slide depuis la droite de l'écran
- Largeur : 420px sur desktop, plein écran sur mobile
- Affiche toutes les notifications avec :
  - Icône selon le type (💰 payment, ⚙️ system, ℹ️ info)
  - Titre et message
  - Date relative (il y a X min/h/j)
  - Point bleu pour les notifications non lues
  - Fond légèrement coloré pour les non lues
- Message sympa si aucune notification : "Vous êtes à jour ! Les notifications sur vos paiements et messages apparaîtront ici. 💜"
- Bouton "Tout marquer comme lu" si notifications non lues
- Clic sur une notification non lue la marque comme lue automatiquement
