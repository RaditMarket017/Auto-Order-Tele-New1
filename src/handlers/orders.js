const { Markup } = require('telegraf');
const { db } = require('../firebase');
const { formatIDR, escapeHTML, stripHTMLTags } = require('../helpers');
const { t } = require('../i18n');
const { getProductPrice } = require('../pricing');
const { setCart, getCart } = require('../session');

async function getUserLang(userId) {
  try {
    const doc = await db.collection('bot_users').doc(userId.toString()).get();
    return (doc.exists && doc.data().language) ? doc.data().language : 'id';
  } catch { return 'id'; }
}

/**
 * Show order summary for a product + variant
 */
async function showOrderSummary(ctx, productId, variantIndex) {
  const userId = ctx.from.id;
  const lang = await getUserLang(userId);

  try {
    const doc = await db.collection('products').doc(productId).get();
    if (!doc.exists) return ctx.answerCbQuery('Produk tidak ditemukan.', { show_alert: true }).catch(() => {});

    const product = doc.data();
    const variant = product.variants?.[variantIndex];
    if (!variant) return ctx.answerCbQuery('Varian tidak ditemukan.', { show_alert: true }).catch(() => {});

    // Check stock in credentials_pool or variant.stock
    const poolSnap = await db.collection('credentials_pool')
      .where('productId', '==', productId)
      .where('variantLabel', '==', variant.label)
      .where('isUsed', '==', false)
      .get();

    const isReqEmail = Boolean(product.requiresEmail || variant.inviteEnabled);
    const availableStock = isReqEmail
      ? ((variant.stock !== undefined && variant.stock !== null) ? Number(variant.stock) : 0)
      : ((poolSnap.size > 0 || variant.stock === undefined || variant.stock === null) ? poolSnap.size : Number(variant.stock || 0));

    if (availableStock <= 0) {
      return ctx.answerCbQuery(stripHTMLTags(t(lang, 'product_out_of_stock')), { show_alert: true }).catch(() => {});
    }

    const unitPrice = await getProductPrice(variant, userId);
    const qty = 1;
    const total = unitPrice * qty;

    // Save to session/cart
    const cartData = {
      productId,
      productName: product.name,
      variantIndex,
      variantLabel: variant.label,
      unitPrice,
      qty,
      total,
      deliveryType: product.deliveryType || 'instant',
    };
    await setCart(userId, cartData);

    await renderOrderSummary(ctx, cartData, lang, false);
    ctx.answerCbQuery().catch(() => {});
  } catch (err) {
    console.error('showOrderSummary error:', err);
    ctx.reply(t(lang, 'error_general'), { parse_mode: 'HTML' });
  }
}

/**
 * Render order summary message
 */
async function renderOrderSummary(ctx, cart, lang, isEdit = true) {
  if (typeof lang !== 'string') {
    lang = await getUserLang(ctx.from.id);
  }

  const rawVariant = cart.variantLabel || '-';
  const lines = rawVariant.split('\n').map(l => l.trim()).filter(Boolean);
  const varianTitle = lines[0] || rawVariant;

  let durasi = cart.duration || '-';
  let keterangan = cart.keterangan || '-';

  if (lines.length > 1) {
    lines.slice(1).forEach(l => {
      if (/durasi/i.test(l)) {
        durasi = l.replace(/^[⏳📌\s]*durasi\s*:\s*/i, '').trim();
      } else if (/keterangan|hasil\s+give/i.test(l)) {
        keterangan = l.replace(/^[⏳📌\s]*(keterangan\s*:\s*)?/i, '').trim();
      }
    });
  }

  let sisaStok = 0;
  let terjualCount = 0;
  if (cart.productId) {
    try {
      const prodDoc = await db.collection('products').doc(cart.productId).get();
      if (prodDoc.exists) {
        const prodData = prodDoc.data();
        const variantObj = prodData.variants?.[cart.variantIndex] || prodData.variants?.[0];
        if (variantObj) {
          const isReqEmail = Boolean(prodData.requiresEmail || variantObj.inviteEnabled);
          const poolSnap = await db.collection('credentials_pool')
            .where('productId', '==', cart.productId)
            .where('variantLabel', '==', cart.variantLabel)
            .where('isUsed', '==', false)
            .get();
          sisaStok = isReqEmail
            ? ((variantObj.stock !== undefined && variantObj.stock !== null) ? Number(variantObj.stock) : 0)
            : ((poolSnap.size > 0 || variantObj.stock === undefined || variantObj.stock === null) ? poolSnap.size : Number(variantObj.stock || 0));
        }
      }

      const ordersSnap = await db.collection('orders')
        .where('productId', '==', cart.productId)
        .where('variantLabel', '==', cart.variantLabel)
        .where('status', 'in', ['success', 'paid', 'completed'])
        .get();
      terjualCount = ordersSnap.size;
    } catch (e) {
      console.error('Error fetching stock/sold details:', e);
    }
  }

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Jakarta' });

  let msg = t(lang, 'order_summary', {
    product: escapeHTML(cart.productName),
    variant: escapeHTML(varianTitle),
    duration: escapeHTML(durasi),
    keterangan: escapeHTML(keterangan),
    stock: String(sisaStok),
    sold: String(terjualCount),
    qty: cart.qty,
    unitPrice: formatIDR(cart.unitPrice),
    subtotal: formatIDR(cart.unitPrice * cart.qty),
    total: formatIDR(cart.total),
    time: timeStr,
  });

  if (cart.voucherCode) {
    msg += '\n' + t(lang, 'order_voucher_applied', {
      code: escapeHTML(cart.voucherCode),
      discount: formatIDR(cart.voucherDiscount),
    });
  }

  const { getGatewayConfig } = require('../ramashop');
  const gwConfig = getGatewayConfig();

  const qrisRow = [];
  if (gwConfig.hasDualGateways) {
    qrisRow.push(Markup.button.callback('📱 QRIS 1', `pay_qris1_${cart.productId}_${cart.variantIndex}`));
    qrisRow.push(Markup.button.callback('📱 QRIS 2', `pay_qris2_${cart.productId}_${cart.variantIndex}`));
  } else {
    qrisRow.push(Markup.button.callback('📱 QRIS 1', `pay_qris1_${cart.productId}_${cart.variantIndex}`));
    qrisRow.push(Markup.button.callback('💳 Saldo', `pay_saldo_${cart.productId}_${cart.variantIndex}`));
  }

  const buttons = [
    // Qty controls
    [
      Markup.button.callback('−1', `qty_dec_1`),
      Markup.button.callback(`📦 ${cart.qty}`, 'noop'),
      Markup.button.callback('+1', `qty_inc_1`),
    ],
    [
      Markup.button.callback('−5', `qty_dec_5`),
      Markup.button.callback('+5', `qty_inc_5`),
    ],
    // Voucher
    [Markup.button.callback('🎟 Pakai Voucher', 'apply_voucher')],
    // Payment
    qrisRow,
  ];

  if (gwConfig.hasDualGateways) {
    buttons.push([Markup.button.callback('💳 Saldo', `pay_saldo_${cart.productId}_${cart.variantIndex}`)]);
  }

  buttons.push([Markup.button.callback(t(lang, 'btn_cancel'), `cancel_cart`)]);

  const keyboard = Markup.inlineKeyboard(buttons);

  if (isEdit) {
    if (ctx.callbackQuery?.message?.photo) {
      return ctx.editMessageCaption(msg, { parse_mode: 'HTML', ...keyboard }).catch(() => {});
    }
    return ctx.editMessageText(msg, { parse_mode: 'HTML', ...keyboard }).catch(() => {});
  }

  return ctx.reply(msg, { parse_mode: 'HTML', ...keyboard });
}

