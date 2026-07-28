const { Markup } = require('telegraf');
const { db } = require('../firebase');
const config = require('../config');
const { formatIDR, generateOrderId, escapeHTML } = require('../helpers');
const { t } = require('../i18n');
const { createPayment, checkStatus, cancelPayment } = require('../ramashop');
const { getCart, clearCart } = require('../session');

const stripTags = (str) => String(str || '').replace(/<[^>]*>/g, '');

async function getUserLang(userId) {
  try {
    const doc = await db.collection('bot_users').doc(userId.toString()).get();
    return (doc.exists && doc.data().language) ? doc.data().language : 'id';
  } catch { return 'id'; }
}

/**
 * Handle payment via Saldo
 */
async function handleBalancePayment(ctx, productId, variantIndex) {
  const userId = ctx.from.id;
  const lang = await getUserLang(userId);

  try {
    const cart = await getCart(userId);
    if (!cart) return ctx.answerCbQuery('Tidak ada pesanan.', { show_alert: true }).catch(() => {});

    // Check balance
    const userDoc = await db.collection('bot_users').doc(userId.toString()).get();
    const balance = userDoc.data()?.balance || 0;

    if (balance < cart.total) {
      return ctx.answerCbQuery(
        t(lang, 'payment_insufficient', { balance: formatIDR(balance), total: formatIDR(cart.total) }),
        { show_alert: true }
      ).catch(() => {});
    }

    ctx.answerCbQuery().catch(() => {});
    // Delete order summary message on payment completion
    ctx.deleteMessage().catch(() => {});

    const orderId = generateOrderId('ORD');

    // Deduct balance & create order atomically
    await db.runTransaction(async (transaction) => {
      const userRef = db.collection('bot_users').doc(userId.toString());
      const freshUserDoc = await transaction.get(userRef);
      const currentBalance = freshUserDoc.data()?.balance || 0;

      if (currentBalance < cart.total) throw new Error('Insufficient balance');

      transaction.update(userRef, { balance: currentBalance - cart.total });
      transaction.set(db.collection('orders').doc(orderId), {
        id: orderId,
        telegramUserId: userId.toString(),
        customerName: ctx.from.first_name || 'User',
        productId: cart.productId,
        productName: cart.productName,
        variantLabel: cart.variantLabel,
        variantIndex: cart.variantIndex,
        quantity: cart.qty,
        unitPrice: cart.unitPrice,
        totalPrice: cart.total,
        paymentMethod: 'saldo',
        deliveryType: cart.deliveryType,
        status: 'paid',
        voucherCode: cart.voucherCode || null,
        voucherDiscount: cart.voucherDiscount || 0,
        createdAt: new Date().toISOString(),
      });
    });

    // Use voucher if applied
    if (cart.voucherId) {
      const { useVoucher } = require('../pricing');
      await useVoucher(cart.voucherId);
    }

    await clearCart(userId);

    // Trigger fulfillment
    try {
      const { fulfillOrder } = require('../fulfillment');
      await fulfillOrder(orderId);
    } catch (fErr) {
      console.error('Fulfillment error:', fErr);
    }

  } catch (err) {
    console.error('handleBalancePayment error:', err);
    if (err.message === 'Insufficient balance') {
      return ctx.reply(t(lang, 'payment_insufficient', { balance: '?', total: '?' }), { parse_mode: 'HTML' });
    }
    ctx.reply(t(lang, 'error_general'), { parse_mode: 'HTML' });
  }
}

/**
 * Handle payment via QRIS (RamaShop)
 */
