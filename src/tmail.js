const axios = require('axios');
const config = require('./config');

const PRESET_VIP_DOMAINS = [
  'storeraditmarket.web.id',
  'raditmarket.web.id',
  'raditmarket.biz.id',
  'raditmarketpro.web.id',
  'raditmarketpro.biz.id',
  'rmpusatdigital.web.id',
  'rmpusatdigital.biz.id',
  'storeraditmarket.biz.id',
  'rmpremium.web.id',
  'rmpremium.biz.id',
];

/**
 * Get configured TMail API key
 * @returns {string}
 */
function getApiKey() {
  const key = process.env.TMAIL_API_KEY || config.TMAIL_API_KEY || 'tmail_sk_fl5sykfj8k86nb4gxc4ryp';
  return (key || '').trim();
}

/**
 * Get HTTP headers with Authorization/X-API-Key
 * @returns {Record<string, string>}
 */
function getAuthHeaders() {
  const apiKey = getApiKey();
  const headers = {};
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
    headers['X-API-Key'] = apiKey;
    headers['x-api-key'] = apiKey;
  }
  return headers;
}

/**
 * Get target TMail base URL dynamically based on requested domain or email
 * @param {string} [domainOrEmail]
 * @returns {string}
 */
function getBaseUrl(domainOrEmail = '') {
  if (domainOrEmail && typeof domainOrEmail === 'string') {
    const clean = domainOrEmail.trim();
    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      return clean.replace(/\/$/, '');
    }
    const domain = clean.includes('@') ? clean.split('@')[1] : clean;
    if (domain && domain.includes('.')) {
      return `https://${domain.trim()}`.replace(/\/$/, '');
    }
  }

  const configured = process.env.TMAIL_BASE_URL || config.TMAIL_BASE_URL;
  if (configured && configured.trim()) {
    return configured.trim().replace(/\/$/, '');
  }

  return 'https://storeraditmarket.web.id';
}

/**
 * Generate a new temp email address via Premur TMail API
 * @param {string} [customDomain] - Optional custom domain to use
 * @param {string} [customUsername] - Optional custom username/prefix to use
 * @returns {Promise<{ email: string, login: string, domain: string }>}
 */
async function generateTempEmail(customDomain = '', customUsername = '') {
  const targetDomain = customDomain.trim() || PRESET_VIP_DOMAINS[0];
  const baseUrl = getBaseUrl(targetDomain);
  const headers = getAuthHeaders();
  const apiKey = getApiKey();

  const params = {
    api_key: apiKey,
  };
  if (targetDomain) params.domain = targetDomain;
  if (customUsername.trim()) {
    const cleanUser = customUsername.trim().toLowerCase().replace(/[^a-z0-9.]/g, '');
    params.username = cleanUser;
    params.login = cleanUser;
    params.prefix = cleanUser;
  }

  try {
    const response = await axios.get(`${baseUrl}/api/new`, {
      headers,
      params,
      timeout: 15000,
    });

    if (response.data && (response.data.email || response.data.address)) {
      let email = response.data.email || response.data.address;
      let parts = email.split('@');
      let login = parts[0] || '';
      let domain = parts[1] || targetDomain;

      // If user specified custom username prefix, enforce it
      if (customUsername.trim()) {
        const cleanUser = customUsername.trim().toLowerCase().replace(/[^a-z0-9.]/g, '');
        if (cleanUser && login !== cleanUser) {
          login = cleanUser;
          email = `${login}@${domain}`;
        }
      }

      return { email, login, domain };
    }

    // Fallback constructed email if server returns success without body
    if (customUsername.trim()) {
      const cleanUser = customUsername.trim().toLowerCase().replace(/[^a-z0-9.]/g, '');
      const email = `${cleanUser}@${targetDomain}`;
      return { email, login: cleanUser, domain: targetDomain };
    }

    const rnd = 'mail' + Math.random().toString(36).substring(2, 10);
    return { email: `${rnd}@${targetDomain}`, login: rnd, domain: targetDomain };
  } catch (err) {
    console.warn(`Premur TMail generateTempEmail warning on ${baseUrl}:`, err.response?.data || err.message);

    // Fallback email construction if endpoint fails
    const cleanUser = customUsername.trim()
      ? customUsername.trim().toLowerCase().replace(/[^a-z0-9.]/g, '')
      : 'mail' + Math.random().toString(36).substring(2, 10);
    const email = `${cleanUser}@${targetDomain}`;
    return { email, login: cleanUser, domain: targetDomain };
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
    email = emailOrLogin.trim();
  } else if (emailOrLogin && domain) {
    email = `${emailOrLogin.trim()}@${domain.trim()}`;
  } else {
    email = (emailOrLogin || '').trim();
  }

  if (!email) return [];

  const baseUrl = getBaseUrl(email);
  const headers = getAuthHeaders();
  const apiKey = getApiKey();

  try {
    const encodedEmail = encodeURIComponent(email);
    const response = await axios.get(`${baseUrl}/api/bot/inbox/${encodedEmail}`, {
      headers,
      params: { api_key: apiKey },
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
    // Retry with fallback /api/inbox endpoint
    try {
      const encodedEmail = encodeURIComponent(email);
      const resp2 = await axios.get(`${baseUrl}/api/inbox/${encodedEmail}`, {
        headers,
        params: { api_key: apiKey },
        timeout: 12000,
      });
      if (Array.isArray(resp2.data)) return resp2.data;
      if (resp2.data && Array.isArray(resp2.data.messages)) return resp2.data.messages;
      return [];
    } catch {
      console.error(`Premur TMail checkInbox error (${email}):`, err.response?.data || err.message);
      return [];
    }
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
 * Merges VIP preset domains with remote domains
 * @returns {Promise<string[]>}
 */
async function getDomains() {
  const baseUrl = getBaseUrl();
  const headers = getAuthHeaders();
  const apiKey = getApiKey();
  const fetchedDomains = [];

  try {
    const response = await axios.get(`${baseUrl}/api/domains`, {
      headers,
      params: { api_key: apiKey },
      timeout: 10000
    });
    if (response.data) {
      let raw = [];
      if (Array.isArray(response.data)) {
        raw = response.data;
      } else if (Array.isArray(response.data.domains)) {
        raw = response.data.domains;
      } else if (Array.isArray(response.data.data)) {
        raw = response.data.data;
      }
      raw.forEach(d => {
        const str = typeof d === 'string' ? d : d.domain || d.name || String(d);
        if (str && !fetchedDomains.includes(str)) fetchedDomains.push(str);
      });
    }
  } catch (err) {
    console.warn('Premur TMail getDomains fetch warning:', err.message);
  }

  // Combine VIP preset domains with fetched domains (VIP domains first)
  const combined = [...PRESET_VIP_DOMAINS];
  fetchedDomains.forEach(d => {
    if (!combined.includes(d)) combined.push(d);
  });

  return combined.filter(Boolean);
}

module.exports = {
  generateTempEmail,
  checkInbox,
  readMessage,
  getDomains,
  PRESET_VIP_DOMAINS,
};
