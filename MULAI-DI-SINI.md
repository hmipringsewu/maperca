# Source code MAPERCA — HMI Cabang Pringsewu

Ini source lengkap versi website terakhir: formulir, logo, desain, API pendaftaran,
penyimpanan data, dan tahap konfirmasi follow Instagram + TikTok @hmipringsewu.

## Teknologi
- React + TypeScript dengan struktur Next.js App Router (app/page.tsx dan API routes).
- Runtime/build: Vinext + Vite, mengikuti hosting Sites yang digunakan website ini.
- Database: Cloudflare D1 melalui Drizzle ORM.

PENTING: ini source website yang benar-benar dipakai saat ini, bukan hasil migrasi
ke runtime Next.js standar. Menjalankan `next dev` langsung atau mengunggah ke
Vercel membutuhkan penyesuaian build dan penggantian/penyambungan database D1.

## Menjalankan lokal
Gunakan Node.js 22.13 atau lebih baru. Ekstrak ZIP, lalu buka terminal di folder maperca-web.

```sh
npm ci
npm run build
```

Buat tabel database lokal dengan tiga perintah berikut. Jalankan masing-masing
migrasi sekali pada database lokal baru, dalam urutan ini:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_yummy_fantastic_four.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_fat_dagger.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_busy_omega_sentinel.sql
npm run dev
```

Buka http://127.0.0.1:5173 di browser. Untuk menjalankan hasil build, gunakan `npm start`.
Database lokal terpisah dari database website online.

## Versi GitHub Pages + Supabase
Situs yang tayang di GitHub Pages adalah build statis; data pendaftar disimpan di Supabase.

```sh
npm ci
npm run build:pages     # hasil di dist-pages/
npm run preview:pages   # buka http://localhost:4173
```

- Setiap push ke `main` otomatis di-deploy oleh `.github/workflows/pages.yml`.
- `static/` berisi halaman pembuka build statis; `vite.pages.config.ts` adalah konfigurasinya.
- `lib/registration-api.ts` mengirim formulir ke dua fungsi Supabase: `maperca_daftar` dan `maperca_follow`.
- `lib/supabase-config.ts` berisi alamat project dan publishable key. Keduanya memang publik; jangan pernah menaruh service-role key di sana.
- `supabase/migrations/` berisi SQL tabel dan fungsi. Validasi data diulang di dalam fungsi, jadi tidak bergantung pada browser.
- Data pendaftar ada di tabel `registrations` pada schema `maperca`. Lihat lewat dashboard Supabase: Table Editor, lalu ganti schema ke `maperca`. Tabel ini tidak bisa dibaca dari internet.
- `app/api/daftar/` dan `db/` adalah jalur lama (Cloudflare D1). Formulir sudah tidak memanggilnya.

## File utama
- app/page.tsx: tampilan, kolom formulir, langkah follow, dan bukti pendaftaran.
- app/globals.css: desain hijau-hitam, gaya scrapbook, dan tampilan HP.
- app/layout.tsx: judul halaman, deskripsi, dan favicon.
- app/api/daftar/route.ts: validasi dan penyimpanan data pendaftar.
- app/api/daftar/instagram/route.ts: langkah Instagram DAN TikTok, termasuk konfirmasi keduanya.
- db/schema.ts: struktur database.
- drizzle/: migrasi database.
- public/images/: logo HMI, tulisan MAPERCA, dan poster.
- .openai/hosting.json: identitas dan konfigurasi hosting website yang sekarang.

## Catatan follow
Website mencatat bahwa peserta membuka tautan dan menyatakan sudah follow.
Website tidak memeriksa status follow langsung dari Instagram atau TikTok.

## Isi paket
Tidak menyertakan node_modules, cache build, database pendaftar, kredensial Git,
atau isi sesi pengujian. package-lock.json disertakan untuk instalasi yang konsisten.
README.md bawaan tetap disertakan untuk dokumentasi teknis tambahan.
