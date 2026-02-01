const PDFDocument = require('pdfkit');
const { formatRawAmount } = require('../utils/amountFormatter');
const { t, formatPeriod } = require('../locales/statementTranslations');

const dateLocales = { fr: 'fr-FR', en: 'en-US', es: 'es-ES', ru: 'ru-RU', zh: 'zh-CN' };

function formatDate(isoString, locale) {
  const loc = dateLocales[locale] || 'fr-FR';
  return new Date(isoString).toLocaleDateString(loc);
}

function formatDateTime(isoString, locale) {
  const loc = dateLocales[locale] || 'fr-FR';
  return new Date(isoString).toLocaleDateString(loc, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Génère un PDF du relevé (dans la langue de l'utilisateur)
 */
async function generateStatementPDF(statement) {
  return new Promise((resolve, reject) => {
    const locale = statement.locale && ['fr', 'en', 'es', 'ru', 'zh'].includes(statement.locale) ? statement.locale : 'fr';
    const doc = new PDFDocument({ margin: 50 });
    const buffers = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(buffers);
      resolve(pdfBuffer);
    });
    doc.on('error', reject);

    const periodStr = formatPeriod(locale, statement.period_month, statement.period_year);

    doc.fontSize(24).text('Confidance', { align: 'left' });
    doc.moveDown(0.5);
    doc.fontSize(18).text(`${t(locale, 'title')} - ${periodStr}`);
    doc.moveDown(0.5);
    doc.fontSize(10).text(`${t(locale, 'period')} ${t(locale, 'periodFromTo')} ${formatDate(statement.period_start, locale)} ${t(locale, 'periodTo')} ${formatDate(statement.period_end, locale)}`);
    doc.moveDown(0.5);
    doc.fontSize(10).text(`${t(locale, 'generatedOn')} ${formatDate(new Date().toISOString(), locale)}`);
    doc.moveDown(2);

    (statement.wallets || []).forEach((wallet, index) => {
      if (index > 0) {
        doc.addPage();
      }

      doc.fontSize(16).text(wallet.wallet_name || 'Wallet', { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(9).text(`${wallet.wallet_address || ''} • ${wallet.network || 'base_mainnet'}`);
      doc.moveDown(1);

      doc.fontSize(12).text(t(locale, 'monthlySummary'), { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10);

      (wallet.summary?.totalSent || []).forEach((item) => {
        doc.text(`${t(locale, 'totalSent')} : ${item.amount} ${item.symbol}`);
      });
      (wallet.summary?.totalReceived || []).forEach((item) => {
        doc.text(`${t(locale, 'totalReceived')} : ${item.amount} ${item.symbol}`);
      });
      (wallet.summary?.netChange || []).forEach((item) => {
        const sign = parseFloat(item.amount) >= 0 ? '+' : '';
        doc.text(`${t(locale, 'netChange')} : ${sign}${item.amount} ${item.symbol}`);
      });

      doc.moveDown(0.5);
      doc.text(`${wallet.summary?.transactionCount || 0} ${t(locale, 'transactionsThisMonth')}`);
      doc.moveDown(1.5);

      if ((wallet.transactions || []).length > 0) {
        doc.fontSize(12).text(t(locale, 'transactionDetails'), { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(8);

        wallet.transactions.forEach((tx) => {
          const lowerAddr = (wallet.wallet_address || '').toLowerCase();
          const typeLabel = (tx.payer_address || '').toLowerCase() === lowerAddr ? t(locale, 'sent') : t(locale, 'received');
          const sign = typeLabel === t(locale, 'sent') ? '-' : '+';
          doc.text(
            `${formatDateTime(tx.created_at, locale)} | ${typeLabel} | ${sign}${formatRawAmount(tx.amount, tx.token_symbol || 'ETH')} ${tx.token_symbol || 'ETH'}`
          );
        });
      }
    });

    doc.fontSize(8).text(
      `Confidance - Non-custodial | ${t(locale, 'footerAuto')}`,
      50,
      doc.page.height - 50,
      { align: 'center' }
    );

    doc.end();
  });
}

module.exports = { generateStatementPDF };
