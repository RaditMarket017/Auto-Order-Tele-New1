const { Markup } = require('telegraf');
const { db } = require('../firebase');
const config = require('../config');
const { formatIDR, escapeHTML, isValidTelegramUrl, stripHTMLTags } = require('../helpers');
const { t } = require('../i18n');
const ExcelJS = require('exceljs');

// ═══════════════════════════════════════
// ADMIN CHECK
// ═══════════════════════════════════════

async function checkIsAdmin(userId) {
  if (!userId) return false;
  if (userId.toString() === config.ADMIN_ID.toString()) return true;
  try {
    const doc = await db.collection('bot_users').doc(userId.toString()).get();
    return doc.exists && doc.data().role === 'admin';
  } catch { return false; }
}

// ═══════════════════════════════════════
// SESSION (Firestore-backed)
// ═══════════════════════════════════════

async function getAdminSession(adminId) {
  const doc = await db.collection('admin_sessions').doc(adminId.toString()).get();
  if (!doc.exists) return { state: null, data: {} };
  return { state: doc.data().state || null, data: doc.data().data || {} };
}

async function updateAdminSession(adminId, update) {
  await db.collection('admin_sessions').doc(adminId.toString()).set(update, { merge: true });
}

async function clearAdminSession(adminId) {
  await db.collection('admin_sessions').doc(adminId.toString()).delete().catch(() => {});
}

// ═══════════════════════════════════════
// MAIN ADMIN MENU
// ═══════════════════════════════════════

async function showAdminMenu(ctx) {
  const isAdmin = await checkIsAdmin(ctx.from.id);
  if (!isAdmin) return ctx.reply(t('id', 'admin_not_authorized'), { parse_mode: 'HTML' });

  await clearAdminSession(ctx.from.id);

  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    const [ordersSnap, usersCountSnap, productsSnap] = await Promise.all([
      db.collection('orders').where('createdAt', '>=', startOfDay).get(),
      db.collection('bot_users').count().get(),
      db.collection('products').get(),
    ]);

    let dailyRevenue = 0, dailyOrders = 0;
    ordersSnap.forEach(doc => {
      const o = doc.data();
      if (['success', 'paid'].includes(o.status)) {
        dailyRevenue += (o.totalPrice || 0);
        dailyOrders++;
      }
    });

    const totalUsers = usersCountSnap.data().count;
    const totalProducts = productsSnap.size;

    const msg = t('id', 'admin_title', {
      revenue: formatIDR(dailyRevenue),
      orders: dailyOrders,
      users: totalUsers,
      products: totalProducts,
    });

    const buttons = [];

    // Telegram Inline Button logic (WebApp for HTTPS, URL Button for HTTP IP/Domain)
    const activeUrl = process.env.SERVER_URL || process.env.WEBHOOK_BASE_URL || config.WEBHOOK_BASE_URL;
    const userId = ctx.from?.id || '';
    let extraLinkText = '';

    if (activeUrl && activeUrl.startsWith('https://')) {
      // Direct Telegram Mini App popup button
      const webAppUrl = `${activeUrl.replace(/\/$/, '')}/admin?user_id=${userId}`;
      buttons.push([Markup.button.webApp('🖥️ Open Web Admin Mini App', webAppUrl)]);
    } else if (activeUrl && isValidTelegramUrl(activeUrl)) {
      // Real Inline URL button for Public IP / HTTP domain
      const targetUrl = `${activeUrl.replace(/\/$/, '')}/admin?user_id=${userId}`;
      buttons.push([Markup.button.url('🖥️ Open Web Admin Mini App', targetUrl)]);
    } else {
      // Fallback for internal container hostnames (e.g. ramaagnnz:1086) or localhost
      const displayUrl = (activeUrl && !activeUrl.includes('localhost'))
        ? `${activeUrl.replace(/\/$/, '')}/admin?user_id=${userId}`
        : `http://localhost:3001/admin?user_id=${userId}`;
      extraLinkText = `\n\n🖥️ <b>Web Admin Dashboard (Browser):</b>\n<code>${displayUrl}</code>`;
    }

    buttons.push([Markup.button.callback('📢 Broadcast', 'admin_broadcast'), Markup.button.callback('📧 TMail', 'tmail_menu')]);
    buttons.push([Markup.button.callback('📦 Produk', 'admin_products'), Markup.button.callback('👤 Users', 'admin_users')]);
    buttons.push([Markup.button.callback('📊 Reports', 'admin_reports'), Markup.button.callback('🎟 Voucher', 'admin_voucher')]);
    buttons.push([Markup.button.callback('🧾 Nota', 'admin_nota'), Markup.button.callback('⚙ Config', 'admin_config')]);
    buttons.push([Markup.button.callback('↻ Refresh', 'admin_main')]);

    const keyboard = Markup.inlineKeyboard(buttons);
    const finalMsg = msg + extraLinkText;

    if (ctx.updateType === 'callback_query') {
      return ctx.editMessageText(finalMsg, { parse_mode: 'HTML', ...keyboard }).catch(() => {});
    }
    return ctx.reply(finalMsg, { parse_mode: 'HTML', ...keyboard });
  } catch (err) {
    console.error('Admin Dashboard Error:', err);
    ctx.reply('❌ Gagal memuat admin dashboard.');
  }
}

// ═══════════════════════════════════════
// ADMIN ACTION ROUTER
// ═══════════════════════════════════════

