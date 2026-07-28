<script>
  import { formatIDR } from '../lib/utils.js';
  import { apiFetch } from '../lib/api.js';

  let { users = [], onRefresh = () => {} } = $props();

  let searchQuery = $state('');

  const filteredUsers = $derived(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(u => 
      u.id.toString().includes(q) || 
      (u.firstName || '').toLowerCase().includes(q) || 
      (u.username || '').toLowerCase().includes(q)
    );
  });

  async function editSaldo(userId, currentSaldo) {
    const val = prompt(`Masukkan jumlah saldo baru untuk User ID: ${userId}\n(Current: ${formatIDR(currentSaldo)})`, currentSaldo);
    if (val === null) return;
    const amount = parseInt(val);
    if (isNaN(amount)) return alert('Nominal harus angka!');

    await apiFetch(`/api/admin/users/${userId}/saldo`, {
      method: 'POST',
      body: JSON.stringify({ amount, action: 'set' })
    });
    onRefresh();
  }

  async function toggleBlockUser(userId) {
    if (!confirm(`Ubah status block/unblock User ID: ${userId}?`)) return;
    await apiFetch(`/api/admin/users/${userId}/block`, { method: 'POST' });
    onRefresh();
  }
</script>

<div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
  <div class="flex items-center justify-between flex-wrap gap-2">
    <h3 class="font-bold text-base text-white">Daftar Pengguna / Member</h3>
    <div class="w-full sm:w-64">
      <input 
        type="text" 
        bind:value={searchQuery}
        placeholder="Cari user (ID/Nama)..." 
        class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
      >
    </div>
  </div>

  <div class="overflow-x-auto w-full">
    <table class="w-full text-left border-collapse text-xs min-w-[550px]">
      <thead>
        <tr class="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
          <th class="py-3 px-3">User ID</th>
          <th class="py-3 px-3">Nama / Username</th>
          <th class="py-3 px-3">Saldo</th>
          <th class="py-3 px-3">Role</th>
          <th class="py-3 px-3">Status</th>
          <th class="py-3 px-3 text-right">Aksi Admin</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-800/60">
        {#if filteredUsers().length === 0}
          <tr><td colspan="6" class="py-6 text-center text-slate-500">Belum ada user registered / ditemukan.</td></tr>
        {:else}
          {#each filteredUsers() as u}
            <tr class="hover:bg-slate-800/40 transition-colors">
              <td class="py-3 px-3"><code class="text-sky-400 font-mono text-[11px]">{u.id}</code></td>
              <td class="py-3 px-3 font-semibold text-white">
                {u.firstName || u.name || 'Member'} 
                {#if u.username}<span class="text-slate-400 text-[11px]">(@{u.username})</span>{/if}
              </td>
              <td class="py-3 px-3 font-bold text-emerald-400">{formatIDR(u.balance || 0)}</td>
              <td class="py-3 px-3">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold {u.role === 'admin' ? 'bg-sky-500/20 text-sky-400' : 'bg-slate-800 text-slate-300'}">
                  {u.role || 'user'}
                </span>
              </td>
              <td class="py-3 px-3">{u.isBlocked ? '🔴 Blocked' : '🟢 Active'}</td>
              <td class="py-3 px-3 text-right flex justify-end gap-1.5">
                <button onclick={() => editSaldo(u.id, u.balance || 0)} class="px-2 py-1 bg-sky-500/10 text-sky-400 hover:bg-sky-500 hover:text-white rounded-lg text-xs font-semibold cursor-pointer">💰 Saldo</button>
                <button onclick={() => toggleBlockUser(u.id)} class="px-2 py-1 {u.isBlocked ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'} rounded-lg text-xs font-semibold cursor-pointer">
                  {u.isBlocked ? 'Unblock' : 'Block'}
                </button>
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
</div>
