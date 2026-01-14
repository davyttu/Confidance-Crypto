// src/hooks/useTranslationReady.ts
'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Hook personnalisé pour vérifier que les traductions sont réellement chargées
 * et pas seulement que i18n est initialisé
 */
export function useTranslationReady() {
  const { t, ready: translationsReady, i18n } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);
  const [resourcesReady, setResourcesReady] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    
    // ✅ Vérifier que les ressources sont réellement chargées
    const checkResources = () => {
      const currentLang = i18n.language || 'fr';
      const baseLang = currentLang.split('-')[0];
      const hasResources = i18n.hasResourceBundle(baseLang, 'common');
      
      // Vérifier aussi qu'une traduction de test fonctionne
      const testTranslation = t('nav.home', { defaultValue: '' });
      const isWorking = hasResources && translationsReady && testTranslation !== 'nav.home';
      
      setResourcesReady(isWorking);
    };
    
    // Vérifier immédiatement
    checkResources();
    
    // Écouter les changements de langue et de ressources
    i18n.on('languageChanged', checkResources);
    i18n.store.on('added', checkResources);
    i18n.store.on('loaded', checkResources);
    
    return () => {
      i18n.off('languageChanged', checkResources);
      i18n.store.off('added', checkResources);
      i18n.store.off('loaded', checkResources);
    };
  }, [i18n, translationsReady, t]);

  return {
    t,
    i18n,
    ready: isMounted && resourcesReady,
    isMounted,
  };
}
