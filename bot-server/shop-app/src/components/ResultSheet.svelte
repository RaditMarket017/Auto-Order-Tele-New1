<script>
  import { formatIDR } from '../lib/utils.js';
  import { checkOrderStatus, cancelOrder } from '../lib/api.js';

  let {
    visible = $bindable(false),
    orderResult = null,
    onRefresh = () => {},
  } = $props();

  let status = $state('pending'); // pending | paid | cancelled
  let pollTimer = $state(null);

  $effect(() => {
    if (orderResult) {
      status = orderResult.status === 'paid' ? 'paid' : 'pending';
      // Start polling if pending QRIS
      if (status === 'pending' && orderResult.orderId) {
        startPolling(orderResult.orderId);
      }
    }
    return () => stopPolling();
  });

  function startPolling(orderId) {
    stopPolling();
    pollTimer = setInterval(async () => {
      try {
        const res = await checkOrderStatus(orderId);
        if (res.success && res.data) {
          if (res.data.status === 'paid' || res.data.status === 'success') {
            status = 'paid';
            stopPolling();
            onRefresh();
          }
        }
      } catch {}
    }, 3500);
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  async function handleCheckPayment() {
    if (!orderResult?.orderId) return;
    try {
      const res = await checkOrderStatus(orderResult.orderId);
      if (res.success && res.data) {
        if (res.data.status === 'paid' || res.data.status === 'success') {
          status = 'paid';
          stopPolling();
          onRefresh();
        } else {
          alert('⏳ Pembayaran belum terdeteksi. Silakan selesaikan pembayaran QRIS terlebih dahulu.');
        }
      } else {
        alert('❌ Gagal memeriksa status pembayaran.');
      }
    } catch { alert('❌ Gagal terhubung ke server.'); }
  }

  async function handleCancel() {
    if (!orderResult?.orderId) return;
    if (!confirm('Apakah Anda yakin ingin membatalkan pesanan?')) return;
    try {
      const res = await cancelOrder(orderResult.orderId);
      stopPolling();
      if (res.success) {
        alert('🗑️ Pesanan berhasil dibatalkan.');
        visible = false;
      } else {
        alert('❌ ' + (res.error || 'Gagal membatalkan pesanan'));
      }
    } catch (err) { alert('❌ Error: ' + err.message); }
  }

  function handleClose() {
    stopPolling();
    visible = false;
  }
</script>

{#if visible && orderResult}
  <div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end justify-center p-0 sm:p-4" role="dialog">
    <div class="w-full max-w-lg bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-2xl p-6 text-center space-y-4 animate-slide-up">
      <div class="w-10 h-1 bg-slate-800 rounded-full mx-auto"></div>

      {#if status === 'paid'}
        <!-- SUCCESS -->
        <div class="space-y-3 py-2">
          <div class="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
            <svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg>
          </div>
          <h3 class="text-lg font-extrabold text-emerald-400">Pembayaran Berhasil!</h3>
          <div class="bg-slate-950 border border-slate-800 p-3 rounded-2xl text-xs space-y-1">
            <div class="text-slate-400">Order ID: <code class="text-white font-bold">{orderResult.orderId}</code></div>
            <div class="text-sky-400 font-extrabold">Status: LUNAS (Paid)</div>
          </div>
          <p class="text-xs text-slate-300">📦 Detail produk & Nota telah dikirim otomatis ke Telegram chat Anda.</p>
          <button onclick={handleClose} class="w-full py-3 bg-sky-500 hover:bg-sky-400 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all">
            Kembali Belanja
          </button>
        </div>
      {:else}
        <!-- PENDING QRIS -->
        <div class="space-y-3">
          <div class="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-400 text-xs font-bold">
            <span class="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
            ⏳ Menunggu Pembayaran
          </div>

          <h3 class="text-base font-extrabold text-white">Scan QRIS Pembayaran</h3>
          <p class="text-xs text-slate-400">Total Tagihan: <b class="text-sky-400 text-sm font-mono">{formatIDR(orderResult.uniqueAmount || 0)}</b></p>

          {#if orderResult.qrDataUrl}
            <div class="bg-white p-3 rounded-2xl inline-block shadow-2xl shadow-sky-500/10 my-1">
              <img src={orderResult.qrDataUrl} class="w-48 h-48 block mx-auto" alt="QRIS" />
            </div>
          {/if}

          <p class="text-[11px] text-slate-400 bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
            📱 Scan QRIS dengan GoPay, OVO, DANA, ShopeePay, atau m-Banking.
          </p>

          <div class="pt-2 space-y-2">
            <button onclick={handleCheckPayment} class="w-full py-3 bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-400 hover:to-sky-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-sky-500/25 transition-all flex items-center justify-center gap-2">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
              🔄 Cek Pembayaran Now
            </button>
            <div class="grid grid-cols-2 gap-2">
              <button onclick={handleCancel} class="py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
                Batalkan
              </button>
              <button onclick={handleClose} class="py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-all">
                Kembali
              </button>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}
