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

  // 1. Render APK Logo inside top-center frame (fitted for updated restock.jpg template)
  const frameX = 362;
  const frameY = 180;
  const frameW = 514;
  const frameH = 434;
  const r = 30;

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
      const logoImg = await loadImage(data.apkLogoUrl.trim());
      // Maintain 1:1 aspect ratio centered inside the frame
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

  // 2. Render Text Fields into boxes
  const fields = [
    { key: 'productName', val: (data.productName || '-').toString().toUpperCase(), centerY: 749 },
    { key: 'duration', val: (data.duration || '-').toString().toUpperCase(), centerY: 847 },
    { key: 'keterangan', val: (data.keterangan || '-').toString().toUpperCase(), centerY: 945 },
    { key: 'price', val: (data.price || '-').toString().toUpperCase(), centerY: 1044 },
    { key: 'freshBilling', val: (data.freshBilling || '-').toString().toUpperCase(), centerY: 1142 },
  ];

  const textStartX = 430; // 28px gap from left divider line
  const maxTextWidth = 650;

  fields.forEach(f => {
    let fontSize = 34;
    ctx.save();
    
    // Reset shadow first to prevent Linux Skia/Cairo canvas text transparency issue
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${fontSize}px Arial, "DejaVu Sans", "Liberation Sans", sans-serif`;

    // Auto shrink font size if string overflows box width (max 650px)
    while (ctx.measureText(f.val).width > maxTextWidth && fontSize > 16) {
      fontSize -= 2;
      ctx.font = `bold ${fontSize}px Arial, "DejaVu Sans", "Liberation Sans", sans-serif`;
    }

    // Pass 1: Subtle Neon Blue/Cyan Glow
    ctx.shadowColor = 'rgba(0, 240, 255, 0.9)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#00f0ff';
    ctx.fillText(f.val, textStartX, f.centerY);

    // Pass 2: Clean crisp solid text fill on top
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#00ffff';
    ctx.fillText(f.val, textStartX, f.centerY);

    ctx.restore();
  });

  return canvas.toBuffer('image/png');
}

module.exports = {
  generateRestockPNG,
};
