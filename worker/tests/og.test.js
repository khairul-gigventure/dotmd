import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readOg } from "../src/og.js";
import { parseThreadsUrl, handleThreads } from "../src/handlers/threads.js";
import { handleFacebook, FACEBOOK_NOTE } from "../src/handlers/facebook.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const fx = (n) => fs.readFileSync(path.join(dir, "fixtures", n), "utf8");
const NOW = new Date(2026, 9, 5);
const U = (s) => new URL(s);
const page = (name) => async () => ({ ok: true, text: fx(name), finalUrl: "https://www.threads.com/x", contentType: "text/html" });

test("readOg decodes entities and handles either attribute order", () => {
  const t = readOg(fx("threads-post.html"));
  assert.strictEqual(t.title, "Good conversation with @hubermanlab about AI");
  assert.strictEqual(t.description, "Good conversation with @hubermanlab about AI • it's great");
  assert.strictEqual(t.siteName, "Threads");
  const f = readOg(fx("facebook-post.html"));
  assert.strictEqual(f.title, "Mark Zuckerberg - Every year, I take on a personal... | Facebook");
  assert.ok(f.description.includes("learn new things & grow"));
  assert.deepStrictEqual(readOg("<html></html>"), {});
});

test("parseThreadsUrl handles host and trailing-segment variants", () => {
  for (const s of [
    "https://www.threads.com/@zuck/post/Cywjyrdv9T6",
    "https://www.threads.com/@zuck/post/Cywjyrdv9T6/some-slug?x=1",
    "https://www.threads.net/@zuck/post/Cywjyrdv9T6",
  ]) assert.deepStrictEqual(parseThreadsUrl(U(s)), { handle: "zuck", code: "Cywjyrdv9T6" }, s);
  assert.strictEqual(parseThreadsUrl(U("https://www.threads.com/@zuck")), null);
});

test("handleThreads builds markdown from og tags", async () => {
  const r = await handleThreads(U("https://www.threads.com/@zuck/post/Cywjyrdv9T6"), { fetchLimited: page("threads-post.html"), now: NOW });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.kind, "threads");
  assert.strictEqual(r.title, "@zuck on Threads");
  assert.strictEqual(r.filename, "threads-zuck-Cywjyrdv9T6.md");
  assert.ok(r.markdown.includes('author: "@zuck"'));
  assert.ok(r.markdown.includes("Good conversation with @hubermanlab"));
  assert.ok(r.words > 0);
});

test("handleThreads reports private-or-missing for empty pages and non-post URLs", async () => {
  const empty = await handleThreads(U("https://www.threads.com/@zuck/post/abc"), { fetchLimited: page("threads-empty.html"), now: NOW });
  assert.deepStrictEqual(empty, { ok: false, error: "private-or-missing" });
  const bad = await handleThreads(U("https://www.threads.com/@zuck"), { fetchLimited: page("threads-post.html"), now: NOW });
  assert.deepStrictEqual(bad, { ok: false, error: "unsupported-url" });
});

test("handleFacebook returns truncated text with the exact note", async () => {
  const r = await handleFacebook(U("https://www.facebook.com/zuck/posts/1"), { fetchLimited: page("facebook-post.html"), now: NOW });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.kind, "facebook");
  assert.strictEqual(r.note, "Facebook: teks dipotong (~200 aksara). Post penuh perlu dibuka sendiri.");
  assert.strictEqual(FACEBOOK_NOTE, r.note);
  assert.ok(r.markdown.includes("learn new things & grow"));
  assert.ok(r.filename.startsWith("facebook-") && r.filename.endsWith(".md"));
});

test("handleFacebook reports private-or-missing for login pages", async () => {
  const r = await handleFacebook(U("https://www.facebook.com/zuck/posts/1"), { fetchLimited: page("facebook-login.html"), now: NOW });
  assert.deepStrictEqual(r, { ok: false, error: "private-or-missing" });
});

test("og handlers pass fetch errors through", async () => {
  const bad = async () => ({ ok: false, error: "blocked" });
  assert.deepStrictEqual(await handleThreads(U("https://www.threads.com/@zuck/post/abc"), { fetchLimited: bad, now: NOW }), { ok: false, error: "blocked" });
  assert.deepStrictEqual(await handleFacebook(U("https://www.facebook.com/zuck/posts/1"), { fetchLimited: bad, now: NOW }), { ok: false, error: "blocked" });
});

test("readOg survives invalid numeric entities", () => {
  const html = '<meta property="og:description" content="x &#x110000; &#0; &#xD800; &#99999999999; y">';
  const og = readOg(html);
  assert.ok(og.description.startsWith("x ") && og.description.endsWith(" y"));
  assert.ok(!og.description.includes("&#"));
});

test("handleFacebook rejects login redirects and generic login titles", async () => {
  const mk = (finalUrl, text) => async () => ({ ok: true, text, finalUrl, contentType: "text/html" });
  const goodPost = fx("facebook-post.html");
  const login = await handleFacebook(U("https://www.facebook.com/zuck/posts/1"), { fetchLimited: mk("https://www.facebook.com/login/?next=x", goodPost), now: NOW });
  assert.deepStrictEqual(login, { ok: false, error: "private-or-missing" });
  const home = await handleFacebook(U("https://www.facebook.com/zuck/posts/1"), { fetchLimited: mk("https://www.facebook.com/", goodPost), now: NOW });
  assert.deepStrictEqual(home, { ok: false, error: "private-or-missing" });
  const generic = '<meta property="og:title" content="Facebook \u2013 log in or sign up"><meta property="og:description" content="Log into Facebook to start sharing and connecting.">';
  const g = await handleFacebook(U("https://www.facebook.com/zuck/posts/1"), { fetchLimited: mk("https://www.facebook.com/zuck/posts/1", generic), now: NOW });
  assert.deepStrictEqual(g, { ok: false, error: "private-or-missing" });
});

test("handleThreads does not treat the generic 'Threads' title as a post", async () => {
  const html = '<meta property="og:title" content="Threads"><meta property="og:site_name" content="Threads">';
  const fl = async () => ({ ok: true, text: html, finalUrl: "https://www.threads.com/x", contentType: "text/html" });
  const r = await handleThreads(U("https://www.threads.com/@zuck/post/abc"), { fetchLimited: fl, now: NOW });
  assert.deepStrictEqual(r, { ok: false, error: "private-or-missing" });
});
