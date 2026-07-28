/**
 * Format number to Indonesian Rupiah string
 * @param {number} amount
 * @returns {string}
 */
function formatIDR(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

/**
 * Escape special HTML characters for Telegram
 * @param {string} text
 * @returns {string}
 */
function escapeHTML(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Escape special Markdown characters for Telegram
 * @param {string} text
 * @returns {string}
 */
function escapeMarkdown(text) {
  if (!text) return '';
  return String(text).replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

/**
 * Generate a unique order ID with prefix
 * @param {string} prefix - e.g. 'ORD', 'TOPUP', 'RESELLER'
 * @returns {string}
 */
function generateOrderId(prefix = 'ORD') {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${dateStr}-${rand}`;
}

/**
 * Format date to Indonesian locale string
 * @param {Date|string} date
 * @returns {{ dateStr: string, timeStr: string, fullStr: string }}
 */
function formatDateID(date) {
  const d = date instanceof Date ? date : new Date(date || Date.now());
  const dateFormatter = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'Asia/Jakarta',
  });
  const timeFormatter = new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    timeZone: 'Asia/Jakarta',
  });
  const dateStr = dateFormatter.format(d);
  const timeStr = timeFormatter.format(d).replace(/\./g, ':');
  return { dateStr, timeStr, fullStr: `${dateStr} ${timeStr}` };
}

/**
 * Delay utility
 * @param {number} ms
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  formatIDR,
  escapeHTML,
  escapeMarkdown,
  generateOrderId,
  formatDateID,
  delay,
};
