# Instalasi Lamariva di VPS Ubuntu

Panduan upload WinSCP, folder `/opt/lamariva`, pengguna `ubuntu`, PostgreSQL,
PM2, dan Nginx. Tanpa Docker. Jalankan blok secara berurutan. Jika ada perintah
gagal, selesaikan error tersebut sebelum melanjutkan.

## 1. Siapkan domain dan periksa VPS

Tentukan domain/subdomain, misalnya `cv.febro.id`. Ini contoh, bukan domain yang
telah dikonfigurasi. Buat DNS **A record** domain pilihan menuju IP VPS. Bila
memiliki AAAA record, pastikan IPv6 juga benar atau hapus record yang sudah tidak
digunakan. Jangan mengubah konfigurasi website lain.

Masuk SSH sebagai `ubuntu` dengan port SSH VPS Anda (misalnya 2026):

```bash
ssh -p 2026 ubuntu@IP_VPS_ANDA
```

Periksa runtime dan port:

```bash
whoami
node -v
npm -v
pm2 list
sudo ss -ltnp 'sport = :3035'
free -h
df -h /opt
```

Hasil `whoami` harus `ubuntu`. Jika masuk sebagai root, jalankan `su - ubuntu`.
Gunakan Node **22.16 atau lebih baru** (Node 22.23.2 yang Anda gunakan memenuhi).
Port aplikasi disiapkan **3035**. Bila sudah digunakan, pilih port kosong dan
samakan `PORT` di `.env` dengan `proxy_pass` Nginx. Jangan hentikan aplikasi lain.
Sisakan sekitar 2 GB RAM untuk proses build dan beberapa GB ruang kosong; kebutuhan
produksi bergantung jumlah pengguna dan ukuran dokumen.

Jika Node belum tersedia atau terlalu lama, pasang versi LTS yang didukung dari
https://nodejs.org/en/download. Jangan mengganti Node VPS yang menjalankan proyek
lain tanpa memeriksa kompatibilitasnya. Semua perintah aplikasi di bawah dijalankan
sebagai `ubuntu`, bukan `sudo npm` atau `sudo pm2`.

## 2. Buat folder dan beri akses ke ubuntu

```bash
sudo mkdir -p /opt/lamariva
sudo chown -R ubuntu:ubuntu /opt/lamariva
sudo chmod 750 /opt/lamariva
ls -ld /opt/lamariva
```

Owner dan group yang tampil harus `ubuntu ubuntu`. Tidak perlu chmod 777.

## 3. Upload lewat WinSCP

1. Buka WinSCP, pilih **SFTP**.
2. Host: IP VPS. Port: port SSH Anda (misalnya **2026**).
3. Username: **ubuntu**. Gunakan password atau SSH key VPS yang biasa digunakan.
4. Buka folder tujuan **`/opt/lamariva`** di panel kanan.
5. Upload **`Lamariva-VPS-v1.0.zip`** ke folder tersebut.

ZIP berisi source langsung di tingkat teratas, sehingga ekstrak di folder itu:

```bash
sudo apt update
sudo apt install -y unzip postgresql postgresql-contrib nginx certbot python3-certbot-nginx age
cd /opt/lamariva
unzip Lamariva-VPS-v1.0.zip
test -f package.json && echo 'Struktur folder benar'
```

Hasilnya harus `/opt/lamariva/package.json`, **bukan**
`/opt/lamariva/lamariva/package.json`. File `src`, `prisma`, `public`, `deploy`,
dan `.env.example` berada di folder yang sama. WinSCP dapat menyembunyikan file
berawalan titik; aktifkan tampilan hidden files bila perlu.

## 4. Buat database PostgreSQL

```bash
sudo systemctl enable --now postgresql
sudo -u postgres createuser --no-superuser --no-createdb --no-createrole --pwprompt lamariva
sudo -u postgres createdb --owner=lamariva lamariva
```