async function handleAdminAction(ctx) {
  const isAdmin = await checkIsAdmin(ctx.from.id);
  if (!isAdmin) return ctx.answerCbQuery(stripHTMLTags(t('id', 'admin_not_authorized')), { show_alert: true }).catch(() => {});

  const action = ctx.match?.[0] || ctx.callbackQuery?.data || '';

  // ─── Main ───
  if (action === 'admin_main') return showAdminMenu(ctx);

  // ─── Products ───
  if (action === 'admin_products') return showProductsMenu(ctx);
  if (action === 'admin_add_product') return startAddProduct(ctx);
  if (action === 'admin_list_products') return listProducts(ctx);
  if (action.startsWith('admin_edit_')) return showEditProduct(ctx, action.replace('admin_edit_', ''));
  if (action.startsWith('admin_del_')) return deleteProduct(ctx, action.replace('admin_del_', ''));
  if (action.startsWith('admin_toggle_')) return toggleProduct(ctx, action.replace('admin_toggle_', ''));

  // ─── Stock ───
  if (action === 'admin_manage_stock') return showStockMenu(ctx);
  if (action.startsWith('admin_stock_')) return showStockForProduct(ctx, action.replace('admin_stock_', ''));

  // ─── Voucher ───
  if (action === 'admin_voucher') return showVoucherMenu(ctx);
  if (action === 'admin_add_voucher') return startAddVoucher(ctx);
  if (action === 'admin_list_vouchers') return listVouchers(ctx);
  if (action.startsWith('admin_del_voucher_')) return deleteVoucher(ctx, action.replace('admin_del_voucher_', ''));

  // ─── Broadcast ───
  if (action === 'admin_broadcast') return startBroadcast(ctx);

  // ─── Users ───
  if (action === 'admin_users') return showUsersMenu(ctx);
  if (action.startsWith('admin_user_')) return showUserDetail(ctx, action.replace('admin_user_', ''));
  if (action.startsWith('admin_addbal_')) return startAddBalance(ctx, action.replace('admin_addbal_', ''));

  // ─── Reports ───
  if (action === 'admin_reports') return showReports(ctx);

  // ─── Nota Settings ───
  if (action === 'admin_nota') return showNotaSettings(ctx);

  // ─── Config ───
  if (action === 'admin_config') return showConfigMenu(ctx);
  if (action === 'admin_maintenance_on') return toggleMaintenance(ctx, true);
  if (action === 'admin_maintenance_off') return toggleMaintenance(ctx, false);

  ctx.answerCbQuery().catch(() => {});
}

// ═══════════════════════════════════════
// PRODUCTS MANAGEMENT
// ═══════════════════════════════════════

async function showProductsMenu(ctx) {
  const msg = '<b>📦 MANAJEMEN PRODUK</b>\n────────────────────────────';
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('➕ Tambah Produk', 'admin_add_product')],
    [Markup.button.callback('📋 Lihat Semua', 'admin_list_products')],
    [Markup.button.callback('📦 Kelola Stok', 'admin_manage_stock')],
    [Markup.button.callback(t('id', 'btn_back'), 'admin_main')],
  ]);
  ctx.answerCbQuery().catch(() => {});
  return ctx.editMessageText(msg, { parse_mode: 'HTML', ...keyboard }).catch(() => {});
}

async function startAddProduct(ctx) {
  await updateAdminSession(ctx.from.id, { state: 'add_product_name', data: {} });
  ctx.answerCbQuery().catch(() => {});
  return ctx.editMessageText(
    '<b>➕ TAMBAH PRODUK</b>\n────────────────────────────\n\nKirim <b>nama produk</b>:',
    { parse_mode: 'HTML' }
  ).catch(() => {});
}

async function listProducts(ctx) {
  const snap = await db.collection('products').orderBy('order', 'asc').get();
  if (snap.empty) {
    const msg = '📋 <i>Belum ada produk.</i>';
    const kb = Markup.inlineKeyboard([[Markup.button.callback(t('id', 'btn_back'), 'admin_products')]]);
    return ctx.editMessageText(msg, { parse_mode: 'HTML', ...kb }).catch(() => {});
  }

  const poolSnap = await db.collection('credentials_pool').where('isUsed', '==', false).get();
  const stockMap = {};
  poolSnap.forEach(d => {
    const pId = d.data().productId;
    stockMap[pId] = (stockMap[pId] || 0) + 1;
  });

  let msg = '<b>📋 DAFTAR PRODUK</b>\n────────────────────────────\n\n';
  const buttons = [];

  snap.docs.forEach((doc, i) => {
    const p = doc.data();
    const isReqEmail = Boolean(p.requiresEmail || (p.variants || []).some(v => v.inviteEnabled));
    const stock = isReqEmail
      ? (p.variants || []).reduce((s, v) => s + (Number(v.stock) || 0), 0)
      : (stockMap[doc.id] || 0);
    msg += `<b>${i + 1}. ${escapeHTML(p.name).toUpperCase()}</b> - (<b>${stock}</b> stok)\n`;
    buttons.push([
      Markup.button.callback(`✏ ${p.name}`, `admin_edit_${doc.id}`),
      Markup.button.callback(`🗑`, `admin_del_${doc.id}`),
      Markup.button.callback(p.isVisible !== false ? '👁' : '👁‍🗨', `admin_toggle_${doc.id}`),
    ]);
  });

  buttons.push([Markup.button.callback(t('id', 'btn_back'), 'admin_products')]);
  ctx.answerCbQuery().catch(() => {});
  return ctx.editMessageText(msg, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) }).catch(() => {});
}

