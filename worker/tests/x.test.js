import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseXUrl, xToken, handleX } from "../src/handlers/x.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const tweet = fs.readFileSync(path.join(dir, "fixtures/x-tweet.json"), "utf8");
const NOW = new Date(2026, 9, 5);
const U = (s) => new URL(s);

test("parseXUrl finds the status id across URL variants", () => {
  for (const s of [
    "https://x.com/jack/status/20",
    "https://twitter.com/jack/status/20?s=20",
    "https://mobile.twitter.com/jack/status/20",
    "https://www.x.com/jack/status/20/photo/1",
  ]) assert.deepStrictEqual(parseXUrl(U(s)), { handle: "jack", id: "20" }, s);
  assert.deepStrictEqual(parseXUrl(U("https://x.com/i/status/20")), { handle: "i", id: "20" });
});

test("parseXUrl returns null for non-status URLs", () => {
  assert.strictEqual(parseXUrl(U("https://x.com/jack")), null);
  assert.strictEqual(parseXUrl(U("https://x.com/jack/status/abc")), null);
});

test("xToken is a stable base-36 string without zeros or dots", () => {
  const t = xToken("20");
  assert.match(t, /^[a-z1-9]+$/);
  assert.strictEqual(xToken("20"), t);
  assert.notStrictEqual(xToken("1628832338187636740"), t);
});

test("handleX builds markdown from syndication JSON", async () => {
  let requested;
  const fl = async (url, opts) => { requested = { url: String(url), opts }; return { ok: true, text: tweet, finalUrl: String(url), contentType: "application/json" }; };
  const r = await handleX(U("https://x.com/jack/status/20"), { fetchLimited: fl, now: NOW });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.kind, "x");
  assert.strictEqual(r.filename, "x-jack-20.md");
  assert.strictEqual(r.title, "jack (@jack) on X");
  assert.ok(r.markdown.includes('author: "@jack"'));
  assert.ok(r.markdown.includes("source: https://x.com/jack/status/20"));
  assert.ok(r.markdown.includes("just setting up my twttr"));
  assert.ok(r.markdown.includes("![](https://pbs.twimg.com/media/abc.jpg)"));
  assert.ok(!r.markdown.includes("ext_tw_video_thumb"));
  assert.ok(requested.url.startsWith("https://cdn.syndication.twimg.com/tweet-result?id=20&token="));
  assert.strictEqual(requested.opts.requireHtml, false);
  assert.ok(r.words > 0);
});

test("handleX maps tombstones and empty bodies to private-or-missing", async () => {
  const mk = (text) => async () => ({ ok: true, text, finalUrl: "x", contentType: "application/json" });
  for (const text of ['{"__typename":"TweetTombstone"}', ""]) {
    const r = await handleX(U("https://x.com/jack/status/20"), { fetchLimited: mk(text), now: NOW });
    assert.deepStrictEqual(r, { ok: false, error: "private-or-missing" });
  }
});

test("handleX passes fetch errors through and flags garbage and bad URLs", async () => {
  const bad = async () => ({ ok: false, error: "private-or-missing" });
  assert.deepStrictEqual(await handleX(U("https://x.com/jack/status/20"), { fetchLimited: bad, now: NOW }), { ok: false, error: "private-or-missing" });
  const garbage = async () => ({ ok: true, text: "<html>nope</html>", finalUrl: "x", contentType: "text/html" });
  assert.deepStrictEqual(await handleX(U("https://x.com/jack/status/20"), { fetchLimited: garbage, now: NOW }), { ok: false, error: "fetch-failed" });
  assert.deepStrictEqual(await handleX(U("https://x.com/jack"), { fetchLimited: bad, now: NOW }), { ok: false, error: "unsupported-url" });
});
