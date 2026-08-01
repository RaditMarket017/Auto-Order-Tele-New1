const { Markup } = require('telegraf');
const { db } = require('../firebase');
const config = require('../config');
const { formatIDR, escapeHTML } = require('../helpers');
const { t } = require('../i18n');
const { getProductPrice, getUserRole } = require('../pricing');

/**
 * Get user language
 */
async function getUserLang(userId) {
  try {
    const doc = await db.collection('bot_users').doc(userId.toString()).get();
    return (doc.exists && doc.data().language) ? doc.data().language : 'id';
  } catch { return 'id'; }
}

/**
 * Get product by display number (sorted by order)
 */
async function getProductByNumber(num) {
  try {
    const snap = await db.collection('products').orderBy('order', 'asc').get();
    const visible = snap.docs.filter(d => d.data().isVisible !== false);
    if (num < 1 || num > visible.length) return null;
    const doc = visible[num - 1];
    return { id: doc.id, ...doc.data() };
  } catch { return null; }
}

/**
 * Show paginated product list
 */
async function showProductList(ctx, page = 0, isEdit = false) {
  const userId = ctx.from.id;
  const lang = await getUserLang(userId);

  try {
    const snap = await db.collection('products').orderBy('order', 'asc').get();
    const products = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(p => p.isVisible !== false);

    if (products.length === 0) {
      const msg = t(lang, 'product_list_choose') + '\n' + t(lang, 'product_list_empty');
      if (isEdit) return ctx.editMessageText(msg, { parse_mode: 'HTML' }).catch(() => {});
      return ctx.reply(msg, { parse_mode: 'HTML' });
    }

    const perPage = config.ITEMS_PER_PAGE;
    const totalPages = Math.ceil(products.length / perPage);
    const currentPage = Math.min(page, totalPages - 1);
    const pageProducts = products.slice(currentPage * perPage, (currentPage + 1) * perPage);
    const startNum = currentPage * perPage + 1;

    let msg = t(lang, 'product_list_choose') + '\n';

    const poolSnap = await db.collection('credentials_pool').where('isUsed', '==', false).get();
    const stockMap = {};
    poolSnap.forEach(d => {
      const pId = d.data().productId;
      stockMap[pId] = (stockMap[pId] || 0) + 1;
    });

    for (let i = 0; i < pageProducts.length; i++) {
      const p = pageProducts[i];
      const isReqEmail = Boolean(p.requiresEmail || (p.variants || []).some(v => v.inviteEnabled));
      const totalStock = isReqEmail
        ? (p.variants || []).reduce((s, v) => s + (Number(v.stock) || 0), 0)
        : (stockMap[p.id] || 0);
      msg += t(lang, 'product_list_item', {
        num: startNum + i,
        name: escapeHTML(p.name).toUpperCase(),
        price: formatIDR(p.basePrice || (p.variants?.[0]?.price || 0)),
        stock: totalStock,
      }) + '\n';
    }

    msg += t(lang, 'product_list_page', { current: currentPage + 1, total: totalPages });

    // Build inline buttons
    const buttons = [];

    // Product selection buttons
    const productRow = [];
    for (let i = 0; i < pageProducts.length; i++) {
      productRow.push(Markup.button.callback(
        `${startNum + i}`,
        `prod_detail_${pageProducts[i].id}`
      ));
      if (productRow.length === 4) {
        buttons.push([...productRow]);
        productRow.length = 0;
      }
    }
    if (productRow.length > 0) buttons.push([...productRow]);

    // Pagination
    const navRow = [];
    if (currentPage > 0) navRow.push(Markup.button.callback('◀ Prev', `page_${currentPage - 1}`));
    if (currentPage < totalPages - 1) navRow.push(Markup.button.callback('Next ▶', `page_${currentPage + 1}`));
    if (navRow.length > 0) buttons.push(navRow);

    const keyboard = Markup.inlineKeyboard(buttons);

    if (isEdit) {
      if (ctx.callbackQuery?.message?.photo) {
        return ctx.editMessageCaption(msg, { parse_mode: 'HTML', ...keyboard }).catch(() => {});
      }
      return ctx.editMessageText(msg, { parse_mode: 'HTML', ...keyboard }).catch(() => {});
    }

    if (config.STORE_BANNER_URL) {
      try {
        return await ctx.replyWithPhoto(config.STORE_BANNER_URL, {
          caption: msg, parse_mode: 'HTML', ...keyboard,
        });
      } catch {}
    }

    return ctx.reply(msg, { parse_mode: 'HTML', ...keyboard });
  } catch (err) {
    console.error('showProductList error:', err);
    return ctx.reply(t(lang, 'error_general'));
  }
}

