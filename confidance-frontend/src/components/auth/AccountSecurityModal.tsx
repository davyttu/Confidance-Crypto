'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

interface AccountSecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
}

export function AccountSecurityModal({ isOpen, onClose, userEmail }: AccountSecurityModalProps) {
  const { t } = useTranslation();
  const tText = (key: string, fallback: string) => t(key, { defaultValue: fallback });
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
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

  useEffect(() => {
    if (!isOpen) return;
    setAuthError(null);
    setAuthSuccess(null);
    setIsUnlocked(false);
    setAuthSubmitting({ email: false, confirmEmail: false, password: false });
    setAuthData({
      currentPassword: '',
      newEmail: '',
      emailCode: '',
      newPassword: '',
      confirmNewPassword: '',
    });
  }, [isOpen]);

  useEffect(() => {
    if (!authData.currentPassword) {
      setIsUnlocked(false);
    }
  }, [authData.currentPassword]);

  if (!isOpen) return null;

  const getAuthToken = () => localStorage.getItem('token');

  const requireUnlock = () => {
    if (!authData.currentPassword) {
      setAuthError(tText('common.accountSettings.errors.currentPasswordRequired', 'Enter your current password.'));
      return false;
    }
    if (!isUnlocked) {
      setAuthError(tText('common.accountSettings.errors.unlockRequired', 'Unlock access to edit your login details.'));
      return false;
    }
    return true;
  };

  const handleUnlock = () => {
    setAuthError(null);
    setAuthSuccess(null);
    if (!authData.currentPassword) {
      setAuthError(tText('common.accountSettings.errors.currentPasswordRequired', 'Enter your current password.'));
      return;
    }
    setIsUnlocked(true);
  };

  const handleEmailChangeRequest = async () => {
    setAuthError(null);
    setAuthSuccess(null);
    if (!requireUnlock()) return;
    if (!authData.newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authData.newEmail)) {
      setAuthError(tText('common.accountSettings.errors.invalidEmail', 'Enter a valid new email address.'));
      return;
    }

    const token = getAuthToken();
    if (!token) {
      setAuthError(tText('common.accountSettings.errors.loginRequiredEmail', 'Sign in to update your email.'));
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
        throw new Error(data?.error || tText('common.accountSettings.errors.emailRequestFailed', 'Unable to request email change.'));
      }
      setAuthSuccess(tText('common.accountSettings.success.emailCodeSent', 'Verification code sent. Check your inbox.'));
      toast.success(tText('common.accountSettings.success.emailCodeSent', 'Verification code sent. Check your inbox.'));
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : tText('common.accountSettings.errors.emailRequestFailed', 'Unable to request email change.'));
    } finally {
      setAuthSubmitting((prev) => ({ ...prev, email: false }));
    }
  };

  const handleEmailConfirm = async () => {
    setAuthError(null);
    setAuthSuccess(null);
    if (!requireUnlock()) return;
    if (!authData.emailCode) {
      setAuthError(tText('common.accountSettings.errors.codeRequired', 'Enter the verification code sent to your new email.'));
      return;
    }
    const token = getAuthToken();
    if (!token) {
      setAuthError(tText('common.accountSettings.errors.loginRequiredConfirm', 'Sign in to confirm your email change.'));
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
        throw new Error(data?.error || tText('common.accountSettings.errors.emailConfirmFailed', 'Unable to confirm email change.'));
      }
      if (data?.token) {
        localStorage.setItem('token', data.token);
      }
      setAuthSuccess(tText('common.accountSettings.success.emailUpdated', 'Email updated successfully.'));
      toast.success(tText('common.accountSettings.success.emailUpdated', 'Email updated successfully.'));
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : tText('common.accountSettings.errors.emailConfirmFailed', 'Unable to confirm email change.'));
    } finally {
      setAuthSubmitting((prev) => ({ ...prev, confirmEmail: false }));
    }
  };

  const handlePasswordChange = async () => {
    setAuthError(null);
    setAuthSuccess(null);
    if (!requireUnlock()) return;
    if (!authData.newPassword || authData.newPassword.length < 8) {
      setAuthError(tText('common.accountSettings.errors.passwordTooShort', 'New password must be at least 8 characters.'));
      return;
    }
    if (authData.newPassword !== authData.confirmNewPassword) {
      setAuthError(tText('common.accountSettings.errors.passwordsMismatch', 'Passwords do not match.'));
      return;
    }

    const token = getAuthToken();
    if (!token) {
      setAuthError(tText('common.accountSettings.errors.loginRequiredPassword', 'Sign in to update your password.'));
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
        throw new Error(data?.error || tText('common.accountSettings.errors.passwordUpdateFailed', 'Unable to update password.'));
      }
      setAuthSuccess(tText('common.accountSettings.success.passwordUpdated', 'Password updated successfully.'));
      toast.success(tText('common.accountSettings.success.passwordUpdated', 'Password updated successfully.'));
      setAuthData((prev) => ({ ...prev, newPassword: '', confirmNewPassword: '' }));
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : tText('common.accountSettings.errors.passwordUpdateFailed', 'Unable to update password.'));
    } finally {
      setAuthSubmitting((prev) => ({ ...prev, password: false }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between">
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              {tText('common.accountSettings.title', 'Login details')}
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              {tText('common.accountSettings.subtitle', "Update your email or password. You'll need your current password.")}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        <div className="px-6 py-6 space-y-4">
          {userEmail && (
            <div className="text-xs text-gray-500">
              {userEmail}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
            <Input
              label={tText('common.accountSettings.currentPasswordLabel', 'Current password')}
              type="password"
              value={authData.currentPassword}
              onChange={(v: string) => setAuthData({ ...authData, currentPassword: v })}
              required={false}
            />
            <button
              type="button"
              onClick={handleUnlock}
              className="w-full sm:w-auto py-2.5 px-4 text-sm bg-gray-900 text-white rounded-lg"
            >
              {isUnlocked
                ? tText('common.accountSettings.unlockedLabel', 'Unlocked')
                : tText('common.accountSettings.unlockButton', 'Unlock')}
            </button>
          </div>

          <div className="pt-2 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">
              {tText('common.accountSettings.emailSectionTitle', 'Email')}
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label={tText('common.accountSettings.newEmailLabel', 'New email')}
              type="email"
              value={authData.newEmail}
              onChange={(v: string) => setAuthData({ ...authData, newEmail: v })}
              disabled={!isUnlocked}
              required={false}
            />
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleEmailChangeRequest}
                disabled={!isUnlocked || authSubmitting.email}
                className="w-full py-2.5 px-4 text-sm bg-gray-900 text-white rounded-lg disabled:opacity-50"
              >
                {authSubmitting.email
                  ? tText('common.accountSettings.sendCodeLoading', 'Sending...')
                  : tText('common.accountSettings.sendCodeButton', 'Send verification code')}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label={tText('common.accountSettings.confirmCodeLabel', 'Verification code')}
              value={authData.emailCode}
              onChange={(v: string) => setAuthData({ ...authData, emailCode: v })}
              disabled={!isUnlocked}
              required={false}
            />
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleEmailConfirm}
                disabled={!isUnlocked || authSubmitting.confirmEmail}
                className="w-full py-2.5 px-4 text-sm bg-purple-600 text-white rounded-lg disabled:opacity-50"
              >
                {authSubmitting.confirmEmail
                  ? tText('common.accountSettings.confirmEmailLoading', 'Confirming...')
                  : tText('common.accountSettings.confirmEmailButton', 'Confirm new email')}
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">
              {tText('common.accountSettings.passwordSectionTitle', 'Password')}
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label={tText('common.accountSettings.newPasswordLabel', 'New password')}
              type="password"
              value={authData.newPassword}
              onChange={(v: string) => setAuthData({ ...authData, newPassword: v })}
              disabled={!isUnlocked}
              required={false}
            />
            <Input
              label={tText('common.accountSettings.confirmPasswordLabel', 'Confirm new password')}
              type="password"
              value={authData.confirmNewPassword}
              onChange={(v: string) => setAuthData({ ...authData, confirmNewPassword: v })}
              disabled={!isUnlocked}
              required={false}
            />
          </div>

          <button
            type="button"
            onClick={handlePasswordChange}
            disabled={!isUnlocked || authSubmitting.password}
            className="w-full py-2.5 text-sm bg-gray-100 text-gray-900 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
          >
            {authSubmitting.password
              ? tText('common.accountSettings.updatePasswordLoading', 'Updating...')
              : tText('common.accountSettings.updatePasswordButton', 'Update password')}
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
        </div>
      </div>
    </div>
  );
}

interface InputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  disabled?: boolean;
}

function Input({ label, value, onChange, type = 'text', required = true, disabled = false }: InputProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100 disabled:text-gray-400"
      />
    </div>
  );
}
