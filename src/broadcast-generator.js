const { createCanvas, loadImage } = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

/**
 * Generate RESTOCK PNG image using restock.jpg template
 */
async function generateRestockPNG(data = {}) {
  const templatePath = path.join(__dirname, '..', 'restock.jpg');
  if (!fs.existsSync(templatePath)) {
    throw new Error('Template restock.jpg tidak ditemukan!');
  }

  // Load base template as buffer
  const bgImg = await loadImage(fs.readFileSync(templatePath));
  const canvas = createCanvas(bgImg.width, bgImg.height);
  const ctx = canvas.getContext('2d');

  // Draw base template image
  ctx.drawImage(bgImg, 0, 0);

  // 1. Render APK Logo inside top-center frame box (exact coordinates for restock.jpg 1254x1254)
  const frameX = 364;
  const frameY = 181;
  const frameW = 511;
  const frameH = 488;
  const r = 38;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(frameX + r, frameY);
  ctx.lineTo(frameX + frameW - r, frameY);
  ctx.quadraticCurveTo(frameX + frameW, frameY, frameX + frameW, frameY + r);
  ctx.lineTo(frameX + frameW, frameY + frameH - r);
  ctx.quadraticCurveTo(frameX + frameW, frameY + frameH, frameX + frameW - r, frameY + frameH);
  ctx.lineTo(frameX + r, frameY + frameH);
  ctx.quadraticCurveTo(frameX, frameY + frameH, frameX, frameY + frameH - r);
  ctx.lineTo(frameX, frameY + r);
  ctx.quadraticCurveTo(frameX, frameY, frameX + r, frameY);
  ctx.closePath();
  ctx.clip();

  let logoLoaded = false;
  if (data.apkLogoUrl && data.apkLogoUrl.trim().length > 0) {
    try {
      let logoSource = data.apkLogoUrl.trim();
      if (logoSource.startsWith('http://') || logoSource.startsWith('https://')) {
        const resp = await axios.get(logoSource, { responseType: 'arraybuffer', timeout: 12000 });
        logoSource = Buffer.from(resp.data);
      }
      const logoImg = await loadImage(logoSource);

      // Maintain aspect ratio centered inside the frame box
      const imgAspect = (logoImg.width && logoImg.height) ? (logoImg.width / logoImg.height) : 1;
      let drawW = frameW;
      let drawH = frameH;
      let drawX = frameX;
      let drawY = frameY;

      if (imgAspect > 1) {
        drawH = frameW / imgAspect;
        drawY = frameY + (frameH - drawH) / 2;
      } else if (imgAspect < 1) {
        drawW = frameH * imgAspect;
        drawX = frameX + (frameW - drawW) / 2;
      }

      ctx.drawImage(logoImg, drawX, drawY, drawW, drawH);
      logoLoaded = true;
    } catch (err) {
      console.warn('Failed to load apkLogoUrl for broadcast PNG:', err.message);
    }
  }

  if (!logoLoaded) {
    // Fallback: Gradient background with initial or product name
    const grad = ctx.createLinearGradient(frameX, frameY, frameX + frameW, frameY + frameH);
    grad.addColorStop(0, '#041c38');
    grad.addColorStop(0.5, '#0044aa');
    grad.addColorStop(1, '#0088ff');
    ctx.fillStyle = grad;
    ctx.fillRect(frameX, frameY, frameW, frameH);

    const initial = (data.productName || 'APK').charAt(0).toUpperCase();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 120px Arial, "DejaVu Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 200, 255, 0.8)';
    ctx.shadowBlur = 15;
    ctx.fillText(initial, frameX + frameW / 2, frameY + frameH / 2);
  }
  ctx.restore();

  // 2. Render Text Fields into 5 rows
  const fields = [
    { key: 'productName', val: (data.productName || '-').toString(), centerY: 749 },
    { key: 'duration', val: (data.duration || '-').toString(), centerY: 847 },
    { key: 'keterangan', val: (data.keterangan || '-').toString(), centerY: 945 },
    { key: 'price', val: (data.price || '-').toString(), centerY: 1044 },
    { key: 'freshBilling', val: (data.freshBilling || '-').toString(), centerY: 1142 },
  ];

  const textStartX = 425; // Directly after vertical divider line
  const maxTextWidth = 720;

  fields.forEach(f => {
    let fontSize = 38;
    ctx.save();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${fontSize}px Arial, "DejaVu Sans", "Liberation Sans", sans-serif`;

    // Auto shrink font size if text overflows 720px width
    while (ctx.measureText(f.val).width > maxTextWidth && fontSize > 16) {
      fontSize -= 2;
      ctx.font = `bold ${fontSize}px Arial, "DejaVu Sans", "Liberation Sans", sans-serif`;
    }

    // Pass 1: Neon Cyan Glow
    ctx.shadowColor = 'rgba(0, 240, 255, 0.9)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#00f0ff';
    ctx.fillText(f.val, textStartX, f.centerY);

    // Pass 2: Clean crisp white text fill
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(f.val, textStartX, f.centerY);

    ctx.restore();
  });

  return canvas.toBuffer('image/png');
}

module.exports = {
  generateRestockPNG,
};