async function handleQRISPayment(ctx, productId, variantIndex) {
  const userId = ctx.from.id;
  const lang = await getUserLang(userId);

  try {
    const cart = await getCart(userId);
    if (!cart) return ctx.answerCbQuery('Tidak ada pesanan.', { show_alert: true }).catch(() => {});

    ctx.answerCbQuery(t(lang, 'payment_processing')).catch(() => {});
    // Delete order summary message on QRIS payment initiation
    ctx.deleteMessage().catch(() => {});

    const orderId = generateOrderId('ORD');

    // Create order in DB
    await db.collection('orders').doc(orderId).set({
      id: orderId,
      telegramUserId: userId.toString(),
      customerName: ctx.from.first_name || 'User',
      productId: cart.productId,
      productName: cart.productName,
      variantLabel: cart.variantLabel,
      variantIndex: cart.variantIndex,
      quantity: cart.qty,
      unitPrice: cart.unitPrice,
      totalPrice: cart.total,
      paymentMethod: 'qris',
      deliveryType: cart.deliveryType,
      status: 'pending',
      voucherCode: cart.voucherCode || null,
      voucherDiscount: cart.voucherDiscount || 0,
      voucherId: cart.voucherId || null,
      createdAt: new Date().toISOString(),
    });

    // Create RamaShop payment
    const payResult = await createPayment(orderId, cart.total);

    if (!payResult || !payResult.success) {
      await db.collection('orders').doc(orderId).update({ status: 'failed' });
      return ctx.reply(t(lang, 'payment_failed'), { parse_mode: 'HTML' });
    }

    // Save transaction ref
    await db.collection('orders').doc(orderId).update({
      ramashopDepositId: payResult.depositId,
      uniqueAmount: payResult.totalAmount || cart.total,
    });

    const caption = t(lang, 'payment_qris_caption', {
      orderId,
      total: formatIDR(payResult.totalAmount || cart.total),
      expiry: '15',
    });

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Cek Status', `check_payment_${orderId}`)],
      [Markup.button.callback(t(lang, 'btn_cancel'), `cancel_order_${orderId}`)],
    ]);

    let sentMsg;
    if (payResult.qrBuffer) {
      sentMsg = await ctx.replyWithPhoto(
        { source: payResult.qrBuffer, filename: 'qris.png' },
        { caption, parse_mode: 'HTML', ...keyboard }
      );
    } else if (payResult.qr_data_url) {
      sentMsg = await ctx.replyWithPhoto(
        payResult.qr_data_url,
        { caption, parse_mode: 'HTML', ...keyboard }
      );
    }

    if (sentMsg) {
      await db.collection('orders').doc(orderId).update({
        paymentMessageId: sentMsg.message_id,
      });
    }

    await clearCart(userId);

    // ⚡ INSTANT WATCHER: Auto check payment status every 1.5s for fast 1-second completion
    startInstantPaymentWatcher(ctx, orderId, payResult.depositId, userId);

  } catch (err) {
    console.error('handleQRISPayment error:', err);
    ctx.reply(t(lang, 'error_general'), { parse_mode: 'HTML' });
  }
}

/**
 * Handle topup via QRIS
 */
async function handleTopupQRIS(ctx, amount) {
  const userId = ctx.from.id;
  const lang = await getUserLang(userId);

  try {
    ctx.answerCbQuery(stripTags(`${t(lang, 'topup_preparing')} ${formatIDR(amount)}...`)).catch(() => {});

    const orderId = generateOrderId('TOPUP');

    await db.collection('orders').doc(orderId).set({
      id: orderId,
      telegramUserId: userId.toString(),
      customerName: ctx.from.first_name || 'User',
      productName: 'Top-up Saldo',
      totalPrice: amount,
      paymentMethod: 'qris',
      type: 'topup',
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    const payResult = await createPayment(orderId, amount);

    if (!payResult || !payResult.success) {
      await db.collection('orders').doc(orderId).update({ status: 'failed' });
      return ctx.reply(t(lang, 'payment_failed'), { parse_mode: 'HTML' });
    }

    await db.collection('orders').doc(orderId).update({
      ramashopDepositId: payResult.depositId,
      uniqueAmount: payResult.totalAmount || amount,
    });

    const caption = t(lang, 'payment_qris_caption', {
      orderId,
      total: formatIDR(payResult.totalAmount || amount),
      expiry: '15',
    });

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Cek Status', `check_payment_${orderId}`)],
      [Markup.button.callback(t(lang, 'btn_cancel'), `cancel_order_${orderId}`)],
    ]);

    let sentMsg;
    if (payResult.qrBuffer) {
      sentMsg = await ctx.replyWithPhoto(
        { source: payResult.qrBuffer, filename: 'qris.png' },
        { caption, parse_mode: 'HTML', ...keyboard }
      );
    } else if (payResult.qr_data_url) {
      sentMsg = await ctx.replyWithPhoto(
        payResult.qr_data_url,
        { caption, parse_mode: 'HTML', ...keyboard }
      );
    }

    if (sentMsg) {
      await db.collection('orders').doc(orderId).update({
        paymentMessageId: sentMsg.message_id,
      });
    }

    // ⚡ INSTANT WATCHER: Auto check payment status every 1.5s for fast 1-second completion
    startInstantPaymentWatcher(ctx, orderId, payResult.depositId, userId);

  } catch (err) {
    console.error('handleTopupQRIS error:', err);
    ctx.reply(t(lang, 'error_general'), { parse_mode: 'HTML' });
  }
}

