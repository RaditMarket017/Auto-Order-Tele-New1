const { db } = require('./firebase');
const config = require('./config');

/**
 * Get reseller config from Firestore
 */
async function getResellerConfig() {
  try {
    const doc = await db.collection('settings').doc('reseller').get();
    if (!doc.exists) {
      return {
        activationPrice: 25000,
        durationDays: 30,
        discountPercent: 15,
        isEnabled: true,
      };
    }
    return doc.data();
  } catch {
    return { activationPrice: 25000, durationDays: 30, discountPercent: 15, isEnabled: true };
  }
}

/**
 * Get user role (admin / reseller / member)
 */
async function getUserRole(userId) {
  try {
    if (userId.toString() === config.ADMIN_ID.toString()) {
      return { role: 'admin' };
    }
    const doc = await db.collection('bot_users').doc(userId.toString()).get();
    if (!doc.exists) return { role: 'member' };

    const data = doc.data();
    if (data.role === 'admin') return { role: 'admin' };

    if (data.role === 'reseller') {
      // Check expiry
      if (data.resellerExpiry) {
        const expiry = new Date(data.resellerExpiry);
        if (expiry < new Date()) {
          // Expired — downgrade
          await db.collection('bot_users').doc(userId.toString()).update({ role: 'member' });
          return { role: 'member' };
        }
        return { role: 'reseller', resellerExpiry: data.resellerExpiry };
      }
      return { role: 'reseller' };
    }

    return { role: 'member' };
  } catch {
    return { role: 'member' };
  }
}

/**
 * Get product price based on user role and quantity (supports Wholesale Bulk Tiers)
 */
async function getProductPrice(variant, userId, qty = 1, product = null) {
  let basePrice = variant.price || 0;

  // Check Wholesale / Bulk Tiers
  const tiers = variant.wholesaleTiers || product?.wholesaleTiers || [];
  if (Array.isArray(tiers) && tiers.length > 0 && qty > 1) {
    const sortedTiers = [...tiers].sort((a, b) => b.minQty - a.minQty);
    const matchingTier = sortedTiers.find(t => qty >= t.minQty);
    if (matchingTier && matchingTier.price > 0) {
      basePrice = matchingTier.price;
    }
  }

  return basePrice;
}

/**
 * Apply voucher to order
 */
async function applyVoucher(code, totalPrice, productId = null) {
  try {
    const snap = await db.collection('vouchers')
      .where('code', '==', code.toUpperCase())
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (snap.empty) return { valid: false, reason: 'invalid' };

    const voucher = snap.docs[0].data();
    const voucherId = snap.docs[0].id;

    // Check expiry
    if (voucher.expiryDate && new Date(voucher.expiryDate) < new Date()) {
      return { valid: false, reason: 'expired' };
    }

    // Check max uses
    if (voucher.maxUses && (voucher.currentUses || 0) >= voucher.maxUses) {
      return { valid: false, reason: 'max_uses' };
    }

    // Check min purchase
    if (voucher.minPurchase && totalPrice < voucher.minPurchase) {
      return { valid: false, reason: 'min_purchase', minPurchase: voucher.minPurchase };
    }

    // Check product restriction
    if (voucher.applicableProducts && voucher.applicableProducts.length > 0) {
      if (productId && !voucher.applicableProducts.includes(productId)) {
        return { valid: false, reason: 'product_restricted' };
      }
    }

    // Calculate discount
    let discount = 0;
    if (voucher.type === 'percentage') {
      discount = Math.round(totalPrice * (voucher.value / 100));
      if (voucher.maxDiscount) discount = Math.min(discount, voucher.maxDiscount);
    } else {
      discount = voucher.value;
    }

    discount = Math.min(discount, totalPrice); // Don't exceed total

    return {
      valid: true,
      voucherId,
      code: voucher.code,
      discount,
      type: voucher.type,
      value: voucher.value,
      finalPrice: totalPrice - discount,
    };
  } catch (err) {
    console.error('applyVoucher error:', err);
    return { valid: false, reason: 'error' };
  }
}

/**
 * Increment voucher usage after successful order
 */
async function useVoucher(voucherId) {
  try {
    const { FieldValue } = require('firebase-admin/firestore');
    await db.collection('vouchers').doc(voucherId).update({
      currentUses: FieldValue.increment(1),
    });
  } catch (err) {
    console.error('useVoucher error:', err);
  }
}

module.exports = {
  getResellerConfig,
  getUserRole,
  getProductPrice,
  applyVoucher,
  useVoucher,
};
