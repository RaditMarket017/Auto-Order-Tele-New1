const { db } = require('./firebase');

/**
 * Clean up expired stock items in credentials_pool
 * @param {string|null} productId - Optional product ID to filter
 * @param {number} thresholdDays - Threshold in days. 0 = delete when expired (H-0), 1 = delete if <= 1 day remaining (H-1)
 * @returns {Promise<{cleanedCount: number, affectedProducts: string[]}>}
 */
async function cleanExpiredStock(productId = null, thresholdDays = 0) {
  try {
    let query = db.collection('credentials_pool').where('isUsed', '==', false);
    if (productId) {
      query = query.where('productId', '==', productId);
    }

    const snap = await query.get();
    if (snap.empty) return { cleanedCount: 0, affectedProducts: [] };

    // Get custom threshold from store settings if thresholdDays is 0
    let effectiveThreshold = thresholdDays;
    if (effectiveThreshold === 0) {
      try {
        const settingsDoc = await db.collection('settings').doc('system').get();
        if (settingsDoc.exists && settingsDoc.data().stockExpireThresholdDays !== undefined) {
          effectiveThreshold = parseInt(settingsDoc.data().stockExpireThresholdDays) || 0;
        }
      } catch {}
    }

    // Cut-off time: now + effectiveThreshold days
    const cutoff = new Date();
    if (effectiveThreshold > 0) {
      cutoff.setDate(cutoff.getDate() + effectiveThreshold);
    }

    const expiredDocs = [];
    const affectedProductIds = new Set();

    snap.docs.forEach(doc => {
      const data = doc.data();
      if (data.expiredAt) {
        const expDate = new Date(data.expiredAt);
        if (!isNaN(expDate.getTime()) && expDate <= cutoff) {
          expiredDocs.push(doc);
          affectedProductIds.add(data.productId);
        }
      }
    });

    if (expiredDocs.length === 0) return { cleanedCount: 0, affectedProducts: [] };

    // Batch delete expired stock items
    const batchSize = 500;
    for (let i = 0; i < expiredDocs.length; i += batchSize) {
      const batch = db.batch();
      const chunk = expiredDocs.slice(i, i + batchSize);
      chunk.forEach(d => {
        batch.delete(d.ref);
      });
      await batch.commit();
    }

    // Recalculate stock counts for affected products
    for (const pId of affectedProductIds) {
      await syncProductStock(pId);
    }

    console.log(`🧹 Cleaned up ${expiredDocs.length} expired stock items.`);
    return { cleanedCount: expiredDocs.length, affectedProducts: Array.from(affectedProductIds) };
  } catch (err) {
    console.error('cleanExpiredStock error:', err.message);
    return { cleanedCount: 0, affectedProducts: [] };
  }
}

/**
 * Sync product stock counts in Firestore `products` collection based on credentials_pool
 * @param {string} productId
 */
async function syncProductStock(productId) {
  try {
    const prodRef = db.collection('products').doc(productId);
    const prodDoc = await prodRef.get();
    if (!prodDoc.exists) return;

    const prodData = prodDoc.data();

    // Query active unused stock for this product
    const poolSnap = await db.collection('credentials_pool')
      .where('productId', '==', productId)
      .where('isUsed', '==', false)
      .get();

    const stockByVariant = {};
    poolSnap.forEach(d => {
      const vl = d.data().variantLabel || 'Default';
      stockByVariant[vl] = (stockByVariant[vl] || 0) + 1;
    });

    const updatedVariants = (prodData.variants || []).map(v => ({
      ...v,
      stock: stockByVariant[v.label] ?? 0,
    }));

    const totalStock = poolSnap.size;

    await prodRef.update({
      variants: updatedVariants,
      stock: totalStock,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('syncProductStock error:', err.message);
  }
}

/**
 * Delete a single stock item from credentials_pool
 * @param {string} itemId
 */
async function deleteStockItem(itemId) {
  try {
    const docRef = db.collection('credentials_pool').doc(itemId);
    const doc = await docRef.get();
    if (!doc.exists) return { success: false, error: 'Stok tidak ditemukan' };

    const productId = doc.data().productId;
    await docRef.delete();
    await syncProductStock(productId);

    return { success: true, productId };
  } catch (err) {
    console.error('deleteStockItem error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Clear all stock for a product (or variant)
 * @param {string} productId
 * @param {string|null} variantLabel
 */
async function clearStockForProduct(productId, variantLabel = null) {
  try {
    let query = db.collection('credentials_pool')
      .where('productId', '==', productId)
      .where('isUsed', '==', false);

    if (variantLabel) {
      query = query.where('variantLabel', '==', variantLabel);
    }

    const snap = await query.get();
    if (snap.empty) return { success: true, deletedCount: 0 };

    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();

    await syncProductStock(productId);
    return { success: true, deletedCount: snap.size };
  } catch (err) {
    console.error('clearStockForProduct error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Update expiration date for a single stock item
 * @param {string} itemId
 * @param {string|null} expiredAt - ISO date string or YYYY-MM-DD
 */
async function updateStockItemExpiredDate(itemId, expiredAt) {
  try {
    const docRef = db.collection('credentials_pool').doc(itemId);
    const doc = await docRef.get();
    if (!doc.exists) return { success: false, error: 'Stok tidak ditemukan' };

    const formattedDate = expiredAt ? new Date(expiredAt).toISOString() : null;
    await docRef.update({
      expiredAt: formattedDate,
      updatedAt: new Date().toISOString(),
    });

    return { success: true, expiredAt: formattedDate };
  } catch (err) {
    console.error('updateStockItemExpiredDate error:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  cleanExpiredStock,
  syncProductStock,
  deleteStockItem,
  clearStockForProduct,
  updateStockItemExpiredDate,
};
