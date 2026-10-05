# DotMD Mobile (PWA + Worker) — Design Spec

Tarikh: 2026-10-05

## Tujuan

Dari iPhone, paste satu link (web article, post X, post Threads, post Facebook awam) dan dapat Markdown yang bersih untuk Copy / Download / Share ke AI tools untuk repurpose jadi content. Ini pelengkap extension DotMD sedia ada (desktop, Arc/Chrome); extension tak diubah.

## Fakta yang diuji (2026-10-05, tanpa login)

| Sumber | Hasil | Implikasi |
|---|---|---|
| Web article biasa | Boleh (Readability) | Handler utama |
| Medium dari server | HTTP 403 (Cloudflare) | Jangka dapat gagal; mesej cadang guna extension desktop |
| X post tunggal | `cdn.syndication.twimg.com/tweet-result?id=<id>&token=<t>` pulang JSON (`text`, `user`, `created_at`, ...) | Boleh; endpoint tak rasmi, boleh berubah. Tiada thread berantai |
| Threads post awam | Page `threads.com/@user/post/<code>` pulang 200; teks dalam `og:title` / `og:description` | Boleh untuk post awam; tak rasmi |
| Facebook post awam | `og:description` dipotong ~200 aksara; teks penuh hanya jika menyamar crawler | Terhad: hanya teks dipotong + nota. Tidak menyamar crawler |

Pengesahan akhir pada iPhone sebenar dibuat oleh user.

## Skop v1

Dalam skop: web article, post X tunggal, post Threads awam, post Facebook awam (dipotong). Output Markdown + frontmatter sama gaya extension. PWA untuk iPhone Safari (Add to Home Screen).

Di luar skop: thread berantai X, Facebook teks penuh / private / group, kandungan perlu login, history, akaun pengguna, iOS Shortcut (fasa 2; PWA sedia terima `?url=`), Chrome Web Store, Android-specific Share Target.

## Struktur repo

Fail extension kekal di root (tidak dipindah). Tambah:

```
web/      PWA statik: index.html, app.js, style.css, config.js, sw.js, manifest.webmanifest, icons/
worker/   Cloudflare Worker: src/index.js, src/handlers/{web,x,threads,facebook}.js, src/guard.js, wrangler.toml
```

Worker guna semula `extract.js` dan `src/convert.js` dari root, dengan `linkedom` (`parseHTML`) sebagai DOM; Readability, Turndown dan turndown-plugin-gfm dari npm.

## Worker API

`GET /api/clip?url=<encoded-url>` → JSON.

Berjaya:
```json
{ "ok": true, "kind": "web|x|threads|facebook", "title": "...", "markdown": "---\n...", "words": 123, "filename": "slug.md", "note": "optional string" }
```
Gagal: `{ "ok": false, "error": "<code>", "message": "<mesej untuk user, Bahasa Melayu>" }` dengan `error` salah satu: `bad-url`, `unsupported-url`, `blocked`, `timeout`, `too-large`, `not-html`, `no-article`, `private-or-missing`, `fetch-failed`, `internal`.

Pemilihan handler ikut hostname (termasuk `www.`/`mobile.`/`m.`): `x.com`, `twitter.com` → x; `threads.com`, `threads.net` → threads; `facebook.com`, `fb.com`, `fb.watch`, `m.facebook.com` → facebook; selainnya → web.

### Handlers

- **web:** fetch dengan User-Agent browser biasa, follow redirect, had masa 10s, had 3 MB, mesti `text/html`. `parseHTML` (linkedom) → `extractArticle` (root). Hasil `no-article` jika Readability gagal / link-heavy (logik sedia ada).
- **x:** ambil `id` dari path `/<user>/status/<id>`. Panggil endpoint syndication (token dikira dengan formula react-tweet: `((Number(id)/1e15)*Math.PI).toString(36).replace(/(0+|\.)/g,"")`). Markdown: frontmatter (`title: "<author name> (@handle) on X"`, `author: @handle`, `source`, `clipped`), badan = `text`, gambar media sebagai `![](url)`. Kalau 404/tiada → `private-or-missing`.
- **threads:** fetch page post; baca `og:title`/`og:description` (teks post) dan handle dari URL. Teks kosong → `private-or-missing`. Frontmatter sama gaya X.
- **facebook:** fetch dengan UA biasa; baca `og:description` + `og:title`. `note`: "Facebook: teks dipotong (~200 aksara). Post penuh perlu dibuka sendiri." Halaman login / tiada og → `private-or-missing`.

