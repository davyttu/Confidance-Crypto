const axios = require('axios');

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_FROM_EMAIL = process.env.BREVO_FROM_EMAIL;
const BREVO_FROM_NAME = process.env.BREVO_FROM_NAME || 'Confidance';

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

async function sendVerificationCodeEmail({ to, code, locale }) {
  if (!BREVO_API_KEY || !BREVO_FROM_EMAIL) {
    const error = new Error('BREVO_NOT_CONFIGURED');
    error.code = 'BREVO_NOT_CONFIGURED';
    throw error;
  }

  const copy = emailCopy(locale);
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; max-width: 480px;">
      <p>${copy.intro}</p>
      <p style="font-size: 32px; letter-spacing: 8px; font-weight: 700; margin: 24px 0;">${code}</p>
      <p style="font-size: 13px; color: #6b7280;">${copy.ignore}</p>
    </div>
  `;

  await axios.post(
    'https://api.brevo.com/v3/smtp/email',
    {
      sender: { email: BREVO_FROM_EMAIL, name: BREVO_FROM_NAME },
      to: [{ email: to }],
      subject: copy.subject,
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
}

module.exports = { sendVerificationCodeEmail };
