// components/Header/UserMenu.tsx
'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { RegisterModal } from '@/components/Auth/RegisterModal';
import { LoginModal } from '@/components/Auth/LoginModal';
import { VerifyEmailModal } from '@/components/Auth/VerifyEmailModal';
import Link from 'next/link';

export function UserMenu() {
  const { user, isAuthenticated, logout, isLoading } = useAuth();
  
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const handleRegisterSuccess = (email: string, code: string) => {
    setShowRegisterModal(false);
    setVerifyEmail(email);
    setVerifyCode(code);
    setShowVerifyModal(true);
  };

  const handleNeedsVerification = (email: string) => {
    setShowLoginModal(false);
    setVerifyEmail(email);
    setVerifyCode(''); // Pas de code pré-rempli pour login
    setShowVerifyModal(true);
  };

  const handleLogout = () => {
    logout();
    setShowUserDropdown(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowLoginModal(true)}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition-colors"
          >
            Connexion
          </button>
          
          <button
            onClick={() => setShowRegisterModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all"
          >
            Créer un compte
          </button>
        </div>

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

  // Utilisateur connecté
  return (
    <div className="relative">
      <button
        onClick={() => setShowUserDropdown(!showUserDropdown)}
        className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        {/* Avatar */}
        <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
          {user.email[0].toUpperCase()}
        </div>

        {/* Info utilisateur */}
        <div className="text-left hidden md:block">
          <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            {user.accountType === 'professional' && '💼'}
            {user.email.split('@')[0]}
          </div>
          <div className="text-xs text-gray-500">
            {user.accountType === 'professional' ? 'Pro' : 'Particulier'}
          </div>
        </div>

        {/* Chevron */}
        <svg 
          className={`w-4 h-4 text-gray-400 transition-transform ${showUserDropdown ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {showUserDropdown && (
        <>
          {/* Overlay pour fermer */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setShowUserDropdown(false)}
          />
          
          {/* Menu */}
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-20">
            {/* Header du dropdown */}
            <div className="px-4 py-3 border-b border-gray-200">
              <p className="text-sm font-semibold text-gray-900">{user.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  user.accountType === 'professional'
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {user.accountType === 'professional' ? '💼 Professionnel' : '👤 Particulier'}
                </span>
                {user.kycVerified && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                    ✓ KYC
                  </span>
                )}
              </div>
            </div>

            {/* Menu items */}
            <div className="py-2">
              <Link
                href="/dashboard"
                onClick={() => setShowUserDropdown(false)}
                className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Dashboard
              </Link>

              <Link
                href="/create"
                onClick={() => setShowUserDropdown(false)}
                className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Créer un paiement
              </Link>

              <div className="border-t border-gray-200 my-2"></div>

              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Déconnexion
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
