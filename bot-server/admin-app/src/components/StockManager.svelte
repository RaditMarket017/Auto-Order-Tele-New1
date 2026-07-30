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
  let renewScheduleDates = $state([]);
  let renewNotReadyMessage = $state('Tombol renew belum aktif saat ini. Silakan coba kembali sesuai tanggal yang ditentukan.');

  function addRenewTier() {
    if (renewScheduleDates.length === 0) {
      const firstDate = renewStartDate || new Date().toISOString().substring(0, 10);
      renewScheduleDates = [firstDate, new Date().toISOString().substring(0, 10)];
    } else {
      renewScheduleDates = [...renewScheduleDates, new Date().toISOString().substring(0, 10)];
    }
    maxRenew = renewScheduleDates.length;
  }

  function removeRenewTier(idx) {
    renewScheduleDates = renewScheduleDates.filter((_, i) => i !== idx);
    maxRenew = Math.max(1, renewScheduleDates.length);
  }
  
  let warrantyEnabled = $state(true);
  let warrantyDays = $state(30);
  let warrantyEndDateDate = $state('');
  let warrantyExpiredMessage = $state('Mohon maaf, garansi sudah tidak berlaku.');
  let warrantyTimeoutMessage = $state('Garansi sudah hangus karena tidak ada bukti yang dikirim sebelumnya.');
  let warrantyCsMessage = $state('Jika ada kendala, silakan hubungi CS kami untuk bantuan lebih lanjut.');

  let submitStatus = $state('');

  let editingItem = $state(null);
  let editModalVisible = $state(false);
  let isSyncingSettings = false;

  function syncVariantSettings() {
    if (!selectedProductId) return;
    const prod = products.find(p => p.id === selectedProductId);
    if (!prod) return;
    const v = (prod.variants || []).find(varItem => varItem.label === selectedVariantLabel) || prod.variants?.[0];
    if (!v) return;

    isSyncingSettings = true;
    inviteEnabled = Boolean(v.inviteEnabled ?? prod.requiresEmail);
    renewEnabled = Boolean(v.renewEnabled);
    maxRenew = Number(v.maxRenew || 1);
    renewStartDate = v.renewStartDate || '';
    renewScheduleDates = Array.isArray(v.renewScheduleDates) ? [...v.renewScheduleDates] : (v.renewStartDate ? [v.renewStartDate] : []);
    renewNotReadyMessage = v.renewNotReadyMessage || 'Tombol renew belum aktif saat ini. Silakan coba kembali sesuai tanggal yang ditentukan.';

    warrantyEnabled = Boolean(v.warrantyEnabled !== false);
    warrantyDays = Number(v.warrantyDays ?? 30);
    warrantyEndDateDate = v.warrantyEndDate ? v.warrantyEndDate.substring(0, 10) : '';
    warrantyExpiredMessage = v.warrantyExpiredMessage || 'Mohon maaf, garansi sudah tidak berlaku.';
    warrantyTimeoutMessage = v.warrantyTimeoutMessage || 'Garansi sudah hangus karena tidak ada bukti yang dikirim sebelumnya.';
    warrantyCsMessage = v.warrantyCsMessage || 'Jika ada kendala, silakan hubungi CS kami untuk bantuan lebih lanjut.';

    setTimeout(() => { isSyncingSettings = false; }, 100);
  }

  let autoSaveTimeout = null;
  function triggerAutoSave() {
    if (isSyncingSettings || !selectedProductId) return;

    if (renewScheduleDates.length > 0 && renewScheduleDates[0]) {
      renewStartDate = renewScheduleDates[0];
    } else if (renewStartDate && renewScheduleDates.length === 0) {
      renewScheduleDates = [renewStartDate];
    }

    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(async () => {
      const res = await apiFetch(`/api/admin/products/${selectedProductId}/update-variant-settings`, {
        method: 'POST',
        body: JSON.stringify({
          variantLabel: selectedVariantLabel,
          inviteEnabled,
          renewEnabled,
          maxRenew: renewScheduleDates.length > 0 ? renewScheduleDates.length : maxRenew,
          renewStartDate: renewStartDate || (renewScheduleDates[0] || ''),
          renewScheduleDates: renewScheduleDates.filter(Boolean),
          renewNotReadyMessage,
          warrantyEnabled,
          warrantyDays,
          warrantyEndDate: warrantyEndDateDate || null,
          warrantyExpiredMessage,
          warrantyTimeoutMessage,
          warrantyCsMessage
        })
      });

      if (res && res.success && res.variants) {
        const prod = products.find(p => p.id === selectedProductId);
        if (prod) {
          prod.variants = res.variants;
        }
      }
    }, 400);
  }

  function openEditModal(item) {
    editingItem = {
      ...item,
      expiredAtDate: item.expiredAt ? item.expiredAt.substring(0, 10) : '',
      warrantyEndDateDate: item.warrantyEndDate ? item.warrantyEndDate.substring(0, 10) : '',
      renewScheduleDates: Array.isArray(item.renewScheduleDates) ? [...item.renewScheduleDates] : (item.renewStartDate ? [item.renewStartDate] : []),
    };
    editModalVisible = true;
  }

  async function saveEditItem() {
    if (!editingItem) return;
    try {
      const res = await apiFetch(`/api/admin/stock/item/${editingItem.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          username: editingItem.username,
          password: editingItem.password,
          email: editingItem.email,
          f2aSecret: editingItem.f2aSecret,
          profile: editingItem.profile,
          expiredAt: editingItem.expiredAtDate || null,
          isInviteItem: editingItem.isInviteItem,
          renewEnabled: editingItem.renewEnabled,
          maxRenew: editingItem.maxRenew,
          renewStartDate: editingItem.renewStartDate,
          renewScheduleDates: editingItem.renewScheduleDates,
          renewNotReadyMessage: editingItem.renewNotReadyMessage,
          warrantyEnabled: editingItem.warrantyEnabled,
          warrantyDays: editingItem.warrantyDays,
          warrantyEndDate: editingItem.warrantyEndDateDate || null,
          warrantyExpiredMessage: editingItem.warrantyExpiredMessage,
          warrantyTimeoutMessage: editingItem.warrantyTimeoutMessage,
          warrantyCsMessage: editingItem.warrantyCsMessage,
        })
      });

      if (res && res.success) {
        alert('✅ Data stok berhasil diperbarui!');
        editModalVisible = false;
        editingItem = null;
        loadStock();
      } else {
        alert('❌ Gagal memperbarui data stok');
      }
    } catch (err) {
      alert('❌ Error: ' + err.message);
    }
  }

  $effect(() => {
    if (products.length > 0 && !selectedProductId) {
      selectedProductId = products[0].id;
    }
  });

  $effect(() => {
    const pId = selectedProductId;
    if (pId) {
      const prod = products.find(p => p.id === pId);
      if (prod && prod.variants?.length > 0 && !selectedVariantLabel) {
        selectedVariantLabel = prod.variants[0].label;
      }
      syncVariantSettings();
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
          maxRenew: renewScheduleDates.length > 0 ? renewScheduleDates.length : maxRenew,
          renewStartDate: renewStartDate || (renewScheduleDates[0] || ''),
          renewScheduleDates: renewScheduleDates.filter(Boolean),
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
              Target Varian {#if inviteEnabled}<span class="text-emerald-400">(Fitur Invite ON)</span>{/if}
            </label>
            <select bind:value={selectedVariantLabel} onchange={() => { syncVariantSettings(); loadStock(); }} class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-sky-400 font-extrabold focus:border-sky-500 focus:outline-none">
              {#each selectedProduct.variants as v}
                <option value={v.label}>Varian: {v.label}</option>
              {/each}
            </select>
          </div>
        {/if}
      </div>

      <div class="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 space-y-4 shadow-md">
        <h2 class="text-xs font-black uppercase text-violet-400 tracking-wider flex items-center justify-between">
          <span>⚙️ 2. Pengaturan Fitur Otomatis</span>
          <span class="text-[9px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">💾 AUTO-SAVE</span>
        </h2>

        <div class="bg-slate-950 border border-slate-800/80 p-3 rounded-xl space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-extrabold text-white flex items-center gap-1.5">
              ✉️ Fitur Invite
            </span>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" bind:checked={inviteEnabled} onchange={triggerAutoSave} class="sr-only peer" />
              <div class="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>
          {#if inviteEnabled}
            <p class="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
              ✓ Invite ON: Fitur invite aktif untuk varian yang dipilih. Stok ini otomatis diprioritaskan sebagai akun invite!
            </p>
          {/if}
        </div>

        <div class="bg-slate-950 border border-slate-800/80 p-3 rounded-xl space-y-2.5">
          <div class="flex items-center justify-between">
            <span class="text-xs font-extrabold text-white flex items-center gap-1.5">
              🔄 Fitur Renew
            </span>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" bind:checked={renewEnabled} onchange={triggerAutoSave} class="sr-only peer" />
              <div class="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
            </label>
          </div>

          {#if renewEnabled}
            <div class="space-y-2.5 pt-1 border-t border-slate-800">
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-extrabold text-indigo-400">
                  📅 Jadwal Tanggal Renew ({renewScheduleDates.length > 0 ? renewScheduleDates.length : 1} Tier = {renewScheduleDates.length > 0 ? renewScheduleDates.length : maxRenew}x Renew)
                </span>
                <button
                  type="button"
                  onclick={() => { addRenewTier(); triggerAutoSave(); }}
                  class="px-2 py-1 bg-indigo-500/20 hover:bg-indigo-500 text-indigo-300 hover:text-white border border-indigo-500/30 rounded-lg text-[10px] font-extrabold cursor-pointer transition-all flex items-center gap-1"
                >
                  + Tambah Tier Renew
                </button>
              </div>

              {#if renewScheduleDates.length === 0}
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="text-[10px] font-bold text-slate-400 block mb-0.5">Max Renew (Kali)</label>
                    <input type="number" min="1" placeholder="1" bind:value={maxRenew} oninput={triggerAutoSave} class="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold" />
                  </div>
                  <div>
                    <label class="text-[10px] font-bold text-slate-400 block mb-0.5">Tanggal Aktif Renew (Tier 1)</label>
                    <input type="date" bind:value={renewStartDate} onchange={triggerAutoSave} class="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-300 font-medium" />
                  </div>
                </div>
              {:else}
                <div class="space-y-1.5 bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                  {#each renewScheduleDates as tDate, tIdx}
                    <div class="flex items-center gap-2">
                      <span class="text-[10px] font-extrabold text-slate-300 w-24">Tier #{tIdx + 1} (Renew {tIdx + 1}):</span>
                      <input type="date" bind:value={renewScheduleDates[tIdx]} onchange={triggerAutoSave} class="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-indigo-300 font-bold focus:border-indigo-500 focus:outline-none" />
                      {#if renewScheduleDates.length > 1}
                        <button
                          type="button"
                          onclick={() => { removeRenewTier(tIdx); triggerAutoSave(); }}
                          class="px-2 py-1 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                          title="Hapus Tier"
                        >✕</button>
                      {/if}
                    </div>
                  {/each}
                </div>
              {/if}

              <div>
                <label class="text-[10px] font-bold text-slate-400 block mb-0.5">Teks Jika Renew Belum Berfungsi</label>
                <textarea rows="2" bind:value={renewNotReadyMessage} oninput={triggerAutoSave} placeholder="Teks pemberitahuan jika renew belum berfungsi..." class="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-[11px] text-slate-200 resize-none"></textarea>
              </div>
            </div>
          {/if}
        </div>

        <div class="bg-slate-950 border border-slate-800/80 p-3 rounded-xl space-y-2.5">
          <div class="flex items-center justify-between">
            <span class="text-xs font-extrabold text-white flex items-center gap-1.5">
              🛡️ Fitur Klaim Garansi
            </span>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" bind:checked={warrantyEnabled} onchange={triggerAutoSave} class="sr-only peer" />
              <div class="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          {#if warrantyEnabled}
            <div class="space-y-2 pt-1 border-t border-slate-800">
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="text-[10px] font-bold text-slate-400 block mb-0.5">Durasi Garansi (Hari)</label>
                  <input type="number" min="0" placeholder="30" bind:value={warrantyDays} oninput={triggerAutoSave} class="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold" />
                </div>
                <div>
                  <label class="text-[10px] font-bold text-slate-400 block mb-0.5">Tanggal Akhir Garansi</label>
                  <input type="date" bind:value={warrantyEndDateDate} onchange={triggerAutoSave} class="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-300 font-medium" />
                </div>
              </div>

              <div>
                <label class="text-[10px] font-bold text-amber-400 block mb-0.5">1. Teks Jika Garansi Habis</label>
                <textarea rows="1" bind:value={warrantyExpiredMessage} oninput={triggerAutoSave} placeholder="Mohon maaf, garansi sudah tidak berlaku." class="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-[11px] text-slate-200 resize-none"></textarea>
              </div>

              <div>
                <label class="text-[10px] font-bold text-rose-400 block mb-0.5">2. Teks Jika Claim Tanpa Bukti (Hangus)</label>
                <textarea rows="1" bind:value={warrantyTimeoutMessage} oninput={triggerAutoSave} placeholder="Garansi sudah hangus karena tidak ada bukti yang dikirim sebelumnya." class="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-[11px] text-slate-200 resize-none"></textarea>
              </div>

              <div>
                <label class="text-[10px] font-bold text-sky-400 block mb-0.5">3. Pesan Kendala / CS Tambahan</label>
                <textarea rows="1" bind:value={warrantyCsMessage} oninput={triggerAutoSave} placeholder="Jika ada kendala, silakan hubungi CS kami untuk bantuan lebih lanjut." class="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-[11px] text-slate-200 resize-none"></textarea>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>

    <div class="lg:col-span-2 space-y-4">
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

      <div class="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 space-y-3.5 shadow-md">
        <div class="flex items-center justify-between">
          <h2 class="text-xs font-black uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
            📋 4. Daftar Stok Pool ({stockItems.length} pcs)
          </h2>
          <button type="button" onclick={loadStock} class="text-xs text-sky-400 font-extrabold hover:underline cursor-pointer">↻ Refresh Stok</button>
        </div>

        <p class="text-[11px] text-slate-400">
          💡 <b>Status Individual ON/OFF Stok</b>: Setiap stok memiliki tombol status `[🟢 ON]` / `[🔴 OFF]` dan tombol `[✏️ Edit]` untuk meng-edit ulang data akun stok yang sudah ada.
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

                <div class="flex items-center gap-2 shrink-0">
                  <button 
                    type="button" 
                    onclick={() => openEditModal(item)} 
                    class="p-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500 text-sky-400 hover:text-white border border-sky-500/20 text-[11px] font-bold cursor-pointer flex items-center gap-1"
                    title="Edit Stok Ini"
                  >
                    ✏️ Edit
                  </button>

                  <button 
                    type="button" 
                    onclick={() => toggleItemActive(item.id, item.isActive)} 
                    class="px-2.5 py-1.5 rounded-xl font-extrabold text-[10px] transition-all cursor-pointer {item.isActive ? 'bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-white border border-amber-500/30' : 'bg-emerald-500/15 hover:bg-emerald-500 text-emerald-300 hover:text-white border border-emerald-500/30'}"
                  >
                    {item.isActive ? '🔴 OFF' : '🟢 ON'}
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

<!-- Modal Edit Stok Item -->
{#if editModalVisible && editingItem}
  <div class="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto no-scrollbar" role="dialog">
    <div class="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-2xl my-auto max-h-[92vh] overflow-y-auto no-scrollbar" onclick={(e) => e.stopPropagation()}>
      
      <div class="flex items-center justify-between border-b border-slate-800 pb-3">
        <h3 class="font-extrabold text-sm text-white flex items-center gap-2">
          ✏️ Edit Akun Stok #{editingItem.id.substring(0, 8)}
        </h3>
        <button type="button" onclick={() => editModalVisible = false} class="text-slate-400 hover:text-white font-bold text-sm">✕</button>
      </div>

      <div class="space-y-3 font-sans">
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-[10px] font-bold text-slate-400 block mb-0.5">Username / User</label>
            <input type="text" bind:value={editingItem.username} class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-bold">
          </div>
          <div>
            <label class="text-[10px] font-bold text-slate-400 block mb-0.5">Password</label>
            <input type="text" bind:value={editingItem.password} class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-bold">
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-[10px] font-bold text-slate-400 block mb-0.5">Email</label>
            <input type="text" bind:value={editingItem.email} class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-bold">
          </div>
          <div>
            <label class="text-[10px] font-bold text-slate-400 block mb-0.5">F2A Secret</label>
            <input type="text" bind:value={editingItem.f2aSecret} class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-amber-300 font-bold">
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-[10px] font-bold text-slate-400 block mb-0.5">Profil</label>
            <input type="text" bind:value={editingItem.profile} class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-bold">
          </div>
          <div>
            <label class="text-[10px] font-bold text-slate-400 block mb-0.5">Tgl Expired Stok</label>
            <input type="date" bind:value={editingItem.expiredAtDate} class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-bold">
          </div>
        </div>
      </div>

      <div class="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
        <button type="button" onclick={() => editModalVisible = false} class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl">
          ✕ Batal
        </button>
        <button type="button" onclick={saveEditItem} class="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-extrabold rounded-xl shadow-lg shadow-emerald-500/20">
          💾 Simpan Perubahan
        </button>
      </div>

    </div>
  </div>
{/if}
