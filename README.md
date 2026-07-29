# 🚀 Auto Order Telegram Bot & Svelte 5 Mini App

Aplikasi **Auto Order Telegram Bot** modern yang terintegrasi dengan **Store Mini App** dan **Admin Dashboard Mini App** berbasis **Svelte 5 & TailwindCSS**. Menggunakan **Firebase Firestore** untuk basis data, **Multi-Gateway Payment System (RamaShop & PanzzPay QRIS)** dengan fitur **Auto-Failover**, serta **Auto-Detect Domain** & **Long Polling** tanpa perlu konfigurasi Webhook manual!

---

## 🌟 Fitur-Fitur Unggulan

### 🛍️ 1. Store Mini App (User Frontend)
- **Desain Modern & UI Premium**: Tema dark mode futuristik yang responsif di HP dan PC.
- **Katalog & Varian Produk**: Pembelian produk digital dengan multi-varian (durasi, tipe garansi, dll).
- **Sistem Harga Grosir (Tiering)**: Potongan harga otomatis berdasarkan jumlah kuantitas pembelian.
- **Dukungan Email / Akun Pribadi**: Pilihan untuk produk instan (stok otomatis) maupun produk yang membutuhkan input email buyer.
- **Profil & Foto Telegram**: Menggunakan profil & foto asli Telegram pengguna secara otomatis di header Mini App.
- **Pembayaran Multi-Gateway & Saldo Akun**: Transaksi via QRIS instan atau potong saldo akun.
- **Auto Polling Status (3.5s)**: Status QRIS otomatis terdeteksi LUNAS dalam hitungan detik tanpa perlu refresh manual.
- **Rating & Ulasan Bintang**: Fitur ulasan dan rating produk interaktif dari pengguna setelah transaksi selesai.
- **Generator Nota Digital**: Cetak nota transaksi modern langsung dari halaman detail order.

### 💳 2. Multi-Gateway Payment System (Auto-Failover)
- **Primary Gateway**: **RamaShop** (`https://ramashop.my.id/api/public`)
- **Backup Gateway**: **PanzzPay** (`https://panzzpay.my.id/api/public`)
- **Auto-Failover Uptime 99.9%**: Jika gateway utama mengalami *downtime* atau *maintenance*, bot secara otomatis mengalihkan pembuatan deposit QRIS ke gateway cadangan secara *seamless* tanpa mengganggu kenyamanan pengguna.

### 🖥️ 3. Admin Dashboard Mini App (Admin Frontend)
- **Ringkasan Analytics**: Statistik omset harian, total transaksi, total user, dan stok produk.
- **Manajemen Produk & Varian**: Tambah, edit, ubah urutan, dan atur visibilitas produk.
- **Upload Stok Massal (.TXT)**: Input pulsa / akun stok sekaligus dengan upload file `.txt` atau paste baris teks.
- **Pengaturan Tanggal Expired Stok**: Atur tanggal kadaluarsa stok otomatis per item.
- **Kelola Saldo & Block User**: Tambah / kurangi saldo user dan blokir user yang melanggar.
- **Sistem Voucher Diskon**: Buat kode voucher potongan persentase atau nominal Rupiah.
- **Auto Auth Telegram**: Admin otomatis dikenali melalui `ADMIN_ID` Telegram tanpa perlu memasukkan password.

### 🤖 4. Bot Telegram & Backend Server
- **Long Polling Mode (`bot.launch()`)**: Bot langsung jalan di PC lokal / VPS tanpa perlu daftar HTTPS Webhook Telegram.
- **Auto-Detect Domain Server**: Express server otomatis membaca domain publik aktif (Vercel, Railway, Ngrok, VPS) tanpa perlu isi `WEBHOOK_BASE_URL` di `.env`.
- **Fitur Garansi & Renew Akun**: Dukungan klaim garansi (`🛡️ Klaim Garansi`) dan perpanjangan akun (`🔄 Renew Akun`) otomatis untuk produk instan & invite email.
- **Wajib Join Channel Guard**: Memastikan pengguna bergabung ke channel Telegram Anda sebelum berbelanja.
- **Auto Clean Expired Stock**: Pembersihan stok kadaluarsa otomatis secara berkala (tiap 30 menit).
- **Temporary Email Engine**: Layanan email sementara bawaan di dalam bot.

---

## 📋 Persyaratan Sistem

- **Node.js**: v18.0.0 atau versi lebih baru
- **NPM**: v9.0.0 atau lebih baru
- **Firebase Firestore Project**: Untuk penyimpanan database
- **RamaShop & PanzzPay API Key**: Untuk gateway pembayaran QRIS otomatis (Auto-Failover)

---

## ⚙️ Panduan Setup & Instalasi

### 1. Clone / Extract Repository
```bash
cd "Auto order tele new"
npm install
```

