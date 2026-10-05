import test from "node:test";
import assert from "node:assert";
import { validateUrl, fetchLimited } from "../src/guard.js";

const html = (body, init = {}) =>
  new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8" }, ...init });
const U = (s) => new URL(s);

test("validateUrl accepts a normal https URL", () => {
  const r = validateUrl("https://example.com/a?b=1");
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.url.hostname, "example.com");
});

test("validateUrl rejects URLs that reach private or odd hosts", () => {
  const bad = [
    "http://user:pw@example.com/",
    "http://2130706433/",
    "http://0x7f.1/",
    "http://[::1]/",
    "http://localhost./",
    "http://localhost/",
    "http://foo.localhost/",
    "http://printer.local/",
    "http://169.254.169.254/latest/meta-data",
    "http://10.0.0.5/",
    "http://172.16.3.4/",
    "http://192.168.1.1/",
    "http://0.0.0.0/",
    "http://100.64.0.1/",
    "http://[fd00::1]/",
    "http://[fe80::1]/",
    "ftp://example.com/",
    "javascript:alert(1)",
    "https://example.com:8443/",
  ];
  for (const raw of bad) {
    const r = validateUrl(raw);
    assert.deepStrictEqual([raw, r.ok, r.error], [raw, false, "unsupported-url"]);
  }
});

test("validateUrl returns bad-url for unparsable input", () => {
  assert.deepStrictEqual(validateUrl("not a url"), { ok: false, error: "bad-url" });
  assert.deepStrictEqual(validateUrl(""), { ok: false, error: "bad-url" });
});

test("fetchLimited returns text and finalUrl on 200 html", async () => {
  const r = await fetchLimited(U("https://example.com/a"), { fetchImpl: async () => html("<p>hi</p>") });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.text, "<p>hi</p>");
  assert.strictEqual(r.finalUrl, "https://example.com/a");
  assert.match(r.contentType, /text\/html/);
});

test("fetchLimited maps statuses", async () => {
  const st = (status) => fetchLimited(U("https://example.com/"), { fetchImpl: async () => new Response("x", { status }) });
  assert.strictEqual((await st(403)).error, "blocked");
  assert.strictEqual((await st(401)).error, "blocked");
  assert.strictEqual((await st(429)).error, "blocked");
  assert.strictEqual((await st(404)).error, "private-or-missing");
  assert.strictEqual((await st(410)).error, "private-or-missing");
  assert.strictEqual((await st(500)).error, "fetch-failed");
});

test("fetchLimited requires html unless told otherwise", async () => {
  const plain = async () => new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  assert.strictEqual((await fetchLimited(U("https://example.com/"), { fetchImpl: plain })).error, "not-html");
  const r = await fetchLimited(U("https://example.com/"), { fetchImpl: plain, requireHtml: false });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.text, "{}");
});

test("fetchLimited follows a redirect to a public URL and reports finalUrl", async () => {
  let n = 0;
  const impl = async (u) =>
    n++ === 0
      ? new Response(null, { status: 302, headers: { location: "https://www.example.com/final" } })
      : html("ok");
  const r = await fetchLimited(U("https://example.com/"), { fetchImpl: impl });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.finalUrl, "https://www.example.com/final");
});

test("fetchLimited rejects a redirect to a private address", async () => {
  const impl = async () => new Response(null, { status: 302, headers: { location: "http://127.0.0.1/admin" } });
  assert.strictEqual((await fetchLimited(U("https://example.com/"), { fetchImpl: impl })).error, "unsupported-url");
});

test("fetchLimited gives up after 5 redirects", async () => {
  const impl = async () => new Response(null, { status: 302, headers: { location: "https://example.com/again" } });
  assert.strictEqual((await fetchLimited(U("https://example.com/"), { fetchImpl: impl })).error, "fetch-failed");
});

test("fetchLimited stops a streamed body past maxBytes without content-length", async () => {
  const chunk = new Uint8Array(500_000);
  let sent = 0;
  const stream = new ReadableStream({
    pull(c) { if (sent++ < 40) c.enqueue(chunk); else c.close(); },
  });
  const impl = async () => new Response(stream, { status: 200, headers: { "content-type": "text/html" } });
  const r = await fetchLimited(U("https://example.com/"), { fetchImpl: impl });
  assert.strictEqual(r.error, "too-large");
  assert.ok(sent < 40, "should stop reading long before the 20 MB source ends");
});

test("fetchLimited times out when fetch never resolves", async () => {
  const impl = () => new Promise(() => {});
  const r = await fetchLimited(U("https://example.com/"), { fetchImpl: impl, timeoutMs: 50 });
  assert.strictEqual(r.error, "timeout");
});

test("fetchLimited times out when the body stalls", async () => {
  const stream = new ReadableStream({ pull() { return new Promise(() => {}); } });
  const impl = async () => new Response(stream, { status: 200, headers: { "content-type": "text/html" } });
  const r = await fetchLimited(U("https://example.com/"), { fetchImpl: impl, timeoutMs: 50 });
  assert.strictEqual(r.error, "timeout");
});

test("fetchLimited maps a throwing fetch to fetch-failed", async () => {
  const impl = async () => { throw new Error("network down"); };
  assert.strictEqual((await fetchLimited(U("https://example.com/"), { fetchImpl: impl })).error, "fetch-failed");
});

test("validateUrl also rejects reserved IPv4/IPv6 ranges, single-label and .internal hosts", () => {
  const bad = [
    "http://192.0.0.8/", "http://198.18.0.1/", "http://198.19.255.1/", "http://224.0.0.1/",
    "http://240.0.0.1/", "http://255.255.255.255/",
    "http://[::7f00:1]/", "http://[2002:7f00:1::]/", "http://[fec0::1]/", "http://[ff02::1]/",
    "http://[::ffff:127.0.0.1]/", "http://[64:ff9b::7f00:1]/",
    "http://intranet/", "http://metadata.google.internal/", "http://foo.internal/",
  ];
  for (const raw of bad) {
    const r = validateUrl(raw);
    assert.deepStrictEqual([raw, r.ok, r.error], [raw, false, "unsupported-url"]);
  }
});

test("validateUrl still accepts public IPv4, IPv6 and normal hosts", () => {
  for (const raw of ["http://93.184.216.34/", "http://[2606:4700:4700::1111]/", "https://sub.example.co.uk/a", "http://198.20.0.1/"]) {
    assert.strictEqual(validateUrl(raw).ok, true, raw);
  }
});
