<script>
  import ProductCard from './ProductCard.svelte';

  let { products = [], productCount = 0, onSelectProduct = () => {} } = $props();
</script>

<div class="space-y-3">
  <div class="flex items-center justify-between">
    <span class="text-xs text-slate-400 font-semibold">{productCount} Produk</span>
  </div>

  {#if products.length === 0}
    <p class="text-center py-10 text-slate-500 text-sm">Produk tidak ditemukan.</p>
  {:else}
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {#each products as product (product.id)}
        <ProductCard {product} onclick={onSelectProduct} />
      {/each}
    </div>
  {/if}
</div>
