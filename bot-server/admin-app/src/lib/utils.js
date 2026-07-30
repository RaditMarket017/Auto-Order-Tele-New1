export function formatIDR(amount) {
  return 'Rp ' + (amount || 0).toLocaleString('id-ID');
}

export function escapeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function getAdminAuth() {
  const urlParams = new URLSearchParams(window.location.search);
  const urlUserId = urlParams.get('user_id');
  const urlSecret = urlParams.get('secret');

  const tg = window.Telegram?.WebApp;
  if (tg) {
    try {
      tg.ready();
      tg.expand();
    } catch (e) {}
  }

  const tgUser = tg?.initDataUnsafe?.user;

  return {
    userId: tgUser?.id ? String(tgUser.id) : (urlUserId ? String(urlUserId) : '5665721422'),
    secret: urlSecret || 'panzzstore2026'
  };
}
