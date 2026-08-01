<script>
  import { apiFetch } from '../lib/api.js';

  let variant = $state('RESTOCK');
  let isPng = $state(true);
  let apkLogoUrl = $state('');
  let productName = $state('');
  let duration = $state('');
  let keterangan = $state('');
  let price = $state('');
  let freshBilling = $state('');

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

  // Computed text preview
  function getPreviewText() {
    if (variant === 'RESTOCK') {
      if (isPng) {
        return `♻️ RESTOCK TERSEDIA!\n\n📦 Produk : ${productName || '{Nama Produk}'}\n⏳ Durasi : ${duration || '{Durasi}'}\n📌 Keterangan : ${keterangan || '{Keterangan}'}\n💰 Harga : ${price || '{Harga}'}\n🆕 Fresh Billing : ${freshBilling || '{Tanggal}'}`;
      } else {
        const linkStr = apkLogoUrl.trim() ? `\n🔗 Link Ikon Aplikasi: ${apkLogoUrl.trim()}\n` : '\n';
        return `♻️ RESTOCK TERSEDIA!\n${linkStr}\n📦 Produk : ${productName || '{Nama Produk}'}\n⏳ Durasi : ${duration || '{Durasi}'}\n📌 Keterangan : ${keterangan || '{Keterangan}'}\n💰 Harga : ${price || '{Harga}'}\n🆕 Fresh Billing : ${freshBilling || '{Tanggal}'}`;
      }
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
          price,
          freshBilling,
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
      <p class="text-xs text-slate-400 mt-1">Buat dan kirim pengumuman restock, promo, atau info penting ke Telegram.</p>
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

      <!-- Mode Tampilan Toggle (Only RESTOCK) -->
      {#if variant === 'RESTOCK'}
        <div class="p-4 rounded-xl bg-slate-950 border border-indigo-900/40 space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              🖼️ Mode PNG (Gambar Neon Template)
            </span>
            <div class="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onclick={() => isPng = true}
                class="px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer {isPng ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30' : 'text-slate-400 hover:text-white'}"
              >
                ◉ ON (PNG)
              </button>
              <button
                type="button"
                onclick={() => isPng = false}
                class="px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer {!isPng ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}"
              >
                OFF (TEXT)
              </button>
            </div>
          </div>
          <p class="text-[11px] text-slate-400 italic">
            {#if isPng}
              📌 Gambar kartu neon futuristik (restock.jpg) akan di-generate otomatis dengan ikon & detail produk!
            {:else}
              📌 Broadcast dikirim dalam bentuk Teks biasa.
            {/if}
          </p>
        </div>
      {/if}

      <!-- Link Ikon APK (RESTOCK + PNG ON / RESTOCK TEXT) -->
      {#if variant === 'RESTOCK'}
        <div class="space-y-1.5">
          <label for="broadcast-apk-logo-url" class="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span>Link Ikon APK <span class="text-slate-400 font-normal">(opsional)</span></span>
            {#if isPng}
              <span class="text-[10px] text-sky-400 font-medium">Digunakan pada Mode PNG</span>
            {/if}
          </label>
          <input
            id="broadcast-apk-logo-url"
            type="url"
            bind:value={apkLogoUrl}
            placeholder="https://example.com/logo.png"
            class="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 text-white rounded-xl px-3.5 py-2.5 text-xs font-mono transition-all outline-none"
          />
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
            placeholder="Contoh: NETFLIX PREMIUM 4K"
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
              placeholder="Contoh: 1 BULAN"
              class="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 text-white rounded-xl px-3.5 py-2.5 text-xs transition-all outline-none"
            />
          </div>
        {/if}

        <!-- Harga -->
        {#if variant !== 'INFO_PENTING'}
          <div class="space-y-1.5">
            <label for="broadcast-price" class="text-xs font-semibold text-slate-300">
              {variant === 'PERUBAHAN_HARGA' ? 'Harga Baru' : variant === 'DISKON' ? 'Harga Promo' : 'Harga'}
            </label>
            <input
              id="broadcast-price"
              type="text"
              bind:value={price}
              placeholder="Contoh: Rp 35.000"
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
              placeholder="Contoh: 01 AGUSTUS 2026"
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
          rows="3"
          placeholder="Tulis keterangan atau detail pengumuman di sini..."
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

        {#if variant === 'RESTOCK' && isPng}
          <div class="my-4 p-3 rounded-xl bg-slate-950 border border-sky-500/30 text-center space-y-2">
            <span class="text-xs font-bold text-sky-400 flex items-center justify-center gap-1">
              🖼️ Restock Card PNG Mode
            </span>
            <p class="text-[11px] text-slate-400">
              Pesan akan dikirim sebagai <b>Gambar Kartu PNG Cyber Neon</b> dengan caption teks di bawah:
            </p>
          </div>
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
