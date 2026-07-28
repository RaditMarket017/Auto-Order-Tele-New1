<script>
  import { formatIDR } from '../lib/utils.js';
  import { apiFetch } from '../lib/api.js';

  let { vouchers = [], onOpenAddModal = () => {}, onRefresh = () => {} } = $props();

  async function deleteVoucher(id) {
    if (!confirm('Hapus voucher ini?')) return;
    await apiFetch(`/api/admin/vouchers/${id}`, { method: 'DELETE' });
    onRefresh();
  }
</script>

<div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
  <div class="flex items-center justify-between flex-wrap gap-2">
    <h3 class="font-bold text-base text-white">Voucher Promo</h3>
    <button onclick={onOpenAddModal} class="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs rounded-xl shadow-lg shadow-sky-500/20 transition-all cursor-pointer">
      + Buat Voucher
    </button>
  </div>
  <div class="overflow-x-auto w-full">
    <table class="w-full text-left border-collapse text-xs min-w-[500px]">
      <thead>
        <tr class="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
          <th class="py-3 px-3">Kode</th>
          <th class="py-3 px-3">Tipe</th>
          <th class="py-3 px-3">Nilai</th>
          <th class="py-3 px-3">Penggunaan</th>
          <th class="py-3 px-3 text-right">Aksi</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-800/60">
        {#if vouchers.length === 0}
          <tr><td colspan="5" class="py-6 text-center text-slate-500">Belum ada voucher</td></tr>
        {:else}
          {#each vouchers as v}
            <tr class="hover:bg-slate-800/40 transition-colors">
              <td class="py-3 px-3"><code class="text-sky-400 font-mono text-[11px]">{v.code}</code></td>
              <td class="py-3 px-3 uppercase text-[11px]">{v.type}</td>
              <td class="py-3 px-3 font-semibold text-white">
                {v.type === 'percentage' ? v.value + '%' : formatIDR(v.value)}
              </td>
              <td class="py-3 px-3">{v.currentUses || 0} / {v.maxUses || '∞'}</td>
              <td class="py-3 px-3 text-right">
                <button onclick={() => deleteVoucher(v.id)} class="px-2.5 py-1 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white rounded-lg text-xs font-semibold transition-all cursor-pointer">Hapus</button>
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
</div>
