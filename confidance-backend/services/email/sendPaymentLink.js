const axios = require('axios');

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_FROM_EMAIL = process.env.BREVO_FROM_EMAIL;
const BREVO_FROM_NAME = process.env.BREVO_FROM_NAME || 'Confidance';
const BREVO_SMS_SENDER = process.env.BREVO_SMS_SENDER || 'Confidance';

/**
 * Envoie le lien de paiement par email via Brevo (le site envoie directement, pas d'ouverture du client mail).
 */
async function sendPaymentLinkEmail({ toEmail, link, subject, bodyText }) {
  if (!BREVO_API_KEY || !BREVO_FROM_EMAIL) {
    throw new Error('EMAIL_NOT_CONFIGURED');
  }
  const to = (toEmail || '').trim();
  if (!to) throw new Error('EMAIL_REQUIRED');

  const defaultSubject = 'Lien de paiement Confidance';
  const defaultBody = `Voici votre lien de paiement :\n\n${link}\n\n— Confidance`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
      <h2 style="margin: 0 0 12px;">Lien de paiement</h2>
      <p style="margin: 0 0 12px;">${(bodyText || defaultBody).replace(/\n/g, '<br/>')}</p>
      <p style="margin: 12px 0;">
        <a href="${link}" style="display: inline-block; padding: 10px 16px; background: #7c3aed; color: #fff; text-decoration: none; border-radius: 6px;">Ouvrir le lien</a>
      </p>
      <p style="margin: 16px 0 0; font-size: 12px; color: #6b7280;">— ${BREVO_FROM_NAME}</p>
    </div>
  `;

  await axios.post(
    'https://api.brevo.com/v3/smtp/email',
    {
      sender: { email: BREVO_FROM_EMAIL, name: BREVO_FROM_NAME },
      to: [{ email: to }],
      subject: subject || defaultSubject,
      htmlContent: html,
    },
    {
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
      timeout: 10000,
    }
  );
}

/**
 * Envoie le lien de paiement par SMS via Brevo (le site envoie directement).
 * Si Brevo SMS n'est pas configuré ou le plan ne l'inclut pas, lance avec message SMS_NOT_CONFIGURED.
 */
async function sendPaymentLinkSms({ toPhone, link }) {
  if (!BREVO_API_KEY) {
    throw new Error('SMS_NOT_CONFIGURED');
  }
  const phone = (toPhone || '').trim().replace(/\s/g, '');
  if (!phone) throw new Error('PHONE_REQUIRED');

  const content = `Lien de paiement Confidance : ${link}`;

  try {
    await axios.post(
      'https://api.brevo.com/v3/transactionalSMS/send',
      {
        type: 'transactional',
        recipient: phone,
        content,
        sender: BREVO_SMS_SENDER,
      },
      {
        headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
        timeout: 10000,
      }
    );
  } catch (err) {
    const status = err.response?.status;
    const data = err.response?.data;
    if (status === 400 || status === 402 || (data && (data.code === 'unauthorized' || data.message?.includes('SMS')))) {
      throw new Error('SMS_NOT_CONFIGURED');
    }
    throw err;
  }
}

module.exports = { sendPaymentLinkEmail, sendPaymentLinkSms };
