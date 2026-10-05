# DotMD Mobile (PWA + Worker) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user paste a link on iPhone (web article, X post, Threads post, public Facebook post) into a PWA and get clean Markdown to Copy / Download / Share.

**Architecture:** A static PWA (`web/`) calls a Cloudflare Worker (`worker/`) at `GET /api/clip?url=`. The Worker picks a handler by hostname; the web handler reuses the existing root `extract.js` with `linkedom` as the DOM. Social handlers read X's syndication JSON and Open Graph tags. All network access goes through one guarded `fetchLimited`.

**Tech Stack:** Cloudflare Workers (ESM), `wrangler`, `linkedom`, `@mozilla/readability`, `turndown`, `turndown-plugin-gfm`, Node `node:test`, vanilla JS PWA, GitHub Pages + Actions.

**Spec:** `docs/superpowers/specs/2026-10-05-dotmd-mobile-pwa-design.md`

## Global Constraints

- Extension files at the repo root are not moved or changed in behavior; root `npm test` (19 existing tests) must stay green after every task.
- Worker code is ESM (`worker/package.json` = `{"type":"module"}`); it imports root CommonJS with a default import: `import extract from "../../extract.js"; const { extractArticle } = extract;` and likewise `../../src/convert.js`.
- One root `package.json` holds all dependencies (add `linkedom`, `wrangler` as devDependencies); no per-folder installs. Scripts: `"worker:dev": "wrangler dev -c worker/wrangler.toml"`, `"worker:deploy": "wrangler deploy -c worker/wrangler.toml"`. `npm test` stays `node --test` (it discovers `worker/tests` and `web/tests`).
- `ClipResult` = `{ok:true, kind:"web"|"x"|"threads"|"facebook", title, markdown, words, filename, note?}` | `{ok:false, error:<code>}`. Error codes exactly: `bad-url`, `unsupported-url`, `blocked`, `timeout`, `too-large`, `not-html`, `no-article`, `private-or-missing`, `fetch-failed`, `internal`.
- Markdown for every kind uses `buildMarkdown(meta, body)` from `src/convert.js` (frontmatter keys `title`, `author`, `source`, `clipped`); `words` = whitespace-split count of the body text.
- Handler signature: `handleX(url: URL, deps: {fetchLimited, now: Date}): Promise<ClipResult>`; handlers never call global `fetch`.
- Worker guard: only `http`/`https`, ports 80/443 only, 10 s timeout, 3,000,000-byte cap, at most 5 redirects, every redirect hop re-validated.
- Malay user-facing strings exactly as in `ERROR_MESSAGES` (Task 6). Facebook note exactly: `Facebook: teks dipotong (~200 aksara). Post penuh perlu dibuka sendiri.`
- Worker stores nothing and logs no URLs. No `console.log` of request URLs.
- Local commits per task are part of this plan (the user's approval of the plan covers them; end each commit message with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`). **Nothing is pushed, no GitHub setting is changed, no Cloudflare deploy happens before Task 8, and Task 8 asks the user first.**

## Review Focus

- URL tricks that reach private hosts: `http://user:pw@host`, `http://2130706433/`, `http://0x7f.1/`, `http://[::1]/`, `http://localhost./`, `http://169.254.169.254/` must all be rejected (Task 2).
- A public URL that redirects to a private address must be rejected at the redirect hop (Task 2).
- A response with no `Content-Length` that streams past 3 MB, or never finishes, must stop with `too-large` / `timeout` (Task 2).
- X URL variants still yield the id: `/i/status/<id>`, `mobile.twitter.com`, trailing `/photo/1`, `?s=20`; Threads URLs with trailing slug and `threads.net` host (Tasks 4–5).
- iPhone paste often contains a title plus the link plus punctuation, e.g. `Judul article https://x.com/a/status/1.` — the PWA must extract the clean URL (Task 7).

---

### Task 1: Worker scaffold and linkedom spike

**Files:**
- Create: `worker/package.json`, `worker/wrangler.toml`, `worker/src/dom.js`, `worker/tests/dom.test.js`
- Modify: `package.json` (devDependencies + scripts)

**Interfaces:**
- Produces: `parseDoc(html: string, url: string): Document` in `worker/src/dom.js` — linkedom `parseHTML`, injecting `<base href="<url>">` into `<head>` when the page has none, so relative URLs resolve.

- [ ] **Step 1: `npm install --save-dev linkedom wrangler`; create `worker/package.json` (`{"type":"module"}`), `worker/wrangler.toml` (`name = "dotmd-clip"`, `main = "src/index.js"`, `compatibility_date = "2026-10-01"`, `[vars] ALLOWED_ORIGIN = "https://khairul-gigventure.github.io"`), and the two scripts from Global Constraints.**
- [ ] **Step 2: Write failing tests in `worker/tests/dom.test.js`** using fixtures from `tests/fixtures/` (read with `fs`), `extractArticle` from root `extract.js`, and real Readability/Turndown/gfm, with `doc = parseDoc(html, "https://blog.example.com/post")`:
  - `article.html` → `ok === true`; markdown contains `## A list`, `- ` list item, `> A wise quote`, ```` ```js ````, `function hi() {\n  return 1;\n}`, a `| --- |` row, `![diagram](https://blog.example.com/img/a.png)`, `(https://blog.example.com/b)`, `author: Aisyah Rahman`; does not contain `NAVNOISE` or `FOOTERNOISE`.
  - `roundup.html` → `ok === true`; `homepage.html` and `listing.html` → `{ok:false, reason:"no-article"}`.
- [ ] **Step 3: Run `npm test`; expected FAIL (`parseDoc` missing).**
- [ ] **Step 4: Implement `parseDoc` in `worker/src/dom.js`.** If any assertion fails after that, make the smallest change in `dom.js` (preferred) or a behavior-neutral change in root `extract.js` so both jsdom and linkedom tests pass; record the finding as a comment at the top of `dom.js`. If linkedom cannot satisfy the assertions at all, stop and report to the user (the plan's approach is invalid).
- [ ] **Step 5: Run `npm test`; expected all PASS (19 existing + new).** Commit `feat(worker): scaffold and linkedom DOM adapter`.

### Task 2: Guarded fetch (`guard.js`)

**Files:**
- Create: `worker/src/guard.js`, `worker/tests/guard.test.js`

**Interfaces:**
- Produces:
  - `validateUrl(raw: string): {ok:true, url:URL} | {ok:false, error:"bad-url"|"unsupported-url"}` — `bad-url` for unparsable input; `unsupported-url` for non-http(s), userinfo present, port other than 80/443, hostname `localhost` / ending `.localhost` / `.local` / trailing-dot variants, or an IP literal (v4 in any dotted/decimal/hex/octal form, or v6) in a private, loopback, link-local, unspecified or metadata range (`10/8`, `127/8`, `169.254/16`, `172.16/12`, `192.168/16`, `0/8`, `100.64/10`, `::1`, `fc00::/7`, `fe80::/10`).
  - `fetchLimited(url: URL, opts?: {fetchImpl?: typeof fetch, timeoutMs?: number, maxBytes?: number, requireHtml?: boolean, headers?: Record<string,string>}): Promise<{ok:true, text:string, finalUrl:string, contentType:string} | {ok:false, error:"timeout"|"too-large"|"blocked"|"not-html"|"private-or-missing"|"fetch-failed"|"unsupported-url"}>` — defaults `timeoutMs=10000`, `maxBytes=3000000`, `requireHtml=true`; browser-like `User-Agent` and `Accept-Language` default headers; manual redirects (max 5), each `Location` resolved and re-validated with `validateUrl`; status 401/403/429 → `blocked`, 404/410 → `private-or-missing`, other non-2xx → `fetch-failed`; body read as a stream and aborted past `maxBytes`.

- [ ] **Step 1: Write failing tests** (`fetchImpl` stubbed; no real network):
  - `validateUrl` accepts `https://example.com/a?b=1`; rejects each Review Focus URL, `ftp://x.com`, `https://example.com:8443/`, `javascript:alert(1)`, `not a url` with the codes above.
  - `fetchLimited`: returns text and `finalUrl` on 200 `text/html`; 403 → `blocked`; 429 → `blocked`; 404 → `private-or-missing`; 500 → `fetch-failed`; `text/plain` with `requireHtml` default → `not-html`, but ok with `requireHtml:false`; redirect to `http://127.0.0.1/` → `unsupported-url`; 6 chained redirects → `fetch-failed`; a stream of 4,000,000 bytes without `Content-Length` and `maxBytes` default → `too-large`; a stub that never resolves with `timeoutMs:50` → `timeout`; `fetchImpl` throwing → `fetch-failed`.
- [ ] **Step 2: Run `npm test`; expected FAIL.**
- [ ] **Step 3: Implement both functions.** Use `AbortController` for the timeout; decode with `TextDecoder` after collecting chunks.
- [ ] **Step 4: Run `npm test`; expected all PASS.** Commit `feat(worker): guarded fetch with SSRF protection`.

### Task 3: Web handler

**Files:**
- Create: `worker/src/handlers/web.js`, `worker/tests/web.test.js`

**Interfaces:**
- Consumes: `parseDoc` (Task 1), `extractArticle` from root `extract.js`, `fetchLimited` shape (Task 2).
- Produces: `handleWeb(url: URL, deps: {fetchLimited, now: Date}): Promise<ClipResult>` with `kind: "web"`; frontmatter `source` = the response `finalUrl`.

- [ ] **Step 1: Write failing tests** with a stub `fetchLimited` returning `{ok:true, text:<tests/fixtures/article.html>, finalUrl:"https://blog.example.com/post", contentType:"text/html"}`:
  - success: `ok`, `kind:"web"`, `markdown` starts with `---\ntitle:`, contains `source: https://blog.example.com/post` and `clipped: 2026-10-05` (fixed `now`), `filename` ends `.md`, `words > 0`.
  - `homepage.html` → `{ok:false, error:"no-article"}`.
  - stub returning `{ok:false, error:"blocked"}` → `{ok:false, error:"blocked"}` (passthrough).
- [ ] **Step 2: Run `npm test`; expected FAIL.**
- [ ] **Step 3: Implement `handleWeb`;** map `extractArticle`'s `{ok:false}` to `error:"no-article"` or `internal` on `reason:"error"`.
- [ ] **Step 4: Run `npm test`; expected PASS.** Commit `feat(worker): web article handler`.

### Task 4: X handler

**Files:**
- Create: `worker/src/handlers/x.js`, `worker/tests/x.test.js`, `worker/tests/fixtures/x-tweet.json`

**Interfaces:**
- Consumes: `buildMarkdown`, `slugify`, `todayISO` from `src/convert.js`; `fetchLimited` (Task 2).
- Produces:
  - `parseXUrl(url: URL): {handle: string, id: string} | null` — host `x.com`, `twitter.com`, `mobile.twitter.com`, `www.` variants; paths `/<handle>/status/<id>` (extra segments / query ignored) and `/i/status/<id>` (handle `"i"`).
  - `xToken(id: string): string` — `((Number(id)/1e15)*Math.PI).toString(36).replace(/(0+|\.)/g,"")`.
  - `handleX(url, deps): Promise<ClipResult>` — fetches `https://cdn.syndication.twimg.com/tweet-result?id=<id>&token=<xToken(id)>` via `deps.fetchLimited(..., {requireHtml:false})`; `kind:"x"`; title `"<user.name> (@<user.screen_name>) on X"`; `author: @<screen_name>`; `source` = the original URL string; body = `text` followed by one `![](<media_url_https>)` per `mediaDetails` entry of type `photo`; filename `x-<screen_name>-<id>.md`.

- [ ] **Step 1: Create `x-tweet.json`** (subset of the real response for id `20`: `__typename:"Tweet"`, `id_str`, `text:"just setting up my twttr"`, `created_at`, `user:{name:"jack", screen_name:"jack"}`, plus one `mediaDetails` photo entry with `media_url_https:"https://pbs.twimg.com/media/abc.jpg"`).
- [ ] **Step 2: Write failing tests:** `parseXUrl` for `https://x.com/jack/status/20`, `https://twitter.com/jack/status/20?s=20`, `https://mobile.twitter.com/jack/status/20`, `https://x.com/i/status/20`, `https://x.com/jack/status/20/photo/1` → id `20`; `https://x.com/jack` → `null`. `xToken("20")` matches `/^[a-z1-9]+$/` and is stable across calls. `handleX` with stub returning the fixture: frontmatter has `author: @jack`, body contains `just setting up my twttr` and `![](https://pbs.twimg.com/media/abc.jpg)`, filename `x-jack-20.md`; the requested URL contains `id=20&token=`; stub `{ok:false,error:"private-or-missing"}` → passthrough; JSON `{"__typename":"TweetTombstone"}` or empty body → `private-or-missing`; non-JSON text → `fetch-failed`; URL without status id → `unsupported-url`.
- [ ] **Step 3: Run `npm test`; expected FAIL.**
- [ ] **Step 4: Implement the three functions.**
- [ ] **Step 5: Run `npm test`; expected PASS.** Commit `feat(worker): X post handler`.

### Task 5: Threads and Facebook handlers (Open Graph)

**Files:**
- Create: `worker/src/og.js`, `worker/src/handlers/threads.js`, `worker/src/handlers/facebook.js`, `worker/tests/og.test.js`, `worker/tests/fixtures/threads-post.html`, `worker/tests/fixtures/facebook-post.html`, `worker/tests/fixtures/facebook-login.html`

**Interfaces:**
- Produces:
  - `readOg(html: string): {title?: string, description?: string, siteName?: string}` — reads `<meta property="og:title|og:description|og:site_name" content="...">` (either attribute order), decodes HTML entities (named basics, `&#064;`, `&#039;`, `&#x2022;`).
  - `parseThreadsUrl(url: URL): {handle: string, code: string} | null` — hosts `threads.com`, `threads.net` (+`www.`), path `/@<handle>/post/<code>` with optional trailing segments.
  - `handleThreads(url, deps): Promise<ClipResult>` — `kind:"threads"`, text = `og:description` falling back to `og:title`; title `"@<handle> on Threads"`, `author: @<handle>`; filename `threads-<handle>-<code>.md`; empty text → `private-or-missing`.
  - `handleFacebook(url, deps): Promise<ClipResult>` — `kind:"facebook"`, body = `og:description`, title = `og:title`, `note` = the exact Facebook note from Global Constraints, filename `facebook-<slugify(title)>.md`; missing `og:description`, or `og:title` matching `/log in|masuk|facebook$/i` with no description → `private-or-missing`.

- [ ] **Step 1: Write fixtures** as minimal `<head>` documents: Threads post (`og:title` and `og:description` = `Good conversation with &#064;hubermanlab about AI`), Facebook post (`og:title` = `Mark Zuckerberg - Every year, I take on a personal... | Facebook`, `og:description` = `Every year, I take on a personal challenge...`), Facebook login (`og:title` = `Log in to Facebook`, no description).
- [ ] **Step 2: Write failing tests:** `readOg` decodes `&#064;` → `@`, `&#039;` → `'`, handles attribute order swap, returns `{}` when absent. `parseThreadsUrl` for `https://www.threads.com/@zuck/post/Cywjyrdv9T6`, `.../post/Cywjyrdv9T6/some-slug?x=1`, `https://www.threads.net/@zuck/post/Cywjyrdv9T6` → handle `zuck`, code `Cywjyrdv9T6`; `https://www.threads.com/@zuck` → `null`. `handleThreads` with stub: body contains `Good conversation with @hubermanlab`, `author: @zuck`, filename `threads-zuck-Cywjyrdv9T6.md`; empty-description page → `private-or-missing`. `handleFacebook`: success has `note` equal to the exact string, markdown body is the description; login fixture → `private-or-missing`.
- [ ] **Step 3: Run `npm test`; expected FAIL.**
- [ ] **Step 4: Implement `readOg` (regex based) and the two handlers.**
- [ ] **Step 5: Run `npm test`; expected PASS.** Commit `feat(worker): Threads and Facebook handlers`.

### Task 6: Router, CORS and error messages

**Files:**
- Create: `worker/src/index.js`, `worker/src/messages.js`, `worker/tests/index.test.js`

**Interfaces:**
- Consumes: `validateUrl`, `fetchLimited` (Task 2); `handleWeb`, `handleX`, `handleThreads`, `handleFacebook`.
- Produces:
  - `pickHandler(url: URL): "web"|"x"|"threads"|"facebook"` — `x.com`, `twitter.com`, `mobile.twitter.com` → x; `threads.com`, `threads.net` → threads; `facebook.com`, `m.facebook.com`, `fb.com`, `fb.watch` → facebook (all with optional `www.`); else web.
  - `ERROR_MESSAGES: Record<ErrorCode,string>` in `messages.js` (exact Malay strings): `bad-url` "Link ni tak sah. Semak dan cuba lagi." · `unsupported-url` "Link jenis ni tak disokong." · `blocked` "Site ni block pengambilan dari server. Cuba buka di browser desktop dan guna extension DotMD." · `timeout` "Site ambil masa terlalu lama. Cuba lagi sekejap lagi." · `too-large` "Page ni terlalu besar untuk ditukar." · `not-html` "Link ni bukan page web biasa." · `no-article` "Tak jumpa article di page ni." · `private-or-missing` "Post ni private, dipadam, atau tak boleh dibaca tanpa login." · `fetch-failed` "Gagal ambil page ni. Cuba lagi." · `internal` "Ada masalah di server DotMD. Cuba lagi."
  - `createWorker(deps?: {handlers?: Record<string, Function>, fetchLimited?: Function, now?: () => Date}): {fetch(request: Request, env: {ALLOWED_ORIGIN?: string}): Promise<Response>}`; `export default createWorker()`.
  - HTTP behavior: only `GET /api/clip?url=` (404 otherwise; 405 for other methods except `OPTIONS` → 204 with `Access-Control-Allow-Methods: GET, OPTIONS` and `Access-Control-Allow-Headers: content-type`). Success → 200 JSON `ClipResult`. Failure → JSON `{ok:false, error, message}` with status: `bad-url`/`unsupported-url` 400, `blocked` 502, `timeout` 504, `too-large` 413, `not-html` 415, `no-article` 422, `private-or-missing` 404, `fetch-failed` 502, `internal` 500. A thrown handler error → `internal`. `Access-Control-Allow-Origin` is set to the request `Origin` only when it appears in `env.ALLOWED_ORIGIN` (comma-separated) or is `http://localhost:*` / `http://127.0.0.1:*`; otherwise the header is absent. Add `Vary: Origin`. `Cache-Control: no-store`.

- [ ] **Step 1: Write failing tests** with stub handlers: `pickHandler` table (including `https://www.facebook.com/x`, `https://fb.watch/abc`, `https://mobile.twitter.com/a/status/1`, `https://example.com`); missing `url` → 400 `bad-url` with the Malay message; private URL → 400 `unsupported-url`; routes to the stub chosen by hostname and returns its JSON; stub error `blocked` → 502 with message; a throwing stub → 500 `internal`; allowed origin gets `Access-Control-Allow-Origin` echoed, disallowed origin does not; `OPTIONS` → 204 with CORS headers; `POST` → 405; unknown path → 404.
- [ ] **Step 2: Run `npm test`; expected FAIL.**
- [ ] **Step 3: Implement `messages.js` and `index.js`.**
- [ ] **Step 4: Run `npm test`; expected PASS.**
- [ ] **Step 5: End-to-end locally:** run `npm run worker:dev` in the background (port 8787) and request, expecting the stated results: `curl 'http://127.0.0.1:8787/api/clip?url=https://paulgraham.com/greatwork.html'` → `"ok":true,"kind":"web"`; `...?url=https://x.com/jack/status/20` → `"kind":"x"` and text `just setting up my twttr`; `...?url=http://127.0.0.1/` → `"unsupported-url"`; a Threads post URL and the Facebook post `https://www.facebook.com/zuck/posts/10102577175875681` → `"kind":"threads"` / `"kind":"facebook"` with the note (if a live site has changed, record the observed behavior in the final report; do not weaken tests). Stop the dev server. Commit `feat(worker): router, CORS and error messages`.

### Task 7: PWA (`web/`)

**Files:**
- Create: `web/index.html`, `web/style.css`, `web/app.js`, `web/clip.js`, `web/config.js`, `web/sw.js`, `web/manifest.webmanifest`, `web/icons/{icon-180,icon-192,icon-512}.png`, `web/tests/clip.test.js`, `scripts/make-icons.py`

**Interfaces:**
- Produces in `web/clip.js` (ES module, no DOM access):
  - `extractUrl(text: string): string | null` — first `http(s)://…` token in the text, with trailing `. , ; : ! ? ) ] ' "` removed; `null` if none.
  - `parseQueryUrl(search: string): string | null` — value of `?url=` (decoded) passed through `extractUrl`.
  - `getApiBase(storage: {getItem(k:string):string|null}, config: {API_BASE:string}): string` — `storage.getItem("dotmd-api-base")` if non-empty else `config.API_BASE`; trailing slash trimmed; `""` if neither.
  - `clipEndpoint(apiBase: string, url: string): string` — `<apiBase>/api/clip?url=<encodeURIComponent(url)>`.
- `web/config.js` exports `API_BASE = ""` (set in Task 8).

- [ ] **Step 1: Write failing tests in `web/tests/clip.test.js`:** `extractUrl("Judul article https://x.com/a/status/1.")` → `https://x.com/a/status/1`; `extractUrl("(https://example.com/a?b=1)")` → `https://example.com/a?b=1`; `extractUrl("tiada link")` → `null`; text with two links → the first. `parseQueryUrl("?url=https%3A%2F%2Fexample.com%2Fa")` → `https://example.com/a`; `parseQueryUrl("")` → `null`. `getApiBase` prefers storage override, trims a trailing `/`, returns `""` when nothing set. `clipEndpoint("https://w.dev/", "https://a.com/?q=1&r=2")` → `https://w.dev/api/clip?url=https%3A%2F%2Fa.com%2F%3Fq%3D1%26r%3D2`.
- [ ] **Step 2: Run `npm test`; expected FAIL.**
- [ ] **Step 3: Implement `clip.js`.**
- [ ] **Step 4: Run `npm test`; expected PASS.**
- [ ] **Step 5: Build the UI.** `index.html` (viewport-fit=cover, `apple-mobile-web-app-capable`, `apple-touch-icon` → `icons/icon-180.png`, `theme-color`, link to manifest), a single column: URL input, **Paste** and **Clip** buttons, a status area, and a result card (title, source label `Web | X | Threads | Facebook`, word count, optional note, **Copy Markdown**, **Download .md**, **Share**). `app.js` (module): Paste via `navigator.clipboard.readText()` then `extractUrl`; Clip → `fetch(clipEndpoint(...))`; show `message` from error JSON; network failure → `Tak dapat hubungi server DotMD`; empty `API_BASE` → `Server DotMD belum diset. Lihat README.`; `?url=` on load auto-fills and auto-clips once; Copy via `navigator.clipboard.writeText` with `Copied ✓` / `Gagal copy`; Share via `navigator.share({text})`, using `{files:[new File(...)]}` when `navigator.canShare({files})` is true; Download via the same file-share when available, else a `data:` URL anchor. `style.css`: phone-first, ≥44px tap targets, `prefers-color-scheme` dark mode. `sw.js`: precache the shell files, cache-first for shell, network-only for `/api/`. `manifest.webmanifest`: `name "DotMD"`, `display "standalone"`, `start_url "./"`, `scope "./"`, icons 192/512, theme/background colors. `scripts/make-icons.py` renders the 180/192/512 PNGs in pure Python (no dependencies), same design as `icons/icon128.png` (dark `#111827` rounded square, white "M", green `#34d399` dot); run it.
- [ ] **Step 6: Verify in the browser pane:** serve `web/` on `127.0.0.1:8765`, run `npm run worker:dev`, set the override in the page console (`localStorage.setItem("dotmd-api-base","http://127.0.0.1:8787")`), reload, clip a web article, an X link and a bad link; confirm result card, note, error text, and that Copy puts the Markdown on the clipboard (or shows `Gagal copy` if the pane forbids it). Resize to the mobile preset and take one screenshot. Stop both servers. Commit `feat(web): PWA`.

### Task 8: Deploy, docs and handoff (asks the user first)

**Files:**
- Create: `.github/workflows/pages.yml`
- Modify: `README.md`, `README.ms.md`, `web/config.js`, `.gitignore` (add `.wrangler/`)

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Docs.** Add a "Mobile (iPhone)" section to both READMEs (EN + MS, simple language): what it does, what works (web, X single post, Threads public post, Facebook public post truncated), what does not (X thread chains, Facebook full text, private posts, Medium may be blocked), the privacy note (links go through your Cloudflare Worker; it stores nothing; Cloudflare keeps normal infrastructure logs), Add to Home Screen steps for Safari, and the self-host steps: create a free Cloudflare account → `npm install` → `npx wrangler login` → `npm run worker:deploy` → copy the `*.workers.dev` URL → put it in `web/config.js` (or set it in the app via the console override) → push. Mention the 100,000 requests/day free limit.
- [ ] **Step 2: `.github/workflows/pages.yml`:** on push to `main` affecting `web/**`, upload `web/` with `actions/upload-pages-artifact` and deploy with `actions/deploy-pages` (permissions `pages: write`, `id-token: write`).
- [ ] **Step 3: Ask the user** (one message): ready to (a) push these commits, (b) enable GitHub Pages with source "GitHub Actions" (`gh api -X POST repos/khairul-gigventure/dotmd/pages -f build_type=workflow`), and (c) deploy the Worker — and explain that (c) needs the user's own Cloudflare login (`npx wrangler login` opens a browser) which the agent cannot do for them. Wait for the answer.
- [ ] **Step 4: On "yes":** push, enable Pages, confirm `https://khairul-gigventure.github.io/dotmd/` returns 200 after the workflow succeeds (`gh run watch`). Guide the user through `npx wrangler login` and `npm run worker:deploy`; when they give the `workers.dev` URL, set `API_BASE` in `web/config.js`, run `npm test`, commit `chore(web): set API base`, push, and verify with `curl '<worker-url>/api/clip?url=https://paulgraham.com/greatwork.html'` and one request from the allowed origin header (`-H 'Origin: https://khairul-gigventure.github.io'`) showing the CORS header.
- [ ] **Step 5: Final check:** `npm test` all green; hand the user the iPhone checklist (open the Pages URL in Safari → Share → Add to Home Screen → paste a web link, an X link, a Threads link, a Facebook post link → Copy / Share / Download) and ask them to report what they see.
