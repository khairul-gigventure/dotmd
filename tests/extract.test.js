const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const { Readability } = require("@mozilla/readability");
const TurndownService = require("turndown");
const { gfm } = require("turndown-plugin-gfm");
const { extractArticle } = require("../extract.js");

const URL_ = "https://blog.example.com/post";
const NOW = new Date(2026, 9, 4);
const load = (html) => new JSDOM(html, { url: URL_ }).window.document;
const fixture = (name) => fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8");
const run = (html) =>
  extractArticle(load(html), { url: URL_, now: NOW, Readability, TurndownService, gfm });

test("converts an article to markdown with frontmatter and structure", () => {
  const r = run(fixture("article.html"));
  assert.strictEqual(r.ok, true);
  const md = r.markdown;
  assert.ok(md.startsWith("---\ntitle:"), md.slice(0, 80));
  assert.ok(md.includes("source: https://blog.example.com/post"));
  assert.ok(md.includes("clipped: 2026-10-04"));
  assert.ok(md.includes("author: Aisyah Rahman"));
  assert.match(md, /^## A list/m);
  assert.match(md, /^- +First item/m);
  assert.match(md, /^> A wise quote/m);
  assert.ok(md.includes("```js"));
  assert.ok(md.includes("function hi() {\n  return 1;\n}"));
  assert.match(md, /\| *--- *\|/);
  assert.ok(md.includes("![diagram](https://blog.example.com/img/a.png)"));
  assert.ok(md.includes("(https://blog.example.com/b)"));
  assert.ok(!md.includes("NAVNOISE") && !md.includes("FOOTERNOISE"));
  assert.ok(r.filename.endsWith(".md"));
  assert.ok(r.words > 0);
});

test("omits author line (and never writes undefined) when no byline", () => {
  const r = run(fixture("article.html").replace(/<meta name="author"[^>]*>/, ""));
  assert.strictEqual(r.ok, true);
  assert.ok(!r.markdown.includes("author:"));
  assert.ok(!r.markdown.includes("undefined"));
});

test("homepage is not an article", () => {
  assert.deepStrictEqual(run(fixture("homepage.html")), { ok: false, reason: "no-article" });
});

test("empty page is not an article", () => {
  assert.deepStrictEqual(run("<html><body></body></html>"), { ok: false, reason: "no-article" });
});

test("link-heavy listing page is not an article", () => {
  assert.deepStrictEqual(run(fixture("listing.html")), { ok: false, reason: "no-article" });
});

test("link roundup with headings and short paragraphs is still an article", () => {
  const r = run(fixture("roundup.html"));
  assert.strictEqual(r.ok, true);
  assert.ok(r.markdown.includes("### [Headline number 0 about technology]"));
});

test("words counts article text, not markdown syntax", () => {
  const expected = new Readability(load(fixture("article.html")), { keepClasses: true })
    .parse().textContent.split(/\s+/).filter(Boolean).length;
  assert.strictEqual(run(fixture("article.html")).words, expected);
});

// Simulate the browser content-script world: no Node `module`, libs as globals.
const vm = require("node:vm");
const convertSrc = fs.readFileSync(path.join(__dirname, "../src/convert.js"), "utf8");
const extractSrc = fs.readFileSync(path.join(__dirname, "../extract.js"), "utf8");
function browserWorld(extra) {
  const ctx = vm.createContext({ ...extra });
  ctx.globalThis = ctx;
  vm.runInContext(convertSrc, ctx);
  vm.runInContext(extractSrc, ctx);
  return ctx;
}

test("page with element named #require (window.require is a DOM node) does not break injection", () => {
  const ctx = browserWorld({ require: { nodeName: "DIV" } });
  assert.strictEqual(typeof ctx.__dotmdExtract, "function");
});

test("__dotmdExtract returns reason 'error' instead of throwing when conversion crashes", () => {
  const ctx = browserWorld({
    document: { cloneNode() { throw new Error("boom"); } },
    location: { href: "https://x.test/" },
  });
  // vm objects have a different prototype realm, so compare as JSON.
  assert.strictEqual(JSON.stringify(ctx.__dotmdExtract()), '{"ok":false,"reason":"error"}');
});
