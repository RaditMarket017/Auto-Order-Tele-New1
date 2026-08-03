// ═══════════════════════════════════════
// Auto Order Telegram Bot
// Modern Premium HTML Layout
// ═══════════════════════════════════════

require('dotenv').config();

const { Telegraf, Markup } = require('telegraf');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { db } = require('./src/firebase');
const config = require('./src/config');
const { formatIDR, formatDateID, delay, escapeHTML, isValidTelegramUrl, stripHTMLTags } = require('./src/helpers');
const { t } = require('./src/i18n');
const { clearCart } = require('./src/session');

// Handlers
const { showProductList, showProductDetail } = require('./src/handlers/products');
const { showOrderSummary, adjustQuantity } = require('./src/handlers/orders');
const { handleBalancePayment, handleQRISPayment, handleTopupQRIS, checkPaymentStatus, cancelOrder, handleApproveOrder, handleRejectOrder } = require('./src/handlers/payments');
const { showAdminMenu, handleAdminAction, handleAdmAction, handleAdminText, handleAdminDocument, clearAdminSession } = require('./src/handlers/admin');
const { showTMailMenu, handleTMailAction } = require('./src/handlers/tmail-handler');
const { registerWarrantyRenewHandlers, getWarrantyInfo, getRenewInfo, buildOrderActionButtons } = require('./src/handlers/warranty-renew');
const { getStoreRatingStats, registerReviewHandlers, handleReviewTextInput } = require('./src/handlers/reviews');
const { createWebhookServer } = require('./src/webhook');

// Telegraf options (Proxy support)
const botOptions = {};
if (process.env.TELEGRAM_PROXY) {
  try {
    botOptions.telegram = { agent: new HttpsProxyAgent(process.env.TELEGRAM_PROXY) };
    console.log(`🌐 Using Telegram proxy: ${process.env.TELEGRAM_PROXY}`);
  } catch (pErr) {
    console.error('Proxy config error:', pErr.message);
  }
}

const bot = new Telegraf(config.BOT_TOKEN, botOptions);
registerWarrantyRenewHandlers(bot);
registerReviewHandlers(bot);

// Sync BOT_TOKEN & system config to Firestore so Vercel Admin App can access it automatically
if (config.BOT_TOKEN) {
  const syncData = {
    botToken: config.BOT_TOKEN,
    updatedAt: new Date().toISOString(),
  };
  const channelId = config.REQUIRED_CHANNEL_ID || config.TESTIMONI_CHANNEL_ID || process.env.REQUIRED_CHANNEL_ID || process.env.TESTIMONI_CHANNEL_ID || process.env.CHANNEL_ID;
  if (channelId) syncData.requiredChannelId = channelId;

  db.collection('settings').doc('system').set(syncData, { merge: true }).catch(err => console.error('Failed to sync botToken to Firestore:', err.message));
}

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════

async function getUserLang(userId) {
  try {
    const doc = await db.collection('bot_users').doc(userId.toString()).get();
    return (doc.exists && doc.data().language) ? doc.data().language : 'id';
  } catch { return 'id'; }
}

async function isMaintenanceMode() {
  try {
    const doc = await db.collection('settings').doc('system').get();
    return doc.exists ? (doc.data().maintenanceMode || false) : false;
  } catch { return false; }
}

async function registerUser(ctx) {
  const userId = ctx.from.id.toString();
  const userRef = db.collection('bot_users').doc(userId);
  const doc = await userRef.get();

  if (!doc.exists) {
    await userRef.set({
      firstName: ctx.from.first_name || '',
      lastName: ctx.from.last_name || '',
      username: ctx.from.username || '',
      language: ctx.from.language_code === 'en' ? 'en' : 'id',
      balance: 0,
      role: 'member',
      totalSpent: 0,
      totalOrders: 0,
      createdAt: new Date().toISOString(),
    });
  } else {
    // Update basic info
    await userRef.update({
      firstName: ctx.from.first_name || '',
      username: ctx.from.username || '',
    }).catch(() => { });
  }
}

function getReplyKeyboard(lang) {
  const rows = [];

  rows.push([t(lang, 'menu_products'), t(lang, 'menu_balance')]);
  rows.push([t(lang, 'menu_stock'), t(lang, 'menu_history')]);
  rows.push([t(lang, 'menu_popular'), t(lang, 'menu_help')]);

  return Markup.keyboard(rows).resize();
}

// ═══════════════════════════════════════
// MUST JOIN CHANNEL GATEWAY
// ═══════════════════════════════════════

async function checkChannelSubscription(ctx) {
  const userId = ctx.from?.id;
  if (!userId) return true;

  // Admin bypass
  if (config.ADMIN_ID && userId.toString() === config.ADMIN_ID.toString()) {
    return true;
  }

  let channelId = config.REQUIRED_CHANNEL_ID || config.TESTIMONI_CHANNEL_ID;
  let channelLink = config.REQUIRED_CHANNEL_LINK || config.GROUP_TELEGRAM;

  try {
    const sysDoc = await db.collection('settings').doc('system').get();
    if (sysDoc.exists) {
      const data = sysDoc.data();
      if (data.mustJoinEnabled === false) return true;
      if (data.requiredChannelId) channelId = data.requiredChannelId;
      if (data.requiredChannelLink) channelLink = data.requiredChannelLink;
    }
  } catch (err) { }

  if (!channelId) return true;

  try {
    const member = await ctx.telegram.getChatMember(channelId, userId);
    const validStatuses = ['creator', 'administrator', 'member'];
    if (validStatuses.includes(member.status)) {
      return true;
    }
  } catch (err) {
    if (err.message?.includes('chat not found') || err.message?.includes('bot is not') || err.message?.includes('member list')) {
      return true;
    }
  }

  const targetLink = (channelLink || 'https://t.me').startsWith('http')
    ? channelLink
    : `https://t.me/${channelLink.replace(/^@/, '')}`;

  const gateMsg =
    `<b>📢 WAJIB GABUNG CHANNEL DULU</b>\n` +
    `────────────────────────────\n` +
    `<i>Untuk dapat menggunakan bot dan berbelanja produk digital, Anda diwajibkan bergabung ke Channel Resmi kami terlebih dahulu.</i>\n\n` +
    `👉 <b>Silakan klik tombol di bawah untuk bergabung, lalu tekan "✅ Saya Sudah Gabung":</b>`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.url('📢 Gabung Channel Resmi', targetLink)],
    [Markup.button.callback('✅ Saya Sudah Gabung', 'verify_channel_sub')],
  ]);

  if (ctx.callbackQuery) {
    await ctx.answerCbQuery('⚠️ Anda belum bergabung ke Channel!', { show_alert: true }).catch(() => { });
    await ctx.reply(gateMsg, { parse_mode: 'HTML', ...keyboard }).catch(() => { });
  } else {
    await ctx.reply(gateMsg, { parse_mode: 'HTML', ...keyboard }).catch(() => { });
  }

  return false;
}

