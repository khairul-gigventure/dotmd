# DotMD

**Tukar mana-mana article jadi Markdown yang bersih, dengan satu klik.**

DotMD ialah extension browser percuma untuk Arc, Chrome, Brave, Edge dan browser Chromium yang lain. Buka article (Medium, Substack, blog, laman berita), klik ikon DotMD, dan copy atau download article tu sebagai fail Markdown. Ia dibuat untuk memudahkan awak share article ke AI tools macam ChatGPT atau Claude, supaya boleh repurpose jadi content baru.

🇬🇧 [Read in English](README.md)

## Apa yang awak dapat

- **Copy Markdown**: letak article dalam clipboard, terus paste ke chat AI.
- **Download .md**: simpan fail yang dinamakan ikut tajuk article (contoh `how-to-do-great-work.md`).
- **Output bersih**: hanya article. Menu, iklan, pop-up dan footer dibuang.
- **Maklumat di atas**: tajuk, penulis, link sumber dan tarikh, supaya AI tahu article tu dari mana.
- **Boleh guna pada page yang awak dah login**, sebab DotMD baca page yang awak dah buka.
- **Privasi terjaga**: semua jalan dalam browser awak. DotMD tak hantar apa-apa ke mana-mana.

### Contoh output

```markdown
---
title: How to Do Great Work
source: https://paulgraham.com/greatwork.html
clipped: 2026-10-04
---

# How to Do Great Work

If you collected lists of techniques for doing great work in a lot of different fields...
```

Heading, senarai, quote, code block, jadual dan link dikekalkan. Gambar kekal sebagai link (`![alt](https://...)`) dan tak di-download.

## Cara install

DotMD belum ada dalam Chrome Web Store, jadi install secara manual. Ambil masa lebih kurang satu minit dan awak buat sekali sahaja.

