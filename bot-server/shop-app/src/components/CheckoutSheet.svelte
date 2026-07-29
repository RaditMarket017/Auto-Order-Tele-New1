<script>
  import { formatIDR } from '../lib/utils.js';
  import { applyVoucher } from '../lib/api.js';

  let {
    product = null,
    visible = $bindable(false),
    userBalance = 0,
    gateways = { hasRamaShop: true, hasPanzzPay: false, hasDualGateways: false },
    onSubmit = () => {},
  } = $props();

  let selectedVariantIdx = $state(0);
  let quantity = $state(1);
  let paymentMethod = $state('qris');
  let voucherCode = $state('');
  let voucherDiscount = $state(0);
  let appliedCode = $state('');

  // Derived
  const variant = $derived(product?.variants?.[selectedVariantIdx]);
  const maxStock = $derived(variant?.stock ?? 0);
  const tiers = $derived(product?.wholesaleTiers || []);

  const unitPrice = $derived(() => {
    let price = variant?.price || 0;
    if (Array.isArray(tiers) && tiers.length > 0 && quantity > 1) {
      const sorted = [...tiers].sort((a, b) => b.minQty - a.minQty);
      const match = sorted.find(t => quantity >= t.minQty);
      if (match?.price > 0) return match.price;
    }
    return price;
  });

  const isWholesale = $derived(() => {
    if (!Array.isArray(tiers) || tiers.length === 0 || quantity <= 1) return false;
    const sorted = [...tiers].sort((a, b) => b.minQty - a.minQty);
    return sorted.some(t => quantity >= t.minQty && t.price > 0);
  });

  const subtotal = $derived(unitPrice() * quantity);
  const finalTotal = $derived(Math.max(0, subtotal - voucherDiscount));

  // Reset on product change
  $effect(() => {
    if (product) {
      selectedVariantIdx = 0;
      quantity = 1;
      paymentMethod = 'qris';
      voucherCode = '';
      voucherDiscount = 0;
      appliedCode = '';
    }
  });

  function selectVariant(idx) {
    selectedVariantIdx = idx;
    quantity = 1;
  }

  function adjustQty(delta) {
    let newQty = quantity + delta;
    if (newQty < 1) newQty = 1;
    if (maxStock > 0 && newQty > maxStock) newQty = maxStock;
    quantity = newQty;
  }

  function setQuickQty(q) {
    if (maxStock > 0 && q > maxStock) q = maxStock;
    quantity = q;
  }

  async function handleVoucher() {
    if (!voucherCode.trim() || !product) return;
    try {
      const res = await applyVoucher(voucherCode.trim(), subtotal, product.id);
      if (res.success && res.data) {
        appliedCode = res.data.code;
        voucherDiscount = res.data.discount || 0;
        alert(`🎉 Voucher ${res.data.code} berhasil! Diskon: ${formatIDR(res.data.discount)}`);
      } else {
        const msg = res.reason === 'expired' ? 'Voucher kadaluwarsa' : res.reason === 'max_uses' ? 'Voucher habis' : 'Kode tidak valid';
        alert('❌ ' + msg);
      }
    } catch { alert('❌ Gagal memeriksa voucher'); }
  }

  function handleSubmit() {
    if (maxStock <= 0) return alert('❌ Stok varian ini sedang habis!');
    if (paymentMethod === 'saldo' && userBalance < finalTotal) {
      return alert(`❌ Saldo tidak cukup!\nSaldo: ${formatIDR(userBalance)}\nTagihan: ${formatIDR(finalTotal)}`);
    }
    onSubmit({
      product,
      variantIndex: selectedVariantIdx,
      quantity,
      paymentMethod,
      voucherCode: voucherDiscount > 0 ? appliedCode : null,
    });
    visible = false;
  }
</script>

