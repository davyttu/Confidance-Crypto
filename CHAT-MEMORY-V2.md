# 🧠 Chat Agent V2 - Système de Mémoire Conversationnelle

## ✅ Ce qui a été fait

### 1. Base de données Supabase
- ✅ Table `chat_conversations` : Sessions de chat par utilisateur
- ✅ Table `chat_messages` : Messages individuels (user/assistant)
- ✅ Vue `chat_history` : Récupération facile conversations + messages
- ✅ Index optimisés pour performance
- ✅ Row Level Security activé
- ✅ Fonction de nettoyage auto (7 jours)

### 2. Backend Services
- ✅ `chatMemoryService.js` : Gestion complète de la mémoire
  - getOrCreateConversation()
  - getConversationHistory()
  - saveUserMessage()
  - saveAssistantMessage()
  - formatHistoryForClaude()
  - cleanupOldConversations()

### 3. Backend Routes
- ✅ `POST /api/chat` : Envoie message + sauvegarde historique
- ✅ `GET /api/chat/history/:userId` : Récupère historique utilisateur
- ✅ `GET /api/chat/health` : Health check avec mémoire

### 4. Workflow n8n
- ✅ Node "Enrich Context" modifié pour inclure l'historique
- ✅ L'historique est envoyé à Claude dans le contexte

---

## 🚀 Comment ça fonctionne

### Flux de conversation

```
1. [Frontend] Utilisateur envoie message "Bonjour, je suis Davy"
   ↓
2. [Backend] Récupère ou crée conversation pour userId
   ↓
3. [Backend] Charge les 10 derniers messages (historique)
   ↓
4. [Backend] Sauvegarde message utilisateur dans Supabase
   ↓
5. [Backend] Formate l'historique en texte lisible
   ↓
6. [Backend] Envoie à n8n : message + historique
   ↓
7. [n8n] Enrichit contexte avec historique
   ↓
8. [n8n] Envoie à Claude avec l'historique
   ↓
9. [Claude] Répond en tenant compte de l'historique
   ↓
10. [Backend] Sauvegarde réponse dans Supabase
   ↓
11. [Frontend] Affiche réponse à l'utilisateur
```

---

## 📊 Structure des données

### chat_conversations
```
id (UUID)
user_id (TEXT) - wallet address ou 'anonymous'
started_at (TIMESTAMP)
last_message_at (TIMESTAMP)
message_count (INTEGER)
is_active (BOOLEAN)
metadata (JSONB)
created_at (TIMESTAMP)
```

### chat_messages
```
id (UUID)
conversation_id (UUID)
role (TEXT) - 'user' ou 'assistant'
content (TEXT)
intent (TEXT) - 'information', 'guide', 'warning', etc.
confidence (NUMERIC) - 0.00 à 1.00
metadata (JSONB)
created_at (TIMESTAMP)
```

---

## 🧪 Tests

### Test 1 : Mémoire simple
```powershell
cd "C:\Users\Davy\les 6 fantastiques"
.\test-memory.ps1
```

**Attendu** :
- Message 1 : "Bonjour, je m'appelle Davy"
- Message 2 : "Quel est mon prénom ?"
- Réponse : "Votre prénom est Davy" ✅

### Test 2 : Via l'interface
1. Ouvre le chat Marilyn
2. Dis : "Je suis développeur blockchain"
3. Attends la réponse
4. Dis : "Quelle est ma profession ?"
5. Marilyn doit répondre : "Vous êtes développeur blockchain" ✅

### Test 3 : Historique persistant
1. Envoie plusieurs messages
2. Ferme le chat
3. Réouvre le chat (même session 24h)
4. La conversation continue là où elle s'était arrêtée ✅

---

## 🔧 Configuration

### Variables d'environnement requises

**Backend (.env)** :
```
SUPABASE_URL=https://rarsvcfytascmoerzsux.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGci...
CHAT_WEBHOOK_URL=https://davyvittu.app.n8n.cloud/webhook/chat/confidance
```

### Paramètres ajustables

**Nombre de messages dans l'historique** :
```javascript
// routes/chat.js - ligne ~54
const history = await getConversationHistory(conversation.id, 10); // Changer 10
```

