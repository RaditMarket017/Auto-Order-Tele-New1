export function formatIDR(amount) {
  return 'Rp ' + (amount || 0).toLocaleString('id-ID');
}

export function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function stripHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/blockquote>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function getTelegramUser() {
  const tg = window.Telegram?.WebApp;
  if (tg) { tg.ready(); tg.expand(); }

  const urlParams = new URLSearchParams(window.location.search);
  const tgUser = tg?.initDataUnsafe?.user;
  const urlUserId = urlParams.get('user_id');
  const urlName = urlParams.get('name') || urlParams.get('first_name') || urlParams.get('username');
  const urlPhoto = urlParams.get('photo_url') || urlParams.get('photo');

  let name = '';
  if (tgUser?.first_name) {
    name = `${tgUser.first_name}${tgUser.last_name ? ' ' + tgUser.last_name : ''}`.trim();
  } else if (urlName) {
    name = urlName;
  } else {
    name = 'Member';
  }

  const resolvedId = tgUser?.id ? String(tgUser.id) : (urlUserId ? String(urlUserId) : '5665721422');

  return {
    id: resolvedId,
    first_name: name,
    photo_url: tgUser?.photo_url || urlPhoto || '',
    tgUser,
    tg
  };
}