async function showEditProduct(ctx, productId) {
  const doc = await db.collection('products').doc(productId).get();
  if (!doc.exists) return ctx.answerCbQuery('Produk tidak ditemukan.', { show_alert: true });

  const p = doc.data();

  // Query pool for accurate stock count per variant
  const poolSnap = await db.collection('credentials_pool')
    .where('productId', '==', productId)
    .where('isUsed', '==', false)
    .get();

  const stockByVariant = {};
  poolSnap.forEach(d => {
    const data = d.data();
    const vl = data.variantLabel || 'Default';
    stockByVariant[vl] = (stockByVariant[vl] || 0) + 1;
  });

  const isReqEmail = Boolean(p.requiresEmail || (p.variants || []).some(v => v.inviteEnabled));
  const totalStock = isReqEmail
    ? (p.variants || []).reduce((s, v) => s + (Number(v.stock) || 0), 0)
    : (poolSnap.size || p.stock || 0);

  let msg = `<b>✏ EDIT: ${escapeHTML(p.name)}</b>\n────────────────────────────\n\n`;
  msg += `• <b>Harga Base</b>: ${formatIDR(p.basePrice || 0)}\n`;
  msg += `• <b>Total Stok</b>: <b>${totalStock}</b> pcs\n`;
  msg += `• <b>Delivery</b>: ${p.deliveryType || 'instant'}\n`;
  msg += `• <b>APK Name</b>: ${escapeHTML(p.apkName || '-')}\n`;
  msg += `• <b>APK Logo</b>: ${p.apkLogoUrl ? 'Set ✅' : 'Belum ❌'}\n\n`;
  msg += `<b>👇 Varian & Stok:</b>\n`;
  (p.variants || []).forEach(v => {
    const vStock = (p.requiresEmail || v.inviteEnabled)
      ? Number(v.stock || 0)
      : (stockByVariant[v.label] ?? v.stock ?? 0);
    msg += `• ${escapeHTML(v.label)} — ${formatIDR(v.price)} (Stok: <b>${vStock}</b> pcs)\n`;
  });

  const buttons = [
    [Markup.button.callback('📝 Edit Nama', `adm_editname_${productId}`)],
    [Markup.button.callback('💲 Edit Harga', `adm_editprice_${productId}`)],
    [Markup.button.callback('📝 Edit Deskripsi', `adm_editdesc_${productId}`)],
    [Markup.button.callback('🖼 Set Logo APK', `adm_editapk_${productId}`)],
    [Markup.button.callback('📦 Upload Stok (.txt)', `admin_stock_${productId}`)],
  ];

  const activeUrl = process.env.SERVER_URL || process.env.WEBHOOK_BASE_URL || config.WEBHOOK_BASE_URL;
  if (activeUrl && activeUrl.startsWith('https://')) {
    const webAppUrl = `${activeUrl.replace(/\/$/, '')}/admin?user_id=${ctx.from.id}&secret=${config.ADMIN_SECRET}`;
    buttons.push([Markup.button.webApp('🌐 Edit di Web App (Full Control)', webAppUrl)]);
  }

  buttons.push([Markup.button.callback(t('id', 'btn_back'), 'admin_list_products')]);

  const keyboard = Markup.inlineKeyboard(buttons);

  ctx.answerCbQuery().catch(() => {});
  return ctx.editMessageText(msg, { parse_mode: 'HTML', ...keyboard }).catch(() => {});
}

async function deleteProduct(ctx, productId) {
  await db.collection('products').doc(productId).delete();
  ctx.answerCbQuery('🗑 Produk dihapus.').catch(() => {});
  return listProducts(ctx);
}

async function toggleProduct(ctx, productId) {
  const doc = await db.collection('products').doc(productId).get();
  if (!doc.exists) return;
  const current = doc.data().isVisible !== false;
  await db.collection('products').doc(productId).update({ isVisible: !current });
  ctx.answerCbQuery(`Produk ${!current ? 'ditampilkan' : 'disembunyikan'}.`).catch(() => {});
  return listProducts(ctx);
}

// ═══════════════════════════════════════
// STOCK MANAGEMENT
// ═══════════════════════════════════════
const { cleanExpiredStock, clearStockForProduct } = require('../stock-cleaner');

async function showStockMenu(ctx) {
  await cleanExpiredStock();

  const snap = await db.collection('products').orderBy('order', 'asc').get();
  let msg = '<b>📦 KELOLA STOK PRODUK</b>\n────────────────────────────\n\n';
  const buttons = [];

  snap.docs.forEach(doc => {
    const p = doc.data();
    const stock = (p.variants || []).reduce((s, v) => s + (v.stock || 0), 0) || p.stock || 0;
    msg += `• ${escapeHTML(p.name)}: <b>${stock}</b> pcs\n`;
    buttons.push([Markup.button.callback(`📦 ${p.name}`, `admin_stock_${doc.id}`)]);
  });

  buttons.push([Markup.button.callback('🧹 Bersihkan Stok Kadaluarsa', 'adm_clean_expired_all')]);
  buttons.push([Markup.button.callback(t('id', 'btn_back'), 'admin_products')]);
  ctx.answerCbQuery().catch(() => {});
  return ctx.editMessageText(msg, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) }).catch(() => {});
}

async function showStockForProduct(ctx, productId) {
  await cleanExpiredStock(productId);

  const doc = await db.collection('products').doc(productId).get();
  if (!doc.exists) return;

  const p = doc.data();

  const poolSnap = await db.collection('credentials_pool')
    .where('productId', '==', productId)
    .where('isUsed', '==', false)
    .get();

  const stockByVariant = {};
  let expiredCount = 0;
  const now = new Date();

  poolSnap.forEach(d => {
    const data = d.data();
    const vl = data.variantLabel || 'Default';
    stockByVariant[vl] = (stockByVariant[vl] || 0) + 1;
    if (data.expiredAt && new Date(data.expiredAt) <= now) {
      expiredCount++;
    }
  });

  let msg = `<b>📦 STOK: ${escapeHTML(p.name)}</b>\n────────────────────────────\n\n`;

  (p.variants || []).forEach(v => {
    const vStock = stockByVariant[v.label] ?? v.stock ?? 0;
    msg += `• ${escapeHTML(v.label)}: <b>${vStock}</b> pcs ready\n`;
  });

  if (expiredCount > 0) {
    msg += `\n⚠️ <i>Ada <b>${expiredCount}</b> akun kadaluarsa yang dibersihkan.</i>\n`;
  }

  msg += '\n<i>Kirim file <b>.txt</b> untuk tambah stok (1 akun per baris).</i>';

  await updateAdminSession(ctx.from.id, {
    state: 'waiting_stock_file',
    data: { productId, productName: p.name },
  });

  const buttons = [
    [Markup.button.callback('📅 Set Tanggal Expired Stok', `adm_set_exp_${productId}`)],
    [Markup.button.callback('🗑 Clear Semua Stok Produk', `adm_clear_stock_${productId}`)],
    [Markup.button.callback(t('id', 'btn_back'), 'admin_manage_stock')],
  ];

  ctx.answerCbQuery().catch(() => {});
  return ctx.editMessageText(msg, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) }).catch(() => {});
}

