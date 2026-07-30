const { createCanvas, loadImage } = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs');

// ─── Helper: Rounded Rectangle ───
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ─── Helper: Currency Formatter ───
function formatCurrency(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount || 0);
}

// ─── Helper: Draw Glassmorphism Card ───
function drawGlassCard(ctx, x, y, w, h, r = 14) {
  // Outer glow shadow
  ctx.shadowColor = 'rgba(0, 120, 255, 0.12)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 4;

  roundRect(ctx, x, y, w, h, r);
  const cardGrad = ctx.createLinearGradient(x, y, x, y + h);
  cardGrad.addColorStop(0, 'rgba(15, 30, 60, 0.85)');
  cardGrad.addColorStop(1, 'rgba(8, 18, 40, 0.95)');
  ctx.fillStyle = cardGrad;
  ctx.fill();

  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Border
  roundRect(ctx, x, y, w, h, r);
  ctx.strokeStyle = 'rgba(60, 130, 230, 0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Top highlight edge
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  const highlightGrad = ctx.createLinearGradient(x, y, x + w, y);
  highlightGrad.addColorStop(0, 'rgba(0, 150, 255, 0)');
  highlightGrad.addColorStop(0.5, 'rgba(0, 180, 255, 0.15)');
  highlightGrad.addColorStop(1, 'rgba(0, 150, 255, 0)');
  ctx.fillStyle = highlightGrad;
  ctx.fillRect(x, y, w, 2);
  ctx.restore();
}

// ─── Helper: Horizontal Separator Line ───
function drawSeparator(ctx, x, y, w) {
  const sepGrad = ctx.createLinearGradient(x, y, x + w, y);
  sepGrad.addColorStop(0, 'rgba(0, 150, 255, 0)');
  sepGrad.addColorStop(0.3, 'rgba(0, 150, 255, 0.25)');
  sepGrad.addColorStop(0.5, 'rgba(0, 200, 255, 0.5)');
  sepGrad.addColorStop(0.7, 'rgba(0, 150, 255, 0.25)');
  sepGrad.addColorStop(1, 'rgba(0, 150, 255, 0)');
  ctx.fillStyle = sepGrad;
  ctx.fillRect(x, y, w, 1);
}

