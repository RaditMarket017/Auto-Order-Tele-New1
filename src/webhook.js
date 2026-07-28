const express = require('express');
const { db } = require('./firebase');
const config = require('./config');
const { setupServer } = require('../bot-server/api/index');

function createWebhookServer(bot) {
  const app = express();
  
  // Setup API routes and static Mini Apps (/app, /admin)
  setupServer(app);

  // Health check
  app.get('/', (req, res) => {
    res.json({ status: 'ok', service: `${config.STORE_NAME} Auto Order Bot` });
  });

  // RamaShop webhook (GET health)
  app.get('/webhook/ramashop', (req, res) => {
    res.send('✅ RamaShop Webhook Endpoint Ready (POST for callbacks)');
  });

  // RamaShop webhook (POST notification)
  app.post('/webhook/ramashop', async (req, res) => {
    try {
      const payload = req.body;
      console.log('[Webhook RamaShop] Payload:', JSON.stringify(payload));

      const event = (payload.event || '').toLowerCase();
      const status = (payload.status || payload.data?.status || '').toLowerCase();
      const depositId = payload.depositId || payload.data?.depositId || payload.id;
      const orderId = payload.customer_order_id || payload.order_id || payload.orderId;

      console.log(`[Webhook] Order: ${orderId || depositId}, Status: ${status}`);

      let orderDoc = null;
      if (orderId) {
        orderDoc = await db.collection('orders').doc(orderId).get();
      }
      if ((!orderDoc || !orderDoc.exists) && depositId) {
        const snap = await db.collection('orders').where('ramashopDepositId', '==', depositId).limit(1).get();
        if (!snap.empty) orderDoc = snap.docs[0];
      }

      if (!orderDoc || !orderDoc.exists) {
        console.log(`[Webhook] Order not found in database.`);
        return res.status(200).json({ status: 'ok', message: 'Order not found' });
      }

      const targetOrderId = orderDoc.id;
      const order = orderDoc.data();

      // Already processed
      if (order.status === 'success' || order.status === 'paid') {
        return res.status(200).json({ status: 'ok', message: 'Already processed' });
      }

      const isSuccess = event === 'payment.success' ||
        ['paid', 'completed', 'success', 'lunas', 'settlement', 'already'].includes(status);
      const isExpired = event === 'payment.expired' || event === 'payment.timeout' ||
        ['expired', 'failed', 'cancelled'].includes(status);

      if (isSuccess) {
        console.log(`[Webhook] ✅ Payment success for ${targetOrderId}`);

        await db.collection('orders').doc(targetOrderId).update({
          status: 'paid',
          paidAt: new Date().toISOString(),
        });

        // Delete QRIS message if exists
        if (order.paymentMessageId && order.telegramUserId) {
          bot.telegram.deleteMessage(order.telegramUserId, order.paymentMessageId).catch(() => {});
        }

        // Fulfill order
        try {
          const { fulfillOrder } = require('./fulfillment');
          const result = await fulfillOrder(targetOrderId);
          console.log(`[Webhook] Fulfillment result for ${targetOrderId}:`, result);
        } catch (fErr) {
          console.error(`[Webhook] Fulfillment error for ${targetOrderId}:`, fErr);
        }

        // Use voucher if applied
        if (order.voucherId) {
          const { useVoucher } = require('./pricing');
          await useVoucher(order.voucherId);
        }

      } else if (isExpired) {
        console.log(`[Webhook] ❌ Payment expired for ${targetOrderId}`);
        await db.collection('orders').doc(targetOrderId).update({ status: 'failed' });
      }

      return res.status(200).json({ status: 'ok' });
    } catch (err) {
      console.error('[Webhook] Error:', err);
      return res.status(200).json({ status: 'ok' });
    }
  });

  return app;
}

module.exports = { createWebhookServer };
