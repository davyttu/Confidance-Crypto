const axios = require('axios');

const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_FROM_EMAIL = process.env.BREVO_FROM_EMAIL;
const BREVO_FROM_NAME = process.env.BREVO_FROM_NAME || 'Confidance Crypto';

const NETWORK_LABELS = {
  base_mainnet: 'Base Mainnet',
  base_sepolia: 'Base Sepolia',
  polygon_mainnet: 'Polygon',
  arbitrum_mainnet: 'Arbitrum',
  avalanche_mainnet: 'Avalanche',
};

const EXPLORER_BASES = {
  base_mainnet: 'https://basescan.org',
  base_sepolia: 'https://sepolia.basescan.org',
  polygon_mainnet: 'https://polygonscan.com',
  arbitrum_mainnet: 'https://arbiscan.io',
  avalanche_mainnet: 'https://snowtrace.io',
};

const formatTokenAmount = (amount, symbol) => {
  try {
    if (!amount) return '0';
    const decimals = symbol === 'ETH' ? 18 : 6;
    const divisor = BigInt(10) ** BigInt(decimals);
    const value = BigInt(amount);
    const integerPart = value / divisor;
    const fractionalPart = value % divisor;
    const fractionalStr = fractionalPart
      .toString()
      .padStart(decimals, '0')
      .replace(/0+$/, '');
    return fractionalStr ? `${integerPart}.${fractionalStr}` : `${integerPart}`;
  } catch (error) {
    return '0';
  }
};

async function sendRecurringFailureEmail({ supabase, payment, reason, monthNumber }) {
  try {
    if (!BREVO_API_KEY) {
      console.warn('⚠️ BREVO_API_KEY manquante, email non envoyé.');
      return;
    }
    if (!BREVO_FROM_EMAIL) {
      console.warn('⚠️ BREVO_FROM_EMAIL manquante, email non envoyé.');
      return;
    }
    if (!payment?.user_id) {
      console.warn('⚠️ user_id manquant, email non envoyé.');
      return;
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('email')
      .eq('id', payment.user_id)
      .single();

    if (userError || !user?.email) {
      console.warn('⚠️ Email utilisateur introuvable:', userError?.message || 'unknown');
      return;
    }

    const label = payment.payment_label || 'Paiement récurrent';
    const category = payment.payment_category ? ` (${payment.payment_category})` : '';
    const tokenSymbol = payment.token_symbol || 'USDC';
    const isFirstMonthCustom = payment.is_first_month_custom === true || payment.is_first_month_custom === 'true';
    const rawAmount =
      monthNumber === 1 && isFirstMonthCustom && payment.first_month_amount
        ? payment.first_month_amount
        : payment.monthly_amount || payment.amount || '0';
    const displayAmount = `${formatTokenAmount(rawAmount, tokenSymbol)} ${tokenSymbol}`;
    const displayMonth = monthNumber ? `Mensualité ${monthNumber}` : 'Une mensualité';
    const failureReason = reason || 'Fonds insuffisants ou autorisation insuffisante.';
    const networkLabel = NETWORK_LABELS[payment.network] || payment.network || 'Réseau inconnu';
    const dashboardUrl = payment.id
      ? `${APP_URL}/dashboard?paymentId=${payment.id}`
      : `${APP_URL}/dashboard`;
    const explorerBase = EXPLORER_BASES[payment.network];
    const contractUrl =
      explorerBase && payment.contract_address
        ? `${explorerBase}/address/${payment.contract_address}`
        : null;

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h2 style="margin: 0 0 12px;">Paiement récurrent échoué</h2>
        <p style="margin: 0 0 12px;">
          ${displayMonth} n'a pas pu être exécutée.
        </p>
        <div style="margin: 12px 0; padding: 12px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;">
          <strong>${label}${category}</strong><br/>
          Montant: ${displayAmount}<br/>
          Réseau: ${networkLabel}<br/>
          Raison: ${failureReason}
        </div>
        <p style="margin: 12px 0;">
          Vous pouvez recharger votre wallet et vérifier l'état dans votre dashboard.
        </p>
        <a href="${dashboardUrl}" style="display: inline-block; padding: 10px 16px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">
          Voir le paiement
        </a>
        ${contractUrl ? `
        <div style="margin-top: 10px;">
          <a href="${contractUrl}" style="color: #2563eb; text-decoration: underline;">
            Voir le contrat sur l'explorer
          </a>
        </div>` : ''}
        <p style="margin: 16px 0 0; font-size: 12px; color: #6b7280;">
          Si vous pensez que c'est une erreur, contactez le support Confidance.
        </p>
      </div>
    `;

    await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      {
        sender: {
          email: BREVO_FROM_EMAIL,
          name: BREVO_FROM_NAME,
        },
        to: [{ email: user.email }],
        subject: `⚠️ Paiement récurrent échoué - ${displayMonth}`,
        htmlContent: html,
      },
      {
        headers: {
          'api-key': BREVO_API_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    console.log(`📧 Email failure envoyé à ${user.email} pour paiement ${payment.id}`);
  } catch (error) {
    console.warn('⚠️ Erreur envoi email failure:', error?.message || error);
  }
}

module.exports = { sendRecurringFailureEmail };