async function sendWelcomeMessage(ctx) {
  await registerUser(ctx);
  const userId = ctx.from.id;
  const lang = await getUserLang(userId);

  // Get stats & rating info
  const [userDoc, ratingStats, storeDocSnap] = await Promise.all([
    db.collection('bot_users').doc(userId.toString()).get(),
    getStoreRatingStats(),
    db.collection('settings').doc('store').get().catch(() => null),
  ]);

  const userData = userDoc.data() || {};
  const { dateStr, timeStr } = formatDateID(new Date());

  let storeName = config.STORE_NAME;
  let bannerUrl = config.STORE_BANNER_URL;
  if (storeDocSnap && storeDocSnap.exists) {
    const sData = storeDocSnap.data();
    if (sData.storeName) storeName = sData.storeName;
    if (sData.bannerUrl) bannerUrl = sData.bannerUrl;
  }

  const msg = t(lang, 'welcome', {
    storeName: escapeHTML(storeName),
    name: escapeHTML(ctx.from.first_name || 'User'),
    dateStr,
    timeStr,
    userId: userId.toString(),
    username: escapeHTML(ctx.from.username || '-'),
    totalTransaksi: userData.totalOrders || 0,
    balance: formatIDR(userData.balance || 0),
    ratingAverage: ratingStats.averageRating,
    totalReviews: ratingStats.totalReviews,
    totalSold: ratingStats.totalSold,
    totalUsers: ratingStats.totalUsers,
    topProduct: escapeHTML(ratingStats.topProduct),
  });

  if (bannerUrl) {
    try {
      return await ctx.replyWithPhoto(bannerUrl, {
        caption: msg,
        parse_mode: 'HTML',
        ...getReplyKeyboard(lang),
      });
    } catch (photoErr) {
      console.error('Failed to send banner photo:', photoErr.message);
    }
  }

  await ctx.reply(msg, { parse_mode: 'HTML', ...getReplyKeyboard(lang) });
}

// ═══════════════════════════════════════
// /start
// ═══════════════════════════════════════

bot.start(async (ctx) => {
  try {
    if (!(await checkChannelSubscription(ctx))) return;
    await sendWelcomeMessage(ctx);
  } catch (err) {
    console.error('/start error:', err);
    ctx.reply(t('id', 'error_general'), { parse_mode: 'HTML' });
  }
});

bot.action('verify_channel_sub', async (ctx) => {
  const isJoined = await checkChannelSubscription(ctx);
  if (isJoined) {
    await ctx.answerCbQuery('🎉 Terima kasih! Akses bot berhasil dibuka.', { show_alert: true }).catch(() => { });
    await ctx.deleteMessage().catch(() => { });
    await sendWelcomeMessage(ctx);
  }
});

// ═══════════════════════════════════════
// /admin
// ═══════════════════════════════════════

bot.command('admin', async (ctx) => {
  await showAdminMenu(ctx);
});

// ═══════════════════════════════════════
// /saldo
// ═══════════════════════════════════════

bot.command('saldo', async (ctx) => {
  if (!(await checkChannelSubscription(ctx))) return;
  await showBalanceMenu(ctx);
});

// ═══════════════════════════════════════
// /menu
// ═══════════════════════════════════════

bot.command('menu', async (ctx) => {
  if (!(await checkChannelSubscription(ctx))) return;
  const lang = await getUserLang(ctx.from.id);
  await ctx.reply('<i>Silakan gunakan tombol menu di bawah untuk transaksi:</i>', {
    parse_mode: 'HTML',
    ...getReplyKeyboard(lang),
  });
});

// ═══════════════════════════════════════
// /help & /app
// ═══════════════════════════════════════

bot.command('help', async (ctx) => {
  await showHelpMenu(ctx);
});

bot.command(['app', 'miniapp', 'web'], async (ctx) => {
  return ctx.reply('ℹ️ Fitur Mini App Shop telah dinonaktifkan. Silakan gunakan menu transaksi langsung melalui Bot Telegram.');
});

// ═══════════════════════════════════════
// /stok
// ═══════════════════════════════════════

bot.command('stok', async (ctx) => {
  if (!(await checkChannelSubscription(ctx))) return;
  await showStockStatus(ctx);
});

// ═══════════════════════════════════════
// REPLY KEYBOARD HANDLERS (hears)
// ═══════════════════════════════════════

bot.hears(['🛍️ Katalog Produk', '🛍️ Product Catalog', '🛍 Products', '🛍 Produk', 'Katalog Produk', 'Product Catalog'], async (ctx) => {
  if (!(await checkChannelSubscription(ctx))) return;
  if (await isMaintenanceMode()) return ctx.reply(t('id', 'maintenance'), { parse_mode: 'HTML' });
  await showProductList(ctx);
});

bot.hears(['💳 Saldo Akun', '💳 Account Balance', '💳 Balance:', '💳 Saldo', 'Saldo Akun', 'Account Balance'], async (ctx) => {
  if (!(await checkChannelSubscription(ctx))) return;
  await showBalanceMenu(ctx);
});

bot.hears(['📋 Status Stok', '📋 Stock Status', '📋 Stock', '📋 Stok', 'Status Stok', 'Stock Status'], async (ctx) => {
  if (!(await checkChannelSubscription(ctx))) return;
  await showStockStatus(ctx);
});

bot.hears(['📄 Riwayat Order', '📄 Order History', '📄 History', '📄 Riwayat', 'Riwayat Order', 'Order History'], async (ctx) => {
  if (!(await checkChannelSubscription(ctx))) return;
  await showHistoryMenu(ctx);
});

bot.hears(['⭐ Produk Terlaris', '⭐ Best Sellers', '⭐ Terlaris', 'Produk Terlaris', 'Best Sellers'], async (ctx) => {
  if (!(await checkChannelSubscription(ctx))) return;
  await showPopularProducts(ctx);
});

bot.hears(['💬 Pusat Bantuan', '💬 Support Center', '💬 Help', '💬 Bantuan', 'Pusat Bantuan', 'Support Center'], async (ctx) => {
  await showHelpMenu(ctx);
});

// ═══════════════════════════════════════
// BALANCE MENU
// ═══════════════════════════════════════

async function showBalanceMenu(ctx) {
  const userId = ctx.from.id;
  const lang = await getUserLang(userId);

  const doc = await db.collection('bot_users').doc(userId.toString()).get();
  const balance = doc.exists ? (doc.data().balance || 0) : 0;

  const msg = t(lang, 'balance_title', { balance: formatIDR(balance) });

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('Rp 20.000', 'topup_20000'),
      Markup.button.callback('Rp 50.000', 'topup_50000'),
    ],
    [
      Markup.button.callback('Rp 100.000', 'topup_100000'),
      Markup.button.callback('Rp 250.000', 'topup_250000'),
    ],
    [
      Markup.button.callback('Rp 500.000', 'topup_500000'),
      Markup.button.callback('Rp 1.000.000', 'topup_1000000'),
    ],
  ]);

  if (ctx.updateType === 'callback_query') {
    return ctx.editMessageText(msg, { parse_mode: 'HTML', ...keyboard }).catch(() => {});
  }
  return ctx.reply(msg, { parse_mode: 'HTML', ...keyboard });
}

// ═══════════════════════════════════════
// STOCK STATUS
// ═══════════════════════════════════════

