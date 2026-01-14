// src/lib/i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'fr',
    supportedLngs: ['fr', 'en', 'es', 'ru', 'zh'],
    
    // Désactiver le mode debug en production
    debug: process.env.NODE_ENV === 'development',
    
    interpolation: {
      escapeValue: false, // React déjà sécurisé
    },
    
    // Charger les traductions depuis /public/locales
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
      // ✅ FIX : Ne charger que la langue de base (en au lieu de en-GB)
      load: 'languageOnly',
      // ✅ FIX : Gérer les erreurs de chargement
      requestOptions: {
        cache: 'no-cache',
      },
      // ✅ FIX : Ajouter un gestionnaire d'erreur personnalisé pour le parsing
      parse: (data: string) => {
        try {
          return JSON.parse(data);
        } catch (e) {
          console.error('❌ Erreur parsing JSON i18n:', e);
          throw e;
        }
      },
    },
    
    ns: ['common'],
    defaultNS: 'common',
    
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
    
    // ✅ FIX : S'assurer que les ressources sont chargées avant de considérer i18n comme prêt
    react: {
      useSuspense: false, // Désactiver Suspense pour éviter les problèmes d'hydratation
    },
    
    // ✅ FIX : Retourner la clé si la traduction n'est pas trouvée (pour debug)
    returnNull: false,
    returnEmptyString: false,
    returnObjects: false,
  });

// ✅ FIX : Log pour debug en développement
if (process.env.NODE_ENV === 'development') {
  i18n.on('loaded', (loaded) => {
    console.log('✅ i18n resources loaded:', loaded);
  });
  
  i18n.on('failedLoading', (lng, ns, msg) => {
    // ✅ Ignorer les événements sans informations utiles (peuvent être des faux positifs)
    if (!lng && !ns && !msg) {
      // Événement vide, probablement un faux positif - on ignore
      return;
    }
    
    console.error('❌ i18n failed to load:', { 
      language: lng, 
      namespace: ns, 
      message: msg,
      loadPath: lng && ns ? `/locales/${lng}/${ns}.json` : 'unknown'
    });
    
    // ✅ Afficher plus de détails si disponibles
    if (msg && typeof msg === 'object') {
      console.error('   Détails du message:', msg);
    } else if (msg) {
      console.error('   Message:', msg);
    }
  });
  
  // ✅ Écouter aussi les erreurs de backend
  i18n.on('backendError', (err) => {
    console.error('❌ i18n backend error:', err);
  });
  
  // ✅ Écouter les changements d'état
  i18n.on('initialized', () => {
    console.log('✅ i18n initialized, language:', i18n.language);
  });
  
  i18n.on('languageChanged', (lng) => {
    console.log('🌍 i18n language changed to:', lng);
  });
}

export default i18n;