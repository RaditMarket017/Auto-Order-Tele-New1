const { Markup } = require('telegraf');
const { db } = require('../firebase');
const config = require('../config');
const { t } = require('../i18n');
const { generateTempEmail, checkInbox, readMessage } = require('../tmail');
const { escapeHTML } = require('../helpers');

async function checkIsAdmin(userId) {
  if (!userId) return false;
  if (userId.toString() === config.ADMIN_ID.toString()) return true;
  try {
    const doc = await db.collection('bot_users').doc(userId.toString()).get();
    return doc.exists && doc.data().role === 'admin';
  } catch { return false; }
}

async function getUserLang(userId) {
  try {
    const doc = await db.collection('bot_users').doc(userId.toString()).get();
    return (doc.exists && doc.data().language) ? doc.data().language : 'id';
  } catch { return 'id'; }
}

/**
 * Show TMail menu (admin only)
 */
async function showTMailMenu(ctx) {
  const isAdmin = await checkIsAdmin(ctx.from.id);
  if (!isAdmin) return ctx.answerCbQuery(t('id', 'admin_not_authorized'), { show_alert: true }).catch(() => {});

  const lang = await getUserLang(ctx.from.id);

  // Check if there's an active email
  const sessionDoc = await db.collection('admin_tmail_sessions').doc(ctx.from.id.toString()).get();
  const activeEmail = sessionDoc.exists ? sessionDoc.data().email : null;

  let msg = t(lang, 'tmail_title');
  if (activeEmail) {
    msg += `\n\n• Email Aktif: <code>${escapeHTML(activeEmail)}</code>`;
  }

  const buttons = [
    [Markup.button.callback('📨 Generate Baru', 'tmail_generate')],
    [Markup.button.callback('📥 Cek Inbox', 'tmail_inbox')],
    [Markup.button.callback('🗑 Hapus Email', 'tmail_delete')],
    [Markup.button.callback(t(lang, 'btn_back'), 'admin_main')],
  ];

  const keyboard = Markup.inlineKeyboard(buttons);

  if (ctx.updateType === 'callback_query') {
    return ctx.editMessageText(msg, { parse_mode: 'HTML', ...keyboard }).catch(() => {});
  }
  return ctx.reply(msg, { parse_mode: 'HTML', ...keyboard });
}

/**
 * Handle TMail actions
 */
async function handleTMailAction(ctx) {
  const isAdmin = await checkIsAdmin(ctx.from.id);
  if (!isAdmin) return ctx.answerCbQuery(t('id', 'admin_not_authorized'), { show_alert: true }).catch(() => {});

  const action = ctx.match?.[0] || '';
  const lang = await getUserLang(ctx.from.id);

  if (action === 'tmail_generate') {
    const emailData = generateTempEmail();

    // Save to session
    await db.collection('admin_tmail_sessions').doc(ctx.from.id.toString()).set({
      email: emailData.email,
      login: emailData.login,
      domain: emailData.domain,
      createdAt: new Date().toISOString(),
    });

    const msg = t(lang, 'tmail_generated', {
      email: escapeHTML(emailData.email),
      expiry: '60',
    });

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('📥 Cek Inbox', 'tmail_inbox')],
      [Markup.button.callback(t(lang, 'btn_back'), 'tmail_menu')],
    ]);

    ctx.answerCbQuery('✅ Email dibuat!').catch(() => {});
    return ctx.editMessageText(msg, { parse_mode: 'HTML', ...keyboard }).catch(() => {});
  }

  if (action === 'tmail_inbox') {
    const sessionDoc = await db.collection('admin_tmail_sessions').doc(ctx.from.id.toString()).get();
    if (!sessionDoc.exists || !sessionDoc.data().email) {
      return ctx.answerCbQuery(t(lang, 'tmail_no_active'), { show_alert: true }).catch(() => {});
    }

    const { login, domain } = sessionDoc.data();
    ctx.answerCbQuery('⏳ Memuat inbox...').catch(() => {});

    const messages = await checkInbox(login, domain);

    let msg = t(lang, 'tmail_inbox_title', { count: messages.length });

    if (messages.length === 0) {
      msg += t(lang, 'tmail_inbox_empty');
    } else {
      messages.slice(0, 10).forEach((m, i) => {
        msg += t(lang, 'tmail_inbox_item', {
          num: i + 1,
          from: escapeHTML(m.from),
          subject: escapeHTML(m.subject || '(no subject)'),
          time: escapeHTML(m.date || ''),
        });
      });
    }

    const buttons = messages.slice(0, 5).map((m, i) => [
      Markup.button.callback(`📖 Baca #${i + 1}`, `tmail_read_${m.id}`),
    ]);

    buttons.push([Markup.button.callback('🔄 Refresh', 'tmail_inbox')]);
    buttons.push([Markup.button.callback(t(lang, 'btn_back'), 'tmail_menu')]);

    const keyboard = Markup.inlineKeyboard(buttons);
    return ctx.editMessageText(msg, { parse_mode: 'HTML', ...keyboard }).catch(() => {});
  }

  if (action.startsWith('tmail_read_')) {
    const messageId = parseInt(action.replace('tmail_read_', ''));
    const sessionDoc = await db.collection('admin_tmail_sessions').doc(ctx.from.id.toString()).get();
    if (!sessionDoc.exists) return;

    const { login, domain } = sessionDoc.data();
    const message = await readMessage(login, domain, messageId);

    if (!message) {
      return ctx.answerCbQuery('Pesan tidak ditemukan.', { show_alert: true }).catch(() => {});
    }

    let body = message.textBody || message.body || '(empty)';
    if (body.length > 3000) body = body.substring(0, 3000) + '...';

    // Strip HTML tags for clean display inside pre tag
    body = body.replace(/<[^>]*>/g, '').trim();

    const msg =
      `📖 <b><u>SURAT MASUK (EMAIL)</u></b>\n\n` +
      `<blockquote>` +
      `• <b>Dari</b>    : <b>${escapeHTML(message.from || 'Unknown')}</b>\n` +
      `• <b>Subjek</b>  : <b>${escapeHTML(message.subject || '(none)')}</b>\n` +
      `• <b>Waktu</b>   : <i>${escapeHTML(message.date || '')}</i>` +
      `</blockquote>\n\n` +
      `📄 <b><u>ISI PESAN:</u></b>\n` +
      `<pre>${escapeHTML(body)}</pre>`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback(t(lang, 'btn_back'), 'tmail_inbox')],
    ]);

    ctx.answerCbQuery().catch(() => {});
    return ctx.editMessageText(msg, { parse_mode: 'HTML', ...keyboard }).catch(() => {});
  }

  if (action === 'tmail_delete') {
    await db.collection('admin_tmail_sessions').doc(ctx.from.id.toString()).delete();
    ctx.answerCbQuery(t(lang, 'tmail_deleted')).catch(() => {});
    return showTMailMenu(ctx);
  }

  if (action === 'tmail_menu') {
    return showTMailMenu(ctx);
  }
}

module.exports = {
  showTMailMenu,
  handleTMailAction,
};
