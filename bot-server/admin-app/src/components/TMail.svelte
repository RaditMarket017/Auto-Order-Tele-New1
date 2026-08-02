<script>
  import { apiFetch } from '../lib/api.js';

  let activeTMail = $state(null);
  let inbox = $state([]);

  async function generateTMail() {
    const res = await apiFetch('/api/admin/tmail/generate');
    if (!res.success) return;
    activeTMail = res.data;
    checkTMailInbox();
  }

  async function checkTMailInbox() {
    if (!activeTMail) return alert('Generate email terlebih dahulu!');
    const res = await apiFetch(`/api/admin/tmail/inbox?email=${encodeURIComponent(activeTMail.email)}&login=${activeTMail.login}&domain=${activeTMail.domain}`);
    if (!res.success) return;
    inbox = res.data || [];
  }
</script>

<div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
  <div class="flex items-center justify-between flex-wrap gap-2">
    <h3 class="font-bold text-base text-white">📧 TMail Generator (Admin)</h3>
    <button onclick={generateTMail} class="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs rounded-xl shadow-lg shadow-sky-500/20 transition-all cursor-pointer">
      ⚡ Generate Email
    </button>
  </div>

  <div class="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-1">
    <span class="text-[11px] text-slate-400">Email Aktif:</span>
    <div class="text-sm font-bold text-sky-400 break-all">{activeTMail?.email || '-'}</div>
  </div>

  <button onclick={checkTMailInbox} class="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl cursor-pointer">
    🔄 Refresh Inbox
  </button>

  <div class="space-y-2 pt-2">
    <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Surat Masuk</h4>
    {#if inbox.length === 0}
      <p class="text-xs text-slate-500">Belum ada email di-generate / pesan masuk.</p>
    {:else}
      <div class="space-y-2">
        {#each inbox as m}
          <div class="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 space-y-1.5">
            <div class="flex items-center justify-between gap-2 flex-wrap text-xs">
              <span class="font-bold text-sky-400">From: {m.from || 'Unknown'}</span>
              <span class="text-[10px] text-slate-500">{m.date || ''}</span>
            </div>
            <div class="text-xs font-semibold text-white">Subject: {m.subject || '(no subject)'}</div>
            {#if m.body}
              <div class="text-xs text-slate-300 bg-slate-900/90 p-2.5 rounded-lg font-mono whitespace-pre-wrap border border-slate-800/60 max-h-48 overflow-y-auto">
                {m.body}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
