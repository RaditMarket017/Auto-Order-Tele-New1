const { db } = require('./firebase');
const { Telegraf, Markup } = require('telegraf');
const { formatIDR, escapeHTML } = require('./helpers');
const config = require('./config');

// Bot instance for sending messages from webhook context
const bot = new Telegraf(process.env.BOT_TOKEN);

/**
 * Fulfill an order — deliver credentials to user
 */
async function fulfillOrder(orderId) {
  try {
    let orderRef = db.collection('orders').doc(orderId);
    let orderDoc = await orderRef.get();

    // Try alternate lookups
    if (!orderDoc.exists) {
      const txSnap = await db.collection('orders').where('ramashopTransactionId', '==', orderId).limit(1).get();
      if (!txSnap.empty) { orderDoc = txSnap.docs[0]; orderRef = orderDoc.ref; orderId = orderDoc.id; }
    }
    if (!orderDoc.exists) {
      const idSnap = await db.collection('orders').where('id', '==', orderId).limit(1).get();
      if (!idSnap.empty) { orderDoc = idSnap.docs[0]; orderRef = orderDoc.ref; orderId = orderDoc.id; }
    }

    if (!orderDoc.exists) {
      console.error(`Order ${orderId} not found`);
      return { success: false, error: 'Order not found' };
    }

    const order = orderDoc.data();
    if (order.status === 'success') return { success: true, message: 'Already fulfilled' };

    // Delete QRIS message if exists
    if (order.paymentMessageId) {
      bot.telegram.deleteMessage(order.telegramUserId, order.paymentMessageId).catch(() => {});
    }

    // ═══ TOPUP ═══
    if (order.type === 'topup' || String(orderId).startsWith('TOPUP-')) {
      const userRef = db.collection('bot_users').doc(order.telegramUserId);

      await db.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);
        const currentBalance = userDoc.exists ? (userDoc.data().balance || 0) : 0;
        const amount = order.totalPrice || 0;
        transaction.update(userRef, { balance: currentBalance + amount });
        transaction.update(orderRef, { status: 'success' });
      });

      if (order.telegramUserId) {
        const { t } = require('./i18n');
        await bot.telegram.sendMessage(order.telegramUserId,
          t('id', 'topup_success', { amount: formatIDR(order.totalPrice) }),
          { parse_mode: 'HTML' }
        ).catch(() => {});
      }

      // Notify Admin on Top-up success
      if (config.ADMIN_ID) {
        await bot.telegram.sendMessage(config.ADMIN_ID,
          `<b>💰 TOP-UP SALDO SUKSES</b>\n` +
          `────────────────────────────\n` +
          `• <b>Order ID</b>  : <code>${escapeHTML(orderId)}</code>\n` +
          `• <b>Pembeli</b>   : <b>${escapeHTML(order.customerName || 'User')}</b> (<code>${order.telegramUserId}</code>)\n` +
          `• <b>Nominal</b>   : <b>${formatIDR(order.totalPrice)}</b>\n` +
          `• <b>Metode</b>    : <b>QRIS Instan</b>\n` +
          `────────────────────────────\n` +
          `✅ <i>Saldo pengguna telah otomatis ditambahkan!</i>`,
          { parse_mode: 'HTML' }
        ).catch(() => {});
      }

      return { success: true, type: 'topup' };
    }

    // ═══ RESELLER ACTIVATION ═══
    if (order.type === 'reseller_activation') {
      const userRef = db.collection('bot_users').doc(order.telegramUserId);
      const updateData = { role: 'reseller', resellerActivatedAt: new Date().toISOString() };
      if (order.resellerExpiry) updateData.resellerExpiry = order.resellerExpiry;
      await userRef.update(updateData);
      await orderRef.update({ status: 'success' });
      return { success: true, type: 'reseller' };
    }

    // Check if product requires customer email invite
    let isRequiresEmail = Boolean(order.requiresEmail);
    if (!isRequiresEmail && order.productId) {
      try {
        const pDoc = await db.collection('products').doc(order.productId).get();
        if (pDoc.exists) isRequiresEmail = Boolean(pDoc.data()?.requiresEmail);
      } catch (e) {}
    }

    // ═══ PRODUCT — EMAIL INVITE DELIVERY ═══
    if (isRequiresEmail) {
      // Decrement manual variant stock if set
      if (order.productId) {
        try {
          const pRef = db.collection('products').doc(order.productId);
          const pDoc = await pRef.get();
          if (pDoc.exists) {
            const pData = pDoc.data();
            const variants = pData.variants || [];
            const vIdx = order.variantIndex !== undefined ? order.variantIndex : variants.findIndex(v => v.label === order.variantLabel);
            if (vIdx >= 0 && variants[vIdx] && variants[vIdx].stock > 0) {
              variants[vIdx].stock = Math.max(0, variants[vIdx].stock - (order.quantity || 1));
              await pRef.update({ variants, updatedAt: new Date().toISOString() });
            }
          }
        } catch (e) {
          console.error('Error updating variant stock:', e);
        }
      }

      await orderRef.update({
        status: 'processing',
        requiresEmail: true,
        inviteStatus: 'waiting_email_input',
        updatedAt: new Date().toISOString(),
      });

      if (order.telegramUserId) {
        const { t } = require('./i18n');
        const extraMsg = '\n\n📧 <i>Produk ini membutuhkan email untuk proses invite. Silakan klik tombol <b>"📧 Kirim Email"</b> di bawah:</i>';
        const replyOptions = {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('📧 Kirim Email', `input_invite_email_${orderId}`)],
          ]),
        };

        const sentMsg = await bot.telegram.sendMessage(order.telegramUserId,
          t('id', 'payment_success', {
            orderId: escapeHTML(orderId),
            product: escapeHTML(order.productName),
            variant: escapeHTML(order.variantLabel),
            total: formatIDR(order.totalPrice),
            method: order.paymentMethod === 'saldo' ? 'Saldo' : 'QRIS',
          }) + extraMsg,
          replyOptions
        ).catch(() => {});

        if (sentMsg?.message_id) {
          await orderRef.update({ customerMsgId: sentMsg.message_id }).catch(() => {});
        }
      }

      return { success: true, type: 'email_invite' };
    }

    // ═══ PRODUCT — INSTANT DELIVERY ═══
    if (order.deliveryType === 'instant') {
      return await autoFulfill(orderId, order, orderRef);
    }

    // ═══ PRODUCT — MANUAL DELIVERY ═══
    await orderRef.update({ status: 'processing' });

    // Notify admin
    await bot.telegram.sendMessage(config.ADMIN_ID,
      `<b>🔔 ORDER MASUK MANUAL</b>\n` +
      `────────────────────────────\n` +
      `• <b>Order ID</b> : <code>${escapeHTML(orderId)}</code>\n` +
      `• <b>User</b>     : <b>${escapeHTML(order.customerName)}</b>\n` +
      `• <b>Produk</b>   : <b>${escapeHTML(order.productName)}</b>\n` +
      `• <b>Varian</b>   : <b>${escapeHTML(order.variantLabel)}</b>\n` +
      `• <b>Jumlah</b>   : <b>${order.quantity || 1}</b> pcs\n` +
      `• <b>Total</b>    : <b>${formatIDR(order.totalPrice)}</b>\n` +
      `────────────────────────────\n` +
      `⚙️ <i>Pesanan manual, harap proses segera!</i>`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ Approve', `approve_${orderId}`),
            Markup.button.callback('❌ Reject', `reject_${orderId}`),
          ],
        ]),
      }
    ).catch(() => {});

    // Notify user
    if (order.telegramUserId) {
      const { t } = require('./i18n');
      await bot.telegram.sendMessage(order.telegramUserId,
        t('id', 'payment_waiting', {
          orderId: escapeHTML(orderId),
          product: escapeHTML(order.productName),
          total: formatIDR(order.totalPrice),
        }),
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔔 Ingatkan Admin', `ping_admin_${orderId}`)],
          ]),
        }
      ).catch(() => {});
    }

    return { success: true, type: 'manual' };
  } catch (err) {
    console.error('fulfillOrder error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Auto-fulfill from credentials pool
 */
async function autoFulfill(orderId, order, orderRef) {
  try {
    const poolSnap = await db.collection('credentials_pool')
      .where('productId', '==', order.productId)
      .where('variantLabel', '==', order.variantLabel)
      .where('isUsed', '==', false)
      .limit(order.quantity || 1)
      .get();

    if (poolSnap.empty) {
      await orderRef.update({ status: 'processing' });
      bot.telegram.sendMessage(config.ADMIN_ID,
        `<b>⚠️ STOK AKUN HABIS — PERLU PERHATIAN ADMIN</b>\n` +
        `────────────────────────────\n` +
        `• <b>Order ID</b>  : <code>${escapeHTML(orderId)}</code>\n` +
        `• <b>Produk</b>    : <b>${escapeHTML(order.productName)}</b> (${escapeHTML(order.variantLabel)})\n` +
        `• <b>Pembeli</b>   : <b>${escapeHTML(order.customerName)}</b> (<code>${order.telegramUserId}</code>)\n` +
        `────────────────────────────\n` +
        `⚠️ <i>Stok di Stock Pool kosong. Harap isi stok dari Admin Dashboard!</i>`,
        { parse_mode: 'HTML' }
      ).catch(() => {});
      return { success: false, error: 'Out of stock' };
    }

    const credentials = [];
    for (const credDoc of poolSnap.docs) {
      await credDoc.ref.update({
        isUsed: true,
        orderId,
        usedAt: new Date().toISOString(),
      });
      credentials.push(credDoc.data().data);
    }

    const credText = credentials.join('\n');

    await orderRef.update({
      status: 'success',
      credentials: credText,
      deliveredAt: new Date().toISOString(),
    });

    // Send to user
    if (order.telegramUserId) {
      const { t } = require('./i18n');

      // Check if product requires customer email invite
      let requiresEmail = Boolean(order.requiresEmail);
      if (!requiresEmail && order.productId) {
        try {
          const pDoc = await db.collection('products').doc(order.productId).get();
          if (pDoc.exists) requiresEmail = Boolean(pDoc.data()?.requiresEmail);
        } catch (e) {}
      }

      let extraMsg = '';
      let replyOptions = { parse_mode: 'HTML' };

      if (requiresEmail) {
        extraMsg = '\n\n📧 <i>Produk ini membutuhkan email untuk proses invite. Silakan klik tombol <b>"📧 Kirim Email"</b> di bawah:</i>';
        replyOptions = {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('📧 Kirim Email', `input_invite_email_${orderId}`)],
          ]),
        };
      }

      // Text notification
      await bot.telegram.sendMessage(order.telegramUserId,
        t('id', 'payment_success', {
          orderId: escapeHTML(orderId),
          product: escapeHTML(order.productName),
          variant: escapeHTML(order.variantLabel),
          total: formatIDR(order.totalPrice),
          method: order.paymentMethod === 'saldo' ? 'Saldo' : 'QRIS',
        }) + extraMsg,
        replyOptions
      ).catch(() => {});

      // Send as .txt file
      const fileBuffer = Buffer.from(credText, 'utf-8');
      await bot.telegram.sendDocument(order.telegramUserId,
        { source: fileBuffer, filename: `akun_${orderId}.txt` },
        { caption: `📄 Detail Akun: ${order.productName}` }
      ).catch((err) => {
        // Fallback: send as text
        bot.telegram.sendMessage(order.telegramUserId,
          `🔑 <b>Detail Akun:</b>\n<pre>${escapeHTML(credText)}</pre>`,
          { parse_mode: 'HTML' }
        ).catch(() => {});
      });
    }

    // Notify Admin on Instant Order Completion
    if (config.ADMIN_ID) {
      await bot.telegram.sendMessage(config.ADMIN_ID,
        `<b>🛒 PEMBELIAN PRODUK BARU</b>\n` +
        `────────────────────────────\n` +
        `• <b>Order ID</b>  : <code>${escapeHTML(orderId)}</code>\n` +
        `• <b>Pembeli</b>   : <b>${escapeHTML(order.customerName || 'User')}</b> (<code>${order.telegramUserId}</code>)\n` +
        `• <b>Produk</b>    : <b>${escapeHTML(order.productName)}</b>\n` +
        `• <b>Varian</b>    : <b>${escapeHTML(order.variantLabel)}</b>\n` +
        `• <b>Jumlah</b>    : <b>${order.quantity || 1}</b> pcs\n` +
        `• <b>Total</b>     : <b>${formatIDR(order.totalPrice)}</b>\n` +
        `• <b>Metode</b>    : <b>${(order.paymentMethod || 'QRIS').toUpperCase()}</b>\n` +
        `────────────────────────────\n` +
        `⚡ <i>Status: Produk berhasil dikirim otomatis dari Stok Pool!</i>`,
        { parse_mode: 'HTML' }
      ).catch(() => {});
    }

    // ═══ AUTO TESTIMONI — Generate Nota & Send to Channel & Customer ═══
    await sendNotaAndTestimoni(orderId, order);

    // Notify admin
    bot.telegram.sendMessage(config.ADMIN_ID,
      `✅ AUTO-FULFILL: <code>${escapeHTML(orderId)}</code>`, { parse_mode: 'HTML' }
    ).catch(() => {});

    // Sync stock
    await syncProductStock(order.productId, order.variantLabel);

    return { success: true, type: 'instant' };
  } catch (err) {
    console.error('autoFulfill error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Helper to generate and send Nota Image to Testimoni Channel & Customer
 */
async function sendNotaAndTestimoni(orderId, orderData) {
  try {
    const { generateNotaPNG, sendTestimoniToChannel } = require('./nota-generator');

    // Get store settings
    let storeSettings = {};
    const settingsDoc = await db.collection('settings').doc('store').get();
    if (settingsDoc.exists) storeSettings = settingsDoc.data();
    storeSettings.storeName = storeSettings.storeName || config.STORE_NAME;
    storeSettings.storeLogoUrl = storeSettings.storeLogoUrl || config.STORE_LOGO_URL;

    // Get product details if available
    let productData = {};
    if (orderData.productId) {
      const productDoc = await db.collection('products').doc(orderData.productId).get();
      if (productDoc.exists) productData = productDoc.data();
    }

    const notaBuffer = await generateNotaPNG({
      orderId,
      customerName: orderData.customerName || 'Customer',
      productName: orderData.productName || 'Produk',
      variantLabel: orderData.variantLabel || '-',
      quantity: orderData.quantity || 1,
      unitPrice: orderData.unitPrice || orderData.totalPrice || 0,
      totalPrice: orderData.totalPrice || 0,
      paymentMethod: orderData.paymentMethod || 'QRIS',
      status: 'success',
      apkName: productData.apkName || orderData.productName || 'PRODUK',
      apkLogoUrl: productData.apkLogoUrl || productData.imageUrl || '',
      imageUrl: productData.imageUrl || productData.apkLogoUrl || '',
    }, storeSettings);

    // Send to Testimoni Channel if configured
    const channelId = config.TESTIMONI_CHANNEL_ID;
    if (channelId) {
      await sendTestimoniToChannel(bot, channelId, notaBuffer, {
        orderId,
        customerName: orderData.customerName || 'Customer',
        productName: orderData.productName || 'Produk',
        variantLabel: orderData.variantLabel || '-',
        totalPrice: orderData.totalPrice || 0,
        productDescription: productData.description || productData.desc || productData.details || orderData.productDescription || '',
      }, storeSettings).catch(err => console.error('Error sending testimoni to channel:', err));
    }

    return notaBuffer;
  } catch (err) {
    console.error('sendNotaAndTestimoni error:', err);
    return null;
  }
}

/**
 * Sync product stock from credentials pool
 */
async function syncProductStock(productId, variantLabel) {
  try {
    const productRef = db.collection('products').doc(productId);
    const productSnap = await productRef.get();
    if (!productSnap.exists) return;

    const product = productSnap.data();
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
    await productRef.update({ variants: updatedVariants, stock: totalStock, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('syncProductStock error:', err);
  }
}

module.exports = { fulfillOrder, sendNotaAndTestimoni };