async function showStockStatus(ctx) {
  const lang = await getUserLang(ctx.from.id);

  try {
    const snap = await db.collection('products').orderBy('order', 'asc').get();
    const products = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.isVisible !== false);

    // Calculate accurate stock from credentials_pool or variants
    const poolSnap = await db.collection('credentials_pool').where('isUsed', '==', false).get();
    const stockMap = {};
    poolSnap.forEach(d => {
      const pId = d.data().productId;
      stockMap[pId] = (stockMap[pId] || 0) + 1;
    });

    products.forEach(p => {
      if (!p.requiresEmail) {
        p.stock = stockMap[p.id] || 0;
      } else {
        p.stock = (p.variants || []).reduce((s, v) => s + (Number(v.stock) || 0), 0);
      }
    });

    let msg = t(lang, 'stock_title') + '\n';

    const ready = products.filter(p => (p.stock || 0) > 5);
    const limited = products.filter(p => (p.stock || 0) > 0 && (p.stock || 0) <= 5);
    const empty = products.filter(p => (p.stock || 0) === 0);

    if (ready.length > 0) {
      msg += t(lang, 'stock_ready') + '\n';
      ready.forEach(p => { msg += t(lang, 'stock_item', { icon: '🟢', name: escapeHTML(p.name), stock: p.stock || 0 }) + '\n'; });
    }
    if (limited.length > 0) {
      msg += '\n' + t(lang, 'stock_limited') + '\n';
      limited.forEach(p => { msg += t(lang, 'stock_item', { icon: '🟡', name: escapeHTML(p.name), stock: p.stock || 0 }) + '\n'; });
    }
    if (empty.length > 0) {
      msg += '\n' + t(lang, 'stock_empty') + '\n';
      empty.forEach(p => { msg += t(lang, 'stock_item', { icon: '🔴', name: escapeHTML(p.name), stock: 0 }) + '\n'; });
    }

    const { timeStr } = formatDateID(new Date());
    msg += t(lang, 'stock_update', { time: timeStr });

    return ctx.reply(msg, { parse_mode: 'HTML' });
  } catch (err) {
    console.error('Stock error:', err);
    ctx.reply(t(lang, 'error_general'), { parse_mode: 'HTML' });
  }
}

// ═══════════════════════════════════════
// HISTORY
// ═══════════════════════════════════════

async function showHistoryMenu(ctx) {
  const lang = await getUserLang(ctx.from.id);

  const msg = t(lang, 'history_title');
  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback(`🧾 ${t(lang, 'btn_orders')}`, 'history_orders'),
      Markup.button.callback(`💰 ${t(lang, 'btn_topup')}`, 'history_topup'),
    ],
  ]);

  if (ctx.updateType === 'callback_query') {
    return ctx.editMessageText(msg, { parse_mode: 'HTML', ...keyboard }).catch(() => {});
  }
  return ctx.reply(msg, { parse_mode: 'HTML', ...keyboard });
}

// ═══════════════════════════════════════
// POPULAR PRODUCTS
// ═══════════════════════════════════════

async function showPopularProducts(ctx) {
  const lang = await getUserLang(ctx.from.id);

  try {
    const snap = await db.collection('products').get();
    let products = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.isVisible !== false);

    if (products.length === 0) return ctx.reply(t(lang, 'popular_empty'), { parse_mode: 'HTML' });

    // Sort by totalSold descending
    products.sort((a, b) => (b.totalSold || 0) - (a.totalSold || 0));
    products = products.slice(0, 5);

    let msg = t(lang, 'popular_title') + '\n';
    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

    products.forEach((p, i) => {
      msg += t(lang, 'popular_item', {
        medal: medals[i] || `${i + 1}.`,
        name: escapeHTML(p.name),
        sold: p.totalSold || 0,
      }) + '\n';
    });

    return ctx.reply(msg, { parse_mode: 'HTML' });
  } catch (err) {
    console.error('Popular products error:', err);
    ctx.reply(t(lang, 'popular_empty'), { parse_mode: 'HTML' });
  }
}

// ═══════════════════════════════════════
// HELP MENU
// ═══════════════════════════════════════

async function showHelpMenu(ctx) {
  const lang = await getUserLang(ctx.from.id);

  const msg = t(lang, 'help_title');
  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback(t(lang, 'btn_language'), 'help_language'),
      Markup.button.callback(t(lang, 'btn_chat_admin'), 'help_contact'),
    ],
  ]);

  if (ctx.updateType === 'callback_query') {
    return ctx.editMessageText(msg, { parse_mode: 'HTML', ...keyboard }).catch(() => { });
  }
  return ctx.reply(msg, { parse_mode: 'HTML', ...keyboard });
}

// ═══════════════════════════════════════
// CALLBACK QUERY ROUTER
// ═══════════════════════════════════════

bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data || '';

  // Noop
  if (data === 'noop') return ctx.answerCbQuery().catch(() => { });

  // ─── Products ───
  if (data.startsWith('page_')) {
    const page = parseInt(data.replace('page_', ''));
    return showProductList(ctx, page, true);
  }
  if (data.startsWith('prod_detail_')) {
    return showProductDetail(ctx, data.replace('prod_detail_', ''));
  }
  if (data.startsWith('refresh_product_')) {
    return showProductDetail(ctx, data.replace('refresh_product_', ''));
  }
  if (data === 'back_to_list') {
    return showProductList(ctx, 0, true);
  }

  // ─── Orders ───
  if (data.startsWith('buy_')) {
    const parts = data.replace('buy_', '').split('_');
    const productId = parts.slice(0, -1).join('_');
    const variantIndex = parseInt(parts[parts.length - 1]);
    return showOrderSummary(ctx, productId, variantIndex);
  }

  // ─── Quantity ───
  if (data.startsWith('qty_inc_')) {
    return adjustQuantity(ctx, parseInt(data.replace('qty_inc_', '')));
  }
  if (data.startsWith('qty_dec_')) {
    return adjustQuantity(ctx, -parseInt(data.replace('qty_dec_', '')));
  }

  // ─── Payment ───
  if (data.startsWith('pay_saldo_')) {
    const parts = data.replace('pay_saldo_', '').split('_');
    return handleBalancePayment(ctx, parts[0], parseInt(parts[1]));
  }
  if (data.startsWith('pay_qris2_')) {
    const parts = data.replace('pay_qris2_', '').split('_');
    return handleQRISPayment(ctx, parts[0], parseInt(parts[1]), 'panzzpay');
  }
  if (data.startsWith('pay_qris1_')) {
    const parts = data.replace('pay_qris1_', '').split('_');
    return handleQRISPayment(ctx, parts[0], parseInt(parts[1]), 'ramashop');
  }
  if (data.startsWith('pay_qris_')) {
    const parts = data.replace('pay_qris_', '').split('_');
    return handleQRISPayment(ctx, parts[0], parseInt(parts[1]), 'ramashop');
  }
  if (data.startsWith('check_payment_')) {
    return checkPaymentStatus(ctx, data.replace('check_payment_', ''));
  }
  if (data.startsWith('cancel_order_')) {
    return cancelOrder(ctx, data.replace('cancel_order_', ''));
  }
  if (data === 'cancel_cart') {
    await clearCart(ctx.from.id);
    ctx.answerCbQuery('✕ Dibatalkan.').catch(() => { });
    return ctx.deleteMessage().catch(() => { });
  }

  // ─── Topup ───
  if (data.startsWith('topup_')) {
    const amount = parseInt(data.replace('topup_', ''));
    return handleTopupQRIS(ctx, amount);
  }

  // ─── Voucher ───
  if (data === 'apply_voucher') {
    const { updateSession } = require('./src/session');
    const summaryMsgId = ctx.callbackQuery?.message?.message_id;
    ctx.answerCbQuery().catch(() => { });
    const promptMsg = await ctx.reply('<b>🎟 Kirim Kode Voucher:</b>', { parse_mode: 'HTML' });
    await updateSession(ctx.from.id, {
      awaitingVoucher: true,
      summaryMsgId,
      voucherPromptMsgId: promptMsg?.message_id
    });
    return;
  }

  // ─── History ───
  if (data === 'history_orders') {
    const lang = await getUserLang(ctx.from.id);
    const userId = ctx.from.id.toString();
    const snap = await db.collection('orders')
      .where('telegramUserId', '==', userId)
      .get();

    const docs = snap.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(o => !o.type)
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 5);

    if (docs.length === 0) {
      ctx.answerCbQuery(stripHTMLTags(t(lang, 'history_no_orders')), { show_alert: true }).catch(() => { });
      return;
    }

    let msg = t(lang, 'history_orders_title') + '\n';
    const buttons = [];

    docs.forEach(o => {
      const statusMap = { success: '✅', pending: '⏳', failed: '❌', processing: '⚙️' };
      msg += t(lang, 'history_order_item', {
        product: escapeHTML(o.productName || '-'),
        total: formatIDR(o.totalPrice || 0),
        status: statusMap[o.status] || o.status,
      }) + '\n';
      buttons.push([Markup.button.callback(`📄 Detail: ${o.productName || 'Order'} (#${o.id.slice(-6)})`, `order_detail_${o.id}`)]);
    });

    buttons.push([Markup.button.callback(t(lang, 'btn_back'), 'back_history')]);

    ctx.answerCbQuery().catch(() => { });
    return ctx.editMessageText(msg, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(buttons),
    }).catch(() => { });
  }

  // ─── Order Detail View ───
  if (data.startsWith('order_detail_')) {
    const orderId = data.replace('order_detail_', '');
    ctx.answerCbQuery().catch(() => {});

    try {
      const doc = await db.collection('orders').doc(orderId).get();
      if (!doc.exists) return ctx.reply('❌ Order tidak ditemukan.');
      const order = { id: doc.id, ...doc.data() };

      const warrantyInfo = getWarrantyInfo(order);
      const renewInfo = getRenewInfo(order);

      let msg = `<b>📦 DETAIL PESANAN #${escapeHTML(order.id)}</b>\n`;
      msg += `────────────────────────────\n`;
      msg += `• <b>Produk</b>    : <b>${escapeHTML(order.productName || '-')}</b> (${escapeHTML(order.variantLabel || '-')})\n`;
      msg += `• <b>Total</b>     : <b>${formatIDR(order.totalPrice || 0)}</b> (${order.paymentMethod === 'saldo' ? 'Saldo' : 'QRIS'})\n`;
      msg += `• <b>Status</b>    : <b>${(order.status || 'unknown').toUpperCase()}</b>\n`;

      if (warrantyInfo.hasWarranty) {
        if (warrantyInfo.alreadyClaimed) {
          msg += `• <b>🛡️ Garansi</b> : <b>Sudah Diklaim (1x)</b>\n`;
        } else if (warrantyInfo.isExpired) {
          msg += `• <b>🛡️ Garansi</b> : <b>Expired</b>\n`;
        } else {
          msg += `• <b>🛡️ Garansi</b> : <b>Aktif (${warrantyInfo.remainingStr})</b>\n`;
        }
      }

      if (renewInfo.renewEnabled) {
        if (renewInfo.isMaxReached) {
          msg += `• <b>🔄 Renew</b>   : <b>Selesai (${renewInfo.renewCount}/${renewInfo.maxRenew}x)</b>\n`;
        } else if (renewInfo.isReady) {
          msg += `• <b>🔄 Renew</b>   : <b>Tersedia (${renewInfo.renewCount + 1}/${renewInfo.maxRenew}x)</b>\n`;
        } else {
          msg += `• <b>🔄 Renew</b>   : <b>Tungggu (${renewInfo.waitStr})</b>\n`;
        }
      }

      if (order.credentials) {
        msg += `────────────────────────────\n`;
        msg += `🔑 <b>Detail Akun Terakhir:</b>\n<pre>${escapeHTML(order.credentials)}</pre>\n`;
      }

      const actionButtons = buildOrderActionButtons(order);
      actionButtons.push([Markup.button.callback('⬅️ Kembali ke Riwayat', 'history_orders')]);

      return ctx.editMessageText(msg, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(actionButtons),
      }).catch(() => {});
    } catch (err) {
      console.error('order_detail error:', err);
      return ctx.reply('❌ Gagal memuat detail pesanan.');
    }
  }

  if (data === 'history_topup') {
    const lang = await getUserLang(ctx.from.id);
    const userId = ctx.from.id.toString();
    const snap = await db.collection('orders')
      .where('telegramUserId', '==', userId)
      .get();

    const docs = snap.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(o => o.type === 'topup')
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 5);

    if (docs.length === 0) {
      ctx.answerCbQuery(stripHTMLTags(t(lang, 'history_no_topup')), { show_alert: true }).catch(() => { });
      return;
    }

    let msg = t(lang, 'history_topup_title') + '\n';
    docs.forEach(o => {
      const statusMap = { success: '✅', pending: '⏳', failed: '❌' };
      msg += t(lang, 'history_topup_item', {
        amount: formatIDR(o.totalPrice || 0),
        status: statusMap[o.status] || o.status,
        date: o.createdAt ? o.createdAt.substring(0, 10) : '-',
      }) + '\n';
    });

    ctx.answerCbQuery().catch(() => { });
    return ctx.editMessageText(msg, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([[Markup.button.callback(t(lang, 'btn_back'), 'back_history')]]),
    }).catch(() => { });
  }

  if (data === 'back_history') {
    return showHistoryMenu(ctx);
  }

  // ─── Help ───
  if (data === 'help_language') {
    const lang = await getUserLang(ctx.from.id);
    ctx.answerCbQuery().catch(() => { });
    return ctx.editMessageText(t(lang, 'help_lang_title'), {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('🇮🇩 Indonesia', 'set_lang_id'),
          Markup.button.callback('🇬🇧 English', 'set_lang_en'),
        ],
        [Markup.button.callback(t(lang, 'btn_back'), 'back_help')],
      ]),
    }).catch(() => { });
  }

  if (data === 'set_lang_id' || data === 'set_lang_en') {
    const newLang = data === 'set_lang_id' ? 'id' : 'en';
    await db.collection('bot_users').doc(ctx.from.id.toString()).update({ language: newLang });
    ctx.answerCbQuery(stripHTMLTags(t(newLang, 'lang_changed'))).catch(() => { });

    // Update keyboard
    ctx.reply(t(newLang, 'lang_changed'), { parse_mode: 'HTML', ...getReplyKeyboard(newLang) });
    return;
  }

  if (data === 'help_contact') {
    const lang = await getUserLang(ctx.from.id);
    ctx.answerCbQuery().catch(() => { });

    const buttons = [];
    if (config.CONTACT_WHATSAPP) {
      buttons.push([Markup.button.url('💬 WhatsApp CS', `https://wa.me/${config.CONTACT_WHATSAPP}`)]);
    }
    if (config.CONTACT_TELEGRAM) {
      buttons.push([Markup.button.url('📱 Telegram CS', `https://t.me/${config.CONTACT_TELEGRAM}`)]);
    }
    if (config.GROUP_TELEGRAM) {
      buttons.push([Markup.button.url('👥 Group Diskusi', config.GROUP_TELEGRAM)]);
    }
    buttons.push([Markup.button.callback(t(lang, 'btn_back'), 'back_help')]);

    return ctx.editMessageText(t(lang, 'help_contact_title'), {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(buttons),
    }).catch(() => { });
  }

  if (data === 'back_help') {
    return showHelpMenu(ctx);
  }

  // ─── Admin approve/reject ───
  if (data.startsWith('approve_')) {
    return handleApproveOrder(ctx, data.replace('approve_', ''));
  }
  if (data.startsWith('reject_')) {
    return handleRejectOrder(ctx, data.replace('reject_', ''));
  }

  // ─── Admin Panel ───
  if (data.startsWith('admin_') || data === 'admin_main') {
    return handleAdminAction(ctx);
  }
  if (data.startsWith('adm_')) {
    return handleAdmAction(ctx);
  }

  // ─── TMail ───
  if (data.startsWith('tmail_')) {
    return handleTMailAction(ctx);
  }

  // ─── Ping admin ───
  if (data.startsWith('ping_admin_')) {
    const orderId = data.replace('ping_admin_', '');
    ctx.answerCbQuery('📤 Pengingat terkirim!').catch(() => { });
    bot.telegram.sendMessage(config.ADMIN_ID,
      `🔔 Member <b>${escapeHTML(ctx.from.first_name)}</b> mengingatkan order <code>${escapeHTML(orderId)}</code>`,
      { parse_mode: 'HTML' }
    ).catch(() => { });
    return;
  }

  // ─── Email Invite Actions ───
  if (data.startsWith('input_invite_email_')) {
    const orderId = data.replace('input_invite_email_', '');
    const { updateSession } = require('./src/session');

    const promptMsg = await ctx.reply('📧 <b>Silakan kirim email yang ingin diinvite:</b>', { parse_mode: 'HTML' }).catch(() => { });

    await updateSession(ctx.from.id, {
      inviteState: 'WAITING_INVITE_EMAIL',
      inviteOrderId: orderId,
      invitePromptMsgId: promptMsg?.message_id,
    });
    return ctx.answerCbQuery().catch(() => { });
  }

  if (data.startsWith('invite_done_')) {
    const orderId = data.replace('invite_done_', '');
    const isAdmin = ctx.from.id.toString() === config.ADMIN_ID.toString();
    if (!isAdmin) return ctx.answerCbQuery('❌ Hanya admin yang dapat mengakses ini.').catch(() => { });

    const orderRef = db.collection('orders').doc(orderId);
    const orderDoc = await orderRef.get();
    if (!orderDoc.exists) return ctx.answerCbQuery('Order tidak ditemukan.').catch(() => { });

    const orderData = orderDoc.data();

    let warrantyDays = Number(orderData.warrantyDays || 0);
    let renewEnabled = Boolean(orderData.renewEnabled);
    let maxRenew = Number(orderData.maxRenew || 1);
    let renewDelayDays = Number(orderData.renewDelayDays || 0);

    if (orderData.productId && (!orderData.deliveredAt || !orderData.warrantyDays)) {
      try {
        const pDoc = await db.collection('products').doc(orderData.productId).get();
        if (pDoc.exists) {
          const pData = pDoc.data();
          const variant = (pData.variants || []).find(v => v.label === orderData.variantLabel) || pData.variants?.[0];
          if (variant) {
            warrantyDays = Number(variant.warrantyDays || 0);
            renewEnabled = Boolean(variant.renewEnabled);
            maxRenew = Number(variant.maxRenew || 1);
            renewDelayDays = Number(variant.renewDelayDays || 0);
          }
        }
      } catch (e) {}
    }

    const deliveredAt = new Date().toISOString();

    await orderRef.update({
      inviteStatus: 'done',
      status: 'success',
      deliveredAt,
      warrantyDays,
      renewEnabled,
      maxRenew,
      renewDelayDays,
      renewCount: orderData.renewCount || 0,
    });

    ctx.answerCbQuery('✅ Status Invite diubah ke Done!').catch(() => { });

    const updatedOwnerMsg =
      `✅ <b>EMAIL INVITE PROSES SELESAI</b>\n` +
      `────────────────────────────\n` +
      `🆔 <b>Order ID</b> : <code>#${escapeHTML(orderId)}</code>\n` +
      `📦 <b>Produk</b>   : <b>${escapeHTML(orderData.productName || 'Produk')}</b> (${escapeHTML(orderData.variantLabel || '-')})\n` +
      `👤 <b>User</b>     : <b>${escapeHTML(orderData.customerName || 'Customer')}</b>\n` +
      `📧 <b>Email</b>    : <code>${escapeHTML(orderData.inviteEmail || '-')}</code>\n\n` +
      `Status : ✅ <b>Done (Selesai)</b>`;

    await ctx.editMessageText(updatedOwnerMsg, { parse_mode: 'HTML' }).catch(() => { });

    if (orderData.telegramUserId && orderData.telegramUserId !== 'guest') {
      const updatedOrder = {
        ...orderData,
        id: orderId,
        status: 'success',
        deliveredAt,
        warrantyDays,
        renewEnabled,
        maxRenew,
        renewDelayDays,
        renewCount: orderData.renewCount || 0,
      };

      const actionButtons = buildOrderActionButtons(updatedOrder);
      let replyOptions = { parse_mode: 'HTML' };
      if (actionButtons.length > 0) {
        replyOptions = { parse_mode: 'HTML', ...Markup.inlineKeyboard(actionButtons) };
      }

      const customerMsg =
        `✅ <b>INVITE BERHASIL!</b>\n` +
        `────────────────────────────\n` +
        `📦 <b>Produk</b> : <b>${escapeHTML(orderData.productName || 'Produk')}</b> (${escapeHTML(orderData.variantLabel || '-')})\n` +
        `📧 <b>Email</b>  : <code>${escapeHTML(orderData.inviteEmail || '-')}</code>\n\n` +
        `🎉 <i>Invite telah berhasil dikirim! Silakan cek email atau akun Anda.</i>`;

      if (orderData.customerMsgId) {
        await bot.telegram.editMessageText(orderData.telegramUserId, orderData.customerMsgId, null, customerMsg, replyOptions).catch(() => {
          bot.telegram.sendMessage(orderData.telegramUserId, customerMsg, replyOptions).catch(() => { });
        });
      } else {
        await bot.telegram.sendMessage(orderData.telegramUserId, customerMsg, replyOptions).catch(() => { });
      }

      // Send Rating & Review prompt to user
      try {
        const { sendRatingPrompt } = require('./src/handlers/reviews');
        await sendRatingPrompt(bot, orderData.telegramUserId, orderId);
      } catch (rErr) {
        console.error('Error sending rating prompt for invite:', rErr.message);
      }
    }

    // Generate & send Nota PNG image to Testimoni Channel & Customer
    const { sendNotaAndTestimoni } = require('./src/fulfillment');
    await sendNotaAndTestimoni(orderId, orderData).catch(err => console.error('Error sending nota for invite product:', err));

    return;
  }

  if (data.startsWith('reinvite_email_')) {
    const orderId = data.replace('reinvite_email_', '');
    const isAdmin = ctx.from.id.toString() === config.ADMIN_ID.toString();
    if (!isAdmin) return ctx.answerCbQuery('❌ Hanya admin.').catch(() => { });

    const orderRef = db.collection('orders').doc(orderId);
    const orderDoc = await orderRef.get();
    if (!orderDoc.exists) return ctx.answerCbQuery('Order tidak ditemukan.').catch(() => { });

    const orderData = orderDoc.data();
    await orderRef.update({
      inviteStatus: 'waiting_email_input',
      updatedAt: new Date().toISOString(),
    });

    ctx.answerCbQuery('🔄 Permintaan pengisian ulang email terkirim!').catch(() => { });

    const updatedOwnerMsg =
      `🔄 <b>MINTA REVISI EMAIL TERKIRIM</b>\n` +
      `────────────────────────────\n` +
      `🆔 <b>Order ID</b> : <code>#${escapeHTML(orderId)}</code>\n` +
      `📦 <b>Produk</b>   : <b>${escapeHTML(orderData.productName || 'Produk')}</b> (${escapeHTML(orderData.variantLabel || '-')})\n` +
      `📧 <b>Email Lama</b>: <code>${escapeHTML(orderData.inviteEmail || '-')}</code>\n\n` +
      `Status : ⏳ <b>Menunggu Customer Memasukkan Email Baru</b>`;

    await ctx.editMessageText(updatedOwnerMsg, { parse_mode: 'HTML' }).catch(() => { });

    if (orderData.telegramUserId && orderData.telegramUserId !== 'guest') {
      const customerMsg =
        `⚠️ <b>EMAIL TIDAK VALID / GAGAL DI-INVITE</b>\n` +
        `────────────────────────────\n` +
        `• <b>Order ID</b> : <code>#${escapeHTML(orderId)}</code>\n` +
        `• <b>Produk</b>   : <b>${escapeHTML(orderData.productName || 'Produk')}</b> (${escapeHTML(orderData.variantLabel || '-')})\n` +
        `• <b>Email Lama</b> : <code>${escapeHTML(orderData.inviteEmail || '-')}</code> (Tidak valid / salah)\n\n` +
        `<i>Admin meminta Anda untuk memasukkan email baru yang benar. Silakan klik tombol <b>"✏️ Input Email Baru"</b> di bawah:</i>`;

      const customerKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback('✏️ Input Email Baru', `input_invite_email_${orderId}`)],
      ]);

      if (orderData.customerMsgId) {
        await bot.telegram.editMessageText(orderData.telegramUserId, orderData.customerMsgId, null, customerMsg, { parse_mode: 'HTML', ...customerKeyboard }).catch(() => {
          bot.telegram.sendMessage(orderData.telegramUserId, customerMsg, { parse_mode: 'HTML', ...customerKeyboard }).catch(() => { });
        });
      } else {
        await bot.telegram.sendMessage(orderData.telegramUserId, customerMsg, { parse_mode: 'HTML', ...customerKeyboard }).catch(() => { });
      }
    }
    return;
  }

  if (data.startsWith('invite_cancel_')) {
    const orderId = data.replace('invite_cancel_', '');
    const isAdmin = ctx.from.id.toString() === config.ADMIN_ID.toString();
    if (!isAdmin) return ctx.answerCbQuery('❌ Hanya admin.').catch(() => { });

    const orderDoc = await db.collection('orders').doc(orderId).get();
    const orderData = orderDoc.exists ? orderDoc.data() : {};

    ctx.answerCbQuery().catch(() => { });
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Minta Kirim Ulang Email', `reinvite_email_${orderId}`)],
      [Markup.button.callback('📦 Stok Habis', `cancel_reason_${orderId}_Stok habis`)],
      [Markup.button.callback('✏️ Tulis Alasan Custom', `cancel_reason_${orderId}_custom`)],
    ]);

    const promptCancelText =
      `❓ <b>PILIH ALASAN PEMBATALAN (#${escapeHTML(orderId)})</b>\n` +
      `────────────────────────────\n` +
      `📦 <b>Produk</b> : <b>${escapeHTML(orderData.productName || 'Produk')}</b> (${escapeHTML(orderData.variantLabel || '-')})\n` +
      `📧 <b>Email</b>  : <code>${escapeHTML(orderData.inviteEmail || '-')}</code>\n\n` +
      `<i>Silakan pilih tindakan / alasan pembatalan di bawah:</i>`;

    return ctx.editMessageText(promptCancelText, { parse_mode: 'HTML', ...keyboard }).catch(() => { });
  }

  if (data.startsWith('cancel_reason_')) {
    const raw = data.replace('cancel_reason_', '');
    const firstUnderscore = raw.indexOf('_');
    const orderId = raw.substring(0, firstUnderscore);
    const reasonType = raw.substring(firstUnderscore + 1);

    const isAdmin = ctx.from.id.toString() === config.ADMIN_ID.toString();
    if (!isAdmin) return ctx.answerCbQuery().catch(() => { });

    if (reasonType === 'custom') {
      const { updateSession } = require('./src/session');
      await updateSession(ctx.from.id, {
        inviteState: 'WAITING_CANCEL_REASON',
        cancelOrderId: orderId,
        cancelOwnerMsgId: ctx.callbackQuery?.message?.message_id,
      });
      ctx.answerCbQuery().catch(() => { });
      return ctx.editMessageText(
        `✏️ <b>SILAKAN KETIK ALASAN PEMBATALAN</b>\n` +
        `────────────────────────────\n` +
        `🆔 <b>Order ID</b> : <code>#${escapeHTML(orderId)}</code>\n\n` +
        `<i>Ketik alasan pembatalan di kolom chat di bawah ini...</i>`,
        { parse_mode: 'HTML' }
      ).catch(() => { });
    }

    return processCancelInvite(ctx, orderId, reasonType);
  }

  ctx.answerCbQuery().catch(() => { });
});