Masukkan password database baru saat diminta dua kali. Simpan di password manager.
Gunakan password acak panjang; karakter huruf/angka memudahkan penulisan URL.
Jika user/database sudah ada karena instalasi sebelumnya, jangan menghapusnya;
gunakan yang ada dengan kredensial yang benar. Database hanya diakses dari localhost.

## 5. Isi .env

```bash
cd /opt/lamariva
cp -n .env.example .env
chmod 600 .env
openssl rand -hex 32
nano .env
```

Salin hasil `openssl` sebagai `AUTH_SECRET`. Edit nilai berikut; ganti semua
contoh password/domain. Jangan kirim isi `.env` ke publik.

```dotenv
NODE_ENV=production
PORT=3035
APP_URL=https://cv.febro.id
DATABASE_URL='postgresql://lamariva:PASSWORD_DATABASE_ANDA@127.0.0.1:5432/lamariva'
AUTH_SECRET=HASIL_OPENSSL_RAND_HEX_32

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=info@logisourcedigital.web.id
SMTP_PASS='PASSWORD_EMAIL_INFO_ANDA'
SMTP_FROM='Lamariva - LogiSource Digital <info@logisourcedigital.web.id>'

STORAGE_PATH=./storage
JOB_SYNC_ENABLED=true
AI_PROVIDER=
AI_API_KEY=
AI_MODEL=
AI_BASE_URL=
BACKUP_DIR=/var/backups/lamariva
BACKUP_RECIPIENT=
BACKUP_RETENTION_DAYS=14
BACKUP_NOTIFY_EMAIL=
NEXT_TELEMETRY_DISABLED=1
```

`APP_URL` harus sama persis dengan domain publik, tanpa slash di akhir.
Password database yang mengandung `@`, `:`, `/`, `#`, `%` harus di-URL-encode
di `DATABASE_URL`. `SMTP_PASS` adalah password **mailbox**, bukan password login
Hostinger. Kutip nilai yang berisi spasi/tanda khusus. Jika memakai backup shell,
gunakan `.env` yang juga valid untuk Bash; password dengan kutip tunggal perlu
di-escape sesuai Bash atau gunakan password acak tanpa kutip.

SMTP port 465 memakai `SMTP_SECURE=true`. Jika penyedia mengharuskan 587,
gunakan `SMTP_PORT=587` dan `SMTP_SECURE=false` untuk STARTTLS. Tidak ada variabel
`SMTP_STARTTLS` pada aplikasi ini. Ikuti konfigurasi mailbox yang aktif.

Simpan nano: **Ctrl+O**, Enter, lalu **Ctrl+X**.

## 6. Install dependency, migrasi, dan build

```bash
cd /opt/lamariva
npm ci --include=dev
npx prisma generate
npm run db:migrate
npm run db:seed
npm run build
```

Tunggu sampai build berhasil. `--include=dev` diperlukan untuk Prisma, TypeScript,
dan runner sinkronisasi. Jangan menjalankan `npm audit fix --force` secara otomatis.
Seed hanya membuat template dan pengaturan awal, tanpa akun/password demo.

## 7. Buat akun Super Admin

```bash
cd /opt/lamariva
read -r -p 'Email admin: ' ADMIN_EMAIL
read -r -p 'Nama admin: ' ADMIN_NAME
read -r -s -p 'Password admin (minimal 16 karakter): ' ADMIN_PASSWORD
echo
export ADMIN_EMAIL ADMIN_NAME ADMIN_PASSWORD
npm run admin:create
unset ADMIN_EMAIL ADMIN_NAME ADMIN_PASSWORD
```

Gunakan email Anda, misalnya `febroherdyanto@outlook.com`. Password tidak tampil
ketika diketik. Akun ini sudah terverifikasi dan memiliki peran `SUPER_ADMIN`.
Tidak ada password default. Perintah ini menolak menimpa akun yang sudah ada.

## 8. Jalankan dengan PM2 milik ubuntu

Jika `pm2 -v` sudah berhasil, tidak perlu install ulang PM2.

