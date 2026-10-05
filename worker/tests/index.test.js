import test from "node:test";
import assert from "node:assert";
import { pickHandler, createWorker } from "../src/index.js";
import { ERROR_MESSAGES } from "../src/messages.js";

const ENV = { ALLOWED_ORIGIN: "https://khairul-gigventure.github.io,https://other.example" };
const ok = (kind) => async () => ({ ok: true, kind, title: "T", markdown: "# T", words: 1, filename: "t.md" });
const worker = (handlers = {}) =>
  createWorker({
    handlers: { web: ok("web"), x: ok("x"), threads: ok("threads"), facebook: ok("facebook"), ...handlers },
    fetchLimited: async () => ({ ok: false, error: "fetch-failed" }),
    now: () => new Date(2026, 9, 5),
  });
const get = (w, qs, headers = {}, method = "GET", path = "/api/clip") =>
  w.fetch(new Request(`https://worker.test${path}${qs}`, { method, headers }), ENV);
const link = (u) => `?url=${encodeURIComponent(u)}`;

test("pickHandler routes by hostname", () => {
  const p = (s) => pickHandler(new URL(s));
  assert.strictEqual(p("https://x.com/a/status/1"), "x");
  assert.strictEqual(p("https://mobile.twitter.com/a/status/1"), "x");
  assert.strictEqual(p("https://www.threads.com/@a/post/b"), "threads");
  assert.strictEqual(p("https://threads.net/@a/post/b"), "threads");
  assert.strictEqual(p("https://www.facebook.com/x"), "facebook");
  assert.strictEqual(p("https://fb.watch/abc"), "facebook");
  assert.strictEqual(p("https://m.facebook.com/x"), "facebook");
  assert.strictEqual(p("https://example.com"), "web");
});

test("missing url -> 400 bad-url with the Malay message", async () => {
  const res = await get(worker(), "");
  assert.strictEqual(res.status, 400);
  assert.deepStrictEqual(await res.json(), { ok: false, error: "bad-url", message: ERROR_MESSAGES["bad-url"] });
});

test("private URL -> 400 unsupported-url", async () => {
  const res = await get(worker(), link("http://127.0.0.1/"));
  assert.strictEqual(res.status, 400);
  assert.strictEqual((await res.json()).error, "unsupported-url");
});

test("routes to the handler chosen by hostname and returns its JSON", async () => {
  const res = await get(worker(), link("https://x.com/jack/status/20"));
  assert.strictEqual(res.status, 200);
  assert.strictEqual((await res.json()).kind, "x");
  assert.strictEqual(res.headers.get("cache-control"), "no-store");
});

test("handler errors map to status and message", async () => {
  const cases = { blocked: 502, timeout: 504, "too-large": 413, "not-html": 415, "no-article": 422, "private-or-missing": 404, "fetch-failed": 502 };
  for (const [error, status] of Object.entries(cases)) {
    const res = await get(worker({ web: async () => ({ ok: false, error }) }), link("https://example.com/a"));
    assert.strictEqual(res.status, status, error);
    const body = await res.json();
    assert.deepStrictEqual([body.ok, body.error, body.message], [false, error, ERROR_MESSAGES[error]]);
  }
});

test("a throwing handler -> 500 internal", async () => {
  const res = await get(worker({ web: async () => { throw new Error("boom"); } }), link("https://example.com/a"));
  assert.strictEqual(res.status, 500);
  assert.strictEqual((await res.json()).error, "internal");
});

test("CORS header only for allowed origins (and localhost)", async () => {
  const q = link("https://example.com/a");
  const allowed = await get(worker(), q, { origin: "https://khairul-gigventure.github.io" });
  assert.strictEqual(allowed.headers.get("access-control-allow-origin"), "https://khairul-gigventure.github.io");
  assert.match(allowed.headers.get("vary"), /Origin/i);
  const local = await get(worker(), q, { origin: "http://127.0.0.1:8765" });
  assert.strictEqual(local.headers.get("access-control-allow-origin"), "http://127.0.0.1:8765");
  const evil = await get(worker(), q, { origin: "https://evil.example" });
  assert.strictEqual(evil.headers.get("access-control-allow-origin"), null);
  const errAllowed = await get(worker(), "", { origin: "https://khairul-gigventure.github.io" });
  assert.strictEqual(errAllowed.headers.get("access-control-allow-origin"), "https://khairul-gigventure.github.io");
});

test("OPTIONS preflight, wrong method and unknown path", async () => {
  const pre = await get(worker(), "", { origin: "https://khairul-gigventure.github.io" }, "OPTIONS");
  assert.strictEqual(pre.status, 204);
  assert.strictEqual(pre.headers.get("access-control-allow-methods"), "GET, OPTIONS");
  assert.strictEqual(pre.headers.get("access-control-allow-headers"), "content-type");
  assert.strictEqual((await get(worker(), link("https://example.com"), {}, "POST")).status, 405);
  assert.strictEqual((await get(worker(), "", {}, "GET", "/nope")).status, 404);
});
