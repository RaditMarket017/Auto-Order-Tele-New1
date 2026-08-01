const { Markup } = require('telegraf');
const { db } = require('../firebase');
const config = require('../config');
const { formatIDR, formatDateID, escapeHTML } = require('../helpers');
const { t } = require('../i18n');

// Active sessions for text/photo input
const userWarrantySessions = new Map(); // userId -> { orderId, issueType, photos: [], uploadDeadlineAt }
const adminReplySessions = new Map();   // adminId -> { type: 'renew_creds' | 'renew_cancel' | 'warranty_creds' | 'warranty_reject', orderId }

/**
 * Get Store Settings
 */
async function getStoreSettings() {
  try {
    const doc = await db.collection('settings').doc('store').get();
    if (doc.exists) return doc.data();
  } catch (e) {}
  return {};
}

/**
 * Calculate Warranty Status
 */
function getWarrantyInfo(order) {
  const warrantyDays = Number(order.warrantyDays || 0);
  const warrantyEndDate = order.warrantyEndDate ? new Date(order.warrantyEndDate).getTime() : null;
  const nowMs = Date.now();

  if (warrantyDays <= 0 && !warrantyEndDate) {
    return { hasWarranty: false, isExpired: true, alreadyClaimed: false, remainingStr: 'Tidak ada garansi' };
  }

  // Check if warranty has already been claimed (1x max per order) or expired via photo upload timeout
  const uploadExpired = order.warrantyClaimStatus === 'pending_proof' && order.uploadDeadlineAt && nowMs > new Date(order.uploadDeadlineAt).getTime();
  const alreadyClaimed = Boolean(order.warrantyClaimed) || 
    (Array.isArray(order.warrantyClaims) && order.warrantyClaims.length > 0) || 
    Boolean(order.lastWarrantyStatus) || 
    order.warrantyClaimStatus === 'expired_timeout' ||
    uploadExpired;

  if (alreadyClaimed) {
    const isTimeout = order.warrantyClaimStatus === 'expired_timeout' || uploadExpired;
    const timeoutMsg = order.warrantyTimeoutMessage || 'Garansi sudah hangus karena batas waktu pengiriman bukti telah habis.';
    const customExpiredMsg = order.warrantyExpiredMessage || 'Klaim Garansi Telah Digunakan (1x)';
    return {
      hasWarranty: true,
      alreadyClaimed: true,
      isExpired: false,
      isTimeout,
      remainingStr: isTimeout ? timeoutMsg : customExpiredMsg,
      warrantyDays,
      csMessage: order.warrantyCsMessage || ''
    };
  }

  let expireMs = 0;
  if (warrantyEndDate) {
    expireMs = warrantyEndDate;
  } else {
    const startMs = order.deliveredAt ? new Date(order.deliveredAt).getTime() : new Date(order.createdAt || Date.now()).getTime();
    expireMs = startMs + (warrantyDays * 86400 * 1000);
  }

  if (nowMs >= expireMs) {
    const customExpiredMsg = order.warrantyExpiredMessage || 'Mohon maaf, garansi sudah tidak berlaku.';
    return { hasWarranty: true, alreadyClaimed: false, isExpired: true, remainingStr: customExpiredMsg, warrantyDays, csMessage: order.warrantyCsMessage || '' };
  }

  const diffMs = expireMs - nowMs;
  const diffDays = Math.floor(diffMs / (86400 * 1000));
  const diffHours = Math.floor((diffMs % (86400 * 1000)) / (3600 * 1000));
  const diffMins = Math.floor((diffMs % (3600 * 1000)) / (60 * 1000));

  let timeStr = '';
  if (diffDays > 0) timeStr += `${diffDays} hari `;
  if (diffHours > 0 || diffDays > 0) timeStr += `${diffHours} jam `;
  timeStr += `${diffMins} mnt`;

  return {
    hasWarranty: true,
    alreadyClaimed: false,
    isExpired: false,
    remainingMs: diffMs,
    remainingStr: timeStr.trim(),
    warrantyDays,
  };
}

/**
 * Calculate Renew Status
 */
function getRenewInfo(order) {
  const renewEnabled = Boolean(order.renewEnabled);
  if (!renewEnabled) {
    return { renewEnabled: false, isMaxReached: true, isReady: false };
  }

  const maxRenew = Number(order.maxRenew || 1);
  const renewCount = Number(order.renewCount || 0);

  if (renewCount >= maxRenew) {
    return { renewEnabled: true, isMaxReached: true, isReady: false, renewCount, maxRenew };
  }

  if (order.renewStatus === 'requested') {
    return { renewEnabled: true, isMaxReached: false, isReady: false, isPending: true, waitStr: 'Diproses Admin', renewCount, maxRenew };
  }

  const nowMs = Date.now();
  let nextAvailableMs = 0;
  let targetDateStr = '';

  const scheduleDates = Array.isArray(order.renewScheduleDates) && order.renewScheduleDates.length > 0
    ? order.renewScheduleDates
    : (order.renewStartDate ? [order.renewStartDate] : []);

  if (scheduleDates.length > 0) {
    const rawDateStr = scheduleDates[renewCount] !== undefined ? scheduleDates[renewCount] : scheduleDates[scheduleDates.length - 1];
    if (rawDateStr) {
      targetDateStr = rawDateStr;
      nextAvailableMs = new Date(rawDateStr).getTime();
    }
  }

  if (!nextAvailableMs) {
    const renewDelayDays = Number(order.renewDelayDays || 0);
    const startMs = order.deliveredAt ? new Date(order.deliveredAt).getTime() : new Date(order.createdAt || Date.now()).getTime();
    nextAvailableMs = startMs + ((renewCount + 1) * renewDelayDays * 86400 * 1000);
  }

  const effectiveMaxRenew = scheduleDates.length > 0 ? Math.max(maxRenew, scheduleDates.length) : maxRenew;

  if (nowMs >= nextAvailableMs || !nextAvailableMs) {
    return {
      renewEnabled: true,
      isMaxReached: false,
      isReady: true,
      renewCount,
      maxRenew: effectiveMaxRenew,
    };
  }

  const diffMs = nextAvailableMs - nowMs;
  const diffDays = Math.floor(diffMs / (86400 * 1000));
  const diffHours = Math.floor((diffMs % (86400 * 1000)) / (3600 * 1000));
  const diffMins = Math.floor((diffMs % (3600 * 1000)) / (60 * 1000));

  let waitStr = '';
  if (diffDays > 0) waitStr += `${diffDays} hari `;
  if (diffHours > 0 || diffDays > 0) waitStr += `${diffHours} jam `;
  waitStr += `${diffMins} menit`;

  return {
    renewEnabled: true,
    isMaxReached: false,
    isReady: false,
    nextAvailableMs,
    targetDateStr,
    waitStr: waitStr.trim(),
    renewCount,
    maxRenew: effectiveMaxRenew,
    customNotReadyMessage: order.renewNotReadyMessage || '',
  };
}

