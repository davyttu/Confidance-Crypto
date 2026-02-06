const translations = {
  fr: {
    payment_executed_title: '💰 Paiement exécuté',
    payment_executed_message: 'Votre paiement "{{label}}" de {{amount}} {{token}} a été exécuté avec succès.',
    payment_scheduled_title: '⏰ Paiement programmé',
    payment_scheduled_message: 'Votre paiement "{{label}}" de {{amount}} {{token}} sera exécuté le {{date}}.',
    payment_cancelled_title: '🚫 Paiement annulé',
    payment_cancelled_message: 'Votre paiement "{{label}}" de {{amount}} {{token}} a été annulé. Les fonds ont été remboursés.',
    payment_failed_title: '❌ Paiement échoué',
    payment_failed_message: 'Votre paiement "{{label}}" a échoué. Raison : {{reason}}',
  },
  en: {
    payment_executed_title: '💰 Payment executed',
    payment_executed_message: 'Your payment "{{label}}" of {{amount}} {{token}} has been executed successfully.',
    payment_scheduled_title: '⏰ Payment scheduled',
    payment_scheduled_message: 'Your payment "{{label}}" of {{amount}} {{token}} will be executed on {{date}}.',
    payment_cancelled_title: '🚫 Payment cancelled',
    payment_cancelled_message: 'Your payment "{{label}}" of {{amount}} {{token}} has been cancelled. Funds have been refunded.',
    payment_failed_title: '❌ Payment failed',
    payment_failed_message: 'Your payment "{{label}}" has failed. Reason: {{reason}}',
  },
  es: {
    payment_executed_title: '💰 Pago ejecutado',
    payment_executed_message: 'Su pago "{{label}}" de {{amount}} {{token}} se ha ejecutado correctamente.',
    payment_scheduled_title: '⏰ Pago programado',
    payment_scheduled_message: 'Su pago "{{label}}" de {{amount}} {{token}} se ejecutará el {{date}}.',
    payment_cancelled_title: '🚫 Pago cancelado',
    payment_cancelled_message: 'Su pago "{{label}}" de {{amount}} {{token}} ha sido cancelado. Los fondos han sido reembolsados.',
    payment_failed_title: '❌ Pago fallido',
    payment_failed_message: 'Su pago "{{label}}" ha fallado. Motivo: {{reason}}',
  },
  ru: {
    payment_executed_title: '💰 Платёж выполнен',
    payment_executed_message: 'Ваш платёж "{{label}}" на {{amount}} {{token}} успешно выполнен.',
    payment_scheduled_title: '⏰ Платёж запланирован',
    payment_scheduled_message: 'Ваш платёж "{{label}}" на {{amount}} {{token}} будет выполнен {{date}}.',
    payment_cancelled_title: '🚫 Платёж отменён',
    payment_cancelled_message: 'Ваш платёж "{{label}}" на {{amount}} {{token}} отменён. Средства возвращены.',
    payment_failed_title: '❌ Платёж не выполнен',
    payment_failed_message: 'Ваш платёж "{{label}}" не выполнен. Причина: {{reason}}',
  },
  zh: {
    payment_executed_title: '💰 支付已执行',
    payment_executed_message: '您的付款 "{{label}}" {{amount}} {{token}} 已成功执行。',
    payment_scheduled_title: '⏰ 支付已安排',
    payment_scheduled_message: '您的付款 "{{label}}" {{amount}} {{token}} 将于 {{date}} 执行。',
    payment_cancelled_title: '🚫 支付已取消',
    payment_cancelled_message: '您的付款 "{{label}}" {{amount}} {{token}} 已取消。资金已退还。',
    payment_failed_title: '❌ 支付失败',
    payment_failed_message: '您的付款 "{{label}}" 失败。原因：{{reason}}',
  },
};

function t(locale, key, params = {}) {
  const lang = locale && translations[locale] ? locale : 'fr';
  let str = translations[lang][key] || translations.fr[key] || key;
  Object.entries(params).forEach(([k, v]) => {
    str = str.replace(new RegExp(`{{${k}}}`, 'g'), String(v ?? ''));
  });
  return str;
}

module.exports = { t };
