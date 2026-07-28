<script>
  import { escapeHTML } from '../../lib/utils.js';
  import { apiFetch } from '../../lib/api.js';

  let { visible = $bindable(false), editingProduct = null, onRefresh = () => {} } = $props();

  let name = $state('');
  let imageUrl = $state('');
  let description = $state('');
  let requiresEmail = $state(false);
  let variants = $state([{ label: '1 Bulan', price: 45000, stock: 10, warrantyDays: 0, renewEnabled: false, maxRenew: 1, renewDelayDays: 0, notes: '' }]);
  let wholesaleTiers = $state([]);

  let activeModalTab = $state('info');

  let stockItems = $state([]);
  let selectedVariantForStock = $state('Default');
  let stockInputText = $state('');
  let stockExpiry = $state('');

  let saveStatusText = $state('');

  $effect(() => {
    activeModalTab = 'info';
    if (editingProduct) {
      name = editingProduct.name || '';
      imageUrl = editingProduct.imageUrl || editingProduct.apkLogoUrl || '';
      description = editingProduct.description || '';
      requiresEmail = Boolean(editingProduct.requiresEmail);
      variants = editingProduct.variants?.length ? JSON.parse(JSON.stringify(editingProduct.variants)) : [{ label: '1 Bulan', price: 45000, stock: 10, warrantyDays: 0, renewEnabled: false, maxRenew: 1, renewDelayDays: 0, notes: '' }];
      wholesaleTiers = editingProduct.wholesaleTiers?.length ? JSON.parse(JSON.stringify(editingProduct.wholesaleTiers)) : [];
      saveStatusText = requiresEmail ? '✅ Aktif' : '❌ Off';
      loadStockItems();
    } else {
      name = '';
      imageUrl = '';
      description = '';
      requiresEmail = false;
      variants = [{ label: '1 Bulan', price: 45000, stock: 10, warrantyDays: 0, renewEnabled: false, maxRenew: 1, renewDelayDays: 0, notes: '' }];
      wholesaleTiers = [];
      saveStatusText = '❌ Off';
      stockItems = [];
    }
  });

  async function loadStockItems() {
    if (!editingProduct?.id) return;
    try {
      const res = await apiFetch(`/api/admin/stock/${editingProduct.id}`);
      if (res && res.success) {
        stockItems = res.data || [];
      }
    } catch {
      stockItems = [];
    }
  }

  function addVariant(label = '', price = 0, stock = 10, warrantyDays = 0, renewEnabled = false, maxRenew = 1, renewDelayDays = 0, notes = '') {
    variants = [...variants, { label, price, stock, warrantyDays, renewEnabled, maxRenew, renewDelayDays, notes }];
  }

  function removeVariant(idx) {
    variants = variants.filter((_, i) => i !== idx);
  }

  function addWholesale(minQty = 5, price = 0) {
    wholesaleTiers = [...wholesaleTiers, { minQty, price }];
  }

  function removeWholesale(idx) {
    wholesaleTiers = wholesaleTiers.filter((_, i) => i !== idx);
  }

  async function handleEmailToggle(e) {
    requiresEmail = e.target.checked;
    saveStatusText = '⚡ Saving...';
    if (editingProduct?.id) {
      await apiFetch(`/api/admin/products/${editingProduct.id}`, {
        method: 'PUT',
        body: JSON.stringify({ requiresEmail })
      });
      onRefresh();
    }
    saveStatusText = requiresEmail ? '✅ Aktif (Auto-saved)' : '❌ Off (Auto-saved)';
  }

  async function handleSaveProduct() {
    if (!name.trim()) return alert('Nama produk tidak boleh kosong!');
    if (variants.length === 0) variants = [{ label: 'Default', price: 0, stock: 0 }];

    const basePrice = variants[0]?.price || 0;
    const endpoint = editingProduct?.id ? `/api/admin/products/${editingProduct.id}` : '/api/admin/products';
    const method = editingProduct?.id ? 'PUT' : 'POST';

    const res = await apiFetch(endpoint, {
      method,
      body: JSON.stringify({
        name: name.trim(),
        basePrice,
        imageUrl: imageUrl.trim(),
        apkLogoUrl: imageUrl.trim(),
        description: description.trim(),
        requiresEmail,
        deliveryType: 'instant',
        variants,
        wholesaleTiers
      })
    });

    if (res && res.success) {
      visible = false;
      onRefresh();
    } else {
      alert('Gagal menyimpan produk: ' + (res?.error || 'Terjadi kesalahan server'));
    }
  }

  async function handleAddStock() {
    if (!editingProduct?.id) return alert('Simpan produk terlebih dahulu!');
    if (!stockInputText.trim()) return alert('Teks stok akun tidak boleh kosong!');

    const res = await apiFetch(`/api/admin/stock/${editingProduct.id}`, {
      method: 'POST',
      body: JSON.stringify({ itemsText: stockInputText, variantLabel: selectedVariantForStock, expiredAt: stockExpiry })
    });

    if (res && res.success) {
      alert(`Berhasil menambahkan ${res.addedCount} stok akun baru! Total stok: ${res.currentStock} pcs`);
      stockInputText = '';
      loadStockItems();
      onRefresh();
    } else {
      alert('Gagal tambah stok: ' + (res?.error || 'Error'));
    }
  }

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { stockInputText = ev.target.result; };
    reader.readAsText(file);
  }

  async function deleteStockItem(itemId) {
    if (!confirm('Hapus item akun stok ini?')) return;
    const res = await apiFetch(`/api/admin/stock/item/${itemId}`, { method: 'DELETE' });
    if (res && res.success) {
      loadStockItems();
      onRefresh();
    }
  }

  async function clearStock() {
    if (!editingProduct?.id) return;
    if (!confirm('Hapus SEMUA stok yang belum terpakai untuk produk ini?')) return;
    const res = await apiFetch(`/api/admin/stock/clear/${editingProduct.id}`, { method: 'DELETE' });
    if (res && res.success) {
      alert(`✅ ${res.deletedCount || 0} stok berhasil dibersihkan.`);
      loadStockItems();
      onRefresh();
    }
  }

  async function cleanExpiredStock() {
    if (!editingProduct?.id) return;
    const res = await apiFetch(`/api/admin/stock/clean-expired`, {
      method: 'POST',
      body: JSON.stringify({ productId: editingProduct.id })
    });
    if (res && res.success) {
      alert(`🧹 ${res.cleanedCount || 0} stok kadaluarsa telah dibersihkan.`);
      loadStockItems();
      onRefresh();
    }
  }