async function processCancelInvite(ctx, orderId, reason, ownerMsgIdOverride = null) {
  const orderRef = db.collection('orders').doc(orderId);
  const orderDoc = await orderRef.get();
  if (!orderDoc.exists) return;

  const orderData = orderDoc.data();
  await orderRef.update({
    inviteStatus: 'cancelled',
    status: 'cancelled',
    cancelReason: reason,
  });

  const updatedOwnerMsg =
    `❌ <b>EMAIL INVITE DIBATALKAN</b>\n` +
    `────────────────────────────\n` +
    `🆔 <b>Order ID</b> : <code>#${escapeHTML(orderId)}</code>\n` +
    `📦 <b>Produk</b>   : <b>${escapeHTML(orderData.productName || 'Produk')}</b> (${escapeHTML(orderData.variantLabel || '-')})\n` +
    `👤 <b>User</b>     : <b>${escapeHTML(orderData.customerName || 'Customer')}</b>\n` +
    `📧 <b>Email</b>    : <code>${escapeHTML(orderData.inviteEmail || '-')}</code>\n` +
    `💬 <b>Alasan</b>   : <i>${escapeHTML(reason)}</i>\n\n` +
    `Status : ❌ <b>Cancelled (Dibatalkan)</b>`;

  if (ctx && ctx.editMessageText) {
    await ctx.editMessageText(updatedOwnerMsg, { parse_mode: 'HTML' }).catch(async () => {
      await ctx.reply(updatedOwnerMsg, { parse_mode: 'HTML' }).catch(() => { });
    });
  } else if (ownerMsgIdOverride) {
    await bot.telegram.editMessageText(config.ADMIN_ID, ownerMsgIdOverride, null, updatedOwnerMsg, { parse_mode: 'HTML' }).catch(async () => {
      await bot.telegram.sendMessage(config.ADMIN_ID, updatedOwnerMsg, { parse_mode: 'HTML' }).catch(() => { });
    });
  } else if (orderData.ownerMsgId) {
    await bot.telegram.editMessageText(config.ADMIN_ID, orderData.ownerMsgId, null, updatedOwnerMsg, { parse_mode: 'HTML' }).catch(async () => {
      await bot.telegram.sendMessage(config.ADMIN_ID, updatedOwnerMsg, { parse_mode: 'HTML' }).catch(() => { });
    });
  }

  if (orderData.telegramUserId && orderData.telegramUserId !== 'guest') {
    const customerMsg =
      `❌ <b>INVITE DIBATALKAN</b>\n` +
      `────────────────────────────\n` +
      `📦 <b>Produk</b> : <b>${escapeHTML(orderData.productName || 'Produk')}</b> (${escapeHTML(orderData.variantLabel || '-')})\n` +
      `📧 <b>Email</b>  : <code>${escapeHTML(orderData.inviteEmail || '-')}</code>\n\n` +
      `<b>Alasan Pembatalan:</b>\n` +
      `<i>${escapeHTML(reason)}</i>\n\n` +
      `Silakan hubungi admin jika ada pertanyaan.`;

    if (orderData.customerMsgId) {
      await bot.telegram.editMessageText(orderData.telegramUserId, orderData.customerMsgId, null, customerMsg, { parse_mode: 'HTML' }).catch(() => {
        bot.telegram.sendMessage(orderData.telegramUserId, customerMsg, { parse_mode: 'HTML' }).catch(() => { });
      });
    } else {
      await bot.telegram.sendMessage(orderData.telegramUserId, customerMsg, { parse_mode: 'HTML' }).catch(() => { });
    }
  }
}

