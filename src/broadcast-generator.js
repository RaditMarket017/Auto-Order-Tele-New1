const { createCanvas, loadImage } = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs');

/**
 * Generate RESTOCK PNG image using restock.jpg template
 */
async function generateRestockPNG(data = {}) {
  const templatePath = path.join(__dirname, '..', 'restock.jpg');
  if (!fs.existsSync(templatePath)) {
    throw new Error('Template restock.jpg tidak ditemukan!');
  }

  const bgImg = await loadImage(templatePath);
  const canvas = createCanvas(bgImg.width, bgImg.height);
  const ctx = canvas.getContext('2d');

  // Draw base template image
  ctx.drawImage(bgImg, 0, 0);

  // 1. Render APK Logo inside top-center frame
  const logoX = 400;
  const logoY = 220;
  const logoW = 454;
  const logoH = 375;
  const r = 24;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(logoX + r, logoY);
  ctx.lineTo(logoX + logoW - r, logoY);
  ctx.quadraticCurveTo(logoX + logoW, logoY, logoX + logoW, logoY + r);
  ctx.lineTo(logoX + logoW, logoY + logoH - r);
  ctx.quadraticCurveTo(logoX + logoW, logoY + logoH, logoX + logoW - r, logoY + logoH);
  ctx.lineTo(logoX + r, logoY + logoH);
  ctx.quadraticCurveTo(logoX, logoY + logoH, logoX, logoY + logoH - r);
  ctx.lineTo(logoX, logoY + r);
  ctx.quadraticCurveTo(logoX, logoY, logoX + r, logoY);
  ctx.closePath();
  ctx.clip();

  let logoLoaded = false;
  if (data.apkLogoUrl && data.apkLogoUrl.trim().length > 0) {
    try {
      const logoImg = await loadImage(data.apkLogoUrl.trim());
      ctx.drawImage(logoImg, logoX, logoY, logoW, logoH);
      logoLoaded = true;
    } catch (err) {
      console.warn('Failed to load apkLogoUrl for broadcast PNG:', err.message);
    }
  }

  if (!logoLoaded) {
    // Fallback: Gradient background with initial or product name
    const grad = ctx.createLinearGradient(logoX, logoY, logoX + logoW, logoY + logoH);
    grad.addColorStop(0, '#041c38');
    grad.addColorStop(0.5, '#0052cc');
    grad.addColorStop(1, '#0099ff');
    ctx.fillStyle = grad;
    ctx.fillRect(logoX, logoY, logoW, logoH);

    const initial = (data.productName || 'APK').charAt(0).toUpperCase();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 110px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 200, 255, 0.8)';
    ctx.shadowBlur = 15;
    ctx.fillText(initial, logoX + logoW / 2, logoY + logoH / 2);
  }
  ctx.restore();

  // 2. Render Text Fields into boxes
  const fields = [
    { key: 'productName', val: (data.productName || '-').toUpperCase(), centerY: 681 },
    { key: 'duration', val: (data.duration || '-').toUpperCase(), centerY: 792 },
    { key: 'keterangan', val: (data.keterangan || '-').toUpperCase(), centerY: 903 },
    { key: 'price', val: (data.price || '-').toUpperCase(), centerY: 1014 },
    { key: 'freshBilling', val: (data.freshBilling || '-').toUpperCase(), centerY: 1125 },
  ];

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#00f0ff'; // Cyber neon cyan
  ctx.shadowColor = 'rgba(0, 240, 255, 0.65)';
  ctx.shadowBlur = 10;

  fields.forEach(f => {
    let fontSize = 34;
    ctx.font = `bold ${fontSize}px sans-serif`;

    // Auto shrink font size if string overflows box width
    while (ctx.measureText(f.val).width > 750 && fontSize > 16) {
      fontSize -= 2;
      ctx.font = `bold ${fontSize}px sans-serif`;
    }
    ctx.fillText(f.val, 405, f.centerY);
  });

  return canvas.toBuffer('image/png');
}

module.exports = {
  generateRestockPNG,
};
