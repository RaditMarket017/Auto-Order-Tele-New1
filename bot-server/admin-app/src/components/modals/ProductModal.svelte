<script>
  import { escapeHTML } from '../../lib/utils.js';
  import { apiFetch } from '../../lib/api.js';

  let { visible = $bindable(false), editingProduct = null, onRefresh = () => {} } = $props();

  let name = $state('');
  let imageUrl = $state('');
  let description = $state('');
  let requiresEmail = $state(false);

  // Variant list structure
  let variants = $state([
    {
      label: '1 Bulan',
      duration: '',
      keterangan: '',
      description: '',
      price: 45000,
      notes: '',
      wholesaleTiers: []
    }
  ]);

  let saveStatusText = $state('');

  $effect(() => {
    if (editingProduct) {
      name = editingProduct.name || '';
      imageUrl = editingProduct.imageUrl || editingProduct.apkLogoUrl || '';
      description = editingProduct.description || '';
      requiresEmail = Boolean(editingProduct.requiresEmail);
      
      if (editingProduct.variants?.length) {
        variants = editingProduct.variants.map(v => {
          let rawLabel = v.label || '';
          const lines = rawLabel.split('\n').map(l => l.trim()).filter(Boolean);
          const mainTitle = lines[0] || rawLabel;

          let dur = v.duration || '';
          let ket = v.keterangan || '';

          if (lines.length > 1) {
            lines.slice(1).forEach(line => {
              if (/durasi/i.test(line)) {
                dur = dur || line.replace(/^[⏳📌\s]*durasi\s*:\s*/i, '').trim();
              } else if (/keterangan|hasil\s+give/i.test(line)) {
                ket = ket || line.replace(/^[⏳📌\s]*(keterangan\s*:\s*)?/i, '').trim();
              }
            });
          }

          return {
            label: mainTitle,
            duration: dur,
            keterangan: ket,
            description: v.description || '',
            price: Number(v.price || 0),
            notes: v.notes || '',
            wholesaleTiers: Array.isArray(v.wholesaleTiers) ? JSON.parse(JSON.stringify(v.wholesaleTiers)) : (Array.isArray(editingProduct.wholesaleTiers) ? JSON.parse(JSON.stringify(editingProduct.wholesaleTiers)) : [])
          };
        });
      } else {
        variants = [{ label: '1 Bulan', duration: '', keterangan: '', description: '', price: 45000, notes: '', wholesaleTiers: [] }];
      }

      saveStatusText = requiresEmail ? '✅ Aktif' : '❌ Off';
    } else {
      name = '';
      imageUrl = '';
      description = '';
      requiresEmail = false;
      variants = [{ label: '1 Bulan', duration: '', keterangan: '', description: '', price: 45000, notes: '', wholesaleTiers: [] }];
      saveStatusText = '❌ Off';
    }
  });

  function addVariant() {
    variants = [
      ...variants,
      {
        label: `Varian ${variants.length + 1}`,
        duration: '',
        keterangan: '',
        description: '',
        price: 10000,
        notes: '',
        wholesaleTiers: []
      }
    ];
  }

  function removeVariant(idx) {
    if (variants.length <= 1) {
      return alert('Minimal harus ada 1 varian produk!');
    }
    variants = variants.filter((_, i) => i !== idx);
  }

  function addVariantWholesale(variantIdx) {
    const v = variants[variantIdx];
    const currentTiers = v.wholesaleTiers || [];
    const nextMinQty = currentTiers.length > 0 ? (currentTiers[currentTiers.length - 1].minQty || 0) + 5 : 5;
    const nextPrice = v.price ? Math.max(0, v.price - 5000) : 0;
    
    v.wholesaleTiers = [...currentTiers, { minQty: nextMinQty, price: nextPrice }];
    variants = [...variants];
  }

  function removeVariantWholesale(variantIdx, tierIdx) {
    const v = variants[variantIdx];
    if (!v.wholesaleTiers) return;
    v.wholesaleTiers = v.wholesaleTiers.filter((_, i) => i !== tierIdx);
    variants = [...variants];
  }

  async function handleSaveProduct() {
    if (!name.trim()) return alert('Nama Katalog tidak boleh kosong!');
    if (variants.length === 0) return alert('Minimal tambahkan 1 varian produk!');

    const formattedVariants = variants.map(v => {
      const labelText = (v.label || '').trim().split('\n')[0];
      const extraLines = [];
      if (v.duration && v.duration.trim()) {
        extraLines.push(`⏳ Durasi : ${v.duration.trim()}`);
      }
      if (v.keterangan && v.keterangan.trim()) {
        let ket = v.keterangan.trim();
        if (!ket.toLowerCase().startsWith('keterangan')) {
          ket = `Keterangan : ${ket}`;
        }
        extraLines.push(`📌 ${ket}`);
      }
      const fullLabel = extraLines.length > 0 ? `${labelText}\n${extraLines.join('\n')}` : labelText;

      return {
        ...v,
        label: fullLabel,
        duration: v.duration || '',
        keterangan: v.keterangan || '',
        price: Number(v.price || 0)
      };
    });

    const basePrice = formattedVariants[0]?.price || 0;
    const endpoint = editingProduct?.id ? `/api/admin/products/${editingProduct.id}` : '/api/admin/products';
    const method = editingProduct?.id ? 'PUT' : 'POST';

    // Collect all wholesale tiers for top level backward compatibility if needed
    const globalWholesale = formattedVariants[0]?.wholesaleTiers || [];

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
        variants: formattedVariants,
        wholesaleTiers: globalWholesale
      })
    });

    if (res && res.success) {
      visible = false;
      onRefresh();
    } else {
      alert('Gagal menyimpan produk: ' + (res?.error || 'Terjadi kesalahan server'));
    }
  }
