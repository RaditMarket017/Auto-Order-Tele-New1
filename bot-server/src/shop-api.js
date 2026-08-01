const express = require('express');
const router = express.Router();
const { db } = require('../../src/firebase');
const config = require('../../src/config');
const { formatIDR, generateOrderId } = require('../../src/helpers');
const { getProductPrice, applyVoucher, useVoucher } = require('../../src/pricing');
const { createPayment } = require('../../src/ramashop');

// ─── GET /api/shop/user-profile ───
router.get('/user-profile', async (req, res) => {
  try {
    const userId = req.query.user_id;
    const defaultMemberName = `Member ${config.STORE_NAME || 'Store'}`;
    if (!userId) return res.json({ success: true, data: { name: defaultMemberName, balance: 0 } });

    const userDoc = await db.collection('bot_users').doc(String(userId)).get();
    if (!userDoc.exists) {
      return res.json({ success: true, data: { name: defaultMemberName, balance: 0 } });
    }

    const u = userDoc.data();
    let displayName = u.firstName ? `${u.firstName}${u.lastName ? ' ' + u.lastName : ''}`.trim() : (u.name || 'Member');
    if (!displayName) displayName = 'Member';

    res.json({
      success: true,
      data: {
        id: userId,
        name: displayName,
        username: u.username || '',
        balance: u.balance || 0,
        role: u.role || 'user',
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/shop/store-info ───
router.get('/store-info', async (req, res) => {
  try {
    let storeSettings = {
      storeName: config.STORE_NAME,
      storeLogoUrl: config.STORE_LOGO_URL,
      bannerUrl: config.STORE_BANNER_URL,
    };
    const [doc, sysDoc] = await Promise.all([
      db.collection('settings').doc('store').get(),
      db.collection('settings').doc('system').get(),
    ]);

    if (doc.exists) {
      storeSettings = { ...storeSettings, ...doc.data() };
    }

    const isMaintenance = sysDoc.exists ? Boolean(sysDoc.data()?.maintenanceMode) : Boolean(storeSettings.maintenanceMode);
    const maintenanceMessage = sysDoc.exists ? (sysDoc.data()?.maintenanceMessage || 'Toko sedang dalam pemeliharaan berkala.') : (storeSettings.maintenanceMessage || 'Toko sedang dalam pemeliharaan berkala.');

    const { getGatewayConfig } = require('../../src/ramashop');
    const gwConfig = getGatewayConfig();

    res.json({
      success: true,
      data: {
        ...storeSettings,
        maintenanceMode: isMaintenance,
        maintenanceMessage,
        gateways: gwConfig,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/shop/products ───
router.get('/products', async (req, res) => {
  try {
    let snap;
    try {
      snap = await db.collection('products').orderBy('order', 'asc').get();
    } catch {
      snap = await db.collection('products').get();
    }

    const stockMap = {};
    try {
      const poolSnap = await db.collection('credentials_pool').where('isUsed', '==', false).get();
      poolSnap.forEach(d => {
        const data = d.data();
        const pId = data.productId;
        const vLabel = data.variantLabel || 'Default';
        if (!stockMap[pId]) stockMap[pId] = {};
        stockMap[pId][vLabel] = (stockMap[pId][vLabel] || 0) + 1;
      });
    } catch {}

    const products = (snap.docs || [])
      .map(d => {
        const pData = d.data();
        const pId = d.id;
        const reqEmail = Boolean(pData.requiresEmail);
        const variants = (pData.variants || []).map(v => {
          let vStock;
          if (reqEmail || v.inviteEnabled) {
            vStock = (v.stock !== undefined && v.stock !== null) ? Number(v.stock) : 0;
          } else {
            vStock = stockMap[pId]?.[v.label] || 0;
          }
          return { ...v, stock: vStock };
        });
        const totalStock = variants.reduce((s, v) => s + Number(v.stock || 0), 0);
        return {
          id: pId,
          ...pData,
          variants,
          stock: totalStock,
        };
      })
      .filter(p => p.isVisible !== false);

    res.json({ success: true, data: products });
  } catch (err) {
    res.json({ success: true, data: [] });
  }
});

// ─── GET /api/shop/products/:id ───
router.get('/products/:id', async (req, res) => {
  try {
    const doc = await db.collection('products').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ success: false, error: 'Product not found' });
    res.json({ success: true, data: { id: doc.id, ...doc.data() } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/shop/apply-voucher ───
router.post('/apply-voucher', async (req, res) => {
  try {
    const { code, totalPrice, productId } = req.body;
    if (!code) return res.status(400).json({ success: false, error: 'Voucher code is required' });

    const result = await applyVoucher(code, totalPrice || 0, productId);
    if (!result.valid) {
      return res.status(400).json({ success: false, reason: result.reason, minPurchase: result.minPurchase });
    }

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/shop/create-order ───
router.post('/create-order', async (req, res) => {
  try {
    const {
      telegramUserId,
      customerName,
      productId,
      variantIndex,
      quantity = 1,
      paymentMethod,
      voucherCode,
    } = req.body;

    // Check System Maintenance Mode
    const sysDoc = await db.collection('settings').doc('system').get();
    if (sysDoc.exists && sysDoc.data()?.maintenanceMode) {
      const msg = sysDoc.data()?.maintenanceMessage || 'Toko sedang dalam pemeliharaan berkala.';
      return res.status(503).json({
        success: false,
        error: `⚠️ TOKO SEDANG MAINTENANCE\n${msg}`
      });
    }

    if (!productId || variantIndex === undefined || !paymentMethod) {
      return res.status(400).json({ success: false, error: 'Missing required parameters' });
    }

    const doc = await db.collection('products').doc(productId).get();
    if (!doc.exists) return res.status(404).json({ success: false, error: 'Product not found' });

    const product = doc.data();
    const variant = product.variants?.[variantIndex];
    if (!variant) return res.status(400).json({ success: false, error: 'Invalid variant' });

    // Check stock in credentials_pool or variant.stock
    const poolSnap = await db.collection('credentials_pool')
      .where('productId', '==', productId)
      .where('variantLabel', '==', variant.label)
      .where('isUsed', '==', false)
      .get();

    const availableStock = Boolean(product.requiresEmail)
      ? ((variant.stock !== undefined && variant.stock !== null) ? Number(variant.stock) : 0)
      : poolSnap.size;
    if (availableStock < quantity) {
      return res.status(400).json({ success: false, error: 'Out of stock' });
    }

    let unitPrice = await getProductPrice(variant, telegramUserId || 0, quantity, product);
    let total = unitPrice * quantity;
    let voucherData = null;

    if (voucherCode) {
      const vResult = await applyVoucher(voucherCode, total, productId);
      if (vResult.valid) {
        voucherData = vResult;
        total = vResult.finalPrice;
      }
    }

    const orderId = generateOrderId('ORD');

    let finalCustomerName = customerName;
    if (!finalCustomerName || finalCustomerName.startsWith('Member') || finalCustomerName === 'User' || finalCustomerName === 'Guest') {
      if (telegramUserId) {
        try {
          const userDoc = await db.collection('bot_users').doc(telegramUserId.toString()).get();
          if (userDoc.exists) {
            const uData = userDoc.data();
            const resolvedName = uData.firstName || uData.name || (uData.username ? '@' + uData.username : null);
            if (resolvedName) finalCustomerName = resolvedName;
          }
        } catch (e) {}
      }
    }
    if (!finalCustomerName) finalCustomerName = `Member ${config.STORE_NAME || 'Store'}`;

    // Saldo Payment
    if (paymentMethod === 'saldo') {
      if (!telegramUserId) return res.status(400).json({ success: false, error: 'Telegram User ID required for Saldo' });

      await db.runTransaction(async (transaction) => {
        const userRef = db.collection('bot_users').doc(telegramUserId.toString());
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) throw new Error('User not found');

        const currentBalance = userDoc.data().balance || 0;
        if (currentBalance < total) throw new Error('Insufficient balance');

        transaction.update(userRef, { balance: currentBalance - total });
        transaction.set(db.collection('orders').doc(orderId), {
          id: orderId,
          telegramUserId: telegramUserId.toString(),
          customerName: finalCustomerName,
          productId,
          productName: product.name,
          variantLabel: variant.label,
          variantIndex,
          quantity,
          unitPrice,
          totalPrice: total,
          paymentMethod: 'saldo',
          deliveryType: product.deliveryType || 'instant',
          requiresEmail: Boolean(product.requiresEmail),
          status: 'paid',
          voucherCode: voucherData?.code || null,
          voucherDiscount: voucherData?.discount || 0,
          createdAt: new Date().toISOString(),
        });
      });

      if (voucherData?.voucherId) await useVoucher(voucherData.voucherId);

      const { fulfillOrder } = require('../../src/fulfillment');
      fulfillOrder(orderId).catch(console.error);

      return res.json({ success: true, orderId, status: 'paid' });
    }

    // QRIS Payment via RamaShop / PanzzPay
    if (paymentMethod === 'qris' || paymentMethod === 'qris1' || paymentMethod === 'qris2') {
      const preferredGw = paymentMethod === 'qris2' ? 'panzzpay' : 'ramashop';

      await db.collection('orders').doc(orderId).set({
        id: orderId,
        telegramUserId: telegramUserId ? telegramUserId.toString() : 'guest',
        customerName: finalCustomerName,
        productId,
        productName: product.name,
        variantLabel: variant.label,
        variantIndex,
        quantity,
        unitPrice,
        totalPrice: total,
        paymentMethod: paymentMethod === 'qris2' ? 'qris2' : 'qris',
        deliveryType: product.deliveryType || 'instant',
        requiresEmail: Boolean(product.requiresEmail),
        status: 'pending',
        voucherCode: voucherData?.code || null,
        voucherDiscount: voucherData?.discount || 0,
        voucherId: voucherData?.voucherId || null,
        createdAt: new Date().toISOString(),
      });

      const payResult = await createPayment(orderId, total, { gateway: preferredGw });

      if (!payResult || !payResult.success) {
        await db.collection('orders').doc(orderId).update({ status: 'failed' });
        return res.status(400).json({ success: false, error: 'Payment gateway error' });
      }

      await db.collection('orders').doc(orderId).update({
        ramashopDepositId: payResult.depositId,
        gateway: payResult.gateway || preferredGw,
        uniqueAmount: payResult.totalAmount || total,
      });

      return res.json({
        success: true,
        orderId,
        status: 'pending',
        qrDataUrl: payResult.qr_data_url,
        uniqueAmount: payResult.totalAmount || total,
      });
    }

    return res.status(400).json({ success: false, error: 'Invalid payment method' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/shop/order-status/:id ───
router.get('/order-status/:id', async (req, res) => {
  try {
    const doc = await db.collection('orders').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ success: false, error: 'Order not found' });
    res.json({ success: true, data: doc.data() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/shop/cancel-order ───
router.post('/cancel-order', async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ success: false, error: 'Order ID is required' });

    const docRef = db.collection('orders').doc(orderId);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ success: false, error: 'Order not found' });

    const order = doc.data();
    if (order.status === 'paid' || order.status === 'success') {
      return res.status(400).json({ success: false, error: 'Order has already been paid' });
    }

    await docRef.update({ status: 'cancelled', cancelledAt: new Date().toISOString() });
    res.json({ success: true, message: 'Order cancelled successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/shop/user-profile/:id ───
router.get('/user-profile/:id', async (req, res) => {
  try {
    const doc = await db.collection('bot_users').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, data: doc.data() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