function hexToRgba(hex, alpha = 1) {
  if (!hex || typeof hex !== 'string') return `rgba(0, 150, 255, ${alpha})`;
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  if (c.length !== 6) return `rgba(0, 150, 255, ${alpha})`;
  const num = parseInt(c, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Generate nota order PNG — Ultra Premium Dark Glassmorphism
 */
async function generateNotaPNG(orderData, storeSettings = {}) {
  const width = 700;
  const height = 1020;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const pad = 40; // main horizontal padding
  const cardW = width - pad * 2;

  const bgColor = storeSettings.notaBgColor || '#071428';
  const accentColor = storeSettings.notaAccentColor || '#0077ff';
  const accentRgba = hexToRgba(accentColor, 0.5);

  // ═══════════════════════════════════════════════════════════
  // BACKGROUND: Custom gradient + subtle grid texture
  // ═══════════════════════════════════════════════════════════
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, '#030a18');
  bgGrad.addColorStop(0.3, bgColor);
  bgGrad.addColorStop(0.7, bgColor);
  bgGrad.addColorStop(1, '#040c1a');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle grid pattern
  ctx.strokeStyle = hexToRgba(accentColor, 0.06);
  ctx.lineWidth = 1;
  for (let gx = 0; gx < width; gx += 35) {
    ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, height); ctx.stroke();
  }
  for (let gy = 0; gy < height; gy += 35) {
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(width, gy); ctx.stroke();
  }

  // Top radial glow (ambient lighting)
  const topGlow = ctx.createRadialGradient(width / 2, 0, 50, width / 2, 0, 400);
  topGlow.addColorStop(0, 'rgba(0, 100, 255, 0.12)');
  topGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, width, 400);

  // Bottom radial glow
  const btmGlow = ctx.createRadialGradient(width / 2, height, 50, width / 2, height, 350);
  btmGlow.addColorStop(0, 'rgba(0, 80, 200, 0.08)');
  btmGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = btmGlow;
  ctx.fillRect(0, height - 350, width, 350);

  // ═══════════════════════════════════════════════════════════
  // OUTER FRAME: Double neon border
  // ═══════════════════════════════════════════════════════════
  // Outer glow
  roundRect(ctx, 12, 12, width - 24, height - 24, 22);
  ctx.strokeStyle = accentRgba;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Inner frame
  roundRect(ctx, 16, 16, width - 32, height - 32, 18);
  ctx.strokeStyle = hexToRgba(accentColor, 0.15);
  ctx.lineWidth = 1;
  ctx.stroke();

  // Corner accent dots
  const corners = [[24, 24], [width - 24, 24], [24, height - 24], [width - 24, height - 24]];
  corners.forEach(([cx, cy]) => {
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = accentColor;
    ctx.fill();
  });

  let yPos = 38;

  // ═══════════════════════════════════════════════════════════
  // HEADER: Store Name + Nota Order Badge
  // ═══════════════════════════════════════════════════════════
  const storeName = storeSettings.notaStoreName || storeSettings.storeName || 'STORE NAME';
  const logoUrl = storeSettings.notaLogoUrl || storeSettings.storeLogoUrl || '';

  // Render Store Logo if available
  if (logoUrl) {
    try {
      const logoImg = await loadImage(logoUrl);
      const logoSize = 56;
      const logoX = (width - logoSize) / 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(logoX + logoSize / 2, yPos + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(logoImg, logoX, yPos, logoSize, logoSize);
      ctx.restore();

      ctx.beginPath();
      ctx.arc(logoX + logoSize / 2, yPos + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      yPos += logoSize + 10;
    } catch (e) {}
  }

  // Decorative top line
  drawSeparator(ctx, pad + 30, yPos, cardW - 60);
  yPos += 15;

  // Store Name
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(storeName.toUpperCase(), width / 2, yPos + 26);

  // Glow under text
  const nameGlow = ctx.createRadialGradient(width / 2, yPos + 20, 10, width / 2, yPos + 20, 150);
  nameGlow.addColorStop(0, 'rgba(0, 150, 255, 0.08)');
  nameGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = nameGlow;
  ctx.fillRect(pad, yPos, cardW, 40);

  yPos += 48;

  // NOTA ORDER Pill Badge
  const pillW = 240;
  const pillH = 40;
  const pillX = (width - pillW) / 2;

  roundRect(ctx, pillX, yPos, pillW, pillH, 22);
  const pillGrad = ctx.createLinearGradient(pillX, yPos, pillX + pillW, yPos + pillH);
  pillGrad.addColorStop(0, '#0052cc');
  pillGrad.addColorStop(0.5, '#0077ff');
  pillGrad.addColorStop(1, '#0052cc');
  ctx.fillStyle = pillGrad;
  ctx.fill();

  // Pill border glow
  roundRect(ctx, pillX, yPos, pillW, pillH, 22);
  ctx.strokeStyle = 'rgba(0, 200, 255, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Pill inner highlight
  ctx.save();
  roundRect(ctx, pillX, yPos, pillW, pillH, 22);
  ctx.clip();
  const pillHighlight = ctx.createLinearGradient(pillX, yPos, pillX + pillW, yPos);
  pillHighlight.addColorStop(0, 'rgba(255,255,255,0)');
  pillHighlight.addColorStop(0.5, 'rgba(255,255,255,0.1)');
  pillHighlight.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = pillHighlight;
  ctx.fillRect(pillX, yPos, pillW, pillH / 2);
  ctx.restore();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('⚡  NOTA ORDER', width / 2, yPos + 26);

  yPos += pillH + 24;

  // ═══════════════════════════════════════════════════════════
  // CARD 1: Transaction Status & IDs
  // ═══════════════════════════════════════════════════════════
  const card1H = 130;
  drawGlassCard(ctx, pad, yPos, cardW, card1H);

  // Card title bar
  ctx.fillStyle = 'rgba(0, 180, 255, 0.08)';
  ctx.save();
  roundRect(ctx, pad, yPos, cardW, 30, 14);
  ctx.clip();
  ctx.fillRect(pad, yPos, cardW, 30);
  ctx.restore();

  ctx.fillStyle = '#5ca8ff';
  ctx.font = 'bold 11px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('DETAIL TRANSAKSI', pad + 18, yPos + 20);

  const statusStr = (orderData.status === 'success' || orderData.status === 'paid')
    ? '✅  SUCCESS' : (orderData.status?.toUpperCase() || '✅  SUCCESS');

  const txRows = [
    ['Status', statusStr, true],
    ['Kode Transaksi', orderData.transactionCode || orderData.orderId || '-', false],
    ['Kode Invoice', orderData.invoiceCode || `INV-${orderData.orderId}`, false],
    ['Order ID', orderData.orderId || '-', false],
  ];

  let txY = yPos + 46;
  txRows.forEach(([label, val, isStatus]) => {
    ctx.fillStyle = '#7a9ec7';
    ctx.font = '13px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, pad + 18, txY);

    ctx.fillStyle = '#3e6a9e';
    ctx.fillText(':', pad + 155, txY);

    ctx.fillStyle = isStatus ? '#00e676' : '#e8f0ff';
    ctx.font = isStatus ? 'bold 14px Arial, sans-serif' : 'bold 13px Arial, sans-serif';
    ctx.fillText(val, pad + 168, txY);
    txY += 22;
  });

  yPos += card1H + 16;

  // ═══════════════════════════════════════════════════════════
  // CARD 2: Product & Customer Details
  // ═══════════════════════════════════════════════════════════
  const card2H = 240;
  drawGlassCard(ctx, pad, yPos, cardW, card2H);

  // Card title bar
  ctx.fillStyle = 'rgba(0, 180, 255, 0.08)';
  ctx.save();
  roundRect(ctx, pad, yPos, cardW, 30, 14);
  ctx.clip();
  ctx.fillRect(pad, yPos, cardW, 30);
  ctx.restore();

  ctx.fillStyle = '#5ca8ff';
  ctx.font = 'bold 11px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('DETAIL PRODUK', pad + 18, yPos + 20);

  // ── Left Side: Product Logo ──
  const logoX = pad + 18;
  const logoY = yPos + 45;
  const logoSize = 110;

  // Logo container with glow
  roundRect(ctx, logoX, logoY, logoSize, logoSize, 14);
  ctx.fillStyle = 'rgba(0, 50, 120, 0.3)';
  ctx.fill();
  roundRect(ctx, logoX, logoY, logoSize, logoSize, 14);
  ctx.strokeStyle = 'rgba(0, 150, 255, 0.25)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Try to load product image
  const prodImgUrl = orderData.apkLogoUrl || orderData.imageUrl;
  let loadedImg = false;
  if (prodImgUrl) {
    try {
      const prodImg = await loadImage(prodImgUrl);
      ctx.save();
      roundRect(ctx, logoX + 3, logoY + 3, logoSize - 6, logoSize - 6, 12);
      ctx.clip();
      ctx.drawImage(prodImg, logoX + 3, logoY + 3, logoSize - 6, logoSize - 6);
      ctx.restore();
      loadedImg = true;
    } catch {}
  }

  if (!loadedImg) {
    // Premium gradient letter avatar
    const letter = (orderData.apkName || orderData.productName || 'P').charAt(0).toUpperCase();
    const cx = logoX + logoSize / 2;
    const cy = logoY + logoSize / 2;
    const r = 40;

    const lGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    lGrad.addColorStop(0, '#0055dd');
    lGrad.addColorStop(1, '#00bbff');
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = lGrad;
    ctx.fill();

    // Glow ring
    ctx.beginPath();
    ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 200, 255, 0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, cx, cy + 1);
    ctx.textBaseline = 'alphabetic';
  }

  // APK Name Badge under logo
  const apkName = (orderData.apkName || orderData.productName || 'PRODUK').toUpperCase();
  const badgeY = logoY + logoSize + 12;
  roundRect(ctx, logoX, badgeY, logoSize, 30, 8);
  const badgeGrad = ctx.createLinearGradient(logoX, badgeY, logoX + logoSize, badgeY);
  badgeGrad.addColorStop(0, '#0a2550');
  badgeGrad.addColorStop(1, '#122e5a');
  ctx.fillStyle = badgeGrad;
  ctx.fill();
  roundRect(ctx, logoX, badgeY, logoSize, 30, 8);
  ctx.strokeStyle = 'rgba(0, 150, 255, 0.2)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#8cc8ff';
  ctx.font = 'bold 12px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(apkName.length > 14 ? apkName.substring(0, 14) + '..' : apkName, logoX + logoSize / 2, badgeY + 20);

  // ── Right Side: Detail Rows ──
  const detailX = logoX + logoSize + 22;
  const prodRows = [
    ['Nama User', orderData.customerName || 'User'],
    ['Produk', orderData.productName || '-'],
    ['Keterangan', orderData.variantLabel || '-'],
    ['Durasi', orderData.duration || orderData.variantLabel || '-'],
    ['Qty', String(orderData.quantity || 1)],
    ['Harga Satuan', formatCurrency(orderData.unitPrice || orderData.totalPrice)],
    ['Subtotal', formatCurrency(orderData.totalPrice)],
  ];

  let pdY = yPos + 50;
  ctx.textAlign = 'left';
  prodRows.forEach(([label, val], i) => {
    const isLast = i === prodRows.length - 1;
    ctx.fillStyle = '#7a9ec7';
    ctx.font = '12px Arial, sans-serif';
    ctx.fillText(label, detailX, pdY);

    ctx.fillStyle = '#3e6a9e';
    ctx.fillText(':', detailX + 100, pdY);

    ctx.fillStyle = isLast ? '#00e0ff' : '#e8f0ff';
    ctx.font = isLast ? 'bold 13px Arial, sans-serif' : 'bold 12px Arial, sans-serif';
    ctx.fillText(val, detailX + 112, pdY);
    pdY += 26;
  });

  yPos += card2H + 16;

  // ═══════════════════════════════════════════════════════════
  // CARD 3: Date, Time & Payment
  // ═══════════════════════════════════════════════════════════
  const card3H = 110;
  drawGlassCard(ctx, pad, yPos, cardW, card3H);

  // Card title bar
  ctx.fillStyle = 'rgba(0, 180, 255, 0.08)';
  ctx.save();
  roundRect(ctx, pad, yPos, cardW, 30, 14);
  ctx.clip();
  ctx.fillRect(pad, yPos, cardW, 30);
  ctx.restore();

  ctx.fillStyle = '#5ca8ff';
  ctx.font = 'bold 11px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('WAKTU & PEMBAYARAN', pad + 18, yPos + 20);

  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' });
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) + ' WIB';
  const payMethod = orderData.paymentMethod === 'saldo' ? 'Saldo' : 'QRIS';

  const timeRows = [
    ['Tanggal', dateStr],
    ['Waktu', timeStr],
    ['Pembayaran', payMethod],
  ];

  let ftY = yPos + 48;
  timeRows.forEach(([label, val]) => {
    ctx.fillStyle = '#7a9ec7';
    ctx.font = '13px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, pad + 18, ftY);
    ctx.fillStyle = '#3e6a9e';
    ctx.fillText(':', pad + 155, ftY);
    ctx.fillStyle = '#e8f0ff';
    ctx.font = 'bold 13px Arial, sans-serif';
    ctx.fillText(val, pad + 168, ftY);
    ftY += 22;
  });

  yPos += card3H + 16;

  // ═══════════════════════════════════════════════════════════
  // TOTAL BAYAR BANNER
  // ═══════════════════════════════════════════════════════════
  const bannerH = 65;

  // Outer glow
  ctx.shadowColor = 'rgba(0, 100, 255, 0.25)';
  ctx.shadowBlur = 20;
  roundRect(ctx, pad, yPos, cardW, bannerH, 14);
  const bannerGrad = ctx.createLinearGradient(pad, yPos, pad + cardW, yPos + bannerH);
  bannerGrad.addColorStop(0, '#003399');
  bannerGrad.addColorStop(0.5, '#0055cc');
  bannerGrad.addColorStop(1, '#003399');
  ctx.fillStyle = bannerGrad;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // Banner border
  roundRect(ctx, pad, yPos, cardW, bannerH, 14);
  ctx.strokeStyle = 'rgba(0, 200, 255, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Inner shimmer highlight
  ctx.save();
  roundRect(ctx, pad, yPos, cardW, bannerH, 14);
  ctx.clip();
  const shimmer = ctx.createLinearGradient(pad, yPos, pad + cardW, yPos);
  shimmer.addColorStop(0, 'rgba(255,255,255,0)');
  shimmer.addColorStop(0.4, 'rgba(255,255,255,0.04)');
  shimmer.addColorStop(0.6, 'rgba(255,255,255,0.04)');
  shimmer.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = shimmer;
  ctx.fillRect(pad, yPos, cardW, bannerH / 2);
  ctx.restore();

  // ⚡ icon + TOTAL BAYAR
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('💰  TOTAL BAYAR', pad + 22, yPos + 40);

  // Price value with glow effect
  const priceStr = formatCurrency(orderData.totalPrice);
  ctx.fillStyle = '#00e8ff';
  ctx.font = 'bold 28px Arial, sans-serif';
  ctx.textAlign = 'right';
  // Text shadow/glow
  ctx.shadowColor = 'rgba(0, 220, 255, 0.4)';
  ctx.shadowBlur = 10;
  ctx.fillText(priceStr, pad + cardW - 22, yPos + 43);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  yPos += bannerH + 18;

  // ═══════════════════════════════════════════════════════════
  // CATATAN / WARRANTY NOTES
  // ═══════════════════════════════════════════════════════════
  const noteH = 80;
  roundRect(ctx, pad, yPos, cardW, noteH, 10);
  ctx.fillStyle = 'rgba(10, 22, 45, 0.6)';
  ctx.fill();
  roundRect(ctx, pad, yPos, cardW, noteH, 10);
  ctx.strokeStyle = 'rgba(40, 80, 140, 0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#5ca8ff';
  ctx.font = 'bold 11px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('📌  CATATAN', pad + 16, yPos + 20);

  ctx.fillStyle = '#6a8db5';
  ctx.font = '11px Arial, sans-serif';
  ctx.fillText('•  Simpan nota ini untuk klaim garansi.', pad + 16, yPos + 38);
  ctx.fillText('•  No Refund.', pad + 16, yPos + 53);
  ctx.fillText('•  Hubungi admin jika ada kendala.', pad + 16, yPos + 68);

  yPos += noteH + 22;

  // ═══════════════════════════════════════════════════════════
  // FOOTER
  // ═══════════════════════════════════════════════════════════
  drawSeparator(ctx, pad + 40, yPos, cardW - 80);
  yPos += 14;

  ctx.fillStyle = '#5a7fa5';
  ctx.font = '12px Arial, sans-serif';
  ctx.textAlign = 'center';
  const footerText = storeSettings.notaFooterText || 'Terima kasih telah berbelanja di';
  ctx.fillText(footerText, width / 2, yPos);

  // Store name with glow
  ctx.fillStyle = '#00ccff';
  ctx.font = 'bold 18px Arial, sans-serif';
  ctx.shadowColor = 'rgba(0, 200, 255, 0.3)';
  ctx.shadowBlur = 8;
  ctx.fillText(storeName.toUpperCase(), width / 2, yPos + 24);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  return canvas.toBuffer('image/png');
}

