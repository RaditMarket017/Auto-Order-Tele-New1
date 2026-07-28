<script>
  let { searchQuery = $bindable(''), activeCategory = $bindable('all'), onFilter = () => {} } = $props();

  const categories = [
    { id: 'all', label: 'Semua Produk' },
    { id: 'instant', label: 'Proses Instan' },
    { id: 'popular', label: 'Terlaris 🔥' },
  ];

  function selectCategory(cat) {
    activeCategory = cat;
    onFilter(cat);
  }
</script>

<div class="space-y-3">
  <!-- Search -->
  <div class="relative">
    <svg class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-400/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
    <input
      type="text"
      bind:value={searchQuery}
      oninput={() => onFilter(activeCategory)}
      placeholder="Cari produk digital..."
      class="w-full bg-[#0d1121]/90 border border-indigo-900/40 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none transition-all font-semibold shadow-inner"
    />
  </div>

  <!-- Category Pills -->
  <div class="flex items-center gap-2 overflow-x-auto no-scrollbar">
    {#each categories as cat}
      <button
        onclick={() => selectCategory(cat.id)}
        class="shrink-0 px-3.5 py-1.5 rounded-xl text-[11px] font-extrabold transition-all cursor-pointer {activeCategory === cat.id ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-600/30 border border-violet-400/30' : 'bg-[#0d1121] border border-indigo-900/30 text-slate-400 hover:text-white'}"
      >
        {cat.label}
      </button>
    {/each}
  </div>
</div>
