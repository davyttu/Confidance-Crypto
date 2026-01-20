'use client';

import { useEffect, useRef, useState } from 'react';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { toast } from 'sonner';

interface ProAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  primaryWallet?: string;
  onVerified?: () => void;
  mode?: 'create' | 'update';
}

export function ProAccountModal({
  isOpen,
  onClose,
  userId,
  primaryWallet,
  onVerified,
  mode = 'create'
}: ProAccountModalProps) {
  const { openConnectModal } = useConnectModal();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const [formData, setFormData] = useState({
    companyLegalName: '',
    countryCode: '',
    registrationNumber: '',
    registeredAddress: '',
    businessEmail: '',
    mainBusinessWallet: primaryWallet || '',
    businessActivity: '',
    websiteUrl: '',
    companySize: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState({
    email: false,
    confirmEmail: false,
    password: false,
  });
  const [authData, setAuthData] = useState({
    currentPassword: '',
    newEmail: '',
    emailCode: '',
    newPassword: '',
    confirmNewPassword: '',
  });
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (primaryWallet && !formData.mainBusinessWallet) {
      setFormData((prev) => ({ ...prev, mainBusinessWallet: primaryWallet }));
    }
  }, [primaryWallet, formData.mainBusinessWallet]);

  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setFormData({
        companyLegalName: '',
        countryCode: '',
        registrationNumber: '',
        registeredAddress: '',
        businessEmail: '',
        mainBusinessWallet: primaryWallet || '',
        businessActivity: '',
        websiteUrl: '',
        companySize: ''
      });
      setError(null);
      setSuccess(false);
      setAuthError(null);
      setAuthSuccess(null);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, userId]);

  useEffect(() => {
    if (!isOpen || !userId) return;
    setIsLoadingProfile(true);
    fetch(`/api/pro/profile?user_id=${encodeURIComponent(userId)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || 'Erreur lors du chargement');
        }
        return data?.profile;
      })
      .then((profile) => {
        if (!profile) return;
        setFormData((prev) => ({
          ...prev,
          companyLegalName: profile.company_legal_name || '',
          countryCode: profile.country_code || '',
          registrationNumber: profile.company_registration_number || '',
          registeredAddress: profile.registered_address || '',
          businessEmail: profile.business_email || '',
          mainBusinessWallet: profile.main_business_wallet || prev.mainBusinessWallet || '',
          businessActivity: profile.business_activity || '',
          websiteUrl: profile.website_url || '',
          companySize: profile.company_size || ''
        }));
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Erreur de chargement');
      })
      .finally(() => setIsLoadingProfile(false));
  }, [isOpen, userId]);

  useEffect(() => {
    if (success) {
      contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [success]);

  if (!isOpen) return null;

  // ADDED — garde-fou strict (aucun effet de bord)
  if (!userId) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic client-side validation for clearer UX
    const walletValue = (formData.mainBusinessWallet || primaryWallet || '').trim();
    if (!formData.companyLegalName || formData.companyLegalName.length < 2) {
      setError('Renseigne la raison sociale (au moins 2 caractères).');
      return;
    }
    if (!formData.countryCode) {
      setError('Renseigne le pays (ex: FR).');
      return;
    }
    if (!formData.registrationNumber) {
      setError('Renseigne le numéro d’immatriculation.');
      return;
    }
    if (!formData.registeredAddress || formData.registeredAddress.length < 5) {
      setError('Renseigne l’adresse de l’entreprise.');
      return;
    }
    if (!formData.businessEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.businessEmail)) {
      setError('Adresse email professionnelle invalide.');
      return;
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletValue)) {
      setError('Adresse wallet invalide (format 0x... sur 42 caractères).');
      return;
    }
    if (!formData.businessActivity) {
      setError('Sélectionne une activité.');
      return;
    }
    if (!formData.websiteUrl || !/^https?:\/\//.test(formData.websiteUrl)) {
      setError('Le site doit commencer par https:// (ou http://).');
      return;
    }
    if (!formData.companySize) {
      setError('Sélectionne la taille de l’entreprise.');
      return;
    }

    try {
      setIsSubmitting(true);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch('/api/pro/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          user_id: userId,
          company_legal_name: formData.companyLegalName,
          country_code: formData.countryCode.trim().toUpperCase(), // MODIFIED (normalisation uniquement)
          company_registration_number: formData.registrationNumber,
          registered_address: formData.registeredAddress,
          business_email: formData.businessEmail,
          main_business_wallet: walletValue,
          business_activity: formData.businessActivity,
          website_url: formData.websiteUrl,
          company_size: formData.companySize
        })
      });
      clearTimeout(timeoutId);

      let data: any = null;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(
          text?.includes('<!DOCTYPE')
            ? 'Erreur serveur. Réessaie dans quelques instants.'
            : text || 'Erreur serveur.'
        );
      }

      if (!res.ok) {
        const serverError = data?.error;
        if (serverError === 'TIMEOUT') {
          throw new Error('La validation prend trop de temps. Réessaie dans quelques instants.');
        }
        if (serverError) {
          const readable = getReadableServerError(serverError);
          const details = data?.details ? ` (${data.details})` : '';
          throw new Error(`${readable}${details}`);
        }
        throw new Error(
          data?.errors?.join(', ') || 'Erreur lors de la validation'
        );
      }

      setSuccess(true);
      setError(null);
      toast.success(
        mode === 'update'
          ? 'Infos Pro mises à jour ✅'
          : 'Compte Pro validé ✅'
      );
      onVerified?.();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('La validation prend trop de temps. Réessaie dans quelques instants.');
      } else {
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setSuccess(false);
    setAuthError(null);
    setAuthSuccess(null);
    onClose();
  };

  const getAuthToken = () => localStorage.getItem('token');

  const handleEmailChangeRequest = async () => {
    setAuthError(null);
    setAuthSuccess(null);
    if (!authData.currentPassword) {
      setAuthError('Renseigne ton mot de passe actuel.');
      return;
    }
    if (!authData.newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authData.newEmail)) {
      setAuthError('Nouvel email invalide.');
      return;
    }

    const token = getAuthToken();
    if (!token) {
      setAuthError('Connecte-toi pour modifier ton email.');
      return;
    }

    try {
      setAuthSubmitting((prev) => ({ ...prev, email: true }));
      const res = await fetch(`${apiUrl}/api/auth/change-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          oldPassword: authData.currentPassword,
          newEmail: authData.newEmail,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Erreur lors de la demande de changement d’email');
      }
      setAuthSuccess('Code envoyé sur votre email. Vérifiez votre boîte.');
      toast.success('Code de confirmation envoyé ✅');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setAuthSubmitting((prev) => ({ ...prev, email: false }));
    }
  };

  const handleEmailConfirm = async () => {
    setAuthError(null);
    setAuthSuccess(null);
    if (!authData.emailCode) {
      setAuthError('Renseigne le code reçu par email.');
      return;
    }
    const token = getAuthToken();
    if (!token) {
      setAuthError('Connecte-toi pour confirmer ton email.');
      return;
    }

    try {
      setAuthSubmitting((prev) => ({ ...prev, confirmEmail: true }));
      const res = await fetch(`${apiUrl}/api/auth/confirm-email-change`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ code: authData.emailCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Erreur lors de la confirmation email');
      }
      if (data?.token) {
        localStorage.setItem('token', data.token);
      }
      setAuthSuccess('Email mis à jour ✅');
      toast.success('Email mis à jour ✅');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setAuthSubmitting((prev) => ({ ...prev, confirmEmail: false }));
    }
  };

  const handlePasswordChange = async () => {
    setAuthError(null);
    setAuthSuccess(null);
    if (!authData.currentPassword) {
      setAuthError('Renseigne ton mot de passe actuel.');
      return;
    }
    if (!authData.newPassword || authData.newPassword.length < 8) {
      setAuthError('Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (authData.newPassword !== authData.confirmNewPassword) {
      setAuthError('Les mots de passe ne correspondent pas.');
      return;
    }

    const token = getAuthToken();
    if (!token) {
      setAuthError('Connecte-toi pour modifier ton mot de passe.');
      return;
    }

    try {
      setAuthSubmitting((prev) => ({ ...prev, password: true }));
      const res = await fetch(`${apiUrl}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          oldPassword: authData.currentPassword,
          newPassword: authData.newPassword,
          confirmPassword: authData.confirmNewPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Erreur lors de la modification du mot de passe');
      }
      setAuthSuccess('Mot de passe mis à jour ✅');
      toast.success('Mot de passe mis à jour ✅');
      setAuthData((prev) => ({ ...prev, newPassword: '', confirmNewPassword: '' }));
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setAuthSubmitting((prev) => ({ ...prev, password: false }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div
        ref={contentRef}
        className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            {mode === 'update' ? 'Modifier mon compte Pro' : 'Passer en compte Pro'}
          </h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
          {success ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 text-sm">
              {mode === 'update' ? '✅ Infos Pro mises à jour.' : '✅ Compte Pro vérifié.'}
            </div>
          ) : (
            <>
              {isLoadingProfile && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                  Chargement des informations…
                </div>
              )}
              <Input label="Company legal name" value={formData.companyLegalName}
                onChange={(v) => setFormData({ ...formData, companyLegalName: v })} />

              <Input label="Country" value={formData.countryCode}
                onChange={(v) => setFormData({ ...formData, countryCode: v })} />

              <Input label="Company registration number" value={formData.registrationNumber}
                onChange={(v) => setFormData({ ...formData, registrationNumber: v })} />

              <Textarea label="Registered address" value={formData.registeredAddress}
                onChange={(v) => setFormData({ ...formData, registeredAddress: v })} />

              <Input label="Business email" type="email" value={formData.businessEmail}
                onChange={(v) => setFormData({ ...formData, businessEmail: v })} />

              <Input label="Main business wallet" value={formData.mainBusinessWallet}
                onChange={(v) => setFormData({ ...formData, mainBusinessWallet: v })} />
              {!primaryWallet && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-50 text-purple-600">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11V3m0 0l-3 3m3-3l3 3M4 11h16a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4a2 2 0 012-2z" />
                    </svg>
                  </span>
                  <span>Connecte ton wallet pour pre-remplir</span>
                  <button
                    type="button"
                    onClick={() => openConnectModal?.()}
                    className="text-purple-600 hover:text-purple-700 font-medium"
                  >
                    Connecter le wallet
                  </button>
                </div>
              )}

              <Input label="Website" value={formData.websiteUrl}
                onChange={(v) => setFormData({ ...formData, websiteUrl: v })} />

              <Select
                label="Business activity"
                value={formData.businessActivity}
                options={[
                  'Software / SaaS',
                  'Freelance / Consulting',
                  'E-commerce',
                  'Real estate',
                  'Education',
                  'Media / Content',
                  'Finance / Crypto',
                  'Other'
                ]}
                onChange={(v) => setFormData({ ...formData, businessActivity: v })}
              />

              <Select
                label="Company size"
                value={formData.companySize}
                options={['SOLO', '2_10', '11_50', '50_PLUS']}
                onChange={(v) => setFormData({ ...formData, companySize: v })}
              />

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                  {error}
                </div>
              )}

              <div className="pt-2 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900">Connexion</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Pour modifier votre email ou mot de passe, saisissez votre mot de passe actuel.
                </p>
              </div>

              <Input
                label="Mot de passe actuel"
                type="password"
                value={authData.currentPassword}
                onChange={(v) => setAuthData({ ...authData, currentPassword: v })}
                required={false}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Nouvel email"
                  type="email"
                  value={authData.newEmail}
                  onChange={(v) => setAuthData({ ...authData, newEmail: v })}
                  required={false}
                />
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleEmailChangeRequest}
                    disabled={authSubmitting.email}
                    className="w-full py-2.5 px-4 text-sm bg-gray-900 text-white rounded-lg disabled:opacity-50"
                  >
                    {authSubmitting.email ? 'Envoi...' : 'Envoyer le code'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Code de confirmation"
                  value={authData.emailCode}
                  onChange={(v) => setAuthData({ ...authData, emailCode: v })}
                  required={false}
                />
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleEmailConfirm}
                    disabled={authSubmitting.confirmEmail}
                    className="w-full py-2.5 px-4 text-sm bg-purple-600 text-white rounded-lg disabled:opacity-50"
                  >
                    {authSubmitting.confirmEmail ? 'Confirmation...' : 'Confirmer le nouvel email'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Nouveau mot de passe"
                  type="password"
                  value={authData.newPassword}
                  onChange={(v) => setAuthData({ ...authData, newPassword: v })}
                  required={false}
                />
                <Input
                  label="Confirmer le mot de passe"
                  type="password"
                  value={authData.confirmNewPassword}
                  onChange={(v) => setAuthData({ ...authData, confirmNewPassword: v })}
                  required={false}
                />
              </div>

              <button
                type="button"
                onClick={handlePasswordChange}
                disabled={authSubmitting.password}
                className="w-full py-2.5 text-sm bg-gray-100 text-gray-900 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
              >
                {authSubmitting.password ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}
              </button>

              {authError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                  {authError}
                </div>
              )}
              {authSuccess && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                  {authSuccess}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg disabled:opacity-50"
              >
                {isSubmitting
                  ? 'Validation...'
                  : mode === 'update'
                    ? 'Mettre à jour mes infos Pro'
                    : 'Valider mon compte Pro'}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}

/* ---------- Small local helpers (no refactor global) ---------- */

function Input({ label, value, onChange, type = 'text', required = true }: any) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
      />
    </div>
  );
}

function Textarea({ label, value, onChange, required = true }: any) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
      />
    </div>
  );
}

function getReadableServerError(code: string) {
  switch (code) {
    case 'SUPABASE_UPSERT_FAILED':
      return "Impossible d'enregistrer les informations Pro. Réessaie dans quelques instants.";
    case 'SUPABASE_VERIFY_UPDATE_FAILED':
      return "Impossible de finaliser la validation Pro. Réessaie plus tard.";
    case 'SUPABASE_WALLET_CHECK_FAILED':
      return "Impossible de vérifier le wallet. Réessaie plus tard.";
    case 'SUPABASE_REJECT_UPDATE_FAILED':
      return "Erreur lors de la mise à jour du compte. Réessaie plus tard.";
    case 'SUPABASE_PROFILE_FETCH_FAILED':
      return "Impossible de charger le profil Pro. Réessaie plus tard.";
    default:
      return 'Erreur serveur. Réessaie dans quelques instants.';
  }
}

function Select({ label, value, options, onChange, required = true }: any) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
      >
        <option value="">Select…</option>
        {options.map((o: string) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}