/**
 * Instant Payment Auto-Watcher (Fast 1.5s background polling loop)
 */
function startInstantPaymentWatcher(ctx, orderId, depositId, userId) {
  let checkCount = 0;
  const maxChecks = 400; // 400 * 1.5s = 600s (10 mins)

  const timer = setInterval(async () => {
    checkCount++;
    if (checkCount > maxChecks) {
      clearInterval(timer);
      return;
    }

    try {
      const doc = await db.collection('orders').doc(orderId).get();
      if (!doc.exists) {
        clearInterval(timer);
        return;
      }

      const order = doc.data();
      if (['paid', 'success', 'failed', 'cancelled'].includes(order.status)) {
        clearInterval(timer);
        return;
      }

      const targetDepositId = depositId || order.ramashopDepositId;
      if (targetDepositId) {
        const res = await checkStatus(targetDepositId).catch(() => null);
        const statusStr = (res?.data?.status || res?.status || '').toString().toLowerCase();

        if (statusStr === 'success' || statusStr === 'already' || (res?.status === true && statusStr === 'success')) {
          clearInterval(timer);
          console.log(`[Instant Watcher] ⚡ Payment SUCCESS detected for ${orderId} in ~1 sec!`);

          await db.collection('orders').doc(orderId).update({
            status: 'paid',
            paidAt: new Date().toISOString(),
          });

          // Delete QRIS message automatically
          if (order.paymentMessageId) {
            ctx.telegram.deleteMessage(userId, order.paymentMessageId).catch(() => {});
          }

          // Fulfill order immediately
          try {
            const { fulfillOrder } = require('../fulfillment');
            await fulfillOrder(orderId);
          } catch (fErr) {
            console.error('[Instant Watcher] Fulfillment error:', fErr);
          }

          // Process voucher usage if applied
          if (order.voucherId) {
            const { useVoucher } = require('../pricing');
            await useVoucher(order.voucherId).catch(() => {});
          }
        }
      }
    } catch (e) {
      // Ignore transient errors in background loop
    }
  }, 1500); // Check every 1.5 seconds for lightning fast 1-second auto completion!
}

/**
 * Check payment status (Real-time check against RamaShop API)
 */
async function checkPaymentStatus(ctx, orderId) {
  const lang = await getUserLang(ctx.from.id);
  try {
    const doc = await db.collection('orders').doc(orderId).get();
    if (!doc.exists) return ctx.answerCbQuery('Order tidak ditemukan.', { show_alert: true }).catch(() => {});

    const order = doc.data();

    if (order.status === 'success' || order.status === 'paid') {
      return ctx.answerCbQuery('✅ Pembayaran sudah terverifikasi!', { show_alert: true }).catch(() => {});
    }

    // Real-time check via RamaShop deposit status endpoint
    if (order.ramashopDepositId) {
      try {
        const res = await checkStatus(order.ramashopDepositId);
        const statusStr = res.data?.status || res.status;

        if (statusStr === 'success' || statusStr === 'already' || res.status === true && res.data?.status === 'success') {
          await db.collection('orders').doc(orderId).update({ status: 'paid' });
          const { fulfillOrder } = require('../fulfillment');
          await fulfillOrder(orderId);
          return ctx.answerCbQuery('🎉 Pembayaran Berhasil! Pesanan diproses.', { show_alert: true }).catch(() => {});
        }
      } catch (checkErr) {
        console.error('Check status API error:', checkErr.message);
      }
    }

    const statusMap = {
      pending: '⏳ Menunggu pembayaran (Belum terdeteksi di QRIS)',
      paid: '✅ Pembayaran Berhasil!',
      success: '✅ Pesanan Berhasil!',
      failed: '❌ Gagal atau Expired',
      processing: '⚙️ Sedang diproses admin',
    };

    ctx.answerCbQuery(statusMap[order.status] || `Status: ${order.status}`, { show_alert: true }).catch(() => {});
  } catch (err) {
    console.error('checkPaymentStatus error:', err);
    ctx.answerCbQuery('Gagal memeriksa status.', { show_alert: true }).catch(() => {});
  }
}

