# Guide de Debug - Notifications de liens de paiement 🔍

## Problème : Aucune notification reçue après validation du lien

Suis ces étapes pour identifier le problème.

---

## Étape 1 : Vérifier la configuration

```bash
cd confidance-backend
node scripts/check-notification-setup.js
```

Ce script vérifie :
- ✅ Si la table `notifications` existe
- ✅ Si tes liens de paiement sont dans la base
- ✅ Si les créateurs de liens ont un compte utilisateur
- ✅ S'il y a des notifications existantes

### Problèmes courants

**❌ La table notifications n'existe pas**
→ Solution : Exécute `create-notifications-table.sql` dans Supabase SQL Editor

**❌ Le créateur du lien n'a pas de compte utilisateur**
→ Solution : Le wallet qui crée le lien doit être connecté à un compte utilisateur

---

## Étape 2 : Regarder les logs du backend

Après avoir validé un lien, regarde la console de ton backend. Tu devrais voir :

```
🔍 [NOTIF DEBUG] Ancien statut: pending, Nouveau statut: paid
✅ [NOTIF DEBUG] Conditions remplies, création de notification...
🔍 [NOTIF DEBUG] Adresse créateur: 0xABC...
✅ [NOTIF DEBUG] User trouvé: ton@email.com (ID: 1)
📝 [NOTIF DEBUG] Création notification: {...}
✅ Notification envoyée au créateur (user 1) pour le lien abc123
```

### Si tu vois "⚠️ Créateur non trouvé"

Problème : L'adresse du créateur n'est pas dans la table `users` avec le bon `primary_wallet`.

**Solution :**
1. Connecte-toi à l'app avec le wallet qui a créé le lien
2. Vérifie dans Supabase que `primary_wallet` dans la table `users` correspond exactement à l'adresse du créateur

---

## Étape 3 : Test forcé avec un lien existant

Si tu veux forcer la création d'une notification pour tester :

```bash
# Récupère l'ID de ton lien (dans l'URL ou la base de données)
node scripts/force-test-notification.js TON_LINK_ID
```

Ce script :
- ✅ Vérifie que le lien existe
- ✅ Trouve l'utilisateur associé au créateur
- ✅ Crée une notification de test
- ✅ Met le statut du lien à "paid"

Ensuite, connecte-toi et vérifie tes notifications !

---

## Étape 4 : Vérifier dans Supabase

### Voir les notifications créées

```sql
SELECT * FROM notifications
ORDER BY created_at DESC
LIMIT 10;
```

### Voir les liens de paiement

```sql
SELECT id, creator, status, label, amount, token, created_at
FROM payment_links
ORDER BY created_at DESC
LIMIT 10;
```

### Voir les utilisateurs et leurs wallets

```sql
SELECT id, email, primary_wallet
FROM users
ORDER BY created_at DESC
LIMIT 10;
```

### Vérifier la correspondance créateur ↔ user

```sql
-- Remplace 0xABC... par l'adresse du créateur
SELECT u.id, u.email, u.primary_wallet, pl.id as link_id, pl.status
FROM users u
LEFT JOIN payment_links pl ON LOWER(pl.creator) = LOWER(u.primary_wallet)
WHERE LOWER(u.primary_wallet) = LOWER('0xABC...');
```

---

## Checklist de debug

- [ ] La table `notifications` existe dans Supabase
- [ ] Le lien de paiement existe dans `payment_links`
- [ ] Le statut du lien passe bien à `"paid"` après validation
- [ ] L'adresse du créateur (`creator` dans `payment_links`) correspond exactement à `primary_wallet` dans `users` (en lowercase)
- [ ] L'utilisateur a un compte (présent dans la table `users`)
- [ ] Les logs backend montrent que la notification est créée
- [ ] Le frontend rafraîchit les notifications (toutes les 30 secondes)

---

## Solutions aux problèmes courants

### 1. Le wallet du créateur n'est pas lié à un compte

**Symptôme :**
```
⚠️ Créateur 0xABC... non trouvé dans la base users
```

**Solution :**
1. Connecte-toi à l'app avec ce wallet
2. Crée un compte ou connecte-toi
3. Le wallet sera automatiquement lié au compte

### 2. Les adresses ne correspondent pas (casse différente)

**Symptôme :** Le créateur existe mais n'est pas trouvé

**Solution :** J'ai normalisé en lowercase dans le code, mais vérifie que dans ta base `primary_wallet` est bien en lowercase :

```sql
-- Normaliser tous les primary_wallet en lowercase
UPDATE users
SET primary_wallet = LOWER(primary_wallet)
WHERE primary_wallet IS NOT NULL;
```

### 3. La table notifications n'existe pas

**Symptôme :**
```
❌ La table notifications n'existe pas ou n'est pas accessible !
```

**Solution :**
1. Va sur https://supabase.com/dashboard
2. SQL Editor
3. Copie-colle le contenu de `create-notifications-table.sql`
4. Run

### 4. Le statut du lien ne se met pas à jour

**Symptôme :** Le lien reste en `pending` après validation

**Solution :** Vérifie que ton frontend appelle bien `PATCH /api/payment-links/:id` avec `status: "paid"`

---

## Test rapide complet

Pour tester de bout en bout :

```bash
# 1. Vérifier la config
node scripts/check-notification-setup.js

# 2. Créer une notification de test
node scripts/test-notifications.js 1  # Remplace 1 par ton user_id

# 3. Forcer une notification sur un lien existant
node scripts/force-test-notification.js abc123  # Remplace par ton link_id
```

---

## Besoin d'aide ?

Si après toutes ces étapes ça ne fonctionne toujours pas :

1. **Copie les logs** de ta console backend
2. **Copie le résultat** de `check-notification-setup.js`
3. **Vérifie dans Supabase** :
   - La structure de la table `users` (colonnes)
   - La structure de la table `payment_links` (colonnes)
   - Les données d'un lien de test

Et partage-moi tout ça pour que je puisse t'aider ! 🚀
