const nodemailer = require('nodemailer');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const { rawToHuman } = require('../utils/amountFormatter');
const { t, formatPeriod } = require('../locales/statementTranslations');
const { generateStatementPDF } = require('./pdfGenerator');
const { generateStatementHTML } = require('./htmlGenerator');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Transport Nodemailer (si SMTP configuré)
const transporter = process.env.EMAIL_HOST
  ? nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '465', 10),
      secure: process.env.EMAIL_SECURE !== 'false',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    })
  : null;

/**
 * Génère et envoie le relevé mensuel pour un utilisateur
 */
async function sendMonthlyStatement(userId, month, year) {
  try {
    console.log(`📧 Génération relevé pour user ${userId} - ${month}/${year}`);

    // 1. Récupérer l'utilisateur
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, account_type')
      .eq('id', userId)
      .eq('email_verified', true)
      .single();

    if (userError || !user || !user.email) {
      console.log(`⚠️  User ${userId} : pas d'email ou non vérifié`);
      return { success: false, reason: 'no_email' };
    }

    // 2. Récupérer tous les wallets de l'utilisateur (user_wallets : label, wallet_address, is_primary)
    const { data: wallets, error: walletsError } = await supabase
      .from('user_wallets')
      .select('*')
      .eq('user_id', userId)
      .order('is_primary', { ascending: false });

    if (walletsError || !wallets || wallets.length === 0) {
      console.log(`⚠️  User ${userId} : aucun wallet`);
      return { success: false, reason: 'no_wallets' };
    }

    // 3. Période et adresses
    const { start, end } = getPeriodTimestamps(year, month);
    const walletAddresses = wallets.map((w) => w.wallet_address.toLowerCase());

    // 4. Récupérer les transactions du mois (scheduled_payments) pour ces wallets
    const orFilter = `payer_address.in.(${walletAddresses.join(',')}),payee_address.in.(${walletAddresses.join(',')})`;
    const { data: allTransactions, error: txError } = await supabase
      .from('scheduled_payments')
      .select('*')
      .or(orFilter)
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at', { ascending: true });

    if (txError) {
      console.error('Erreur récupération transactions:', txError);
      return { success: false, reason: 'error', error: txError };
    }

    if (!allTransactions || allTransactions.length === 0) {
      console.log(`⚠️  User ${userId} : aucune transaction ce mois`);
      return { success: false, reason: 'no_transactions' };
    }

    // 5. Enrichir les wallets avec wallet_name / network (user_wallets a label, pas de network)
    const walletsWithMeta = wallets.map((w) => ({
      ...w,
      wallet_name: w.label || (w.is_primary ? 'Wallet principal' : 'Wallet'),
      network: w.network || 'base_mainnet',
    }));

    // 6. Organiser les données par wallet
    const walletsData = walletsWithMeta.map((wallet) => {
      const walletTransactions = allTransactions.filter(
        (tx) =>
          (tx.payer_address && tx.payer_address.toLowerCase() === wallet.wallet_address.toLowerCase()) ||
          (tx.payee_address && tx.payee_address.toLowerCase() === wallet.wallet_address.toLowerCase())
      );
      const summary = calculateWalletSummary(walletTransactions, wallet.wallet_address);
      return {
        ...wallet,
        summary,
        transactions: walletTransactions,
      };
    });

    // 7. Relevé complet (avec locale pour email/PDF)
    const statement = {
      user_id: userId,
      user_email: user.email,
      period_month: month,
      period_year: year,
      period_start: start,
      period_end: end,
      locale,
      wallets: walletsData,
    };

    // 8. Générer le HTML de l'email
    const emailHtml = generateStatementHTML(statement);

    // 9. Générer le PDF
    const pdfBuffer = await generateStatementPDF(statement);

    // 10. Envoyer l'email (SMTP ou Brevo en fallback)
    const subject = `${t(locale, 'emailSubject')} - ${formatPeriod(locale, month, year)}`;
    const pdfFilename = `confidance-releve-${year}-${String(month).padStart(2, '0')}.pdf`;

    if (transporter) {
      const fromEmail = process.env.EMAIL_USER || 'statements@confidance.crypto';
      const info = await transporter.sendMail({
        from: `"Confidance" <${fromEmail}>`,
        to: user.email,
        subject,
        html: emailHtml,
        attachments: [
          { filename: pdfFilename, content: pdfBuffer, contentType: 'application/pdf' },
        ],
      });
      console.log(`✅ Email envoyé à ${user.email} - Message ID: ${info.messageId}`);
    } else if (process.env.BREVO_API_KEY && process.env.BREVO_FROM_EMAIL) {
      await axios.post(
        'https://api.brevo.com/v3/smtp/email',
        {
          sender: {
            email: process.env.BREVO_FROM_EMAIL,
            name: process.env.BREVO_FROM_NAME || 'Confidance',
          },
          to: [{ email: user.email }],
          subject,
          htmlContent: emailHtml,
          attachment: [
            {
              name: pdfFilename,
              content: pdfBuffer.toString('base64'),
            },
          ],
        },
        {
          headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json' },
          timeout: 15000,
        }
      );
      console.log(`✅ Email envoyé à ${user.email} (Brevo)`);
    } else {
      throw new Error('EMAIL_NOT_CONFIGURED: configurez EMAIL_HOST/EMAIL_USER ou BREVO_API_KEY/BREVO_FROM_EMAIL');
    }

    // 11. Enregistrer l'envoi en DB
    await supabase
      .from('monthly_statements')
      .upsert(
        {
          user_id: userId,
          period_month: month,
          period_year: year,
          sent_at: new Date().toISOString(),
          email_sent_to: user.email,
          pdf_generated: true,
        },
        { onConflict: 'user_id,period_month,period_year' }
      );

    return { success: true };
  } catch (error) {
    console.error(`❌ Erreur envoi relevé user ${userId}:`, error);
    return { success: false, reason: 'error', error };
  }
}

