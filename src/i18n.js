// ═══════════════════════════════════════
// Modern Rich HTML i18n — Premium Layout
// ═══════════════════════════════════════

const translations = {
  id: {
    // ─── Start / Welcome ───
    welcome:
      '⚡ <b><u>{{storeName}}</u></b>\n' +
      '<i>Pusat Layanan &amp; Produk Digital Premium</i>\n' +
      '────────────────────────────\n' +
      '🟢 <b>STATUS SISTEM: ONLINE (24/7)</b>\n\n' +
      '👋 Halo, <b>{{name}}</b>!\n\n' +
      '<blockquote>' +
      '<b>👤 PROFIL PENGGUNA</b>\n' +
      '━━━━━━━━━━━━━━━━━\n' +
      '• <b>ID Account</b> : <code>{{userId}}</code>\n' +
      '• <b>Username</b>  : @{{username}}\n' +
      '• <b>Transaksi</b> : <b>{{totalTransaksi}}</b> pesanan\n' +
      '• <b>Saldo Aktif</b>: <b><u>{{balance}}</u></b>' +
      '</blockquote>\n\n' +
      '<blockquote>' +
      '<b>📊 STATISTIK TOKO</b>\n' +
      '━━━━━━━━━━━━━━━━━\n' +
      '• <b>⭐ Rating</b>   : <b>{{ratingAverage}} / 5.0</b> [ <i>{{totalReviews}} reviews</i> ]\n' +
      '• <b>📦 Terjual</b>  : <b>{{totalSold}}</b> pcs\n' +
      '• <b>👥 Member</b>   : <b>{{totalUsers}}</b> akun\n' +
      '• <b>🔥 Terlaris</b> : <b>{{topProduct}}</b>' +
      '</blockquote>\n\n' +
      '⏰ <i>{{dateStr}} — {{timeStr}} WIB</i>\n\n' +
      '💡 <i>Gunakan menu di bawah untuk transaksi!</i>',

    // ─── Reply Keyboard Labels ───
    menu_products: '🛍️ Katalog Produk',
    menu_balance: '💳 Saldo Akun',
    menu_stock: '📋 Status Stok',
    menu_history: '📄 Riwayat Order',
    menu_popular: '⭐ Produk Terlaris',
    menu_help: '💬 Pusat Bantuan',

    // ─── Product List ───
    product_list_loading: '⏳ <i>Memuat katalog produk...</i>',
    product_list_success: '✅ Berhasil',
    product_list_choose:
      '🛍️ <b><u>KATALOG PRODUK DIGITAL</u></b>\n\n' +
      '<blockquote>' +
      '<i>Silakan pilih produk yang ingin Anda beli:</i>' +
      '</blockquote>\n',
    product_list_item: '<b>{{num}}. {{name}}</b> — (<b>{{stock}}</b> stok)',
    product_list_page: '\n📌 <i>Halaman <b>{{current}}</b> dari <b>{{total}}</b></i>',
    product_list_empty: '⚠️ <i>Saat ini belum ada produk yang tersedia.</i>',

    product_detail:
      '🛍️ <b><u>DETAIL PRODUK</u></b>\n' +
      '━━━━━━━━━━━━━━━━━\n' +
      '📌 <b>{{name}}</b>\n\n' +
      '<blockquote>' +
      '📝 <b>Deskripsi:</b>\n' +
      '<i>{{description}}</i>' +
      '</blockquote>\n\n' +
      '⚡ <b>PILIH VARIAN PRODUK DI BAWAH:</b>',
    product_variant_item: '• <b>{{label}}</b> ➔ <b><u>{{price}}</u></b> (Stok: {{stockBadge}})',
    product_out_of_stock: '❌ <i>Stok varian ini sedang habis.</i>',

    // ─── Order Summary ───
    order_summary:
      '🧾 <b><u>RINGKASAN PESANAN</u></b>\n\n' +
      '<blockquote>' +
      '<b>📦 Detail Item</b>\n' +
      '━━━━━━━━━━━━━━━━━\n' +
      '• <b>Produk</b> : <b>{{product}}</b>\n' +
      '• <b>Varian</b> : <i>{{variant}}</i>\n' +
      '• <b>Jumlah</b> : <b>{{qty}}</b> pcs\n' +
      '• <b>Harga</b>  : <b>{{unitPrice}}</b>' +
      '</blockquote>\n\n' +
      '<blockquote>' +
      '💰 <b>TOTAL TAGIHAN</b> : <b><u>{{total}}</u></b>' +
      '</blockquote>',
    order_voucher_applied: '🎁 <b>Voucher</b> : <code>{{code}}</code> (<i>-{{discount}}</i>)',

    // ─── Payment ───
    payment_choose:
      '💳 <b><u>PILIIH METODE PEMBAYARAN</u></b>\n\n' +
      '<blockquote>' +
      '<i>Silakan pilih metode pembayaran di bawah untuk memproses pesanan Anda:</i>' +
      '</blockquote>',
    payment_processing: '⏳ <i>Menyiapkan pembayaran...</i>',
    payment_qris_caption:
      '📱 <b><u>PEMBAYARAN QRIS INSTAN</u></b>\n\n' +
      '<blockquote>' +
      '• <b>Order ID</b>    : <code>{{orderId}}</code>\n' +
      '• <b>Total Bayar</b>  : <b><u>{{total}}</u></b>\n' +
      '• <b>Masa Berlaku</b>: <b>{{expiry}} menit</b>' +
      '</blockquote>\n\n' +
      '<blockquote>' +
      '📲 <i>Scan QRIS di atas menggunakan E-Wallet / Mobile Banking. Pembayaran terverifikasi otomatis!</i> ⚡' +
      '</blockquote>',
    payment_success:
      '✅ <b><u>PEMBAYARAN BERHASIL!</u></b>\n\n' +
      '<blockquote>' +
      '• <b>Order ID</b>   : <code>{{orderId}}</code>\n' +
      '• <b>Produk</b>     : <b>{{product}}</b>\n' +
      '• <b>Varian</b>     : <i>{{variant}}</i>\n' +
      '• <b>Total</b>      : <b><u>{{total}}</u></b>\n' +
      '• <b>Pembayaran</b> : <b>{{method}}</b>' +
      '</blockquote>\n\n' +
      '📦 <b>Detail Akun Pesanan Anda:</b> 👇',
    payment_waiting:
      '⏳ <b><u>MENUNGGU PROSES ADMIN</u></b>\n\n' +
      '<blockquote>' +
      '• <b>Order ID</b>  : <code>{{orderId}}</code>\n' +
      '• <b>Produk</b>    : <b>{{product}}</b>\n' +
      '• <b>Total</b>     : <b><u>{{total}}</u></b>' +
      '</blockquote>\n\n' +
      '<blockquote>' +
      '⚙️ <i>Pesanan tipe manual sedang diproses oleh Admin. Mohon tunggu sejenak!</i> ⚡' +
      '</blockquote>',
    payment_failed: '❌ <i>Pembayaran gagal atau telah expired.</i>',
    payment_cancelled: '✕ <i>Transaksi berhasil dibatalkan.</i>',
    payment_insufficient:
      '❌ <b><u>SALDO TIDAK CUKUP!</u></b>\n\n' +
      '<blockquote>' +
      '• <b>Saldo Anda</b>  : <code>{{balance}}</code>\n' +
      '• <b>Tagihan</b>     : <b><u>{{total}}</u></b>' +
      '</blockquote>\n\n' +
      '💡 <i>Silakan top-up saldo Anda terlebih dahulu!</i>',

    // ─── Balance / Saldo ───
    balance_title:
      '💳 <b><u>SALDO AKUN PENGGUNA</u></b>\n\n' +
      '<blockquote>' +
      '💰 <b>Saldo Anda saat ini:</b>\n' +
      '<b><u>{{balance}}</u></b>' +
      '</blockquote>\n\n' +
      '<blockquote>' +
      '👇 <i>Pilih nominal top-up saldo via QRIS di bawah:</i>' +
      '</blockquote>',
    topup_preparing: '⏳ <i>Menyiapkan QRIS top-up...</i>',
    topup_success:
      '✅ <b><u>TOP-UP SALDO BERHASIL!</u></b>\n\n' +
      '<blockquote>' +
      '• <b>Nominal</b> : <b><u>{{amount}}</u></b>\n' +
      '• <b>Status</b>  : <b>Sukses</b> ⚡' +
      '</blockquote>\n\n' +
      '<i>Terima kasih telah melakukan pengisian saldo! 🙏</i>',

    // ─── Stock ───
    stock_title: '📋 <b><u>STATUS STOK PRODUK</u></b>\n\n',
    stock_ready: '<b>🟢 STOK READY</b>',
    stock_limited: '<b>🟡 STOK TERBATAS</b>',
    stock_empty: '<b>🔴 STOK HABIS</b>',
    stock_item: '• <b>{{name}}</b> : <code>{{stock}}</code> pcs',
    stock_update: '\n⏰ <i>Update: <b>{{time}}</b> WIB</i>',

    // ─── History ───
    history_title:
      '📄 <b><u>RIWAYAT TRANSAKSI</u></b>\n\n' +
      '<blockquote>' +
      '<i>Silakan pilih kategori riwayat transaksi Anda:</i>' +
      '</blockquote>',
    history_orders_title: '🧾 <b><u>5 TRANSAKSI PESANAN TERAKHIR</u></b>\n\n',
    history_order_item:
      '<blockquote>' +
      '📦 <b>{{product}}</b>\n' +
      '└ Total: <b><u>{{total}}</u></b> | Status: <code>{{status}}</code>' +
      '</blockquote>\n',
    history_topup_title: '💰 <b><u>5 TRANSAKSI TOP-UP TERAKHIR</u></b>\n\n',
    history_topup_item:
      '<blockquote>' +
      '💳 <b>Top-up {{amount}}</b>\n' +
      '└ Status: <code>{{status}}</code> | Tanggal: <i>{{date}}</i>' +
      '</blockquote>\n',
    history_no_orders: '❌ <i>Belum ada riwayat pesanan.</i>',
    history_no_topup: '❌ <i>Belum ada riwayat topup.</i>',

    // ─── Popular ───
    popular_title: '⭐ <b><u>PRODUK TERLARIS</u></b>\n\n',
    popular_item:
      '<blockquote>' +
      '{{medal}} <b>{{name}}</b>\n' +
      '└ Terjual: <b><u>{{sold}}</u></b> pcs' +
      '</blockquote>\n',
    popular_empty: '❌ <i>Belum ada data produk terlaris.</i>',

    // ─── Help ───
    help_title:
      '💬 <b><u>PUSAT BANTUAN &amp; LAYANAN</u></b>\n\n' +
      '<blockquote>' +
      '<i>Mengalami kendala transaksi atau butuh bantuan?</i>\n' +
      '<i>Silakan pilih menu kontak di bawah:</i>' +
      '</blockquote>',
    help_contact_title:
      '📞 <b><u>HUBUNGI CUSTOMER SERVICE</u></b>\n\n' +
      '<blockquote>' +
      '<i>Pilih media komunikasi untuk terhubung dengan Admin:</i>' +
      '</blockquote>',
    help_lang_title:
      '🌐 <b><u>PENGATURAN BAHASA / LANGUAGE</u></b>\n\n' +
      '<blockquote>' +
      '<i>Pilih bahasa tampilan bot:</i>' +
      '</blockquote>',

    // ─── Language ───
    lang_changed: '🇮🇩 <i>Bahasa berhasil diubah ke Bahasa Indonesia.</i>',

    // ─── Admin ───
    admin_title:
      '⚙️ <b><u>ADMIN DASHBOARD PANEL</u></b>\n\n' +
      '<blockquote>' +
      '• <b>Revenue Hari Ini</b> : <b><u>{{revenue}}</u></b>\n' +
      '• <b>Order Sukses</b>     : <b>{{orders}}</b> transaksi\n' +
      '• <b>Total Member</b>      : <b>{{users}}</b> akun\n' +
      '• <b>Total Produk</b>      : <b>{{products}}</b> item' +
      '</blockquote>',
    admin_not_authorized: '❌ <i>Anda tidak memiliki akses admin.</i>',

    // ─── TMail ───
    tmail_title:
      '📧 <b><u>TEMPORARY EMAIL (TMAIL ADMIN)</u></b>\n\n' +
      '<blockquote>' +
      '<i>Generate alamat email sementara otomatis untuk pendaftaran akun.</i>' +
      '</blockquote>',
    tmail_generated:
      '✅ <b><u>TEMPORARY EMAIL DIBUAT!</u></b>\n\n' +
      '<blockquote>' +
      '• <b>Email</b>   : <code>{{email}}</code>\n' +
      '• <b>Berlaku</b> : <b>{{expiry}} menit</b>' +
      '</blockquote>\n\n' +
      '💡 <i>Tekan "📥 Cek Inbox" untuk memeriksa pesan masuk.</i>',
    tmail_inbox_title: '📥 <b><u>INBOX SURAT MASUK</u></b> (<i>{{count}} pesan</i>)\n\n',
    tmail_inbox_item:
      '<blockquote>' +
      '<b>{{num}}. {{from}}</b>\n' +
      '└ Subject: <i>{{subject}}</i>\n' +
      '└ ⏰ <i>{{time}}</i>' +
      '</blockquote>\n',
    tmail_inbox_empty: '📭 <i>Inbox pesan saat ini masih kosong.</i>',
    tmail_deleted: '✅ <i>Temporary email berhasil dihapus.</i>',
    tmail_no_active: '❌ <i>Tidak ada temporary email aktif.</i>',

    // ─── Voucher ───
    voucher_invalid: '❌ <i>Kode voucher tidak valid atau sudah kadaluwarsa.</i>',
    voucher_applied: '🎉 Voucher <code>{{code}}</code> berhasil dipasang! Diskon: <b><u>{{discount}}</u></b>',
    voucher_min_purchase: '❌ Minimal pembelian <b><u>{{min}}</u></b> untuk memakai voucher ini.',

    // ─── Buttons ───
    btn_back: '↩️ Kembali',
    btn_buy: '🛒 Beli Sekarang',
    btn_refresh: '🔄 Refresh Status',
    btn_cancel: '❌ Batal',
    btn_orders: 'Riwayat Pesanan',
    btn_topup: 'Riwayat Top-up',
    btn_language: '🌐 Ganti Bahasa',
    btn_chat_admin: '📞 Chat Admin',

    // ─── Misc ───
    pcs: 'pcs',
    maintenance:
      '⚠️ <b><u>SISTEM PEMELIHARAAN</u></b>\n\n' +
      '<blockquote>' +
      '<i>Bot sedang dalam pemeliharaan berkala. Silakan coba kembali nanti. 🙏</i>' +
      '</blockquote>',
    error_general: '❌ <i>Terjadi kesalahan pada sistem. Silakan coba lagi.</i>',
  },

  en: {
    // ─── Start / Welcome ───
    welcome:
      '⚡ <b><u>{{storeName}}</u></b>\n' +
      '<i>Premium Digital Goods Service Center</i>\n' +
      '────────────────────────────\n' +
      '🟢 <b>SYSTEM STATUS: ONLINE (24/7)</b>\n\n' +
      '👋 Hello, <b>{{name}}</b>!\n\n' +
      '<blockquote>' +
      '<b>👤 USER PROFILE</b>\n' +
      '━━━━━━━━━━━━━━━━━\n' +
      '• <b>Account ID</b> : <code>{{userId}}</code>\n' +
      '• <b>Username</b>   : @{{username}}\n' +
      '• <b>Orders</b>     : <b>{{totalTransaksi}}</b> completed\n' +
      '• <b>Balance</b>    : <b><u>{{balance}}</u></b>' +
      '</blockquote>\n\n' +
      '<blockquote>' +
      '<b>📊 STORE STATS</b>\n' +
      '━━━━━━━━━━━━━━━━━\n' +
      '• <b>⭐ Rating</b>   : <b>{{ratingAverage}} / 5.0</b> [ <i>{{totalReviews}} reviews</i> ]\n' +
      '• <b>📦 Total Sold</b>: <b>{{totalSold}}</b> pcs\n' +
      '• <b>👥 Members</b>   : <b>{{totalUsers}}</b> users\n' +
      '• <b>🔥 Best Seller</b>: <b>{{topProduct}}</b>' +
      '</blockquote>\n\n' +
      '⏰ <i>{{dateStr}} — {{timeStr}} WIB</i>\n\n' +
      '💡 <i>Use the menu buttons below to get started!</i>',

    menu_products: '🛍️ Product Catalog',
    menu_balance: '💳 Account Balance',
    menu_stock: '📋 Stock Status',
    menu_history: '📄 Order History',
    menu_popular: '⭐ Best Sellers',
    menu_help: '💬 Support Center',

    product_list_loading: '⏳ <i>Loading catalog...</i>',
    product_list_success: '✅ Success',
    product_list_choose:
      '🛍️ <b><u>DIGITAL PRODUCT CATALOG</u></b>\n\n' +
      '<blockquote>' +
      '<i>Please select a product to purchase:</i>' +
      '</blockquote>\n',
    product_list_item: '<b>{{num}}. {{name}}</b> — (<b>{{stock}}</b> stock)',
    product_list_page: '\n📌 <i>Page <b>{{current}}</b> of <b>{{total}}</b></i>',
    product_list_empty: '⚠️ <i>No products currently available.</i>',

    product_detail:
      '🛍️ <b><u>PRODUCT DETAILS</u></b>\n' +
      '━━━━━━━━━━━━━━━━━\n' +
      '📌 <b>{{name}}</b>\n\n' +
      '<blockquote>' +
      '📝 <b>Description:</b>\n' +
      '<i>{{description}}</i>' +
      '</blockquote>\n\n' +
      '⚡ <b>SELECT PRODUCT VARIANT BELOW:</b>',
    product_variant_item: '• <b>{{label}}</b> ➔ <b><u>{{price}}</u></b> (Stock: {{stockBadge}})',
    product_out_of_stock: '❌ <i>This variant is currently out of stock.</i>',

    order_summary:
      '🧾 <b><u>ORDER SUMMARY</u></b>\n\n' +
      '<blockquote>' +
      '<b>📦 Item Details</b>\n' +
      '━━━━━━━━━━━━━━━━━\n' +
      '• <b>Product</b>  : <b>{{product}}</b>\n' +
      '• <b>Variant</b>  : <i>{{variant}}</i>\n' +
      '• <b>Quantity</b> : <b>{{qty}}</b> pcs\n' +
      '• <b>UnitPrice</b>: <b>{{unitPrice}}</b>' +
      '</blockquote>\n\n' +
      '<blockquote>' +
      '💰 <b>TOTAL DUE</b> : <b><u>{{total}}</u></b>' +
      '</blockquote>',
    order_voucher_applied: '🎁 <b>Voucher</b> : <code>{{code}}</code> (<i>-{{discount}}</i>)',

    payment_choose:
      '💳 <b><u>CHOOSE PAYMENT METHOD</u></b>\n\n' +
      '<blockquote>' +
      '<i>Please select a payment method below to complete your order:</i>' +
      '</blockquote>',
    payment_processing: '⏳ <i>Preparing payment...</i>',
    payment_qris_caption:
      '📱 <b><u>INSTANT QRIS PAYMENT</u></b>\n\n' +
      '<blockquote>' +
      '• <b>Order ID</b>   : <code>{{orderId}}</code>\n' +
      '• <b>Total Pay</b>  : <b><u>{{total}}</u></b>\n' +
      '• <b>Expires In</b> : <b>{{expiry}} minutes</b>' +
      '</blockquote>\n\n' +
      '<blockquote>' +
      '📲 <i>Scan QR code above with any Banking or E-Wallet App!</i> ⚡' +
      '</blockquote>',
    payment_success:
      '✅ <b><u>PAYMENT SUCCESSFUL!</u></b>\n\n' +
      '<blockquote>' +
      '• <b>Order ID</b>   : <code>{{orderId}}</code>\n' +
      '• <b>Product</b>    : <b>{{product}}</b>\n' +
      '• <b>Variant</b>    : <i>{{variant}}</i>\n' +
      '• <b>Total</b>      : <b><u>{{total}}</u></b>\n' +
      '• <b>Payment</b>    : <b>{{method}}</b>' +
      '</blockquote>\n\n' +
      '📦 <b>Your Account Details:</b> 👇',
    payment_waiting:
      '⏳ <b><u>WAITING FOR ADMIN APPROVAL</u></b>\n\n' +
      '<blockquote>' +
      '• <b>Order ID</b>  : <code>{{orderId}}</code>\n' +
      '• <b>Product</b>   : <b>{{product}}</b>\n' +
      '• <b>Total</b>     : <b><u>{{total}}</u></b>' +
      '</blockquote>\n\n' +
      '<blockquote>' +
      '⚙️ <i>Manual item is being processed by Admin. Please wait!</i> ⚡' +
      '</blockquote>',
    payment_failed: '❌ <i>Payment failed or expired.</i>',
    payment_cancelled: '✕ <i>Order cancelled successfully.</i>',
    payment_insufficient:
      '❌ <b><u>INSUFFICIENT BALANCE!</u></b>\n\n' +
      '<blockquote>' +
      '• <b>Your Balance</b> : <code>{{balance}}</code>\n' +
      '• <b>Total Due</b>    : <b><u>{{total}}</u></b>' +
      '</blockquote>\n\n' +
      '💡 <i>Please top-up your balance first!</i>',

    balance_title:
      '💳 <b><u>ACCOUNT BALANCE</u></b>\n\n' +
      '<blockquote>' +
      '💰 <b>Your Current Balance:</b>\n' +
      '<b><u>{{balance}}</u></b>' +
      '</blockquote>\n\n' +
      '<blockquote>' +
      '👇 <i>Choose top-up amount via QRIS below:</i>' +
      '</blockquote>',
    topup_preparing: '⏳ <i>Preparing QRIS top-up...</i>',
    topup_success:
      '✅ <b><u>TOP-UP SUCCESSFUL!</u></b>\n\n' +
      '<blockquote>' +
      '• <b>Amount</b> : <b><u>{{amount}}</u></b>\n' +
      '• <b>Status</b> : <b>Success</b> ⚡' +
      '</blockquote>\n\n' +
      '<i>Thank you for topping up! 🙏</i>',

    stock_title: '📋 <b><u>PRODUCT STOCK STATUS</u></b>\n\n',
    stock_ready: '<b>🟢 READY STOCK</b>',
    stock_limited: '<b>🟡 LIMITED STOCK</b>',
    stock_empty: '<b>🔴 OUT OF STOCK</b>',
    stock_item: '• <b>{{name}}</b> : <code>{{stock}}</code> pcs',
    stock_update: '\n⏰ <i>Updated: <b>{{time}}</b> WIB</i>',

    history_title:
      '📄 <b><u>TRANSACTION HISTORY</u></b>\n\n' +
      '<blockquote>' +
      '<i>Select transaction category:</i>' +
      '</blockquote>',
    history_orders_title: '🧾 <b><u>LAST 5 ORDERS</u></b>\n\n',
    history_order_item:
      '<blockquote>' +
      '📦 <b>{{product}}</b>\n' +
      '└ Total: <b><u>{{total}}</u></b> | Status: <code>{{status}}</code>' +
      '</blockquote>\n',
    history_topup_title: '💰 <b><u>LAST 5 TOPUPS</u></b>\n\n',
    history_topup_item:
      '<blockquote>' +
      '💳 <b>Top-up {{amount}}</b>\n' +
      '└ Status: <code>{{status}}</code> | Date: <i>{{date}}</i>' +
      '</blockquote>\n',
    history_no_orders: '❌ <i>No order history found.</i>',
    history_no_topup: '❌ <i>No topup history found.</i>',

    popular_title: '⭐ <b><u>BEST SELLERS</u></b>\n\n',
    popular_item:
      '<blockquote>' +
      '{{medal}} <b>{{name}}</b>\n' +
      '└ Sold: <b><u>{{sold}}</u></b> pcs' +
      '</blockquote>\n',
    popular_empty: '❌ <i>No best seller data yet.</i>',

    help_title:
      '💬 <b><u>SUPPORT CENTER</u></b>\n\n' +
      '<blockquote>' +
      '<i>Need help or facing transaction issues?</i>\n' +
      '<i>Contact our customer support below:</i>' +
      '</blockquote>',
    help_contact_title:
      '📞 <b><u>CONTACT CUSTOMER SUPPORT</u></b>\n\n' +
      '<blockquote>' +
      '<i>Select communication platform:</i>' +
      '</blockquote>',
    help_lang_title:
      '🌐 <b><u>LANGUAGE SETTINGS</u></b>\n\n' +
      '<blockquote>' +
      '<i>Select bot display language:</i>' +
      '</blockquote>',

    lang_changed: '🇬🇧 <i>Language changed to English.</i>',

    admin_title:
      '⚙️ <b><u>ADMIN DASHBOARD PANEL</u></b>\n\n' +
      '<blockquote>' +
      '• <b>Today Revenue</b>  : <b><u>{{revenue}}</u></b>\n' +
      '• <b>Success Orders</b> : <b>{{orders}}</b> orders\n' +
      '• <b>Total Members</b>  : <b>{{users}}</b> users\n' +
      '• <b>Total Products</b> : <b>{{products}}</b> items' +
      '</blockquote>',
    admin_not_authorized: '❌ <i>You are not authorized as admin.</i>',

    tmail_title:
      '📧 <b><u>TEMPORARY EMAIL (ADMIN ONLY)</u></b>\n\n' +
      '<blockquote>' +
      '<i>Generate instant temporary emails for account registrations.</i>' +
      '</blockquote>',
    tmail_generated:
      '✅ <b><u>TEMPORARY EMAIL CREATED!</u></b>\n\n' +
      '<blockquote>' +
      '• <b>Email</b>   : <code>{{email}}</code>\n' +
      '• <b>Valid</b>   : <b>{{expiry}} minutes</b>' +
      '</blockquote>\n\n' +
      '💡 <i>Press "📥 Check Inbox" to view incoming messages.</i>',
    tmail_inbox_title: '📥 <b><u>INBOX MESSAGES</u></b> (<i>{{count}} messages</i>)\n\n',
    tmail_inbox_item:
      '<blockquote>' +
      '<b>{{num}}. {{from}}</b>\n' +
      '└ Subject: <i>{{subject}}</i>\n' +
      '└ ⏰ <i>{{time}}</i>' +
      '</blockquote>\n',
    tmail_inbox_empty: '📭 <i>Inbox is currently empty.</i>',
    tmail_deleted: '✅ <i>Temporary email deleted.</i>',
    tmail_no_active: '❌ <i>No active temporary email.</i>',

    voucher_invalid: '❌ <i>Voucher code is invalid or expired.</i>',
    voucher_applied: '🎉 Voucher <code>{{code}}</code> applied! Discount: <b><u>{{discount}}</u></b>',
    voucher_min_purchase: '❌ Minimum purchase <b><u>{{min}}</u></b> required for this voucher.',

    btn_back: '↩️ Back',
    btn_buy: '🛒 Buy Now',
    btn_refresh: '🔄 Refresh Status',
    btn_cancel: '❌ Cancel',
    btn_orders: 'Order History',
    btn_topup: 'Top-up History',
    btn_language: '🌐 Change Language',
    btn_chat_admin: '📞 Chat Admin',

    pcs: 'pcs',
    maintenance:
      '⚠️ <b><u>SYSTEM MAINTENANCE</u></b>\n\n' +
      '<blockquote>' +
      '<i>System is under routine maintenance. Please try again later. 🙏</i>' +
      '</blockquote>',
    error_general: '❌ <i>An error occurred. Please try again.</i>',
  },
};

/**
 * Get translated string with template interpolation
 * @param {string} lang - 'id' or 'en'
 * @param {string} key - Translation key
 * @param {object} params - Template variables
 * @returns {string}
 */
function t(lang, key, params = {}) {
  const dict = translations[lang] || translations['id'];
  let text = dict[key] || translations['id'][key] || key;

  for (const [k, v] of Object.entries(params)) {
    text = text.replace(new RegExp(`{{${k}}}`, 'g'), v);
  }
  return text;
}

module.exports = { t, translations };