// ═══════════════════════════════════════
// VOUCHER MANAGEMENT
// ═══════════════════════════════════════

async function showVoucherMenu(ctx) {
  const snap = await db.collection('vouchers').where('isActive', '==', true).get();
  const msg = `<b>🎟 MANAJEMEN VOUCHER PROMO</b>\n────────────────────────────\n\n• Voucher Aktif: <b>${snap.size}</b>`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('➕ Buat Voucher', 'admin_add_voucher')],
    [Markup.button.callback('📋 Lihat Semua', 'admin_list_vouchers')],
    [Markup.button.callback(t('id', 'btn_back'), 'admin_main')],
  ]);

  ctx.answerCbQuery().catch(() => {});
  return ctx.editMessageText(msg, { parse_mode: 'HTML', ...keyboard }).catch(() => {});
}

async function startAddVoucher(ctx) {
  await updateAdminSession(ctx.from.id, { state: 'add_voucher_code', data: {} });
  ctx.answerCbQuery().catch(() => {});
  return ctx.editMessageText(
    '<b>🎟 BUAT VOUCHER PROMO</b>\n────────────────────────────\n\nKirim <b>kode voucher</b> (contoh: <code>DISKON50</code>):',
    { parse_mode: 'HTML' }
  ).catch(() => {});
}

async function listVouchers(ctx) {
  const snap = await db.collection('vouchers').get();
  if (snap.empty) {
    return ctx.editMessageText('📋 <i>Belum ada voucher.</i>', {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([[Markup.button.callback(t('id', 'btn_back'), 'admin_voucher')]]),
    }).catch(() => {});
  }

  let msg = '<b>🎟 DAFTAR VOUCHER PROMO</b>\n────────────────────────────\n\n';
  const buttons = [];

  snap.docs.forEach(doc => {
    const v = doc.data();
    const active = v.isActive ? '🟢' : '🔴';
    const val = v.type === 'percentage' ? `${v.value}%` : formatIDR(v.value);
    msg += `${active} <code>${escapeHTML(v.code)}</code> — ${val} (${v.currentUses || 0}/${v.maxUses || '∞'})\n`;
    buttons.push([Markup.button.callback(`🗑 ${v.code}`, `admin_del_voucher_${doc.id}`)]);
  });

  buttons.push([Markup.button.callback(t('id', 'btn_back'), 'admin_voucher')]);
  ctx.answerCbQuery().catch(() => {});
  return ctx.editMessageText(msg, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) }).catch(() => {});
}

async function deleteVoucher(ctx, voucherId) {
  await db.collection('vouchers').doc(voucherId).delete();
  ctx.answerCbQuery('🗑 Voucher dihapus.').catch(() => {});
  return listVouchers(ctx);
}

// ═══════════════════════════════════════
// BROADCAST
// ═══════════════════════════════════════

async function startBroadcast(ctx) {
  await updateAdminSession(ctx.from.id, { state: 'broadcast_message', data: {} });
  ctx.answerCbQuery().catch(() => {});
  return ctx.editMessageText(
    '<b>📢 BROADCAST PESAN & MEDIA</b>\n────────────────────────────\n\nKirim pesan (Teks, Foto, Video, Gambar, Dokumen, dll) yang ingin di-broadcast ke seluruh member:',
    { parse_mode: 'HTML' }
  ).catch(() => {});
}

// ═══════════════════════════════════════
// USER MANAGEMENT
// ═══════════════════════════════════════

async function showUsersMenu(ctx) {
  const countSnap = await db.collection('bot_users').count().get();
  const msg = `<b>👤 MANAJEMEN MEMBER</b>\n────────────────────────────\n\n• Total Member: <b>${countSnap.data().count}</b> akun\n\nKirim <b>Telegram ID</b> member untuk detail:`;

  await updateAdminSession(ctx.from.id, { state: 'search_user', data: {} });

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback(t('id', 'btn_back'), 'admin_main')],
  ]);

  ctx.answerCbQuery().catch(() => {});
  return ctx.editMessageText(msg, { parse_mode: 'HTML', ...keyboard }).catch(() => {});
}

async function showUserDetail(ctx, userId) {
  const doc = await db.collection('bot_users').doc(userId).get();
  if (!doc.exists) return ctx.answerCbQuery('User tidak ditemukan.', { show_alert: true });

  const u = doc.data();
  const msg =
    `<b>👤 DETAIL MEMBER</b>\n────────────────────────────\n\n` +
    `• <b>ID</b>       : <code>${escapeHTML(userId)}</code>\n` +
    `• <b>Nama</b>     : <b>${escapeHTML(u.firstName || '-')}</b>\n` +
    `• <b>Username</b> : @${escapeHTML(u.username || '-')}\n` +
    `• <b>Role</b>     : <b>${u.role || 'member'}</b>\n` +
    `• <b>Saldo</b>    : <b>${formatIDR(u.balance || 0)}</b>\n` +
    `• <b>Joined</b>   : ${u.createdAt || '-'}`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('💰 Tambah Saldo', `admin_addbal_${userId}`)],
    [Markup.button.callback(t('id', 'btn_back'), 'admin_users')],
  ]);

  ctx.answerCbQuery().catch(() => {});
  return ctx.editMessageText(msg, { parse_mode: 'HTML', ...keyboard }).catch(() => {});
}

