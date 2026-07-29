<script>
  let { activeTab = $bindable('overview'), sidebarOpen = $bindable(false) } = $props();

  function selectTab(id) {
    activeTab = id;
    sidebarOpen = false;
  }
</script>

<!-- Mobile Overlay -->
{#if sidebarOpen}
  <div 
    onclick={() => sidebarOpen = false} 
    role="button" 
    tabindex="0"
    onkeydown={(e) => e.key === 'Escape' && (sidebarOpen = false)}
    class="fixed inset-0 z-40 bg-black/75 backdrop-blur-md md:hidden"
  ></div>
{/if}

<aside class="fixed md:static inset-y-0 left-0 z-50 w-64 bg-[#0c0f1d] border-r border-indigo-900/30 p-5 flex flex-col justify-between transition-transform duration-300 ease-in-out shrink-0 {sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}">
  <div class="space-y-6">
    <!-- Brand Logo -->
    <div class="flex items-center gap-3 font-black text-base tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-purple-300 to-indigo-400">
      <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600/30 to-indigo-600/30 border border-violet-500/40 flex items-center justify-center text-violet-300 shadow-lg shadow-violet-500/20">
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
      </div>
      Admin Panel
    </div>

    <!-- Nav Items -->
    <nav class="space-y-1.5">
      <!-- Ringkasan -->
      <button
        onclick={() => selectTab('overview')}
        class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer {activeTab === 'overview' ? 'text-white bg-gradient-to-r from-violet-600 to-indigo-600 shadow-lg shadow-violet-600/30 border border-violet-400/30' : 'text-slate-400 hover:text-white hover:bg-violet-950/40'}"
      >
        <svg class="w-4.5 h-4.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
        Ringkasan
      </button>

      <!-- Kelola Users -->
      <button
        onclick={() => selectTab('users')}
        class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer {activeTab === 'users' ? 'text-white bg-gradient-to-r from-violet-600 to-indigo-600 shadow-lg shadow-violet-600/30 border border-violet-400/30' : 'text-slate-400 hover:text-white hover:bg-violet-950/40'}"
      >
        <svg class="w-4.5 h-4.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        Kelola Users
      </button>

      <!-- Add Produk -->
      <button
        onclick={() => selectTab('products')}
        class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer {activeTab === 'products' ? 'text-white bg-gradient-to-r from-violet-600 to-indigo-600 shadow-lg shadow-violet-600/30 border border-violet-400/30' : 'text-slate-400 hover:text-white hover:bg-violet-950/40'}"
      >
        <svg class="w-4.5 h-4.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
        📦 Add Produk
      </button>

      <!-- Add Stock -->
      <button
        onclick={() => selectTab('stock')}
        class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer {activeTab === 'stock' ? 'text-white bg-gradient-to-r from-emerald-600 to-teal-600 shadow-lg shadow-emerald-600/30 border border-emerald-400/30' : 'text-slate-400 hover:text-white hover:bg-emerald-950/40'}"
      >
        <svg class="w-4.5 h-4.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        ⚡ Add Stock
      </button>

      <!-- Pesanan & Reports -->
      <button
        onclick={() => selectTab('orders')}
        class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer {activeTab === 'orders' ? 'text-white bg-gradient-to-r from-violet-600 to-indigo-600 shadow-lg shadow-violet-600/30 border border-violet-400/30' : 'text-slate-400 hover:text-white hover:bg-violet-950/40'}"
      >
        <svg class="w-4.5 h-4.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" x2="21" y1="6" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
        Pesanan & Reports
      </button>

      <!-- Voucher Promo -->
      <button
        onclick={() => selectTab('vouchers')}
        class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer {activeTab === 'vouchers' ? 'text-white bg-gradient-to-r from-violet-600 to-indigo-600 shadow-lg shadow-violet-600/30 border border-violet-400/30' : 'text-slate-400 hover:text-white hover:bg-violet-950/40'}"
      >
        <svg class="w-4.5 h-4.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M9 9h.01"/><path d="M15 15h.01"/><path d="M15 9l-6 6"/></svg>
        Voucher Promo
      </button>

      <!-- TMail Generator -->
      <button
        onclick={() => selectTab('tmail')}
        class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer {activeTab === 'tmail' ? 'text-white bg-gradient-to-r from-violet-600 to-indigo-600 shadow-lg shadow-violet-600/30 border border-violet-400/30' : 'text-slate-400 hover:text-white hover:bg-violet-950/40'}"
      >
        <svg class="w-4.5 h-4.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
        TMail Generator
      </button>

      <!-- Pengaturan Toko & CS -->
      <button
        onclick={() => selectTab('settings')}
        class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer {activeTab === 'settings' ? 'text-white bg-gradient-to-r from-violet-600 to-indigo-600 shadow-lg shadow-violet-600/30 border border-violet-400/30' : 'text-slate-400 hover:text-white hover:bg-violet-950/40'}"
      >
        <svg class="w-4.5 h-4.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
        Pengaturan Toko & CS
      </button>
    </nav>
  </div>

  <div class="pt-6 border-t border-indigo-900/30 text-[11px] text-slate-500 flex items-center justify-between">
    <span class="font-medium text-slate-400">Auto Order Bot v2.0</span>
    <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
  </div>
</aside>
