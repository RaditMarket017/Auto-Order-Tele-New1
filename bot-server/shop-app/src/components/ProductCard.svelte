<script>
  import { formatIDR } from '../lib/utils.js';

  let { product, onclick = () => {} } = $props();

  const imgUrl = $derived(product.imageUrl || product.apkLogoUrl);
  const stockCount = $derived(product.stock || 0);
  const isReady = $derived(stockCount > 0);
  const isEmailInvite = $derived(Boolean(product.requiresEmail));
  const initial = $derived((product.name || 'P').charAt(0).toUpperCase());
  const price = $derived(product.basePrice || product.variants?.[0]?.price || 0);
</script>

<button
  type="button"
  onclick={() => onclick(product)}
  class="group relative bg-[#0c0f1d]/90 border border-indigo-900/40 hover:border-violet-500/60 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-xl flex flex-col justify-between backdrop-blur-md text-left w-full animate-fade-in-up"
>
  <!-- Image -->
  <div class="relative w-full aspect-[4/5] bg-[#050711] overflow-hidden">
    {#if imgUrl}
      <img src={imgUrl} alt={product.name} class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onerror={(e) => { e.target.style.display='none'; e.target.nextElementSibling.style.display='flex'; }} />
      <div class="w-full h-full bg-gradient-to-br from-violet-950/40 via-[#070914] to-[#050711] items-center justify-center text-violet-400 font-black text-3xl shadow-inner hidden">
        {initial}
      </div>
    {:else}
      <div class="w-full h-full bg-gradient-to-br from-violet-950/40 via-[#070914] to-[#050711] flex items-center justify-center text-violet-400 font-black text-3xl shadow-inner">
        {initial}
      </div>
    {/if}

    <!-- Gradient overlay -->
    <div class="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#070914] via-[#070914]/70 to-transparent z-10"></div>

    <!-- Stock Badge -->
    <div class="absolute bottom-2.5 left-2.5 z-20">
      <span class="px-2.5 py-1 rounded-xl text-[10px] font-extrabold shadow-lg backdrop-blur-md border flex items-center gap-1.5 font-mono {isReady ? (isEmailInvite ? 'bg-violet-600/90 text-white border-violet-400/40' : 'bg-emerald-500/90 text-white border-emerald-400/40') : 'bg-rose-500/90 text-white border-rose-400/40'}">
        <span class="w-1.5 h-1.5 rounded-full {isReady ? 'bg-white animate-pulse' : 'bg-white/80'}"></span>
        {#if isEmailInvite}
          INVITE • {stockCount} Pcs
        {:else if isReady}
          STOK {stockCount}
        {:else}
          HABIS
        {/if}
      </span>
    </div>
  </div>

  <!-- Footer -->
  <div class="p-3 bg-[#080a16] text-center space-y-1 border-t border-indigo-900/30">
    <h4 class="font-extrabold text-xs sm:text-sm text-white group-hover:text-violet-300 transition-colors line-clamp-1">{product.name}</h4>
    <p class="text-xs font-black text-violet-400 font-mono">{formatIDR(price)}</p>
  </div>
</button>
