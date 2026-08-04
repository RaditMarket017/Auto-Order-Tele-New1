const { createCanvas, loadImage } = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

/**
 * Overlay logo.png on top-right corner of any restock image
 * @param {Buffer|string} imageInput
 * @param {object} options
 * @returns {Promise<Buffer>}
 */
async function overlayWatermarkLogo(imageInput, options = {}) {
  let baseImg;
  try {
    if (Buffer.isBuffer(imageInput)) {
      baseImg = await loadImage(imageInput);
    } else if (typeof imageInput === 'string' && (imageInput.startsWith('http://') || imageInput.startsWith('https://'))) {
      const resp = await axios.get(imageInput, { responseType: 'arraybuffer', timeout: 15000 });
      baseImg = await loadImage(Buffer.from(resp.data));
    } else if (typeof imageInput === 'string' && imageInput.startsWith('data:image')) {
      const base64Data = imageInput.split(',')[1];
      baseImg = await loadImage(Buffer.from(base64Data, 'base64'));
    } else if (typeof imageInput === 'string' && fs.existsSync(imageInput)) {
      baseImg = await loadImage(fs.readFileSync(imageInput));
    } else {
      const templatePath = path.join(__dirname, '..', 'restock.jpg');
      if (fs.existsSync(templatePath)) {
        baseImg = await loadImage(fs.readFileSync(templatePath));
      } else {
        throw new Error('Image source not found');
      }
    }
  } catch (err) {
    console.error('overlayWatermarkLogo base image load error:', err.message);
    const templatePath = path.join(__dirname, '..', 'restock.jpg');
    baseImg = await loadImage(fs.readFileSync(templatePath));
  }

  const canvas = createCanvas(baseImg.width, baseImg.height);
  const ctx = canvas.getContext('2d');

  // 1. Draw base restock image
  ctx.drawImage(baseImg, 0, 0);

  // 2. Load logo.png
  let logoImg;
  const logoPath = options.logoPath || path.join(__dirname, '..', 'logo.png');
  if (fs.existsSync(logoPath)) {
    try {
      logoImg = await loadImage(fs.readFileSync(logoPath));
    } catch (e) {}
  }

  if (logoImg) {
    const logoSize = options.logoSize || Math.max(60, Math.min(260, Math.round(baseImg.width * 0.16)));
    const padding = Math.max(10, Math.round(baseImg.width * 0.02));

    const position = options.position || 'top-left';
    let logoX, logoY;

    if (position === 'top-right') {
      logoX = baseImg.width - logoSize - padding;
      logoY = padding;
    } else { // default: top-left
      logoX = padding;
      logoY = padding;
    }

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 4;

    ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
    ctx.restore();
  }

  return canvas.toBuffer('image/png');
}

/**
 * Generate RESTOCK PNG image using restock.jpg template or uploaded image
 * @param {object} data
 * @returns {Promise<Buffer>}
 */
async function generateRestockPNG(data = {}) {
  // If custom restock image is provided (uploaded image or URL), use watermark overlay
  if (data.restockImage || data.restockImageUrl || data.mediaUrl) {
    const imgSource = data.restockImage || data.restockImageUrl || data.mediaUrl;
    return await overlayWatermarkLogo(imgSource, { position: data.logoPosition || 'top-left' });
  }

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

  // 1. Render APK Logo inside top-center frame box
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
    const grad = ctx.createLinearGradient(frameX, frameY, frameX + frameW, frameY + frameH);
    grad.addColorStop(0, '#041c38');
    grad.addColorStop(0.5, '#0044aa');
    grad.addColorStop(1, '#0088ff');
    ctx.fillStyle = grad;
    ctx.fillRect(frameX, frameY, frameW, frameH);

    const initial = (data.productName || data.name || 'APK').charAt(0).toUpperCase();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 120px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 200, 255, 0.8)';
    ctx.shadowBlur = 15;
    ctx.fillText(initial, frameX + frameW / 2, frameY + frameH / 2);
  }
  ctx.restore();

  // 2. Render Text Fields into 5 rows inside restock.jpg boxes
  const productName = (data.productName || data.name || '-').toString();
  const duration = (data.duration || data.durasi || '-').toString();
  const keterangan = (data.keterangan || data.desc || data.detail || '-').toString();
  const price = (data.price || data.harga || '-').toString();
  const freshBilling = (data.freshBilling || data.billing || data.fresh_billing || '-').toString();

  const fields = [
    { key: 'productName', val: productName, centerY: 749 },
    { key: 'duration', val: duration, centerY: 847 },
    { key: 'keterangan', val: keterangan, centerY: 945 },
    { key: 'price', val: price, centerY: 1044 },
    { key: 'freshBilling', val: freshBilling, centerY: 1142 },
  ];

  const textStartX = 425;
  const maxTextWidth = 720;

  fields.forEach(f => {
    let fontSize = 36;
    ctx.save();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${fontSize}px sans-serif`;

    while (ctx.measureText(f.val).width > maxTextWidth && fontSize > 16) {
      fontSize -= 2;
      ctx.font = `bold ${fontSize}px sans-serif`;
    }

    ctx.shadowColor = 'rgba(0, 240, 255, 0.8)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#00f0ff';
    ctx.fillText(f.val, textStartX, f.centerY);

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(f.val, textStartX, f.centerY);

    ctx.restore();
  });

  // 3. Stamp logo.png at top-left corner
  let logoImg;
  const logoPath = path.join(__dirname, '..', 'logo.png');
  if (fs.existsSync(logoPath)) {
    try {
      logoImg = await loadImage(fs.readFileSync(logoPath));
      const logoSize = 160;
      const padding = 24;
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 12;
      ctx.drawImage(logoImg, padding, padding, logoSize, logoSize);
      ctx.restore();
    } catch (e) {}
  }

  return canvas.toBuffer('image/png');
}

module.exports = {
  generateRestockPNG,
  overlayWatermarkLogo,
};
