# DotMD — Design Spec

Tarikh: 2026-10-04

## Tujuan

Browser extension (Chromium, Manifest V3) untuk Arc browser. Dengan satu klik, tukar article di tab semasa (contoh Medium) jadi fail Markdown yang bersih, supaya senang di-paste atau di-share ke AI tools untuk repurpose jadi content lain.

## Success criteria

- Buka article, klik ikon DotMD, dan dalam beberapa saat boleh Copy atau Download Markdown.
- Output kemas, boleh terus paste ke Claude / ChatGPT.
- Jalan pada Medium, Substack dan blog biasa, termasuk article yang perlu login (sebab baca page yang dah load dalam tab).
- Tiada server, tiada API key, tiada data keluar dari browser.

## Pendekatan (dipilih: A)

Readability.js (ekstrak isi article) + Turndown (HTML → Markdown), kedua-duanya di-bundle dalam folder extension. Tiada build step.

Ditolak: (B) servis luar seperti r.jina.ai: gagal untuk content login/paywall dan hantar URL ke pihak ketiga. (C) scraper khas per site: rapuh.

## Struktur folder

```
dotmd/
  manifest.json        # MV3; permissions: activeTab, scripting, clipboardWrite
  popup.html / popup.js / popup.css
  extract.js           # inject ke page: Readability -> Turndown -> Markdown
  lib/Readability.js
  lib/turndown.js
```

## UX

1. User buka article, klik ikon DotMD di toolbar.
2. Popup tunjuk tajuk article, bilangan perkataan, dan dua button: **Copy Markdown** dan **Download .md**.
3. Selepas klik: status "Copied ✓" atau fail turun.

## Output

Frontmatter YAML di atas, diikuti `# Title` dan isi article:

```
---
title: Judul Article
author: Nama Penulis
source: https://...
clipped: 2026-10-04
---

# Judul Article

...isi...
```

- Field yang tak jumpa (author, dll.) dibuang dari frontmatter. Tidak tulis "undefined".
- Gambar kekal sebagai link `![alt](url)`; tiada download gambar.
- Nama fail: slug daripada tajuk, contoh `judul-article.md`.
- Elemen disokong: heading, paragraph, list, blockquote, code block, jadual, link, gambar, bold/italic.

## Aliran data

Klik ikon → popup inject `extract.js` ke tab (activeTab + scripting) → Readability ambil article → Turndown tukar ke Markdown → tambah frontmatter → hantar balik ke popup → Copy (clipboardWrite) atau Download (Blob).

## Error handling

- Page bukan article (homepage, dashboard): popup tunjuk "Tak jumpa article di page ni". Tiada output kosong.
- Page tak boleh diakses (`chrome://`, Chrome Web Store): mesej jelas, bukan crash.
- Author/tarikh tiada: dibuang dari frontmatter.

## Permissions dan privasi

- `activeTab`: hanya akses tab yang user klik, tiada baca semua website.
- Semua pemprosesan dalam browser. Tiada network request oleh extension.

## Testing

- Unit-style test untuk logik penukaran guna sample HTML (heading, list, quote, code block, jadual, gambar, frontmatter, field hilang).
- Verify output sebenar pada Medium, Substack dan satu blog biasa dalam browser.
- Ujian terakhir oleh user dalam Arc (Load unpacked di `chrome://extensions`, Developer mode).

## Di luar skop (YAGNI)

Setting page, keyboard shortcut, history, download gambar, clip bahagian terpilih sahaja, sync ke cloud. Boleh ditambah kemudian jika perlu.