async function startAddBalance(ctx, userId) {
  await updateAdminSession(ctx.from.id, {
    state: 'add_balance_amount',
    data: { targetUserId: userId },
  });
  ctx.answerCbQuery().catch(() => {});
  return ctx.editMessageText(
    `<b>💰 TAMBAH SALDO MEMBER</b>\n────────────────────────────\n\nUser ID: <code>${escapeHTML(userId)}</code>\n\nKirim <b>jumlah nominal</b> (angka saja):`,
    { parse_mode: 'HTML' }
  ).catch(() => {});
}

// ═══════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════

async function showReports(ctx) {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const ordersSnap = await db.collection('orders')
      .where('createdAt', '>=', startOfMonth)
      .where('status', 'in', ['success', 'paid'])
      .get();

    let monthlyRevenue = 0, monthlyOrders = 0;
    ordersSnap.forEach(doc => {
      const o = doc.data();
      if (o.type !== 'topup') {
        monthlyRevenue += (o.totalPrice || 0);
        monthlyOrders++;
      }
    });

    const msg =
      `<b>📊 LAPORAN BULAN INI</b>\n────────────────────────────\n\n` +
      `• <b>Total Revenue</b>: <b>${formatIDR(monthlyRevenue)}</b>\n` +
      `• <b>Total Orders</b> : <b>${monthlyOrders}</b> transaksi`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback(t('id', 'btn_back'), 'admin_main')],
    ]);

    ctx.answerCbQuery().catch(() => {});
    return ctx.editMessageText(msg, { parse_mode: 'HTML', ...keyboard }).catch(() => {});
  } catch (err) {
    console.error('showReports error:', err);
  }
}

// ═══════════════════════════════════════
// NOTA SETTINGS
// ═══════════════════════════════════════

async function showNotaSettings(ctx) {
  const doc = await db.collection('settings').doc('store').get();
  const s = doc.exists ? doc.data() : {};

  const msg =
    `<b>🧾 PENGATURAN NOTA TESTIMONI</b>\n────────────────────────────\n\n` +
    `• <b>Nama Toko</b>: <b>${escapeHTML(s.storeName || config.STORE_NAME)}</b>\n` +
    `• <b>Logo Toko</b>: ${s.storeLogoUrl ? '✅ Set' : '❌ Belum'}\n` +
    `• <b>Channel</b>  : <code>${config.TESTIMONI_CHANNEL_ID || 'Belum set'}</code>\n\n` +
    `<i>Kirim foto/gambar logo untuk memperbarui logo toko di nota.</i>`;

  await updateAdminSession(ctx.from.id, { state: 'nota_upload_logo', data: {} });

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('✏ Edit Nama Toko', 'adm_edit_storename')],
    [Markup.button.callback('👁 Preview Nota', 'adm_preview_nota')],
    [Markup.button.callback(t('id', 'btn_back'), 'admin_main')],
  ]);

  ctx.answerCbQuery().catch(() => {});
  return ctx.editMessageText(msg, { parse_mode: 'HTML', ...keyboard }).catch(() => {});
}

// ═══════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════

async function showConfigMenu(ctx) {
  const doc = await db.collection('settings').doc('system').get();
  const s = doc.exists ? doc.data() : {};
  const isMaint = s.maintenanceMode || false;

  const msg =
    `<b>⚙ KONFIGURASI SISTEM</b>\n────────────────────────────\n\n` +
    `• <b>Maintenance</b>: <b>${isMaint ? '🔴 AKTIF' : '🟢 NON-AKTIF'}</b>\n` +
    `• <b>Store Name</b>  : <b>${escapeHTML(s.storeName || config.STORE_NAME)}</b>`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback(
      isMaint ? '🟢 Matikan Maintenance' : '🔴 Aktifkan Maintenance',
      isMaint ? 'admin_maintenance_off' : 'admin_maintenance_on'
    )],
    [Markup.button.callback(t('id', 'btn_back'), 'admin_main')],
  ]);

  ctx.answerCbQuery().catch(() => {});
  return ctx.editMessageText(msg, { parse_mode: 'HTML', ...keyboard }).catch(() => {});
}

async function toggleMaintenance(ctx, enable) {
  await db.collection('settings').doc('system').set({ maintenanceMode: enable }, { merge: true });
  ctx.answerCbQuery(`Maintenance ${enable ? 'ON' : 'OFF'}`).catch(() => {});
  return showConfigMenu(ctx);
}

// ═══════════════════════════════════════
// TEXT INPUT HANDLER
// ═══════════════════════════════════════