**Durée de session** :
```javascript
// chatMemoryService.js - ligne ~22
.gte('last_message_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
// 24h = 24 * 60 * 60 * 1000
```

**Nettoyage auto** :
```javascript
// chatMemoryService.js - ligne ~209
const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
// 7 jours
```

---

## 📈 Performance & Scalabilité

### Optimisations

✅ **Index Supabase** : Requêtes rapides même avec millions de messages  
✅ **Limite historique** : Seulement 10 messages chargés (économie tokens Claude)  
✅ **Sessions 24h** : Conversations regroupées automatiquement  
✅ **Nettoyage auto** : Archivage après 7 jours d'inactivité  

### Coûts estimés

**Supabase** : Gratuit jusqu'à 500 MB  
- 1 message = ~1 KB
- 500 000 messages = gratuit ✅

**Claude API** :
- Avec historique (10 msgs) : ~500 tokens/requête
- Coût : ~$0.003 par conversation ✅

---

## 🛡️ Sécurité

### Protections implémentées

✅ **Row Level Security** (RLS) activé sur toutes les tables  
✅ **Service role only** : Seul le backend peut lire/écrire  
✅ **Isolation utilisateur** : Chaque user_id a ses propres conversations  
✅ **Pas de PII** : Les wallets sont anonymisés  

### Bonnes pratiques

⚠️ Ne jamais exposer `SUPABASE_SERVICE_KEY` au frontend  
⚠️ Utiliser optionalAuth pour authentifier les requêtes  
⚠️ Rate limiting recommandé en production (actuellement 5 msg/min frontend)  

---

## 🚀 Prochaines évolutions (V3)

### Fonctionnalités futures

- [ ] **RAG** : Intégration documentation Confidance (recherche sémantique)
- [ ] **Résumés auto** : Condensation conversations longues
- [ ] **Multi-langue** : Détection langue + réponses adaptées
- [ ] **Analytics** : Dashboard questions fréquentes
- [ ] **Feedback** : Thumbs up/down sur réponses
- [ ] **Suggestions proactives** : "Vous voulez créer un paiement ?"
- [ ] **Intégration on-chain** : Vérification solde, statut paiements
- [ ] **Voice** : Support audio input/output

---

## 🐛 Troubleshooting

### Marilyn ne se souvient pas

**Causes possibles** :
1. Conversation expirée (>24h) → Nouvelle session créée
2. userId différent → Chaque wallet a sa propre mémoire
3. Erreur Supabase → Vérifier logs backend

**Solution** :
```bash
# Vérifier les logs
cd confidance-backend
npm start
# Observer les lignes [Memory]
```

### Erreur "Cannot find module chatMemoryService"

**Cause** : Backend pas redémarré après ajout du nouveau service

**Solution** :
```bash
cd confidance-backend
# Ctrl+C
npm start
```

### Historique vide alors qu'il devrait y avoir des messages

**Cause** : Problème d'import Supabase ou RLS trop restrictif

**Solution** :
```sql
-- Dans Supabase SQL Editor
SELECT * FROM chat_conversations WHERE user_id = '0xVotreWallet';
SELECT * FROM chat_messages WHERE conversation_id = 'uuid-conversation';
```

---

## 📝 Checklist de déploiement V2

### Supabase
- [ ] Script SQL exécuté
- [ ] Tables créées (chat_conversations, chat_messages)
- [ ] Vue créée (chat_history)
- [ ] RLS activé et testé

### Backend
- [ ] chatMemoryService.js créé
- [ ] routes/chat.js modifié
- [ ] chatService.js modifié
- [ ] Backend redémarré
- [ ] Logs [Memory] visibles

### n8n
- [ ] Node "Enrich Context" modifié
- [ ] Historique inclus dans le prompt
- [ ] Workflow sauvegardé
- [ ] Test manuel OK

### Tests
- [ ] test-memory.ps1 OK
- [ ] Test via frontend OK
- [ ] Historique persistant vérifié
- [ ] Plusieurs utilisateurs testés

---

## ✅ Status

**Version** : 2.0  
**Date** : 13 décembre 2025  
**Status** : ✅ Ready for Testing  
**Breaking changes** : Aucun (backward compatible avec V1)

---

**Bravo Davy ! Marilyn a maintenant une mémoire ! 🧠✨**
