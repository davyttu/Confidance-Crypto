// services/paymentProtocol.js
const axios = require('axios');

const PAYMENT_PROTOCOL_URL = process.env.PAYMENT_PROTOCOL_URL || 'https://davyvittu.app.n8n.cloud/webhook/payment-protocol';
const API_KEY = process.env.N8N_API_KEY || 'a6e1f0d4-93cb-4cf8-9b56-1c0fa5cd52be';

/**
 * Envoie un événement de paiement au Payment Protocol (n8n)
 * @param {Object} payment - Données du paiement depuis Supabase
 * @returns {Promise<boolean>} - true si succès, false si échec (non bloquant)
 */
async function notifyPaymentCreated(payment) {
  try {
    console.log('📤 [PaymentProtocol] Envoi notification:', {
      contract: payment.contract_address,
      tx_hash: payment.transaction_hash,
      type: payment.payment_type,
      amount: payment.amount
    });

    // 🔑 IMPORTANT : Le workflow attend { payload: { ... } }
    // où le payload contient DIRECTEMENT les données (pas de metadata imbriqué)
    const payload = {
      tx_hash: payment.transaction_hash,
      contract_address: payment.contract_address,
      chain: payment.network || 'BASE',
      token: payment.token_symbol || 'USDC',
      amount: payment.amount, // ✅ Directement dans le payload
      payment_type: payment.payment_type || 'instant',
      user_id: payment.payer_address,
      // ✅ Métadonnées APLATIES (pas de sous-objet)
      payee_address: payment.payee_address,
      release_time: payment.release_time,
      status: payment.status,
      is_instant: payment.is_instant,
      is_batch: payment.is_batch || false,
      batch_count: payment.batch_count || null,
      created_at: payment.created_at
    };

    const response = await axios.post(
      PAYMENT_PROTOCOL_URL,
      { payload }, // ✅ Structure correcte : { payload: { tx_hash, amount, ... } }
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Event-API-Key': API_KEY
        },
        timeout: 5000 // 5 secondes max
      }
    );

    console.log('✅ [PaymentProtocol] Notification envoyée:', response.data);
    return true;

  } catch (error) {
    console.error('❌ [PaymentProtocol] Erreur (non bloquant):', error.message);
    // Ne pas bloquer l'insertion si le webhook échoue
    return false;
  }
}

module.exports = {
  notifyPaymentCreated
};
