const axios = require('axios');
const config = require('./config');

/**
 * Get HTTP headers with Authorization/X-API-Key if configured
 * @returns {Record<string, string>}
 */
function getAuthHeaders() {
  const apiKey = (process.env.TMAIL_API_KEY || config.TMAIL_API_KEY || '').trim();
  const headers = {};
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
    headers['X-API-Key'] = apiKey;
  }
  return headers;
}

/**
 * Get configured Premur TMail base URL
 * @returns {string}
 */
function getBaseUrl() {
  const url = process.env.TMAIL_BASE_URL || config.TMAIL_BASE_URL || 'https://mails.premur.shop';
  return url.replace(/\/$/, '');
}

/**
 * Generate a new temp email address via Premur Shop TMail API
 * Endpoint: GET /api/new
 * @returns {Promise<{ email: string, login: string, domain: string }>}
 */
async function generateTempEmail() {
  const baseUrl = getBaseUrl();
  const headers = getAuthHeaders();

  try {
    const response = await axios.get(`${baseUrl}/api/new`, {
      headers,
      timeout: 15000,
    });

    if (response.data && response.data.email) {
      const email = response.data.email;
      const parts = email.split('@');
      const login = parts[0] || '';
      const domain = parts[1] || '';
      return { email, login, domain };
    }

    throw new Error(response.data?.error || 'Failed to generate email from Premur TMail API');
  } catch (err) {
    console.error('Premur TMail generateTempEmail error:', err.response?.data || err.message);
    throw err;
  }
}

/**
 * Check inbox for a temp email
 * Endpoint: GET /api/bot/inbox/{email}
 * @param {string} emailOrLogin - Full email address (e.g. 'abc@domain.com') or login part ('abc')
 * @param {string} [domain] - Domain part if first param is login
 * @returns {Promise<Array<{ id: string|number, from: string, subject: string, body: string, date: string, html: string }>>}
 */
async function checkInbox(emailOrLogin, domain) {
  let email = '';
  if (emailOrLogin && emailOrLogin.includes('@')) {
    email = emailOrLogin;
  } else if (emailOrLogin && domain) {
    email = `${emailOrLogin}@${domain}`;
  } else {
    email = emailOrLogin || '';
  }

  if (!email) return [];

  const baseUrl = getBaseUrl();
  const headers = getAuthHeaders();

  try {
    const encodedEmail = encodeURIComponent(email);
    const response = await axios.get(`${baseUrl}/api/bot/inbox/${encodedEmail}`, {
      headers,
      timeout: 15000,
    });

    if (Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  } catch (err) {
    console.error(`Premur TMail checkInbox error (${email}):`, err.response?.data || err.message);
    return [];
  }
}

/**
 * Read a specific message by ID
 * @param {string} emailOrLogin - Email or login
 * @param {string|number} domainOrId - Domain or message ID
 * @param {string|number} [messageId] - Message ID if 3 parameters passed
 * @returns {Promise<object|null>}
 */
async function readMessage(emailOrLogin, domainOrId, messageId) {
  let email = '';
  let targetId = null;

  if (messageId !== undefined && messageId !== null) {
    // Called as (login, domain, messageId)
    email = `${emailOrLogin}@${domainOrId}`;
    targetId = messageId;
  } else {
    // Called as (email, messageId)
    email = emailOrLogin;
    targetId = domainOrId;
  }

  const messages = await checkInbox(email);
  if (!messages || !messages.length) return null;

  const found = messages.find(m => String(m.id) === String(targetId));
  return found || messages[0] || null;
}

/**
 * Fetch available domains from Premur Shop TMail API
 * Endpoint: GET /api/domains
 * @returns {Promise<string[]>}
 */
async function getDomains() {
  const baseUrl = getBaseUrl();
  try {
    const response = await axios.get(`${baseUrl}/api/domains`, { timeout: 10000 });
    if (response.data && Array.isArray(response.data.domains)) {
      return response.data.domains;
    }
    return [];
  } catch (err) {
    console.error('Premur TMail getDomains error:', err.message);
    return [];
  }
}

module.exports = {
  generateTempEmail,
  checkInbox,
  readMessage,
  getDomains,
};
