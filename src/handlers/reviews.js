const { db } = require('../firebase');
const { Markup } = require('telegraf');
const { escapeHTML, formatIDR } = require('../helpers');
const config = require('../config');
const { updateSession, getSession } = require('../session');

/**
 * Get aggregated store rating stats from reviews collection
 */
async function getStoreRatingStats() {
  try {
    const reviewsSnap = await db.collection('reviews').get();
    let totalScore = 0;
    let totalReviews = reviewsSnap.size;

    reviewsSnap.forEach(doc => {
      totalScore += (doc.data().rating || 5);
    });

    let averageRating = totalReviews > 0 ? (totalScore / totalReviews).toFixed(1) : '5.0';
    if (parseFloat(averageRating) > 5) averageRating = '5.0';

    // Get total sold
    const soldSnap = await db.collection('orders').where('status', 'in', ['success', 'paid']).count().get();
    const totalSold = soldSnap.data().count || 0;

    // Get total members
    const usersSnap = await db.collection('bot_users').count().get();
    const totalUsers = usersSnap.data().count || 0;

    // Get top product
    let topProduct = '-';
    const topProdSnap = await db.collection('products').orderBy('totalSold', 'desc').limit(1).get();
    if (!topProdSnap.empty) {
      topProduct = topProdSnap.docs[0].data().name || '-';
    }

    return {
      averageRating,
      totalReviews,
      totalSold,
      totalUsers,
      topProduct,
    };
  } catch (err) {
    console.error('getStoreRatingStats error:', err);
    return {
      averageRating: '5.0',
      totalReviews: 0,
      totalSold: 0,
      totalUsers: 0,
      topProduct: '-',
    };
  }
}

/**
 * Save user rating to Firestore
 */
async function saveRating(userId, orderId, rating, comment = '') {
  try {
    const reviewRef = db.collection('reviews').doc(orderId.toString());
    const reviewDoc = await reviewRef.get();

    // Fetch user & order info
    const [userDoc, orderDoc] = await Promise.all([
      db.collection('bot_users').doc(userId.toString()).get(),
      db.collection('orders').doc(orderId.toString()).get(),
    ]);

    const userData = userDoc.exists ? userDoc.data() : {};
    const orderData = orderDoc.exists ? orderDoc.data() : {};

    const reviewData = {
      orderId: orderId.toString(),
      userId: userId.toString(),
      userName: `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'Customer',
      userUsername: userData.username || '',
      productId: orderData.productId || '',
      productName: orderData.productName || 'Produk Digital',
      rating: parseInt(rating),
      comment: comment.trim(),
      updatedAt: new Date().toISOString(),
    };

    if (!reviewDoc.exists) {
      reviewData.createdAt = new Date().toISOString();
    }

    await reviewRef.set(reviewData, { merge: true });

    // Also update orders document
    if (orderDoc.exists) {
      await db.collection('orders').doc(orderId.toString()).update({
        rating: parseInt(rating),
        reviewComment: comment.trim(),
        ratedAt: new Date().toISOString(),
      }).catch(() => {});
    }

    return { success: true, data: reviewData };
  } catch (err) {
    console.error('saveRating error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Send rating & ulasan prompt message to customer after order fulfillment
 */
async function sendRatingPrompt(bot, telegramUserId, orderId) {
  if (!telegramUserId || !orderId) return;

  try {
    const msg =
      `⭐ <b>RATING & ULASAN PESANAN</b>\n` +
      `────────────────────────────\n` +
      `<i>Bagaimana pengalaman berbelanja Anda untuk pesanan <code>#${escapeHTML(orderId)}</code>?</i>\n\n` +
      `👇 <b>Silakan berikan rating atau ulasan Anda di bawah ini:</b>`;

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('⭐ 1', `rate_1_${orderId}`),
        Markup.button.callback('⭐ 2', `rate_2_${orderId}`),
        Markup.button.callback('⭐ 3', `rate_3_${orderId}`),
        Markup.button.callback('⭐ 4', `rate_4_${orderId}`),
        Markup.button.callback('⭐ 5', `rate_5_${orderId}`),
      ],
      [
        Markup.button.callback('📝 Ulasan', `review_text_${orderId}`),
      ],
    ]);

    await bot.telegram.sendMessage(telegramUserId, msg, {
      parse_mode: 'HTML',
      ...keyboard,
    }).catch(err => console.error(`Failed to send rating prompt to ${telegramUserId}:`, err.message));
  } catch (err) {
    console.error('sendRatingPrompt error:', err);
  }
}

/**
 * Register rating & review handlers on bot instance
 */