### Keselamatan dan had (guard.js)

- Hanya `http`/`https`; tolak hostname `localhost`, `*.local`, IP literal private/loopback/link-local, dan port selain 80/443.
- Had masa 10s, had saiz respons 3 MB (stream dan henti), `redirect` max 5.
- CORS: `Access-Control-Allow-Origin` hanya untuk origin dalam env `ALLOWED_ORIGIN` (comma-separated); preflight `OPTIONS` dikendalikan; origin lain tak dapat header CORS.
- Tiada storan, tiada log URL oleh kod Worker.

## PWA (web/)

- Satu skrin: input URL, butang **Paste** (`navigator.clipboard.readText`, atas tap user) dan **Clip**.
- Hasil: tajuk, label sumber, bilangan perkataan, `note` jika ada, dan butang **Copy Markdown**, **Download .md**, **Share** (`navigator.share` dengan teks; dengan `File` jika `canShare({files})`; fallback muat turun data URL).
- Ralat: papar `message` dari Worker; ralat rangkaian → "Tak dapat hubungi server DotMD".
- `?url=<encoded>` pada URL app auto-isi dan auto-clip sekali.
- `config.js` ada `API_BASE`; boleh override melalui `localStorage` (supaya self-host Worker sendiri tanpa ubah kod).
- Service worker cache shell sahaja (app boleh dibuka offline; clip perlukan rangkaian). `manifest.webmanifest` standalone, ikon dari ikon sedia ada (192/512 baru dijana).
- Tema ikut `prefers-color-scheme`. Layout phone-first, butang besar.

## Deploy

- PWA: GitHub Pages melalui GitHub Actions (deploy folder `web/` bila push ke `main`).
- Worker: user cipta akaun Cloudflare percuma, `npx wrangler login`, `npx wrangler deploy` dalam `worker/`; set `ALLOWED_ORIGIN` kepada origin Pages. README beri langkah tepat. Had percuma 100,000 permintaan/hari; habis → berhenti tanpa caj.
- Selepas Worker deploy, user (atau saya atas arahan) kemaskini `API_BASE` dalam `web/config.js`.

## Testing

- Unit test (`node:test`): pemilihan handler ikut URL; penjaga keselamatan (private IP, port, skema); formula token X; format Markdown X/Threads/Facebook dari fixture HTML/JSON sebenar yang dipotong; nota Facebook; kod ralat; had saiz; CORS (origin dibenarkan vs tidak); `extractArticle` dengan `linkedom`.
- **Risiko pertama (spike dalam task pertama):** pastikan Readability + Turndown + gfm jalan dengan `linkedom` dan menghasilkan output setara test sedia ada. Jika gagal, laras pendekatan sebelum bina handler lain.
- Pengesahan manual oleh user di iPhone: Add to Home Screen, paste link web, X, Threads, Facebook; Copy / Share / Download.

## Privasi

Link yang dimasukkan dihantar ke Cloudflare Worker milik user untuk diambil. Worker tak simpan atau log URL, tapi Cloudflare ada log infrastruktur biasa. README mesti nyatakan ini.

## Risiko diketahui

- Endpoint X syndication, struktur page Threads dan Facebook tak rasmi; boleh berubah. Mesej ralat jelas dan handler terasing supaya mudah dibaiki.
- Site yang block IP datacenter (contoh Medium) akan gagal melalui Worker; mesej cadang guna extension desktop.
- Facebook sentiasa terhad (teks dipotong) dalam v1.
