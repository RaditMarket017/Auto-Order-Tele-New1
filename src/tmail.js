const axios = require('axios');

// Using 1secmail.com API (free, no auth required)
const SECMAIL_API = 'https://www.1secmail.com/api/v1/';

// Available domains
const DOMAINS = ['1secmail.com', '1secmail.org', '1secmail.net'];

/**
 * Generate a random temp email address
 * @returns {{ email: string, login: string, domain: string }}
 */
function generateTempEmail() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let login = '';
  for (let i = 0; i < 10; i++) {
    login += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const domain = DOMAINS[Math.floor(Math.random() * DOMAINS.length)];
  return { email: `${login}@${domain}`, login, domain };
}

/**
 * Check inbox for a temp email
 * @param {string} login
 * @param {string} domain
 * @returns {Promise<Array<{ id: number, from: string, subject: string, date: string }>>}
 */
async function checkInbox(login, domain) {
  try {
    const response = await axios.get(SECMAIL_API, {
      params: { action: 'getMessages', login, domain },
    });
    return response.data || [];
  } catch (err) {
    console.error('TMail checkInbox error:', err.message);
    return [];
  }
}

/**
 * Read a specific email message
 * @param {string} login
 * @param {string} domain
 * @param {number} messageId
 * @returns {Promise<object|null>}
 */
async function readMessage(login, domain, messageId) {
  try {
    const response = await axios.get(SECMAIL_API, {
      params: { action: 'readMessage', login, domain, id: messageId },
    });
    return response.data || null;
  } catch (err) {
    console.error('TMail readMessage error:', err.message);
    return null;
  }
}

module.exports = {
  generateTempEmail,
  checkInbox,
  readMessage,
};
