const BASE = '';
const defaultHeaders = {
  'ngrok-skip-browser-warning': 'true',
  'Accept': 'application/json',
};

async function safeJsonFetch(url, options = {}) {
  try {
    const headers = { ...defaultHeaders, ...(options.headers || {}) };
    const res = await fetch(url, { ...options, headers });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return { success: false };
    }
  } catch (err) {
    console.error('Fetch error:', err);
    return { success: false };
  }
}

export async function fetchStoreInfo() {
  return safeJsonFetch(`${BASE}/api/shop/store-info`);
}

export async function fetchProducts() {
  return safeJsonFetch(`${BASE}/api/shop/products`);
}

export async function fetchUserProfile(userId) {
  return safeJsonFetch(`${BASE}/api/shop/user-profile?user_id=${userId}`);
}

export async function createOrder(payload) {
  return safeJsonFetch(`${BASE}/api/shop/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function checkOrderStatus(orderId) {
  return safeJsonFetch(`${BASE}/api/shop/order-status/${orderId}`);
}

export async function cancelOrder(orderId) {
  return safeJsonFetch(`${BASE}/api/shop/cancel-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId }),
  });
}

export async function applyVoucher(code, totalPrice, productId) {
  return safeJsonFetch(`${BASE}/api/shop/apply-voucher`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, totalPrice, productId }),
  });
}
