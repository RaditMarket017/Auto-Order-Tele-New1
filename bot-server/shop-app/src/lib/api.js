const BASE = '';

export async function fetchStoreInfo() {
  const res = await fetch(`${BASE}/api/shop/store-info`);
  return res.json();
}

export async function fetchProducts() {
  const res = await fetch(`${BASE}/api/shop/products`);
  return res.json();
}

export async function fetchUserProfile(userId) {
  try {
    const res = await fetch(`${BASE}/api/shop/user-profile?user_id=${userId}`);
    return res.json();
  } catch { return {}; }
}

export async function createOrder(payload) {
  const res = await fetch(`${BASE}/api/shop/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function checkOrderStatus(orderId) {
  const res = await fetch(`${BASE}/api/shop/order-status/${orderId}`);
  return res.json();
}

export async function cancelOrder(orderId) {
  const res = await fetch(`${BASE}/api/shop/cancel-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId }),
  });
  return res.json();
}

export async function applyVoucher(code, totalPrice, productId) {
  const res = await fetch(`${BASE}/api/shop/apply-voucher`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, totalPrice, productId }),
  });
  return res.json();
}
