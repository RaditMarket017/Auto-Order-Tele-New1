const { db } = require('./firebase');

/**
 * Get user session from Firestore (stateless-safe)
 */
async function getSession(userId) {
  const doc = await db.collection('user_sessions').doc(userId.toString()).get();
  if (!doc.exists) return { cart: null };
  return doc.data();
}

/**
 * Update user session
 */
async function updateSession(userId, data) {
  await db.collection('user_sessions').doc(userId.toString()).set(data, { merge: true });
}

/**
 * Set cart data in session
 */
async function setCart(userId, cartData) {
  await updateSession(userId, { cart: cartData });
}

/**
 * Get cart from session
 */
async function getCart(userId) {
  const session = await getSession(userId);
  return session.cart || null;
}

/**
 * Clear cart from session
 */
async function clearCart(userId) {
  await db.collection('user_sessions').doc(userId.toString()).update({ cart: null }).catch(() => {});
}

module.exports = {
  getSession,
  updateSession,
  setCart,
  getCart,
  clearCart,
};
