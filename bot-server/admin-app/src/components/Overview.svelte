<script>
  import { formatIDR } from '../lib/utils.js';
  import { apiFetch } from '../lib/api.js';

  let { dashboardData = {}, onNavigate = () => {} } = $props();

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

  const maxRev = $derived(() => {
    if (!dashboardData.sales7Days || dashboardData.sales7Days.length === 0) return 1000;
    return Math.max(...dashboardData.sales7Days.map(day => day.revenue || 0), 1000);
  });

  const total7 = $derived(() => {
    if (!dashboardData.sales7Days) return 0;
    return dashboardData.sales7Days.reduce((s, day) => s + (day.revenue || 0), 0);
  });
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between flex-wrap gap-3">
    <h2 class="text-xl font-extrabold text-white tracking-tight">Dashboard Ringkasan</h2>
    <button onclick={exportExcel} class="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-1.5 cursor-pointer">
      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
      📊 Export Excel
    </button>
  </div>

  <!-- Stat Cards -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
    <div class="bg-[#0c0f1d] border border-indigo-900/30 rounded-2xl p-4 space-y-1 shadow-lg">
      <span class="text-xs text-slate-400 font-semibold">Revenue Hari Ini</span>
      <h3 class="text-lg md:text-xl font-black text-violet-400 truncate">{formatIDR(dashboardData.dailyRevenue || 0)}</h3>
    </div>
    <div class="bg-[#0c0f1d] border border-indigo-900/30 rounded-2xl p-4 space-y-1 shadow-lg">
      <span class="text-xs text-slate-400 font-semibold">Order Sukses</span>
      <h3 class="text-lg md:text-xl font-black text-violet-400">{dashboardData.dailyOrders || 0}</h3>
    </div>
    <div class="bg-[#0c0f1d] border border-indigo-900/30 rounded-2xl p-4 space-y-1 shadow-lg">
      <span class="text-xs text-slate-400 font-semibold">Total Member</span>
      <h3 class="text-lg md:text-xl font-black text-violet-400">{dashboardData.totalUsers || 0}</h3>
    </div>
    <div class="bg-[#0c0f1d] border border-indigo-900/30 rounded-2xl p-4 space-y-1 shadow-lg">
      <span class="text-xs text-slate-400 font-semibold">Total Produk</span>
      <h3 class="text-lg md:text-xl font-black text-violet-400">{dashboardData.totalProducts || 0}</h3>
    </div>
  </div>

  <!-- Low Stock Alert -->
  {#if dashboardData.lowStockProducts && dashboardData.lowStockProducts.length > 0}
    <div class="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 font-bold text-lg">⚠️</div>
        <div>
          <h4 class="font-extrabold text-sm text-rose-400">Peringatan Stok Menipis / Habis!</h4>
          <p class="text-xs text-slate-300 mt-0.5">
            Produk berikut butuh stok: {dashboardData.lowStockProducts.map(p => `${p.name} (${p.stock || 0} pcs)`).join(', ')}
          </p>
        </div>
      </div>
      <button onclick={() => onNavigate('products')} class="px-3.5 py-1.5 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-500/20 transition-all cursor-pointer">
        📦 Kelola Stok Produk
      </button>
    </div>
  {/if}

  <!-- Chart & Top Products -->
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
    <!-- Sales Chart -->
    <div class="lg:col-span-2 bg-[#0c0f1d] border border-indigo-900/30 rounded-2xl p-5 space-y-4 shadow-lg flex flex-col justify-between">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="font-extrabold text-sm sm:text-base text-white flex items-center gap-2">
            <span>📈</span> Trend Penjualan (7 Hari Terakhir)
          </h3>
          <p class="text-[11px] text-slate-400">Grafik omset harian toko Anda dalam seminggu.</p>
        </div>
        <span class="text-xs font-extrabold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
          {formatIDR(total7())}
        </span>
      </div>

      {#if dashboardData.sales7Days && dashboardData.sales7Days.length > 0}
        <div class="relative h-44 w-full pt-4 pb-2 flex items-end justify-between gap-2 border-b border-indigo-950">
          {#each dashboardData.sales7Days as day}
            {@const heightPct = Math.max(Math.round(((day.revenue || 0) / maxRev()) * 100), 6)}
            <div class="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end">
              <div class="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 bg-[#050711] text-white text-[10px] font-bold px-2 py-1 rounded border border-indigo-800 whitespace-nowrap shadow-xl z-20 pointer-events-none">
                {formatIDR(day.revenue || 0)} ({day.count || 0} order)
              </div>
              <div style="height: {heightPct}%" class="w-full bg-gradient-to-t from-violet-600/30 to-violet-400 rounded-t-lg group-hover:from-violet-500 group-hover:to-purple-300 transition-all duration-300 shadow-md"></div>
            </div>
          {/each}
        </div>
        <div class="flex items-center justify-between text-[10px] font-bold text-slate-500 px-1">
          {#each dashboardData.sales7Days as day}
            <span class="flex-1 text-center truncate">{day.label}</span>
          {/each}
        </div>
      {:else}
        <p class="text-xs text-slate-500 text-center py-10">Belum ada data grafik penjualan.</p>
      {/if}
    </div>

    <!-- Top Products Leaderboard -->
    <div class="bg-[#0c0f1d] border border-indigo-900/30 rounded-2xl p-5 space-y-4 shadow-lg flex flex-col justify-between">
      <div>
        <h3 class="font-extrabold text-sm sm:text-base text-white flex items-center gap-2">
          <span>🔥</span> Produk Terlaris
        </h3>
        <p class="text-[11px] text-slate-400">Top produk paling banyak dibeli.</p>
      </div>

      <div class="space-y-3 my-auto">
        {#if dashboardData.topProducts && dashboardData.topProducts.length > 0}
          {#each dashboardData.topProducts as p, idx}
            <div class="flex items-center justify-between p-2.5 rounded-xl bg-[#060814] border border-indigo-950">
              <div class="flex items-center gap-2.5">
                <span class="w-6 h-6 rounded-lg {idx === 0 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-800 text-slate-400'} font-extrabold text-xs flex items-center justify-center">{idx + 1}</span>
                <div>
                  <div class="font-bold text-xs text-white">{p.name}</div>
                  <div class="text-[10px] text-slate-400">{p.sold} unit terjual</div>
                </div>
              </div>
              <span class="font-bold text-xs text-violet-400">{formatIDR(p.revenue || 0)}</span>
            </div>
          {/each}
        {:else}
          <p class="text-xs text-slate-500 text-center py-4">Belum ada transaksi produk.</p>
        {/if}
      </div>
    </div>
  </div>

  <!-- Transaksi Terbaru -->
  <div class="bg-[#0c0f1d] border border-indigo-900/30 rounded-2xl p-5 space-y-4 shadow-lg">
    <div class="flex items-center justify-between flex-wrap gap-2">
      <div>
        <h3 class="font-extrabold text-sm sm:text-base text-white flex items-center gap-2">
          <span>⚡</span> Transaksi Terbaru
        </h3>
        <p class="text-[11px] text-slate-400">5 Transaksi terakhir yang masuk ke bot.</p>
      </div>
      <button onclick={() => onNavigate('orders')} class="text-xs font-bold text-violet-400 hover:text-violet-300 transition-colors cursor-pointer">
        Lihat Semua Pesanan →
      </button>
    </div>

    <div class="overflow-x-auto w-full">
      <table class="w-full text-left border-collapse text-xs whitespace-nowrap min-w-[500px]">
        <thead>
          <tr class="border-b border-indigo-950 text-slate-400 uppercase tracking-wider text-[10px]">
            <th class="py-2.5 px-3">Order ID</th>
            <th class="py-2.5 px-3">Pembeli</th>
            <th class="py-2.5 px-3">Produk</th>
            <th class="py-2.5 px-3">Total</th>
            <th class="py-2.5 px-3">Metode</th>
            <th class="py-2.5 px-3 text-right">Status</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-indigo-950/60">
          {#if dashboardData.recentOrders && dashboardData.recentOrders.length > 0}
            {#each dashboardData.recentOrders as o}
              <tr class="hover:bg-violet-950/20 transition-colors">
                <td class="py-2.5 px-3 font-mono text-white text-[11px] font-bold">{o.id}</td>
                <td class="py-2.5 px-3 font-semibold text-slate-300">{o.customerName || 'User'}</td>
                <td class="py-2.5 px-3 text-slate-300 font-medium">{o.productName || '-'}</td>
                <td class="py-2.5 px-3 font-bold text-violet-400">{formatIDR(o.totalPrice || 0)}</td>
                <td class="py-2.5 px-3 text-slate-400 uppercase font-semibold text-[10px]">{o.paymentMethod || '-'}</td>
                <td class="py-2.5 px-3 text-right">
                  {#if o.status === 'success' || o.status === 'paid'}
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">✅ Sukses</span>
                  {:else if o.status === 'pending'}
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">⏳ Pending</span>
                  {:else}
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">❌ Gagal</span>
                  {/if}
                </td>
              </tr>
            {/each}
          {:else}
            <tr><td colspan="6" class="py-4 text-center text-slate-500">Belum ada transaksi terbaru</td></tr>
          {/if}
        </tbody>
      </table>
    </div>
  </div>
</div>