{#if visible && product}
  <!-- Backdrop -->
  <div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end justify-center p-0 sm:p-4" onclick={() => visible = false} role="dialog">
    <!-- Sheet -->
    <div class="w-full max-w-lg bg-[#0c0f1d] border-t sm:border border-indigo-900/40 rounded-t-3xl sm:rounded-2xl p-5 space-y-4 animate-slide-up max-h-[85vh] overflow-y-auto no-scrollbar" onclick={(e) => e.stopPropagation()}>
      <!-- Drag handle -->
      <div class="w-10 h-1 bg-slate-800 rounded-full mx-auto"></div>

      <!-- Product Info -->
      <div class="flex items-center gap-3">
        {#if product.imageUrl || product.apkLogoUrl}
          <img src={product.imageUrl || product.apkLogoUrl} class="w-10 h-10 rounded-xl object-cover border border-violet-500/30" alt="" />
        {/if}
        <div>
          <h3 class="text-base font-extrabold text-white leading-tight">{product.name}</h3>
          <p class="text-[10px] text-emerald-400 font-bold">⚡ Processed Instantly</p>
        </div>
      </div>

      <p class="text-xs text-slate-400">{product.description || 'Produk digital instant & garansi penuh.'}</p>

      <!-- Wholesale Tiers -->
      {#if tiers.length > 0}
        <div class="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 space-y-2">
          <span class="text-[10px] font-extrabold text-amber-400">🏷️ DISKON GROSIR TERSEDIA</span>
          <div class="flex gap-1.5 flex-wrap">
            {#each tiers as t}
              <span class="px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-300 text-[10px] font-extrabold border border-amber-500/30">
                Min {t.minQty} pcs: {formatIDR(t.price)}/pcs
              </span>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Variant Selector -->
      <div class="space-y-2">
        <span class="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Pilih Varian</span>
        {#each product.variants || [] as v, i}
          {@const vStock = v.stock || 0}
          {@const vReady = vStock > 0}
          <button
            type="button"
            onclick={() => selectVariant(i)}
            class="w-full border rounded-xl p-3 flex items-center justify-between cursor-pointer transition-all {i === selectedVariantIdx ? 'border-violet-500 bg-violet-500/10' : 'border-indigo-900/30 bg-[#070914]'}"
          >
            <span class="text-xs font-bold text-white">{v.label}</span>
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-md {vReady ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}">
                {vReady ? `Stok: ${vStock} pcs` : '🔴 Habis'}
              </span>
              <span class="text-xs font-black text-violet-400">{formatIDR(v.price)}</span>
            </div>
          </button>
        {/each}
      </div>

      <!-- Qty Stepper -->
      <div class="space-y-2">
        <span class="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Jumlah</span>
        <div class="flex items-center gap-3">
          <button onclick={() => adjustQty(-1)} class="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-lg flex items-center justify-center transition-all cursor-pointer">−</button>
          <span class="text-lg font-extrabold text-white min-w-[40px] text-center font-mono">{quantity}</span>
          <button onclick={() => adjustQty(1)} class="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-lg flex items-center justify-center transition-all cursor-pointer">+</button>
          <div class="flex gap-1.5 ml-auto">
            {#each [5, 10, 25] as q}
              <button onclick={() => setQuickQty(q)} class="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-800 text-slate-300 hover:bg-violet-600 hover:text-white transition-all cursor-pointer">{q}x</button>
            {/each}
          </div>
        </div>
      </div>

      {#if isWholesale()}
        <p class="text-[11px] text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5">
          ✨ Diskon Grosir Aktif! ({formatIDR(unitPrice())}/pcs)
        </p>
      {/if}

      <!-- Voucher -->
      <div class="flex gap-2">
        <input
          type="text"
          bind:value={voucherCode}
          placeholder="Kode voucher..."
          class="flex-1 bg-[#070914] border border-indigo-900/30 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none font-semibold"
        />
        <button onclick={handleVoucher} class="px-3.5 py-2 bg-violet-600/15 hover:bg-violet-600 border border-violet-500/30 text-violet-300 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer">Terapkan</button>
      </div>

      <!-- Payment Method -->
      <div class="space-y-2">
        <span class="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Metode Pembayaran</span>
        <div class="space-y-2">
          {#if gateways?.hasDualGateways}
            <div class="grid grid-cols-2 gap-2">
              <button onclick={() => paymentMethod = 'qris1'} class="p-3 bg-[#070914] border rounded-xl flex items-center gap-2.5 text-left transition-all cursor-pointer {paymentMethod === 'qris1' || paymentMethod === 'qris' ? 'border-violet-500 bg-violet-500/10' : 'border-indigo-900/30 opacity-70'}">
                <div class="w-7 h-7 rounded-lg bg-violet-600/20 flex items-center justify-center text-violet-400 font-extrabold text-xs">1</div>
                <div>
                  <div class="text-xs font-bold text-white">QRIS 1</div>
                  <div class="text-[9px] text-slate-400 font-medium">RamaShop</div>
                </div>
              </button>
              <button onclick={() => paymentMethod = 'qris2'} class="p-3 bg-[#070914] border rounded-xl flex items-center gap-2.5 text-left transition-all cursor-pointer {paymentMethod === 'qris2' ? 'border-violet-500 bg-violet-500/10' : 'border-indigo-900/30 opacity-70'}">
                <div class="w-7 h-7 rounded-lg bg-indigo-600/20 flex items-center justify-center text-indigo-400 font-extrabold text-xs">2</div>
                <div>
                  <div class="text-xs font-bold text-white">QRIS 2</div>
                  <div class="text-[9px] text-slate-400 font-medium">PanzzPay</div>
                </div>
              </button>
            </div>
            <button onclick={() => paymentMethod = 'saldo'} class="w-full p-3 bg-[#070914] border rounded-xl flex items-center gap-3 text-left transition-all cursor-pointer {paymentMethod === 'saldo' ? 'border-emerald-500 bg-emerald-500/10' : 'border-indigo-900/30 opacity-70'}">
              <div class="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
              </div>
              <div>
                <div class="text-xs font-bold text-white">Saldo Bot</div>
                <div class="text-[10px] text-emerald-400 font-semibold font-mono">Rp {userBalance.toLocaleString('id-ID')}</div>
              </div>
            </button>
          {:else}
            <div class="grid grid-cols-2 gap-2">
              <button onclick={() => paymentMethod = 'qris'} class="p-3 bg-[#070914] border rounded-xl flex items-center gap-3 text-left transition-all cursor-pointer {paymentMethod === 'qris' || paymentMethod === 'qris1' ? 'border-violet-500 bg-violet-500/10' : 'border-indigo-900/30 opacity-70'}">
                <div class="w-8 h-8 rounded-lg bg-violet-600/20 flex items-center justify-center text-violet-400">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/></svg>
                </div>
                <div>
                  <div class="text-xs font-bold text-white">QRIS 1</div>
                  <div class="text-[10px] text-slate-400">Semua E-Wallet</div>
                </div>
              </button>
              <button onclick={() => paymentMethod = 'saldo'} class="p-3 bg-[#070914] border rounded-xl flex items-center gap-3 text-left transition-all cursor-pointer {paymentMethod === 'saldo' ? 'border-emerald-500 bg-emerald-500/10' : 'border-indigo-900/30 opacity-70'}">
                <div class="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
                </div>
                <div>
                  <div class="text-xs font-bold text-white">Saldo Bot</div>
                  <div class="text-[10px] text-emerald-400 font-semibold font-mono">Rp {userBalance.toLocaleString('id-ID')}</div>
                </div>
              </button>
            </div>
          {/if}
        </div>
      </div>

      <!-- Summary -->
      <div class="bg-[#070914] border border-indigo-900/30 rounded-xl p-3.5 space-y-1.5 text-xs">
        <div class="flex justify-between text-slate-400">
          <span>Harga Satuan:</span>
          <span class="font-semibold text-slate-200">{formatIDR(unitPrice())}{isWholesale() ? ' (Grosir)' : ''}</span>
        </div>
        <div class="flex justify-between text-slate-400">
          <span>Jumlah (Qty):</span>
          <span class="font-semibold text-slate-200">{quantity} pcs</span>
        </div>
        {#if voucherDiscount > 0}
          <div class="flex justify-between text-emerald-400 font-bold">
            <span>Diskon Voucher:</span>
            <span>-{formatIDR(voucherDiscount)}</span>
          </div>
        {/if}
        <div class="border-t border-slate-800 pt-2 flex justify-between font-extrabold text-sm text-white">
          <span>TOTAL TAGIHAN:</span>
          <span class="text-violet-400 font-mono text-base">{formatIDR(finalTotal)}</span>
        </div>
      </div>

      <!-- Actions -->
      <div class="space-y-2">
        <button onclick={handleSubmit} class="w-full py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-black text-sm rounded-xl shadow-lg shadow-violet-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" x2="21" y1="6" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
          Bayar Sekarang
        </button>
        <button onclick={() => visible = false} class="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 font-semibold text-xs rounded-xl transition-all cursor-pointer">Batal</button>
      </div>
    </div>
  </div>
{/if}
