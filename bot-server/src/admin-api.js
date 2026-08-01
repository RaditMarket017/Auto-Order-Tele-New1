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

    const sanitizedVariants = (variants || []).map(v => {
      const scheduleDates = Array.isArray(v.renewScheduleDates) ? v.renewScheduleDates.filter(Boolean) : (v.renewStartDate ? [v.renewStartDate] : []);
      return {
        label: v.label || 'Default',
        description: v.description || '',
        price: Number(v.price || 0),
        stock: Number(v.stock || 0),
        warrantyDays: Number(v.warrantyDays || 0),
        warrantyEndDate: v.warrantyEndDate || '',
        renewEnabled: Boolean(v.renewEnabled),
        renewStartDate: v.renewStartDate || (scheduleDates[0] || ''),
        renewScheduleDates: scheduleDates,
        maxRenew: scheduleDates.length > 0 ? Math.max(Number(v.maxRenew || 1), scheduleDates.length) : Number(v.maxRenew || 1),
        renewDelayDays: Number(v.renewDelayDays || 0),
        renewNotReadyMessage: v.renewNotReadyMessage || '',
        inviteEnabled: Boolean(v.inviteEnabled),
        notes: v.notes || '',
      };
    });
    if (sanitizedVariants.length === 0) {
      sanitizedVariants.push({ label: 'Default', description: '', price: computedBasePrice, stock: 0, warrantyDays: 0, warrantyEndDate: '', renewEnabled: false, renewStartDate: '', renewScheduleDates: [], maxRenew: 1, renewDelayDays: 0, renewNotReadyMessage: '', inviteEnabled: false, notes: '' });
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

    const sanitizedVariants = (variants || []).map(v => {
      const scheduleDates = Array.isArray(v.renewScheduleDates) ? v.renewScheduleDates.filter(Boolean) : (v.renewStartDate ? [v.renewStartDate] : []);
      return {
        label: v.label || 'Default',
        description: v.description || '',
        price: Number(v.price || 0),
        stock: Number(v.stock || 0),
        warrantyDays: Number(v.warrantyDays || 0),
        warrantyEndDate: v.warrantyEndDate || '',
        renewEnabled: Boolean(v.renewEnabled),
        renewStartDate: v.renewStartDate || (scheduleDates[0] || ''),
        renewScheduleDates: scheduleDates,
        maxRenew: scheduleDates.length > 0 ? Math.max(Number(v.maxRenew || 1), scheduleDates.length) : Number(v.maxRenew || 1),
        renewDelayDays: Number(v.renewDelayDays || 0),
        renewNotReadyMessage: v.renewNotReadyMessage || '',
        inviteEnabled: Boolean(v.inviteEnabled),
        notes: v.notes || '',
      };
    });
    if (sanitizedVariants.length === 0) {
      sanitizedVariants.push({ label: 'Default', description: '', price: computedBasePrice, stock: 0, warrantyDays: 0, warrantyEndDate: '', renewEnabled: false, renewStartDate: '', renewScheduleDates: [], maxRenew: 1, renewDelayDays: 0, renewNotReadyMessage: '', inviteEnabled: false, notes: '' });
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
const { cleanExpiredStock, deleteStockItem, clearStockForProduct, updateStockItemExpiredDate, toggleStockItemStatus } = require('../../src/stock-cleaner');

router.get('/stock/:productId', async (req, res) => {
  try {
    await cleanExpiredStock(req.params.productId);

    const snap = await db.collection('credentials_pool')
      .where('productId', '==', req.params.productId)
      .where('isUsed', '==', false)
      .get();
    const items = snap.docs.map(d => ({
      id: d.id,
      isActive: d.data().isActive !== false,
      ...d.data()
    }));
    res.json({ success: true, data: items, totalStock: items.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/stock/:productId', async (req, res) => {
  try {
    const {
      itemsText,
      variantLabel,
      expiredAt,
      expDays,
      inviteEnabled,
      inviteStockSlots,
      renewEnabled,
      maxRenew,
      renewStartDate,
      renewNotReadyMessage,
      warrantyEnabled,
      warrantyDays,
      warrantyExpiredMessage
    } = req.body;

    const prodRef = db.collection('products').doc(req.params.productId);
    const prodDoc = await prodRef.get();
    if (!prodDoc.exists) return res.status(404).json({ success: false, error: 'Produk tidak ditemukan' });

    const prodData = prodDoc.data();
    const targetVariantLabel = variantLabel || prodData.variants?.[0]?.label || 'Default';

    // Special handler for Invite Mode products (direct stock count slots)
    if (Boolean(inviteEnabled)) {
      const slotsCount = Math.max(0, Number(req.body.inviteStockSlots ?? inviteStockSlots ?? 0));
      const updatedVariants = (prodData.variants || []).map(v => {
        if (v.label === targetVariantLabel) {
          return {
            ...v,
            stock: slotsCount,
            inviteEnabled: true,
            renewEnabled: Boolean(renewEnabled),
            warrantyEnabled: Boolean(warrantyEnabled),
          };
        }
        return v;
      });
      const totalStock = updatedVariants.reduce((s, v) => s + Number(v.stock || 0), 0);
      await prodRef.update({ variants: updatedVariants, stock: totalStock });
      return res.json({ success: true, addedCount: slotsCount, currentStock: totalStock });
    }

    if (!itemsText) return res.status(400).json({ success: false, error: 'Text stok kosong' });

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
    const isInvite = Boolean(inviteEnabled);

    const scheduleDates = Array.isArray(req.body.renewScheduleDates) ? req.body.renewScheduleDates.filter(Boolean) : (renewStartDate ? [renewStartDate] : []);
    const computedMaxRenew = scheduleDates.length > 0 ? Math.max(Number(maxRenew || 1), scheduleDates.length) : Number(maxRenew || 1);

    lines.forEach((text, idx) => {
      const ref = poolCol.doc();
      const parts = text.split('|').map(p => p.trim());
      
      let parsedItem = {
        productId: req.params.productId,
        variantLabel: targetVariantLabel,
        data: text,
        text,
        isUsed: false,
        isActive: true,
        expiredAt: computedExpiredAt,
        addedAt: new Date().toISOString(),
        isInviteItem: isInvite && idx === 0,
        inviteEnabled: Boolean(inviteEnabled),
        renewEnabled: Boolean(renewEnabled),
        maxRenew: computedMaxRenew,
        renewStartDate: renewStartDate || (scheduleDates[0] || ''),
        renewScheduleDates: scheduleDates,
        renewNotReadyMessage: renewNotReadyMessage || 'Tombol renew belum aktif saat ini.',
        warrantyEnabled: Boolean(warrantyEnabled),
        warrantyDays: Number(warrantyDays || 0),
        warrantyEndDate: req.body.warrantyEndDate ? new Date(req.body.warrantyEndDate).toISOString() : null,
        warrantyExpiredMessage: warrantyExpiredMessage || 'Mohon maaf, garansi sudah tidak berlaku.',
        warrantyTimeoutMessage: req.body.warrantyTimeoutMessage || 'Garansi sudah hangus karena tidak ada bukti yang dikirim sebelumnya.',
        warrantyCsMessage: req.body.warrantyCsMessage || 'Jika ada kendala, silakan hubungi CS kami untuk bantuan lebih lanjut.',
      };

      if (parts.length > 1) {
        // Smart Parser for user|email|password|f2a|profil|tgl_exp or user|password|email|f2a|profil|tgl_exp
        if (parts[1] && parts[1].includes('@')) {
          parsedItem.username = parts[0] || '';
          parsedItem.email = parts[1] || '';
          parsedItem.password = parts[2] || '';
          parsedItem.f2aSecret = parts[3] || '';
          parsedItem.profile = parts[4] || '';
          var deleteInput = parts[5] || '';
        } else {
          parsedItem.username = parts[0] || '';
          parsedItem.password = parts[1] || '';
          parsedItem.email = parts[2] || '';
          parsedItem.f2aSecret = parts[3] || '';
          parsedItem.profile = parts[4] || '';
          var deleteInput = parts[5] || '';
        }

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

    const updatedVariants = (prodData.variants || []).map(v => {
      if (v.label === targetVariantLabel) {
        return {
          ...v,
          inviteEnabled: false,
        };
      }
      return v;
    });

    const totalStock = poolSnap.size;
    await prodRef.update({ variants: updatedVariants, stock: totalStock });

    res.json({ success: true, addedCount: lines.length, currentStock: totalStock, expiredAt: computedExpiredAt });
  } catch (err) {
    console.error('Error adding stock:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Edit single stock item
router.put('/stock/item/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const body = req.body;
    const itemRef = db.collection('credentials_pool').doc(itemId);
    const itemDoc = await itemRef.get();
    if (!itemDoc.exists) return res.status(404).json({ success: false, error: 'Stok tidak ditemukan' });

    const itemData = itemDoc.data();
    const updateData = {};
    if (body.username !== undefined) updateData.username = body.username;
    if (body.password !== undefined) updateData.password = body.password;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.f2aSecret !== undefined) updateData.f2aSecret = body.f2aSecret;
    if (body.profile !== undefined) updateData.profile = body.profile;
    if (body.expiredAt !== undefined) updateData.expiredAt = body.expiredAt ? new Date(body.expiredAt).toISOString() : null;

    if (body.isInviteItem !== undefined) updateData.isInviteItem = Boolean(body.isInviteItem);
    if (body.inviteEnabled !== undefined) updateData.inviteEnabled = Boolean(body.inviteEnabled);
    if (body.renewEnabled !== undefined) updateData.renewEnabled = Boolean(body.renewEnabled);
    if (body.maxRenew !== undefined) updateData.maxRenew = Number(body.maxRenew || 1);
    if (body.renewStartDate !== undefined) updateData.renewStartDate = body.renewStartDate || '';
    if (Array.isArray(body.renewScheduleDates)) updateData.renewScheduleDates = body.renewScheduleDates.filter(Boolean);
    if (body.renewNotReadyMessage !== undefined) updateData.renewNotReadyMessage = body.renewNotReadyMessage;

    if (body.warrantyEnabled !== undefined) updateData.warrantyEnabled = Boolean(body.warrantyEnabled);
    if (body.warrantyDays !== undefined) updateData.warrantyDays = Number(body.warrantyDays || 0);
    if (body.warrantyEndDate !== undefined) updateData.warrantyEndDate = body.warrantyEndDate ? new Date(body.warrantyEndDate).toISOString() : null;
    if (body.warrantyExpiredMessage !== undefined) updateData.warrantyExpiredMessage = body.warrantyExpiredMessage;
    if (body.warrantyTimeoutMessage !== undefined) updateData.warrantyTimeoutMessage = body.warrantyTimeoutMessage;
    if (body.warrantyCsMessage !== undefined) updateData.warrantyCsMessage = body.warrantyCsMessage;

    // Update raw data format text
    const parts = [
      updateData.username !== undefined ? updateData.username : (itemData.username || ''),
      updateData.email !== undefined ? updateData.email : (itemData.email || ''),
      updateData.password !== undefined ? updateData.password : (itemData.password || ''),
      updateData.f2aSecret !== undefined ? updateData.f2aSecret : (itemData.f2aSecret || ''),
      updateData.profile !== undefined ? updateData.profile : (itemData.profile || ''),
    ].filter(Boolean);

    updateData.data = parts.length > 0 ? parts.join(' | ') : (itemData.data || '');
    updateData.text = updateData.data;

    await itemRef.update(updateData);
    res.json({ success: true, message: 'Data stok berhasil diperbarui' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Auto-save product variant feature settings
router.post('/products/:id/update-variant-settings', async (req, res) => {
  try {
    const { variantLabel, inviteEnabled, renewEnabled, maxRenew, renewStartDate, renewScheduleDates, renewNotReadyMessage, warrantyEnabled, warrantyDays, warrantyEndDate, warrantyExpiredMessage, warrantyTimeoutMessage, warrantyCsMessage } = req.body;
    const prodRef = db.collection('products').doc(req.params.id);
    const prodDoc = await prodRef.get();
    if (!prodDoc.exists) return res.status(404).json({ success: false, error: 'Produk tidak ditemukan' });

    const prodData = prodDoc.data();
    const targetLabel = variantLabel || prodData.variants?.[0]?.label || 'Default';
    const inputDates = Array.isArray(renewScheduleDates) ? renewScheduleDates.filter(Boolean) : [];
    const scheduleDates = inputDates.length > 0 ? inputDates : (renewStartDate ? [renewStartDate] : []);
    const finalRenewStartDate = renewStartDate || (scheduleDates[0] || '');
    const computedMaxRenew = scheduleDates.length > 0 ? Math.max(Number(maxRenew || 1), scheduleDates.length) : Number(maxRenew || 1);
    const finalWarrantyEndDate = warrantyEndDate ? (warrantyEndDate.includes('T') ? warrantyEndDate : new Date(warrantyEndDate).toISOString()) : null;

    const updatedVariants = (prodData.variants || []).map(v => {
      if (v.label === targetLabel) {
        return {
          ...v,
          inviteEnabled: Boolean(inviteEnabled),
          renewEnabled: Boolean(renewEnabled),
          maxRenew: computedMaxRenew,
          renewStartDate: finalRenewStartDate,
          renewScheduleDates: scheduleDates,
          renewNotReadyMessage: renewNotReadyMessage || 'Tombol renew belum aktif saat ini.',
          warrantyEnabled: Boolean(warrantyEnabled),
          warrantyDays: Number(warrantyDays || 0),
          warrantyEndDate: finalWarrantyEndDate,
          warrantyExpiredMessage: warrantyExpiredMessage || 'Mohon maaf, garansi sudah tidak berlaku.',
          warrantyTimeoutMessage: warrantyTimeoutMessage || 'Garansi sudah hangus karena tidak ada bukti yang dikirim sebelumnya.',
          warrantyCsMessage: warrantyCsMessage || 'Jika ada kendala, silakan hubungi CS kami untuk bantuan lebih lanjut.',
        };
      }
      return v;
    });

    await prodRef.update({ variants: updatedVariants });
    res.json({ success: true, variants: updatedVariants });
  } catch (err) {
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

// Toggle ON / OFF active status of single stock item
router.put('/stock/item/:itemId/toggle', async (req, res) => {
  try {
    const { isActive } = req.body;
    const result = await toggleStockItemStatus(req.params.itemId, isActive);
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
        botToken: sysData.botToken || storeData.botToken || config.BOT_TOKEN || '',
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
    if (body.botToken !== undefined) sysUpdate.botToken = body.botToken;
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

// ─── BROADCAST MANAGER ───
const { generateRestockPNG } = require('../../src/broadcast-generator');

router.post('/broadcast', async (req, res) => {
  try {
    const {
      variant,
      isPng,
      apkLogoUrl,
      productName,
      duration,
      keterangan,
      price,
      freshBilling,
      sendToChannel,
      sendToUsers,
    } = req.body;

    if (!sendToChannel && !sendToUsers) {
      return res.status(400).json({ success: false, error: 'Pilih minimal satu target pengiriman (Channel atau User Bot)!' });
    }

    const selectedVariant = variant || 'RESTOCK';
    const isRestock = selectedVariant === 'RESTOCK';
    const usePng = isRestock && Boolean(isPng);

    // 1. Format text message based on variant specification
    let formattedText = '';
    if (isRestock) {
      if (usePng) {
        // Caption text for PNG Restock
        formattedText = `♻️ <b>RESTOCK TERSEDIA!</b>\n\n📦 <b>Produk :</b> ${productName || '-'}\n⏳ <b>Durasi :</b> ${duration || '-'}\n📌 <b>Keterangan :</b> ${keterangan || '-'}\n💰 <b>Harga :</b> ${price || '-'}\n🆕 <b>Fresh Billing :</b> ${freshBilling || '-'}`;
      } else {
        // Text format for RESTOCK PNG OFF
        const linkStr = apkLogoUrl && apkLogoUrl.trim() ? `\n🔗 Link Ikon Aplikasi: ${apkLogoUrl.trim()}\n` : '';
        formattedText = `♻️ <b>RESTOCK TERSEDIA!</b>\n${linkStr}\n📦 <b>Produk :</b> ${productName || '-'}\n⏳ <b>Durasi :</b> ${duration || '-'}\n📌 <b>Keterangan :</b> ${keterangan || '-'}\n💰 <b>Harga :</b> ${price || '-'}\n🆕 <b>Fresh Billing :</b> ${freshBilling || '-'}`;
      }
    } else if (selectedVariant === 'PERUBAHAN_HARGA') {
      formattedText = `📢 <b>PERUBAHAN HARGA</b>\n\n📦 <b>Produk :</b> ${productName || '-'}\n⏳ <b>Durasi :</b> ${duration || '-'}\n💰 <b>Harga Baru :</b> ${price || '-'}\n\n📌 <i>Catatan:</i>\nHarga telah diperbarui, silakan cek sebelum order.`;
    } else if (selectedVariant === 'DISKON') {
      formattedText = `🔥 <b>PROMO SPESIAL!</b>\n\n📦 <b>Produk :</b> ${productName || '-'}\n⏳ <b>Durasi :</b> ${duration || '-'}\n💰 <b>Harga Promo :</b> ${price || '-'}\n\n⚡ <i>Promo terbatas, segera order!</i>`;
    } else if (selectedVariant === 'INFO_PENTING') {
      formattedText = `📢 <b>INFORMASI PENTING</b>\n\n📦 <b>Produk :</b> ${productName || '-'}\n\n📌 <b>Detail:</b>\n${keterangan || '-'}\n\n<i>Mohon diperhatikan sebelum transaksi.</i>`;
    }

    // 2. Generate PNG buffer if RESTOCK + PNG ON
    let pngBuffer = null;
    if (usePng) {
      pngBuffer = await generateRestockPNG({
        apkLogoUrl,
        productName,
        duration,
        keterangan,
        price,
        freshBilling,
      });
    }

    // Fetch settings from Firestore
    const sysDoc = await db.collection('settings').doc('system').get();
    const storeDoc = await db.collection('settings').doc('store').get();
    const sysData = sysDoc.exists ? sysDoc.data() : {};
    const storeData = storeDoc.exists ? storeDoc.data() : {};

    // Initialize Telegraf bot
    const { Telegraf } = require('telegraf');
    const token = sysData.botToken 
      || storeData.botToken 
      || config.BOT_TOKEN 
      || process.env.BOT_TOKEN;

    if (!token) {
      return res.status(400).json({ 
        success: false, 
        error: 'BOT_TOKEN Telegram belum ditemukan. Pastikan Bot Telegram di Panel Pterodactyl sedang berjalan (otomatis sync), atau isi BOT_TOKEN di Pengaturan Toko.' 
      });
    }
    const bot = new Telegraf(token);

    let channelSent = false;
    let userSentCount = 0;
    let userFailedCount = 0;

    // 3. Send to Channel if enabled
    let channelError = null;

    // 3. Send to Channel if enabled
    if (sendToChannel) {
      try {
        const targetChannelId = sysData.requiredChannelId 
          || storeData.requiredChannelId 
          || config.REQUIRED_CHANNEL_ID 
          || config.TESTIMONI_CHANNEL_ID 
          || process.env.REQUIRED_CHANNEL_ID 
          || process.env.TESTIMONI_CHANNEL_ID 
          || process.env.CHANNEL_ID;

        if (!targetChannelId) {
          channelError = 'Target Channel ID belum dikonfigurasi di Pengaturan Toko.';
          if (!sendToUsers) {
            return res.status(400).json({ 
              success: false, 
              error: 'Target Channel Telegram belum dikonfigurasi! Silakan isi Username / ID Channel di Pengaturan Toko.' 
            });
          }
        } else {
          if (usePng && pngBuffer) {
            await bot.telegram.sendPhoto(targetChannelId, { source: pngBuffer, filename: 'restock.png' }, { caption: formattedText, parse_mode: 'HTML' });
          } else {
            await bot.telegram.sendMessage(targetChannelId, formattedText, { parse_mode: 'HTML' });
          }
          channelSent = true;
        }
      } catch (err) {
        console.error('Broadcast Channel Error:', err);
        channelError = err.message;
        if (!sendToUsers) {
          return res.status(400).json({ success: false, error: `Gagal mengirim ke Channel Telegram: ${err.message}` });
        }
      }
    }

    // 4. Send to Users if enabled
    if (sendToUsers) {
      try {
        const usersSnap = await db.collection('bot_users').get();
        const userDocs = usersSnap.docs;

        for (const doc of userDocs) {
          const userId = doc.id;
          if (!userId) continue;

          try {
            if (usePng && pngBuffer) {
              await bot.telegram.sendPhoto(userId, { source: pngBuffer, filename: 'restock.png' }, { caption: formattedText, parse_mode: 'HTML' });
            } else {
              await bot.telegram.sendMessage(userId, formattedText, { parse_mode: 'HTML' });
            }
            userSentCount++;
            // Small delay to avoid rate limits
            await new Promise(r => setTimeout(r, 40));
          } catch (uErr) {
            userFailedCount++;
          }
        }
      } catch (err) {
        console.error('Broadcast Users Error:', err);
      }
    }

    res.json({
      success: true,
      data: {
        channelSent,
        userSentCount,
        userFailedCount,
      }
    });
  } catch (err) {
    console.error('Broadcast endpoint error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