/**
 * Cancel order
 */
async function cancelOrder(ctx, orderId) {
  const lang = await getUserLang(ctx.from.id);
  try {
    const doc = await db.collection('orders').doc(orderId).get();
    if (!doc.exists) return ctx.answerCbQuery('Order tidak ditemukan.', { show_alert: true }).catch(() => {});

    const order = doc.data();
    if (order.status !== 'pending') {
      return ctx.answerCbQuery('Order tidak bisa dibatalkan.', { show_alert: true }).catch(() => {});
    }

    try {
      await cancelPayment(orderId);
    } catch {}

    await db.collection('orders').doc(orderId).update({ status: 'cancelled' });

    ctx.answerCbQuery(t(lang, 'payment_cancelled')).catch(() => {});
    ctx.deleteMessage().catch(() => {});
  } catch (err) {
    console.error('cancelOrder error:', err);
    ctx.answerCbQuery('Gagal membatalkan.', { show_alert: true }).catch(() => {});
  }
}

/**
 * Admin approve manual order
 */
async function handleApproveOrder(ctx, orderId) {
  try {
    const doc = await db.collection('orders').doc(orderId).get();
    if (!doc.exists) return ctx.answerCbQuery('Order tidak ditemukan.', { show_alert: true }).catch(() => {});

    const { fulfillOrder } = require('../fulfillment');
    await fulfillOrder(orderId);

    ctx.answerCbQuery('✅ Order di-approve!').catch(() => {});
    ctx.editMessageText(`✅ Order <code>${escapeHTML(orderId)}</code> telah di-approve dan diproses.`, { parse_mode: 'HTML' }).catch(() => {});
  } catch (err) {
    console.error('handleApproveOrder error:', err);
    ctx.answerCbQuery('Gagal approve.', { show_alert: true }).catch(() => {});
  }
}

/**
 * Admin reject order
 */
async function handleRejectOrder(ctx, orderId) {
  try {
    const doc = await db.collection('orders').doc(orderId).get();
    if (!doc.exists) return;

    const order = doc.data();
    await db.collection('orders').doc(orderId).update({ status: 'rejected' });

    // Refund if paid with saldo
    if (order.paymentMethod === 'saldo' && order.telegramUserId) {
      const userRef = db.collection('bot_users').doc(order.telegramUserId);
      const userDoc = await userRef.get();
      if (userDoc.exists) {
        const currentBalance = userDoc.data().balance || 0;
        await userRef.update({ balance: currentBalance + order.totalPrice });
      }
    }

    ctx.answerCbQuery('❌ Order di-reject.').catch(() => {});
    ctx.editMessageText(`❌ Order <code>${escapeHTML(orderId)}</code> di-reject. Saldo di-refund.`, { parse_mode: 'HTML' }).catch(() => {});

    // Notify user
    if (order.telegramUserId) {
      ctx.telegram.sendMessage(order.telegramUserId,
        `❌ Pesanan <code>${escapeHTML(orderId)}</code> ditolak oleh admin.\nSaldo telah dikembalikan.`,
        { parse_mode: 'HTML' }
      ).catch(() => {});
    }
  } catch (err) {
    console.error('handleRejectOrder error:', err);
  }
}

module.exports = {
  handleBalancePayment,
  handleQRISPayment,
  handleTopupQRIS,
  checkPaymentStatus,
  cancelOrder,
  handleApproveOrder,
  handleRejectOrder,
};
