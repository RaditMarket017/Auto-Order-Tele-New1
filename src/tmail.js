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
    headers['x-api-key'] = apiKey;
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
 * @param {string} [customDomain] - Optional custom domain to use
 * @param {string} [customUsername] - Optional custom username/prefix to use
 * @returns {Promise<{ email: string, login: string, domain: string }>}
 */
async function generateTempEmail(customDomain = '', customUsername = '') {
  const baseUrl = getBaseUrl();
  const headers = getAuthHeaders();

  const params = {};
  if (customDomain) params.domain = customDomain.trim();
  if (customUsername) {
    params.username = customUsername.trim();
    params.login = customUsername.trim();
    params.prefix = customUsername.trim();
  }

  try {
    const response = await axios.get(`${baseUrl}/api/new`, {
      headers,
      params,
      timeout: 15000,
    });

    if (response.data && (response.data.email || response.data.address)) {
      const email = response.data.email || response.data.address;
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
    if (response.data && Array.isArray(response.data.messages)) {
      return response.data.messages;
    }
    if (response.data && Array.isArray(response.data.data)) {
      return response.data.data;
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
    email = `${emailOrLogin}@${domainOrId}`;
    targetId = messageId;
  } else {
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
  const headers = getAuthHeaders();
  try {
    const response = await axios.get(`${baseUrl}/api/domains`, { headers, timeout: 10000 });
    let domains = [];
    if (response.data) {
      if (Array.isArray(response.data)) {
        domains = response.data.map(d => (typeof d === 'string' ? d : d.domain || d.name || String(d)));
      } else if (Array.isArray(response.data.domains)) {
        domains = response.data.domains.map(d => (typeof d === 'string' ? d : d.domain || d.name || String(d)));
      } else if (Array.isArray(response.data.data)) {
        domains = response.data.data.map(d => (typeof d === 'string' ? d : d.domain || d.name || String(d)));
      }
    }
    return domains.filter(Boolean);
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
