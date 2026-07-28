<script>
  import { apiFetch } from '../../lib/api.js';

  let { visible = $bindable(false), onRefresh = () => {} } = $props();

  let code = $state('');
  let type = $state('fixed');
  let value = $state('');
  let maxUses = $state('');

  async function handleSaveVoucher() {
    if (!code.trim()) return alert('Kode voucher tidak boleh kosong!');
    const valNum = parseInt(value) || 0;
    const maxNum = parseInt(maxUses) || 0;

    await apiFetch('/api/admin/vouchers', {
      method: 'POST',
      body: JSON.stringify({ code: code.trim(), type, value: valNum, maxUses: maxNum })
    });
    visible = false;
    code = '';
    value = '';
    maxUses = '';
    onRefresh();
  }
</script>

{#if visible}
  <div class="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog">
    <div class="w-full max-w-md bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-2xl p-5 space-y-3" onclick={(e) => e.stopPropagation()}>
      <h3 class="font-bold text-base text-white">Buat Voucher Baru</h3>
      
      <input type="text" bind:value={code} placeholder="Kode Voucher (ex: HEMAT50)" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-sky-500 focus:outline-none">
      
      <select bind:value={type} class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-sky-500 focus:outline-none">
        <option value="fixed">Nominal (Rp)</option>
        <option value="percentage">Persentase (%)</option>
      </select>

      <input type="number" bind:value={value} placeholder="Nilai (ex: 5000 atau 10)" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-sky-500 focus:outline-none">

      <input type="number" bind:value={maxUses} placeholder="Max Pengguna (0 = unlimited)" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-sky-500 focus:outline-none">

      <div class="flex justify-end gap-2 pt-2">
        <button onclick={() => visible = false} class="px-4 py-2 bg-slate-800 text-slate-300 font-semibold text-xs rounded-xl cursor-pointer">Batal</button>
        <button onclick={handleSaveVoucher} class="px-4 py-2 bg-sky-500 text-white font-bold text-xs rounded-xl cursor-pointer">Simpan</button>
      </div>
    </div>
  </div>
{/if}
