const express = require('express');
const { sendPaymentLinkEmail, sendPaymentLinkSms } = require('../services/email/sendPaymentLink');

const router = express.Router();

/**
 * POST /api/send-payment-link
 * Body: { toEmail?: string, toPhone?: string, link: string, locale?: string }
 * Envoie le lien par email (boîte Confidance) et/ou SMS.
 */
router.post('/', async (req, res) => {
  try {
    const { toEmail, toPhone, link } = req.body || {};

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
          locale: req.body?.locale,
        });
        results.email = 'sent';
      } catch (err) {
        console.warn('⚠️ sendPaymentLinkEmail:', err?.response?.status || err?.message || err);
        return res.status(502).json({ success: false, error: 'EMAIL_SEND_FAILED' });
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