/**
 * Build Action Buttons for Completed Order
 */
function buildOrderActionButtons(order) {
  const buttons = [];
  const warrantyInfo = getWarrantyInfo(order);
  const renewInfo = getRenewInfo(order);

  const row = [];
  if (renewInfo.renewEnabled && !renewInfo.isMaxReached && renewInfo.isReady) {
    row.push(Markup.button.callback('🔄 Renew Akun', `user_renew_${order.id}`));
  }
  if (warrantyInfo.hasWarranty && !warrantyInfo.isExpired && !warrantyInfo.alreadyClaimed) {
    row.push(Markup.button.callback('🛡️ Klaim Garansi', `user_warranty_${order.id}`));
  }

  if (row.length > 0) {
    buttons.push(row);
  }

  return buttons;
}

/**
 * Render Detail Order View in-place
 */
async function renderOrderDetail(ctx, orderId) {
  try {
    const doc = await db.collection('orders').doc(orderId).get();
    if (!doc.exists) return safeEditMessage(ctx, '❌ Order tidak ditemukan.');
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
      } else if (renewInfo.isPending) {
        msg += `• <b>🔄 Renew</b>   : <b>Diproses Admin (Tunggu)</b>\n`;
      } else if (renewInfo.isReady) {
        msg += `• <b>🔄 Renew</b>   : <b>Tersedia (${renewInfo.renewCount + 1}/${renewInfo.maxRenew}x)</b>\n`;
      } else {
        msg += `• <b>🔄 Renew</b>   : <b>Tunggu (${renewInfo.waitStr})</b>\n`;
      }
    }

    if (order.credentials) {
      msg += `────────────────────────────\n`;
      msg += `🔑 <b>Detail Akun Terakhir:</b>\n<pre>${escapeHTML(order.credentials)}</pre>\n`;
    }

    const actionButtons = buildOrderActionButtons(order);
    actionButtons.push([Markup.button.callback('⬅️ Kembali ke Riwayat', 'history_orders')]);

    return safeEditMessage(ctx, msg, Markup.inlineKeyboard(actionButtons));
  } catch (err) {
    console.error('renderOrderDetail error:', err);
  }
}

/**
 * Helper to edit message or caption safely for inline callbacks
 */
async function safeEditMessage(ctx, text, extra = {}) {
  if (ctx.callbackQuery?.message?.photo) {
    return ctx.editMessageCaption(text, { parse_mode: 'HTML', ...extra }).catch(() => {
      return ctx.reply(text, { parse_mode: 'HTML', ...extra });
    });
  }
  return ctx.editMessageText(text, { parse_mode: 'HTML', ...extra }).catch(() => {
    return ctx.reply(text, { parse_mode: 'HTML', ...extra });
  });
}

/**
 * Background interval check: if Admin hasn't responded after adminProcessBusyTimeoutMinutes (default 10 mins)
 */
