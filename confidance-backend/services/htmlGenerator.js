const path = require('path');
const fs = require('fs');
const { getPeriodTimestamps } = require('../utils/dateFormatter');
const { truncateAddress } = require('../utils/addressFormatter');
const { formatAmount, formatRawAmount } = require('../utils/amountFormatter');
const { t, formatPeriod } = require('../locales/statementTranslations');

function getLogoDataUri() {
  const candidates = [
    path.join(__dirname, '../../Assets/Logo Confidance Crypto.png'),
    path.join(__dirname, '../../../Assets/Logo Confidance Crypto.png'),
  ];
  for (const logoPath of candidates) {
    try {
      if (fs.existsSync(logoPath)) {
        const buf = fs.readFileSync(logoPath);
        return 'data:image/png;base64,' + buf.toString('base64');
      }
    } catch (_) {}
  }
  return null;
}

const LOGO_DATA_URI = getLogoDataUri();
const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '';

/**
 * Génère le HTML complet du relevé pour email (dans la langue de l'utilisateur)
 */
function generateStatementHTML(statement) {
  const { period_month, period_year, wallets, locale: statementLocale } = statement;
  const locale = statementLocale && ['fr', 'en', 'es', 'ru', 'zh'].includes(statementLocale) ? statementLocale : 'fr';
  const period = formatPeriod(locale, period_month, period_year);
  const { start, end } = getPeriodTimestamps(period_year, period_month);

  const logoImg = LOGO_DATA_URI
    ? `<img src="${LOGO_DATA_URI}" alt="Confidance" width="180" height="auto" style="display:block; max-width:180px; height:auto; margin-bottom:12px;" />`
    : APP_URL
      ? `<img src="${APP_URL.replace(/\/$/, '')}/logo-confidance.png" alt="Confidance" width="180" height="auto" style="display:block; max-width:180px; height:auto; margin-bottom:12px;" />`
      : '<div class="logo" style="font-size:24px;font-weight:bold;color:#1e3a5f;margin-bottom:10px;">Confidance</div>';

  return `
<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t(locale, 'title')} - ${period}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #1f2937; line-height: 1.6; margin: 0; padding: 0; background-color: #f9fafb; }
    .container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; }
    .header { border-bottom: 3px solid #1f2937; padding-bottom: 20px; margin-bottom: 30px; }
    .logo { font-size: 24px; font-weight: bold; color: #1e3a5f; margin-bottom: 10px; }
    h1 { font-size: 28px; margin: 0 0 10px 0; color: #1f2937; }
    .period-box { background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .wallet-section { border: 2px solid #e5e7eb; border-radius: 12px; padding: 24px; margin: 30px 0; }
    .wallet-header { border-bottom: 1px solid #e5e7eb; padding-bottom: 15px; margin-bottom: 20px; }
    .wallet-name { font-size: 20px; font-weight: bold; color: #1f2937; margin-bottom: 8px; }
    .wallet-address { font-size: 14px; color: #6b7280; font-family: 'Courier New', monospace; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; color: #374151; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
    td { font-size: 14px; color: #1f2937; }
    .amount { font-family: 'Courier New', monospace; font-weight: 500; }
    .amount-positive { color: #10b981; }
    .amount-negative { color: #ef4444; }
    .total-row { font-weight: bold; background: #f9fafb; border-top: 2px solid #1f2937; }
    .info-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin: 30px 0; }
    .info-box h3 { margin: 0 0 12px 0; font-size: 16px; color: #1e40af; }
    .info-box ul { margin: 0; padding-left: 20px; }
    .info-box li { margin: 8px 0; font-size: 14px; color: #374151; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #6b7280; }
    .transaction-count { color: #6b7280; font-size: 14px; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      ${logoImg}
      <h1>${t(locale, 'title')} - ${period}</h1>
      <div class="period-box">
        <strong>${t(locale, 'period')}</strong> ${t(locale, 'periodFromTo')} ${formatDate(start)} ${t(locale, 'periodTo')} ${formatDate(end)}<br>
        <strong>${t(locale, 'generatedOn')}</strong> ${formatDate(new Date().toISOString())}
      </div>
    </div>
    ${wallets.map((wallet) => generateWalletHTML(wallet, locale)).join('')}
    <div class="info-box">
      <h3>ℹ️ ${t(locale, 'importantInfo')}</h3>
      <ul>
        <li><strong>${t(locale, 'infoNonCustodial')}</strong></li>
        <li>${t(locale, 'infoBlockchain')}</li>
        <li><strong>${t(locale, 'infoPdf')}</strong></li>
      </ul>
    </div>
    <div class="footer">
      <p>${t(locale, 'footerAuto')}</p>
      <p style="margin-top: 10px;">${t(locale, 'footerQuestion')} <a href="mailto:support@confidance.crypto" style="color: #3b82f6;">support@confidance.crypto</a></p>
      <p style="margin-top: 10px; color: #9ca3af;">${t(locale, 'footerBrand')}</p>
    </div>
  </div>
</body>
</html>
`;
}

