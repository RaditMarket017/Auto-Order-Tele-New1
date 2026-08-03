<script>
  import { onMount, onDestroy } from 'svelte';
  import { apiFetch } from '../lib/api.js';

  const PRESET_VIP_DOMAINS = [
    'storeraditmarket.web.id',
    'raditmarket.web.id',
    'raditmarket.biz.id',
    'raditmarketpro.web.id',
    'raditmarketpro.biz.id',
    'rmpusatdigital.web.id',
    'rmpusatdigital.biz.id',
    'storeraditmarket.biz.id',
    'rmpremium.web.id',
    'rmpremium.biz.id',
  ];

  let activeTMail = $state(null);
  let inbox = $state([]);
  let availableDomains = $state(PRESET_VIP_DOMAINS);
  let selectedDomain = $state('storeraditmarket.web.id');
  let customDomainInput = $state('');
  let customUsername = $state('');
  let loadingGen = $state(false);
  let loadingInbox = $state(false);
  let autoRefresh = $state(false);
  let autoRefreshTimer = null;
  let copyToast = $state('');

  onMount(async () => {
    fetchDomains();
  });

  onDestroy(() => {
    stopAutoRefresh();
  });

  async function fetchDomains() {
    const res = await apiFetch('/api/admin/tmail/domains');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) {
      const merged = [...PRESET_VIP_DOMAINS];
      res.data.forEach(d => {
        if (d && !merged.includes(d)) merged.push(d);
      });
      availableDomains = merged;
    }
  }

  async function generateTMail() {
    loadingGen = true;
    let targetDomain = selectedDomain === 'custom' ? customDomainInput.trim() : selectedDomain;
    if (!targetDomain) targetDomain = 'storeraditmarket.web.id';

    let url = `/api/admin/tmail/generate?domain=${encodeURIComponent(targetDomain)}&username=${encodeURIComponent(customUsername.trim())}`;
    
    const res = await apiFetch(url);
    loadingGen = false;
    if (!res.success) return alert(res.error || 'Gagal membuat email.');
    
    activeTMail = res.data;
    inbox = [];
    checkTMailInbox();
  }

  async function checkTMailInbox() {
    if (!activeTMail) return;
    loadingInbox = true;
    const res = await apiFetch(`/api/admin/tmail/inbox?email=${encodeURIComponent(activeTMail.email)}&login=${activeTMail.login}&domain=${activeTMail.domain}`);
    loadingInbox = false;
    if (!res.success) return;
    inbox = res.data || [];
  }

  function toggleAutoRefresh() {
    autoRefresh = !autoRefresh;
    if (autoRefresh) {
      checkTMailInbox();
      autoRefreshTimer = setInterval(() => {
        if (activeTMail) checkTMailInbox();
      }, 5000);
    } else {
      stopAutoRefresh();
    }
  }

  function stopAutoRefresh() {
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer);
      autoRefreshTimer = null;
    }
  }

  function copyText(text, label = 'Teks') {
    if (!text) return;
    navigator.clipboard.writeText(text);
    copyToast = `${label} Berhasil Disalin!`;
    setTimeout(() => { copyToast = ''; }, 2000);
  }

  function resetSession() {
    activeTMail = null;
    inbox = [];
    stopAutoRefresh();
    autoRefresh = false;
  }

  function isHTMLContent(str = '') {
    return /<[a-z][\s\S]*>/i.test(str);
  }

  function stripHTML(html = '') {
    return html.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').trim();
  }
</script>

