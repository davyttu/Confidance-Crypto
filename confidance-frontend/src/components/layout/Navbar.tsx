'use client';

import { ConnectButton, useAccountModal, useConnectModal } from '@rainbow-me/rainbowkit';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Copy, Menu, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { RegisterModal } from '@/components/Auth/RegisterModal';
import { LoginModal } from '@/components/Auth/LoginModal';
import { VerifyEmailModal } from '@/components/Auth/VerifyEmailModal';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useTranslation } from 'react-i18next';
import { useEffect, useState as useStateReact } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { ProAccountModal } from '@/components/Pro/ProAccountModal'; // ADDED
import { AccountSecurityModal } from '@/components/Auth/AccountSecurityModal';

export function Navbar() {
  const { t, ready: translationsReady } = useTranslation();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useStateReact(false);

  const { user, isAuthenticated, logout, isLoading, refreshUser } = useAuth();
  const { address } = useAccount();
  const { disconnect } = useDisconnect();
  const { openAccountModal } = useAccountModal();
  const { openConnectModal: openConnectModalHook } = useConnectModal();
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showWalletMenu, setShowWalletMenu] = useState(false);
  const walletMenuCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [walletAliases, setWalletAliases] = useState<Record<string, string>>({});
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  // ADDED — ouverture auto du formulaire Pro après inscription + vérification email
  const [pendingAccountType, setPendingAccountType] = useState<'particular' | 'professional' | null>(null);
  const [showProModal, setShowProModal] = useState(false);
  const [showAccountSecurityModal, setShowAccountSecurityModal] = useState(false);

  // ✅ FIX : Éviter le mismatch d'hydratation en attendant que les traductions soient chargées
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !isMounted) return;
    if (typeof window === 'undefined') return;

    const key = user?.id ? `walletAliases:${user.id}` : 'walletAliases';
    const loadAliases = () => {
      try {
        const raw = localStorage.getItem(key);
        setWalletAliases(raw ? JSON.parse(raw) : {});
      } catch (error) {
        console.error('⚠️ Impossible de charger les alias de wallet:', error);
      }
    };

    loadAliases();

    const handleAliasesUpdated = (event: Event) => {
      const detail = (event as CustomEvent<Record<string, string>>).detail;
      if (detail) {
        setWalletAliases(detail);
      } else {
        loadAliases();
      }
    };

    window.addEventListener('wallet-aliases-updated', handleAliasesUpdated as EventListener);
    return () => {
      window.removeEventListener('wallet-aliases-updated', handleAliasesUpdated as EventListener);
    };
  }, [isAuthenticated, isMounted, user?.id]);

  const handleCopyAddress = async (event: React.MouseEvent, address?: string) => {
    event.preventDefault();
    event.stopPropagation();
    if (!address) return;

    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      setTimeout(() => setCopiedAddress(null), 1500);
    } catch (error) {
      console.error('❌ Copie wallet échouée:', error);
    }
  };

  const getWalletLabel = (address?: string, fallback?: string) => {
    if (!address) return fallback || '';
    const alias = walletAliases[address.toLowerCase()];
    return alias || fallback || address;
  };

  const formatAddressShort = (addr?: string) => {
    if (!addr) return '';
    if (addr.length <= 12) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // ✅ FIX : Utiliser des valeurs par défaut pendant l'hydratation
  const links = isMounted && translationsReady ? [
    { href: '/payment', label: t('nav.create') },
    { href: '/dashboard', label: t('nav.dashboard') },
    { href: '/liquidity', label: t('nav.liquidity') || 'Liquidité' },
  ] : [
    { href: '/payment', label: 'Paiements' },
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/liquidity', label: 'Liquidité' },
  ];

  // MODIFIED — on récupère aussi accountType choisi à l’inscription
  const handleRegisterSuccess = (email: string, code: string, accountType: 'particular' | 'professional') => {
    setShowRegisterModal(false);
    setVerifyEmail(email);
    setVerifyCode(code);
    setShowVerifyModal(true);

    // ADDED
    setPendingAccountType(accountType);
  };

  const handleNeedsVerification = (email: string) => {
    setShowLoginModal(false);
    setVerifyEmail(email);
    setVerifyCode('');
    setShowVerifyModal(true);
  };

  const handleLogout = () => {
    logout();
    setShowUserDropdown(false);
  };

  // ADDED — valeurs “safe” pour ProAccountModal (sans casser si le type user évolue)
  const userId = (user as any)?.id;
  const proStatus = (user as any)?.proStatus;
  const isProVerified = proStatus === 'verified';
  const canUpgradeToPro = !!userId && !isProVerified;
  const primaryWallet =
    (user as any)?.walletAddress ||
    (user as any)?.primaryWallet ||
    (user as any)?.primary_wallet ||
    (user as any)?.primaryWalletAddress ||
    address ||
    '';

  const handleWalletModalOpen = (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    if (openAccountModal) {
      openAccountModal();
      return;
    }
    if (openConnectModalHook) {
      openConnectModalHook();
    }
  };

  const handleDisconnectWallet = (event?: React.SyntheticEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    disconnect();
    setShowWalletMenu(false);
  };

  const handleWalletMenuEnter = () => {
    if (walletMenuCloseTimer.current) {
      clearTimeout(walletMenuCloseTimer.current);
      walletMenuCloseTimer.current = null;
    }
    setShowWalletMenu(true);
  };

  const handleWalletMenuLeave = () => {
    if (walletMenuCloseTimer.current) {
      clearTimeout(walletMenuCloseTimer.current);
    }
    walletMenuCloseTimer.current = setTimeout(() => {
      setShowWalletMenu(false);
    }, 1500);
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-8">
            {/* Logo - Left side */}
            <div className="flex-shrink-0">
              <Link href="/" className="flex items-center gap-3 group">
                <div className="relative">
                  <div className="absolute inset-0 gradient-primary rounded-xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity" />
                  <div className="relative w-10 h-10 gradient-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/50">
                    <span className="text-white font-bold text-xl">C</span>
                  </div>
                </div>
                <span className="font-bold text-xl hidden sm:block bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent">
                  Confidance
                </span>
              </Link>
            </div>

            {/* Language Switcher - Between logo and nav */}
            <div className="hidden md:block flex-shrink-0">
              <LanguageSwitcher />
            </div>

            {/* Desktop Navigation - Center */}
            <div className="hidden md:flex items-center gap-1 flex-1 justify-center">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    pathname === link.href
                      ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/50'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Right side - Auth + Wallet */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {!isLoading && (
                <>
                  {!isAuthenticated ? (
                    // Bouton "Se connecter" quand non connecté
                    <button
                      onClick={() => setShowLoginModal(true)}
                      className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-lg hover:shadow-lg hover:shadow-primary-500/30 transition-all font-medium"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                      </svg>
                      Se connecter
                    </button>
                  ) : (
                    // Menu utilisateur quand connecté
                    <div className="hidden sm:block relative">
                      <button
                        onClick={() => setShowUserDropdown(!showUserDropdown)}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
                      >
                        {/* Avatar avec badge type compte */}
                        <div className="relative">
                          <div className="w-9 h-9 bg-gradient-to-r from-primary-500 to-primary-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md">
                            {user?.email[0].toUpperCase()}
                          </div>
                          {/* Badge type de compte */}
                          <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white dark:border-gray-900 flex items-center justify-center text-xs ${
                            isProVerified
                              ? 'bg-purple-500' 
                              : 'bg-blue-500'
                          }`}>
                            {isProVerified ? '💼' : '👤'}
                          </div>
                        </div>

                        {/* Nom + flèche */}
                        <div className="flex items-center gap-2">
                          <div className="text-left">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">
                              {user?.email.split('@')[0]}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {isMounted && translationsReady ? (isProVerified ? t('common.accountType.professional') : t('common.accountType.individual')) : (isProVerified ? 'Pro' : 'Particulier')}
                            </p>
                          </div>
                          <svg 
                            className={`w-4 h-4 text-gray-400 transition-transform ${showUserDropdown ? 'rotate-180' : ''}`}
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>

                      {/* Dropdown */}
                      {showUserDropdown && (
                        <>
                          <div 
                            className="fixed inset-0 z-10" 
                            onClick={() => setShowUserDropdown(false)}
                          />
                          
                          <div className="absolute right-0 mt-2 w-56 glass rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-20 overflow-hidden">
                            {/* Header */}
                            <div className="px-4 py-3 bg-gradient-to-r from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20 border-b border-gray-200 dark:border-gray-700">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user?.email}</p>
                              <div className="flex items-center gap-1.5 mt-1.5">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
                                  isProVerified
                                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                }`}>
                                  {isProVerified ? '💼 Pro' : '👤 Perso'}
                                </span>
                                {user?.kycVerified && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                    ✓ KYC
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Menu items */}
                            <div className="py-1.5">
                              {canUpgradeToPro && (
                                <button
                                  onClick={() => {
                                    setShowUserDropdown(false);
                                    setShowProModal(true);
                                  }}
                                  className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                                >
                                  <span>💼</span>
                                  Passer en compte Pro
                                </button>
                              )}
                              {!isProVerified && (
                                <button
                                  onClick={() => {
                                    setShowUserDropdown(false);
                                    setShowAccountSecurityModal(true);
                                  }}
                                  className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                >
                                  <span>🔐</span>
                                  {isMounted && translationsReady
                                    ? t('common.accountSettings.menuLabel', { defaultValue: 'Login details' })
                                    : 'Login details'}
                                </button>
                              )}
                              {isProVerified && (
                                <button
                                  onClick={() => {
                                    setShowUserDropdown(false);
                                    setShowProModal(true);
                                  }}
                                  className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                                >
                                  <span>📝</span>
                                  Modifier mes infos Pro
                                </button>
                              )}
                              <Link
                                href="/dashboard"
                                onClick={() => setShowUserDropdown(false)}
                                className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                                {isMounted && translationsReady ? t('nav.dashboard') : 'Dashboard'}
                              </Link>

                              <Link
                                href="/analytics"
                                onClick={() => setShowUserDropdown(false)}
                                className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                              >
                                <span aria-hidden="true">📊</span>
                                {isMounted && translationsReady ? t('nav.analytics') : 'Analytics'}
                              </Link>

                            <div className="border-t border-gray-200 dark:border-gray-700 my-1.5"></div>

                              <button
                                onClick={handleLogout}
                                className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                                {isMounted && translationsReady ? t('common.disconnect') : 'Déconnexion'}
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* ConnectButton */}
              <div className="hidden sm:block">
                <ConnectButton.Custom>
                  {({
                    account,
                    chain,
                    openAccountModal,
                    openChainModal,
                    openConnectModal,
                    authenticationStatus,
                    mounted,
                  }) => {
                    const ready = mounted;
                    const connected =
                      ready &&
                      account &&
                      chain;

                    return (
                      <div>
                        {(() => {
                          if (!connected) {
                            return (
                              <button
                                onClick={openConnectModal}
                                type="button"
                                className="px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-lg hover:shadow-lg hover:shadow-primary-500/30 transition-all font-medium"
                              >
                                {isMounted && translationsReady ? t('common.connect') : 'Connecter le portefeuille'}
                              </button>
                            );
                          }

                          if (chain.unsupported) {
                            return (
                              <button onClick={openChainModal} type="button">
                                Wrong network
                              </button>
                            );
                          }

                          return (
                            <div style={{ display: 'flex', gap: 12 }}>
                              <button
                                onClick={openChainModal}
                                style={{ display: 'flex', alignItems: 'center' }}
                                type="button"
                                title={isMounted && translationsReady ? t('common.connect') : 'Réseau'}
                              >
                                {chain.hasIcon && (
                                  <div
                                    style={{
                                      background: chain.iconBackground,
                                      width: 12,
                                      height: 12,
                                      borderRadius: 999,
                                      overflow: 'hidden',
                                      marginRight: 4,
                                    }}
                                  >
                                    {chain.iconUrl && (
                                      <img
                                        alt={chain.name ?? 'Chain icon'}
                                        src={chain.iconUrl}
                                        style={{ width: 12, height: 12 }}
                                      />
                                    )}
                                  </div>
                                )}
                                {chain.name}
                              </button>

                              <div
                                className="relative"
                                onMouseEnter={handleWalletMenuEnter}
                                onMouseLeave={handleWalletMenuLeave}
                              >
                                <button type="button" className="cursor-pointer">
                                  {getWalletLabel(account.address, account.displayName)}
                                  {account.displayBalance
                                    ? ` (${account.displayBalance})`
                                    : ''}
                                </button>
                                {showWalletMenu && (
                                  <div
                                    className="absolute right-0 top-full mt-2 w-60 rounded-lg border border-gray-200 bg-white shadow-xl z-20"
                                    onMouseEnter={handleWalletMenuEnter}
                                    onMouseLeave={handleWalletMenuLeave}
                                  >
                                      <div className="px-3 py-2 flex items-center justify-between gap-2">
                                        <span
                                          className="text-xs font-mono text-gray-500 truncate max-w-[170px]"
                                          title={account.address}
                                        >
                                          {formatAddressShort(account.address)}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={(event) => handleCopyAddress(event, account.address)}
                                          className="p-1 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                                          title={copiedAddress === account.address
                                            ? (isMounted && translationsReady ? t('beneficiary.copied') : 'Copied!')
                                            : (isMounted && translationsReady ? t('beneficiary.copyAddress') : 'Copy address')}
                                        >
                                          <Copy className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                      <div className="border-t border-gray-100"></div>
                                      <button
                                        type="button"
                                        onClick={handleDisconnectWallet}
                                        className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50"
                                      >
                                        {isMounted && translationsReady ? t('common.disconnect') : 'Déconnexion'}
                                      </button>
                                    </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  }}
                </ConnectButton.Custom>
              </div>

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {mobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>

          {/* Mobile menu */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 space-y-2 animate-fade-in">
              {/* Language Switcher Mobile */}
              <div className="px-4 py-2">
                <LanguageSwitcher />
              </div>
              
              <div className="border-t border-gray-200 dark:border-gray-800 pt-2">
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      pathname === link.href
                        ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/50'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-800 space-y-2">
                {!isAuthenticated ? (
                  <>
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setShowLoginModal(true);
                      }}
                      className="w-full px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-left"
                    >
                      {isMounted && translationsReady ? t('common.connect') : 'Connexion'}
                    </button>
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setShowRegisterModal(true);
                      }}
                      className="w-full px-4 py-2.5 text-sm font-medium bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-lg shadow-lg text-left"
                    >
                      {isMounted && translationsReady ? t('common.register') : 'Créer un compte'}
                    </button>
                  </>
                ) : (
                  <div className="space-y-2">
                    <div className="px-4 py-2.5 bg-gradient-to-r from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20 rounded-lg">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user?.email}</p>
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                      {isMounted && translationsReady ? (isProVerified ? `💼 ${t('common.accountType.professional')}` : `👤 ${t('common.accountType.individual')}`) : (isProVerified ? '💼 Professionnel' : '👤 Particulier')}
                      </span>
                    </div>
                    {canUpgradeToPro && (
                      <button
                        onClick={() => {
                          setMobileMenuOpen(false);
                          setShowProModal(true);
                        }}
                        className="w-full px-4 py-2.5 text-sm font-medium text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors text-left"
                      >
                        💼 Passer en compte Pro
                      </button>
                    )}
                    {isProVerified && (
                      <button
                        onClick={() => {
                          setMobileMenuOpen(false);
                          setShowProModal(true);
                        }}
                        className="w-full px-4 py-2.5 text-sm font-medium text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors text-left"
                      >
                        📝 Modifier mes infos Pro
                      </button>
                    )}
                    {!isProVerified && (
                      <button
                        onClick={() => {
                          setMobileMenuOpen(false);
                          setShowAccountSecurityModal(true);
                        }}
                        className="w-full px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-left"
                      >
                        🔐 {isMounted && translationsReady
                          ? t('common.accountSettings.menuLabel', { defaultValue: 'Login details' })
                          : 'Login details'}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-left"
                    >
                      {isMounted && translationsReady ? t('common.disconnect') : 'Déconnexion'}
                    </button>
                  </div>
                )}
                <ConnectButton.Custom>
                  {({
                    account,
                    chain,
                    openAccountModal,
                    openChainModal,
                    openConnectModal,
                    authenticationStatus,
                    mounted,
                  }) => {
                    const ready = mounted;
                    const connected =
                      ready &&
                      account &&
                      chain;

                    return (
                      <div>
                        {(() => {
                          if (!connected) {
                            return (
                              <button
                                onClick={openConnectModal}
                                type="button"
                                className="w-full px-4 py-2.5 text-sm font-medium bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-lg shadow-lg text-left"
                              >
                                {isMounted && translationsReady ? t('common.connect') : 'Connecter le portefeuille'}
                              </button>
                            );
                          }

                          if (chain.unsupported) {
                            return (
                              <button onClick={openChainModal} type="button" className="w-full px-4 py-2.5 text-sm font-medium text-red-600 rounded-lg text-left">
                                Wrong network
                              </button>
                            );
                          }

                          return (
                            <div className="space-y-2">
                              <button
                                onClick={openChainModal}
                                type="button"
                                className="w-full px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg text-left flex items-center gap-2"
                              >
                                {chain.hasIcon && (
                                  <div className="w-4 h-4 rounded-full overflow-hidden">
                                    {chain.iconUrl && (
                                      <img
                                        alt={chain.name ?? 'Chain icon'}
                                        src={chain.iconUrl}
                                        className="w-4 h-4"
                                      />
                                    )}
                                  </div>
                                )}
                                {chain.name}
                              </button>

                              <button
                                onClick={handleWalletModalOpen}
                                onPointerDown={handleWalletModalOpen}
                                type="button"
                                className="w-full px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg text-left cursor-pointer"
                              >
                                {getWalletLabel(account.address, account.displayName)}
                                {account.displayBalance
                                  ? ` (${account.displayBalance})`
                                  : ''}
                              </button>
                              <button
                                onClick={handleDisconnectWallet}
                                type="button"
                                className="w-full px-4 py-2.5 text-sm font-medium text-red-600 rounded-lg text-left hover:bg-red-50"
                              >
                                {isMounted && translationsReady ? t('common.disconnect') : 'Déconnexion'}
                              </button>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  }}
                </ConnectButton.Custom>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Modals */}
      <RegisterModal
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        onSwitchToLogin={() => {
          setShowRegisterModal(false);
          setShowLoginModal(true);
        }}
        onSuccess={handleRegisterSuccess} // MODIFIED
      />

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSwitchToRegister={() => {
          setShowLoginModal(false);
          setShowRegisterModal(true);
        }}
        onNeedsVerification={handleNeedsVerification}
      />

      <VerifyEmailModal
        isOpen={showVerifyModal}
        onClose={() => {
          setShowVerifyModal(false);

          // ADDED — si l’utilisateur vient de créer un compte pro, ouvrir le formulaire pro
          if (pendingAccountType === 'professional') {
            setShowProModal(true);
          }
        }}
        email={verifyEmail}
        verificationCode={verifyCode}
      />

      {/* ADDED — Modal Compte Pro */}
      {userId && (
        <ProAccountModal
          isOpen={showProModal}
          onClose={() => setShowProModal(false)}
          userId={userId}
          primaryWallet={primaryWallet}
          mode={isProVerified ? 'update' : 'create'}
          onVerified={() => {
            setPendingAccountType(null);
            refreshUser();
          }}
        />
      )}

      <AccountSecurityModal
        isOpen={showAccountSecurityModal}
        onClose={() => setShowAccountSecurityModal(false)}
        userEmail={user?.email}
      />
    </>
  );
}
