import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleWeb } from "../src/handlers/web.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const fixture = (n) => fs.readFileSync(path.join(dir, "../../tests/fixtures", n), "utf8");
const NOW = new Date(2026, 9, 5);
const U = new URL("https://blog.example.com/post");
const ok = (name) => async () => ({
  ok: true, text: fixture(name), finalUrl: "https://blog.example.com/post", contentType: "text/html",
});

test("handleWeb converts an article", async () => {
  const r = await handleWeb(U, { fetchLimited: ok("article.html"), now: NOW });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.kind, "web");
  assert.ok(r.markdown.startsWith("---\ntitle:"));
  assert.ok(r.markdown.includes("source: https://blog.example.com/post"));
  assert.ok(r.markdown.includes("clipped: 2026-10-05"));
  assert.ok(r.filename.endsWith(".md"));
  assert.ok(r.words > 0);
});

test("handleWeb uses the final URL after redirects as source", async () => {
  const fl = async () => ({ ok: true, text: fixture("article.html"), finalUrl: "https://blog.example.com/moved", contentType: "text/html" });
  const r = await handleWeb(U, { fetchLimited: fl, now: NOW });
  assert.ok(r.markdown.includes("source: https://blog.example.com/moved"));
});

test("handleWeb reports no-article for a homepage", async () => {
  const r = await handleWeb(U, { fetchLimited: ok("homepage.html"), now: NOW });
  assert.deepStrictEqual(r, { ok: false, error: "no-article" });
});

test("handleWeb passes fetch errors through", async () => {
  const fl = async () => ({ ok: false, error: "blocked" });
  assert.deepStrictEqual(await handleWeb(U, { fetchLimited: fl, now: NOW }), { ok: false, error: "blocked" });
});

test("handleWeb still finds the author from JSON-LD after scripts are stripped", async () => {
  const base = fixture("article.html").replace(/<meta name="author"[^>]*>/, "");
  const html = base.replace("</head>", '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","author":{"@type":"Person","name":"Aisyah Rahman"}}</script><script>var HUGE="' + "x".repeat(5000) + '";</script></head>');
  const fl = async () => ({ ok: true, text: html, finalUrl: "https://blog.example.com/post", contentType: "text/html" });
  const r = await handleWeb(U, { fetchLimited: fl, now: NOW });
  assert.strictEqual(r.ok, true);
  assert.ok(r.markdown.includes("author: Aisyah Rahman"));
  assert.ok(!r.markdown.includes("HUGE"));
});
