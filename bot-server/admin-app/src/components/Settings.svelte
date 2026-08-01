<script>
  import { onMount } from 'svelte';
  import { apiFetch } from '../lib/api.js';

  let storeName = $state('');
  let storeLogoUrl = $state('');
  let botToken = $state('');
  let contactWhatsapp = $state('');
  let contactTelegram = $state('');
  let groupTelegram = $state('');
  let mustJoinEnabled = $state(true);
  let requiredChannelId = $state('');
  let requiredChannelLink = $state('');

  let warrantyUploadTimeoutMinutes = $state(5);
  let adminProcessBusyTimeoutMinutes = $state(10);
  let adminBusyMessageTemplate = $state(
    `Mohon maaf ya kak\n` +
    `Claim garansi untuk order {{order_id}} belum bisa kami proses sekarang karena admin sedang sibuk.\n\n` +
    `Tapi tenang aja, bukti kamu sudah kami terima pada {{jam_kirim}} dan masih dalam waktu garansi.\n` +
    `Jadi claim kamu tetap kami proses ya.\n\n` +
    `Mohon ditunggu sebentar 🙏`
  );

  // Nota Settings
  let enableNotaImage = $state(true);
  let notaStoreName = $state('');
  let notaLogoUrl = $state('');
  let notaBgColor = $state('#071428');
  let notaAccentColor = $state('#0077ff');
  let notaFooterText = $state('Terima kasih telah berbelanja di');

  let isMaintenance = $state(false);
  let maintenanceMsg = $state('');

  onMount(loadSettings);

  async function loadSettings() {
    const [settingsRes, mainRes] = await Promise.all([
      apiFetch('/api/admin/settings'),
      apiFetch('/api/admin/maintenance')
    ]);

    if (settingsRes.success && settingsRes.data) {
      storeName = settingsRes.data.storeName || '';
      storeLogoUrl = settingsRes.data.storeLogoUrl || '';
      botToken = settingsRes.data.botToken || '';
      contactWhatsapp = settingsRes.data.contactWhatsapp || '';
      contactTelegram = settingsRes.data.contactTelegram || '';
      groupTelegram = settingsRes.data.groupTelegram || '';
      mustJoinEnabled = settingsRes.data.mustJoinEnabled !== false;
      requiredChannelId = settingsRes.data.requiredChannelId || '';
      requiredChannelLink = settingsRes.data.requiredChannelLink || '';
      warrantyUploadTimeoutMinutes = settingsRes.data.warrantyUploadTimeoutMinutes || 5;
      adminProcessBusyTimeoutMinutes = settingsRes.data.adminProcessBusyTimeoutMinutes || 10;
      adminBusyMessageTemplate = settingsRes.data.adminBusyMessageTemplate || (
        `Mohon maaf ya kak\n` +
        `Claim garansi untuk order {{order_id}} belum bisa kami proses sekarang karena admin sedang sibuk.\n\n` +
        `Tapi tenang aja, bukti kamu sudah kami terima pada {{jam_kirim}} dan masih dalam waktu garansi.\n` +
        `Jadi claim kamu tetap kami proses ya.\n\n` +
        `Mohon ditunggu sebentar 🙏`
      );

      enableNotaImage = settingsRes.data.enableNotaImage !== false;
      notaStoreName = settingsRes.data.notaStoreName || settingsRes.data.storeName || '';
      notaLogoUrl = settingsRes.data.notaLogoUrl || settingsRes.data.storeLogoUrl || '';
      notaBgColor = settingsRes.data.notaBgColor || '#071428';
      notaAccentColor = settingsRes.data.notaAccentColor || '#0077ff';
      notaFooterText = settingsRes.data.notaFooterText || 'Terima kasih telah berbelanja di';
    }

    if (mainRes.success && mainRes.data) {
      isMaintenance = Boolean(mainRes.data.isMaintenance);
      maintenanceMsg = mainRes.data.message || '';
    }
  }

  async function toggleMaintenanceMode() {
    await apiFetch('/api/admin/maintenance', {
      method: 'POST',
      body: JSON.stringify({ isMaintenance, message: maintenanceMsg || 'Bot sedang dalam pemeliharaan berkala.' })
    });
    alert(`Status Maintenance Mode diubah menjadi: ${isMaintenance ? '🔴 TUTUP TOKO (ON)' : '🟢 BUKA TOKO (OFF)'}`);
  }

  async function saveSettings() {
    await apiFetch('/api/admin/settings', {
      method: 'POST',
      body: JSON.stringify({ 
        storeName, storeLogoUrl, botToken, contactWhatsapp, contactTelegram, groupTelegram, 
        mustJoinEnabled, requiredChannelId, requiredChannelLink,
        warrantyUploadTimeoutMinutes: Number(warrantyUploadTimeoutMinutes || 5),
        adminProcessBusyTimeoutMinutes: Number(adminProcessBusyTimeoutMinutes || 10),
        adminBusyMessageTemplate,
        enableNotaImage, notaStoreName, notaLogoUrl, notaBgColor, notaAccentColor, notaFooterText
      })
    });
    alert('Pengaturan toko, Bot Token, CS, Nota, Wajib Join & Waktu Garansi berhasil disimpan!');
  }