async function handleAdminText(ctx) {
  const isAdmin = await checkIsAdmin(ctx.from.id);
  if (!isAdmin) return false;

  const session = await getAdminSession(ctx.from.id);
  if (!session.state) return false;

  // ─── Broadcast (Supports Text, Photo, Video, Document, Voice, Forwarded Messages) ───
  if (session.state === 'broadcast_message') {
    const usersSnap = await db.collection('bot_users').get();
    let sent = 0, failed = 0;

    const bot = ctx.telegram;
    for (const doc of usersSnap.docs) {
      try {
        await bot.copyMessage(doc.id, ctx.chat.id, ctx.message.message_id);
        sent++;
        await new Promise(r => setTimeout(r, 40));
      } catch { failed++; }
    }

    await clearAdminSession(ctx.from.id);
    return ctx.reply(`<b>📢 BROADCAST SELESAI</b>\n────────────────────────────\n\n✅ Terkirim: <b>${sent}</b> member\n❌ Gagal: <b>${failed}</b>`, { parse_mode: 'HTML' }) && true;
  }

  const text = (ctx.message?.text || ctx.message?.caption || '').trim();
  if (!text) return false;

  // ─── Add Product Flow ───
  if (session.state === 'add_product_name') {
    await updateAdminSession(ctx.from.id, {
      state: 'add_product_desc',
      data: { ...session.data, name: text },
    });
    return ctx.reply('Kirim <b>deskripsi produk</b>:', { parse_mode: 'HTML' }) && true;
  }

  if (session.state === 'add_product_desc') {
    await updateAdminSession(ctx.from.id, {
      state: 'add_product_price',
      data: { ...session.data, description: text },
    });
    return ctx.reply('Kirim <b>harga produk</b> (angka saja):', { parse_mode: 'HTML' }) && true;
  }

  if (session.state === 'add_product_price') {
    const price = parseInt(text.replace(/\D/g, ''));
    if (isNaN(price) || price <= 0) {
      return ctx.reply('❌ Harga harus berupa angka valid.') && true;
    }

    await updateAdminSession(ctx.from.id, {
      state: 'add_product_delivery',
      data: { ...session.data, basePrice: price },
    });

    return ctx.reply('Pilih tipe pengiriman produk:', {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('⚡ Instant (Otomatis dari Stok)', 'adm_delivery_instant')],
        [Markup.button.callback('👨‍💻 Manual (Proses Admin)', 'adm_delivery_manual')],
      ]),
    }) && true;
  }

  // ─── Add Voucher Flow ───
  if (session.state === 'add_voucher_code') {
    await updateAdminSession(ctx.from.id, {
      state: 'add_voucher_type',
      data: { code: text.toUpperCase() },
    });
    return ctx.reply('Pilih jenis potongan voucher:', {
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📊 Persentase (%)', 'adm_vtype_percentage')],
        [Markup.button.callback('💰 Nominal (Rp)', 'adm_vtype_fixed')],
      ]),
    }) && true;
  }

  if (session.state === 'add_voucher_value') {
    const value = parseInt(text.replace(/\D/g, ''));
    if (isNaN(value) || value <= 0) {
      return ctx.reply('❌ Nilai potongan harus berupa angka valid.') && true;
    }

    await updateAdminSession(ctx.from.id, {
      state: 'add_voucher_maxuses',
      data: { ...session.data, value },
    });
    return ctx.reply('Kirim <b>batas jumlah penggunaan</b>\n(angka, atau "0" untuk tanpa batas):', { parse_mode: 'HTML' }) && true;
  }

  if (session.state === 'add_voucher_maxuses') {
    const maxUses = parseInt(text) || 0;

    const voucherData = {
      code: session.data.code,
      type: session.data.type,
      value: session.data.value,
      maxUses: maxUses || null,
      currentUses: 0,
      minPurchase: 0,
      isActive: true,
      applicableProducts: [],
      createdAt: new Date().toISOString(),
    };

    await db.collection('vouchers').add(voucherData);
    await clearAdminSession(ctx.from.id);

    const valStr = voucherData.type === 'percentage' ? `${voucherData.value}%` : formatIDR(voucherData.value);
    return ctx.reply(
      `<b>✅ VOUCHER PROMO BERHASIL DIBUAT</b>\n────────────────────────────\n\n` +
      `• <b>Kode</b>  : <code>${escapeHTML(voucherData.code)}</code>\n` +
      `• <b>Tipe</b>  : ${voucherData.type}\n` +
      `• <b>Nilai</b> : ${valStr}\n` +
      `• <b>Limit</b> : ${maxUses || '∞'}`,
      { parse_mode: 'HTML' }
    ) && true;
  }

  // ─── Edit Stock Expired Date ───
  if (session.state === 'edit_stock_exp') {
    const { productId } = session.data;
    let expDate = null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(text.trim())) {
      expDate = new Date(text.trim()).toISOString();
    } else if (!isNaN(parseInt(text.trim()))) {
      const d = new Date();
      d.setDate(d.getDate() + parseInt(text.trim()));
      expDate = d.toISOString();
    } else {
      return ctx.reply('❌ Format tanggal salah. Gunakan YYYY-MM-DD (misal: 2026-12-31) atau angka hari (misal: 30).') && true;
    }

    // Update all current unused stock items for this product with this expiration date
    const poolSnap = await db.collection('credentials_pool')
      .where('productId', '==', productId)
      .where('isUsed', '==', false)
      .get();

    if (!poolSnap.empty) {
      const batch = db.batch();
      poolSnap.docs.forEach(doc => {
        batch.update(doc.ref, { expiredAt: expDate });
      });
      await batch.commit();
    }

    await clearAdminSession(ctx.from.id);
    const dateStr = new Date(expDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    return ctx.reply(
      `<b>✅ TANGGAL EXPIRED STOK DIPERBARUI</b>\n────────────────────────────\n\n` +
      `• <b>Total Akun</b>   : <b>${poolSnap.size}</b> pcs\n` +
      `• <b>Kadaluarsa</b> : <b>${dateStr}</b>`,
      { parse_mode: 'HTML' }
    ) && true;
  }

  // ─── Search User ───
  if (session.state === 'search_user') {
    const userId = text.trim();
    const userDoc = await db.collection('bot_users').doc(userId).get();
    if (!userDoc.exists) {
      return ctx.reply('❌ Member ID tidak ditemukan.') && true;
    }

    const u = userDoc.data();
    const msg =
      `<b>👤 DETAIL MEMBER</b>\n────────────────────────────\n\n` +
      `• <b>ID</b>       : <code>${escapeHTML(userId)}</code>\n` +
      `• <b>Nama</b>     : <b>${escapeHTML(u.firstName || '-')}</b>\n` +
      `• <b>Username</b> : @${escapeHTML(u.username || '-')}\n` +
      `• <b>Role</b>     : <b>${u.role || 'member'}</b>\n` +
      `• <b>Saldo</b>    : <b>${formatIDR(u.balance || 0)}</b>`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('💰 Tambah Saldo', `admin_addbal_${userId}`)],
      [Markup.button.callback(t('id', 'btn_back'), 'admin_users')],
    ]);

    await clearAdminSession(ctx.from.id);
    return ctx.reply(msg, { parse_mode: 'HTML', ...keyboard }) && true;
  }

  // ─── Add Balance ───
  if (session.state === 'add_balance_amount') {
    const amount = parseInt(text.replace(/\D/g, ''));
    if (isNaN(amount) || amount <= 0) {
      return ctx.reply('❌ Masukkan angka nominal yang valid.') && true;
    }

    const targetId = session.data.targetUserId;
    const userRef = db.collection('bot_users').doc(targetId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return ctx.reply('❌ Member tidak ditemukan.') && true;

    const currentBalance = userDoc.data().balance || 0;
    await userRef.update({ balance: currentBalance + amount });

    await clearAdminSession(ctx.from.id);
    return ctx.reply(
      `<b>✅ SALDO BERHASIL DITAMBAHKAN</b>\n────────────────────────────\n\n` +
      `• <b>User ID</b>    : <code>${escapeHTML(targetId)}</code>\n` +
      `• <b>Ditambah</b>   : <b>${formatIDR(amount)}</b>\n` +
      `• <b>Saldo Baru</b> : <b>${formatIDR(currentBalance + amount)}</b>`,
      { parse_mode: 'HTML' }
    ) && true;
  }

  return false;
}

