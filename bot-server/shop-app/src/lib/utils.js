export function formatIDR(amount) {
  return 'Rp ' + (amount || 0).toLocaleString('id-ID');
}

export function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function getTelegramUser() {
  const tg = window.Telegram?.WebApp;
  if (tg) { tg.ready(); tg.expand(); }

  const urlParams = new URLSearchParams(window.location.search);
  const tgUser = tg?.initDataUnsafe?.user;
  const urlUserId = urlParams.get('user_id');
  const urlName = urlParams.get('name') || urlParams.get('first_name') || urlParams.get('username');

  return {
    id: tgUser?.id || urlUserId || '5665721422',
    first_name: tgUser?.first_name || urlName || (tgUser?.username ? '@' + tgUser.username : 'Member PanzzStore'),
    tg
  };
}
