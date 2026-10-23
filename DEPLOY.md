# SI PEMUDA — Panduan Deploy

Struktur:
```
index.html          Landing page publik (tanpa link login)
app/                Aplikasi (login Google) → https://USER.github.io/REPO/app/
gas/Code.gs         Backend Google Apps Script + Google Sheets
.github/workflows/  Deploy otomatis ke GitHub Pages
```

## 1. Backend (Google Apps Script)
1. Buat Google Sheet baru "SI PEMUDA DB" → **Extensions → Apps Script**.
2. Tempel isi `gas/Code.gs` ke `Code.gs`.
3. **Project Settings → Script properties**, tambahkan:
   - `ADMIN_EMAIL` = email Google ketua/BPH pertama (otomatis jadi role BPH)
   - `HMAC_SECRET` = teks acak panjang (untuk token QR presensi)
   - `CLIENT_ID` = (diisi di langkah 2)
4. Jalankan fungsi **`setupAwal`** sekali (izinkan akses). Ini membuat semua sheet, migrasi skema, dan trigger harian 06.00 (ulang tahun + pengingat jadwal).
5. **Deploy → New deployment → Web app**: Execute as *Me*, Who has access *Anyone*. Salin URL `/exec`.

## 2. Login Google
1. Google Cloud Console → APIs & Services → Credentials → **OAuth client ID (Web application)**.
2. Authorized JavaScript origins: `https://USER.github.io` (dan `http://localhost:8080` untuk uji).
3. Salin Client ID → isi Script property `CLIENT_ID` dan `app/js/config.js`.

## 3. Frontend
- Edit `app/js/config.js`: `API_URL`, `GOOGLE_CLIENT_ID`.
- Edit `index.html`: konstanta `API_URL` (sama).
- Push ke GitHub (branch `main`). Repo → **Settings → Pages → Source: GitHub Actions**. Workflow di `.github/workflows/pages.yml` akan terbit otomatis.
- Setelah mengubah file di `app/`, naikkan `VER` di `app/sw.js` agar cache pengguna diperbarui.

## 4. Hak akses
- Orang baru yang login Google otomatis berstatus **Menunggu persetujuan**; BPH menyetujui di **Pengaturan → Pengguna & Role**.
- Email akun yang sama dengan email di Data Anggota otomatis terhubung ke profil anggota.
- BPH: semua. Koordinator: roster, event/presensi, kelompok sel. Anggota: dashboard pribadi, konfirmasi jadwal, daftar event, scan QR, warta, doa/konseling.

## 5. Perubahan skema di masa depan
Tambah kolom di `TABLES`, naikkan `SCHEMA_VERSION`, tambah langkah di `steps` pada `migrate()`, deploy ulang (**Manage deployments → Edit → New version**), lalu klik **Pengaturan → Sistem → Jalankan migrasi**.

## Catatan
- Bukti kas/lampiran disimpan di Google Drive (folder `SI-PEMUDA-UPLOAD`) dengan akses "siapa pun yang punya link".
- Permohonan anonim tidak menyimpan identitas pengirim, sehingga pengirim tidak bisa melihat statusnya.
- Dokumen cetak (roster, laporan kas, daftar hadir, rekap anggota) dibuat oleh Doc Engine di `buildDoc()`; format PDF tersedia lewat parameter `format: 'pdf'`.
