'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { RegisterModal } from '@/components/Auth/RegisterModal';
import { LoginModal } from '@/components/Auth/LoginModal';
import { VerifyEmailModal } from '@/components/Auth/VerifyEmailModal';

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { user, isAuthenticated, logout, isLoading } = useAuth();
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const links = [
    { href: '/', label: 'Accueil' },
    { href: '/create', label: 'Créer' },
    { href: '/dashboard', label: 'Dashboard' },
  ];

  const handleRegisterSuccess = (email: string, code: string) => {
    setShowRegisterModal(false);
    setVerifyEmail(email);
    setVerifyCode(code);
    setShowVerifyModal(true);
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

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex-1">
              {/* Logo */}
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

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1">
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

            {/* Right side - BOUTON UNIQUE */}
            <div className="flex-1 flex justify-end items-center gap-3">
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
                            user?.accountType === 'professional' 
                              ? 'bg-purple-500' 
                              : 'bg-blue-500'
                          }`}>
                            {user?.accountType === 'professional' ? '💼' : '👤'}
                          </div>
                        </div>

                        {/* Nom + flèche */}
                        <div className="flex items-center gap-2">
                          <div className="text-left">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">
                              {user?.email.split('@')[0]}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {user?.accountType === 'professional' ? 'Pro' : 'Particulier'}
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
                                  user?.accountType === 'professional'
                                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                }`}>
                                  {user?.accountType === 'professional' ? '💼 Pro' : '👤 Perso'}
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
                              <Link
                                href="/dashboard"
                                onClick={() => setShowUserDropdown(false)}
                                className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                                Dashboard
                              </Link>

                              <Link
                                href="/create"
                                onClick={() => setShowUserDropdown(false)}
                                className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Créer un paiement
                              </Link>

                              <div className="border-t border-gray-200 dark:border-gray-700 my-1.5"></div>

                              <button
                                onClick={handleLogout}
                                className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                                Déconnexion
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
                <ConnectButton />
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
                      Connexion
                    </button>
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setShowRegisterModal(true);
                      }}
                      className="w-full px-4 py-2.5 text-sm font-medium bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-lg shadow-lg text-left"
                    >
                      Créer un compte
                    </button>
                  </>
                ) : (
                  <div className="space-y-2">
                    <div className="px-4 py-2.5 bg-gradient-to-r from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20 rounded-lg">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user?.email}</p>
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {user?.accountType === 'professional' ? '💼 Professionnel' : '👤 Particulier'}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-left"
                    >
                      Déconnexion
                    </button>
                  </div>
                )}
                <ConnectButton />
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
        onSuccess={handleRegisterSuccess}
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
        onClose={() => setShowVerifyModal(false)}
        email={verifyEmail}
        verificationCode={verifyCode}
      />
    </>
  );
}
