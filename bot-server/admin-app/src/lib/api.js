import { getAdminAuth } from './utils.js';

export async function apiFetch(endpoint, options = {}) {
  const { userId, secret } = getAdminAuth();
  options.headers = {
    ...options.headers,
    'Content-Type': 'application/json',
    'x-telegram-user-id': userId,
    'x-admin-secret': secret
  };
  const res = await fetch(endpoint, options);
  return res.json();
}
