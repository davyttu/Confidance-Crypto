const express = require('express');
const { sendPaymentLinkEmail, sendPaymentLinkSms } = require('../services/email/sendPaymentLink');

const router = express.Router();

/**
 * POST /api/send-payment-link
 * Body: { toEmail?: string, toPhone?: string, link: string, subject?: string, bodyText?: string }
 * Envoie le lien par email et/ou SMS directement depuis le serveur (Brevo).
 */
router.post('/', async (req, res) => {
  try {
    const { toEmail, toPhone, link, subject, bodyText } = req.body || {};

    if (!link || typeof link !== 'string' || !link.trim()) {
      return res.status(400).json({ success: false, error: 'link_required' });
    }

    const trimmedLink = link.trim();
    const hasEmail = toEmail && String(toEmail).trim();
    const hasPhone = toPhone && String(toPhone).trim();

    if (!hasEmail && !hasPhone) {
      return res.status(400).json({ success: false, error: 'email_or_phone_required' });
    }

    const results = { email: null, sms: null };

    if (hasEmail) {
      try {
        await sendPaymentLinkEmail({
          toEmail: String(toEmail).trim(),
          link: trimmedLink,
          subject: subject ? String(subject).trim() : undefined,
          bodyText: bodyText ? String(bodyText).trim() : undefined,
        });
        results.email = 'sent';
      } catch (err) {
        if (err.message === 'EMAIL_NOT_CONFIGURED' || err.message === 'EMAIL_REQUIRED') {
          return res.status(503).json({ success: false, error: err.message });
        }
        console.warn('⚠️ sendPaymentLinkEmail:', err?.message || err);
        results.email = 'error';
      }
    }

    if (hasPhone) {
      try {
        await sendPaymentLinkSms({ toPhone: String(toPhone).trim(), link: trimmedLink });
        results.sms = 'sent';
      } catch (err) {
        if (err.message === 'SMS_NOT_CONFIGURED' || err.message === 'PHONE_REQUIRED') {
          return res.status(503).json({ success: false, error: err.message, results });
        }
        console.warn('⚠️ sendPaymentLinkSms:', err?.message || err);
        results.sms = 'error';
      }
    }

    return res.json({ success: true, results });
  } catch (error) {
    console.error('❌ POST /api/send-payment-link:', error);
    return res.status(500).json({ success: false, error: 'server_error' });
  }
});

module.exports = router;
