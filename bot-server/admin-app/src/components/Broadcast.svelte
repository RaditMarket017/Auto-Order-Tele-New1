<script>
  import { apiFetch } from '../lib/api.js';

  let variant = $state('RESTOCK');
  let isPng = $state(true);
  let apkLogoUrl = $state('');
  let productName = $state('CAPCUT PRO FAMHEAD');
  let duration = $state('7 HARI');
  let keterangan = $state('Bulk 10 Team');
  let stockCount = $state('2 pcs');
  let price = $state('Rp35.000');
  let bulkPrice1 = $state('Rp30.000');
  let bulkPrice2 = $state('Rp25.000');
  let freshBilling = $state('04 Agustus 2026');
  let bonusInfo = $state('Bonus Capcut Pro Indplan 30 Hari [ Hasil Give ]');
  let footerText = $state('📩 Langsung PM sekarang juga!\nBuruan order sekarang sebelum stock habis! 🚀');

  let restockImage = $state('');
  let restockImagePreview = $state('');
  let mediaUrl = $state('');
  let mediaType = $state('auto');

  let sendToChannel = $state(true);
  let sendToUsers = $state(true);

  let isSending = $state(false);
  let statusMessage = $state('');
  let errorMessage = $state('');

  // Auto handle Mode PNG state depending on Variant
  $effect(() => {
    if (variant !== 'RESTOCK') {
      isPng = false;
    }
  });

  function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      restockImage = evt.target.result;
      restockImagePreview = evt.target.result;
    };
    reader.readAsDataURL(file);
  }

  function removeRestockImage() {
    restockImage = '';
    restockImagePreview = '';
  }

  // Computed text preview
  function getPreviewText() {
    if (variant === 'RESTOCK') {
      const lines = ['♻️ RESTOCK TERSEDIA!\n'];
      if (productName) lines.push(`📦 Produk : ${productName}`);
      if (duration) lines.push(`⏳ Durasi : ${duration}`);
      if (keterangan) lines.push(`📌 Keterangan : ${keterangan}`);
      if (stockCount) lines.push(`📊 Stock: ${stockCount}`);
      if (price) lines.push(`💰 Harga : ${price}`);
      if (bulkPrice1) lines.push(`💰 Bulk 3 : ${bulkPrice1}`);
      if (bulkPrice2) lines.push(`💰 Bulk 5 : ${bulkPrice2}`);
      if (freshBilling) lines.push(`🆕 Fresh Billing : ${freshBilling}`);
      if (bonusInfo) lines.push(bonusInfo);

      const footer = footerText ? footerText : '📩 Langsung PM sekarang juga!\nBuruan order sekarang sebelum stock habis! 🚀';
      lines.push('\n' + footer);
      return lines.join('\n');
    } else if (variant === 'PERUBAHAN_HARGA') {
      return `📢 PERUBAHAN HARGA\n\n📦 Produk : ${productName || '{Nama Produk}'}\n⏳ Durasi : ${duration || '{Durasi}'}\n💰 Harga Baru : ${price || '{Harga}'}\n\n📌 Catatan:\nHarga telah diperbarui, silakan cek sebelum order.`;
    } else if (variant === 'DISKON') {
      return `🔥 PROMO SPESIAL!\n\n📦 Produk : ${productName || '{Nama Produk}'}\n⏳ Durasi : ${duration || '{Durasi}'}\n💰 Harga Promo : ${price || '{Harga}'}\n\n⚡ Promo terbatas, segera order!`;
    } else if (variant === 'INFO_PENTING') {
      return `📢 INFORMASI PENTING\n\n📦 Produk : ${productName || '{Nama Produk}'}\n\n📌 Detail:\n${keterangan || '{Keterangan}'}\n\nMohon diperhatikan sebelum transaksi.`;
    }
    return '';
  }

  async function handleSendBroadcast() {
    statusMessage = '';
    errorMessage = '';

    if (!sendToChannel && !sendToUsers) {
      errorMessage = 'Pilih minimal satu target pengiriman (Channel atau User Bot)!';
      return;
    }

    if (!productName.trim() && variant !== 'INFO_PENTING') {
      errorMessage = 'Nama Produk wajib diisi!';
      return;
    }

    if (!confirm('Apakah Anda yakin ingin mengirim pesan Broadcast ini sekarang?')) {
      return;
    }

    isSending = true;

    try {
      const res = await apiFetch('/api/admin/broadcast', {
        method: 'POST',
        body: JSON.stringify({
          variant,
          isPng,
          apkLogoUrl,
          productName,
          duration,
          keterangan,
          stockCount,
          price,
          bulkPrice1,
          bulkPrice2,
          freshBilling,
          bonusInfo,
          footerText,
          restockImage,
          mediaUrl,
          mediaType,
          sendToChannel,
          sendToUsers,
        }),
      });

      if (res.success) {
        const d = res.data;
        let details = [];
        if (sendToChannel) details.push(d.channelSent ? '📢 Sent to Channel' : '📢 Channel Failed');
        if (sendToUsers) details.push(`👤 Sent to ${d.userSentCount} Users (${d.userFailedCount} failed)`);
        
        statusMessage = `✅ Broadcast Berhasil Dikirim! [${details.join(' | ')}]`;
      } else {
        errorMessage = res.error || 'Gagal mengirim broadcast';
      }
    } catch (err) {
      errorMessage = err.message || 'Terjadi kesalahan jaringan.';
    } finally {
      isSending = false;
    }
  }
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between flex-wrap gap-3">
    <div>
      <h2 class="text-xl font-black text-white tracking-tight flex items-center gap-2">
        <span class="p-2 rounded-xl bg-gradient-to-br from-violet-600/30 to-indigo-600/30 border border-violet-500/40 text-violet-400">📢</span>
        Kirim Broadcast Pesan
      </h2>
      <p class="text-xs text-slate-400 mt-1">Buat dan kirim pengumuman restock (dengan auto watermark logo di pojok kiri atas), promo, atau info penting ke Telegram.</p>
    </div>
  </div>

  {#if statusMessage}
    <div class="p-4 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-between gap-3 shadow-lg shadow-emerald-950/40">
      <span>{statusMessage}</span>
      <button onclick={() => statusMessage = ''} class="text-emerald-400 hover:text-white font-bold cursor-pointer">✕</button>
    </div>
  {/if}

  {#if errorMessage}
    <div class="p-4 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center justify-between gap-3 shadow-lg shadow-rose-950/40">
      <span>⚠️ {errorMessage}</span>
      <button onclick={() => errorMessage = ''} class="text-rose-400 hover:text-white font-bold cursor-pointer">✕</button>
    </div>
  {/if}

  <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
    <!-- Form Inputs (Left / Main) -->
    <div class="lg:col-span-7 space-y-5 bg-slate-900/90 border border-indigo-900/30 rounded-2xl p-5 md:p-6 shadow-xl backdrop-blur-md">
      <div class="font-bold text-sm text-sky-400 flex items-center gap-2 pb-3 border-b border-slate-800">
        <span>⚙️</span> STRUKTUR INPUT BROADCAST
      </div>

      <!-- Varian Dropdown -->
      <div class="space-y-1.5">
        <label for="broadcast-variant-select" class="text-xs font-semibold text-slate-300">Varian Broadcast <span class="text-rose-400">*</span></label>
        <select
          id="broadcast-variant-select"
          bind:value={variant}
          class="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 text-white rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all outline-none"
        >
          <option value="RESTOCK">♻️ RESTOCK</option>
          <option value="PERUBAHAN_HARGA">📢 PERUBAHAN HARGA</option>
          <option value="DISKON">🔥 DISKON / PROMO</option>
          <option value="INFO_PENTING">📢 INFO PENTING</option>
        </select>
      </div>

      <!-- Upload Gambar Restock (RESTOCK Mode) -->
      {#if variant === 'RESTOCK'}
        <div class="p-4 rounded-xl bg-slate-950 border border-indigo-900/40 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              🖼️ Upload Gambar Restock / Bukti Screenshot
            </span>
            <span class="text-[10px] text-sky-400 font-semibold">✨ Auto Logo di Pojok Kiri Atas</span>
          </div>

          {#if restockImagePreview}
            <div class="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-900 group">
              <img src={restockImagePreview} alt="Restock Upload" class="w-full max-h-56 object-contain bg-slate-950" />
              <!-- Auto logo overlay preview indicator -->
              <div class="absolute top-2 left-2 p-1 bg-black/60 backdrop-blur-md rounded-full border border-sky-400/50 shadow-lg">
                <img src="/logo.png" alt="Logo" class="w-8 h-8 rounded-full" />
              </div>
              <button
                type="button"
                onclick={removeRestockImage}
                class="absolute bottom-2 right-2 px-3 py-1.5 bg-rose-600/90 hover:bg-rose-600 text-white text-xs font-bold rounded-lg shadow-lg transition-all"
              >
                🗑️ Hapus Gambar
              </button>
            </div>
          {:else}
            <label class="flex flex-col items-center justify-center p-5 rounded-xl border-2 border-dashed border-slate-800 hover:border-sky-500/60 bg-slate-900/50 cursor-pointer transition-all">
              <span class="text-2xl mb-1">📸</span>
              <span class="text-xs font-bold text-slate-300">Pilih / Upload Gambar Restock</span>
              <span class="text-[11px] text-slate-500 mt-0.5">Format JPG, PNG, WEBP — Logo Toko otomatis terpasang di kiri atas</span>
              <input type="file" accept="image/*" onchange={handleImageUpload} class="hidden" />
            </label>
          {/if}

          <!-- Media URL fallback option -->
          <div class="space-y-1 pt-1">
            <span class="text-[11px] text-slate-400">Atau masukkan Link URL Gambar Restock:</span>
            <input
              type="url"
              bind:value={mediaUrl}
              placeholder="https://example.com/screenshot.jpg"
              class="w-full bg-slate-900 border border-slate-800 focus:border-sky-500 text-white rounded-xl px-3 py-2 text-xs font-mono transition-all outline-none"
            />
          </div>
        </div>
      {/if}

      <!-- Form Inputs Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Nama Produk -->
        <div class="space-y-1.5">
          <label for="broadcast-product-name" class="text-xs font-semibold text-slate-300">Nama Produk</label>
          <input
            id="broadcast-product-name"
            type="text"
            bind:value={productName}
            placeholder="Contoh: CAPCUT PRO FAMHEAD"
            class="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 text-white rounded-xl px-3.5 py-2.5 text-xs transition-all outline-none"
          />
        </div>

        <!-- Durasi -->
        {#if variant !== 'INFO_PENTING'}
          <div class="space-y-1.5">
            <label for="broadcast-duration" class="text-xs font-semibold text-slate-300">Durasi</label>
            <input
              id="broadcast-duration"
              type="text"
              bind:value={duration}
              placeholder="Contoh: 7 HARI"
              class="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 text-white rounded-xl px-3.5 py-2.5 text-xs transition-all outline-none"
            />
          </div>
        {/if}

        <!-- Stok Count (Restock) -->
        {#if variant === 'RESTOCK'}
          <div class="space-y-1.5">
            <label for="broadcast-stock" class="text-xs font-semibold text-slate-300">Jumlah Stok</label>
            <input
              id="broadcast-stock"
              type="text"
              bind:value={stockCount}
              placeholder="Contoh: 2 pcs"
              class="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 text-white rounded-xl px-3.5 py-2.5 text-xs transition-all outline-none"
            />
          </div>
        {/if}

        <!-- Harga -->
        {#if variant !== 'INFO_PENTING'}
          <div class="space-y-1.5">
            <label for="broadcast-price" class="text-xs font-semibold text-slate-300">
              {variant === 'PERUBAHAN_HARGA' ? 'Harga Baru' : variant === 'DISKON' ? 'Harga Promo' : 'Harga Ecer'}
            </label>
            <input
              id="broadcast-price"
              type="text"
              bind:value={price}
              placeholder="Contoh: Rp35.000"
              class="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 text-white rounded-xl px-3.5 py-2.5 text-xs transition-all outline-none"
            />
          </div>
        {/if}

        <!-- Harga Bulk 3 (Restock) -->
        {#if variant === 'RESTOCK'}
          <div class="space-y-1.5">
            <label for="broadcast-bulk1" class="text-xs font-semibold text-slate-300">Harga Bulk 3 <span class="text-slate-500 font-normal">(opsional)</span></label>
            <input
              id="broadcast-bulk1"
              type="text"
              bind:value={bulkPrice1}
              placeholder="Contoh: Rp30.000"
              class="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 text-white rounded-xl px-3.5 py-2.5 text-xs transition-all outline-none"
            />
          </div>

          <!-- Harga Bulk 5 (Restock) -->
          <div class="space-y-1.5">
            <label for="broadcast-bulk2" class="text-xs font-semibold text-slate-300">Harga Bulk 5 <span class="text-slate-500 font-normal">(opsional)</span></label>
            <input
              id="broadcast-bulk2"
              type="text"
              bind:value={bulkPrice2}
              placeholder="Contoh: Rp25.000"
              class="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 text-white rounded-xl px-3.5 py-2.5 text-xs transition-all outline-none"
            />
          </div>
        {/if}

        <!-- Fresh Billing -->
        {#if variant === 'RESTOCK'}
          <div class="space-y-1.5">
            <label for="broadcast-fresh-billing" class="text-xs font-semibold text-slate-300">Fresh Billing (Tanggal)</label>
            <input
              id="broadcast-fresh-billing"
              type="text"
              bind:value={freshBilling}
              placeholder="Contoh: 04 Agustus 2026"
              class="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 text-white rounded-xl px-3.5 py-2.5 text-xs transition-all outline-none"
            />
          </div>
        {/if}
      </div>

      <!-- Keterangan -->
      <div class="space-y-1.5">
        <label for="broadcast-keterangan" class="text-xs font-semibold text-slate-300">Keterangan / Detail</label>
        <textarea
          id="broadcast-keterangan"
          bind:value={keterangan}
          rows="2"
          placeholder="Contoh: Bulk 10 Team..."
          class="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 text-white rounded-xl p-3 text-xs transition-all outline-none"
        ></textarea>
      </div>

      <!-- Bonus Info (Restock) -->
      {#if variant === 'RESTOCK'}
        <div class="space-y-1.5">
          <label for="broadcast-bonus" class="text-xs font-semibold text-slate-300">Bonus / Catatan Tambahan <span class="text-slate-500 font-normal">(opsional)</span></label>
          <input
            id="broadcast-bonus"
            type="text"
            bind:value={bonusInfo}
            placeholder="Contoh: Bonus Capcut Pro Indplan 30 Hari [ Hasil Give ]"
            class="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 text-white rounded-xl px-3.5 py-2.5 text-xs transition-all outline-none"
          />
        </div>
      {/if}

      <!-- Footer Callout Text -->
      <div class="space-y-1.5">
        <label for="broadcast-footer" class="text-xs font-semibold text-slate-300">Pesan Footer Callout</label>
        <textarea
          id="broadcast-footer"
          bind:value={footerText}
          rows="2"
          placeholder="Contoh: 📩 Langsung PM sekarang juga! Buruan order sebelum habis!"
          class="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 text-white rounded-xl p-3 text-xs transition-all outline-none"
        ></textarea>
      </div>

      <!-- Target Pengiriman Section -->
      <div class="pt-3 border-t border-slate-800 space-y-3">
        <div class="font-bold text-xs text-slate-300 flex items-center gap-1.5">
          <span>📡</span> TARGET PENGIRIMAN BROADCAST
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <!-- Toggle Channel -->
          <button
            type="button"
            onclick={() => sendToChannel = !sendToChannel}
            class="flex items-center justify-between p-3.5 rounded-xl border font-bold text-xs transition-all cursor-pointer {sendToChannel ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg shadow-emerald-600/30' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'}"
          >
            <span class="flex items-center gap-2">
              <span>📢</span> Kirim ke Channel
            </span>
            <span class="w-3 h-3 rounded-full {sendToChannel ? 'bg-emerald-300 animate-pulse' : 'bg-slate-700'}"></span>
          </button>

          <!-- Toggle User Bot -->
          <button
            type="button"
            onclick={() => sendToUsers = !sendToUsers}
            class="flex items-center justify-between p-3.5 rounded-xl border font-bold text-xs transition-all cursor-pointer {sendToUsers ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg shadow-emerald-600/30' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'}"
          >
            <span class="flex items-center gap-2">
              <span>👤</span> Kirim ke User Bot
            </span>
            <span class="w-3 h-3 rounded-full {sendToUsers ? 'bg-emerald-300 animate-pulse' : 'bg-slate-700'}"></span>
          </button>
        </div>
      </div>

      <!-- Action Submit Button -->
      <div class="pt-2">
        <button
          onclick={handleSendBroadcast}
          disabled={isSending}
          class="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-extrabold text-sm rounded-xl shadow-xl shadow-emerald-600/25 border border-emerald-400/30 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          {#if isSending}
            <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Mengirim Broadcast...
          {:else}
            🚀 KIRIM BROADCAST
          {/if}
        </button>
      </div>
    </div>

    <!-- Live Preview (Right Column) -->
    <div class="lg:col-span-5 space-y-4">
      <div class="bg-slate-900/90 border border-indigo-900/30 rounded-2xl p-5 shadow-xl backdrop-blur-md sticky top-6">
        <div class="font-bold text-xs text-sky-400 flex items-center gap-2 pb-3 border-b border-slate-800">
          <span>📑</span> LIVE PREVIEW BROADCAST
        </div>

        {#if variant === 'RESTOCK'}
          {#if restockImagePreview}
            <div class="my-4 relative rounded-xl overflow-hidden border border-slate-700 bg-slate-950 shadow-md">
              <img src={restockImagePreview} alt="Live Restock Preview" class="w-full max-h-64 object-cover" />
              <div class="absolute top-2 left-2 p-1 bg-black/60 backdrop-blur-md rounded-full border border-sky-400/50 shadow-lg">
                <img src="/logo.png" alt="Logo Watermark" class="w-9 h-9 rounded-full" />
              </div>
              <div class="absolute bottom-2 left-2 px-2.5 py-1 bg-slate-900/90 text-sky-400 font-bold text-[10px] rounded-md border border-slate-700">
                ✨ Auto Logo Top-Left Corner
              </div>
            </div>
          {:else}
            <div class="my-4 p-3 rounded-xl bg-slate-950 border border-sky-500/30 text-center space-y-2">
              <span class="text-xs font-bold text-sky-400 flex items-center justify-center gap-1">
                🖼️ Restock Gambar Custom + Watermark Logo
              </span>
              <p class="text-[11px] text-slate-400">
                Gambar yang diupload akan otomatis dipasangi <b>Logo Toko di Pojok Kiri Atas</b>.
              </p>
            </div>
          {/if}
        {/if}

        <div class="bg-[#0b141d] p-4 rounded-xl border border-slate-800 text-slate-200 font-mono text-xs whitespace-pre-wrap leading-relaxed shadow-inner">
          {getPreviewText()}
        </div>

        <div class="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1">
          <div class="flex justify-between">
            <span>Target Channel:</span>
            <span class="font-bold {sendToChannel ? 'text-emerald-400' : 'text-slate-500'}">{sendToChannel ? '✅ ON' : '❌ OFF'}</span>
          </div>
          <div class="flex justify-between">
            <span>Target Users:</span>
            <span class="font-bold {sendToUsers ? 'text-emerald-400' : 'text-slate-500'}">{sendToUsers ? '✅ ON' : '❌ OFF'}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