</script>

{#if visible}
  <div class="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto no-scrollbar" role="dialog">
    <div class="w-full max-w-xl bg-slate-900 border border-slate-800/90 rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl my-auto max-h-[90vh] flex flex-col no-scrollbar" onclick={(e) => e.stopPropagation()}>
      
      <!-- Header -->
      <div class="flex items-center justify-between pb-3.5 border-b border-slate-800/80 shrink-0">
        <div class="flex items-center gap-3.5">
          <div class="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500/20 to-indigo-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400 shrink-0 shadow-lg">
            <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
          </div>
          <div>
            <h3 class="font-extrabold text-base sm:text-lg text-white tracking-tight leading-snug">{editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}</h3>
            <p class="text-[11px] text-slate-400 font-medium">Kelola informasi produk, varian harga, dan stok pool.</p>
          </div>
        </div>
        <button onclick={() => visible = false} class="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 font-bold text-xs flex items-center justify-center cursor-pointer">✕</button>
      </div>

      <!-- Sub-Tab Header Bar -->
      <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 border-b border-slate-800/80 shrink-0">
        <button
          type="button"
          onclick={() => activeModalTab = 'info'}
          class="px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 {activeModalTab === 'info' ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20' : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'}"
        >
          📌 Informasi
        </button>

        <button
          type="button"
          onclick={() => activeModalTab = 'variants'}
          class="px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 {activeModalTab === 'variants' ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20' : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'}"
        >
          🎁 Varian ({variants.length})
        </button>

        <button
          type="button"
          onclick={() => activeModalTab = 'guarantee'}
          class="px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 {activeModalTab === 'guarantee' ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20' : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'}"
        >
          🛡️ Garansi & Renew
        </button>

        <button
          type="button"
          onclick={() => activeModalTab = 'notes'}
          class="px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 {activeModalTab === 'notes' ? 'bg-violet-500 text-white shadow-md shadow-violet-500/20' : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'}"
        >
          💬 Pesan Varian
        </button>

        <button
          type="button"
          onclick={() => activeModalTab = 'wholesale'}
          class="px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 {activeModalTab === 'wholesale' ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20' : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'}"
        >
          🏷️ Grosir
        </button>

        {#if editingProduct?.id && !requiresEmail}
          <button
            type="button"
            onclick={() => activeModalTab = 'stock'}
            class="px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 {activeModalTab === 'stock' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'}"
          >
            📥 Stok Pool ({stockItems.length})
          </button>
        {/if}
      </div>

      <div class="space-y-3.5 flex-1 overflow-y-auto pr-1 no-scrollbar py-1">
        <!-- Tab 1: Informasi Utama -->
        {#if activeModalTab === 'info'}
          <div class="bg-gradient-to-b from-slate-950/80 to-slate-950/40 border border-slate-800/90 rounded-2xl p-4 space-y-3.5 shadow-sm">
            <span class="text-[11px] font-extrabold text-sky-400 uppercase tracking-wider block">📌 Informasi Utama Produk</span>
            
            <div>
              <label class="text-[11px] font-extrabold text-slate-400 block mb-1">Nama Produk <span class="text-rose-400">*</span></label>
              <input type="text" bind:value={name} placeholder="ex: Youtube Premium" class="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:border-sky-500 focus:outline-none font-bold">
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="text-[11px] font-extrabold text-slate-400 block mb-1">URL Logo Produk</label>
                <input type="text" bind:value={imageUrl} placeholder="https://..." class="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:border-sky-500 focus:outline-none">
              </div>
              <div>
                <label class="text-[11px] font-extrabold text-slate-400 block mb-1">Deskripsi Singkat</label>
                <input type="text" bind:value={description} placeholder="Fitur/garansi produk..." class="w-full bg-slate-900/90 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:border-sky-500 focus:outline-none">
              </div>
            </div>

            <div class="flex items-center justify-between bg-slate-900/80 border border-slate-800/90 rounded-2xl p-3.5">
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold text-white">📧 Butuh Email Customer?</span>
                  <span class="text-[10px] font-bold {requiresEmail ? 'text-emerald-400' : 'text-slate-500'}">{saveStatusText}</span>
                </div>
                <span class="text-[10px] text-slate-400 block mt-0.5">Tampilkan tombol 'Kirim Email' setelah pembayaran sukses</span>
              </div>
              <label class="relative inline-flex items-center cursor-pointer shrink-0 ml-2">
                <input type="checkbox" checked={requiresEmail} onchange={handleEmailToggle} class="sr-only peer">
                <div class="w-10 h-5.5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-sky-500"></div>
              </label>
            </div>
          </div>
        {/if}

        <!-- Tab 2: Varian & Harga Produk -->
        {#if activeModalTab === 'variants'}
          <div class="bg-gradient-to-b from-slate-950/80 to-slate-950/40 border border-slate-800/90 rounded-2xl p-4 space-y-3 shadow-sm">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-extrabold text-sky-400 uppercase tracking-wider">🎁 Varian Produk & Stok</span>
              <button type="button" onclick={() => addVariant()} class="px-3 py-1.5 bg-sky-500/10 hover:bg-sky-500 border border-sky-500/30 text-sky-400 hover:text-white rounded-xl text-xs font-extrabold cursor-pointer">+ Tambah Varian</button>
            </div>

            <div class="flex items-center gap-1.5 flex-wrap pt-0.5">
              <span class="text-[10px] font-semibold text-slate-500">Quick add:</span>
              <button type="button" onclick={() => addVariant('1 Bulan', 45000, 10)} class="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-900 border border-slate-800 text-slate-300 hover:text-white cursor-pointer">+ 1 Bulan</button>
              <button type="button" onclick={() => addVariant('3 Bulan', 120000, 10)} class="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-900 border border-slate-800 text-slate-300 hover:text-white cursor-pointer">+ 3 Bulan</button>
              <button type="button" onclick={() => addVariant('1 Tahun', 350000, 10)} class="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-900 border border-slate-800 text-slate-300 hover:text-white cursor-pointer">+ 1 Tahun</button>
            </div>

            <div class="space-y-2.5 max-h-72 overflow-y-auto no-scrollbar pt-1">
              {#each variants as v, i}
                <div class="bg-[#070914] border border-indigo-900/40 p-3 rounded-xl space-y-2">
                  <div class="flex items-center gap-2">
                    <span class="text-[10px] font-extrabold text-sky-400 shrink-0">#{i + 1}</span>
                    <input type="text" placeholder="Nama Varian (ex: 1 Bulan)" bind:value={v.label} class="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-semibold focus:border-violet-500 focus:outline-none" />
                    <button type="button" onclick={() => removeVariant(i)} class="w-7 h-7 rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white font-bold text-xs flex items-center justify-center cursor-pointer shrink-0">✕</button>
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <div class="flex items-center bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 focus-within:border-violet-500">
                      <span class="text-[11px] font-extrabold text-slate-500 mr-1.5">Rp</span>
                      <input type="number" placeholder="45000" bind:value={v.price} class="w-full min-w-0 bg-transparent text-xs text-white focus:outline-none font-extrabold" />
                    </div>
                    <div class="flex items-center bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 focus-within:border-emerald-500">
                      <span class="text-[10px] font-extrabold text-emerald-400 mr-1 shrink-0">Stok:</span>
                      <input type="number" placeholder="10" bind:value={v.stock} class="w-full min-w-0 bg-transparent text-xs text-emerald-400 focus:outline-none font-extrabold text-center" />
                      <span class="text-[9px] text-slate-500 font-bold ml-1 shrink-0">pcs</span>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Tab 3: Pengaturan Garansi & Renew per Varian -->
        {#if activeModalTab === 'guarantee'}
          <div class="bg-gradient-to-b from-slate-950/80 to-slate-950/40 border border-slate-800/90 rounded-2xl p-4 space-y-3 shadow-sm">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-extrabold text-amber-400 uppercase tracking-wider">🛡️ Pengaturan Garansi & Renew per Varian</span>
            </div>

            <div class="space-y-2.5 max-h-72 overflow-y-auto no-scrollbar pt-1">
              {#each variants as v, i}
                <div class="bg-[#070914] border border-amber-900/30 p-3 rounded-xl space-y-2.5">
                  <div class="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                    <span class="text-xs font-extrabold text-white">Varian #{i + 1}: <span class="text-amber-400">{v.label || 'Default'}</span></span>
                    <span class="text-[10px] font-bold text-slate-500">Rp {v.price?.toLocaleString('id-ID') || 0}</span>
                  </div>

                  <div class="flex items-center justify-between bg-slate-950/80 p-2 rounded-lg border border-slate-800/60">
                    <span class="font-extrabold text-amber-400 text-xs flex items-center gap-1">🛡️ Durasi Garansi (Hari):</span>
                    <input type="number" min="0" placeholder="0" bind:value={v.warrantyDays} class="w-20 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-amber-300 font-bold text-center focus:outline-none" />
                  </div>

                  <div class="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/60 space-y-2">
                    <label class="flex items-center gap-2 font-extrabold text-sky-400 text-xs cursor-pointer">
                      <input type="checkbox" bind:checked={v.renewEnabled} class="rounded border-slate-700 text-sky-500 focus:ring-0" />
                      <span>🔄 Aktifkan Fitur Renew (Perpanjangan Akun)</span>
                    </label>

                    {#if v.renewEnabled}
                      <div class="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/40 text-xs">
                        <div>
                          <span class="text-[10px] font-bold text-slate-400 block mb-1">Maksimal Renew:</span>
                          <input type="number" min="1" placeholder="1" bind:value={v.maxRenew} class="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-sky-300 font-bold text-center focus:outline-none" />
                        </div>
                        <div>
                          <span class="text-[10px] font-bold text-slate-400 block mb-1">Delay Renew (Hari):</span>
                          <input type="number" min="0" placeholder="0" bind:value={v.renewDelayDays} class="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-sky-300 font-bold text-center focus:outline-none" />
                        </div>
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Tab 4: Pesan Tambahan / Tutorial Varian -->
        {#if activeModalTab === 'notes'}
          <div class="bg-gradient-to-b from-slate-950/80 to-slate-950/40 border border-slate-800/90 rounded-2xl p-4 space-y-3 shadow-sm">
            <div>
              <span class="text-[11px] font-extrabold text-violet-400 uppercase tracking-wider block">💬 Pesan Tambahan & Tutorial Varian</span>
              <span class="text-[10px] text-slate-400 block mt-0.5">Teks di bawah akan otomatis ditempelkan di bagian bawah pesan pengiriman akun saat transaksi varian ini sukses.</span>
            </div>

            <div class="space-y-3 max-h-72 overflow-y-auto no-scrollbar pt-1">
              {#each variants as v, i}
                <div class="bg-[#070914] border border-violet-900/30 p-3 rounded-xl space-y-1.5">
                  <div class="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                    <span class="text-xs font-extrabold text-white">Varian #{i + 1}: <span class="text-violet-400">{v.label || 'Default'}</span></span>
                  </div>
                  <textarea rows="3" placeholder="Contoh: Tutorial login, link verifikasi, petunjuk khusus dsb..." bind:value={v.notes} class="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:border-violet-500 focus:outline-none resize-none font-sans"></textarea>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Tab 5: Harga Grosir Tier -->
        {#if activeModalTab === 'wholesale'}
          <div class="bg-gradient-to-b from-slate-950/80 to-slate-950/40 border border-slate-800/90 rounded-2xl p-4 space-y-3 shadow-sm">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-extrabold text-amber-400 uppercase tracking-wider">🏷️ Harga Grosir Tier</span>
              <button type="button" onclick={() => addWholesale()} class="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500 border border-amber-500/30 text-amber-400 hover:text-white rounded-xl text-xs font-extrabold cursor-pointer">+ Tambah Tier</button>
            </div>

            <div class="flex items-center gap-1.5 flex-wrap pt-0.5">
              <span class="text-[10px] font-semibold text-slate-500">Quick add:</span>
              <button type="button" onclick={() => addWholesale(5, 4000)} class="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-900 border border-slate-800 text-amber-300 hover:text-white cursor-pointer">+ Min 5 pcs</button>
              <button type="button" onclick={() => addWholesale(10, 3500)} class="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-900 border border-slate-800 text-amber-300 hover:text-white cursor-pointer">+ Min 10 pcs</button>
              <button type="button" onclick={() => addWholesale(50, 3000)} class="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-900 border border-slate-800 text-amber-300 hover:text-white cursor-pointer">+ Min 50 pcs</button>
            </div>

            <div class="space-y-2 max-h-56 overflow-y-auto no-scrollbar pt-1">
              {#each wholesaleTiers as t, i}
                <div class="bg-[#070914] border border-indigo-900/40 p-2.5 rounded-xl space-y-2">
                  <div class="flex items-center justify-between">
                    <span class="text-[10px] font-extrabold text-amber-400 uppercase tracking-wider">Tier Grosir #{i + 1}</span>
                    <button type="button" onclick={() => removeWholesale(i)} class="w-6 h-6 rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white font-bold text-xs flex items-center justify-center cursor-pointer shrink-0">✕</button>
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <div class="flex items-center bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 focus-within:border-amber-500">
                      <span class="text-[10px] font-extrabold text-slate-500 mr-1">Min</span>
                      <input type="number" placeholder="5" bind:value={t.minQty} class="w-full min-w-0 bg-transparent text-xs text-white focus:outline-none font-bold text-center" />
                      <span class="text-[10px] font-semibold text-slate-500 ml-1">pcs</span>
                    </div>
                    <div class="flex items-center bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 focus-within:border-amber-500">
                      <span class="text-[11px] font-bold text-amber-400 mr-1.5 shrink-0">Rp</span>
                      <input type="number" placeholder="4000" bind:value={t.price} class="w-full min-w-0 bg-transparent text-xs text-white focus:outline-none font-extrabold" />
                      <span class="text-[10px] font-semibold text-slate-400 ml-1 shrink-0">/pcs</span>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Tab 6: Integrated Stock Pool (If not email product & is editing) -->
        {#if activeModalTab === 'stock' && editingProduct?.id && !requiresEmail}
          <div class="bg-gradient-to-br from-slate-950 via-slate-950 to-emerald-950/20 border border-emerald-500/30 rounded-2xl p-4 space-y-3 shadow-lg">
            <div class="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
              <span class="text-[11px] font-extrabold text-emerald-400">⚡ Kelola Stok Pool Akun</span>
              <span class="px-3 py-1 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{editingProduct.stock || 0} pcs ready</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="text-[11px] font-extrabold text-slate-400 block mb-1">Target Varian</label>
                <select bind:value={selectedVariantForStock} class="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-sky-400 font-extrabold focus:outline-none">
                  {#each variants as v}
                    <option value={v.label}>Varian: {v.label}</option>
                  {/each}
                </select>
              </div>
              <div>
                <label class="text-[11px] font-extrabold text-slate-400 block mb-1">Tanggal Expired (Opsional)</label>
                <input type="date" bind:value={stockExpiry} class="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 font-semibold focus:outline-none" />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <div>
                <label class="text-[11px] font-extrabold text-slate-400 block mb-1">📁 Upload File .TXT</label>
                <input type="file" accept=".txt" onchange={handleFileUpload} class="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-sky-500/10 file:text-sky-400 cursor-pointer bg-slate-900 border border-slate-800 rounded-xl p-1" />
              </div>
              <div class="flex items-end">
                <button type="button" onclick={clearStock} class="w-full py-2 bg-rose-500/10 hover:bg-rose-500 border border-rose-500/30 text-rose-400 hover:text-white font-extrabold text-xs rounded-xl cursor-pointer">🗑️ Reset Stok</button>
              </div>
            </div>

            <div>
              <label class="text-[11px] font-extrabold text-slate-400 block mb-1">📝 Paste Teks Akun (1 per baris)</label>
              <textarea bind:value={stockInputText} rows="3" placeholder="user1@gmail.com:pass123&#10;user2@gmail.com:pass456" class="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 font-mono focus:border-emerald-500 focus:outline-none"></textarea>
            </div>

            <button type="button" onclick={handleAddStock} class="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer">
              ⚡ Tambahkan Stok ke Pool
            </button>

            <!-- Stock items list -->
            <div class="pt-3 border-t border-slate-800/80 space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-[11px] font-extrabold text-slate-300">📋 Daftar Akun di Stok Pool:</span>
                <button type="button" onclick={cleanExpiredStock} class="text-[10px] text-amber-400 hover:underline font-bold cursor-pointer">🧹 Clean Expired</button>
              </div>
              <div class="max-h-40 overflow-y-auto space-y-1.5 pr-1 font-mono text-[11px]">
                {#if stockItems.length === 0}
                  <p class="text-[11px] text-slate-500 text-center py-2">Belum ada akun di stok pool.</p>
                {:else}
                  {#each stockItems as item, idx}
                    <div class="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800 gap-2">
                      <div class="truncate flex-1 min-w-0">
                        <span class="text-slate-500 font-bold mr-1">#{idx+1}</span>
                        <span class="text-slate-200 font-semibold truncate">{escapeHTML(item.data || item.text)}</span>
                      </div>
                      <button type="button" onclick={() => deleteStockItem(item.id)} class="px-2 py-1 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white rounded-lg text-[10px] font-bold cursor-pointer">🗑 Hapus</button>
                    </div>
                  {/each}
                {/if}
              </div>
            </div>
          </div>
        {/if}
      </div>

      <!-- Footer Buttons -->
      <div class="flex items-center justify-end gap-2.5 pt-3.5 border-t border-slate-800/80 shrink-0">
        <button onclick={() => visible = false} class="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer">Batal</button>
        <button onclick={handleSaveProduct} class="px-5 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Simpan Produk
        </button>
      </div>
    </div>
  </div>
{/if}
