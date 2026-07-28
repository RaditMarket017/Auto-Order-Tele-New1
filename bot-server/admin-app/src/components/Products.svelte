<script>
  import { apiFetch } from '../lib/api.js';

  let { 
    products = [], 
    onOpenAddModal = () => {}, 
    onOpenEditModal = () => {}, 
    onRefresh = () => {} 
  } = $props();

  async function toggleQuickEmailInvite(productId, newState) {
    await apiFetch(`/api/admin/products/${productId}`, {
      method: 'PUT',
      body: JSON.stringify({ requiresEmail: newState })
    });
    onRefresh();
  }

  async function deleteProduct(id) {
    if (!confirm('Hapus produk ini?')) return;
    await apiFetch(`/api/admin/products/${id}`, { method: 'DELETE' });
    onRefresh();
  }
</script>

<div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
  <div class="flex items-center justify-between flex-wrap gap-2">
    <div>
      <h3 class="font-bold text-base text-white">Daftar Produk Digital</h3>
      <p class="text-xs text-slate-400">Seluruh pesanan diproses secara <b class="text-emerald-400">INSTAN</b> otomatis oleh bot dari Stok Pool.</p>
    </div>
    <button onclick={onOpenAddModal} class="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs rounded-xl shadow-lg shadow-sky-500/20 transition-all flex items-center gap-1.5 cursor-pointer">
      + Tambah Produk Baru
    </button>
  </div>

  <div class="w-full overflow-x-auto no-scrollbar">
    <table class="w-full text-left border-collapse text-xs">
      <thead>
        <tr class="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
          <th class="py-3 px-3">Produk</th>
          <th class="py-3 px-3">Stok Ready</th>
          <th class="py-3 px-3">Butuh Email</th>
          <th class="py-3 px-3 text-right">Kelola Stok & Aksi</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-800/60">
        {#if products.length === 0}
          <tr><td colspan="4" class="py-6 text-center text-slate-500">Belum ada produk</td></tr>
        {:else}
          {#each products as p}
            <tr class="hover:bg-slate-800/40 transition-colors">
              <td class="py-3 px-3">
                <div class="flex items-center gap-2.5">
                  {#if p.imageUrl}
                    <img src={p.imageUrl} class="w-8 h-8 rounded-lg object-cover border border-slate-800 shrink-0" alt="" />
                  {:else}
                    <div class="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-500 font-bold text-xs shrink-0">P</div>
                  {/if}
                  <div class="font-bold text-white text-xs sm:text-sm truncate max-w-[150px] sm:max-w-xs">{p.name}</div>
                </div>
              </td>
              <td class="py-3 px-3">
                <span class="inline-flex items-center whitespace-nowrap px-2.5 py-1 rounded-xl text-xs font-extrabold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  {p.stock || 0} pcs
                </span>
              </td>
              <td class="py-3 px-3">
                <button 
                  onclick={() => toggleQuickEmailInvite(p.id, !p.requiresEmail)} 
                  title="Klik untuk ubah status Butuh Email" 
                  class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer {p.requiresEmail ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 shadow-sm shadow-emerald-500/10' : 'bg-slate-950 text-slate-400 border border-slate-800 hover:bg-slate-800'}"
                >
                  {p.requiresEmail ? '📧 ON' : '❌ OFF'}
                </button>
              </td>
              <td class="py-3 px-3 text-right">
                <div class="flex items-center justify-end gap-1.5">
                  <button onclick={() => onOpenEditModal(p)} class="px-2.5 py-1 bg-sky-500/10 text-sky-400 hover:bg-sky-500 hover:text-white rounded-lg text-xs font-semibold transition-all cursor-pointer">✏️ Edit</button>
                  <button onclick={() => deleteProduct(p.id)} class="px-2.5 py-1 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white rounded-lg text-xs font-semibold transition-all cursor-pointer">Hapus</button>
                </div>
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
</div>