```bash
cd /opt/lamariva
pm2 start ecosystem.config.cjs
pm2 save
curl -fsS http://127.0.0.1:3035/api/health
pm2 list
```

Proses `lamariva` harus online dan health mengembalikan JSON sehat.
`lamariva-job-sync` boleh berstatus **stopped** setelah selesai: ini tugas sekali
jalan yang dijadwalkan ulang setiap jam, bukan server permanen.

Jika PM2 belum terpasang, pasang `npm install -g pm2` menggunakan Node milik
ubuntu. Bila npm global mengalami EACCES, jangan memakai `sudo pm2`; gunakan
instalasi Node milik pengguna atau prefix npm yang dapat ditulis ubuntu.

Untuk otomatis aktif setelah reboot:

```bash
pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

Salin dan jalankan **perintah sudo yang dicetak PM2**, kemudian:

```bash
pm2 save
systemctl status pm2-ubuntu --no-pager
```

Jika service PM2 ubuntu sudah ada untuk aplikasi lain, cukup pastikan daftar
proses tersimpan; jangan menghapus/reset daftar aplikasi tersebut.

## 9. Nginx dan SSL domain

Pastikan DNS domain sudah menuju VPS. Ganti contoh `cv.febro.id` bila memakai
domain lain. Blok berikut menulis **file khusus Lamariva**; pada instalasi ulang
backup konfigurasi Lamariva yang sudah ada sebelum menggantinya.

```bash
sudo tee /etc/nginx/conf.d/lamariva.conf > /dev/null <<'NGINX'
server {
    listen 80;
    server_name cv.febro.id;
    client_max_body_size 2m;
    location / {
        proxy_pass http://127.0.0.1:3035;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 90s;
        proxy_connect_timeout 10s;
    }
}
NGINX
sudo nginx -t
```

Hanya jika tes Nginx berhasil:

```bash
sudo systemctl reload nginx
sudo certbot --nginx -d cv.febro.id
```

Ikuti pertanyaan Certbot dan aktifkan redirect HTTP ke HTTPS. Bila Certbot sudah
terpasang melalui Snap, gunakan instalasi Certbot yang sudah ada; jangan buat dua
instalasi yang berbeda. Port 80 dan 443 harus dibuka di firewall VPS/provider.
Jangan mengaktifkan/reset UFW tanpa memastikan port SSH 2026 Anda tetap diizinkan.
Port 3035 dan 5432 tidak perlu dibuka ke publik.

```bash
curl -I https://cv.febro.id
curl -fsS https://cv.febro.id/api/health
sudo certbot renew --dry-run
```

Buka `https://cv.febro.id/login`, masuk dengan admin tadi. Dashboard pengguna
ada di `/dashboard`, kontrol admin di `/admin`. HTTPS wajib sebelum menguji
login produksi karena cookie sesi diamankan.

## 10. Aktifkan Google login

Di Google Cloud Console, buat OAuth client bertipe **Web application** dan isi:

```text
Authorized JavaScript origin:
https://cv.febro.id

Authorized redirect URI:
https://cv.febro.id/api/auth/callback/google
```

Siapkan consent screen, authorized domain, dan test user jika aplikasi Google
masih testing. Isi `GOOGLE_CLIENT_ID` serta `GOOGLE_CLIENT_SECRET` di `.env`.

```bash
cd /opt/lamariva
pm2 restart ecosystem.config.cjs --only lamariva --update-env
```

Di admin pastikan Google login aktif. Coba dari browser private dengan akun yang
diizinkan consent screen. Tanpa kredensial OAuth, tombol Google disembunyikan;
login email tetap tersedia.

## 11. Pemeriksaan setelah instalasi