// ═══════════════════════════════════════
// DOCUMENT HANDLER (txt file for stock)
// ═══════════════════════════════════════

async function handleAdminDocument(ctx) {
  const isAdmin = await checkIsAdmin(ctx.from.id);
  if (!isAdmin) return false;

  const session = await getAdminSession(ctx.from.id);
  if (session.state !== 'waiting_stock_file') return false;

  const doc = ctx.message?.document;
  if (!doc || !doc.file_name.endsWith('.txt')) {
    return ctx.reply('❌ Harap kirim file berformat <b>.txt</b>.', { parse_mode: 'HTML' }) && true;
  }

  try {
    const fileLink = await ctx.telegram.getFileLink(doc.file_id);
    const axios = require('axios');
    const response = await axios.get(fileLink.href, { responseType: 'text' });
    const lines = response.data.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    if (lines.length === 0) {
      return ctx.reply('❌ File .txt kosong.') && true;
    }

    const { productId, productName } = session.data;

    const productDoc = await db.collection('products').doc(productId).get();
    const product = productDoc.data();
    const variantLabel = product.variants?.[0]?.label || 'Default';

    const batch = db.batch();
    for (const line of lines) {
      const credRef = db.collection('credentials_pool').doc();
      batch.set(credRef, {
        productId,
        variantLabel,
        data: line,
        isUsed: false,
        addedAt: new Date().toISOString(),
      });
    }
    await batch.commit();

    const remainingSnap = await db.collection('credentials_pool')
      .where('productId', '==', productId)
      .where('variantLabel', '==', variantLabel)
      .where('isUsed', '==', false)
      .get();

    const updatedVariants = (product.variants || []).map(v => {
      if (v.label === variantLabel) return { ...v, stock: remainingSnap.size };
      return v;
    });
    const totalStock = updatedVariants.reduce((s, v) => s + (v.stock || 0), 0);
    await db.collection('products').doc(productId).update({
      variants: updatedVariants,
      stock: totalStock,
      updatedAt: new Date().toISOString(),
    });

    await clearAdminSession(ctx.from.id);

    return ctx.reply(
      `<b>✅ STOK BERHASIL DITAMBAHKAN</b>\n────────────────────────────\n\n` +
      `• <b>Produk</b>    : <b>${escapeHTML(productName)}</b>\n` +
      `• <b>Varian</b>    : <b>${escapeHTML(variantLabel)}</b>\n` +
      `• <b>Ditambah</b>  : <b>${lines.length}</b> akun\n` +
      `• <b>Total Stok</b>: <b>${remainingSnap.size}</b> pcs`,
      { parse_mode: 'HTML' }
    ) && true;
  } catch (err) {
    console.error('handleAdminDocument error:', err);
    return ctx.reply('❌ Gagal memproses file stok.') && true;
  }
}

// ═══════════════════════════════════════
// ADM_ CALLBACKS (sub-actions)
// ═══════════════════════════════════════

