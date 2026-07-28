require('dotenv').config();

module.exports = {
  // Telegram
  BOT_TOKEN: process.env.BOT_TOKEN,
  ADMIN_ID: parseInt(process.env.ADMIN_ID),

  // RamaShop Payment
  RAMASHOP_API_KEY: process.env.RAMASHOP_API_KEY,
  RAMASHOP_BASE_URL: process.env.RAMASHOP_BASE_URL || 'https://ramashop.my.id/api/public',

  // Firebase
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,

  // Store
  STORE_NAME: process.env.STORE_NAME || 'AutoStore',
  STORE_LOGO_URL: process.env.STORE_LOGO_URL || '',
  STORE_BANNER_URL: process.env.STORE_BANNER_URL || '',

  // Testimoni & Required Channel
  TESTIMONI_CHANNEL_ID: process.env.TESTIMONI_CHANNEL_ID || '',
  REQUIRED_CHANNEL_ID: process.env.REQUIRED_CHANNEL_ID || process.env.TESTIMONI_CHANNEL_ID || '',
  REQUIRED_CHANNEL_LINK: process.env.REQUIRED_CHANNEL_LINK || process.env.GROUP_TELEGRAM || '',

  // Server
  SERVER_URL: process.env.SERVER_URL || process.env.WEBHOOK_BASE_URL || '',
  WEBHOOK_BASE_URL: process.env.SERVER_URL || process.env.WEBHOOK_BASE_URL || 'http://localhost:3001',
  PORT: parseInt(process.env.PORT) || 3001,
  ADMIN_SECRET: process.env.ADMIN_SECRET || 'secret',

  // Contact
  CONTACT_WHATSAPP: process.env.CONTACT_WHATSAPP || '',
  CONTACT_TELEGRAM: process.env.CONTACT_TELEGRAM || '',
  GROUP_TELEGRAM: process.env.GROUP_TELEGRAM || '',

  // Pagination
  ITEMS_PER_PAGE: 6,
};