<div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-2xl">
  <!-- Header -->
  <div class="flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-slate-800/80">
    <div>
      <h3 class="font-black text-lg text-white flex items-center gap-2 tracking-wide">
        <span class="text-xl">📫</span> TMail Generator (VIP Custom Domains)
      </h3>
      <p class="text-xs text-slate-400 mt-1">Generate email sementara instan menggunakan domain VIP pribadi</p>
    </div>

    {#if copyToast}
      <span class="px-3.5 py-1.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-extrabold text-xs rounded-xl animate-pulse">
        {copyToast}
      </span>
    {/if}
  </div>

  <!-- Options & Generator Form -->
  <div class="bg-slate-950/80 p-5 rounded-2xl border border-slate-800/80 space-y-4">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- Domain Selector -->
      <div class="space-y-1.5">
        <label for="tmail-domain-select" class="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
          <span>Pilih Domain Email</span>
          <span class="text-[10px] text-amber-400 font-extrabold">⭐ VIP DOMAINS ACTIVE</span>
        </label>
        <select
          id="tmail-domain-select"
          bind:value={selectedDomain}
          class="w-full bg-slate-900 border border-slate-700 text-white text-xs font-bold rounded-xl px-3.5 py-3 focus:outline-none focus:border-sky-500 transition-all cursor-pointer"
        >
          {#each availableDomains as dom}
            <option value={dom}>
              {PRESET_VIP_DOMAINS.includes(dom) ? '⭐ VIP: ' : '🌐 '} {dom}
            </option>
          {/each}
          <option value="custom">✏️ Input Domain Manual / Baru...</option>
        </select>
        {#if selectedDomain === 'custom'}
          <input
            type="text"
            bind:value={customDomainInput}
            placeholder="misal: storeraditmarket.web.id"
            class="w-full mt-2 bg-slate-900 border border-slate-700 text-white text-xs font-bold rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-sky-500"
          />
        {/if}
      </div>

      <!-- Custom Prefix / Username -->
      <div class="space-y-1.5">
        <label for="tmail-username-input" class="text-xs font-bold text-slate-300 uppercase tracking-wider">Custom Username (Opsional)</label>
        <input
          id="tmail-username-input"
          type="text"
          bind:value={customUsername}
          placeholder="misal: cs-admin, verifikasi, promo"
          class="w-full bg-slate-900 border border-slate-700 text-white text-xs font-bold rounded-xl px-3.5 py-3 focus:outline-none focus:border-sky-500 transition-all"
        />
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="flex items-center gap-3 pt-2">
      <button
        onclick={generateTMail}
        disabled={loadingGen}
        class="flex-1 py-3 bg-gradient-to-r from-sky-500 via-indigo-600 to-purple-600 hover:from-sky-400 hover:to-purple-500 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-lg shadow-sky-500/25 transition-all cursor-pointer flex items-center justify-center gap-2 tracking-wider uppercase"
      >
        {#if loadingGen}
          <span class="animate-spin text-sm">⏳</span> Memproses Email...
        {:else}
          ⚡ Generate Email VIP
        {/if}
      </button>

      {#if activeTMail}
        <button
          onclick={resetSession}
          title="Reset Email Session"
          class="px-4 py-3 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
        >
          🗑️ Reset
        </button>
      {/if}
    </div>
  </div>

  <!-- Active Email Display Card -->
  <div class="bg-slate-950 p-5 rounded-2xl border border-slate-800/80 flex items-center justify-between flex-wrap gap-3 shadow-inner">
    <div class="space-y-1">
      <div class="flex items-center gap-2">
        <span class="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Email Aktif Saat Ini</span>
        {#if activeTMail}
          <span class="px-2 py-0.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-black rounded-md">
            ⭐ VIP CUSTOM DOMAIN
          </span>
        {/if}
      </div>
      <div class="text-base font-black text-sky-400 break-all flex items-center gap-2 font-mono">
        <span>{activeTMail?.email || 'Belum ada email di-generate'}</span>
      </div>
    </div>

    {#if activeTMail}
      <button
        onclick={() => copyText(activeTMail.email, 'Email')}
        class="px-4 py-2 bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-300 font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2 shadow-md shadow-sky-500/10"
      >
        📋 Copy Email
      </button>
    {/if}
  </div>

  <!-- Toolbar Control: Manual Refresh & Auto Refresh Toggle -->
  <div class="flex items-center justify-between flex-wrap gap-3 pt-1">
    <div class="flex items-center gap-2">
      <button
        onclick={checkTMailInbox}
        disabled={!activeTMail || loadingInbox}
        class="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl cursor-pointer transition-all flex items-center gap-2"
      >
        {#if loadingInbox}
          <span class="animate-spin">⏳</span>
        {:else}
          🔄
        {/if}
        Refresh Inbox
      </button>

      <button
        onclick={toggleAutoRefresh}
        disabled={!activeTMail}
        class="px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 {autoRefresh ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 shadow-md shadow-emerald-500/10' : 'bg-slate-800 text-slate-400 hover:text-white'}"
      >
        <span class="w-2.5 h-2.5 rounded-full {autoRefresh ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}"></span>
        Auto Refresh (5s): <span class="uppercase font-mono">{autoRefresh ? 'ON' : 'OFF'}</span>
      </button>
    </div>

    <span class="text-xs text-slate-400 font-mono">
      Total Pesan: <strong class="text-white font-extrabold text-sm">{inbox.length}</strong>
    </span>
  </div>

  <!-- Inbox Message List -->
  <div class="space-y-3 pt-2">
    <h4 class="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
      <span>📥</span> Surat Masuk (Inbox)
    </h4>

    {#if inbox.length === 0}
      <div class="text-center py-10 bg-slate-950/60 rounded-2xl border border-dashed border-slate-800 text-slate-500 text-xs font-semibold">
        {activeTMail ? '📭 Belum ada pesan masuk. Tekan Refresh atau aktifkan Auto Refresh.' : '💡 Generate email terlebih dahulu menggunakan domain VIP di atas.'}
      </div>
    {:else}
      <div class="space-y-4">
        {#each inbox as m}
          {@const rawBody = m.html || m.body || ''}
          {@const hasHTML = isHTMLContent(rawBody)}
          <div class="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3 hover:border-slate-700 transition-all shadow-md">
            <!-- Message Header -->
            <div class="flex items-center justify-between gap-2 flex-wrap text-xs">
              <span class="font-extrabold text-sky-400 bg-sky-950/60 px-3 py-1.5 rounded-xl border border-sky-800/50 font-mono">
                From: {m.from || 'Unknown'}
              </span>
              <span class="text-[11px] text-slate-400 font-mono">{m.date || ''}</span>
            </div>

            <!-- Subject -->
            <div class="text-xs font-black text-white">
              Subject: <span class="text-slate-200 font-semibold">{m.subject || '(tanpa subjek)'}</span>
            </div>

            <!-- Email Content Renderer -->
            {#if hasHTML}
              <div class="bg-white rounded-xl p-2 border border-slate-700 shadow-inner overflow-hidden">
                <iframe
                  title="Email HTML Preview"
                  srcdoc={rawBody}
                  class="w-full min-h-[180px] max-h-[360px] border-0 rounded-lg bg-white"
                  sandbox="allow-popups allow-same-origin"
                ></iframe>
              </div>
            {:else}
              <div class="text-xs text-slate-300 bg-slate-900/90 p-4 rounded-xl font-mono whitespace-pre-wrap border border-slate-800/80 max-h-60 overflow-y-auto leading-relaxed">
                {rawBody}
              </div>
            {/if}

            <!-- Copy Body Footer Button -->
            <div class="flex justify-end pt-1">
              <button
                onclick={() => copyText(stripHTML(rawBody) || m.subject, 'Isi Pesan')}
                class="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
              >
                📋 Copy Text Pesan
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>



