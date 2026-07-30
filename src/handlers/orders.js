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

    const availableStock = Boolean(product.requiresEmail)
      ? ((variant.stock !== undefined && variant.stock !== null) ? Number(variant.stock) : 0)
      : poolSnap.size;
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
    ctx.reply(t(lang, 'error_general'));
  }
}

/**
 * Render order summary message
 */
async function renderOrderSummary(ctx, cart, lang, isEdit = true) {
  if (typeof lang !== 'string') {
    lang = await getUserLang(ctx.from.id);
  }

  let msg = t(lang, 'order_summary', {
    product: escapeHTML(cart.productName),
    variant: escapeHTML(cart.variantLabel),
    qty: cart.qty,
    unitPrice: formatIDR(cart.unitPrice),
    total: formatIDR(cart.total),
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
    let maxStock = 0;
    if (Boolean(product.requiresEmail)) {
      maxStock = (variant.stock !== undefined && variant.stock !== null) ? Number(variant.stock) : 0;
    } else {
      const poolSnap = await db.collection('credentials_pool')
        .where('productId', '==', cart.productId)
        .where('variantLabel', '==', variant.label)
        .where('isUsed', '==', false)
        .get();
      maxStock = poolSnap.size;
    }

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