function generateWalletHTML(wallet, locale) {
  const loc = locale && ['fr', 'en', 'es', 'ru', 'zh'].includes(locale) ? locale : 'fr';
  const { wallet_name, wallet_address, network, summary, transactions } = wallet;
  const tokens = getUniqueTokens(summary);

  const summaryHeaderCells = tokens.map((token) => `<th style="text-align: right;">${token}</th>`).join('');
  const totalSentCells = tokens
    .map((token) => {
      const sent = (summary.totalSent || []).find((s) => s.symbol === token);
      return `<td class="amount amount-negative" style="text-align: right;">${sent ? `- ${sent.amount}` : '0.0000'}</td>`;
    })
    .join('');
  const totalReceivedCells = tokens
    .map((token) => {
      const received = (summary.totalReceived || []).find((r) => r.symbol === token);
      return `<td class="amount amount-positive" style="text-align: right;">${received ? `+ ${received.amount}` : '0.0000'}</td>`;
    })
    .join('');
  const netChangeCells = tokens
    .map((token) => {
      const net = (summary.netChange || []).find((n) => n.symbol === token);
      const value = net ? parseFloat(net.amount) : 0;
      const className = value >= 0 ? 'amount-positive' : 'amount-negative';
      return `<td class="amount ${className}" style="text-align: right;">${value >= 0 ? '+' : ''}${value.toFixed(4)}</td>`;
    })
    .join('');

  const transactionsRows =
    (transactions || []).length > 0
      ? `
      <h3 style="margin: 30px 0 10px 0; font-size: 18px; color: #1f2937;">${t(loc, 'transactionDetails')}</h3>
      <table>
        <thead>
          <tr>
            <th>${t(loc, 'date')}</th>
            <th>${t(loc, 'type')}</th>
            <th>${t(loc, 'description')}</th>
            <th style="text-align: right;">${t(loc, 'amount')}</th>
            <th>${t(loc, 'counterparty')}</th>
          </tr>
        </thead>
        <tbody>
          ${transactions
            .map(
              (tx) => `
            <tr>
              <td>${formatDateTime(tx.created_at)}</td>
              <td>${getTransactionTypeLabel(tx, wallet_address, loc)}</td>
              <td>${getTransactionDescription(tx, loc)}</td>
              <td class="amount ${getTransactionClass(tx, wallet_address)}" style="text-align: right;">
                ${getTransactionSign(tx, wallet_address)} ${formatRawAmount(tx.amount, tx.token_symbol || 'ETH')} ${tx.token_symbol || 'ETH'}
              </td>
              <td style="font-family: 'Courier New', monospace; font-size: 12px; color: #6b7280;">
                ${truncateAddress(getCounterparty(tx, wallet_address), 8, 6)}
              </td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
      `
      : '';

  return `
    <div class="wallet-section">
      <div class="wallet-header">
        <div class="wallet-name">${(wallet_name || 'Wallet').replace(/</g, '&lt;')}</div>
        <div class="wallet-address">${truncateAddress(wallet_address || '', 12, 8)} • ${getNetworkLabel(network)}</div>
      </div>
      <h3 style="margin: 20px 0 10px 0; font-size: 18px; color: #1f2937;">${t(loc, 'monthlySummary')}</h3>
      <table>
        <thead>
          <tr>
            <th>${t(loc, 'description')}</th>
            ${summaryHeaderCells}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${t(loc, 'totalSent')}</td>
            ${totalSentCells}
          </tr>
          <tr>
            <td>${t(loc, 'totalReceived')}</td>
            ${totalReceivedCells}
          </tr>
          <tr class="total-row">
            <td>${t(loc, 'netChange')}</td>
            ${netChangeCells}
          </tr>
        </tbody>
      </table>
      <div class="transaction-count">${(summary.transactionCount || 0)} ${t(loc, 'transactionsThisMonth')}</div>
      ${transactionsRows}
    </div>
  `;
}

function getUniqueTokens(summary) {
  const tokens = new Set();
  (summary.totalSent || []).forEach((s) => tokens.add(s.symbol));
  (summary.totalReceived || []).forEach((r) => tokens.add(r.symbol));
  return Array.from(tokens);
}

function getNetworkLabel(network) {
  const labels = {
    base_mainnet: 'Base Mainnet',
    ethereum_mainnet: 'Ethereum',
    polygon_mainnet: 'Polygon',
  };
  return labels[network] || network || 'Base Mainnet';
}

function getTransactionTypeLabel(tx, walletAddress, locale) {
  const payer = (tx.payer_address || '').toLowerCase();
  const addr = (walletAddress || '').toLowerCase();
  return payer === addr ? t(locale || 'fr', 'sent') : t(locale || 'fr', 'received');
}

function getTransactionDescription(tx, locale) {
  const status = (tx.status || '').toLowerCase();
  const loc = locale || 'fr';
  if (status === 'released' || status === 'completed') return t(loc, 'paymentExecuted');
  if (status === 'pending') return t(loc, 'paymentPending');
  if (status === 'cancelled') return t(loc, 'paymentCancelled');
  return t(loc, 'transaction');
}

function getTransactionClass(tx, walletAddress) {
  const payer = (tx.payer_address || '').toLowerCase();
  const addr = (walletAddress || '').toLowerCase();
  return payer === addr ? 'amount-negative' : 'amount-positive';
}

function getTransactionSign(tx, walletAddress) {
  const payer = (tx.payer_address || '').toLowerCase();
  const addr = (walletAddress || '').toLowerCase();
  return payer === addr ? '-' : '+';
}

function getCounterparty(tx, walletAddress) {
  const payer = (tx.payer_address || '').toLowerCase();
  const addr = (walletAddress || '').toLowerCase();
  return payer === addr ? (tx.payee_address || '') : (tx.payer_address || '');
}

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateTime(isoString) {
  return new Date(isoString).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

module.exports = { generateStatementHTML };