- Admin: isi kontak, nama situs, halaman privasi/syarat, pengumuman dan teks publik.
- Menu operasional: kirim test email, cek inbox dan spam.
- Daftarkan akun pengguna terpisah dan klik verifikasi email asli.
- Uji lupa password; tautan berlaku 15 menit dan sekali pakai.
- Isi profil, buat CV, tunggu status tersimpan, unduh PDF dan DOCX.
- Buat surat lamaran, review isinya, lalu unduh.
- Tambah lamaran pada tracker dan periksa tabel/kanban.
- Periksa mode terang/gelap dan navigasi di HP.
- Tambahkan provider lowongan resmi atau lowongan manual di admin bila diperlukan.

SMTP lokal sudah diuji dalam paket; delivery mailbox Hostinger dan Google OAuth
tetap harus diuji pada domain asli Anda. Fitur AI opsional mati secara default.
Detail cakupan tersedia di `docs/QA.md`.

## 12. Backup, log, dan update

Untuk backup terenkripsi, buat pasangan kunci age di komputer aman dan simpan
private key terpisah dari VPS. Masukkan **public recipient** `age1...` pada
`BACKUP_RECIPIENT`. Petunjuk lengkap backup/restore ada di README.

```bash
sudo mkdir -p /var/backups/lamariva
sudo chown ubuntu:ubuntu /var/backups/lamariva
sudo chmod 700 /var/backups/lamariva
cd /opt/lamariva
bash deploy/backup.sh
```

Salin backup terenkripsi keluar VPS. Setelah berhasil, gunakan `crontab -e`
sebagai ubuntu dan **tambahkan**, jangan ganti entri aplikasi lain:

```cron
30 2 * * * cd /opt/lamariva && /bin/bash deploy/backup.sh >> /opt/lamariva-backup.log 2>&1
```

Jadwal mengikuti timezone server. Uji restore ke database terpisah sebelum
mengandalkan backup. Jangan restore langsung menimpa database aktif.

Perintah operasional:

```bash
pm2 logs lamariva --lines 80
pm2 logs lamariva-job-sync --lines 50
pm2 restart ecosystem.config.cjs --only lamariva --update-env
sudo tail -n 80 /var/log/nginx/error.log
```

Tekan Ctrl+C untuk keluar tampilan log, bukan untuk menghentikan PM2.
Untuk update: buat backup database dan salinan source lama, upload source baru
tanpa menimpa `.env`, jalankan `npm ci --include=dev`, `npx prisma generate`, migrasi, lalu build.
Restart PM2 hanya setelah semuanya berhasil. Simpan release lama untuk rollback.

## Troubleshooting

| Masalah | Pemeriksaan |
| --- | --- |
| WinSCP permission denied | Jalankan kembali `sudo chown -R ubuntu:ubuntu /opt/lamariva`; pastikan login WinSCP sebagai ubuntu. |
| Nginx 502 | Cek `pm2 logs lamariva`, health localhost, port `.env` dan proxy_pass. |
| P1000/database auth failed | Cocokkan password role PostgreSQL dan URL encoding DATABASE_URL. |
| P1001/database unreachable | `sudo systemctl status postgresql`; pastikan host localhost dan port 5432. |
| Login tidak tersimpan | APP_URL harus HTTPS domain yang sedang dibuka, SSL valid, lalu restart PM2. |
| Email tidak masuk | Cek SMTP_USER/PASS, port/secure, sender, DNS SPF/DKIM, inbox/spam dan delivery status admin. |
| Google redirect_uri_mismatch | Samakan callback URL persis termasuk domain dan `/api/auth/callback/google`. |
| Build killed/OOM | Periksa RAM dan log kernel; sediakan resource build lebih besar tanpa menghentikan proyek lain sembarangan. |
| Port 3035 bentrok | Pilih port kosong, ubah `.env` dan Nginx, tes Nginx lalu restart Lamariva. |

Referensi resmi: [PM2 startup](https://pm2.keymetrics.io/docs/usage/startup/),
[PostgreSQL createuser](https://www.postgresql.org/docs/current/app-createuser.html),
[Certbot Nginx](https://certbot.eff.org/instructions?ws=nginx&os=snap).
