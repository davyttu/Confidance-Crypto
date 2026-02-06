const { createClient } = require('@supabase/supabase-js');
const { t } = require('../locales/notificationTranslations');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function getUserLocale(userId) {
  try {
    const { data } = await supabase.from('users').select('locale').eq('id', userId).single();
    const locale = data?.locale && ['fr', 'en', 'es', 'ru', 'zh'].includes(data.locale) ? data.locale : 'fr';
    return locale;
  } catch {
    return 'fr';
  }
}

/**
 * Crée une notification pour un utilisateur
 * @param {number} userId - ID de l'utilisateur
 * @param {string} type - Type de notification ('payment', 'system', 'info')
 * @param {string} title - Titre de la notification
 * @param {string} message - Message de la notification
 * @returns {Promise<object>} - Résultat de la création
 */
async function createNotification(userId, type, title, message) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert([
        {
          user_id: userId,
          type: type,
          title: title,
          message: message,
          read: false,
          created_at: new Date().toISOString()
        }
      ])
      .select();

    if (error) {
      console.error('❌ Error creating notification:', error);
      return { success: false, error };
    }

    console.log(`✅ Notification created for user ${userId}: ${title}`);
    return { success: true, data: data[0] };
  } catch (error) {
    console.error('❌ Error in createNotification:', error);
    return { success: false, error };
  }
}

/**
 * Crée une notification de paiement exécuté
 * @param {number} userId - ID de l'utilisateur
 * @param {string} paymentLabel - Label du paiement
 * @param {string} amount - Montant du paiement
 * @param {string} token - Token du paiement
 */
async function notifyPaymentExecuted(userId, paymentLabel, amount, token, locale) {
  const loc = locale || await getUserLocale(userId);
  const title = t(loc, 'payment_executed_title');
  const message = t(loc, 'payment_executed_message', { label: paymentLabel, amount, token });
  return createNotification(userId, 'payment', title, message);
}

/**
 * Crée une notification de paiement programmé
 */
async function notifyPaymentScheduled(userId, paymentLabel, amount, token, date, locale) {
  const loc = locale || await getUserLocale(userId);
  const title = t(loc, 'payment_scheduled_title');
  const message = t(loc, 'payment_scheduled_message', { label: paymentLabel, amount, token, date });
  return createNotification(userId, 'payment', title, message);
}

/**
 * Crée une notification de paiement annulé
 */
async function notifyPaymentCancelled(userId, paymentLabel, amount, token, locale) {
  const loc = locale || await getUserLocale(userId);
  const title = t(loc, 'payment_cancelled_title');
  const message = t(loc, 'payment_cancelled_message', { label: paymentLabel, amount, token });
  return createNotification(userId, 'payment', title, message);
}

/**
 * Crée une notification de paiement échoué
 */
async function notifyPaymentFailed(userId, paymentLabel, reason, locale) {
  const loc = locale || await getUserLocale(userId);
  const title = t(loc, 'payment_failed_title');
  const message = t(loc, 'payment_failed_message', { label: paymentLabel, reason });
  return createNotification(userId, 'payment', title, message);
}

/**
 * Crée une notification système
 * @param {number} userId - ID de l'utilisateur
 * @param {string} title - Titre de la notification
 * @param {string} message - Message de la notification
 */
async function notifySystem(userId, title, message) {
  return createNotification(userId, 'system', title, message);
}

module.exports = {
  createNotification,
  notifyPaymentExecuted,
  notifyPaymentScheduled,
  notifyPaymentCancelled,
  notifyPaymentFailed,
  notifySystem
};
