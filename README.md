# DotMD

Extension untuk Arc (dan browser Chromium lain) yang tukar article di tab semasa jadi fail Markdown yang bersih — supaya senang paste atau share ke AI tools untuk repurpose jadi content lain.

## Cara guna

1. Buka article (contoh Medium, Substack, blog).
2. Klik ikon **DotMD** di toolbar.
3. Klik **Copy Markdown** atau **Download .md**.

Output ada frontmatter (`title`, `author`, `source`, `clipped`) diikuti `# Title` dan isi article. Gambar kekal sebagai link. Semua proses dalam browser — tiada server, tiada data keluar.

## Install (Arc)

1. Buka `chrome://extensions` (Arc boleh guna URL ni).
2. Hidupkan **Developer mode**.
3. Klik **Load unpacked** dan pilih folder `dotmd` ni.
4. Pin ikon DotMD di toolbar.

## Development

```bash
npm install     # dev dependencies (tests sahaja)
npm test        # jalankan test
npm run vendor  # update lib/ dari node_modules
```

Extension sendiri tiada build step — `lib/` dah di-commit.
