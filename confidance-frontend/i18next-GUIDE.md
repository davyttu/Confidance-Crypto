# 🌍 Installation i18next pour Confidance Crypto

## ✅ Ce qui a été installé

```bash
npm install i18next react-i18next i18next-browser-languagedetector
```

## 📁 Structure créée

```
confidance-frontend/
├── public/
│   └── locales/
│       ├── fr/
│       │   └── common.json
│       ├── en/
│       │   └── common.json
│       └── es/
│           └── common.json
├── src/
│   ├── lib/
│   │   └── i18n.ts
│   ├── components/
│   │   └── LanguageSwitcher.tsx
│   └── app/
│       └── providers.tsx (modifié)
```

## 🎯 Comment utiliser dans tes composants

### Dans un composant Client ('use client')

```typescript
'use client';
import { useTranslation } from 'react-i18next';

export default function MonComposant() {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('home.title')}</h1>
      <p>{t('home.subtitle')}</p>
      <button>{t('common.connect')}</button>
    </div>
  );
}
```

### Ajouter le Language Switcher à la Navbar

Dans `src/components/layout/Navbar.tsx`, ajoute :

```typescript
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

// Puis dans le JSX :
<LanguageSwitcher />
```

## 🔧 Configuration

- **Langues supportées** : FR (défaut), EN, ES, RU, ZH
- **Détection automatique** : Oui (navigateur + localStorage)
- **Fallback** : Français
- **Fichiers de traduction** : `/public/locales/{langue}/common.json`

### 🌍 Langues disponibles

| Code | Langue | Drapeau |
|------|--------|---------|
| fr | Français | 🇫🇷 |
| en | English | 🇬🇧 |
| es | Español | 🇪🇸 |
| ru | Русский | 🇷🇺 |
| zh | 中文 | 🇨🇳 |

## 📝 Ajouter de nouvelles traductions

1. Édite `/public/locales/fr/common.json`
2. Édite `/public/locales/en/common.json`
3. Édite `/public/locales/es/common.json`
4. Édite `/public/locales/ru/common.json`
5. Édite `/public/locales/zh/common.json`

## 🚀 Avantages vs next-intl

✅ Pas de restructuration des routes
✅ Fonctionne avec ton code actuel
✅ Client-side (plus simple)
✅ Change de langue instantanément
✅ Stockage de la préférence utilisateur

## 🎨 Le site fonctionne normalement

- Ton code actuel n'est **PAS CASSÉ**
- Les traductions sont **OPTIONNELLES**
- Tu peux traduire composant par composant
- Tout fonctionne même sans traductions

## 📋 Prochaines étapes

1. Ajoute `<LanguageSwitcher />` dans la Navbar
2. Remplace progressivement les textes en dur par `t('clé')`
3. Teste le changement de langue
4. Ajoute de nouvelles traductions au besoin

**Le site continue de fonctionner normalement en attendant !** 🎉