async function checkPendingWarrantyAdminBusyTimeouts(bot) {
  try {
    const storeSettings = await getStoreSettings();
    const busyTimeoutMins = Number(storeSettings.adminProcessBusyTimeoutMinutes || 10);
    const busyTimeoutMs = busyTimeoutMins * 60 * 1000;
    const now = Date.now();

    // 1. Cleanup expired pending_proof sessions (upload proof timeout)
    const proofTimeoutSnap = await db.collection('orders')
      .where('warrantyClaimStatus', '==', 'pending_proof')
      .get();

    for (const doc of proofTimeoutSnap.docs) {
      const order = doc.data();
      if (order.uploadDeadlineAt && now > new Date(order.uploadDeadlineAt).getTime()) {
        await doc.ref.update({
          warrantyClaimed: true,
          warrantyClaimStatus: 'expired_timeout',
          lastWarrantyStatus: 'expired_timeout',
        });
      }
    }

    // 2. Check orders waiting for Admin response > busyTimeoutMins (10 mins default)
    const snapshot = await db.collection('orders')
      .where('warrantyClaimStatus', '==', 'pending_admin')
      .where('adminBusyNotified', '==', false)
      .get();

    if (snapshot.empty) return;

    for (const doc of snapshot.docs) {
      const order = { id: doc.id, ...doc.data() };
      const receivedMs = order.proofReceivedTimestamp ? Number(order.proofReceivedTimestamp) : (order.createdAt ? new Date(order.createdAt).getTime() : 0);

      if (receivedMs > 0 && (now - receivedMs) >= busyTimeoutMs) {
        // Mark notified first to avoid duplicate messages
        await doc.ref.update({ adminBusyNotified: true });

        if (order.telegramUserId) {
          const jamKirim = order.proofReceivedAt || `${formatDateID(receivedMs).timeStr} WIB (${formatDateID(receivedMs).dateStr})`;
          const defaultMsg =
            `Mohon maaf ya kak\n` +
            `Claim garansi untuk order {{order_id}} belum bisa kami proses sekarang karena admin sedang sibuk.\n\n` +
            `Tapi tenang aja, bukti kamu sudah kami terima pada {{jam_kirim}} dan masih dalam waktu garansi.\n` +
            `Jadi claim kamu tetap kami proses ya.\n\n` +
            `Mohon ditunggu sebentar 🙏`;

          const template = storeSettings.adminBusyMessageTemplate || defaultMsg;
          const autoMsg = template
            .replace(/\{\{order_id\}\}/g, order.id)
            .replace(/\{\{jam_kirim\}\}/g, jamKirim);

          await bot.telegram.sendMessage(order.telegramUserId, autoMsg).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.error('checkPendingWarrantyAdminBusyTimeouts error:', err);
  }
}

/**
 * Setup Warranty & Renew Handlers
 */
function registerWarrantyRenewHandlers(bot) {
  // Start background timer for 10-minute admin busy notification (runs every 60 seconds)
  setInterval(() => {
    checkPendingWarrantyAdminBusyTimeouts(bot);
  }, 60000);

  // ═══════════════════════════════════════
  // USER: RENEW HANDLERS
  // ═══════════════════════════════════════

  // Click "Renew Akun" button
  bot.action(/^user_renew_(.+)$/, async (ctx) => {
    const orderId = ctx.match[1];
    ctx.answerCbQuery().catch(() => {});

    try {
      const doc = await db.collection('orders').doc(orderId).get();
      if (!doc.exists) return ctx.reply('❌ Order tidak ditemukan.');
      const order = { id: doc.id, ...doc.data() };

      const renewInfo = getRenewInfo(order);

      if (!renewInfo.renewEnabled) {
        return safeEditMessage(ctx, '⚠️ Opsi renew tidak tersedia untuk produk ini.');
      }

      if (renewInfo.isMaxReached) {
        return safeEditMessage(ctx, `⚠️ Limit perpanjangan akun (${renewInfo.renewCount}/${renewInfo.maxRenew}x) untuk order ini telah tercapai.`);
      }

      if (!renewInfo.isReady) {
        let notReadyText = renewInfo.customNotReadyMessage;
        let formattedDate = '';
        if (renewInfo.targetDateStr) {
          const d = new Date(renewInfo.targetDateStr);
          if (!isNaN(d.getTime())) {
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            formattedDate = `${day}/${month}/${d.getFullYear()}`;
          }
        }

        if (notReadyText) {
          if (formattedDate) {
            notReadyText += `\n\n📅 <b>Jadwal Aktif Renew Ke-${renewInfo.renewCount + 1}</b>: <code>${formattedDate}</code>`;
          }
        } else {
          notReadyText =
            `⏳ <b>RENEW BELUM TERSEDIA</b>\n` +
            `────────────────────────────\n` +
            (formattedDate ? `• <b>Jadwal Aktif</b>: <code>${formattedDate}</code>\n` : '') +
            `• <b>Sisa Waktu</b> : Silakan tunggu <b>${renewInfo.waitStr}</b> lagi.\n` +
            `• <b>Renew Ke</b>   : <b>${renewInfo.renewCount + 1} dari ${renewInfo.maxRenew}x</b>`;
        }

        return safeEditMessage(ctx,
          `${notReadyText}\n\n💬 <i>Jika ada kendala, silakan hubungi CS kami untuk bantuan lebih lanjut.</i>`
        );
      }

      // If ready -> Show confirmation dialog
      const msg =
        `<b>🔄 KONFIRMASI REQUEST RENEW AKUN</b>\n` +
        `────────────────────────────\n` +
        `• <b>Produk</b>   : <b>${escapeHTML(order.productName)}</b>\n` +
        `• <b>Varian</b>   : <b>${escapeHTML(order.variantLabel)}</b>\n` +
        `• <b>Order ID</b> : <code>${escapeHTML(order.id)}</code>\n` +
        `• <b>Renew Ke</b> : <b>${renewInfo.renewCount + 1} dari ${renewInfo.maxRenew}x</b>\n` +
        `────────────────────────────\n` +
        `<i>Apakah Anda yakin ingin mengajukan perpanjangan (renew) akun ini ke Admin?</i>`;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Ya, Ajukan Renew', `confirm_renew_${order.id}`),
          Markup.button.callback('✕ Batal', `cancel_renew_user_${order.id}`),
        ],
      ]);

      return safeEditMessage(ctx, msg, keyboard);
    } catch (err) {
      console.error('user_renew error:', err);
      ctx.reply('❌ Terjadi kesalahan saat memuat status renew.');
    }
  });

  // User cancels renew dialog
  bot.action(/^cancel_renew_user_(.+)$/, async (ctx) => {
    const orderId = ctx.match[1];
    ctx.answerCbQuery('✕ Dibatalkan.').catch(() => {});
    return renderOrderDetail(ctx, orderId);
  });

  // User confirms renew request -> sends request to Admin
  bot.action(/^confirm_renew_(.+)$/, async (ctx) => {
    const orderId = ctx.match[1];
    ctx.answerCbQuery('✅ Request Renew Dikirim!').catch(() => {});

    try {
      const doc = await db.collection('orders').doc(orderId).get();
      if (!doc.exists) return ctx.reply('❌ Order tidak ditemukan.');
      const order = { id: doc.id, ...doc.data() };

      const renewInfo = getRenewInfo(order);
      const { dateStr, timeStr } = formatDateID(order.deliveredAt ? new Date(order.deliveredAt) : new Date());

      // Update order status to awaiting renew
      await doc.ref.update({
        renewStatus: 'requested',
        lastRenewRequestedAt: new Date().toISOString(),
      });

      await safeEditMessage(ctx,
        `<b>✅ REQUEST RENEW DISAMPAIKAN</b>\n` +
        `────────────────────────────\n` +
        `Permintaan perpanjangan akun untuk order <code>${escapeHTML(order.id)}</code> telah dikirimkan ke Admin.\n\n` +
        `<i>Harap tunggu Admin memproses dan mengirimkan detail akun perpanjangan terbaru.</i>`
      );

      // Notify Admin
      if (config.ADMIN_ID) {
        const adminMsg =
          `<b>🔔 PERMINTAAN RENEW AKUN BARU</b>\n` +
          `────────────────────────────\n` +
          `• <b>Customer</b>   : <b>${escapeHTML(order.customerName || 'User')}</b> (<code>${order.telegramUserId}</code>)\n` +
          `• <b>Produk</b>     : <b>${escapeHTML(order.productName)}</b>\n` +
          `• <b>Varian</b>     : <b>${escapeHTML(order.variantLabel)}</b>\n` +
          `• <b>Order ID</b>   : <code>${escapeHTML(order.id)}</code>\n` +
          `• <b>Tgl Transaksi</b>: ${dateStr} ${timeStr}\n` +
          `• <b>Renew Ke-</b>  : <b>${renewInfo.renewCount + 1} dari ${renewInfo.maxRenew}x</b>\n` +
          `────────────────────────────\n` +
          `⚙️ <i>Silakan klik <b>"✅ Kirim Akun"</b> untuk menginput akun perpanjangan baru.</i>`;

        const adminKeyboard = Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ Kirim Akun', `admin_renew_send_${order.id}`),
            Markup.button.callback('❌ Cancel', `admin_renew_cancel_${order.id}`),
          ],
        ]);

        await bot.telegram.sendMessage(config.ADMIN_ID, adminMsg, { parse_mode: 'HTML', ...adminKeyboard }).catch(() => {});
      }
    } catch (err) {
      console.error('confirm_renew error:', err);
      ctx.reply('❌ Gagal mengirimkan request renew.');
    }
  });

  // ═══════════════════════════════════════
  // ADMIN: RENEW HANDLERS (EDIT IN-PLACE)
  // ═══════════════════════════════════════

  // Admin clicks "Kirim Akun" for Renew
  bot.action(/^admin_renew_send_(.+)$/, async (ctx) => {
    const orderId = ctx.match[1];
    ctx.answerCbQuery().catch(() => {});
    const adminId = ctx.from.id;
    const isPhoto = Boolean(ctx.callbackQuery?.message?.photo);
    const promptMsgId = ctx.callbackQuery?.message?.message_id;

    adminReplySessions.set(adminId, { type: 'renew_creds', orderId, promptMsgId, isPhoto });

    const promptText =
      `<b>📝 INPUT AKUN RENEW (ORDER #${orderId})</b>\n` +
      `────────────────────────────\n` +
      `Silakan balas pesan ini dengan format data akun perpanjangan baru:\n\n` +
      `<code>email|password</code> atau <code>username|email|password</code>\n\n` +
      `<i>Ketik /cancel untuk membatalkan.</i>`;

    return safeEditMessage(ctx, promptText);
  });

  // Admin clicks "Cancel" for Renew
  bot.action(/^admin_renew_cancel_(.+)$/, async (ctx) => {
    const orderId = ctx.match[1];
    ctx.answerCbQuery().catch(() => {});
    const adminId = ctx.from.id;
    const isPhoto = Boolean(ctx.callbackQuery?.message?.photo);
    const promptMsgId = ctx.callbackQuery?.message?.message_id;

    adminReplySessions.set(adminId, { type: 'renew_cancel', orderId, promptMsgId, isPhoto });

    const promptText =
      `<b>❌ REASON CANCEL RENEW (ORDER #${orderId})</b>\n` +
      `────────────────────────────\n` +
      `Ketikkan alasan pembatalan renew untuk dikirimkan ke customer:\n` +
      `<i>(Contoh: Stok pengganti habis / Garansi tidak memenuhi syarat)</i>\n\n` +
      `<i>Ketik /cancel untuk membatalkan.</i>`;

    return safeEditMessage(ctx, promptText);
  });

  // ═══════════════════════════════════════
  // USER: WARRANTY HANDLERS
  // ═══════════════════════════════════════

  // Click "Klaim Garansi" button
  bot.action(/^user_warranty_(.+)$/, async (ctx) => {
    const orderId = ctx.match[1];
    ctx.answerCbQuery().catch(() => {});

    try {
      const doc = await db.collection('orders').doc(orderId).get();
      if (!doc.exists) return ctx.reply('❌ Order tidak ditemukan.');
      const order = { id: doc.id, ...doc.data() };

      const warrantyInfo = getWarrantyInfo(order);

      if (warrantyInfo.alreadyClaimed) {
        const claimText = warrantyInfo.isTimeout
          ? '⚠️ Garansi sudah hangus karena tidak ada bukti yang dikirim sebelumnya.'
          : '⚠️ Klaim garansi untuk pesanan ini telah digunakan (maksimal 1x).';
        return ctx.answerCbQuery(`${claimText}\nJika ada kendala, silakan hubungi CS kami.`, { show_alert: true });
      }

      if (!warrantyInfo.hasWarranty || warrantyInfo.isExpired) {
        return safeEditMessage(ctx,
          `<b>⚠️ MOHON MAAF, GARANSI SUDAH TIDAK BERLAKU</b>\n` +
          `────────────────────────────\n` +
          `> <i>Mohon maaf, garansi sudah tidak berlaku untuk order <code>${escapeHTML(order.id)}</code>.</i>\n\n` +
          `💬 <i>Jika ada kendala, silakan hubungi CS kami untuk bantuan lebih lanjut.</i>`
        );
      }

      const msg =
        `<b>🛡️ KLAIM GARANSI PRODUK</b>\n` +
        `────────────────────────────\n` +
        `• <b>Produk</b>   : <b>${escapeHTML(order.productName)}</b> (${escapeHTML(order.variantLabel)})\n` +
        `• <b>Order ID</b> : <code>${escapeHTML(order.id)}</code>\n` +
        `• <b>Sisa Garansi</b>: <b>${warrantyInfo.remainingStr}</b>\n` +
        `────────────────────────────\n` +
        `👉 <b>Silakan pilih jenis kendala yang Anda alami:</b>`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('1️⃣ Premium Hilang', `warranty_issue_${order.id}_premium_hilang`)],
        [Markup.button.callback('2️⃣ Akun Logout', `warranty_issue_${order.id}_akun_logout`)],
        [Markup.button.callback('3️⃣ Tidak Bisa Login', `warranty_issue_${order.id}_gagal_login`)],
        [Markup.button.callback('4️⃣ Kendala Lainnya', `warranty_issue_${order.id}_lainnya`)],
        [Markup.button.callback('✕ Batal', `cancel_warranty_user_${order.id}`)],
      ]);

      return safeEditMessage(ctx, msg, keyboard);
    } catch (err) {
      console.error('user_warranty error:', err);
      ctx.reply('❌ Gagal memproses klaim garansi.');
    }
  });

  bot.action(/^cancel_warranty_user_(.+)$/, async (ctx) => {
    const orderId = ctx.match[1];
    ctx.answerCbQuery('✕ Dibatalkan.').catch(() => {});
    return renderOrderDetail(ctx, orderId);
  });

  // User selects issue type
  bot.action(/^warranty_issue_(.+?)_(.+)$/, async (ctx) => {
    const orderId = ctx.match[1];
    const issueCode = ctx.match[2];
    ctx.answerCbQuery().catch(() => {});

    const issueMap = {
      premium_hilang: 'Premium Hilang',
      akun_logout: 'Akun Logout',
      gagal_login: 'Tidak Bisa Login',
      lainnya: 'Kendala Lainnya',
    };
    const issueTitle = issueMap[issueCode] || issueCode;

    const userId = ctx.from.id;
    userWarrantySessions.set(userId, { orderId, issueType: issueTitle, photos: [], promptMsgId: ctx.callbackQuery?.message?.message_id });

    const msg =
      `<b>📋 KENDALA TERPILIH: ${issueTitle.toUpperCase()}</b>\n` +
      `────────────────────────────\n` +
      `Apakah Anda ingin melanjutkan pengiriman foto bukti kendala?\n\n` +
      `<i>Anda dapat mengunggah hingga 5 foto screenshot bukti.</i>`;

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('➡️ Lanjutkan Upload Bukti', `start_upload_photos_${orderId}`),
        Markup.button.callback('✕ Batal', `cancel_warranty_user_${orderId}`),
      ],
    ]);

    return safeEditMessage(ctx, msg, keyboard);
  });

  // User starts uploading photo proof
  bot.action(/^start_upload_photos_(.+)$/, async (ctx) => {
    const orderId = ctx.match[1];
    ctx.answerCbQuery().catch(() => {});

    const userId = ctx.from.id;
    const storeSettings = await getStoreSettings();
    const uploadTimeoutMins = Number(storeSettings.warrantyUploadTimeoutMinutes || 5);
    const nowMs = Date.now();
    const uploadDeadlineAt = nowMs + (uploadTimeoutMins * 60 * 1000);

    const session = userWarrantySessions.get(userId) || { orderId, issueType: 'Kendala', photos: [] };
    session.awaitingPhotos = true;
    session.promptMsgId = ctx.callbackQuery?.message?.message_id;
    session.uploadDeadlineAt = uploadDeadlineAt;
    session.uploadTimeoutMins = uploadTimeoutMins;
    userWarrantySessions.set(userId, session);

    try {
      await db.collection('orders').doc(orderId).update({
        warrantyClaimStatus: 'pending_proof',
        claimStartedAt: new Date(nowMs).toISOString(),
        uploadDeadlineAt: new Date(uploadDeadlineAt).toISOString(),
      });
    } catch (e) {}

    const msg =
      `<b>📸 SILAKAN KIRIM FOTO BUKTI KENDALA</b>\n` +
      `────────────────────────────\n` +
      `Silakan kirimkan 1 s/d 5 foto screenshot kendala Anda langsung ke bot ini.\n\n` +
      `⏳ <b>Batas Waktu Unggah Bukti:</b> <b>${uploadTimeoutMins} Menit</b>\n` +
      `⚠️ <i>Jika melebihi batas waktu ${uploadTimeoutMins} menit, klaim garansi Anda akan hangus secara otomatis.</i>\n\n` +
      `• Foto Terkumpul: <b>${session.photos.length}/5</b>\n\n` +
      `<i>Setelah selesai mengirim foto, tekan tombol <b>"✅ Selesai Upload Bukti"</b> di bawah.</i>`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('✅ Selesai Upload Bukti', `finish_warranty_claim_${orderId}`)],
      [Markup.button.callback('✕ Batal', `cancel_warranty_user_${orderId}`)],
    ]);

    return safeEditMessage(ctx, msg, keyboard);
  });

  // User finishes photo upload & submits claim
  bot.action(/^finish_warranty_claim_(.+)$/, async (ctx) => {
    const orderId = ctx.match[1];
    const userId = ctx.from.id;
    const session = userWarrantySessions.get(userId);

    if (!session || session.photos.length === 0) {
      return ctx.answerCbQuery('⚠️ Harap kirimkan minimal 1 foto bukti kendala terlebih dahulu!', { show_alert: true });
    }

    const nowMs = Date.now();
    if (session.uploadDeadlineAt && nowMs > session.uploadDeadlineAt) {
      userWarrantySessions.delete(userId);
      try {
        await db.collection('orders').doc(orderId).update({
          warrantyClaimed: true,
          warrantyClaimStatus: 'expired_timeout',
          lastWarrantyStatus: 'expired_timeout',
        });
      } catch (e) {}
      ctx.answerCbQuery(`⚠️ Batas waktu pengiriman bukti (${session.uploadTimeoutMins || 5} menit) telah habis. Klaim garansi hangus.`, { show_alert: true });
      return safeEditMessage(ctx,
        `<b>⚠️ KLAIM GARANSI HANGUS (TIMEOUT)</b>\n` +
        `────────────────────────────\n` +
        `Batas waktu pengiriman bukti garansi telah habis. Klaim garansi Anda untuk order <code>${escapeHTML(orderId)}</code> telah hangus.`
      );
    }

    ctx.answerCbQuery('✅ Laporan Garansi Terkirim!').catch(() => {});
    userWarrantySessions.delete(userId);

    try {
      const doc = await db.collection('orders').doc(orderId).get();
      if (!doc.exists) return ctx.reply('❌ Order tidak ditemukan.');
      const order = { id: doc.id, ...doc.data() };

      const { dateStr, timeStr } = formatDateID(new Date());
      const jamKirim = `${timeStr} WIB (${dateStr})`;

      const claimData = {
        claimId: `CLM-${Date.now()}`,
        issueType: session.issueType,
        photos: session.photos,
        status: 'pending',
        createdAt: new Date().toISOString(),
        jamKirim,
      };

      const existingClaims = order.warrantyClaims || [];
      await doc.ref.update({
        warrantyClaimed: true, // Mark claimed so button disappears!
        warrantyClaimStatus: 'pending_admin',
        proofReceivedAt: jamKirim,
        proofReceivedTimestamp: Date.now(),
        adminBusyNotified: false,
        warrantyClaims: [...existingClaims, claimData],
        lastWarrantyStatus: 'pending',
      });

      await safeEditMessage(ctx,
        `<b>✅ LAPORAN GARANSI TERSAMPAIKAN</b>\n` +
        `────────────────────────────\n` +
        `Laporan kendala (<b>${escapeHTML(session.issueType)}</b>) beserta ${session.photos.length} foto bukti untuk order <code>${escapeHTML(orderId)}</code> telah dikirimkan ke Admin.\n\n` +
        `🕒 <i>Bukti Anda telah diterima pada <b>${jamKirim}</b>.</i>\n` +
        `<i>Admin akan meninjau laporan dan memberikan respon / akun pengganti secepatnya.</i>`
      );

      // Forward to Admin
      if (config.ADMIN_ID) {
        const adminMsg =
          `<b>🛡️ LAPORAN KLAIM GARANSI BARU</b>\n` +
          `────────────────────────────\n` +
          `• <b>Customer</b>   : <b>${escapeHTML(order.customerName || 'User')}</b> (<code>${order.telegramUserId}</code>)\n` +
          `• <b>Produk</b>     : <b>${escapeHTML(order.productName)}</b> (${escapeHTML(order.variantLabel)})\n` +
          `• <b>Order ID</b>   : <code>${escapeHTML(order.id)}</code>\n` +
          `• <b>Kendala</b>    : <b>${escapeHTML(session.issueType)}</b>\n` +
          `• <b>Jml Bukti</b>  : <b>${session.photos.length} Foto</b>\n` +
          `• <b>Diterima</b>   : <b>${jamKirim}</b>\n` +
          `────────────────────────────\n` +
          `⚙️ <i>Silakan pilih aksi di bawah:</i>`;

        const adminKeyboard = Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ Ganti Akun', `admin_warr_approve_${order.id}`),
            Markup.button.callback('❌ Tolak Klaim', `admin_warr_reject_${order.id}`),
          ],
        ]);

        if (session.photos.length === 1) {
          await bot.telegram.sendPhoto(config.ADMIN_ID, session.photos[0], { caption: adminMsg, parse_mode: 'HTML', ...adminKeyboard }).catch(() => {});
        } else {
          const mediaGroup = session.photos.map((fileId, idx) => ({
            type: 'photo',
            media: fileId,
            caption: idx === 0 ? `📸 <b>Bukti Foto Klaim (${orderId})</b>` : '',
            parse_mode: 'HTML',
          }));
          await bot.telegram.sendMediaGroup(config.ADMIN_ID, mediaGroup).catch(() => {});
          await bot.telegram.sendMessage(config.ADMIN_ID, adminMsg, { parse_mode: 'HTML', ...adminKeyboard }).catch(() => {});
        }
      }
    } catch (err) {
      console.error('finish_warranty_claim error:', err);
    }
  });

  // Admin clicks "Ganti Akun" for Warranty
  bot.action(/^admin_warr_approve_(.+)$/, async (ctx) => {
    const orderId = ctx.match[1];
    ctx.answerCbQuery().catch(() => {});
    const adminId = ctx.from.id;
    const isPhoto = Boolean(ctx.callbackQuery?.message?.photo);
    const promptMsgId = ctx.callbackQuery?.message?.message_id;

    adminReplySessions.set(adminId, { type: 'warranty_creds', orderId, promptMsgId, isPhoto });

    const promptText =
      `<b>📝 INPUT AKUN PENGGANTI GARANSI (ORDER #${orderId})</b>\n` +
      `────────────────────────────\n` +
      `Silakan balas pesan ini dengan format data akun pengganti garansi baru:\n\n` +
      `<code>email|password</code> atau <code>username|email|password</code>\n\n` +
      `<i>Ketik /cancel untuk membatalkan.</i>`;

    return safeEditMessage(ctx, promptText);
  });

  // Admin clicks "Tolak Klaim" for Warranty
  bot.action(/^admin_warr_reject_(.+)$/, async (ctx) => {
    const orderId = ctx.match[1];
    ctx.answerCbQuery().catch(() => {});
    const adminId = ctx.from.id;
    const isPhoto = Boolean(ctx.callbackQuery?.message?.photo);
    const promptMsgId = ctx.callbackQuery?.message?.message_id;

    adminReplySessions.set(adminId, { type: 'warranty_reject', orderId, promptMsgId, isPhoto });

    const promptText =
      `<b>❌ REASON TOLAK GARANSI (ORDER #${orderId})</b>\n` +
      `────────────────────────────\n` +
      `Ketikkan alasan penolakan klaim garansi:\n` +
      `<i>(Contoh: Bukti tidak valid / Garansi telah melebihi batas klaim)</i>\n\n` +
      `<i>Ketik /cancel untuk membatalkan.</i>`;

    return safeEditMessage(ctx, promptText);
  });

  // ═══════════════════════════════════════
  // LISTENERS: PHOTO & TEXT INPUT
  // ═══════════════════════════════════════

  // Listen for photos sent by customer during warranty claim
  bot.on('photo', async (ctx, next) => {
    const userId = ctx.from.id;
    const session = userWarrantySessions.get(userId);

    if (session && session.awaitingPhotos) {
      const photos = ctx.message.photo;
      const largestPhoto = photos[photos.length - 1].file_id;

      // Delete customer's sent photo message to keep chat uncluttered
      ctx.deleteMessage().catch(() => {});

      const nowMs = Date.now();
      if (session.uploadDeadlineAt && nowMs > session.uploadDeadlineAt) {
        userWarrantySessions.delete(userId);
        try {
          await db.collection('orders').doc(session.orderId).update({
            warrantyClaimed: true,
            warrantyClaimStatus: 'expired_timeout',
            lastWarrantyStatus: 'expired_timeout',
          });
        } catch (e) {}

        const msgTimeout =
          `<b>⚠️ KLAIM GARANSI HANGUS (TIMEOUT)</b>\n` +
          `────────────────────────────\n` +
          `Batas waktu pengiriman bukti garansi (${session.uploadTimeoutMins || 5} menit) telah habis.\n` +
          `Klaim garansi untuk order <code>${escapeHTML(session.orderId)}</code> hangus dan tidak dapat diajukan kembali.`;

        if (session.promptMsgId) {
          bot.telegram.editMessageText(userId, session.promptMsgId, null, msgTimeout, { parse_mode: 'HTML' }).catch(() => {});
        }
        return;
      }

      if (session.photos.length < 5) {
        session.photos.push(largestPhoto);
        userWarrantySessions.set(userId, session);

        const msg =
          `<b>📸 SILAKAN KIRIM FOTO BUKTI KENDALA</b>\n` +
          `────────────────────────────\n` +
          `Silakan kirimkan 1 s/d 5 foto screenshot kendala Anda langsung ke bot ini.\n\n` +
          `⏳ <b>Batas Waktu Kirim Bukti:</b> <b>${session.uploadTimeoutMins || 5} Menit</b>\n` +
          `• Foto Terkumpul: <b>${session.photos.length}/5 foto diterima ✅</b>\n\n` +
          `<i>Setelah selesai mengirim foto, tekan tombol <b>"✅ Selesai Upload Bukti"</b> di bawah.</i>`;

        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('✅ Selesai Upload Bukti', `finish_warranty_claim_${session.orderId}`)],
          [Markup.button.callback('✕ Batal', `cancel_warranty_user_${session.orderId}`)],
        ]);

        if (session.promptMsgId) {
          bot.telegram.editMessageText(userId, session.promptMsgId, null, msg, { parse_mode: 'HTML', ...keyboard }).catch(() => {});
        }
        return;
      } else {
        return ctx.reply('⚠️ Maksimal 5 foto bukti sudah tercapai. Silakan tekan tombol Selesai.').catch(() => {});
      }
    }

    return next();
  });

  // Listen for admin text input (replies for renew / warranty)
  bot.on('text', async (ctx, next) => {
    const userId = ctx.from.id;
    const adminSession = adminReplySessions.get(userId);

    if (!adminSession) return next();

    const text = ctx.message.text.trim();

    // Delete admin's typed text message so chat remains clean!
    await ctx.deleteMessage().catch(() => {});

    if (text === '/cancel' || text.toLowerCase() === 'batal') {
      const promptId = adminSession.promptMsgId;
      const isPhoto = adminSession.isPhoto;
      adminReplySessions.delete(userId);

      const cancelMsg = '✕ Aksi dibatalkan.';
      if (promptId) {
        if (isPhoto) {
          return bot.telegram.editMessageCaption(userId, promptId, null, cancelMsg).catch(() => {});
        }
        return bot.telegram.editMessageText(userId, promptId, null, cancelMsg).catch(() => {});
      }
      return ctx.reply(cancelMsg);
    }

    const { type, orderId, promptMsgId, isPhoto } = adminSession;
    adminReplySessions.delete(userId);

    // Helper function to edit the prompt message in-place
    async function updateAdminPromptMessage(msgText) {
      if (promptMsgId) {
        if (isPhoto) {
          return bot.telegram.editMessageCaption(userId, promptMsgId, null, msgText, { parse_mode: 'HTML' }).catch(() => {
            return ctx.reply(msgText, { parse_mode: 'HTML' });
          });
        }
        return bot.telegram.editMessageText(userId, promptMsgId, null, msgText, { parse_mode: 'HTML' }).catch(() => {
          return ctx.reply(msgText, { parse_mode: 'HTML' });
        });
      }
      return ctx.reply(msgText, { parse_mode: 'HTML' });
    }

    try {
      const doc = await db.collection('orders').doc(orderId).get();
      if (!doc.exists) {
        return updateAdminPromptMessage('❌ Order tidak ditemukan.');
      }
      const order = { id: doc.id, ...doc.data() };

      // ── 1. Admin sends Renew Account ──
      if (type === 'renew_creds') {
        const newRenewCount = Number(order.renewCount || 0) + 1;
        const newHistory = order.renewHistory || [];
        newHistory.push({
          renewIndex: newRenewCount,
          credentials: text,
          timestamp: new Date().toISOString(),
        });

        await doc.ref.update({
          renewCount: newRenewCount,
          renewStatus: 'completed',
          renewHistory: newHistory,
        });

        await updateAdminPromptMessage(
          `<b>✅ AKUN RENEW BERHASIL DIKIRIM</b>\n` +
          `────────────────────────────\n` +
          `• <b>Order ID</b> : <code>${escapeHTML(order.id)}</code>\n` +
          `• <b>Renew Ke</b> : <b>${newRenewCount} dari ${order.maxRenew || 1}x</b>\n` +
          `• <b>Status</b>   : Terkirim ke pembeli.`
        );

        if (order.telegramUserId) {
          const renewInfo = getRenewInfo({ ...order, renewCount: newRenewCount });
          let extraRenewMsg = '';

          if (!renewInfo.isMaxReached) {
            extraRenewMsg = `\n\n<i>Tombol Renew berikutnya (${newRenewCount + 1}/${renewInfo.maxRenew}x) akan aktif kembali sesuai jeda waktu.</i>`;
          } else {
            extraRenewMsg = `\n\n<i>(Batas maksimal renew ${renewInfo.maxRenew}x untuk order ini telah selesai).</i>`;
          }

          const actionButtons = buildOrderActionButtons({ ...order, renewCount: newRenewCount });
          const replyOpts = actionButtons.length > 0
            ? { parse_mode: 'HTML', ...Markup.inlineKeyboard(actionButtons) }
            : { parse_mode: 'HTML' };

          await bot.telegram.sendMessage(
            order.telegramUserId,
            `<b>🎉 AKUN RENEW BERHASIL DIPERPANJANG!</b>\n` +
            `────────────────────────────\n` +
            `• <b>Produk</b>    : <b>${escapeHTML(order.productName)}</b>\n` +
            `• <b>Order ID</b>  : <code>${escapeHTML(order.id)}</code>\n` +
            `• <b>Renew Ke</b>  : <b>${newRenewCount} dari ${order.maxRenew || 1}x</b>\n` +
            `────────────────────────────\n` +
            `🔑 <b>Detail Akun Perpanjangan:</b>\n` +
            `<pre>${escapeHTML(text)}</pre>` + extraRenewMsg,
            replyOpts
          ).catch(() => {});
        }
        return;
      }

      // ── 2. Admin cancels Renew ──
      if (type === 'renew_cancel') {
        await doc.ref.update({ renewStatus: 'rejected', renewRejectReason: text });

        await updateAdminPromptMessage(
          `<b>❌ REQUEST RENEW DIBATALKAN</b>\n` +
          `────────────────────────────\n` +
          `• <b>Order ID</b> : <code>${escapeHTML(order.id)}</code>\n` +
          `• <b>Alasan</b>   : <i>${escapeHTML(text)}</i>`
        );

        if (order.telegramUserId) {
          await bot.telegram.sendMessage(
            order.telegramUserId,
            `<b>❌ PERMINTAAN RENEW DIBATALKAN</b>\n` +
            `────────────────────────────\n` +
            `• <b>Order ID</b> : <code>${escapeHTML(order.id)}</code>\n` +
            `• <b>Alasan</b>   : <i>${escapeHTML(text)}</i>`,
            { parse_mode: 'HTML' }
          ).catch(() => {});
        }
        return;
      }

      // ── 3. Admin sends Warranty Replacement Account ──
      if (type === 'warranty_creds') {
        const claims = order.warrantyClaims || [];
        if (claims.length > 0) {
          claims[claims.length - 1].status = 'approved';
          claims[claims.length - 1].replacementCreds = text;
          claims[claims.length - 1].resolvedAt = new Date().toISOString();
        }

        await doc.ref.update({
          warrantyClaims: claims,
          lastWarrantyStatus: 'approved',
          warrantyClaimStatus: 'approved',
        });

        await updateAdminPromptMessage(
          `<b>✅ AKUN PENGGANTI GARANSI BERHASIL DIKIRIM</b>\n` +
          `────────────────────────────\n` +
          `• <b>Order ID</b> : <code>${escapeHTML(order.id)}</code>\n` +
          `• <b>Status</b>   : Terkirim ke pembeli.`
        );

        if (order.telegramUserId) {
          const actionButtons = buildOrderActionButtons(order);
          const replyOpts = actionButtons.length > 0
            ? { parse_mode: 'HTML', ...Markup.inlineKeyboard(actionButtons) }
            : { parse_mode: 'HTML' };

          await bot.telegram.sendMessage(
            order.telegramUserId,
            `<b>🛡️ KLAIM GARANSI DISETUJUHI!</b>\n` +
            `────────────────────────────\n` +
            `• <b>Produk</b>   : <b>${escapeHTML(order.productName)}</b>\n` +
            `• <b>Order ID</b> : <code>${escapeHTML(order.id)}</code>\n` +
            `────────────────────────────\n` +
            `🔑 <b>Detail Akun Pengganti Garansi:</b>\n` +
            `<pre>${escapeHTML(text)}</pre>`,
            replyOpts
          ).catch(() => {});
        }
        return;
      }

      // ── 4. Admin rejects Warranty Claim ──
      if (type === 'warranty_reject') {
        const claims = order.warrantyClaims || [];
        if (claims.length > 0) {
          claims[claims.length - 1].status = 'rejected';
          claims[claims.length - 1].rejectReason = text;
          claims[claims.length - 1].resolvedAt = new Date().toISOString();
        }

        await doc.ref.update({
          warrantyClaims: claims,
          lastWarrantyStatus: 'rejected',
          warrantyClaimStatus: 'rejected',
        });

        await updateAdminPromptMessage(
          `<b>❌ KLAIM GARANSI DITOLAK</b>\n` +
          `────────────────────────────\n` +
          `• <b>Order ID</b> : <code>${escapeHTML(order.id)}</code>\n` +
          `• <b>Alasan</b>   : <i>${escapeHTML(text)}</i>`
        );

        if (order.telegramUserId) {
          await bot.telegram.sendMessage(
            order.telegramUserId,
            `<b>❌ KLAIM GARANSI DITOLAK</b>\n` +
            `────────────────────────────\n` +
            `• <b>Order ID</b> : <code>${escapeHTML(order.id)}</code>\n` +
            `• <b>Alasan</b>   : <i>${escapeHTML(text)}</i>`,
            { parse_mode: 'HTML' }
          ).catch(() => {});
        }
        return;
      }
    } catch (err) {
      console.error('adminReply error:', err);
      ctx.reply('❌ Terjadi kesalahan saat memproses respon admin.');
    }
  });
}

module.exports = {
  getWarrantyInfo,
  getRenewInfo,
  buildOrderActionButtons,
  registerWarrantyRenewHandlers,
};
