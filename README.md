# DotMD

**Turn any article into clean Markdown with one click.**

DotMD is a free browser extension for Arc, Chrome, Brave, Edge and other Chromium browsers. Open an article (Medium, Substack, a blog, a news site), click the DotMD icon, and copy or download the article as a Markdown file. It is made for sharing articles with AI tools like ChatGPT or Claude, so you can rewrite or repurpose them into new content.

🇲🇾 [Baca dalam Bahasa Melayu](README.ms.md)

## What you get

- **Copy Markdown**: puts the article on your clipboard, ready to paste into an AI chat.
- **Download .md**: saves a file named after the article (for example `how-to-do-great-work.md`).
- **Clean output**: only the article. Menus, ads, pop-ups and footers are removed.
- **Info at the top**: title, author, source link and date, so the AI knows where it came from.
- **Works on pages you are logged in to**, because DotMD reads the page you already have open.
- **Private**: everything happens inside your browser. DotMD sends nothing anywhere.

### Example output

```markdown
---
title: How to Do Great Work
source: https://paulgraham.com/greatwork.html
clipped: 2026-10-04
---

# How to Do Great Work

If you collected lists of techniques for doing great work in a lot of different fields...
```

Headings, lists, quotes, code blocks, tables and links are kept. Images stay as links (`![alt](https://...)`). They are not downloaded.

## Install

DotMD is not in the Chrome Web Store yet, so you install it by hand. It takes about one minute and you only do it once.

1. Go to the [latest release](https://github.com/khairul-gigventure/dotmd/releases/latest) and download `dotmd-<version>.zip`.
2. Double-click the zip to unzip it. Put the folder somewhere you will not delete it. The browser reads the extension straight from this folder.
3. Open the extensions page:
   - **Arc:** type `arc://extensions` in the address bar.
   - **Chrome, Brave, Edge:** type `chrome://extensions` (Edge: `edge://extensions`).
4. Turn on **Developer mode** (switch at the top right of the page).
5. Click **Load unpacked** and choose the folder you unzipped (the one that contains `manifest.json`).
6. Pin the DotMD icon to your toolbar so it is easy to find.

**To update:** download the newer zip, replace the files in your folder, then click the reload button on the DotMD card in the extensions page.

## How to use

1. Open an article.
2. Click the DotMD icon. A small window shows the article title and word count.
3. Click **Copy Markdown** or **Download .md**.

If the window says **"Tak jumpa article di page ni"** ("no article found on this page"), you are probably on a home page or a list of links. Open a single article and try again.

## Good to know

- It works best on normal articles and blog posts. Pages that are mostly a list of links (news home pages, Hacker News) are skipped on purpose.
- Some sites load their text late. If the result looks short, wait for the page to finish loading and click again.
- Browser pages such as `chrome://` or `arc://`, and the Chrome Web Store, cannot be read by any extension. The popup says **"Page ni tak boleh diakses"** (this page cannot be accessed).
- Arc does not support the Chrome side panel, so DotMD uses a normal popup.

## Privacy and permissions

DotMD makes **no network requests**, has no account, and collects nothing. It asks for three permissions only:

| Permission | Why |
|---|---|
| `activeTab` | Read the tab you click on, only when you click. |
| `scripting` | Run the converter on that tab. |
| `clipboardWrite` | Let the **Copy Markdown** button copy the text. |

## Mobile (iPhone)

DotMD also has a small web app (PWA) for your phone. Paste a link and get Markdown, with no extension needed.

**What works**

| Link | Result |
|---|---|
| Normal web article | Full article as Markdown |
| X (Twitter) post | The post text and photos (one post, not whole threads) |
| Threads post (public) | The post text |
| Facebook post (public) | Only the first ~200 characters, with a note. Facebook does not give more without login |

**What does not work:** private posts, anything that needs login, X threads (chains of posts), and some sites that block servers (Medium is often blocked here; use the desktop extension for those).

**Use it on iPhone**

1. Open the app address in Safari: `https://khairul-gigventure.github.io/dotmd/` (after you finish "Set it up" below).
2. Tap Share, then **Add to Home Screen**.
3. Open DotMD, tap **Paste** (or type a link), then **Clip**.
4. Tap **Copy Markdown**, **Download .md**, or **Share** (send straight to ChatGPT, Claude or Files).

Tip: you can also open the app with a link already filled in: `<app address>/?url=https://example.com/article`.

**Set it up (one time, free)**

The web app needs a small server to fetch the link for you (a phone browser cannot read other websites directly). It runs on Cloudflare Workers. The free plan allows 100,000 requests per day, but it also limits CPU time per request (about 10 ms). X, Threads and Facebook links are light, but a long web article may hit that limit and fail. If that happens, the Workers Paid plan (about USD 5 per month) removes the problem. Test your own articles after you deploy.

1. Create a free account at [cloudflare.com](https://dash.cloudflare.com/sign-up).
2. In this folder: `npm install`, then `npx wrangler login` (a browser window opens, click Allow).
3. Deploy the server: `npm run worker:deploy`. Copy the address it prints (it ends with `.workers.dev`).
4. Put that address in `web/config.js` as `API_BASE`, then push to GitHub. In your repository go to **Settings → Pages** and set **Source** to **GitHub Actions** (once). After that the web app updates by itself on every push.
5. If your GitHub Pages address is different from `https://khairul-gigventure.github.io`, change `ALLOWED_ORIGIN` in `worker/wrangler.toml` and deploy again. Browsers from other addresses are refused. This is a basic filter, not a password: someone who knows your server address and writes their own program can still send requests. If you see strange traffic, add a rate-limit rule in the Cloudflare dashboard (Security → WAF).

**Privacy for the mobile app:** the link you enter is sent to your own Cloudflare Worker, which fetches the page and returns Markdown. The code stores nothing and does not log links. Cloudflare keeps normal infrastructure logs, as with any Cloudflare service. The browser extension above still makes no network requests of its own.

## For developers

```bash
npm install      # test tools only (the extension itself needs no build step)
npm test         # run the tests
npm run vendor   # refresh lib/ from node_modules
npm run zip      # build dist/dotmd-<version>.zip for a release
npm run worker:dev     # run the mobile server locally (port 8787)
npm run worker:deploy  # deploy the mobile server to Cloudflare
```

How it works: the popup injects [Readability](https://github.com/mozilla/readability) (finds the article) and [Turndown](https://github.com/mixmark-io/turndown) (HTML to Markdown) into the current tab, then returns the Markdown. See `extract.js` (main logic) and `src/convert.js` (title, filename, header block). The original design notes are in [`docs/`](docs/).

Folders: extension files at the root, `web/` (mobile PWA), `worker/` (Cloudflare Worker). Issues and pull requests are welcome. Please run `npm test` before you send a change.

## License

[MIT](LICENSE) © Khairul Ikhwan Zulkefly. DotMD includes Readability (Apache-2.0) and Turndown (MIT). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