function registerReviewHandlers(bot) {
  // Callback for star ratings: rate_1_ORDERID, rate_2_ORDERID, etc.
  bot.action(/^rate_([1-5])_(.+)$/, async (ctx) => {
    try {
      const stars = parseInt(ctx.match[1]);
      const orderId = ctx.match[2];
      const userId = ctx.from.id.toString();

      await saveRating(userId, orderId, stars);

      const starsEmoji = '⭐'.repeat(stars);
      await ctx.answerCbQuery(`🎉 Terima kasih! Penilaian ${stars}/5 ⭐ berhasil disimpan.`, { show_alert: true }).catch(() => {});

      const updatedMsg =
        `✅ <b>TERIMA KASIH ATAS PENILAIAN ANDA!</b>\n` +
        `────────────────────────────\n` +
        `• <b>Order ID</b> : <code>${escapeHTML(orderId)}</code>\n` +
        `• <b>Rating</b>   : <b>${starsEmoji} (${stars}/5)</b>\n` +
        `────────────────────────────\n` +
        `💬 <i>Penilaian Anda sangat berharga bagi peningkatan layanan kami!</i>`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📝 Tambah / Edit Ulasan Teks', `review_text_${orderId}`)],
      ]);

      await ctx.editMessageText(updatedMsg, {
        parse_mode: 'HTML',
        ...keyboard,
      }).catch(() => {});
    } catch (err) {
      console.error('rate_ action error:', err);
      ctx.answerCbQuery('❌ Gagal menyimpan rating. Silakan coba lagi.').catch(() => {});
    }
  });

  // Callback for text review request: review_text_ORDERID
  bot.action(/^review_text_(.+)$/, async (ctx) => {
    try {
      const orderId = ctx.match[1];
      const userId = ctx.from.id.toString();

      // Set user session state to wait for review text
      await updateSession(userId, {
        awaitingReviewOrderId: orderId,
        reviewPromptMsgId: ctx.callbackQuery.message?.message_id,
      });

      await ctx.answerCbQuery().catch(() => {});

      const promptMsg =
        `📝 <b>TULIS ULASAN & FEEDBACK</b>\n` +
        `────────────────────────────\n` +
        `• <b>Order ID</b>: <code>${escapeHTML(orderId)}</code>\n\n` +
        `✍️ <b>Silakan ketik dan kirimkan ulasan / review Anda di chat ini:</b>\n` +
        `<i>(Contoh: "Pelayanan sangat cepat, akun lancar Jaya! Mantap 👍")</i>`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('❌ Batal Ulasan', `cancel_review_${orderId}`)],
      ]);

      await ctx.reply(promptMsg, {
        parse_mode: 'HTML',
        ...keyboard,
      }).catch(() => {});
    } catch (err) {
      console.error('review_text_ action error:', err);
    }
  });

  // Cancel text review prompt
  bot.action(/^cancel_review_(.+)$/, async (ctx) => {
    try {
      const userId = ctx.from.id.toString();
      await updateSession(userId, { awaitingReviewOrderId: null });
      await ctx.answerCbQuery('❌ Pengisian ulasan dibatalkan.').catch(() => {});
      await ctx.deleteMessage().catch(() => {});
    } catch (err) {
      console.error('cancel_review error:', err);
    }
  });
}

/**
 * Process text input when user is sending a review comment
 */
async function handleReviewTextInput(ctx, session) {
  const orderId = session.awaitingReviewOrderId;
  const userId = ctx.from.id.toString();
  const reviewText = ctx.message.text.trim();

  // Clear session state
  await updateSession(userId, { awaitingReviewOrderId: null });

  // Get current order or default rating
  const orderDoc = await db.collection('orders').doc(orderId).get();
  const currentRating = (orderDoc.exists && orderDoc.data().rating) ? orderDoc.data().rating : 5;

  const result = await saveRating(userId, orderId, currentRating, reviewText);

  if (result.success) {
    await ctx.reply(
      `🎉 <b>ULASAN BERHASIL DISIMPAN!</b>\n` +
      `────────────────────────────\n` +
      `• <b>Order ID</b> : <code>${escapeHTML(orderId)}</code>\n` +
      `• <b>Rating</b>   : <b>${'⭐'.repeat(currentRating)} (${currentRating}/5)</b>\n` +
      `• <b>Ulasan</b>   : <i>"${escapeHTML(reviewText)}"</i>\n` +
      `────────────────────────────\n` +
      `🙏 <i>Terima kasih banyak atas ulasan dan masukan Anda!</i>`,
      { parse_mode: 'HTML' }
    ).catch(() => {});

    // Notify Admin of new text review
    if (config.ADMIN_ID) {
      bot.telegram.sendMessage(config.ADMIN_ID,
        `💬 <b>ULASAN PELANGGAN BARU</b>\n` +
        `────────────────────────────\n` +
        `• <b>Order ID</b> : <code>${escapeHTML(orderId)}</code>\n` +
        `• <b>User</b>     : <b>${escapeHTML(ctx.from.first_name || 'User')}</b> (@${ctx.from.username || '-'}, ID: <code>${userId}</code>)\n` +
        `• <b>Rating</b>   : <b>${'⭐'.repeat(currentRating)} (${currentRating}/5)</b>\n` +
        `• <b>Ulasan</b>   : <i>"${escapeHTML(reviewText)}"</i>`,
        { parse_mode: 'HTML' }
      ).catch(() => {});
    }
  } else {
    await ctx.reply('❌ Gagal menyimpan ulasan. Silakan coba lagi nanti.').catch(() => {});
  }
}

module.exports = {
  getStoreRatingStats,
  saveRating,
  sendRatingPrompt,
  registerReviewHandlers,
  handleReviewTextInput,
};
