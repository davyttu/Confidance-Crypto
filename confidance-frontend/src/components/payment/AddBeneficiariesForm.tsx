// src/components/payment/AddBeneficiariesForm.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';

interface BeneficiaryHistoryItem {
  address: string;
  name?: string;
}

export default function AddBeneficiariesForm() {
  const router = useRouter();
  const { t, ready: translationsReady } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem('beneficiaryHistory');
      if (storedHistory) {
        const parsed = JSON.parse(storedHistory);
        if (Array.isArray(parsed)) {
          const normalized = parsed
            .map((item) => {
              if (typeof item === 'string') {
                return { address: item };
              }
              if (item && typeof item === 'object' && typeof item.address === 'string') {
                return { address: item.address, name: item.name };
              }
              return null;
            })
            .filter((item): item is BeneficiaryHistoryItem => Boolean(item));
          setHistoryItems(normalized);
        }
      }
      const storedFavorites = localStorage.getItem('beneficiaryFavorites');
      if (storedFavorites) {
        const parsed = JSON.parse(storedFavorites);
        if (Array.isArray(parsed)) {
          setFavoriteAddresses(parsed.filter((item) => typeof item === 'string'));
        }
      }
    } catch (error) {
      console.error('Error loading beneficiary history:', error);
    }
  }, []);

  const [beneficiaries, setBeneficiaries] = useState<string[]>(['', '', '', '']);
  const [errors, setErrors] = useState<string[]>(['', '', '', '']);
  const [historyItems, setHistoryItems] = useState<BeneficiaryHistoryItem[]>([]);
  const [favoriteAddresses, setFavoriteAddresses] = useState<string[]>([]);
  const [activeHistoryIndex, setActiveHistoryIndex] = useState<number | null>(null);
  const fieldRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (activeHistoryIndex === null) return;
      const current = fieldRefs.current[activeHistoryIndex];
      if (current && !current.contains(event.target as Node)) {
        setActiveHistoryIndex(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeHistoryIndex]);

  const isValidAddress = (address: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  const handleAddressChange = (index: number, value: string) => {
    const updated = [...beneficiaries];
    updated[index] = value;
    setBeneficiaries(updated);

    // Validation
    const updatedErrors = [...errors];
    if (value && !isValidAddress(value)) {
      updatedErrors[index] = isMounted && translationsReady ? t('create.beneficiary.invalidAddress') : 'Adresse invalide';
    } else {
      updatedErrors[index] = '';
    }
    setErrors(updatedErrors);
  };

  const persistFavorites = (next: string[]) => {
    setFavoriteAddresses(next);
    localStorage.setItem('beneficiaryFavorites', JSON.stringify(next));
  };

  const toggleFavorite = (address: string) => {
    const normalized = address.toLowerCase();
    if (favoriteAddresses.some((item) => item.toLowerCase() === normalized)) {
      persistFavorites(favoriteAddresses.filter((item) => item.toLowerCase() !== normalized));
    } else {
      persistFavorites([address, ...favoriteAddresses]);
    }
  };

  const updateHistoryWithAddresses = (addresses: string[]) => {
    if (addresses.length === 0) return;
    setHistoryItems((prev) => {
      const next: BeneficiaryHistoryItem[] = [...prev];
      addresses.forEach((address) => {
        const normalized = address.toLowerCase();
        const existing = next.find((item) => item.address.toLowerCase() === normalized);
        if (existing) {
          next.splice(next.indexOf(existing), 1);
          next.unshift(existing);
        } else {
          next.unshift({ address });
        }
      });
      const trimmed = next.slice(0, 10);
      localStorage.setItem('beneficiaryHistory', JSON.stringify(trimmed));
      return trimmed;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Filtrer les adresses vides et valides
    const validAddresses = beneficiaries.filter(addr => addr && isValidAddress(addr));

    if (validAddresses.length === 0) {
      alert(isMounted && translationsReady ? t('create.beneficiary.addAtLeastOne') : 'Ajoutez au moins une adresse valide');
      return;
    }

    // Sauvegarder dans localStorage
    localStorage.setItem('additionalBeneficiaries', JSON.stringify(validAddresses));
    updateHistoryWithAddresses(validAddresses);

    // Retour sur /create
    router.push('/create');
  };

  const handleCancel = () => {
    router.push('/create');
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
        {isMounted && translationsReady ? t('create.beneficiary.addTitle') : '➕ Ajouter des bénéficiaires'}
      </h2>
      
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        {isMounted && translationsReady ? t('create.beneficiary.addDescription') : 'Ajoutez jusqu\'à 4 bénéficiaires supplémentaires (ils recevront le même montant)'}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {beneficiaries.map((address, index) => {
          const query = address.trim().toLowerCase();
          const favorites = favoriteAddresses
            .map((fav) => {
              const item = historyItems.find(
                (entry) => entry.address.toLowerCase() === fav.toLowerCase()
              );
              return item || { address: fav };
            })
            .filter((item) => {
              if (!query) return true;
              return (
                item.address.toLowerCase().includes(query) ||
                (item.name ? item.name.toLowerCase().includes(query) : false)
              );
            });
          const recents = historyItems
            .filter(
              (item) =>
                !favoriteAddresses.some(
                  (fav) => fav.toLowerCase() === item.address.toLowerCase()
                )
            )
            .filter((item) => {
              if (!query) return true;
              return (
                item.address.toLowerCase().includes(query) ||
                (item.name ? item.name.toLowerCase().includes(query) : false)
              );
            })
            .slice(0, 5);

          return (
            <div key={index} ref={(el) => { fieldRefs.current[index] = el; }}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {isMounted && translationsReady 
                ? t('create.beneficiary.beneficiaryLabel', { number: index + 2 })
                : `Bénéficiaire ${index + 2} (optionnel)`}
            </label>
            <div className="relative">
              <input
                type="text"
                value={address}
                onChange={(e) => handleAddressChange(index, e.target.value)}
                placeholder="0x..."
                className={`
                  w-full px-4 py-3 pr-10 rounded-xl border-2
                  bg-white dark:bg-gray-900
                  text-gray-900 dark:text-white
                  transition-all
                  ${
                    errors[index]
                      ? 'border-red-500 focus:border-red-600'
                      : 'border-gray-200 dark:border-gray-700 focus:border-primary-500'
                  }
                  focus:outline-none focus:ring-4 focus:ring-primary-500/20
                `}
              />
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() =>
                  setActiveHistoryIndex(activeHistoryIndex === index ? null : index)
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary-500 transition-colors"
                title={
                  isMounted && translationsReady
                    ? t('create.beneficiary.recentTitle', { defaultValue: 'Recent addresses' })
                    : 'Recent addresses'
                }
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
                  />
                </svg>
              </button>

              <div
                className={`
                  mt-2 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700
                  bg-white/90 dark:bg-gray-900/90 backdrop-blur
                  shadow-sm transition-all duration-200
                  ${activeHistoryIndex === index ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'}
                `}
                onMouseDown={(event) => event.preventDefault()}
              >
                {favorites.length > 0 && (
                  <>
                    <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                      {isMounted && translationsReady
                        ? t('create.beneficiary.favoritesTitle', { defaultValue: 'Favorites' })
                        : 'Favorites'}
                    </div>
                    <div className="border-b border-gray-200 dark:border-gray-700" />
                  </>
                )}

                <div className="max-h-56 overflow-auto">
                  {favorites.map((item) => {
                    const isFavorite = favoriteAddresses.some(
                      (fav) => fav.toLowerCase() === item.address.toLowerCase()
                    );
                    return (
                      <div
                        key={`fav-${item.address}`}
                        className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <button
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            handleAddressChange(index, item.address);
                            setActiveHistoryIndex(null);
                          }}
                          className="flex-1 text-left"
                        >
                          <div className="flex flex-col">
                            {item.name && (
                              <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
                                {item.name}
                              </span>
                            )}
                            <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                              {item.address}
                            </span>
                          </div>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => toggleFavorite(item.address)}
                          className="p-1 rounded-full hover:bg-yellow-100/60 dark:hover:bg-yellow-500/10"
                          title={isMounted && translationsReady ? t('create.beneficiary.toggleFavorite', { defaultValue: 'Toggle favorite' }) : 'Toggle favorite'}
                        >
                          <svg
                            className={`w-4 h-4 ${isFavorite ? 'text-yellow-500 fill-yellow-400' : 'text-gray-400'}`}
                            viewBox="0 0 24 24"
                            fill={isFavorite ? 'currentColor' : 'none'}
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M12 17.3l-6.18 3.24 1.18-6.88L1 8.96l6.91-1 3.09-6.26 3.09 6.26 6.91 1-5 4.7 1.18 6.88L12 17.3z" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}

                  <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                    {isMounted && translationsReady
                      ? t('create.beneficiary.recentTitle')
                      : 'Recent addresses'}
                  </div>
                  {recents.length > 0 ? (
                    recents.map((item) => {
                      const isFavorite = favoriteAddresses.some(
                        (fav) => fav.toLowerCase() === item.address.toLowerCase()
                      );
                      return (
                        <div
                          key={item.address}
                          className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                          <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            handleAddressChange(index, item.address);
                            setActiveHistoryIndex(null);
                          }}
                            className="flex-1 text-left"
                          >
                            <div className="flex flex-col">
                              {item.name && (
                                <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
                                  {item.name}
                                </span>
                              )}
                              <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                                {item.address}
                              </span>
                            </div>
                          </button>
                          <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => toggleFavorite(item.address)}
                            className="p-1 rounded-full hover:bg-yellow-100/60 dark:hover:bg-yellow-500/10"
                            title={isMounted && translationsReady ? t('create.beneficiary.toggleFavorite', { defaultValue: 'Toggle favorite' }) : 'Toggle favorite'}
                          >
                            <svg
                              className={`w-4 h-4 ${isFavorite ? 'text-yellow-500 fill-yellow-400' : 'text-gray-400'}`}
                              viewBox="0 0 24 24"
                              fill={isFavorite ? 'currentColor' : 'none'}
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M12 17.3l-6.18 3.24 1.18-6.88L1 8.96l6.91-1 3.09-6.26 3.09 6.26 6.91 1-5 4.7 1.18 6.88L12 17.3z" />
                            </svg>
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                      {isMounted && translationsReady
                        ? t('create.beneficiary.recentEmpty')
                        : 'No recent addresses'}
                    </div>
                  )}
                </div>
              </div>
            </div>
            {errors[index] && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                {errors[index]}
              </p>
            )}
          </div>
        );
        })}

        <div className="flex gap-4 mt-8">
          <button
            type="button"
            onClick={handleCancel}
            className="flex-1 py-3 px-6 rounded-xl font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
          >
            {isMounted && translationsReady ? t('create.beneficiary.cancel') : 'Annuler'}
          </button>
          
          <button
            type="submit"
            className="flex-1 py-3 px-6 rounded-xl font-bold text-white bg-gradient-to-r from-primary-500 via-purple-500 to-pink-500 hover:shadow-xl hover:scale-105 transition-all"
          >
            {isMounted && translationsReady ? t('create.beneficiary.validate') : '✅ Valider'}
          </button>
        </div>
      </form>
    </div>
  );
}
