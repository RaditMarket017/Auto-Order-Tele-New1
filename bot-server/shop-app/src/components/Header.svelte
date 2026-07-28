<script>
  let { storeName = 'PanzzStore', storeLogoUrl = '', userName = 'Member', userBalance = 0 } = $props();

  const initial = $derived((userName || 'M').charAt(0).toUpperCase());
</script>

<header class="sticky top-0 z-30 bg-[#0c0f1d]/85 backdrop-blur-xl border-b border-indigo-900/30 shadow-lg shadow-violet-950/20">
  <div class="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
    <!-- Store Brand -->
    <div class="flex items-center gap-2.5">
      {#if storeLogoUrl}
        <img src={storeLogoUrl} alt={storeName} class="w-8.5 h-8.5 rounded-xl object-cover border border-violet-500/30 shadow-lg" />
      {:else}
        <div class="w-8.5 h-8.5 rounded-xl bg-gradient-to-br from-violet-600/30 to-indigo-600/30 border border-violet-500/40 flex items-center justify-center text-violet-300 font-extrabold text-sm shadow-lg shadow-violet-500/20">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" x2="21" y1="6" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
        </div>
      {/if}
      <div>
        <h1 class="font-extrabold text-sm text-white flex items-center gap-1.5 tracking-tight">
          {storeName}
          <svg class="w-4 h-4 text-violet-400" viewBox="0 0 24 24" fill="currentColor"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
        </h1>
        <p class="text-[10px] text-emerald-400 font-extrabold flex items-center gap-1">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          Auto Delivery 24/7
        </p>
      </div>
    </div>

    <!-- User Info -->
    <div class="flex items-center gap-2.5">
      <div class="text-right">
        <p class="text-xs font-extrabold text-white truncate max-w-[110px]">{userName}</p>
        <p class="text-[10px] text-violet-300 font-bold font-mono">Saldo: {userBalance.toLocaleString('id-ID')}</p>
      </div>
      <div class="w-8.5 h-8.5 rounded-xl bg-gradient-to-br from-violet-600/40 to-indigo-600/40 border border-violet-400/40 flex items-center justify-center text-violet-200 font-black text-xs shadow-lg shadow-violet-500/20">
        {initial}
      </div>
    </div>
  </div>
</header>
