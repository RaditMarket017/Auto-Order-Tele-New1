<script>
  import { onMount } from 'svelte';
  import { apiFetch } from '../lib/api.js';

  let storeName = $state('');
  let storeLogoUrl = $state('');
  let contactWhatsapp = $state('');
  let contactTelegram = $state('');
  let groupTelegram = $state('');
  let mustJoinEnabled = $state(true);
  let requiredChannelId = $state('');
  let requiredChannelLink = $state('');

  let warrantyUploadTimeoutMinutes = $state(5);
  let adminProcessBusyTimeoutMinutes = $state(10);

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
      contactWhatsapp = settingsRes.data.contactWhatsapp || '';
      contactTelegram = settingsRes.data.contactTelegram || '';
      groupTelegram = settingsRes.data.groupTelegram || '';
      mustJoinEnabled = settingsRes.data.mustJoinEnabled !== false;
      requiredChannelId = settingsRes.data.requiredChannelId || '';
      requiredChannelLink = settingsRes.data.requiredChannelLink || '';
      warrantyUploadTimeoutMinutes = settingsRes.data.warrantyUploadTimeoutMinutes || 5;
      adminProcessBusyTimeoutMinutes = settingsRes.data.adminProcessBusyTimeoutMinutes || 10;

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
        storeName, storeLogoUrl, contactWhatsapp, contactTelegram, groupTelegram, 
        mustJoinEnabled, requiredChannelId, requiredChannelLink,
        warrantyUploadTimeoutMinutes: Number(warrantyUploadTimeoutMinutes || 5),
        adminProcessBusyTimeoutMinutes: Number(adminProcessBusyTimeoutMinutes || 10),
        enableNotaImage, notaStoreName, notaLogoUrl, notaBgColor, notaAccentColor, notaFooterText
      })
    });
    alert('Pengaturan toko, CS, Nota, Wajib Join & Waktu Garansi berhasil disimpan!');
  }
</script>

<div class="space-y-6">
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
