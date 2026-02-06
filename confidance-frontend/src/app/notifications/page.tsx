'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';

export default function NotificationsPage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useNotifications();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, authLoading, router]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">{t('common.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'payment':
        return '💰';
      case 'system':
        return '⚙️';
      case 'info':
        return 'ℹ️';
      default:
        return '🔔';
    }
  };

  const localeMap: Record<string, string> = { fr: 'fr-FR', en: 'en-US', es: 'es-ES', ru: 'ru-RU', zh: 'zh-CN' };
  const dateLocale = localeMap[(i18n?.language || 'fr').split('-')[0]] || 'fr-FR';

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return t('notificationsPanel.timeAgo.justNow');
    if (diffInSeconds < 3600) return t('notificationsPanel.timeAgo.minutesAgo', { count: Math.floor(diffInSeconds / 60) });
    if (diffInSeconds < 86400) return t('notificationsPanel.timeAgo.hoursAgo', { count: Math.floor(diffInSeconds / 3600) });
    if (diffInSeconds < 604800) return t('notificationsPanel.timeAgo.daysAgo', { count: Math.floor(diffInSeconds / 86400) });
    return date.toLocaleDateString(dateLocale, {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  return (
    <div className="min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="container mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                🔔 {t('notificationsPanel.title')}
              </h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                {unreadCount > 0
                  ? t('notificationsPanel.unreadCount', { count: unreadCount })
                  : t('notificationsPanel.allRead')}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="px-4 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
              >
                {t('notificationsPanel.markAllRead')}
              </button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <div className="space-y-3">
          {notifications.length === 0 ? (
            <div className="glass rounded-xl p-12 text-center">
              <div className="text-6xl mb-4">🔔</div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {t('notificationsPanel.emptyTitle')}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {t('notificationsPanel.emptyPageMessage')}
              </p>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-lg hover:shadow-lg hover:shadow-primary-500/30 transition-all font-medium"
              >
                {t('notificationsPanel.backToDashboard')}
              </Link>
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => !notification.read && markAsRead(notification.id)}
                className={`glass rounded-xl p-4 transition-all cursor-pointer hover:shadow-lg ${
                  !notification.read
                    ? 'border-l-4 border-primary-500 bg-primary-50/50 dark:bg-primary-900/10'
                    : 'border-l-4 border-transparent'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 text-2xl">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className={`text-sm font-semibold ${
                        !notification.read
                          ? 'text-gray-900 dark:text-white'
                          : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {notification.title}
                      </h3>
                      {!notification.read && (
                        <span className="flex-shrink-0 w-2 h-2 bg-primary-500 rounded-full mt-1.5"></span>
                      )}
                    </div>
                    <p className={`mt-1 text-sm ${
                      !notification.read
                        ? 'text-gray-700 dark:text-gray-300'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      {notification.message}
                    </p>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                      {formatDate(notification.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