/**
 * Escape HTML special characters for Telegram HTML parse mode
 */
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Send nota to testimoni channel with premium HTML caption & inline buttons
 */
async function sendTestimoniToChannel(bot, channelId, notaBuffer, orderData, storeSettings = {}) {
  try {
    const storeName = escapeHTML((storeSettings.storeName || 'AutoStore').toUpperCase());
    const now = new Date();
    const dateStr = now.toLocaleDateString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta'
    });
    const timeStr = now.toLocaleTimeString('id-ID', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta'
    }) + ' WIB';

    const productName = escapeHTML(orderData.productName);
    const variantLabel = escapeHTML(orderData.variantLabel || '-');
    const customerName = escapeHTML(orderData.customerName);
    const totalPrice = formatCurrency(orderData.totalPrice);
    const orderId = escapeHTML(orderData.orderId || '-');
    const productDescription = escapeHTML(orderData.productDescription || orderData.description || orderData.desc || '');

    // ─── Rich HTML Caption with Mixed Tag Effects ───
    const caption =
      `✅ <b><u>TRANSAKSI BERHASIL</u></b>\n\n` +

      `<blockquote>` +
        `<b>📦 Detail Order</b>\n` +
        `━━━━━━━━━━━━━━━━━\n` +
        `🛍  Produk    :  <b>${productName}</b>\n` +
        `📋  Varian     :  <i>${variantLabel}</i>\n` +
        `👤  Pembeli  :  <b>${customerName}</b>\n` +
        `💰  Total       :  <b><u>${totalPrice}</u></b>` +
      `</blockquote>\n\n` +

      (productDescription ?
      `<blockquote>` +
        `<b>📝 Deskripsi Produk</b>\n` +
        `━━━━━━━━━━━━━━━━━\n` +
        `<i>${productDescription}</i>` +
      `</blockquote>\n\n` : '') +

      `<blockquote>` +
        `<b>🕐 Waktu Transaksi</b>\n` +
        `━━━━━━━━━━━━━━━━━\n` +
        `📅  ${dateStr}\n` +
        `⏰  ${timeStr}` +
      `</blockquote>\n\n` +

      `<blockquote>` +
        `<b>🔖 Kode Order</b>\n` +
        `━━━━━━━━━━━━━━━━━\n` +
        `<code>${orderId}</code>` +
      `</blockquote>\n\n` +

      `<i>✨ Transaksi otomatis &amp; terverifikasi</i>\n` +
      `<i>⚡ Produk dikirim secara instan</i>\n\n` +

      `🏪 <b><u>${storeName}</u></b>\n` +
      `<i>Terpercaya</i> • <i>Cepat</i> • <i>Aman</i>`;

    // ─── Inline Keyboard Buttons ───
    const config = require('./config');
    const botInfo = await bot.telegram.getMe();
    const botUsername = botInfo.username;

    const buttons = [];

    // Row 1: Order button
    buttons.push([{
      text: '🛒 Order Sekarang',
      url: `https://t.me/${botUsername}?start=shop`,
    }]);

    // Row 2: Contact & Group
    const row2 = [];
    if (config.CONTACT_TELEGRAM) {
      row2.push({
        text: '💬 Hubungi Admin',
        url: `https://t.me/${config.CONTACT_TELEGRAM}`,
      });
    }
    if (config.GROUP_TELEGRAM) {
      const groupLink = config.GROUP_TELEGRAM.startsWith('http')
        ? config.GROUP_TELEGRAM
        : `https://${config.GROUP_TELEGRAM}`;
      row2.push({
        text: '👥 Gabung Grup',
        url: groupLink,
      });
    }
    if (row2.length > 0) buttons.push(row2);

    // Row 3: WhatsApp (if available)
    if (config.CONTACT_WHATSAPP) {
      buttons.push([{
        text: '📱 WhatsApp Admin',
        url: `https://wa.me/${config.CONTACT_WHATSAPP}`,
      }]);
    }

    await bot.telegram.sendPhoto(channelId, {
      source: notaBuffer,
      filename: `nota_${orderData.orderId}.png`,
    }, {
      caption,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: buttons,
      },
    });
    return true;
  } catch (err) {
    console.error('sendTestimoniToChannel error:', err.message);
    return false;
  }
}

module.exports = {
  generateNotaPNG,
  sendTestimoniToChannel,
};