function calculateWalletSummary(transactions, walletAddress) {
  const lowerAddress = (walletAddress || '').toLowerCase();
  const totalSentRaw = {};
  const totalReceivedRaw = {};

  (transactions || []).forEach((tx) => {
    const token = tx.token_symbol || 'ETH';
    const str = String(tx.amount || '0').trim();
    const intPart = str.split('.')[0].replace(/\D/g, '') || '0';
    const rawAmount = intPart || '0';

    if (!totalSentRaw[token]) totalSentRaw[token] = BigInt(0);
    if (!totalReceivedRaw[token]) totalReceivedRaw[token] = BigInt(0);

    const payer = (tx.payer_address || '').toLowerCase();
    if (payer === lowerAddress) {
      totalSentRaw[token] += BigInt(rawAmount);
    } else {
      totalReceivedRaw[token] += BigInt(rawAmount);
    }
  });

  const allTokens = new Set([...Object.keys(totalSentRaw), ...Object.keys(totalReceivedRaw)]);
  const totalSent = {};
  const totalReceived = {};
  const netChange = {};

  allTokens.forEach((token) => {
    const sentRaw = totalSentRaw[token] || BigInt(0);
    const receivedRaw = totalReceivedRaw[token] || BigInt(0);
    const sentHuman = rawToHuman(sentRaw.toString(), token);
    const receivedHuman = rawToHuman(receivedRaw.toString(), token);
    totalSent[token] = sentHuman.toFixed(4);
    totalReceived[token] = receivedHuman.toFixed(4);
    netChange[token] = (receivedHuman - sentHuman).toFixed(4);
  });

  return {
    totalSent: Object.entries(totalSent).map(([symbol, amount]) => ({ symbol, amount })),
    totalReceived: Object.entries(totalReceived).map(([symbol, amount]) => ({ symbol, amount })),
    netChange: Object.entries(netChange).map(([symbol, amount]) => ({ symbol, amount })),
    transactionCount: (transactions || []).length,
  };
}

function getPeriodTimestamps(year, month) {
  const start = new Date(year, month - 1, 1).toISOString();
  const end = new Date(year, month, 0, 23, 59, 59, 999).toISOString();
  return { start, end };
}

function formatMonthYear(month, year) {
  const months = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
  ];
  return `${months[month - 1]} ${year}`;
}

module.exports = { sendMonthlyStatement, getPeriodTimestamps, formatMonthYear };
