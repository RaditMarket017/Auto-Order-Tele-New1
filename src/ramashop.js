const axios = require('axios');
const { createPanzzPayPayment, checkPanzzPayStatus } = require('./panzzpay');

let rawBaseUrl = process.env.RAMASHOP_BASE_URL || 'https://ramashop.my.id/api/public';
rawBaseUrl = rawBaseUrl.replace(/\/$/, '');
if (!rawBaseUrl.endsWith('/api/public') && !rawBaseUrl.endsWith('/api')) {
  rawBaseUrl += '/api/public';
}
const BASE_URL = rawBaseUrl;

/**
 * Detect active payment gateway configuration
 */
const getGatewayConfig = () => {
  const rKey = (process.env.RAMASHOP_API_KEY || '').trim();
  const pKey = (process.env.PANZZPAY_API_KEY || '').trim();

  const hasRamaShop = Boolean(rKey && !rKey.includes('your_'));
  const hasPanzzPay = Boolean(pKey && !pKey.includes('your_') && pKey !== rKey);
  const hasDualGateways = hasRamaShop && hasPanzzPay;

  return {
    hasRamaShop,
    hasPanzzPay,
    hasDualGateways,
  };
};

/**
 * Internal: Create a RamaShop QRIS payment/deposit
 */
const createRamaShopPayment = async (orderId, amount, options = {}) => {
  const urlList = [
    `${BASE_URL}/deposit/create`,
    `${BASE_URL.replace(/\/public\/?$/, '')}/deposit/create`,
    `${BASE_URL.replace(/\/api\/public\/?$/, '')}/api/deposit/create`,
    `${BASE_URL.replace(/\/api\/public\/?$/, '')}/deposit/create`,
  ];
  const uniqueUrls = [...new Set(urlList)];

  let lastError;
  for (const targetUrl of uniqueUrls) {
    try {
      const response = await axios.post(targetUrl, {
        amount: Math.max(100, Math.round(amount)),
        method: 'qris',
      }, {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.RAMASHOP_API_KEY,
        },
        timeout: 15000,
      });

      const resData = response.data;
      if (resData.success && resData.data) {
        const d = resData.data;
        const qrUrl = d.qrImage || (d.qrString ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(d.qrString)}` : '');
        
        let qrBuffer = null;
        if (qrUrl) {
          try {
            const imgRes = await axios.get(qrUrl, { responseType: 'arraybuffer', timeout: 7000 });
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
          gateway: 'ramashop',
        };
      }
      return resData;
    } catch (error) {
      lastError = error;
      if (error.response?.status === 404) {
        continue;
      }
      break;
    }
  }
  console.error('RamaShop Create Error:', lastError?.response?.data || lastError?.message);
  throw lastError || new Error('RamaShop deposit request failed');
};

/**
 * Unified Payment Creation with Gateway Support & Bidirectional Auto-Failover
 */
const createPayment = async (orderId, amount, options = {}) => {
  const preferredGateway = options.gateway;

  // 1. If PanzzPay (QRIS 2) is explicitly requested
  if (preferredGateway === 'panzzpay') {
    try {
      const panzzResult = await createPanzzPayPayment(orderId, amount, options);
      if (panzzResult && panzzResult.success) {
        panzzResult.gateway = 'panzzpay';
        return panzzResult;
      }
      console.warn(`⚠️ PanzzPay (QRIS 2) server down. Auto-failing over to RamaShop (QRIS 1)...`);
    } catch (errP) {
      console.warn(`⚠️ PanzzPay Error: ${errP.message}. Auto-failing over to RamaShop...`);
    }

    // Failover to RamaShop
    try {
      console.log(`⚡ [Auto-Failover] Creating deposit via RamaShop...`);
      const ramaResult = await createRamaShopPayment(orderId, amount, options);
      if (ramaResult && ramaResult.success) {
        ramaResult.gateway = 'ramashop';
        return ramaResult;
      }
    } catch (errR) {
      console.error(`❌ Both Payment Gateways (PanzzPay & RamaShop) failed:`, errR.message);
      throw errR;
    }
  }

  // 2. Primary / Preferred Gateway: RamaShop (QRIS 1)
  try {
    const result = await createRamaShopPayment(orderId, amount, options);
    if (result && result.success) {
      result.gateway = 'ramashop';
      return result;
    }
    console.warn(`⚠️ [Gateway Failover] RamaShop (QRIS 1) server down. Auto-failing over to PanzzPay (QRIS 2)...`);
  } catch (err1) {
    console.warn(`⚠️ [Gateway Failover] RamaShop Error: ${err1.message}. Auto-failing over to PanzzPay...`);
  }

  // 3. Backup Gateway if RamaShop failed: PanzzPay
  try {
    console.log(`⚡ [Gateway Failover] Attempting QRIS deposit via PanzzPay...`);
    const panzzResult = await createPanzzPayPayment(orderId, amount, options);
    if (panzzResult && panzzResult.success) {
      panzzResult.gateway = 'panzzpay';
      return panzzResult;
    }
    return panzzResult;
  } catch (err2) {
    console.error(`❌ Both Payment Gateways (RamaShop & PanzzPay) failed:`, err2.message);
    throw err2;
  }
};

/**
 * Check deposit status across gateways
 * @param {string} depositId
 * @returns {Promise<object>}
 */
const checkStatus = async (depositId) => {
  // 1. Try checking via RamaShop
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
      timeout: 8000,
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
  } catch (errRama) {
    // Failover status check to PanzzPay
  }

  // 2. Check via PanzzPay
  try {
    return await checkPanzzPayStatus(depositId);
  } catch (errPanzz) {
    console.error(`Status check failed on both gateways for depositId #${depositId}:`, errPanzz.message);
    throw errPanzz;
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
      timeout: 5000,
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
  getGatewayConfig,
  createPayment,
  checkStatus,
  cancelPayment,
  checkHealth,
  dataUrlToBuffer,
  createRamaShopPayment,
  createPanzzPayPayment,
  checkPanzzPayStatus,
};