### 2. Konfigurasi File `.env`
Salin file `.env.example` menjadi `.env`:
```bash
cp .env.example .env
```

Buka file `.env` dan isi variabel berikut:
```env
# ═══════════════════════════════════════
# TELEGRAM BOT
# ═══════════════════════════════════════
BOT_TOKEN=1234567890:AAA... (Token dari @BotFather)
ADMIN_ID=5665721422 (ID Telegram Admin dari @userinfobot)

# ═══════════════════════════════════════
# PAYMENT GATEWAYS (RAMASHOP & PANZZPAY)
# ═══════════════════════════════════════
RAMASHOP_API_KEY=rg_fe0c6171f275b7f77ebd1ed87f3f9a
RAMASHOP_BASE_URL=https://ramashop.my.id/api/public

PANZZPAY_API_KEY=rg_fe0c6171f275b7f77ebd1ed87f3f9a
PANZZPAY_BASE_URL=https://panzzpay.my.id

# ═══════════════════════════════════════
# FIREBASE
# ═══════════════════════════════════════
FIREBASE_PROJECT_ID=nama-project-firebase-anda

# ═══════════════════════════════════════
# STORE CONFIGURATION
# ═══════════════════════════════════════
STORE_NAME=PanzzStore
STORE_LOGO_URL=https://link-logo-anda.png
STORE_BANNER_URL=https://link-banner-anda.png

# ═══════════════════════════════════════
# TESTIMONI & REQUIRED CHANNEL (Wajib Join)
# ═══════════════════════════════════════
TESTIMONI_CHANNEL_ID=-100xxxxxxxxxx
REQUIRED_CHANNEL_ID=@channel_anda
REQUIRED_CHANNEL_LINK=https://t.me/channel_anda

# ═══════════════════════════════════════
# CONTACT INFO
# ═══════════════════════════════════════
CONTACT_WHATSAPP=628xxxxxxxxxx
CONTACT_TELEGRAM=username_admin
GROUP_TELEGRAM=https://t.me/group_anda
```

### 3. Setup Firebase Credentials
1. Buka [Firebase Console](https://console.firebase.google.com/), buat project baru.
2. Aktifkan **Cloud Firestore Database**.
3. Masuk ke **Project Settings -> Service Accounts**, lalu klik **Generate New Private Key**.
4. Simpan file JSON tersebut di root folder project dengan nama `firebase-service-account.json` (atau letakkan kredensial Firebase Anda).

### 4. Build Mini Apps (Store & Admin)
Jalankan perintah build untuk mengompilasi aplikasi Svelte 5:
```bash
# Build Shop Mini App & Admin Mini App sekaligus
npm run build:admin
```

### 5. Jalankan Bot & Server

#### Mode Development:
```bash
npm run dev
```

#### Mode Production:
```bash
npm start
```

---

## 📖 Perintah Bot Telegram

| Perintah | Deskripsi |
| :--- | :--- |
| `/start` | Menampilkan pesan selamat datang, statistik toko, dan keyboard menu utama. |
| `/menu` | Membuka menu navigasi cepat untuk transaksi. |
| `/stok` | Cek ketersediaan stok semua produk secara *real-time*. |
| `/saldo` | Cek sisa saldo akun dan opsi Topup QRIS instan. |
| `/admin` | Membuka Dashboard Admin & Tombol Akses Admin Mini App. |
| `/help` | Menampilkan bantuan dan kontak layanan pelanggan. |

---

## 📁 Struktur Direktori Project

```
Auto order tele new/
├── bot.js                  # Entry point Telegram Bot & Express Server
├── bot-server/
│   ├── api/index.js        # Express API Router & Domain Auto-Detection
│   ├── src/
│   │   ├── shop-api.js     # Endpoint API Store Mini App
│   │   └── admin-api.js    # Endpoint API Admin Mini App
│   ├── shop-app/           # Source code Svelte 5 Store Mini App
│   └── admin-app/          # Source code Svelte 5 Admin Mini App
├── src/
│   ├── config.js           # Konfigurasi aplikasi & .env
│   ├── firebase.js         # Inisialisasi Firebase SDK
│   ├── ramashop.js         # Payment Gateway Manager & Auto-Failover
│   ├── panzzpay.js         # Integration Gateway Pembayaran PanzzPay
│   ├── fulfillment.js      # Logika pengiriman pesanan otomatis
│   ├── stock-cleaner.js    # Pembersih stok expired
│   └── handlers/           # Handlers pesan & perintah bot
├── .env.example            # Template file environment
└── package.json            # NPM dependencies & build scripts
```

---

## 🛡️ Lisensi & Kredit

Diproduksi & dikembangkan dengan standar kualitas tinggi menggunakan **Svelte 5**, **Telegraf**, dan **Firebase Firestore**.

*Selamat Berjualan! 🚀*
