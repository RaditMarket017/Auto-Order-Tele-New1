const axios = require('axios');

let rawBaseUrl = process.env.RAMASHOP_BASE_URL || 'https://ramashop.my.id/api/public';
rawBaseUrl = rawBaseUrl.replace(/\/$/, '');
if (!rawBaseUrl.endsWith('/api/public')) {
  rawBaseUrl += '/api/public';
}
const BASE_URL = rawBaseUrl;

/**
 * Create a RamaShop QRIS payment/deposit
 * @param {string} orderId - Unique order ID
 * @param {number} amount - Amount in Rupiah
 * @param {object} options
 * @returns {Promise<object>}
 */
const createPayment = async (orderId, amount, options = {}) => {
  try {
    const response = await axios.post(`${BASE_URL}/deposit/create`, {
      amount: Math.max(100, Math.round(amount)),
      method: 'qris',
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.RAMASHOP_API_KEY,
      },
    });

    const resData = response.data;
    if (resData.success && resData.data) {
      const d = resData.data;
      const qrUrl = d.qrImage || (d.qrString ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(d.qrString)}` : '');
      
      // Convert QR URL or data string to buffer
      let qrBuffer = null;
      if (qrUrl) {
        try {
          const imgRes = await axios.get(qrUrl, { responseType: 'arraybuffer' });
          qrBuffer = Buffer.from(imgRes.data);
        } catch {}
      }

      return {
        success: true,
        depositId: d.depositId,
        id: d.depositId,
        unique_amount: d.totalAmount || amount,
        totalAmount: d.totalAmount || amount,
        qrBuffer,
        qr_data_url: qrUrl,
        qrString: d.qrString,
        status: d.status,
      };
    }
    return resData;
  } catch (error) {
    console.error('RamaShop Create Error:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Check RamaShop deposit status
 * @param {string} depositId
 * @returns {Promise<object>}
 */
const checkStatus = async (depositId) => {
  try {
    const cleanBase = BASE_URL.replace(/\/public\/?$/, '').replace(/\/api\/?$/, '');
    const url = (BASE_URL.includes('panzz') || BASE_URL.includes('vercel.app'))
      ? `${cleanBase}/api/payments/${depositId}`
      : `${BASE_URL}/deposit/status/${depositId}`;

    const response = await axios.get(url, {
      headers: {
        'X-API-Key': process.env.RAMASHOP_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    const data = response.data;
    if (data && data.status) {
      return {
        success: true,
        status: data.status === 'paid' ? 'success' : data.status,
        data: {
          status: data.status === 'paid' ? 'success' : data.status,
          depositId: data.id || depositId,
          amount: data.amount,
          uniqueAmount: data.unique_amount,
        }
      };
    }
    return data;
  } catch (error) {
    // 404 Fallback to alternative PanzzPay / RamaShop endpoints
    if (error.response?.status === 404) {
      try {
        const cleanBase = BASE_URL.replace(/\/public\/?$/, '').replace(/\/api\/?$/, '');
        const altUrl = `${cleanBase}/api/public/deposit/status/${depositId}`;
        const altRes = await axios.get(altUrl, {
          headers: { 'X-API-Key': process.env.RAMASHOP_API_KEY },
        });
        return altRes.data;
      } catch {}
    }
    console.error('RamaShop Status Error:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Cancel payment placeholder
 */
const cancelPayment = async (orderId) => {
  return { success: true };
};

/**
 * Check health / balance
 */
const checkHealth = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/balance`, {
      headers: { 'X-API-Key': process.env.RAMASHOP_API_KEY },
    });
    return response.data;
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Helper to convert data URL to Buffer
 */
const dataUrlToBuffer = (dataUrl) => {
  if (Buffer.isBuffer(dataUrl)) return dataUrl;
  const base64Data = String(dataUrl).replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(base64Data, 'base64');
};

module.exports = {
  createPayment,
  checkStatus,
  cancelPayment,
  checkHealth,
  dataUrlToBuffer,
};
