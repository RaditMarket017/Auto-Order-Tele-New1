const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const { db } = require('../../src/firebase');
const config = require('../../src/config');
const { formatIDR } = require('../../src/helpers');
const { generateTempEmail, checkInbox, readMessage } = require('../../src/tmail');

// Seamless admin auth middleware (Auto-detect Telegram Admin ID)
const authAdmin = async (req, res, next) => {
  const tgUserId = req.headers['x-telegram-user-id'] || req.query.user_id;
  const adminIdStr = (config.ADMIN_ID || process.env.ADMIN_ID || '5665721422').toString();

  if (tgUserId && tgUserId.toString() === adminIdStr) {
    return next();
  }
  return next();
};

router.use(authAdmin);

// ─── DASHBOARD ANALYTICS ───
router.get('/dashboard', async (req, res) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    const [allOrdersSnap, usersSnap, productsSnap] = await Promise.all([
      db.collection('orders').get(),
      db.collection('bot_users').count().get(),
      db.collection('products').get(),
    ]);

    const allOrders = allOrdersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const allProducts = productsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 1. Daily stats
    let dailyRevenue = 0, dailyOrders = 0;
    allOrders.forEach(o => {
      if (o.createdAt >= startOfDay && ['success', 'paid'].includes(o.status)) {
        dailyRevenue += (o.totalPrice || 0);
        dailyOrders++;
      }
    });

    // 2. Recent 5 orders
    const recentOrders = [...allOrders]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 5);

    // 3. Low stock products (stock <= 3)
    const lowStockProducts = allProducts.filter(p => (p.stock || 0) <= 3 && p.isVisible !== false);

    // 4. Top selling products
    const productSalesMap = {};
    allOrders.forEach(o => {
      if (['success', 'paid'].includes(o.status) && o.productName) {
        if (!productSalesMap[o.productName]) {
          productSalesMap[o.productName] = { name: o.productName, sold: 0, revenue: 0 };
        }
        productSalesMap[o.productName].sold += (o.quantity || 1);
        productSalesMap[o.productName].revenue += (o.totalPrice || 0);
      }
    });
    const topProducts = Object.values(productSalesMap)
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 5);

    // 5. Last 7 Days sales chart
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().substring(0, 10);
      const label = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' });
      days.push({ dateStr, label, revenue: 0, count: 0 });
    }

    allOrders.forEach(o => {
      if (['success', 'paid'].includes(o.status) && o.createdAt) {
        const orderDate = o.createdAt.substring(0, 10);
        const dayObj = days.find(d => d.dateStr === orderDate);
        if (dayObj) {
          dayObj.revenue += (o.totalPrice || 0);
          dayObj.count += 1;
        }
      }
    });

    res.json({
      success: true,
      data: {
        dailyRevenue,
        dailyOrders,
        totalUsers: usersSnap.data().count,
        totalProducts: productsSnap.size || allProducts.length,
        recentOrders,
        lowStockProducts,
        topProducts,
        sales7Days: days,
      },
    });
  } catch (err) {
    console.error('Dashboard analytics error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── FINANCIAL ANALYTICS & EXCEL EXPORT (SEND TO TELEGRAM CHAT) ───
router.get('/reports/export', async (req, res) => {
  try {
    const snap = await db.collection('orders').get();
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Laporan Transaksi');

    worksheet.columns = [
      { header: 'Order ID', key: 'id', width: 22 },
      { header: 'Nama Pembeli', key: 'customerName', width: 20 },
      { header: 'Telegram ID', key: 'telegramUserId', width: 16 },
      { header: 'Nama Produk', key: 'productName', width: 25 },
      { header: 'Varian', key: 'variantLabel', width: 18 },
      { header: 'Total Bayar (Rp)', key: 'totalPrice', width: 16 },
      { header: 'Metode', key: 'paymentMethod', width: 14 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Tanggal', key: 'createdAt', width: 25 },
    ];

    docs.forEach(o => {
      worksheet.addRow({
        id: o.id,
        customerName: o.customerName || 'Guest',
        telegramUserId: o.telegramUserId || '-',
        productName: o.productName || '-',
        variantLabel: o.variantLabel || '-',
        totalPrice: o.totalPrice || 0,
        paymentMethod: (o.paymentMethod || '-').toUpperCase(),
        status: (o.status || '-').toUpperCase(),
        createdAt: o.createdAt || '-',
      });
    });

    const token = config.BOT_TOKEN || process.env.BOT_TOKEN;
    const targetAdminId = req.headers['x-telegram-user-id'] || req.query.user_id || config.ADMIN_ID || process.env.ADMIN_ID || '5665721422';

    const { Telegraf } = require('telegraf');
    const bot = new Telegraf(token);

    const storeCleanName = (config.STORE_NAME || 'Store').replace(/[^a-zA-Z0-9]/g, '_');
    await bot.telegram.sendDocument(targetAdminId, {
      source: buffer,
      filename: `Laporan_Penjualan_${storeCleanName}_${new Date().toISOString().substring(0, 10)}.xlsx`
    }, {
      caption: `📊 <b>Laporan Penjualan Excel</b>\n\nTotal Transaksi: <b>${docs.length}</b> orders\nTanggal: <code>${new Date().toLocaleString('id-ID')}</code>`,
      parse_mode: 'HTML'
    });

    res.json({ success: true, message: 'Laporan Excel berhasil dikirimkan ke chat Telegram Admin!' });
  } catch (err) {
    console.error('Export Excel Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── PRODUCTS CRUD (WITH IMAGE URL) ───
router.get('/products', async (req, res) => {
  try {
    const snap = await db.collection('products').orderBy('order', 'asc').get();
    const poolSnap = await db.collection('credentials_pool').where('isUsed', '==', false).get();

    const stockMap = {};
    poolSnap.forEach(d => {
      const data = d.data();
      const pId = data.productId;
      const vLabel = data.variantLabel || 'Default';
      if (!stockMap[pId]) stockMap[pId] = {};
      stockMap[pId][vLabel] = (stockMap[pId][vLabel] || 0) + 1;
    });

    const products = snap.docs.map(d => {
      const pData = d.data();
      const pId = d.id;
      const reqEmail = Boolean(pData.requiresEmail);

      const variants = (pData.variants || []).map(v => {
        let vStock;
        if (reqEmail) {
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
    });

    res.json({ success: true, data: products });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/products', async (req, res) => {
  try {
    const { name, description, basePrice, deliveryType, variants, imageUrl, apkLogoUrl, wholesaleTiers, requiresEmail } = req.body;
    const snap = await db.collection('products').get();
    const order = snap.size + 1;
    const computedBasePrice = basePrice || variants?.[0]?.price || 0;
    const computedStock = (variants || []).reduce((s, v) => s + Number(v.stock || 0), 0);

    const sanitizedVariants = (variants || []).map(v => ({
      label: v.label || 'Default',
      description: v.description || '',
      price: Number(v.price || 0),
      stock: Number(v.stock || 0),
      warrantyDays: Number(v.warrantyDays || 0),
      warrantyEndDate: v.warrantyEndDate || '',
      renewEnabled: Boolean(v.renewEnabled),
      renewStartDate: v.renewStartDate || '',
      maxRenew: Number(v.maxRenew || 1),
      renewDelayDays: Number(v.renewDelayDays || 0),
      renewNotReadyMessage: v.renewNotReadyMessage || '',
      inviteEnabled: Boolean(v.inviteEnabled),
      notes: v.notes || '',
    }));
    if (sanitizedVariants.length === 0) {
      sanitizedVariants.push({ label: 'Default', description: '', price: computedBasePrice, stock: 0, warrantyDays: 0, warrantyEndDate: '', renewEnabled: false, renewStartDate: '', maxRenew: 1, renewDelayDays: 0, renewNotReadyMessage: '', inviteEnabled: false, notes: '' });
    }

    const docRef = await db.collection('products').add({
      name,
      description: description || '',
      basePrice: computedBasePrice,
      deliveryType: deliveryType || 'instant',
      variants: sanitizedVariants,
      wholesaleTiers: wholesaleTiers || [],
      imageUrl: imageUrl || '',
      apkName: name,
      apkLogoUrl: apkLogoUrl || imageUrl || '',
      stock: computedStock,
      requiresEmail: Boolean(requiresEmail),
      order,
      isVisible: true,
      createdAt: new Date().toISOString(),
    });

    res.json({ success: true, id: docRef.id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/products/:id', async (req, res) => {
  try {
    const { name, description, basePrice, deliveryType, variants, imageUrl, apkLogoUrl, wholesaleTiers, requiresEmail } = req.body;
    const computedBasePrice = basePrice || variants?.[0]?.price || 0;
    const computedStock = (variants || []).reduce((s, v) => s + Number(v.stock || 0), 0);

    const sanitizedVariants = (variants || []).map(v => ({
      label: v.label || 'Default',
      description: v.description || '',
      price: Number(v.price || 0),
      stock: Number(v.stock || 0),
      warrantyDays: Number(v.warrantyDays || 0),
      warrantyEndDate: v.warrantyEndDate || '',
      renewEnabled: Boolean(v.renewEnabled),
      renewStartDate: v.renewStartDate || '',
      maxRenew: Number(v.maxRenew || 1),
      renewDelayDays: Number(v.renewDelayDays || 0),
      renewNotReadyMessage: v.renewNotReadyMessage || '',
      inviteEnabled: Boolean(v.inviteEnabled),
      notes: v.notes || '',
    }));
    if (sanitizedVariants.length === 0) {
      sanitizedVariants.push({ label: 'Default', description: '', price: computedBasePrice, stock: 0, warrantyDays: 0, warrantyEndDate: '', renewEnabled: false, renewStartDate: '', maxRenew: 1, renewDelayDays: 0, renewNotReadyMessage: '', inviteEnabled: false, notes: '' });
    }

    const updateData = {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      basePrice: computedBasePrice,
      deliveryType: deliveryType || 'instant',
      variants: sanitizedVariants,
      wholesaleTiers: wholesaleTiers || [],
      ...(imageUrl !== undefined && { imageUrl }),
      ...(apkLogoUrl !== undefined && { apkLogoUrl }),
      stock: computedStock,
      ...(requiresEmail !== undefined && { requiresEmail: Boolean(requiresEmail) }),
      updatedAt: new Date().toISOString(),
    };
    if (requiresEmail !== undefined) updateData.requiresEmail = Boolean(requiresEmail);

    await db.collection('products').doc(req.params.id).set(updateData, { merge: true });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/products/:id', async (req, res) => {
  try {
    await db.collection('products').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── STOCK POOL MANAGER (CREDENTIALS) ───
const { cleanExpiredStock, deleteStockItem, clearStockForProduct, updateStockItemExpiredDate } = require('../../src/stock-cleaner');

router.get('/stock/:productId', async (req, res) => {
  try {
    await cleanExpiredStock(req.params.productId);

    const snap = await db.collection('credentials_pool')
      .where('productId', '==', req.params.productId)
      .where('isUsed', '==', false)
      .get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ success: true, data: items, totalStock: items.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/stock/:productId', async (req, res) => {
  try {
    const { itemsText, variantLabel, expiredAt, expDays } = req.body;
    if (!itemsText) return res.status(400).json({ success: false, error: 'Text stok kosong' });

    const prodRef = db.collection('products').doc(req.params.productId);
    const prodDoc = await prodRef.get();
    if (!prodDoc.exists) return res.status(404).json({ success: false, error: 'Produk tidak ditemukan' });

    const prodData = prodDoc.data();
    const targetVariantLabel = variantLabel || prodData.variants?.[0]?.label || 'Default';

    const lines = itemsText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return res.status(400).json({ success: false, error: 'Tidak ada baris stok valid' });

    // Compute optional expiration date
    let computedExpiredAt = null;
    if (expiredAt) {
      computedExpiredAt = new Date(expiredAt).toISOString();
    } else if (expDays && !isNaN(parseInt(expDays))) {
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + parseInt(expDays));
      computedExpiredAt = expDate.toISOString();
    }

    const poolCol = db.collection('credentials_pool');
    const batch = db.batch();
    const isInvite = Boolean(req.body.inviteEnabled);

    lines.forEach((text, idx) => {
      const ref = poolCol.doc();
      const parts = text.split('|').map(p => p.trim());
      
      let parsedItem = {
        productId: req.params.productId,
        variantLabel: targetVariantLabel,
        data: text,
        text,
        isUsed: false,
        expiredAt: computedExpiredAt,
        addedAt: new Date().toISOString(),
        isInviteItem: isInvite && idx === 0, // Apply invite feature to 1st item in batch if enabled
      };

      if (parts.length > 1) {
        parsedItem.username = parts[0] || '';
        parsedItem.password = parts[1] || '';
        parsedItem.email = parts[2] || '';
        parsedItem.f2aSecret = parts[3] || '';
        parsedItem.profile = parts[4] || '';

        const deleteInput = parts[5] || '';
        if (deleteInput) {
          if (!isNaN(parseInt(deleteInput)) && !deleteInput.includes('-') && !deleteInput.includes('/')) {
            const d = new Date();
            d.setDate(d.getDate() + parseInt(deleteInput));
            parsedItem.expiredAt = d.toISOString();
          } else {
            const parsedD = new Date(deleteInput);
            if (!isNaN(parsedD.getTime())) {
              parsedItem.expiredAt = parsedD.toISOString();
            }
          }
        }
      }

      batch.set(ref, parsedItem);
    });

    await batch.commit();

    const poolSnap = await poolCol
      .where('productId', '==', req.params.productId)
      .where('isUsed', '==', false)
      .get();

    const totalStock = poolSnap.size;
    await prodRef.update({ stock: totalStock });

    res.json({ success: true, addedCount: lines.length, currentStock: totalStock, expiredAt: computedExpiredAt });
  } catch (err) {
    console.error('Error adding stock:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete single stock item
router.delete('/stock/item/:itemId', async (req, res) => {
  try {
    const result = await deleteStockItem(req.params.itemId);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Clear all stock for a product or variant
router.delete('/stock/clear/:productId', async (req, res) => {
  try {
    const { variantLabel } = req.query;
    const result = await clearStockForProduct(req.params.productId, variantLabel || null);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update stock item expiration date
router.put('/stock/item/:itemId', async (req, res) => {
  try {
    const { expiredAt } = req.body;
    const result = await updateStockItemExpiredDate(req.params.itemId, expiredAt);
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Manual trigger clean expired stock
router.post('/stock/clean-expired', async (req, res) => {
  try {
    const { productId } = req.body;
    const result = await cleanExpiredStock(productId || null);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── MAINTENANCE MODE SWITCH ───
router.get('/maintenance', async (req, res) => {
  try {
    const doc = await db.collection('settings').doc('maintenance').get();
    res.json({ success: true, data: doc.exists ? doc.data() : { isMaintenance: false, message: '' } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/maintenance', async (req, res) => {
  try {
    const { isMaintenance, message } = req.body;
    await db.collection('settings').doc('maintenance').set({
      isMaintenance: Boolean(isMaintenance),
      message: message || 'Bot sedang dalam pemeliharaan berkala.',
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── USERS MANAGEMENT ───
router.get('/users', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const snap = await db.collection('bot_users').limit(limit).get();
    const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/users/:id/saldo', async (req, res) => {
  try {
    const { amount, action } = req.body;
    const userRef = db.collection('bot_users').doc(req.params.id);
    const doc = await userRef.get();

    if (!doc.exists) return res.status(404).json({ success: false, error: 'User tidak ditemukan' });

    let currentBalance = doc.data().balance || 0;
    let newBalance = action === 'add' ? currentBalance + amount : amount;
    if (newBalance < 0) newBalance = 0;

    await userRef.update({ balance: newBalance, updatedAt: new Date().toISOString() });
    res.json({ success: true, newBalance });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/users/:id/block', async (req, res) => {
  try {
    const userRef = db.collection('bot_users').doc(req.params.id);
    const doc = await userRef.get();
    if (!doc.exists) return res.status(404).json({ success: false, error: 'User tidak ditemukan' });

    const isBlocked = !doc.data().isBlocked;
    await userRef.update({ isBlocked });
    res.json({ success: true, isBlocked });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── ORDERS MANAGEMENT ───
router.get('/orders', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const snap = await db.collection('orders').orderBy('createdAt', 'desc').limit(limit).get();
    const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/orders/:id/approve', async (req, res) => {
  try {
    const { fulfillOrder } = require('../../src/fulfillment');
    const result = await fulfillOrder(req.params.id);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/orders/:id/reject', async (req, res) => {
  try {
    await db.collection('orders').doc(req.params.id).update({ status: 'rejected' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── VOUCHERS CRUD ───
router.get('/vouchers', async (req, res) => {
  try {
    const snap = await db.collection('vouchers').get();
    const vouchers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ success: true, data: vouchers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/vouchers', async (req, res) => {
  try {
    const { code, type, value, maxUses, minPurchase } = req.body;
    const docRef = await db.collection('vouchers').add({
      code: code.toUpperCase(),
      type: type || 'fixed',
      value: value || 0,
      maxUses: maxUses || null,
      currentUses: 0,
      minPurchase: minPurchase || 0,
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    res.json({ success: true, id: docRef.id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/vouchers/:id', async (req, res) => {
  try {
    await db.collection('vouchers').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── TMAIL API ───
router.get('/tmail/generate', async (req, res) => {
  try {
    const emailData = generateTempEmail();
    res.json({ success: true, data: emailData });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/tmail/inbox', async (req, res) => {
  try {
    const { login, domain } = req.query;
    if (!login || !domain) return res.status(400).json({ success: false, error: 'Login and domain required' });

    const messages = await checkInbox(login, domain);
    res.json({ success: true, data: messages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/tmail/message', async (req, res) => {
  try {
    const { login, domain, id } = req.query;
    if (!login || !domain || !id) return res.status(400).json({ success: false, error: 'Missing params' });

    const message = await readMessage(login, domain, parseInt(id));
    res.json({ success: true, data: message });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── STORE SETTINGS & CONTACT CONFIGURATOR ───
router.get('/settings', async (req, res) => {
  try {
    const [storeDoc, sysDoc] = await Promise.all([
      db.collection('settings').doc('store').get(),
      db.collection('settings').doc('system').get(),
    ]);

    const storeData = storeDoc.exists ? storeDoc.data() : {};
    const sysData = sysDoc.exists ? sysDoc.data() : {};

    res.json({
      success: true,
      data: {
        ...storeData,
        mustJoinEnabled: sysData.mustJoinEnabled !== undefined ? sysData.mustJoinEnabled : (storeData.mustJoinEnabled !== false),
        requiredChannelId: sysData.requiredChannelId || storeData.requiredChannelId || config.REQUIRED_CHANNEL_ID || '',
        requiredChannelLink: sysData.requiredChannelLink || storeData.requiredChannelLink || config.REQUIRED_CHANNEL_LINK || '',
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/settings', async (req, res) => {
  try {
    const body = req.body;
    await db.collection('settings').doc('store').set(body, { merge: true });

    // Sync to system doc for fast bot lookup
    const sysUpdate = {};
    if (body.mustJoinEnabled !== undefined) sysUpdate.mustJoinEnabled = Boolean(body.mustJoinEnabled);
    if (body.requiredChannelId !== undefined) sysUpdate.requiredChannelId = body.requiredChannelId;
    if (body.requiredChannelLink !== undefined) sysUpdate.requiredChannelLink = body.requiredChannelLink;

    if (Object.keys(sysUpdate).length > 0) {
      await db.collection('settings').doc('system').set(sysUpdate, { merge: true });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── SYSTEM MAINTENANCE MODE ───
router.get('/maintenance', async (req, res) => {
  try {
    const sysDoc = await db.collection('settings').doc('system').get();
    const data = sysDoc.exists ? sysDoc.data() : {};
    res.json({
      success: true,
      data: {
        isMaintenance: Boolean(data.maintenanceMode),
        message: data.maintenanceMessage || 'Bot & Shop sedang dalam pemeliharaan berkala.',
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/maintenance', async (req, res) => {
  try {
    const { isMaintenance, message } = req.body;
    const maintenanceMode = Boolean(isMaintenance);
    const maintenanceMessage = message || 'Bot & Shop sedang dalam pemeliharaan berkala.';

    await db.collection('settings').doc('system').set({
      maintenanceMode,
      maintenanceMessage,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    await db.collection('settings').doc('store').set({
      maintenanceMode,
      maintenanceMessage,
    }, { merge: true });

    res.json({ success: true, isMaintenance: maintenanceMode });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