1. Pergi ke [release terkini](https://github.com/khairul-gigventure/dotmd/releases/latest) dan download `dotmd-<versi>.zip`.
2. Double-click zip untuk unzip. Simpan folder tu di tempat yang awak takkan padam. Browser baca extension terus dari folder ni.
3. Buka page extensions:
   - **Arc:** taip `arc://extensions` di address bar.
   - **Chrome, Brave, Edge:** taip `chrome://extensions` (Edge: `edge://extensions`).
4. Hidupkan **Developer mode** (suis di penjuru kanan atas page).
5. Klik **Load unpacked** dan pilih folder yang awak unzip (yang ada fail `manifest.json`).
6. Pin ikon DotMD di toolbar supaya senang cari.

**Nak update:** download zip yang lebih baru, ganti fail dalam folder awak, kemudian klik butang reload pada kad DotMD di page extensions.

## Cara guna

1. Buka article.
2. Klik ikon DotMD. Satu tetingkap kecil tunjuk tajuk article dan bilangan perkataan.
3. Klik **Copy Markdown** atau **Download .md**.

Kalau tetingkap cakap **"Tak jumpa article di page ni"**, mungkin awak di home page atau senarai link. Buka satu article dan cuba lagi.

## Perkara yang patut tahu

- Paling sesuai untuk article dan blog post biasa. Page yang kebanyakannya senarai link (home page berita, Hacker News) sengaja dilangkau.
- Ada site yang load teks lambat. Kalau hasil nampak pendek, tunggu page siap load dan klik semula.
- Page browser seperti `chrome://` atau `arc://`, dan Chrome Web Store, tak boleh dibaca oleh mana-mana extension. Popup akan cakap **"Page ni tak boleh diakses"**.
- Arc tak sokong side panel Chrome, jadi DotMD guna popup biasa.

## Privasi dan permission

DotMD **tak buat sebarang network request**, tiada akaun, dan tak kumpul apa-apa. Ia minta tiga permission sahaja:

| Permission | Kenapa |
|---|---|
| `activeTab` | Baca tab yang awak klik, hanya bila awak klik. |
| `scripting` | Jalankan penukar pada tab tu. |
| `clipboardWrite` | Benarkan butang **Copy Markdown** copy teks. |

## Mobile (iPhone)

DotMD ada juga web app kecil (PWA) untuk phone. Paste link dan dapat Markdown, tanpa extension.

**Apa yang jalan**

| Link | Hasil |
|---|---|
| Web article biasa | Article penuh sebagai Markdown |
| Post X (Twitter) | Teks post dan gambar (satu post, bukan thread penuh) |
| Post Threads (awam) | Teks post |
| Post Facebook (awam) | Hanya ~200 aksara pertama, dengan nota. Facebook tak bagi lebih tanpa login |

**Apa yang tak jalan:** post private, apa-apa yang perlu login, thread X (rangkaian post), dan site yang block server (Medium selalunya kena block di sini; guna extension desktop untuk itu).

**Guna di iPhone**

1. Buka alamat app dalam Safari: `https://khairul-gigventure.github.io/dotmd/` (selepas siap "Cara set up" di bawah).
2. Tekan Share, kemudian **Add to Home Screen**.
3. Buka DotMD, tekan **Paste** (atau taip link), kemudian **Clip**.
4. Tekan **Copy Markdown**, **Download .md**, atau **Share** (hantar terus ke ChatGPT, Claude atau Files).

Tip: app boleh dibuka dengan link yang dah terisi: `<alamat app>/?url=https://example.com/article`.

**Cara set up (sekali sahaja, percuma)**

Web app perlukan server kecil untuk ambil link bagi pihak awak (browser phone tak boleh baca website lain terus). Ia jalan atas Cloudflare Workers. Plan percuma bagi 100,000 permintaan sehari, tapi ada had masa CPU setiap permintaan (lebih kurang 10 ms). Link X, Threads dan Facebook ringan, tapi web article yang panjang mungkin terkena had ni dan gagal. Kalau berlaku, plan Workers Paid (lebih kurang USD 5 sebulan) selesaikan masalah tu. Cuba article awak sendiri selepas deploy.

1. Buat akaun percuma di [cloudflare.com](https://dash.cloudflare.com/sign-up).
2. Dalam folder ni: `npm install`, kemudian `npx wrangler login` (tetingkap browser terbuka, klik Allow).
3. Deploy server: `npm run worker:deploy`. Salin alamat yang keluar (berakhir dengan `.workers.dev`).
4. Letak alamat tu dalam `web/config.js` sebagai `API_BASE`, kemudian push ke GitHub. Dalam repository, pergi **Settings → Pages** dan set **Source** kepada **GitHub Actions** (sekali sahaja). Lepas tu web app update sendiri setiap kali push.
5. Kalau alamat GitHub Pages awak lain daripada `https://khairul-gigventure.github.io`, tukar `ALLOWED_ORIGIN` dalam `worker/wrangler.toml` dan deploy semula. Browser dari alamat lain akan ditolak. Ini penapis asas, bukan kata laluan: orang yang tahu alamat server awak dan menulis program sendiri masih boleh hantar permintaan. Kalau nampak trafik pelik, tambah rule rate-limit dalam dashboard Cloudflare (Security → WAF).

**Privasi untuk app mobile:** link yang awak masukkan dihantar ke Cloudflare Worker milik awak sendiri, yang ambil page dan pulangkan Markdown. Kod tak simpan apa-apa dan tak log link. Cloudflare simpan log infrastruktur biasa, seperti mana-mana servis Cloudflare. Extension browser di atas masih tak buat sebarang network request sendiri.

## Untuk developer

```bash
npm install      # tools untuk test sahaja (extension sendiri tak perlu build)
npm test         # jalankan test
npm run vendor   # update lib/ dari node_modules
npm run zip      # bina dist/dotmd-<versi>.zip untuk release
npm run worker:dev     # jalankan server mobile secara lokal (port 8787)
npm run worker:deploy  # deploy server mobile ke Cloudflare
```

Cara ia berfungsi: popup inject [Readability](https://github.com/mozilla/readability) (cari article) dan [Turndown](https://github.com/mixmark-io/turndown) (HTML ke Markdown) ke tab semasa, kemudian pulangkan Markdown. Lihat `extract.js` (logik utama) dan `src/convert.js` (tajuk, nama fail, header). Nota design asal ada dalam [`docs/`](docs/).

Folder: fail extension di root, `web/` (PWA mobile), `worker/` (Cloudflare Worker). Issue dan pull request dialu-alukan. Sila jalankan `npm test` sebelum hantar perubahan.

## Lesen

[MIT](LICENSE) © Khairul Ikhwan Zulkefly. DotMD mengandungi Readability (Apache-2.0) dan Turndown (MIT). Lihat [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
