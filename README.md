# DotMD

Extension untuk Arc (dan browser Chromium lain) yang tukar article di tab semasa jadi fail Markdown yang bersih — supaya senang paste atau share ke AI tools untuk repurpose jadi content lain.

## Cara guna

1. Buka article (contoh Medium, Substack, blog).
2. Klik ikon **DotMD** di toolbar. Satu panel muncul di sebelah kanan page.
3. Klik **Copy Markdown** atau **Download .md**.
4. Klik ikon lagi (atau butang ×) untuk tutup panel.

Page yang tak boleh dibuka extension (contohnya `chrome://`) akan tunjuk badge `!` pada ikon.

> Arc tak sokong `chrome.sidePanel`, jadi panel ni dilukis terus dalam page (Shadow DOM) supaya CSS page tak ganggu.

Output ada frontmatter (`title`, `author`, `source`, `clipped`) diikuti `# Title` dan isi article. Gambar kekal sebagai link. Semua proses dalam browser — tiada server, tiada data keluar.

## Install (Arc)

1. Download `dotmd-<version>.zip` dari [Releases](https://github.com/khairul-gigventure/dotmd/releases/latest) (repo private: perlu login GitHub akaun `khairul-gigventure`).
2. Double-click zip tu untuk unzip, dan simpan foldernya di tempat tetap (jangan padam, sebab Arc baca terus dari folder ni).
3. Buka `chrome://extensions` dan hidupkan **Developer mode**.
4. Klik **Load unpacked** dan pilih folder yang dah di-unzip.
5. Pin ikon DotMD di toolbar.

Nak update: download zip versi baru, ganti isi folder lama, dan klik butang reload pada kad DotMD di `chrome://extensions`.

## Development

```bash
npm install     # dev dependencies (tests sahaja)
npm test        # jalankan test
npm run vendor  # update lib/ dari node_modules
npm run zip     # bina dist/dotmd-<version>.zip untuk release
```

Extension sendiri tiada build step — `lib/` dah di-commit.