// ═══════════════════════════════════════
// TEXT MESSAGE HANDLER
// ═══════════════════════════════════════
bot.on('text', async (ctx) => {
  // Skip commands
  if (ctx.message.text.startsWith('/')) return;

  // Maintenance check
  if (await isMaintenanceMode()) {
    const isAdmin = ctx.from.id.toString() === config.ADMIN_ID.toString();
    if (!isAdmin) return ctx.reply(t('id', 'maintenance'), { parse_mode: 'HTML' });
  }

  // Check if admin text flow
  const adminHandled = await handleAdminText(ctx);
  if (adminHandled) return;

  const { getSession, updateSession } = require('./src/session');
  const session = await getSession(ctx.from.id);

  // 1. Email Invite submission by customer
  if (session.inviteState === 'WAITING_INVITE_EMAIL' && session.inviteOrderId) {
    const emailText = ctx.message.text.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Delete customer text input and prompt message to keep chat clean
    ctx.deleteMessage().catch(() => { });
    if (session.invitePromptMsgId) {
      ctx.telegram.deleteMessage(ctx.chat.id, session.invitePromptMsgId).catch(() => { });
    }

    if (!emailRegex.test(emailText)) {
      const errPrompt = await ctx.reply('❌ <b>Format email tidak valid.</b>\nSilakan masukkan email yang benar (contoh: <code>user@gmail.com</code>):', { parse_mode: 'HTML' }).catch(() => { });
      await updateSession(ctx.from.id, { invitePromptMsgId: errPrompt?.message_id });
      return;
    }

    const orderId = session.inviteOrderId;
    await updateSession(ctx.from.id, { inviteState: null, inviteOrderId: null, invitePromptMsgId: null });

    // Update Firestore Order
    await db.collection('orders').doc(orderId).update({
      inviteEmail: emailText,
      inviteStatus: 'pending',
      updatedAt: new Date().toISOString(),
    }).catch(() => { });

    const orderDoc = await db.collection('orders').doc(orderId).get();
    const orderData = orderDoc.exists ? orderDoc.data() : {};

    // Edit Customer's Payment Card Message in-place with button to Edit Email anytime
    const customerUpdatedMsg =
      `✅ <b>PEMBAYARAN BERHASIL!</b>\n` +
      `────────────────────────────\n` +
      `• <b>Order ID</b> : <code>#${escapeHTML(orderId)}</code>\n` +
      `• <b>Produk</b>   : <b>${escapeHTML(orderData.productName || 'Produk')}</b> (${escapeHTML(orderData.variantLabel || '-')})\n` +
      `• <b>Email Invite</b> : <code>${escapeHTML(emailText)}</code>\n\n` +
      `⏳ <i>Permintaan invite sedang diproses oleh admin. Mohon tunggu beberapa saat.</i>`;

    const customerKeyboard = Markup.inlineKeyboard([
      [Markup.button.callback('✏️ Edit Email', `input_invite_email_${orderId}`)],
    ]);

    if (orderData.customerMsgId) {
      await ctx.telegram.editMessageText(ctx.chat.id, orderData.customerMsgId, null, customerUpdatedMsg, { parse_mode: 'HTML', ...customerKeyboard }).catch(async () => {
        await ctx.reply(customerUpdatedMsg, { parse_mode: 'HTML', ...customerKeyboard }).catch(() => { });
      });
    } else {
      await ctx.reply(customerUpdatedMsg, { parse_mode: 'HTML', ...customerKeyboard }).catch(() => { });
    }

    // Notify Owner (Admin)
    if (config.ADMIN_ID) {
      const userTag = ctx.from.username ? `@${ctx.from.username}` : (ctx.from.first_name || 'Customer');
      const ownerMsg =
        `🔔 <b>EMAIL INVITE BARU</b>\n` +
        `────────────────────────────\n` +
        `🆔 <b>Order ID</b> : <code>#${escapeHTML(orderId)}</code>\n` +
        `📦 <b>Produk</b>   : <b>${escapeHTML(orderData.productName || 'Produk')}</b> (${escapeHTML(orderData.variantLabel || '-')})\n` +
        `👤 <b>User</b>     : <b>${escapeHTML(userTag)}</b>\n` +
        `📧 <b>Email</b>    : <code>${escapeHTML(emailText)}</code>\n\n` +
        `Status : ⏳ <b>Pending</b>`;

      const ownerKeyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Done', `invite_done_${orderId}`),
          Markup.button.callback('🔄 Minta Email Ulang', `reinvite_email_${orderId}`),
          Markup.button.callback('❌ Cancel', `invite_cancel_${orderId}`),
        ],
      ]);

      const sentOwnerMsg = await bot.telegram.sendMessage(config.ADMIN_ID, ownerMsg, { parse_mode: 'HTML', ...ownerKeyboard }).catch(() => { });
      if (sentOwnerMsg?.message_id) {
        await db.collection('orders').doc(orderId).update({ ownerMsgId: sentOwnerMsg.message_id }).catch(() => { });
      }
    }
    return;
  }
  // 1. Email Invite submission by customer
  if (session.inviteState === 'WAITING_INVITE_EMAIL' && session.inviteOrderId) {
    const emailText = ctx.message.text.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Delete customer text input and prompt message to keep chat clean
    ctx.deleteMessage().catch(() => { });
    if (session.invitePromptMsgId) {
      ctx.telegram.deleteMessage(ctx.chat.id, session.invitePromptMsgId).catch(() => { });
    }

    if (!emailRegex.test(emailText)) {
      const errPrompt = await ctx.reply('❌ <b>Format email tidak valid.</b>\nSilakan masukkan email yang benar (contoh: <code>user@gmail.com</code>):', { parse_mode: 'HTML' }).catch(() => { });
      await updateSession(ctx.from.id, { invitePromptMsgId: errPrompt?.message_id });
      return;
    }

    const orderId = session.inviteOrderId;
    await updateSession(ctx.from.id, { inviteState: null, inviteOrderId: null, invitePromptMsgId: null });

    // Update Firestore Order
    await db.collection('orders').doc(orderId).update({
      inviteEmail: emailText,
      inviteStatus: 'pending',
      updatedAt: new Date().toISOString(),
    }).catch(() => { });

    const orderDoc = await db.collection('orders').doc(orderId).get();
    const orderData = orderDoc.exists ? orderDoc.data() : {};

    // Edit Customer's Payment Card Message in-place if customerMsgId exists
    const customerUpdatedMsg =
      `✅ <b>PEMBAYARAN BERHASIL!</b>\n` +
      `────────────────────────────\n` +
      `• <b>Order ID</b> : <code>#${escapeHTML(orderId)}</code>\n` +
      `• <b>Produk</b>   : <b>${escapeHTML(orderData.productName || 'Produk')}</b> (${escapeHTML(orderData.variantLabel || '-')})\n` +
      `• <b>Email Invite</b> : <code>${escapeHTML(emailText)}</code>\n\n` +
      `⏳ <i>Permintaan invite sedang diproses oleh admin. Mohon tunggu beberapa saat.</i>`;

    if (orderData.customerMsgId) {
      await ctx.telegram.editMessageText(ctx.chat.id, orderData.customerMsgId, null, customerUpdatedMsg, { parse_mode: 'HTML' }).catch(async () => {
        await ctx.reply(customerUpdatedMsg, { parse_mode: 'HTML' }).catch(() => { });
      });
    } else {
      await ctx.reply(customerUpdatedMsg, { parse_mode: 'HTML' }).catch(() => { });
    }

    // Notify Owner (Admin)
    if (config.ADMIN_ID) {
      const userTag = ctx.from.username ? `@${ctx.from.username}` : (ctx.from.first_name || 'Customer');
      const ownerMsg =
        `🔔 <b>EMAIL INVITE BARU</b>\n` +
        `────────────────────────────\n` +
        `🆔 <b>Order ID</b> : <code>#${escapeHTML(orderId)}</code>\n` +
        `📦 <b>Produk</b>   : <b>${escapeHTML(orderData.productName || 'Produk')}</b> (${escapeHTML(orderData.variantLabel || '-')})\n` +
        `👤 <b>User</b>     : <b>${escapeHTML(userTag)}</b>\n` +
        `📧 <b>Email</b>    : <code>${escapeHTML(emailText)}</code>\n\n` +
        `Status : ⏳ <b>Pending</b>`;

      const ownerKeyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Done', `invite_done_${orderId}`),
          Markup.button.callback('❌ Cancel', `invite_cancel_${orderId}`),
        ],
      ]);

      const sentOwnerMsg = await bot.telegram.sendMessage(config.ADMIN_ID, ownerMsg, { parse_mode: 'HTML', ...ownerKeyboard }).catch(() => { });
      if (sentOwnerMsg?.message_id) {
        await db.collection('orders').doc(orderId).update({ ownerMsgId: sentOwnerMsg.message_id }).catch(() => { });
      }
    }
    return;
  }

  // 2. Custom cancellation reason input by admin
  if (session.inviteState === 'WAITING_CANCEL_REASON' && session.cancelOrderId) {
    const reason = ctx.message.text.trim();
    const orderId = session.cancelOrderId;
    const ownerMsgId = session.cancelOwnerMsgId;

    // Delete admin's typed text message to keep chat clean
    ctx.deleteMessage().catch(() => { });

    await updateSession(ctx.from.id, { inviteState: null, cancelOrderId: null, cancelOwnerMsgId: null });
    await processCancelInvite(ctx, orderId, reason, ownerMsgId);
    return;
  }

  // 3. User review comment text input
  if (session.awaitingReviewOrderId) {
    await handleReviewTextInput(ctx, session);
    return;
  }

  // Check voucher input
  if (session.awaitingVoucher && session.cart) {
    const code = ctx.message.text.trim();

    // Clean up user text message and prompt message
    ctx.deleteMessage().catch(() => { });
    if (session.voucherPromptMsgId) {
      ctx.telegram.deleteMessage(ctx.chat.id, session.voucherPromptMsgId).catch(() => { });
    }

    const { applyVoucher } = require('./src/pricing');
    const result = await applyVoucher(code, session.cart.total, session.cart.productId);

    if (!result.valid) {
      const lang = await getUserLang(ctx.from.id);
      let errMsg = t(lang, 'voucher_invalid');
      if (result.reason === 'min_purchase') {
        errMsg = t(lang, 'voucher_min_purchase', { min: formatIDR(result.minPurchase) });
      }
      return ctx.reply(`❌ ${errMsg}`, { parse_mode: 'HTML' });
    }

    // Apply voucher to cart
    session.cart.voucherCode = result.code;
    session.cart.voucherDiscount = result.discount;
    session.cart.voucherId = result.voucherId;
    session.cart.total = result.finalPrice;
    session.awaitingVoucher = false;

    await updateSession(ctx.from.id, session);

    const lang = await getUserLang(ctx.from.id);
    const { renderOrderSummary } = require('./src/handlers/orders');

    // Edit existing order summary message in-place without creating a new message
    if (session.summaryMsgId) {
      try {
        const fakeCtx = {
          ...ctx,
          editMessageText: (text, extra) => ctx.telegram.editMessageText(ctx.chat.id, session.summaryMsgId, null, text, extra)
        };
        return await renderOrderSummary(fakeCtx, session.cart, lang, true);
      } catch (e) {
        console.error('Error editing summary message:', e);
      }
    }

    return renderOrderSummary(ctx, session.cart, lang, false);
  }
});

