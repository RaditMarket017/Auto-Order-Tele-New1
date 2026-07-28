<script>
  import { formatIDR } from '../lib/utils.js';
  import { apiFetch } from '../lib/api.js';

  let { orders = [], onRefresh = () => {} } = $props();

  async function exportExcel() {
    try {
      const res = await apiFetch('/api/admin/reports/export');
      if (res && res.success) {
        alert('✅ ' + res.message);
      } else {
        alert('❌ Gagal mengirim laporan Excel: ' + (res?.error || 'Terjadi kesalahan server'));
      }
    } catch (err) {
      alert('❌ Gagal mengirim laporan: ' + err.message);
    }
  }

  async function approveOrder(id) {
    await apiFetch(`/api/admin/orders/${id}/approve`, { method: 'POST' });
    onRefresh();
  }

  async function rejectOrder(id) {
    await apiFetch(`/api/admin/orders/${id}/reject`, { method: 'POST' });
    onRefresh();
  }
</script>

<div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
  <div class="flex items-center justify-between flex-wrap gap-2">
    <h3 class="font-bold text-base text-white">Riwayat Pesanan</h3>
    <button onclick={exportExcel} class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-all cursor-pointer">
      📊 Export Laporan Excel (.xlsx)
    </button>
  </div>
  <div class="overflow-x-auto w-full">
    <table class="w-full text-left border-collapse text-xs min-w-[550px]">
      <thead>
        <tr class="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
          <th class="py-3 px-3">Order ID</th>
          <th class="py-3 px-3">Pembeli</th>
          <th class="py-3 px-3">Produk</th>
          <th class="py-3 px-3">Total</th>
          <th class="py-3 px-3">Metode</th>
          <th class="py-3 px-3">Status</th>
          <th class="py-3 px-3 text-right">Aksi</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-800/60">
        {#if orders.length === 0}
          <tr><td colspan="7" class="py-6 text-center text-slate-500">Belum ada pesanan</td></tr>
        {:else}
          {#each orders as o}
            <tr class="hover:bg-slate-800/40 transition-colors">
              <td class="py-3 px-3"><code class="text-sky-400 font-mono text-[11px]">{o.id}</code></td>
              <td class="py-3 px-3 font-medium text-white">{o.customerName || '-'}</td>
              <td class="py-3 px-3">{o.productName || '-'}</td>
              <td class="py-3 px-3 font-semibold text-white">{formatIDR(o.totalPrice || 0)}</td>
              <td class="py-3 px-3 uppercase text-[11px] text-slate-400">{o.paymentMethod}</td>
              <td class="py-3 px-3">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold {['success','paid'].includes(o.status) ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}">
                  {o.status}
                </span>
              </td>
              <td class="py-3 px-3 text-right">
                {#if o.status === 'pending' || o.status === 'processing'}
                  <button onclick={() => approveOrder(o.id)} class="px-2 py-1 bg-sky-500 text-white rounded-lg text-xs font-semibold mr-1 cursor-pointer">Approve</button>
                  <button onclick={() => rejectOrder(o.id)} class="px-2 py-1 bg-rose-500/10 text-rose-400 rounded-lg text-xs font-semibold cursor-pointer">Reject</button>
                {:else}
                  -
                {/if}
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
</div>