</script>

{#if visible}
  <div class="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto no-scrollbar" role="dialog">
    <div class="w-full max-w-2xl bg-slate-900 border border-slate-800/90 rounded-3xl p-5 sm:p-6 space-y-5 shadow-2xl my-auto max-h-[92vh] flex flex-col no-scrollbar" onclick={(e) => e.stopPropagation()}>
      
      <!-- Header -->
      <div class="flex items-center justify-between pb-3.5 border-b border-slate-800/80 shrink-0">
        <div class="flex items-center gap-3.5">
          <div class="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500/20 to-indigo-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400 shrink-0 shadow-lg">
            <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
          </div>
          <div>
            <h3 class="font-extrabold text-base sm:text-lg text-white tracking-tight leading-snug">{editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}</h3>
            <p class="text-[11px] text-slate-400 font-medium">Atur data Katalog produk dan kelola varian harga & pesan sukses.</p>
          </div>
        </div>
        <button type="button" onclick={() => visible = false} class="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 font-bold text-xs flex items-center justify-center cursor-pointer">✕</button>
      </div>

      <!-- Main Form Body -->
      <div class="space-y-5 flex-1 overflow-y-auto pr-1 no-scrollbar py-1">
        
        <!-- SECTION 1: KATALOG -->
        <div class="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-4 space-y-4 shadow-sm">
          <div class="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <span class="text-xs font-black uppercase text-sky-400 tracking-wider flex items-center gap-1.5">
              📁 1. Katalog Produk
            </span>
          </div>

          <!-- Nama Katalog -->
          <div>
            <label class="text-[11px] font-extrabold text-slate-300 block mb-1">Nama Katalog <span class="text-rose-400">*</span></label>
            <input type="text" bind:value={name} placeholder="Contoh: YouTube Premium / Netflix / Canvapro" class="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:border-sky-500 focus:outline-none font-bold">
          </div>

          <!-- Deskripsi Katalog & Upload Ikon -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="text-[11px] font-extrabold text-slate-300 block mb-1">Deskripsi Katalog</label>
              <textarea rows="2" bind:value={description} placeholder="Keterangan singkat produk katalog..." class="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-600 focus:border-sky-500 focus:outline-none resize-none"></textarea>
            </div>

            <div>
              <label class="text-[11px] font-extrabold text-slate-300 block mb-1">Upload Link Ikon APK</label>
              <input type="text" bind:value={imageUrl} placeholder="https://domain.com/icon.png" class="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:border-sky-500 focus:outline-none mb-2">
              {#if imageUrl}
                <div class="flex items-center gap-2 text-[10px] text-slate-400">
                  <img src={imageUrl} alt="Icon Preview" class="w-6 h-6 rounded-lg object-cover border border-slate-700" />
                  <span>Preview Ikon</span>
                </div>
              {/if}
            </div>
          </div>
        </div>

        <!-- SECTION 2: VARIAN PRODUK -->
        <div class="bg-slate-950/80 border border-slate-800/90 rounded-2xl p-4 space-y-4 shadow-sm">
          <div class="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <span class="text-xs font-black uppercase text-emerald-400 tracking-wider flex items-center gap-1.5">
              🎁 2. Varian Produk ({variants.length})
            </span>
            <button 
              type="button" 
              onclick={addVariant}
              class="px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-1 cursor-pointer"
            >
              + Tambah Varian
            </button>
          </div>

          <!-- List of Variants -->
          <div class="space-y-4">
            {#each variants as v, vIdx}
              <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3.5 relative transition-all hover:border-slate-700">
                
                <!-- Variant Header Bar -->
                <div class="flex items-center justify-between border-b border-slate-800/90 pb-2.5">
                  <span class="text-xs font-extrabold text-sky-400 flex items-center gap-1.5">
                    📦 Varian #{vIdx + 1}
                  </span>
                  {#if variants.length > 1}
                    <button 
                      type="button" 
                      onclick={() => removeVariant(vIdx)} 
                      class="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/20 rounded-lg text-[10px] font-extrabold cursor-pointer transition-all"
                    >
                      🗑 Hapus Varian
                    </button>
                  {/if}
                </div>

                <!-- Input Nama Produk & Harga -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label class="text-[11px] font-extrabold text-slate-300 block mb-1">Nama Produk / Varian <span class="text-rose-400">*</span></label>
                    <input type="text" bind:value={v.label} placeholder="Contoh: Capcut pro" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 font-bold focus:border-sky-500 focus:outline-none">
                  </div>
                  <div>
                    <label class="text-[11px] font-extrabold text-slate-300 block mb-1">Harga (Rp) <span class="text-rose-400">*</span></label>
                    <input type="number" min="0" bind:value={v.price} placeholder="1000" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-emerald-400 font-extrabold focus:border-emerald-500 focus:outline-none">
                  </div>
                </div>

                <!-- Input Durasi & Keterangan -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label class="text-[11px] font-extrabold text-amber-400 block mb-1">⏳ Durasi Varian</label>
                    <input type="text" bind:value={v.duration} placeholder="Contoh: 30 HARI / 1 BULAN" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 font-medium focus:border-amber-500 focus:outline-none">
                  </div>
                  <div>
                    <label class="text-[11px] font-extrabold text-sky-400 block mb-1">📌 Keterangan Varian</label>
                    <input type="text" bind:value={v.keterangan} placeholder="Contoh: Hasil Give [ Private ]" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 font-medium focus:border-sky-500 focus:outline-none">
                  </div>
                </div>

                <!-- Deskripsi Produk -->
                <div>
                  <label class="text-[11px] font-extrabold text-slate-300 block mb-1">Deskripsi Produk</label>
                  <input type="text" bind:value={v.description} placeholder="Keterangan varian, garansi, atau spesifikasi..." class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:border-sky-500 focus:outline-none">
                </div>

                <!-- Teks untuk Orderan Berhasil (Custom per Varian) -->
                <div>
                  <label class="text-[11px] font-extrabold text-violet-400 block mb-1">💬 Teks untuk Orderan Berhasil (Custom per Varian)</label>
                  <textarea rows="2" bind:value={v.notes} placeholder="Teks khusus / instruksi / ucapan yang dikirimkan ke pembeli setelah pesanan varian ini berhasil..." class="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:border-violet-500 focus:outline-none resize-y"></textarea>
                </div>

                <!-- Harga Grosir (Bisa tambah lebih dari 1 via tombol "+") -->
                <div class="bg-slate-950/90 border border-slate-800/80 rounded-xl p-3 space-y-2.5">
                  <div class="flex items-center justify-between">
                    <span class="text-[11px] font-extrabold text-amber-400 flex items-center gap-1">
                      🏷️ Harga Grosir ({v.wholesaleTiers?.length || 0} tier)
                    </span>
                    <button 
                      type="button" 
                      onclick={() => addVariantWholesale(vIdx)}
                      class="px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-white border border-amber-500/30 rounded-lg text-[10px] font-extrabold cursor-pointer transition-all flex items-center gap-1"
                    >
                      + Tambah Tier Grosir
                    </button>
                  </div>

                  {#if !v.wholesaleTiers || v.wholesaleTiers.length === 0}
                    <p class="text-[10px] text-slate-500 italic">Belum ada harga grosir untuk varian ini. Klik "+ Tambah Tier Grosir" untuk menambah potongan harga beli banyak.</p>
                  {:else}
                    <div class="space-y-2 pt-1">
                      {#each v.wholesaleTiers as tier, tIdx}
                        <div class="flex items-center gap-2 bg-slate-900 border border-slate-800 p-2 rounded-xl">
                          <div class="flex-1 grid grid-cols-2 gap-2">
                            <div>
                              <span class="text-[9px] font-bold text-slate-400 block mb-0.5">Min Beli (Pcs)</span>
                              <input type="number" min="1" bind:value={tier.minQty} placeholder="5" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white font-bold" />
                            </div>
                            <div>
                              <span class="text-[9px] font-bold text-slate-400 block mb-0.5">Harga Grosir (Rp)</span>
                              <input type="number" min="0" bind:value={tier.price} placeholder="40000" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-amber-400 font-extrabold" />
                            </div>
                          </div>
                          <button 
                            type="button" 
                            onclick={() => removeVariantWholesale(vIdx, tIdx)}
                            class="p-1.5 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white rounded-lg text-[11px] font-bold cursor-pointer transition-all"
                            title="Hapus Grosir"
                          >
                            🗑️
                          </button>
                        </div>
                      {/each}
                    </div>
                  {/if}
                </div>

              </div>
            {/each}
          </div>

        </div>

      </div>

      <!-- Footer Buttons -->
      <div class="flex items-center justify-end gap-2.5 pt-3.5 border-t border-slate-800/80 shrink-0">
        <button type="button" onclick={() => visible = false} class="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer">Batal</button>
        <button type="button" onclick={handleSaveProduct} class="px-5 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Simpan Produk & Varian
        </button>
      </div>

    </div>
  </div>
{/if}
