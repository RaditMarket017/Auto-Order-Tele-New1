const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const saPath = path.join(__dirname, '..', 'serviceAccountKey.json');

if (fs.existsSync(saPath)) {
  const serviceAccount = require(saPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} else if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
} else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} else {
  console.warn('⚠️ WARNING: serviceAccountKey.json tidak ditemukan di folder project!');
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

const db = admin.firestore();

module.exports = { admin, db };
