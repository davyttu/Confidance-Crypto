# Configuration SMTP pour le formulaire de contact

Le formulaire de contact utilise nodemailer pour envoyer les emails vers l'adresse configurée dans `CONTACT_EMAIL`.

## Variables d'environnement requises

Copiez le fichier `.env.local.example` vers `.env.local` et configurez vos identifiants SMTP.

### Option 1: Configuration avec Brevo (recommandé)

Brevo (anciennement Sendinblue) est plus fiable et offre une meilleure délivrabilité.

```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=xkeysib-votre_clé_API_Brevo_ici
SMTP_FROM_EMAIL=contact@confidance-defi.com
CONTACT_EMAIL=davyes0101@gmail.com
```

**Comment obtenir votre clé API Brevo :**
1. Créez un compte sur [Brevo](https://www.brevo.com)
2. Allez dans **Settings** → **SMTP & API** → **API Keys**
3. Créez une nouvelle clé API
4. Copiez la clé (format: `xkeysib-...`) et collez-la dans `SMTP_PASSWORD`

### Option 2: Configuration avec Hostinger

Si vous utilisez un email Hostinger, utilisez cette configuration :

```env
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=contact@confidance-defi.com
SMTP_PASSWORD=votre_mot_de_passe_email
SMTP_FROM_EMAIL=contact@confidance-defi.com
CONTACT_EMAIL=davyes0101@gmail.com
```

**Paramètres SMTP Hostinger :**
- **Serveur SMTP** : `smtp.hostinger.com`
- **Port SSL** : `465` (recommandé, connexion sécurisée)
- **Port TLS** : `587` (alternative)
- **Authentification** : Requise (email complet + mot de passe)

## Notes importantes

1. Le port 465 utilise SSL (secure: true)
2. Le port 587 utilise STARTTLS (secure: false)
3. Assurez-vous que les identifiants sont corrects
4. Pour Brevo : `SMTP_USER` doit être `apikey` (littéralement) et `SMTP_PASSWORD` doit être votre clé API
5. Pour Hostinger : `SMTP_USER` doit être votre adresse email complète et `SMTP_PASSWORD` votre mot de passe
6. Les emails sont envoyés vers l'adresse configurée dans `CONTACT_EMAIL`
7. Le champ `replyTo` est configuré avec l'email de l'expéditeur pour pouvoir répondre directement

## Résolution des problèmes

### Erreur d'authentification SMTP

Si vous obtenez une erreur d'authentification :

1. **Vérifiez que `.env.local` existe** à la racine du projet `confidance-frontend`
2. **Vérifiez les variables d'environnement** dans `.env.local`
3. **Pour Brevo** : Assurez-vous que :
   - `SMTP_USER=apikey` (littéralement le mot "apikey")
   - `SMTP_PASSWORD` est votre clé API Brevo (commence par `xkeysib-`)
4. **Pour Hostinger** : Assurez-vous que :
   - `SMTP_USER` est votre adresse email complète
   - `SMTP_PASSWORD` est le mot de passe de votre compte email
5. **Redémarrez le serveur Next.js** après avoir modifié `.env.local`

### Logs de diagnostic

Le code affiche maintenant des logs détaillés dans la console du serveur pour aider au diagnostic :
- Configuration SMTP détectée
- Résultat de la vérification de connexion
- Détails des erreurs d'authentification

## Test

Pour tester la configuration :
1. Configurez `.env.local` avec vos identifiants
2. Redémarrez le serveur Next.js (`npm run dev`)
3. Remplissez le formulaire de contact sur `/aide/contact`
4. Vérifiez la console du serveur pour les logs de diagnostic
5. Vérifiez que l'email arrive bien dans la boîte configurée dans `CONTACT_EMAIL`


