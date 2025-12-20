# 🔄 Proxy API Marilyn

## 📋 Description
Proxy Next.js qui résout le problème CORS entre `localhost:3000` et n8n Cloud.

## 🎯 Pourquoi ce proxy ?
Les webhooks n8n Cloud ne supportent pas CORS par défaut, ce qui bloque les requêtes depuis `localhost:3000` pendant le développement.

Ce proxy :
- ✅ Accepte les requêtes depuis le frontend Next.js
- ✅ Transfère à n8n Cloud
- ✅ Retourne la réponse avec les headers CORS appropriés
- ✅ Log toutes les transactions pour debugging

## 🔌 Endpoint
```
POST http://localhost:3000/api/marilyn
```

## 📦 Format de Requête
```json
{
  "source": "chat",
  "channel": "confidance",
  "user_id": "0x123...abc",
  "message": "Bonjour Marilyn !",
  "context": {
    "page": "/dashboard",
    "wallet_connected": true
  }
}
```

## 📤 Format de Réponse
```json
{
  "success": true,
  "agent": "comm",
  "response": "Bonjour ! Comment puis-je vous aider ?",
  "confidence": "high"
}
```

## 🔧 Configuration
Le proxy redirige vers :
```
https://davyvittu.app.n8n.cloud/webhook/super-agent
```

Pour modifier l'URL, édite la constante `N8N_WEBHOOK_URL` dans `route.js`.

## 🚨 Gestion des Erreurs
Le proxy retourne des erreurs structurées :
```json
{
  "success": false,
  "error": "Erreur n8n (500)",
  "details": "Message d'erreur détaillé"
}
```

## 📊 Logs
Tous les appels sont loggés dans la console Next.js :
- 📤 Requête reçue (source, channel, user_id, message preview)
- 📥 Réponse n8n (status code)
- ✅ Réponse transmise au frontend
- ❌ Erreurs avec détails

## 🔍 Debugging
Vérifier les logs dans le terminal Next.js :
```bash
npm run dev
# Puis regarder les logs [Proxy Marilyn]
```

## 🚀 Production
En production (Vercel/Netlify), le proxy fonctionne exactement pareil mais avec l'URL de production.

**Aucune modification n'est nécessaire pour le déploiement.**

---
Date de création : 13 décembre 2024
