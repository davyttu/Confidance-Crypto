const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

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
async function notifyPaymentExecuted(userId, paymentLabel, amount, token) {
  const title = '💰 Paiement exécuté';
  const message = `Votre paiement "${paymentLabel}" de ${amount} ${token} a été exécuté avec succès.`;
  return createNotification(userId, 'payment', title, message);
}

/**
 * Crée une notification de paiement programmé
 * @param {number} userId - ID de l'utilisateur
 * @param {string} paymentLabel - Label du paiement
 * @param {string} amount - Montant du paiement
 * @param {string} token - Token du paiement
 * @param {string} date - Date d'exécution
 */
async function notifyPaymentScheduled(userId, paymentLabel, amount, token, date) {
  const title = '⏰ Paiement programmé';
  const message = `Votre paiement "${paymentLabel}" de ${amount} ${token} sera exécuté le ${date}.`;
  return createNotification(userId, 'payment', title, message);
}

/**
 * Crée une notification de paiement annulé
 * @param {number} userId - ID de l'utilisateur
 * @param {string} paymentLabel - Label du paiement
 * @param {string} amount - Montant du paiement
 * @param {string} token - Token du paiement
 */
async function notifyPaymentCancelled(userId, paymentLabel, amount, token) {
  const title = '🚫 Paiement annulé';
  const message = `Votre paiement "${paymentLabel}" de ${amount} ${token} a été annulé. Les fonds ont été remboursés.`;
  return createNotification(userId, 'payment', title, message);
}

/**
 * Crée une notification de paiement échoué
 * @param {number} userId - ID de l'utilisateur
 * @param {string} paymentLabel - Label du paiement
 * @param {string} reason - Raison de l'échec
 */
async function notifyPaymentFailed(userId, paymentLabel, reason) {
  const title = '❌ Paiement échoué';
  const message = `Votre paiement "${paymentLabel}" a échoué. Raison: ${reason}`;
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
