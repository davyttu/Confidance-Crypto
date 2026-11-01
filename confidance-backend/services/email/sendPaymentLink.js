const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const { sendMailboxMessage } = require('./verificationCodeEmail');

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_SMS_SENDER = process.env.BREVO_SMS_SENDER || 'Confidance';

const supabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
    : null;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cleanSenderName(value) {
  const cleaned = String(value || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;
  return cleaned.slice(0, 120);
}

function paymentLinkIdFromUrl(link) {
  try {
    const parts = new URL(link).pathname.split('/').filter(Boolean);
    const payIndex = parts.indexOf('pay');
    if (payIndex >= 0 && parts[payIndex + 1]) return parts[payIndex + 1];
  } catch {
    return null;
  }
  return null;
}

async function resolveSenderName(link) {
  if (!supabase) return null;
  const id = paymentLinkIdFromUrl(link);
  if (!id) return null;

  const { data: paymentLink } = await supabase
    .from('payment_links')
    .select('creator_address')
    .eq('id', id)
    .maybeSingle();

  const creator = paymentLink?.creator_address?.toLowerCase();
  if (!creator) return null;

  let userId = null;
  let email = null;

  const { data: wallet } = await supabase
    .from('user_wallets')
    .select('user_id')
    .ilike('wallet_address', creator)
    .maybeSingle();
  userId = wallet?.user_id || null;

  if (!userId) {
    const { data: legacyUser } = await supabase
      .from('users')
      .select('id, email')
      .ilike('primary_wallet', creator)
      .maybeSingle();
    userId = legacyUser?.id || null;
    email = legacyUser?.email || null;
  }

  if (userId && !email) {
    const { data: user } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .maybeSingle();
    email = user?.email || null;
  }

  let companyName = null;
  if (userId) {
    const { data: profile } = await supabase
      .from('pro_profiles')
      .select('company_legal_name')
      .eq('user_id', userId)
      .maybeSingle();
    companyName = cleanSenderName(profile?.company_legal_name);
  }

  const accountEmail = cleanSenderName(email);
  if (companyName && accountEmail) return `${companyName} (${accountEmail})`;
  return companyName || accountEmail;
}

function paymentLinkCopy(locale) {
  const copies = {
    en: {
      subject: 'A Confidance payment link for you',
      subjectNamed: '{{name}} sent you a Confidance payment link',
      greeting: 'Hello,',
      intro: 'Someone sent you a payment link on Confidance, the non-custodial payment protocol. Open it to pay from your own wallet.',
      introNamed: '{{name}} sent you a payment link on Confidance, the non-custodial payment protocol. Open it to pay from your own wallet.',
      button: 'Open the payment link',
      fallback: 'If the button does not open, copy this address:',
      note: 'Confidance never holds your funds or your keys. You confirm the payment in your wallet.',
      footer: 'Non-custodial DeFi protocol',
    },
    es: {
      subject: 'Un enlace de pago Confidance para ti',
      subjectNamed: '{{name}} te ha enviado un enlace de pago Confidance',
      greeting: 'Hola,',
      intro: 'Alguien te ha enviado un enlace de pago en Confidance, el protocolo de pagos no custodial. Ábrelo para pagar desde tu propio wallet.',
      introNamed: '{{name}} te ha enviado un enlace de pago en Confidance, el protocolo de pagos no custodial. Ábrelo para pagar desde tu propio wallet.',
      button: 'Abrir el enlace de pago',
      fallback: 'Si el botón no se abre, copia esta dirección:',
      note: 'Confidance nunca guarda tus fondos ni tus claves. Confirmas el pago en tu wallet.',
      footer: 'Protocolo DeFi no custodial',
    },
    ru: {
      subject: 'Вам отправили ссылку на оплату Confidance',
      subjectNamed: '{{name}} отправил вам ссылку на оплату Confidance',
      greeting: 'Здравствуйте,',
      intro: 'Вам отправили ссылку на оплату в Confidance — некастодиальном протоколе платежей. Откройте её, чтобы заплатить из своего кошелька.',
      introNamed: '{{name}} отправил вам ссылку на оплату в Confidance — некастодиальном протоколе платежей. Откройте её, чтобы заплатить из своего кошелька.',
      button: 'Открыть ссылку',
      fallback: 'Если кнопка не открывается, скопируйте этот адрес:',
      note: 'Confidance не хранит ваши средства и ключи. Вы подтверждаете платёж в своём кошельке.',
      footer: 'Некастодиальный DeFi-протокол',
    },
    zh: {
      subject: '您收到一个 Confidance 付款链接',
      subjectNamed: '{{name}} 向您发送了一个 Confidance 付款链接',
      greeting: '您好，',
      intro: '有人通过 Confidance 向您发送了一个付款链接。这是一个非托管支付协议。打开链接即可从您自己的钱包付款。',
      introNamed: '{{name}} 通过 Confidance 向您发送了一个付款链接。这是一个非托管支付协议。打开链接即可从您自己的钱包付款。',
      button: '打开付款链接',
      fallback: '如果按钮无法打开，请复制此地址：',
      note: 'Confidance 从不保管您的资金或密钥。您在自己的钱包中确认付款。',
      footer: '非托管 DeFi 协议',
    },
    fr: {
      subject: 'Un lien de paiement Confidance pour vous',
      subjectNamed: '{{name}} vous envoie un lien de paiement Confidance',
      greeting: 'Bonjour,',
      intro: 'Quelqu’un vous a envoyé un lien de paiement sur Confidance, le protocole de paiements non-custodial. Ouvrez-le pour payer depuis votre propre wallet.',
      introNamed: '{{name}} vous a envoyé un lien de paiement sur Confidance, le protocole de paiements non-custodial. Ouvrez-le pour payer depuis votre propre wallet.',
      button: 'Ouvrir le lien de paiement',
      fallback: 'Si le bouton ne s’ouvre pas, copiez cette adresse :',
      note: 'Confidance ne détient jamais vos fonds ni vos clés. Vous confirmez le paiement dans votre wallet.',
      footer: 'Protocole DeFi non-custodial',
    },
  };
  return copies[locale] || copies.fr;
}

function withSenderName(template, senderName, { escape = false } = {}) {
  if (!template || !senderName) return null;
  const safeName = escape ? escapeHtml(senderName) : senderName;
  return template.replace('{{name}}', safeName);
}

function paymentLinkHtml(copy, link, senderName) {
  const safeLink = escapeHtml(link);
  const intro = withSenderName(copy.introNamed, senderName, { escape: true }) || copy.intro;
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="padding:28px 32px 8px;background:#ffffff;">
            <img src="cid:confidance-logo" alt="Confidance" width="240" style="display:block;border:0;width:240px;height:auto;" />
            <p style="margin:2px 0 0 8px;font-family:Arial,sans-serif;font-size:12px;color:#6b7280;">${copy.footer}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 8px;font-family:Arial,sans-serif;color:#111827;">
            <p style="margin:0 0 12px;font-size:16px;">${copy.greeting}</p>
            <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#374151;">${intro}</p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:8px 32px 20px;">
            <a href="${safeLink}" style="display:inline-block;padding:14px 28px;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:10px;font-family:Arial,sans-serif;font-size:15px;font-weight:700;">${copy.button}</a>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 20px;font-family:Arial,sans-serif;">
            <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">${copy.fallback}</p>
            <p style="margin:0;font-size:13px;word-break:break-all;"><a href="${safeLink}" style="color:#4f46e5;">${safeLink}</a></p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 28px;">
            <p style="margin:0;padding:14px 16px;background:#f9fafb;border-radius:12px;font-family:Arial,sans-serif;font-size:13px;line-height:1.5;color:#374151;">${copy.note}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendPaymentLinkEmail({ toEmail, link, locale }) {
  const to = (toEmail || '').trim();
  const safeLink = (link || '').trim();
  if (!to) throw new Error('EMAIL_REQUIRED');
  if (!/^https?:\/\//i.test(safeLink)) throw new Error('LINK_REQUIRED');

  let senderName = null;
  try {
    senderName = await resolveSenderName(safeLink);
  } catch (err) {
    console.warn('⚠️ payment link sender lookup:', err?.message || err);
  }

  const copy = paymentLinkCopy(locale);
  const html = paymentLinkHtml(copy, safeLink, senderName);
  const intro = withSenderName(copy.introNamed, senderName) || copy.intro;
  const subject = withSenderName(copy.subjectNamed, senderName) || copy.subject;
  const text = [copy.greeting, '', intro, '', safeLink, '', copy.note].join('\n');
  await sendMailboxMessage({ to, subject, html, text });
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