// ═══════════════════════════════════════
// DOCUMENT HANDLER (stock upload)
// ═══════════════════════════════════════

bot.on('document', async (ctx) => {
  await handleAdminDocument(ctx);
});

// ═══════════════════════════════════════
// PHOTO HANDLER (store logo upload)
// ═══════════════════════════════════════

bot.on('photo', async (ctx) => {
  const isAdmin = ctx.from.id.toString() === config.ADMIN_ID.toString();
  if (!isAdmin) return;

  const session = await (async () => {
    const doc = await db.collection('admin_sessions').doc(ctx.from.id.toString()).get();
    return doc.exists ? doc.data() : {};
  })();

  if (session.state === 'nota_upload_logo') {
    try {
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      const fileLink = await ctx.telegram.getFileLink(photo.file_id);

      await db.collection('settings').doc('store').set({
        storeLogoUrl: fileLink.href,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      await db.collection('admin_sessions').doc(ctx.from.id.toString()).delete().catch(() => { });
      return ctx.reply('✅ Logo toko berhasil diupdate!');
    } catch (err) {
      console.error('Logo upload error:', err);
      return ctx.reply('❌ Gagal upload logo.');
    }
  }
});

// ═══════════════════════════════════════
// ERROR HANDLER
// ═══════════════════════════════════════

bot.catch((err, ctx) => {
  console.error(`[Bot Error] ${ctx.updateType}:`, err);
});

// ═══════════════════════════════════════
// LAUNCH
// ═══════════════════════════════════════

async function launch() {
  console.log(`\n╔══════════════════════════════════════╗`);
  console.log(`║  ${config.STORE_NAME} — Auto Order Bot`);
  console.log(`║  Modern HTML Premium Layout`);
  console.log(`╚══════════════════════════════════════╝\n`);

  const activeUrl = process.env.SERVER_URL || process.env.WEBHOOK_BASE_URL || config.WEBHOOK_BASE_URL;
  if (!activeUrl || !activeUrl.startsWith('https://')) {
    console.log(`⚠️  [MINI APP STATUS] SERVER_URL saat ini: "${activeUrl || 'KOSONG'}"`);
    console.log(`⚠️  Telegram WAJIB HTTPS (cth: https://domain-kamu.com) agar Mini App bisa aktif.`);
    console.log(`👉  Atur SERVER_URL=https://domain-kamu.com pada file .env di Panel Pterodactyl.\n`);
  } else {
    console.log(`📱 [MINI APP STATUS] Aktif di: ${activeUrl}/app\n`);
  }

  // Start webhook server
  const app = createWebhookServer(bot);
  app.listen(config.PORT, () => {
    console.log(`🌐 Webhook server on port ${config.PORT}`);
  });

  // Auto clean expired stock on startup & every 30 minutes
  const { cleanExpiredStock } = require('./src/stock-cleaner');
  cleanExpiredStock().catch(() => { });
  setInterval(() => {
    cleanExpiredStock().catch(() => { });
  }, 30 * 60 * 1000);

  // Start bot polling with retry
  let retries = 5;
  while (retries > 0) {
    try {
      await bot.launch();
      console.log('🤖 Bot started (polling mode)');
      break;
    } catch (err) {
      retries--;
      console.error(`⚠️ Connection to Telegram API failed (${err.code || err.message}). Retrying in 5 seconds... (${retries} retries left)`);
      if (retries === 0) throw err;
      await delay(5000);
    }
  }

  // Graceful shutdown
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

launch().catch(err => {
  console.error('Launch error:', err);
  process.exit(1);
});