/**
 * Adjust quantity in cart
 */
async function adjustQuantity(ctx, change) {
  const userId = ctx.from.id;
  const lang = await getUserLang(userId);

  try {
    const cart = await getCart(userId);
    if (!cart) return ctx.answerCbQuery('Tidak ada pesanan aktif.', { show_alert: true }).catch(() => {});

    // Get product & variant details
    const doc = await db.collection('products').doc(cart.productId).get();
    if (!doc.exists) return ctx.answerCbQuery('Produk tidak ditemukan.', { show_alert: true }).catch(() => {});

    const product = doc.data();
    const variant = product.variants?.[cart.variantIndex];
    if (!variant) return ctx.answerCbQuery('Varian tidak ditemukan.', { show_alert: true }).catch(() => {});

    // Calculate actual available stock
    const isReqEmail = Boolean(product.requiresEmail || variant.inviteEnabled);
    const poolSnap = await db.collection('credentials_pool')
      .where('productId', '==', cart.productId)
      .where('variantLabel', '==', variant.label)
      .where('isUsed', '==', false)
      .get();

    const maxStock = isReqEmail
      ? ((variant.stock !== undefined && variant.stock !== null) ? Number(variant.stock) : 0)
      : ((poolSnap.size > 0 || variant.stock === undefined || variant.stock === null) ? poolSnap.size : Number(variant.stock || 0));

    if (maxStock <= 0) {
      return ctx.answerCbQuery(stripHTMLTags(t(lang, 'product_out_of_stock')), { show_alert: true }).catch(() => {});
    }

    let newQty = cart.qty + change;
    let reachedLimit = false;

    if (newQty > maxStock) {
      newQty = maxStock;
      reachedLimit = true;
    }
    if (newQty < 1) {
      newQty = 1;
    }

    const { getProductPrice } = require('../pricing');
    const unitPrice = await getProductPrice(variant, userId, newQty, product);

    cart.qty = newQty;
    cart.unitPrice = unitPrice;
    cart.total = unitPrice * newQty;

    // Recalculate voucher if applied
    if (cart.voucherId) {
      const { applyVoucher } = require('../pricing');
      const result = await applyVoucher(cart.voucherCode, cart.total, cart.productId);
      if (result.valid) {
        cart.voucherDiscount = result.discount;
        cart.total = result.finalPrice;
      }
    }

    await setCart(userId, cart);

    if (reachedLimit) {
      ctx.answerCbQuery(`⚠️ Stok maksimal tersedia: ${maxStock} pcs`, { show_alert: true }).catch(() => {});
    } else {
      ctx.answerCbQuery(`Qty: ${newQty}`).catch(() => {});
    }

    await renderOrderSummary(ctx, cart, lang, true);
  } catch (err) {
    console.error('adjustQuantity error:', err);
  }
}

module.exports = {
  showOrderSummary,
  renderOrderSummary,
  adjustQuantity,
};
