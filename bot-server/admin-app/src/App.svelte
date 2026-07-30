<script>
  import { onMount } from 'svelte';
  import { apiFetch } from './lib/api.js';

  import Sidebar from './components/Sidebar.svelte';
  import Overview from './components/Overview.svelte';
  import Users from './components/Users.svelte';
  import Products from './components/Products.svelte';
  import Orders from './components/Orders.svelte';
  import Vouchers from './components/Vouchers.svelte';
  import TMail from './components/TMail.svelte';
  import Settings from './components/Settings.svelte';

  import ProductModal from './components/modals/ProductModal.svelte';
  import VoucherModal from './components/modals/VoucherModal.svelte';
  import StockManager from './components/StockManager.svelte';

  let activeTab = $state('overview');
  let sidebarOpen = $state(false);

  // Data states
  let dashboardData = $state({});
  let products = $state([]);
  let users = $state([]);
  let orders = $state([]);
  let vouchers = $state([]);

  // Modals
  let productModalVisible = $state(false);
  let editingProduct = $state(null);
  let voucherModalVisible = $state(false);

  onMount(async () => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      try {
        tg.ready();
        tg.expand();
      } catch (e) {}
    }
    await initDashboard();
  });

  async function initDashboard() {
    try {
      const res = await apiFetch('/api/admin/dashboard');
      if (res.success && res.data) {
        dashboardData = res.data;
      }
    } catch (err) {
      console.error('Dashboard init error:', err);
    }
    loadProducts();
  }

  async function loadProducts() {
    const res = await apiFetch('/api/admin/products');
    if (res.success) products = res.data;
  }

  async function loadUsers() {
    const res = await apiFetch('/api/admin/users');
    if (res.success) users = res.data;
  }

  async function loadOrders() {
    const res = await apiFetch('/api/admin/orders');
    if (res.success) orders = res.data;
  }

  async function loadVouchers() {
    const res = await apiFetch('/api/admin/vouchers');
    if (res.success) vouchers = res.data;
  }

  $effect(() => {
    const tab = activeTab;
    if (tab === 'users') loadUsers();
    else if (tab === 'products') loadProducts();
    else if (tab === 'orders') loadOrders();
    else if (tab === 'vouchers') loadVouchers();
    else if (tab === 'overview') initDashboard();
  });

  function handleTabChange(tab) {
    activeTab = tab;
  }

  function openAddProductModal() {
    editingProduct = null;
    productModalVisible = true;
  }

  function openEditProductModal(p) {
    editingProduct = p;
    productModalVisible = true;
  }

  function openAddVoucherModal() {
    voucherModalVisible = true;
  }
</script>

<div class="min-h-screen flex flex-col md:flex-row antialiased selection:bg-sky-500 selection:text-white bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-950/20 via-slate-950 to-slate-950 text-slate-100">
  
  <!-- Mobile Sticky Header -->
  <header class="md:hidden sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 flex items-center justify-between">
    <div class="flex items-center gap-2 font-extrabold text-sm text-sky-400">
      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
      Admin Panel
    </div>
    <button onclick={() => sidebarOpen = !sidebarOpen} class="w-9 h-9 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center text-white active:scale-95 transition-all cursor-pointer">
      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
    </button>
  </header>

  <!-- Sidebar -->
  <Sidebar bind:activeTab={activeTab} bind:sidebarOpen={sidebarOpen} />

  <!-- Main Area -->
  <main class="flex-1 p-4 md:p-8 max-w-6xl w-full overflow-x-hidden space-y-6">
    {#if activeTab === 'overview'}
      <Overview {dashboardData} onNavigate={handleTabChange} />
    {:else if activeTab === 'users'}
      <Users {users} onRefresh={loadUsers} />
    {:else if activeTab === 'products'}
      <Products {products} onOpenAddModal={openAddProductModal} onOpenEditModal={openEditProductModal} onRefresh={loadProducts} />
    {:else if activeTab === 'stock'}
      <StockManager {products} onRefresh={loadProducts} />
    {:else if activeTab === 'orders'}
      <Orders {orders} onRefresh={loadOrders} />
    {:else if activeTab === 'vouchers'}
      <Vouchers {vouchers} onOpenAddModal={openAddVoucherModal} onRefresh={loadVouchers} />
    {:else if activeTab === 'tmail'}
      <TMail />
    {:else if activeTab === 'settings'}
      <Settings />
    {/if}
  </main>

  <!-- Modals -->
  <ProductModal bind:visible={productModalVisible} {editingProduct} onRefresh={loadProducts} />
  <VoucherModal bind:visible={voucherModalVisible} onRefresh={loadVouchers} />
</div>
