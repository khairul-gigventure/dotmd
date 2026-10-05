import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import extract from "../../extract.js";
import { parseDoc, stripNoise } from "../src/dom.js";

const { extractArticle } = extract;
const dir = path.dirname(fileURLToPath(import.meta.url));
const fixture = (n) => fs.readFileSync(path.join(dir, "../../tests/fixtures", n), "utf8");
const URL_ = "https://blog.example.com/post";
const run = (name) =>
  extractArticle(parseDoc(fixture(name), URL_), {
    url: URL_, now: new Date(2026, 9, 5), Readability, TurndownService, gfm,
  });

test("article converts with linkedom DOM", () => {
  const r = run("article.html");
  assert.strictEqual(r.ok, true);
  const md = r.markdown;
  assert.ok(md.includes("## A list"));
  assert.match(md, /^- +First item/m);
  assert.ok(md.includes("> A wise quote"));
  assert.ok(md.includes("```js"));
  assert.ok(md.includes("function hi() {\n  return 1;\n}"));
  assert.match(md, /\| *--- *\|/);
  assert.ok(md.includes("![diagram](https://blog.example.com/img/a.png)"));
  assert.ok(md.includes("(https://blog.example.com/b)"));
  assert.ok(md.includes("author: Aisyah Rahman"));
  assert.ok(!md.includes("NAVNOISE") && !md.includes("FOOTERNOISE"));
});

test("link roundup is an article under linkedom", () => {
  assert.strictEqual(run("roundup.html").ok, true);
});

test("homepage and listing are not articles under linkedom", () => {
  assert.deepStrictEqual(run("homepage.html"), { ok: false, reason: "no-article" });
  assert.deepStrictEqual(run("listing.html"), { ok: false, reason: "no-article" });
});

// Regression: the Worker bundle uses Turndown's *browser* build, which parses HTML strings with the
// global `document` (absent in Workers). extractArticle must hand Turndown a DOM node instead.
test("extractArticle works with Turndown's browser build and no global document", async () => {
  assert.strictEqual(typeof globalThis.document, "undefined");
  const { default: BrowserTurndown } = await import("turndown/lib/turndown.browser.es.js");
  const r = extractArticle(parseDoc(fixture("article.html"), URL_), {
    url: URL_, now: new Date(2026, 9, 5), Readability, TurndownService: BrowserTurndown, gfm,
  });
  assert.strictEqual(r.ok, true);
  assert.ok(r.markdown.includes("## A list"));
});

test("stripNoise removes scripts, styles, svg and comments but keeps JSON-LD", () => {
  const html = `<html><head><style>.a{color:red}</style><script>var BIGSCRIPT=1;</script>
    <script type="application/ld+json">{"author":"Ada"}</script><!-- COMMENT --></head>
    <body><svg><path d="M0"/></svg><noscript><img src="x.jpg"></noscript><p>keep</p></body></html>`;
  const out = stripNoise(html);
  assert.ok(!out.includes("BIGSCRIPT") && !out.includes("color:red") && !out.includes("<svg") && !out.includes("COMMENT"));
  assert.ok(out.includes("application/ld+json") && out.includes('"author":"Ada"'));
  assert.ok(out.includes("<noscript>") && out.includes("<p>keep</p>"));
});
