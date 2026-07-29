<script>
  import { onMount } from 'svelte';
  import { apiFetch } from '../lib/api.js';
  import { escapeHTML } from '../lib/utils.js';

  let { products = [], onRefresh = () => {} } = $props();

  let selectedProductId = $state('');
  let selectedVariantLabel = $state('Default');
  let stockItems = $state([]);
  let loadingStock = $state(false);

  // Form Inputs
  let itemsText = $state('');
  let expDays = $state('');
  let expiredAtDate = $state('');

  // Feature Toggles
  let inviteEnabled = $state(false);
  let renewEnabled = $state(false);
  let maxRenew = $state(1);
  let renewStartDate = $state('');
  let renewNotReadyMessage = $state('Tombol renew belum aktif saat ini. Silakan coba kembali sesuai tanggal yang ditentukan.');
  
  let warrantyEnabled = $state(true);
  let warrantyDays = $state(30);
  let warrantyEndDateDate = $state('');
  let warrantyExpiredMessage = $state('Mohon maaf, garansi sudah tidak berlaku.');
  let warrantyTimeoutMessage = $state('Garansi sudah hangus karena tidak ada bukti yang dikirim sebelumnya.');
  let warrantyCsMessage = $state('Jika ada kendala, silakan hubungi CS kami untuk bantuan lebih lanjut.');

  let submitStatus = $state('');

  $effect(() => {
    if (products.length > 0 && !selectedProductId) {
      selectedProductId = products[0].id;
    }
  });

  $effect(() => {
    const pId = selectedProductId;
    if (pId) {
      const prod = products.find(p => p.id === pId);
      if (prod && prod.variants?.length > 0) {
        selectedVariantLabel = prod.variants[0].label;
      }
      loadStock();
    }
  });

  async function loadStock() {
    if (!selectedProductId) return;
    loadingStock = true;
    try {
      const res = await apiFetch(`/api/admin/stock/${selectedProductId}`);
      if (res && res.success) {
        stockItems = res.data || [];
      } else {
        stockItems = [];
      }
    } catch (err) {
      console.error('Load stock error:', err);
      stockItems = [];
    } finally {
      loadingStock = false;
    }
  }

  async function handleAddStock() {
    if (!selectedProductId) return alert('Silakan pilih produk terlebih dahulu!');
    if (!itemsText.trim()) return alert('Data stok tidak boleh kosong!');

    submitStatus = '⚡ Menambahkan stok...';
    try {
      const res = await apiFetch(`/api/admin/stock/${selectedProductId}`, {
        method: 'POST',
        body: JSON.stringify({
          itemsText: itemsText.trim(),
          variantLabel: selectedVariantLabel,
          expiredAt: expiredAtDate || null,
          expDays: expDays || null,
          inviteEnabled,
          renewEnabled,
          maxRenew,
          renewStartDate,
          renewNotReadyMessage,
          warrantyEnabled,
          warrantyDays,
          warrantyEndDate: warrantyEndDateDate || null,
          warrantyExpiredMessage,
          warrantyTimeoutMessage,
          warrantyCsMessage
        })
      });

      if (res && res.success) {
        submitStatus = `✅ Berhasil menambahkan ${res.addedCount} akun stok!`;
        itemsText = '';
        await loadStock();
        onRefresh();
      } else {
        alert('❌ Gagal: ' + (res?.error || 'Terjadi kesalahan'));
        submitStatus = '';
      }
    } catch (err) {
      alert('❌ Error menambahkan stok');
      submitStatus = '';
    }
  }

  async function toggleItemActive(itemId, currentActive) {
    const nextStatus = !currentActive;
    try {
      const res = await apiFetch(`/api/admin/stock/item/${itemId}/toggle`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: nextStatus })
      });
      if (res && res.success) {
        stockItems = stockItems.map(item => item.id === itemId ? { ...item, isActive: nextStatus } : item);
        onRefresh();
      } else {
        alert('Gagal mengubah status stok');
      }
    } catch {
      alert('Gagal terhubung ke server');
    }
  }

  async function deleteItem(itemId) {
    if (!confirm('Apakah Anda yakin ingin menghapus stok ini dari pool?')) return;
    try {
      const res = await apiFetch(`/api/admin/stock/item/${itemId}`, { method: 'DELETE' });
      if (res && res.success) {
        stockItems = stockItems.filter(item => item.id !== itemId);
        onRefresh();
      }
    } catch {}
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      itemsText = event.target.result || '';
    };
    reader.readAsText(file);
  }

  const selectedProduct = $derived(products.find(p => p.id === selectedProductId) || null);
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between flex-wrap gap-3 border-b border-indigo-900/30 pb-4">
    <div>
      <h1 class="text-xl font-black tracking-tight text-white flex items-center gap-2">
        <span class="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">⚡</span>
        Add Stock & Kelola Fitur Stok
      </h1>
      <p class="text-xs text-slate-400 font-medium mt-1">Tambah akun digital, atur format pipe (user|email|pass|2fa|profil|exp), serta kontrol toggle Invite, Renew, Garansi & status ON/OFF per stok.</p>
    </div>
  </div>

  <!-- Form Area -->
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    
    <!-- Left Column: Product Selection & Feature Toggles -->
    <div class="lg:col-span-1 space-y-4">
      <!-- Select Product & Variant -->
      <div class="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 space-y-3.5 shadow-md">
        <h2 class="text-xs font-black uppercase text-emerald-400 tracking-wider flex items-center gap-1.5">
          📦 1. Pilih Produk & Varian
        </h2>

        <div>
          <label class="text-[11px] font-extrabold text-slate-400 block mb-1">Target Produk</label>
          <select bind:value={selectedProductId} class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-bold focus:border-emerald-500 focus:outline-none">
            {#each products as p}
              <option value={p.id}>{p.name} ({p.stock || 0} stok)</option>
            {/each}
          </select>
        </div>

        {#if selectedProduct && selectedProduct.variants?.length > 0}
          <div>
            <label class="text-[11px] font-extrabold text-slate-400 block mb-1">
              Target Varian {#if inviteEnabled}<span class="text-emerald-400">(Fitur Invite ON: Varian Opsional)</span>{/if}
            </label>
            <select bind:value={selectedVariantLabel} disabled={inviteEnabled} class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-sky-400 font-extrabold focus:border-sky-500 focus:outline-none disabled:opacity-50">
              {#each selectedProduct.variants as v}
                <option value={v.label}>Varian: {v.label}</option>
              {/each}
            </select>
          </div>
        {/if}
      </div>

      <!-- Feature Toggles Section -->
      <div class="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 space-y-4 shadow-md">
        <h2 class="text-xs font-black uppercase text-violet-400 tracking-wider flex items-center gap-1.5">
          ⚙️ 2. Pengaturan Fitur Otomatis
        </h2>

        <!-- Toggle 1: Invite -->
        <div class="bg-slate-950 border border-slate-800/80 p-3 rounded-xl space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-extrabold text-white flex items-center gap-1.5">
              ✉️ Fitur Invite
            </span>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" bind:checked={inviteEnabled} class="sr-only peer" />
              <div class="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>
          {#if inviteEnabled}
            <p class="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
              ✓ Invite ON: Pembeli tidak perlu memilih varian. Stok ini otomatis diprioritaskan sebagai akun invite!
            </p>
          {/if}
        </div>

        <!-- Toggle 2: Renew -->
        <div class="bg-slate-950 border border-slate-800/80 p-3 rounded-xl space-y-2.5">
          <div class="flex items-center justify-between">
            <span class="text-xs font-extrabold text-white flex items-center gap-1.5">
              🔄 Fitur Renew
            </span>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" bind:checked={renewEnabled} class="sr-only peer" />
              <div class="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
            </label>
          </div>

          {#if renewEnabled}
            <div class="space-y-2 pt-1 border-t border-slate-800">
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="text-[10px] font-bold text-slate-400 block mb-0.5">Max Renew (Kali)</label>
                  <input type="number" min="1" placeholder="1" bind:value={maxRenew} class="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold" />
                </div>
                <div>
                  <label class="text-[10px] font-bold text-slate-400 block mb-0.5">Tanggal Aktif Renew</label>
                  <input type="date" bind:value={renewStartDate} class="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-300 font-medium" />
                </div>
              </div>
              <div>
                <label class="text-[10px] font-bold text-slate-400 block mb-0.5">Teks Jika Renew Belum Berfungsi</label>
                <textarea rows="2" bind:value={renewNotReadyMessage} placeholder="Teks pemberitahuan jika renew belum berfungsi..." class="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-[11px] text-slate-200 resize-none"></textarea>
              </div>
            </div>
          {/if}
        </div>

        <!-- Toggle 3: Garansi -->
        <div class="bg-slate-950 border border-slate-800/80 p-3 rounded-xl space-y-2.5">
          <div class="flex items-center justify-between">
            <span class="text-xs font-extrabold text-white flex items-center gap-1.5">
              🛡️ Fitur Klaim Garansi
            </span>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" bind:checked={warrantyEnabled} class="sr-only peer" />
              <div class="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          {#if warrantyEnabled}
            <div class="space-y-2 pt-1 border-t border-slate-800">
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="text-[10px] font-bold text-slate-400 block mb-0.5">Durasi Garansi (Hari)</label>
                  <input type="number" min="0" placeholder="30" bind:value={warrantyDays} class="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold" />
                </div>
                <div>
                  <label class="text-[10px] font-bold text-slate-400 block mb-0.5">Tanggal Akhir Garansi</label>
                  <input type="date" bind:value={warrantyEndDateDate} class="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-300 font-medium" />
                </div>
              </div>

              <div>
                <label class="text-[10px] font-bold text-amber-400 block mb-0.5">1. Teks Jika Garansi Habis</label>
                <textarea rows="1" bind:value={warrantyExpiredMessage} placeholder="Mohon maaf, garansi sudah tidak berlaku." class="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-[11px] text-slate-200 resize-none"></textarea>
              </div>

              <div>
                <label class="text-[10px] font-bold text-rose-400 block mb-0.5">2. Teks Jika Claim Tanpa Bukti (Hangus)</label>
                <textarea rows="1" bind:value={warrantyTimeoutMessage} placeholder="Garansi sudah hangus karena tidak ada bukti yang dikirim sebelumnya." class="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-[11px] text-slate-200 resize-none"></textarea>
              </div>

              <div>
                <label class="text-[10px] font-bold text-sky-400 block mb-0.5">3. Pesan Kendala / CS Tambahan</label>
                <textarea rows="1" bind:value={warrantyCsMessage} placeholder="Jika ada kendala, silakan hubungi CS kami untuk bantuan lebih lanjut." class="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-[11px] text-slate-200 resize-none"></textarea>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- Right Column: Input Stock Data & Stock Item Management -->
    <div class="lg:col-span-2 space-y-4">
      
      <!-- Input Data Akun Format -->
      <div class="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 space-y-3.5 shadow-md">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <h2 class="text-xs font-black uppercase text-sky-400 tracking-wider flex items-center gap-1.5">
            📝 3. Input Data Akun Stok
          </h2>
          <span class="text-[10px] text-slate-400 font-mono">Format Pipe `|` Fleksibel</span>
        </div>

        <div class="bg-slate-950 border border-indigo-900/30 rounded-xl p-3 text-[11px] text-slate-300 space-y-1 font-mono">
          <span class="text-sky-400 font-bold block mb-1">📋 Format yang didukung (1 akun per baris):</span>
          <code>user | email | password | f2a | profil | tgl_exp</code><br>
          <span class="text-slate-500">Contoh:</span><br>
          <code class="text-emerald-400">user1 | user1@gmail.com | pass123 | 2FAKEY123 | Profile1 | 2026-12-31</code>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="text-[11px] font-extrabold text-slate-400 block mb-1">Tanggal Auto Hapus (Opsional)</label>
            <input type="date" bind:value={expiredAtDate} class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-medium focus:outline-none" />
          </div>
          <div>
            <label class="text-[11px] font-extrabold text-slate-400 block mb-1">📁 Upload File .TXT</label>
            <input type="file" accept=".txt" onchange={handleFileUpload} class="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-sky-500/10 file:text-sky-400 cursor-pointer bg-slate-950 border border-slate-800 rounded-xl p-1" />
          </div>
        </div>

        <div>
          <label class="text-[11px] font-extrabold text-slate-400 block mb-1">Data Teks Akun</label>
          <textarea bind:value={itemsText} rows="5" placeholder="user1|user1@gmail.com|pass123|2FAKEY123|Profile1|2026-12-31&#10;user2|user2@gmail.com|pass456|2FAKEY456|Profile2|2026-12-31" class="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-600 font-mono focus:border-emerald-500 focus:outline-none resize-y"></textarea>
        </div>

        {#if submitStatus}
          <div class="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-extrabold animate-pulse">
            {submitStatus}
          </div>
        {/if}

        <button type="button" onclick={handleAddStock} class="w-full py-3 bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer">
          ⚡ Tambahkan Stok ke Database Pool
        </button>
      </div>

      <!-- Stock Pool List with Individual Status Switch -->
      <div class="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 space-y-3.5 shadow-md">
        <div class="flex items-center justify-between">
          <h2 class="text-xs font-black uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
            📋 4. Daftar Stok Pool ({stockItems.length} pcs)
          </h2>
          <button type="button" onclick={loadStock} class="text-xs text-sky-400 font-extrabold hover:underline cursor-pointer">↻ Refresh Stok</button>
        </div>

        <p class="text-[11px] text-slate-400">
          💡 <b>Status Individual ON/OFF Stok</b>: Setiap stok memiliki tombol status `[🟢 ON]` / `[🔴 OFF]`. Jika Stok #2 di-OFF-kan, maka fitur & akun tersebut **tidak akan tertampil / tidak dapat diklaim** oleh pembeli kecuali di-ON-kan kembali.
        </p>

        <div class="max-h-96 overflow-y-auto space-y-2 pr-1 pt-1 font-mono text-[11px]">
          {#if loadingStock}
            <div class="text-center py-8 text-slate-500 font-sans text-xs animate-pulse">Memuat daftar stok...</div>
          {:else if stockItems.length === 0}
            <div class="text-center py-8 text-slate-500 font-sans text-xs">Belum ada akun stok untuk produk ini.</div>
          {:else}
            {#each stockItems as item, idx}
              <div class="flex items-center justify-between p-3 rounded-xl border transition-all gap-3 {item.isActive ? 'bg-slate-950 border-slate-800' : 'bg-rose-950/20 border-rose-900/40 opacity-75'}">
                
                <div class="min-w-0 flex-1 space-y-1">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-slate-500 font-extrabold">#{idx+1}</span>
                    <span class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-sky-500/10 text-sky-400 border border-sky-500/20">{item.variantLabel || 'Default'}</span>
                    
                    {#if item.isInviteItem}
                      <span class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">✉️ Invite ON</span>
                    {/if}

                    <span class="px-2 py-0.5 rounded text-[10px] font-extrabold {item.isActive ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'}">
                      {item.isActive ? '🟢 STATUS ON' : '🔴 STATUS OFF'}
                    </span>
                  </div>

                  <!-- Details -->
                  <div class="text-slate-200 font-semibold text-xs truncate">
                    {escapeHTML(item.username ? `${item.username} | ${item.email || '-'} | ${item.password}` : (item.data || item.text))}
                  </div>

                  {#if item.f2aSecret || item.profile}
                    <div class="text-[10px] text-slate-400 truncate">
                      🔑 2FA: <span class="text-amber-300 font-bold">{item.f2aSecret || '-'}</span> | 👤 Profil: <span class="text-violet-300 font-bold">{item.profile || '-'}</span>
                    </div>
                  {/if}

                  {#if item.expiredAt}
                    <div class="text-[10px] text-slate-500">
                      📅 Expired: {new Date(item.expiredAt).toLocaleDateString('id-ID')}
                    </div>
                  {/if}
                </div>

                <!-- Action Controls -->
                <div class="flex items-center gap-2 shrink-0">
                  <button 
                    type="button" 
                    onclick={() => toggleItemActive(item.id, item.isActive)} 
                    class="px-2.5 py-1.5 rounded-xl font-extrabold text-[10px] transition-all cursor-pointer {item.isActive ? 'bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-white border border-amber-500/30' : 'bg-emerald-500/15 hover:bg-emerald-500 text-emerald-300 hover:text-white border border-emerald-500/30'}"
                  >
                    {item.isActive ? '🔴 OFF-kan' : '🟢 ON-kan'}
                  </button>

                  <button 
                    type="button" 
                    onclick={() => deleteItem(item.id)} 
                    class="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/20 text-[11px] font-bold cursor-pointer"
                    title="Hapus Stok"
                  >
                    🗑️
                  </button>
                </div>

              </div>
            {/each}
          {/if}
        </div>
      </div>

    </div>

  </div>
</div>