/**
 * Show product detail with variants
 */
async function showProductDetail(ctx, productId) {
  const userId = ctx.from.id;
  const lang = await getUserLang(userId);

  try {
    const doc = await db.collection('products').doc(productId).get();
    if (!doc.exists) return ctx.answerCbQuery('Produk tidak ditemukan.', { show_alert: true }).catch(() => {});

    const product = { id: doc.id, ...doc.data() };
    const userRole = await getUserRole(userId);
    const variants = product.variants || [];

    // Fetch stock pool items for this product
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

    let msg = t(lang, 'product_detail', {
      name: escapeHTML(product.name),
      description: escapeHTML(product.description || 'Tidak ada deskripsi.'),
    });

    const isReqEmail = Boolean(product.requiresEmail);

    // Add variant list with price and stock per variant
    for (const v of variants) {
      const price = await getProductPrice(v, userId);
      const vStock = (isReqEmail || v.inviteEnabled)
        ? ((v.stock !== undefined && v.stock !== null) ? Number(v.stock) : 0)
        : (stockByVariant[v.label] || 0);
      const stockBadge = vStock > 0 ? `🟢 <b>${vStock}</b>` : `🔴 <b>0 (Habis)</b>`;

      const rawLabel = (v.label || '').trim();
      const lines = rawLabel.split('\n').map(l => l.trim()).filter(Boolean);
      const mainTitle = lines[0] || 'Varian';
      const detailLines = lines.slice(1);

      msg += `\n• <b>${escapeHTML(mainTitle)}</b>`;
      if (detailLines.length > 0) {
        detailLines.forEach(line => {
          let formattedLine = line;
          if (formattedLine.startsWith('📌 ') && !formattedLine.toLowerCase().includes('keterangan')) {
            formattedLine = formattedLine.replace(/^📌\s*/, '📌 Keterangan : ');
          } else if (/^hasil\s+give/i.test(formattedLine)) {
            formattedLine = `📌 Keterangan : ${formattedLine}`;
          }
          msg += `\n  ${escapeHTML(formattedLine)}`;
        });
        msg += `\n  💰 Harga : <b><u>${formatIDR(price)}</u></b> | Stok: ${stockBadge}\n`;
      } else {
        msg += ` ➔ <b><u>${formatIDR(price)}</u></b> (Stok: ${stockBadge})`;
      }
    }

    // Add wholesale tiers if configured
    if (product.wholesaleTiers && product.wholesaleTiers.length > 0) {
      msg += '\n\n<blockquote><b>🏷️ <u>HARGA GROSIR BULK</u></b>\n';
      product.wholesaleTiers.forEach(t => {
        msg += `• Min <b>${t.minQty} pcs</b> : <b><u>${formatIDR(t.price)}</u></b> / pcs\n`;
      });
      msg += '</blockquote>';
    }

    // Variant buy buttons
    const buttons = [];
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      const stock = isReqEmail
        ? ((v.stock !== undefined && v.stock !== null) ? Number(v.stock) : 0)
        : (stockByVariant[v.label] || 0);
      const btnTitle = (v.label || '').split('\n')[0].trim();
      const label = stock > 0 ? `🛒 ${btnTitle}` : `❌ ${btnTitle} (Habis)`;
      buttons.push([Markup.button.callback(label, stock > 0 ? `buy_${productId}_${i}` : `noop`)]);
    }

    buttons.push([
      Markup.button.callback(t(lang, 'btn_refresh'), `refresh_product_${productId}`),
      Markup.button.callback(t(lang, 'btn_back'), 'back_to_list'),
    ]);

    const keyboard = Markup.inlineKeyboard(buttons);

    ctx.answerCbQuery().catch(() => {});

    if (ctx.callbackQuery?.message?.photo) {
      return ctx.editMessageCaption(msg, { parse_mode: 'HTML', ...keyboard }).catch(() => {});
    }

    if (config.STORE_BANNER_URL) {
      try {
        return await ctx.replyWithPhoto(config.STORE_BANNER_URL, {
          caption: msg, parse_mode: 'HTML', ...keyboard,
        });
      } catch {}
    }

    return ctx.reply(msg, { parse_mode: 'HTML', ...keyboard });
  } catch (err) {
    console.error('showProductDetail error:', err);
    ctx.reply(t(lang, 'error_general'));
  }
}

module.exports = {
  showProductList,
  showProductDetail,
  getProductByNumber,
};
