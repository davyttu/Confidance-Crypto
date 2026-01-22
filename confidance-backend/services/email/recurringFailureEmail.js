const { Resend } = require('resend');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Confidance Crypto <onboarding@resend.dev>';
const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

async function sendRecurringFailureEmail({ supabase, payment, reason, monthNumber }) {
  try {
    if (!resend) {
      console.warn('⚠️ RESEND_API_KEY manquante, email non envoyé.');
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
    const amount = payment.monthly_amount || '0';
    const displayAmount = `${amount} ${tokenSymbol}`;
    const displayMonth = monthNumber ? `Mensualité ${monthNumber}` : 'Une mensualité';
    const failureReason = reason || 'Fonds insuffisants ou autorisation insuffisante.';
    const dashboardUrl = `${APP_URL}/dashboard`;

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h2 style="margin: 0 0 12px;">Paiement récurrent échoué</h2>
        <p style="margin: 0 0 12px;">
          ${displayMonth} n'a pas pu être exécutée.
        </p>
        <div style="margin: 12px 0; padding: 12px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;">
          <strong>${label}${category}</strong><br/>
          Montant: ${displayAmount}<br/>
          Raison: ${failureReason}
        </div>
        <p style="margin: 12px 0;">
          Vous pouvez recharger votre wallet et vérifier l'état dans votre dashboard.
        </p>
        <a href="${dashboardUrl}" style="display: inline-block; padding: 10px 16px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">
          Ouvrir le dashboard
        </a>
        <p style="margin: 16px 0 0; font-size: 12px; color: #6b7280;">
          Si vous pensez que c'est une erreur, contactez le support Confidance.
        </p>
      </div>
    `;

    await resend.emails.send({
      from: RESEND_FROM_EMAIL,
      to: [user.email],
      subject: `⚠️ Paiement récurrent échoué - ${displayMonth}`,
      html,
    });

    console.log(`📧 Email failure envoyé à ${user.email} pour paiement ${payment.id}`);
  } catch (error) {
    console.warn('⚠️ Erreur envoi email failure:', error?.message || error);
  }
}

module.exports = { sendRecurringFailureEmail };
