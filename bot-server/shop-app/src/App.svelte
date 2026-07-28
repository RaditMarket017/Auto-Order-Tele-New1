<script>
  import { onMount } from 'svelte';
  import { getTelegramUser } from './lib/utils.js';
  import { fetchStoreInfo, fetchProducts, fetchUserProfile, createOrder } from './lib/api.js';
  import Header from './components/Header.svelte';
  import CategoryFilter from './components/CategoryFilter.svelte';
  import ProductGrid from './components/ProductGrid.svelte';
  import CheckoutSheet from './components/CheckoutSheet.svelte';
  import ResultSheet from './components/ResultSheet.svelte';

  // State
  let allProducts = $state([]);
  let filteredProducts = $state([]);
  let storeName = $state('PanzzStore');
  let storeLogoUrl = $state('');
  let userName = $state('Member');
  let userBalance = $state(0);
  let userId = $state('');
  let loading = $state(true);
  let searchQuery = $state('');
  let activeCategory = $state('all');

  // Maintenance
  let isMaintenanceMode = $state(false);
  let maintenanceMessage = $state('');

  // Checkout
  let checkoutVisible = $state(false);
  let selectedProduct = $state(null);

  // Result
  let resultVisible = $state(false);
  let orderResult = $state(null);

  let tgRef = null;

  onMount(async () => {
    const { id, first_name, tg } = getTelegramUser();
    userId = id;
    userName = first_name;
    tgRef = tg;

    try {
      const [infoRes, prodRes, userRes] = await Promise.all([
        fetchStoreInfo(),
        fetchProducts(),
        fetchUserProfile(id),
      ]);

      // User profile
      if (userRes?.success && userRes.data) {
        userBalance = userRes.data.balance || 0;
        const tgUser = tg?.initDataUnsafe?.user;
        const urlName = new URLSearchParams(window.location.search).get('name');
        userName = tgUser?.first_name || (userRes.data.name !== 'Member PanzzStore' ? userRes.data.name : null) || urlName || 'Member PanzzStore';
      }

      // Store info
      if (infoRes?.success) {
        storeName = infoRes.data.storeName || 'PanzzStore';
        storeLogoUrl = infoRes.data.storeLogoUrl || '';
        if (infoRes.data.maintenanceMode) {
          isMaintenanceMode = true;
          maintenanceMessage = infoRes.data.maintenanceMessage || 'Toko sedang dalam pemeliharaan.';
        }
      }

      // Products
      if (prodRes?.success && prodRes.data?.length > 0) {
        allProducts = prodRes.data;
        filteredProducts = prodRes.data;
      }
    } catch (err) {
      console.error('Init error:', err);
    }
    loading = false;
  });

  function handleFilter(category) {
    activeCategory = category;
    let list = allProducts;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
    }

    // Category filter
    if (category === 'instant') {
      list = list.filter(p => (p.deliveryType || 'instant') === 'instant');
    } else if (category === 'popular') {
      list = [...list].sort((a, b) => (b.stock || 0) - (a.stock || 0));
    }

    filteredProducts = list;
  }

  function openCheckout(product) {
    if (isMaintenanceMode) {
      return alert(`⚠️ TOKO SEDANG MAINTENANCE\n${maintenanceMessage}`);
    }
    selectedProduct = product;
    checkoutVisible = true;
  }

  async function handleSubmitOrder(detail) {
    try {
      const res = await createOrder({
        telegramUserId: userId,
        customerName: userName,
        productId: detail.product.id,
        variantIndex: detail.variantIndex,
        quantity: detail.quantity,
        paymentMethod: detail.paymentMethod,
        voucherCode: detail.voucherCode,
      });

      if (res.success) {
        orderResult = res;
        resultVisible = true;
      } else {
        alert('❌ ' + (res.error || 'Gagal memproses pesanan'));
      }
    } catch (err) {
      alert('❌ Gagal terhubung ke server');
    }
  }

  async function refreshData() {
    try {
      const [prodRes, userRes] = await Promise.all([
        fetchProducts(),
        fetchUserProfile(userId),
      ]);
      if (prodRes?.success) { allProducts = prodRes.data; handleFilter(activeCategory); }
      if (userRes?.success && userRes.data) { userBalance = userRes.data.balance || 0; }
    } catch {}
  }
</script>

<div class="min-h-screen flex flex-col">
  <Header {storeName} {storeLogoUrl} {userName} {userBalance} />

  <main class="flex-1 max-w-2xl mx-auto w-full px-4 py-4 space-y-4">
    <!-- Maintenance Banner -->
    {#if isMaintenanceMode}
      <div class="bg-rose-500/15 border border-rose-500/30 rounded-2xl p-3.5 text-center space-y-1 animate-pulse">
        <div class="font-extrabold text-xs text-rose-400">⚠️ TOKO SEDANG MAINTENANCE</div>
        <p class="text-[11px] text-slate-300 font-semibold">{maintenanceMessage}</p>
      </div>
    {/if}

    <!-- Search & Category -->
    <CategoryFilter bind:searchQuery bind:activeCategory onFilter={handleFilter} />

    <!-- Products -->
    {#if loading}
      <div class="flex items-center justify-center py-16">
        <div class="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    {:else}
      <ProductGrid products={filteredProducts} productCount={filteredProducts.length} onSelectProduct={openCheckout} />
    {/if}
  </main>

  <!-- Checkout Sheet -->
  <CheckoutSheet product={selectedProduct} bind:visible={checkoutVisible} {userBalance} onSubmit={handleSubmitOrder} />

  <!-- Result Sheet -->
  <ResultSheet bind:visible={resultVisible} {orderResult} onRefresh={refreshData} />
</div>
