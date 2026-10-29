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
  if (locale === 'en') {
    return {
      subject: 'Your Confidance verification code',
      intro: 'Use this code to activate your account. It expires in 15 minutes.',
      ignore: 'If you did not create an account, you can ignore this email.',
    };
  }
  return {
    subject: 'Votre code de vérification Confidance',
    intro: 'Utilisez ce code pour activer votre compte. Il expire dans 15 minutes.',
    ignore: 'Si vous n’avez pas créé de compte, ignorez cet e-mail.',
  };
}

function htmlFor(copy, code) {
  return `
    <div style="font-family: Arial, sans-serif; color: #111827; max-width: 480px;">
      <p>${copy.intro}</p>
      <p style="font-size: 32px; letter-spacing: 8px; font-weight: 700; margin: 24px 0;">${code}</p>
      <p style="font-size: 13px; color: #6b7280;">${copy.ignore}</p>
    </div>
  `;
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

async function sendViaSmtp({ to, subject, html }) {
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
  const fromName = process.env.BREVO_FROM_NAME || 'Confidance';
  await smtpTransport().sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    html,
  });
}

async function sendViaBrevo({ to, subject, html }) {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.BREVO_FROM_EMAIL;
  if (!apiKey || !fromEmail) {
    const error = new Error('EMAIL_NOT_CONFIGURED');
    error.code = 'EMAIL_NOT_CONFIGURED';
    throw error;
  }
  await axios.post(
    'https://api.brevo.com/v3/smtp/email',
    {
      sender: { email: fromEmail, name: process.env.BREVO_FROM_NAME || 'Confidance' },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    },
    {
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      timeout: 10000,
    }
  );
}

async function sendVerificationCodeEmail({ to, code, locale }) {
  loadSharedMailboxSettings();
  const copy = emailCopy(locale);
  const html = htmlFor(copy, code);
  if (smtpTransport()) {
    await sendViaSmtp({ to, subject: copy.subject, html });
    return;
  }
  await sendViaBrevo({ to, subject: copy.subject, html });
}

module.exports = { sendVerificationCodeEmail };
