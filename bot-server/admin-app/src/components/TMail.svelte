<script>
  import { onMount, onDestroy } from 'svelte';
  import { apiFetch } from '../lib/api.js';

  let activeTMail = $state(null);
  let inbox = $state([]);
  let availableDomains = $state([]);
  let selectedDomain = $state('');
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
    if (res.success && Array.isArray(res.data)) {
      availableDomains = res.data;
    }
  }

  async function generateTMail() {
    loadingGen = true;
    let targetDomain = selectedDomain === 'custom' ? customDomainInput.trim() : selectedDomain;
    let url = `/api/admin/tmail/generate?domain=${encodeURIComponent(targetDomain || '')}&username=${encodeURIComponent(customUsername.trim())}`;
    
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
    copyToast = `${label} Berhasil Dikitap!`;
    setTimeout(() => { copyToast = ''; }, 2000);
  }

  function resetSession() {
    activeTMail = null;
    inbox = [];
    stopAutoRefresh();
    autoRefresh = false;
  }

  /**
   * Helper to detect 4-8 digit OTP verification codes in message subject/body
   */
  function findOTPCode(subject = '', body = '') {
    const combined = `${subject} ${body}`;
    // Match common OTP patterns (e.g. "code: 123456", "verifikasi: 8901", 4-8 digits standalone)
    const match = combined.match(/(?:code|kode|otp|verifikasi|verification|pin)?\s*[:#-]?\s*([0-9]{4,8})/i) ||
                  combined.match(/\b([0-9]{4,8})\b/);
    return match ? match[1] : null;
  }
</script>

<div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5 shadow-xl">
  <!-- Header -->
  <div class="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-slate-800/80">
    <div>
      <h3 class="font-bold text-base text-white flex items-center gap-2">
        <span>📧</span> TMail Generator (Admin Pro)
      </h3>
      <p class="text-xs text-slate-400 mt-0.5">Generate email sementara instant dengan support custom domain & auto OTP detector</p>
    </div>

    {#if copyToast}
      <span class="px-3 py-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-semibold text-xs rounded-lg animate-pulse">
        {copyToast}
      </span>
    {/if}
  </div>

  <!-- Options & Generator Form -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-950/70 p-4 rounded-xl border border-slate-800/80">
    <!-- Domain Selector -->
    <div class="space-y-1">
      <label for="tmail-domain-select" class="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Pilih Domain Email</label>
      <select
        id="tmail-domain-select"
        bind:value={selectedDomain}
        class="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-sky-500"
      >
        <option value="">🎲 Random / Default Domain</option>
        {#each availableDomains as dom}
          <option value={dom}>🌐 {dom}</option>
        {/each}
        <option value="custom">✏️ Input Domain Manual...</option>
      </select>
      {#if selectedDomain === 'custom'}
        <input
          type="text"
          bind:value={customDomainInput}
          placeholder="contoh.com"
          class="w-full mt-1.5 bg-slate-900 border border-slate-700 text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-sky-500"
        />
      {/if}
    </div>

    <!-- Custom Prefix / Username -->
    <div class="space-y-1">
      <label for="tmail-username-input" class="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Custom Username (Opsional)</label>
      <input
        id="tmail-username-input"
        type="text"
        bind:value={customUsername}
        placeholder="misal: cs-admin, verification"
        class="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-sky-500"
      />
    </div>

    <!-- Action Buttons -->
    <div class="flex items-end gap-2">
      <button
        onclick={generateTMail}
        disabled={loadingGen}
        class="w-full py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-sky-500/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
      >
        {#if loadingGen}
          <span class="animate-spin text-sm">⏳</span> Memproses...
        {:else}
          ⚡ Generate Email
        {/if}
      </button>

      {#if activeTMail}
        <button
          onclick={resetSession}
          title="Reset Email Session"
          class="px-3 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 font-bold text-xs rounded-xl transition-all cursor-pointer"
        >
          🗑
        </button>
      {/if}
    </div>
  </div>

  <!-- Active Email Display Card -->
  <div class="bg-slate-950 p-4 rounded-xl border border-slate-800/80 flex items-center justify-between flex-wrap gap-3">
    <div class="space-y-1">
      <span class="text-[11px] font-semibold text-slate-400">Email Aktif Saat Ini:</span>
      <div class="text-sm font-bold text-sky-400 break-all flex items-center gap-2">
        <span>{activeTMail?.email || 'Belum ada email di-generate'}</span>
      </div>
    </div>

    {#if activeTMail}
      <button
        onclick={() => copyText(activeTMail.email, 'Email')}
        class="px-3.5 py-1.5 bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/30 text-sky-300 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
      >
        📋 Copy Email
      </button>
    {/if}
  </div>

  <!-- Toolbar Control: Manual Refresh & Auto Refresh Toggle -->
  <div class="flex items-center justify-between flex-wrap gap-2 pt-1">
    <div class="flex items-center gap-2">
      <button
        onclick={checkTMailInbox}
        disabled={!activeTMail || loadingInbox}
        class="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl cursor-pointer transition-all flex items-center gap-1.5"
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
        class="px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 {autoRefresh ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400' : 'bg-slate-800 text-slate-400 hover:text-white'}"
      >
        <span class="w-2 h-2 rounded-full {autoRefresh ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}"></span>
        Auto Refresh (5s): <span class="uppercase">{autoRefresh ? 'ON' : 'OFF'}</span>
      </button>
    </div>

    <span class="text-xs text-slate-500 font-mono">
      Total Pesan: <strong class="text-slate-300">{inbox.length}</strong>
    </span>
  </div>

  <!-- Inbox Message List -->
  <div class="space-y-3 pt-2">
    <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
      <span>📥</span> Surat Masuk (Inbox)
    </h4>

    {#if inbox.length === 0}
      <div class="text-center py-8 bg-slate-950/50 rounded-xl border border-dashed border-slate-800 text-slate-500 text-xs">
        {activeTMail ? '📭 Belum ada pesan masuk. Tekan Refresh atau aktifkan Auto Refresh.' : '💡 Generate email terlebih dahulu di atas.'}
      </div>
    {:else}
      <div class="space-y-3">
        {#each inbox as m}
          {@const otpCode = findOTPCode(m.subject, m.body || m.html)}
          <div class="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-2 hover:border-slate-700 transition-all">
            <!-- Message Header -->
            <div class="flex items-center justify-between gap-2 flex-wrap text-xs">
              <span class="font-bold text-sky-400 bg-sky-950/50 px-2.5 py-1 rounded-lg border border-sky-800/40">
                From: {m.from || 'Unknown'}
              </span>
              <span class="text-[11px] text-slate-400 font-mono">{m.date || ''}</span>
            </div>

            <!-- Subject -->
            <div class="text-xs font-bold text-white">
              Subject: <span class="text-slate-200 font-semibold">{m.subject || '(tanpa subjek)'}</span>
            </div>

            <!-- Auto OTP Code Detection Badge -->
            {#if otpCode}
              <div class="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 p-2.5 rounded-xl flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 text-xs text-amber-300">
                  <span class="text-base">⚡</span>
                  <span>Kode OTP Terdeteksi: <strong class="text-base font-mono text-amber-200 tracking-wider underline">{otpCode}</strong></span>
                </div>
                <button
                  onclick={() => copyText(otpCode, 'Kode OTP')}
                  class="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] rounded-lg shadow transition-all cursor-pointer"
                >
                  📋 Copy OTP
                </button>
              </div>
            {/if}

            <!-- Body -->
            {#if m.body}
              <div class="text-xs text-slate-300 bg-slate-900/90 p-3 rounded-lg font-mono whitespace-pre-wrap border border-slate-800/60 max-h-56 overflow-y-auto leading-relaxed">
                {m.body}
              </div>
            {/if}

            <!-- Copy Body Footer Button -->
            <div class="flex justify-end pt-1">
              <button
                onclick={() => copyText(m.body || m.subject, 'Isi Pesan')}
                class="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-medium rounded-lg transition-all cursor-pointer flex items-center gap-1"
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