async function handleAdmAction(ctx) {
  const isAdmin = await checkIsAdmin(ctx.from.id);
  if (!isAdmin) return;

  const action = ctx.match?.[0] || ctx.callbackQuery?.data || '';

  if (action === 'adm_delivery_instant' || action === 'adm_delivery_manual') {
    const session = await getAdminSession(ctx.from.id);
    const deliveryType = action === 'adm_delivery_instant' ? 'instant' : 'manual';

    await updateAdminSession(ctx.from.id, {
      state: 'add_product_reqemail',
      data: { ...session.data, deliveryType },
    });

    ctx.answerCbQuery().catch(() => {});
    return ctx.editMessageText(
      '<b>📧 Butuh Email Customer?</b>\n────────────────────────────\nApakah produk ini membutuhkan input email dari customer untuk proses invite?',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ Ya (Butuh Email)', 'adm_reqemail_yes'),
            Markup.button.callback('❌ Tidak', 'adm_reqemail_no'),
          ],
        ]),
      }
    ).catch(() => {});
  }

  if (action === 'adm_reqemail_yes' || action === 'adm_reqemail_no') {
    const session = await getAdminSession(ctx.from.id);
    const requiresEmail = action === 'adm_reqemail_yes';

    const productsSnap = await db.collection('products').get();
    const order = productsSnap.size + 1;

    const productData = {
      name: session.data.name,
      description: session.data.description,
      basePrice: session.data.basePrice,
      deliveryType: session.data.deliveryType || 'instant',
      variants: [{ label: 'Default', price: session.data.basePrice, stock: 0 }],
      stock: 0,
      requiresEmail,
      order,
      isVisible: true,
      createdAt: new Date().toISOString(),
    };

    await db.collection('products').add(productData);
    await clearAdminSession(ctx.from.id);

    ctx.answerCbQuery('✅ Produk dibuat!').catch(() => {});
    return ctx.editMessageText(
      `<b>✅ PRODUK BERHASIL DIBUAT</b>\n────────────────────────────\n\n` +
      `• <b>Nama</b>         : <b>${escapeHTML(productData.name)}</b>\n` +
      `• <b>Harga</b>        : <b>${formatIDR(productData.basePrice)}</b>\n` +
      `• <b>Delivery</b>     : <b>${productData.deliveryType}</b>\n` +
      `• <b>Butuh Email</b>  : <b>${requiresEmail ? '✅ YA' : '❌ TIDAK'}</b>`,
      { parse_mode: 'HTML' }
    ).catch(() => {});
  }

  if (action === 'adm_vtype_percentage' || action === 'adm_vtype_fixed') {
    const type = action === 'adm_vtype_percentage' ? 'percentage' : 'fixed';
    const session = await getAdminSession(ctx.from.id);
    await updateAdminSession(ctx.from.id, {
      state: 'add_voucher_value',
      data: { ...session.data, type },
    });
    ctx.answerCbQuery().catch(() => {});
    const unit = type === 'percentage' ? '(contoh: 50 untuk 50%)' : '(contoh: 5000 untuk Rp 5.000)';
    return ctx.editMessageText(
      `Kirim <b>nilai potongan voucher</b>\n${unit}:`,
      { parse_mode: 'HTML' }
    ).catch(() => {});
  }

  if (action.startsWith('adm_editname_')) {
    const productId = action.replace('adm_editname_', '');
    await updateAdminSession(ctx.from.id, { state: 'edit_product_name', data: { productId } });
    ctx.answerCbQuery().catch(() => {});
    return ctx.editMessageText('Kirim <b>nama produk baru</b>:', { parse_mode: 'HTML' }).catch(() => {});
  }

  if (action.startsWith('adm_editprice_')) {
    const productId = action.replace('adm_editprice_', '');
    await updateAdminSession(ctx.from.id, { state: 'edit_product_price', data: { productId } });
    ctx.answerCbQuery().catch(() => {});
    return ctx.editMessageText('Kirim <b>harga baru</b> (angka):', { parse_mode: 'HTML' }).catch(() => {});
  }

  if (action.startsWith('adm_editdesc_')) {
    const productId = action.replace('adm_editdesc_', '');
    await updateAdminSession(ctx.from.id, { state: 'edit_product_desc', data: { productId } });
    ctx.answerCbQuery().catch(() => {});
    return ctx.editMessageText('Kirim <b>deskripsi baru</b>:', { parse_mode: 'HTML' }).catch(() => {});
  }

  if (action.startsWith('adm_editapk_')) {
    const productId = action.replace('adm_editapk_', '');
    await updateAdminSession(ctx.from.id, { state: 'edit_apk_logo', data: { productId } });
    ctx.answerCbQuery().catch(() => {});
    return ctx.editMessageText('Kirim <b>URL gambar logo APK</b>:', { parse_mode: 'HTML' }).catch(() => {});
  }

  if (action.startsWith('adm_clear_stock_')) {
    const productId = action.replace('adm_clear_stock_', '');
    const result = await clearStockForProduct(productId);
    ctx.answerCbQuery(`🗑 ${result.deletedCount || 0} stok dibersihkan.`, { show_alert: true }).catch(() => {});
    return showStockForProduct(ctx, productId);
  }

  if (action.startsWith('adm_set_exp_')) {
    const productId = action.replace('adm_set_exp_', '');
    await updateAdminSession(ctx.from.id, { state: 'edit_stock_exp', data: { productId } });
    ctx.answerCbQuery().catch(() => {});
    return ctx.editMessageText(
      `📅 <b>SET TANGGAL EXPIRED STOK</b>\n────────────────────────────\n\n` +
      `Kirim tanggal expired stok dalam format:\n` +
      `• <code>YYYY-MM-DD</code> (contoh: <code>2026-12-31</code>)\n` +
      `• atau Jumlah Hari (contoh: <code>30</code> untuk 30 hari lagi)`,
      { parse_mode: 'HTML' }
    ).catch(() => {});
  }

  if (action === 'adm_clean_expired_all') {
    const result = await cleanExpiredStock();
    ctx.answerCbQuery(`🧹 ${result.cleanedCount} akun kadaluarsa dibersihkan!`, { show_alert: true }).catch(() => {});
    return showStockMenu(ctx);
  }

  if (action === 'adm_edit_storename') {
    await updateAdminSession(ctx.from.id, { state: 'edit_store_name', data: {} });
    ctx.answerCbQuery().catch(() => {});
    return ctx.editMessageText('Kirim <b>nama toko baru</b>:', { parse_mode: 'HTML' }).catch(() => {});
  }

  if (action === 'adm_preview_nota') {
    try {
      ctx.answerCbQuery('⏳ Generating...').catch(() => {});
      const { generateNotaPNG } = require('../nota-generator');

      let storeSettings = {};
      const settingsDoc = await db.collection('settings').doc('store').get();
      if (settingsDoc.exists) storeSettings = settingsDoc.data();
      storeSettings.storeName = storeSettings.storeName || config.STORE_NAME;
      storeSettings.storeLogoUrl = storeSettings.storeLogoUrl || config.STORE_LOGO_URL;

      const notaBuffer = await generateNotaPNG({
        orderId: 'ORD-PREVIEW-001',
        customerName: 'John Doe',
        productName: 'Netflix Premium',
        variantLabel: '1 Bulan',
        quantity: 1,
        unitPrice: 45000,
        totalPrice: 45000,
        paymentMethod: 'qris',
        status: 'success',
        apkName: 'Netflix',
      }, storeSettings);

      return ctx.replyWithPhoto({ source: notaBuffer, filename: 'nota_preview.png' }, {
        caption: '🧾 Preview Nota Testimoni',
      });
    } catch (err) {
      console.error('Preview nota error:', err);
      return ctx.reply('❌ Gagal generate preview.');
    }
  }
}

module.exports = {
  showAdminMenu,
  handleAdminAction,
  handleAdmAction,
  handleAdminText,
  handleAdminDocument,
  clearAdminSession,
};
