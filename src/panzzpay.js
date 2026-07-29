const axios = require('axios');
const config = require('./config');

let rawBaseUrl = process.env.PANZZPAY_BASE_URL || config.PANZZPAY_BASE_URL || 'https://panzzpay.my.id/api/public';
rawBaseUrl = rawBaseUrl.replace(/\/$/, '');
if (rawBaseUrl.endsWith('/docs')) {
  rawBaseUrl = rawBaseUrl.replace(/\/docs$/, '/api/public');
} else if (!rawBaseUrl.endsWith('/api/public') && !rawBaseUrl.endsWith('/api')) {
  rawBaseUrl += '/api/public';
}
const BASE_URL = rawBaseUrl;
const API_KEY = process.env.PANZZPAY_API_KEY || config.PANZZPAY_API_KEY || process.env.RAMASHOP_API_KEY;

/**
 * Create a PanzzPay QRIS payment/deposit
 * @param {string} orderId
 * @param {number} amount
 * @returns {Promise<object>}
 */
const createPanzzPayPayment = async (orderId, amount, options = {}) => {
  try {
    const response = await axios.post(`${BASE_URL}/deposit/create`, {
      amount: Math.max(100, Math.round(amount)),
      method: 'qris',
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
      },
      timeout: 10000,
    });

    const resData = response.data;
    if (resData.success && resData.data) {
      const d = resData.data;
      const qrUrl = d.qrImage || (d.qrString ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(d.qrString)}` : '');
      
      let qrBuffer = null;
      if (qrUrl) {
        try {
          const imgRes = await axios.get(qrUrl, { responseType: 'arraybuffer', timeout: 5000 });
          qrBuffer = Buffer.from(imgRes.data);
        } catch {}
      }

      return {
        success: true,
        depositId: d.depositId || d.id,
        id: d.depositId || d.id,
        unique_amount: d.totalAmount || amount,
        totalAmount: d.totalAmount || amount,
        qrBuffer,
        qr_data_url: qrUrl,
        qrString: d.qrString,
        status: d.status || 'pending',
        gateway: 'panzzpay',
      };
    }
    return resData;
  } catch (error) {
    console.error('PanzzPay Create Error:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Check PanzzPay deposit status
 * @param {string} depositId
 * @returns {Promise<object>}
 */
const checkPanzzPayStatus = async (depositId) => {
  try {
    const cleanBase = BASE_URL.replace(/\/public\/?$/, '').replace(/\/api\/?$/, '');
    const url = `${BASE_URL}/deposit/status/${depositId}`;

    const response = await axios.get(url, {
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    const data = response.data;
    if (data && (data.status || data.data?.status)) {
      const statusVal = (data.status || data.data?.status);
      const isPaid = statusVal === 'paid' || statusVal === 'success';
      return {
        success: true,
        status: isPaid ? 'success' : statusVal,
        data: {
          status: isPaid ? 'success' : statusVal,
          depositId: data.id || depositId,
          amount: data.amount,
          uniqueAmount: data.unique_amount || data.totalAmount,
        }
      };
    }
    return data;
  } catch (error) {
    // Fallback status check
    if (error.response?.status === 404) {
      try {
        const cleanBase = BASE_URL.replace(/\/public\/?$/, '').replace(/\/api\/?$/, '');
        const altUrl = `${cleanBase}/api/payments/${depositId}`;
        const altRes = await axios.get(altUrl, {
          headers: { 'X-API-Key': API_KEY },
          timeout: 5000,
        });
        return altRes.data;
      } catch {}
    }
    console.error('PanzzPay Status Error:', error.response?.data || error.message);
    throw error;
  }
};

module.exports = {
  createPanzzPayPayment,
  checkPanzzPayStatus,
};
