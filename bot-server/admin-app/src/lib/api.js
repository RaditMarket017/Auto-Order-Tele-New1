import { getAdminAuth } from './utils.js';

export async function apiFetch(endpoint, options = {}) {
  const { userId, secret } = getAdminAuth();
  options.headers = {
    ...options.headers,
    'Content-Type': 'application/json',
    'x-telegram-user-id': userId,
    'x-admin-secret': secret,
    'ngrok-skip-browser-warning': 'true'
  };
  const res = await fetch(endpoint, options);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { success: false };
  }
}
