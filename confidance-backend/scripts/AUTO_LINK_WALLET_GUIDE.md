# Guide : Liaison automatique du wallet 🔗

## Ce qui a été mis en place

Le système lie maintenant **automatiquement** le wallet de l'utilisateur à son compte quand il se connecte.

### Comment ça marche ?

1. ✅ **L'utilisateur crée un compte** (email + mot de passe)
2. ✅ **L'utilisateur connecte son wallet** (MetaMask, Coinbase Wallet, etc.)
3. ✅ **Le système lie automatiquement** le wallet au compte
4. ✅ **Les notifications fonctionnent** maintenant !

### Processus technique

1. Quand l'utilisateur est connecté (compte + wallet), le hook `useLinkWallet` s'exécute
2. Il appelle `POST /api/link-wallet` avec l'adresse du wallet
3. Le backend met à jour `primary_wallet` dans la table `users`
4. Désormais, quand quelqu'un paie un lien créé par cet utilisateur, le système peut trouver l'utilisateur et lui envoyer une notification

---

## 🚀 Installation (À FAIRE UNE SEULE FOIS)

### Étape 1 : Ajouter la colonne dans Supabase

Va sur https://supabase.com/dashboard → SQL Editor → Exécute :

```sql
-- Ajouter la colonne primary_wallet
ALTER TABLE users
ADD COLUMN IF NOT EXISTS primary_wallet VARCHAR(42);

-- Index pour recherches rapides
CREATE INDEX IF NOT EXISTS idx_users_primary_wallet ON users(primary_wallet);
```

### Étape 2 : Redémarrer le backend

```bash
# Ctrl+C pour arrêter
node index.js
```

### Étape 3 : C'est tout ! 🎉

Maintenant, dès qu'un utilisateur se connecte avec son wallet, il sera automatiquement lié.

---

## 🧪 Comment tester

### Test 1 : Utilisateur existant (Paul)

1. **Déconnecte Paul** de l'app (déconnexion complète)
2. **Reconnecte Paul** avec :
   - Son email/mot de passe
   - Son wallet MetaMask
3. **Attends 1-2 secondes**
4. **Vérifie dans Supabase** :
   ```sql
   SELECT id, email, primary_wallet
   FROM users
   WHERE email = 'paul@email.com';
   ```
   Tu devrais voir son wallet dans `primary_wallet` !

### Test 2 : Nouvel utilisateur

1. **Crée un nouveau compte** (Ali par exemple)
2. **Connecte le wallet** d'Ali
3. **Crée un lien de paiement** avec le compte d'Ali
4. **Valide le lien** avec un autre wallet (par exemple Paul)
5. **Ali reçoit une notification** ! 🎉

### Test 3 : Vérifier dans les logs

Quand un utilisateur se connecte, tu devrais voir dans les logs backend :

```
🔗 [AUTO-LINK] Tentative de liaison du wallet 0x...
🔗 [LINK-WALLET] Liaison du wallet 0x... à l'utilisateur abc-123
✅ [LINK-WALLET] Wallet lié avec succès pour user abc-123
```

---

## 🔍 Vérifier que ça marche

### Script de vérification

```bash
node scripts/check-users-table.js
```

Tu devrais maintenant voir les wallets remplis :

```
1. User ID: abc-123
   Email: paul@email.com
   Primary wallet: 0x8cc0d8f899b0ef553459aac249b14a95f0470ce9 ✅
```

### Vérifier les notifications

```bash
node scripts/check-notification-setup.js
```

Tu devrais voir :

```
✅ 0x8cc0d8f899b0ef553459aac249b14a95f0470ce9
   → User ID: abc-123, Email: paul@email.com
```

---

## 📋 Checklist de déploiement

- [ ] SQL exécuté dans Supabase (colonne `primary_wallet` ajoutée)
- [ ] Backend redémarré
- [ ] Paul se reconnecte (son wallet doit être lié)
- [ ] Ali se reconnecte (son wallet doit être lié)
- [ ] Test d'un lien de paiement : Ali paie → Paul reçoit une notification
- [ ] Vérifier dans Supabase que les `primary_wallet` sont remplis

---

## 🎯 Pour les utilisateurs existants

Si Paul et Ali ont déjà des comptes mais que leur wallet n'est pas encore lié :

**Solution simple** : Ils doivent juste se déconnecter puis se reconnecter avec leur wallet.

Le système liera automatiquement leur wallet à leur compte !

---

## 🐛 Dépannage

### Le wallet n'est pas lié automatiquement

**Vérifications** :
1. L'utilisateur est bien connecté (compte + wallet) ?
2. Tu vois les logs `[AUTO-LINK]` dans le backend ?
3. La colonne `primary_wallet` existe dans Supabase ?

**Solution** : Vérifie les logs du backend et copie-les pour diagnostic.

### Les notifications ne marchent toujours pas

**Vérifications** :
1. Le wallet est bien dans `primary_wallet` de Supabase ?
2. Tu vois les logs `[NOTIF DEBUG]` quand quelqu'un paie ?
3. Le statut du lien passe bien à "paid" ?

**Solution** : Lance `node scripts/force-test-notification.js <link_id>`

---

## ✅ C'est prêt !

Maintenant :
- ✅ Les wallets sont automatiquement liés aux comptes
- ✅ Les notifications fonctionnent
- ✅ Pas besoin de configuration manuelle

**Il suffit que Paul et Ali se reconnectent une fois avec leur wallet !** 🚀
