const { db, admin } = require('./firebase');
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
      let warrantyDays = Number(order.warrantyDays || 0);
      let renewEnabled = Boolean(order.renewEnabled);
      let maxRenew = Number(order.maxRenew || 1);
      let renewDelayDays = Number(order.renewDelayDays || 0);

      // Decrement manual variant stock if set
      if (order.productId) {
        try {
          const pRef = db.collection('products').doc(order.productId);
          const pDoc = await pRef.get();
          if (pDoc.exists) {
            const pData = pDoc.data();
            const variants = pData.variants || [];
            const vIdx = order.variantIndex !== undefined ? order.variantIndex : variants.findIndex(v => v.label === order.variantLabel);
            const variant = (vIdx >= 0 && variants[vIdx]) ? variants[vIdx] : variants[0];
            if (variant) {
              if (variant.warrantyDays !== undefined) warrantyDays = Number(variant.warrantyDays || 0);
              if (variant.renewEnabled !== undefined) renewEnabled = Boolean(variant.renewEnabled);
              if (variant.maxRenew !== undefined) maxRenew = Number(variant.maxRenew || 1);
              if (variant.renewDelayDays !== undefined) renewDelayDays = Number(variant.renewDelayDays || 0);
              if (variant.stock > 0) {
                variants[vIdx].stock = Math.max(0, variants[vIdx].stock - (order.quantity || 1));
                await pRef.update({ variants, updatedAt: new Date().toISOString() });
              }
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
        warrantyDays,
        renewEnabled,
        maxRenew,
        renewDelayDays,
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
 * Helper to format credential item
 */
function formatCredentialItem(credText, index) {
function formatCredentialItem(credItem, index) {
  if (!credItem) return `<b><u>AKUN #${index + 1}</u></b>\n-`;

  let raw = '';
  let username = '';
  let password = '';
  let email = '';
  let f2aSecret = '';
  let profile = '';

  if (typeof credItem === 'object') {
    raw = (credItem.data || credItem.text || '').toString().trim();
    username = credItem.username || '';
    password = credItem.password || '';
    email = credItem.email || '';
    f2aSecret = credItem.f2aSecret || '';
    profile = credItem.profile || '';
  } else {
    raw = (credItem || '').toString().trim();
  }

  if (username || password || email || f2aSecret || profile) {
    let out = `<b><u>AKUN #${index + 1}</u></b>\n`;
    if (username) out += `👤 <b>User</b>     : <code>${escapeHTML(username)}</code>\n`;
    if (password) out += `🔑 <b>Password</b> : <code>${escapeHTML(password)}</code>\n`;
    if (email)    out += `📧 <b>Email</b>    : <code>${escapeHTML(email)}</code>\n`;
    if (f2aSecret) out += `🔐 <b>F2A</b>      : <code>${escapeHTML(f2aSecret)}</code>\n`;
    if (profile)  out += `👤 <b>Profil</b>   : <code>${escapeHTML(profile)}</code>\n`;
    return out.trim();
  }

  if (raw.includes('|')) {
    const parts = raw.split('|').map(s => s.trim());
    let out = `<b><u>AKUN #${index + 1}</u></b>\n`;
    if (parts[0]) out += `👤 <b>User</b>     : <code>${escapeHTML(parts[0])}</code>\n`;
    if (parts[1]) out += `🔑 <b>Password</b> : <code>${escapeHTML(parts[1])}</code>\n`;
    if (parts[2]) out += `📧 <b>Email</b>    : <code>${escapeHTML(parts[2])}</code>\n`;
    if (parts[3]) out += `🔐 <b>F2A</b>      : <code>${escapeHTML(parts[3])}</code>\n`;
    if (parts[4]) out += `👤 <b>Profil</b>   : <code>${escapeHTML(parts[4])}</code>\n`;
    return out.trim();
  }

  return `<b><u>AKUN #${index + 1}</u></b>\n<code>${escapeHTML(raw)}</code>`;
}

function formatAllCredentialsText(credentials) {
  return credentials.map((c, i) => formatCredentialItem(c, i)).join('\n\n----------------------------------------\n\n');
}

/**
 * Auto-fulfill from credentials pool
 */
async function autoFulfill(orderId, order, orderRef) {
  try {
    const qty = order.quantity || 1;
    const poolSnap = await db.collection('credentials_pool')
      .where('productId', '==', order.productId)
      .where('variantLabel', '==', order.variantLabel)
      .where('isUsed', '==', false)
      .limit(qty)
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
      credentials.push(credDoc.data());
    }

    const credText = credentials.map(c => typeof c === 'object' ? (c.data || c.text || '') : c).join('\n');

    let variantNotes = '';
    let warrantyDays = Number(order.warrantyDays || 0);
    let renewEnabled = Boolean(order.renewEnabled);
    let maxRenew = Number(order.maxRenew || 1);
    let renewDelayDays = Number(order.renewDelayDays || 0);

    if (order.productId) {
      try {
        const pDoc = await db.collection('products').doc(order.productId).get();
        if (pDoc.exists) {
          const pData = pDoc.data();
          const variant = (pData.variants || []).find(v => v.label === order.variantLabel) || pData.variants?.[0];
          if (variant) {
            if (variant.warrantyDays !== undefined) warrantyDays = Number(variant.warrantyDays || 0);
            if (variant.renewEnabled !== undefined) renewEnabled = Boolean(variant.renewEnabled);
            if (variant.maxRenew !== undefined) maxRenew = Number(variant.maxRenew || 1);
            if (variant.renewDelayDays !== undefined) renewDelayDays = Number(variant.renewDelayDays || 0);
            if (variant.notes) variantNotes = variant.notes.trim();
          }
        }
      } catch (e) {}
    }

    const deliveredAt = new Date().toISOString();

    await orderRef.update({
      status: 'success',
      credentials: credText,
      deliveredAt,
      warrantyDays,
      renewEnabled,
      maxRenew,
      renewDelayDays,
      renewCount: order.renewCount || 0,
    });

    const updatedOrder = {
      ...order,
      id: orderId,
      status: 'success',
      deliveredAt,
      warrantyDays,
      renewEnabled,
      maxRenew,
      renewDelayDays,
      renewCount: order.renewCount || 0,
    };

    if (order.productId) {
      db.collection('products').doc(order.productId).update({
        totalSold: admin.firestore.FieldValue.increment(order.quantity || 1)
      }).catch(() => {});
    }

    // Send to user
    if (order.telegramUserId) {
      const { t } = require('./i18n');
      const { buildOrderActionButtons } = require('./handlers/warranty-renew');

      // Check if product requires customer email invite
      let requiresEmail = Boolean(order.requiresEmail);
      if (!requiresEmail && order.productId) {
        try {
          const pDoc = await db.collection('products').doc(order.productId).get();
          if (pDoc.exists) requiresEmail = Boolean(pDoc.data()?.requiresEmail);
        } catch (e) {}
      }

      let extraMsg = '';
      const actionButtons = buildOrderActionButtons(updatedOrder);
      let inlineButtons = [];

      if (requiresEmail) {
        extraMsg = '\n\n📧 <i>Produk ini membutuhkan email untuk proses invite. Silakan klik tombol <b>"📧 Kirim Email"</b> di bawah:</i>';
        inlineButtons.push([Markup.button.callback('📧 Kirim Email', `input_invite_email_${orderId}`)]);
      }
      if (actionButtons.length > 0) {
        inlineButtons = inlineButtons.concat(actionButtons);
      }

      let replyOptions = { parse_mode: 'HTML' };
      if (inlineButtons.length > 0) {
        replyOptions = { parse_mode: 'HTML', ...Markup.inlineKeyboard(inlineButtons) };
      }

      const formattedCredsText = formatAllCredentialsText(credentials);

      if (qty === 1) {
        // Quantity = 1: Send as TEXT MESSAGE directly
        let msgText = `🔑 <b>DATA PESANAN ANDA:</b>\n\n${formatCredentialItem(credentials[0], 0)}\n\n✅ <b>ORDER BERHASIL</b>`;
        if (variantNotes) {
          msgText += `\n\n${escapeHTML(variantNotes)}`;
        }
        msgText += extraMsg;
        msgText += `\n\n💬 <i>Jika ada kendala, silakan hubungi CS kami untuk bantuan lebih lanjut.</i>`;

        await bot.telegram.sendMessage(order.telegramUserId, msgText, replyOptions).catch(() => {});
      } else {
        // Quantity > 1: Send as .txt file document + text message
        const fileBuffer = Buffer.from(formattedCredsText, 'utf-8');
        await bot.telegram.sendDocument(order.telegramUserId,
          { source: fileBuffer, filename: `pesanan_${orderId}.txt` },
          { caption: `📄 <b>Detail Akun (${qty} Akun): ${escapeHTML(order.productName)}</b>`, parse_mode: 'HTML' }
        ).catch(() => {});

        let msgText = `🎉 <b>ORDER BERHASIL (#${escapeHTML(orderId)})</b>\n` +
          `────────────────────────────\n` +
          `• <b>Produk</b> : <b>${escapeHTML(order.productName)}</b> (${escapeHTML(order.variantLabel)})\n` +
          `• <b>Jumlah</b> : <b>${qty}</b> akun\n` +
          `• <b>Total</b>  : <b>${formatIDR(order.totalPrice)}</b>\n` +
          `────────────────────────────\n` +
          `📄 <i>Detail akun pesanan Anda dikirimkan via file .txt di atas.</i>`;

        if (variantNotes) {
          msgText += `\n\n${escapeHTML(variantNotes)}`;
        }
        msgText += extraMsg;
        msgText += `\n\n💬 <i>Jika ada kendala, silakan hubungi CS kami untuk bantuan lebih lanjut.</i>`;

        await bot.telegram.sendMessage(order.telegramUserId, msgText, replyOptions).catch(() => {});
      }

      // Send Rating & Review prompt to user
      try {
        const { sendRatingPrompt } = require('./handlers/reviews');
        await sendRatingPrompt(bot, order.telegramUserId, orderId);
      } catch (rErr) {
        console.error('Error sending rating prompt:', rErr.message);
      }
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