</script>

<div class="space-y-6">
  <!-- Warranty Timers & Auto Notification Configurator -->
  <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 max-w-md">
    <div>
      <h3 class="font-bold text-base text-white flex items-center gap-2">🛡️ Waktu & Notifikasi Klaim Garansi</h3>
      <p class="text-[11px] text-slate-400">Atur batas waktu pengiriman bukti customer dan notifikasi otomatis saat Admin belum memproses klaim garansi.</p>
    </div>

    <div class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs text-slate-400 font-semibold block mb-1">⏰ Batas Kirim Bukti</label>
          <div class="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
            <input type="number" min="1" max="60" bind:value={warrantyUploadTimeoutMinutes} class="w-full bg-transparent text-xs text-amber-400 font-bold focus:outline-none">
            <span class="text-[11px] text-slate-400">menit</span>
          </div>
          <span class="text-[10px] text-slate-500 block mt-0.5">Setelah klik tombol garansi.</span>
        </div>

        <div>
          <label class="text-xs text-slate-400 font-semibold block mb-1">⏳ Notif Admin Sibuk</label>
          <div class="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">
            <input type="number" min="1" max="120" bind:value={adminProcessBusyTimeoutMinutes} class="w-full bg-transparent text-xs text-sky-400 font-bold focus:outline-none">
            <span class="text-[11px] text-slate-400">menit</span>
          </div>
          <span class="text-[10px] text-slate-500 block mt-0.5">Jika admin belum merespon.</span>
        </div>
      </div>

      <div>
        <label class="text-xs text-slate-400 font-semibold block mb-1">💬 Template Pesan Admin Sibuk</label>
        <textarea rows="5" bind:value={adminBusyMessageTemplate} placeholder="Template pesan otomatis..." class="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 focus:border-sky-500 focus:outline-none resize-y font-mono"></textarea>
        <span class="text-[10px] text-sky-400/80 block mt-1">Gunakan tag: <code>{{order_id}}</code> dan <code>{{jam_kirim}}</code></span>
      </div>
    </div>
  </div>
  <!-- Bot Token Telegram Configurator -->
  <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 max-w-md">
    <div>
      <h3 class="font-bold text-base text-white">🤖 Bot Token Telegram</h3>
      <p class="text-[11px] text-slate-400">Token bot Telegram untuk Broadcast Mini App Vercel. Otomatis ter-sync ketika bot panel berjalan, atau bisa Anda isi manual di sini.</p>
    </div>
    <div>
      <label class="text-xs text-slate-400 font-semibold block mb-1">BOT_TOKEN Telegram</label>
      <input type="text" bind:value={botToken} placeholder="8848099512:AAHTIwERYah-..." class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-emerald-400 font-mono focus:border-sky-500 focus:outline-none">
    </div>
  </div>
  <!-- Maintenance Mode Switch -->
  <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 max-w-md">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="font-bold text-base text-white">🚧 Mode Maintenance Toko</h3>
        <p class="text-xs text-slate-400">Aktifkan untuk menutup toko sementara saat restok/perbaikan.</p>
      </div>
      <label class="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" bind:checked={isMaintenance} onchange={toggleMaintenanceMode} class="sr-only peer">
        <div class="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-500"></div>
      </label>
    </div>
    <div>
      <label class="text-xs text-slate-400 font-semibold block mb-1">Pesan Maintenance</label>
      <input type="text" bind:value={maintenanceMsg} placeholder="Bot sedang dalam pemeliharaan berkala..." class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-sky-500 focus:outline-none">
    </div>
  </div>

  <!-- Receipt / Nota Settings Configurator -->
  <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 max-w-md">
    <h3 class="font-bold text-base text-white flex items-center gap-2">🧾 Desain & Pengaturan Nota Order</h3>
    <p class="text-[11px] text-slate-400">Kustomisasi tampilan nota gambar PNG yang dikirim otomatis ke pelanggan & channel testimoni.</p>
    
    <div class="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl p-3">
      <div>
        <span class="text-xs font-bold text-white block">🖼️ Kirim Nota Gambar PNG</span>
        <span class="text-[10px] text-slate-400">Jika OFF, nota transaksi dikirim dalam format teks HTML saja.</span>
      </div>
      <label class="relative inline-flex items-center cursor-pointer ml-2 shrink-0">
        <input type="checkbox" bind:checked={enableNotaImage} class="sr-only peer">
        <div class="w-10 h-5.5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-sky-500"></div>
      </label>
    </div>

    <div class="space-y-3">
      <div>
        <label class="text-xs text-slate-400 font-semibold block mb-1">Nama Toko di Nota</label>
        <input type="text" bind:value={notaStoreName} placeholder="Kosongkan jika samakan dengan Nama Toko" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-sky-500 focus:outline-none">
      </div>
      <div>
        <label class="text-xs text-slate-400 font-semibold block mb-1">URL Logo Nota (PNG/JPG)</label>
        <input type="text" bind:value={notaLogoUrl} placeholder="https://... (Kosongkan jika samakan dengan Logo Toko)" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-sky-500 focus:outline-none">
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs text-slate-400 font-semibold block mb-1">Warna Background</label>
          <div class="flex items-center gap-2">
            <input type="color" bind:value={notaBgColor} class="w-9 h-9 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer p-0.5">
            <input type="text" bind:value={notaBgColor} class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono uppercase focus:border-sky-500 focus:outline-none">
          </div>
        </div>
        <div>
          <label class="text-xs text-slate-400 font-semibold block mb-1">Warna Aksen / Neon</label>
          <div class="flex items-center gap-2">
            <input type="color" bind:value={notaAccentColor} class="w-9 h-9 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer p-0.5">
            <input type="text" bind:value={notaAccentColor} class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono uppercase focus:border-sky-500 focus:outline-none">
          </div>
        </div>
      </div>
      <div>
        <label class="text-xs text-slate-400 font-semibold block mb-1">Teks Footer Nota</label>
        <input type="text" bind:value={notaFooterText} placeholder="Terima kasih telah berbelanja di" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-sky-500 focus:outline-none">
      </div>
    </div>
  </div>

  <!-- Store & CS Configurator -->
  <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 max-w-md">
    <h3 class="font-bold text-base text-white">📞 Pengaturan Toko & CS</h3>
    <div class="space-y-3">
      <div>
        <label class="text-xs text-slate-400 font-semibold block mb-1">Nama Toko</label>
        <input type="text" bind:value={storeName} placeholder="AutoStore" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-sky-500 focus:outline-none">
      </div>
      <div>
        <label class="text-xs text-slate-400 font-semibold block mb-1">URL Logo Toko / Banner</label>
        <input type="text" bind:value={storeLogoUrl} placeholder="https://..." class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-sky-500 focus:outline-none">
      </div>
      <div>
        <label class="text-xs text-slate-400 font-semibold block mb-1">Nomor WhatsApp CS</label>
        <input type="text" bind:value={contactWhatsapp} placeholder="628xxxxxxxxxx" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-sky-500 focus:outline-none">
      </div>
      <div>
        <label class="text-xs text-slate-400 font-semibold block mb-1">Username Telegram CS</label>
        <input type="text" bind:value={contactTelegram} placeholder="adminusername" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-sky-500 focus:outline-none">
      </div>
      <div>
        <label class="text-xs text-slate-400 font-semibold block mb-1">Link Group Telegram</label>
        <input type="text" bind:value={groupTelegram} placeholder="t.me/yourgroup" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-sky-500 focus:outline-none">
      </div>
    </div>
  </div>

  <!-- Required Channel Configurator -->
  <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 max-w-md">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="font-bold text-base text-white">📢 Wajib Join Channel</h3>
        <p class="text-[11px] text-slate-400">Paksa pengguna bergabung channel sebelum transaksi.</p>
      </div>
      <label class="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" bind:checked={mustJoinEnabled} class="sr-only peer">
        <div class="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
      </label>
    </div>
    <div class="space-y-3">
      <div>
        <label class="text-xs text-slate-400 font-semibold block mb-1">Username / ID Channel Wajib Join</label>
        <input type="text" bind:value={requiredChannelId} placeholder="@channelusername atau -100xxxxxxxxxx" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-sky-500 focus:outline-none">
      </div>
      <div>
        <label class="text-xs text-slate-400 font-semibold block mb-1">Link Join Channel (Undangan)</label>
        <input type="text" bind:value={requiredChannelLink} placeholder="https://t.me/channelusername" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-sky-500 focus:outline-none">
      </div>
      <button onclick={saveSettings} class="w-full py-2.5 bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs rounded-xl shadow-lg shadow-sky-500/20 transition-all cursor-pointer">
        Simpan Pengaturan
      </button>
    </div>
  </div>
</div>
