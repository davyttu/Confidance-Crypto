const fs = require('fs');
const path = require('path');
const axios = require('axios');
const nodemailer = require('nodemailer');

const SMTP_KEYS = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM_EMAIL'];

function loadSharedMailboxSettings() {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD) return;
  const envPath = path.resolve(__dirname, '../../../confidance-frontend/.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const raw = line.trim();
    if (!raw || raw.startsWith('#') || !raw.includes('=')) continue;
    const splitAt = raw.indexOf('=');
    const key = raw.slice(0, splitAt).trim();
    if (!SMTP_KEYS.includes(key) || process.env[key]) continue;
    let value = raw.slice(splitAt + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function emailCopy(locale) {
  const copies = {
    en: {
      subject: 'Confidance — your activation code',
      preheader: 'Your Confidance activation code is valid for 15 minutes.',
      greeting: 'Hello,',
      intro: 'You just created an account on Confidance, the non-custodial protocol for scheduled payments. Your funds stay in your wallet: Confidance never holds your keys.',
      instruction: 'Enter this code in the window still open on the site to activate your account.',
      validity: 'Valid for 15 minutes, and only once.',
      securityTitle: 'Good to know',
      security: [
        'We will never ask you for this code by phone, text, or another email.',
        'We will never ask for your seed phrase or your private key.',
        'If you did not create this account, ignore this message. Nothing will be activated.',
      ],
      signoff: 'The Confidance team',
      footer: 'Non-custodial DeFi protocol',
    },
    es: {
      subject: 'Confidance — tu código de activación',
      preheader: 'Tu código de activación Confidance es válido durante 15 minutos.',
      greeting: 'Hola,',
      intro: 'Acabas de crear una cuenta en Confidance, el protocolo no custodial de pagos programados. Tus fondos permanecen en tu wallet: Confidance nunca guarda tus claves.',
      instruction: 'Introduce este código en la ventana que sigue abierta en el sitio para activar tu cuenta.',
      validity: 'Válido durante 15 minutos y una sola vez.',
      securityTitle: 'Conviene saber',
      security: [
        'Nunca te pediremos este código por teléfono, SMS u otro correo.',
        'Nunca te pediremos tu frase semilla ni tu clave privada.',
        'Si no has creado esta cuenta, ignora este mensaje. No se activará nada.',
      ],
      signoff: 'El equipo Confidance',
      footer: 'Protocolo DeFi no custodial',
    },
    ru: {
      subject: 'Confidance — код активации',
      preheader: 'Код активации Confidance действует 15 минут.',
      greeting: 'Здравствуйте,',
      intro: 'Вы создали аккаунт Confidance — некастодиального протокола отложенных платежей. Средства остаются в вашем кошельке: Confidance не хранит ваши ключи.',
      instruction: 'Введите этот код в окне, которое осталось открытым на сайте, чтобы активировать аккаунт.',
      validity: 'Действует 15 минут и только один раз.',
      securityTitle: 'Важно',
      security: [
        'Мы никогда не попросим этот код по телефону, в SMS или в другом письме.',
        'Мы никогда не попросим сид-фразу или приватный ключ.',
        'Если вы не создавали аккаунт, просто проигнорируйте это письмо.',
      ],
      signoff: 'Команда Confidance',
      footer: 'Некастодиальный DeFi-протокол',
    },
    zh: {
      subject: 'Confidance — 您的激活码',
      preheader: '您的 Confidance 激活码在 15 分钟内有效。',
      greeting: '您好，',
      intro: '您刚刚在 Confidance 创建了账户。这是一个非托管的定时支付协议。资金留在您的钱包中：Confidance 从不保管您的密钥。',
      instruction: '请在网站上仍然打开的窗口中输入此验证码，以激活您的账户。',
      validity: '15 分钟内有效，且仅可使用一次。',
      securityTitle: '请记住',
      security: [
        '我们绝不会通过电话、短信或其他邮件向您索取此验证码。',
        '我们绝不会向您索取助记词或私钥。',
        '如果这不是您本人的操作，请忽略此邮件。账户不会被激活。',
      ],
      signoff: 'Confidance 团队',
      footer: '非托管 DeFi 协议',
    },
    fr: {
      subject: 'Confidance — votre code d’activation',
      preheader: 'Votre code d’activation Confidance est valable 15 minutes.',
      greeting: 'Bonjour,',
      intro: 'Vous venez de créer un compte sur Confidance, le protocole non-custodial de paiements programmés. Vos fonds restent dans votre wallet : Confidance ne détient jamais vos clés.',
      instruction: 'Saisissez ce code dans la fenêtre restée ouverte sur le site pour activer votre compte.',
      validity: 'Valable 15 minutes, et une seule fois.',
      securityTitle: 'À retenir',
      security: [
        'Nous ne vous demanderons jamais ce code par téléphone, SMS ou un autre e-mail.',
        'Nous ne vous demanderons jamais votre phrase secrète ni votre clé privée.',
        'Si vous n’êtes pas à l’origine de cette inscription, ignorez ce message. Aucun compte ne sera activé.',
      ],
      signoff: 'L’équipe Confidance',
      footer: 'Protocole DeFi non-custodial',
    },
  };
  return copies[locale] || copies.fr;
}

function textFor(copy, code) {
  return [
    copy.greeting,
    '',
    copy.intro,
    '',
    copy.instruction,
    '',
    code,
    '',
    copy.validity,
    '',
    copy.securityTitle,
    ...copy.security.map((line) => `- ${line}`),
    '',
    copy.signoff,
    'https://confidance-defi.com',
  ].join('\n');
}

function htmlFor(copy, code, locale) {
  const securityItems = copy.security
    .map((line) => `<tr><td style="padding:0 0 8px 0;font-size:14px;line-height:1.5;color:#374151;">• ${line}</td></tr>`)
    .join('');
  const spacedCode = String(code).split('').join(' ');

  return `<!DOCTYPE html>
<html lang="${locale || 'fr'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${copy.subject}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;">
  <div style="display:none;max-height:0;overflow:hidden;color:#f3f4f6;">${copy.preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 4px;background:#ffffff;">
              <img src="cid:confidance-logo" alt="Confidance" width="240" style="display:block;border:0;width:240px;height:auto;" />
              <p style="margin:2px 0 0 8px;font-family:Arial,sans-serif;font-size:12px;line-height:1.4;color:#6b7280;">${copy.footer}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 8px;font-family:Arial,sans-serif;color:#111827;">
              <p style="margin:0 0 12px;font-size:16px;line-height:1.5;">${copy.greeting}</p>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#374151;">${copy.intro}</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#111827;">${copy.instruction}</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 32px 8px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:12px;">
                <tr>
                  <td style="padding:18px 36px;font-family:Consolas,Menlo,monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:#312e81;text-align:center;">${spacedCode}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:12px 32px 24px;font-family:Arial,sans-serif;font-size:13px;color:#6b7280;">${copy.validity}</td>
          </tr>
          <tr>
            <td style="padding:0 32px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:12px;">
                <tr>
                  <td style="padding:16px 18px 8px;font-family:Arial,sans-serif;font-size:13px;font-weight:700;color:#111827;">${copy.securityTitle}</td>
                </tr>
                <tr>
                  <td style="padding:0 18px 8px;font-family:Arial,sans-serif;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${securityItems}</table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 28px;font-family:Arial,sans-serif;">
              <p style="margin:0;font-size:14px;color:#111827;">${copy.signoff}</p>
              <p style="margin:6px 0 0;font-size:13px;"><a href="https://confidance-defi.com" style="color:#4f46e5;text-decoration:none;">confidance-defi.com</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function smtpTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!host || !user || !pass) return null;
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

function logoAttachment() {
  const logoPath = path.join(__dirname, 'assets', 'confidance-logo.png');
  if (!fs.existsSync(logoPath)) return null;
  return {
    filename: 'confidance-logo.png',
    path: logoPath,
    cid: 'confidance-logo',
  };
}

async function sendViaSmtp({ to, subject, html, text }) {
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
  const fromName = process.env.BREVO_FROM_NAME || 'Confidance';
  const logo = logoAttachment();
  await smtpTransport().sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    html,
    text,
    attachments: logo ? [logo] : [],
  });
}

async function sendViaBrevo({ to, subject, html, text }) {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.BREVO_FROM_EMAIL;
  if (!apiKey || !fromEmail) {
    const error = new Error('EMAIL_NOT_CONFIGURED');
    error.code = 'EMAIL_NOT_CONFIGURED';
    throw error;
  }
  const logo = logoAttachment();
  const payload = {
    sender: { email: fromEmail, name: process.env.BREVO_FROM_NAME || 'Confidance' },
    to: [{ email: to }],
    subject,
    htmlContent: html,
    textContent: text,
  };
  if (logo) {
    payload.attachment = [{
      name: 'confidance-logo.png',
      content: fs.readFileSync(logo.path).toString('base64'),
      contentId: 'confidance-logo',
    }];
  }
  await axios.post(
    'https://api.brevo.com/v3/smtp/email',
    payload,
    {
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      timeout: 10000,
    }
  );
}

async function sendVerificationCodeEmail({ to, code, locale }) {
  loadSharedMailboxSettings();
  const copy = emailCopy(locale);
  const html = htmlFor(copy, code, locale);
  const text = textFor(copy, code);
  await sendMailboxMessage({ to, subject: copy.subject, html, text });
}

async function sendMailboxMessage({ to, subject, html, text }) {
  loadSharedMailboxSettings();
  if (smtpTransport()) {
    await sendViaSmtp({ to, subject, html, text });
    return;
  }
  await sendViaBrevo({ to, subject, html, text });
}

module.exports = { sendVerificationCodeEmail, sendMailboxMessage };
