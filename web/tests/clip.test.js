import test from "node:test";
import assert from "node:assert";
import { extractUrl, parseQueryUrl, getApiBase, clipEndpoint } from "../clip.js";

test("extractUrl pulls a clean URL out of pasted share text", () => {
  assert.strictEqual(extractUrl("Judul article https://x.com/a/status/1."), "https://x.com/a/status/1");
  assert.strictEqual(extractUrl("(https://example.com/a?b=1)"), "https://example.com/a?b=1");
  assert.strictEqual(extractUrl("tengok ni: https://a.com/x, dan https://b.com/y"), "https://a.com/x");
  assert.strictEqual(extractUrl("tiada link"), null);
  assert.strictEqual(extractUrl(""), null);
});

test("parseQueryUrl reads and cleans ?url=", () => {
  assert.strictEqual(parseQueryUrl("?url=https%3A%2F%2Fexample.com%2Fa"), "https://example.com/a");
  assert.strictEqual(parseQueryUrl("?x=1&url=Tengok%20https%3A%2F%2Fa.com%2F%20ni"), "https://a.com/");
  assert.strictEqual(parseQueryUrl(""), null);
  assert.strictEqual(parseQueryUrl("?url=bukan-link"), null);
});

test("getApiBase prefers the storage override and trims the trailing slash", () => {
  const store = (v) => ({ getItem: () => v });
  assert.strictEqual(getApiBase(store("http://127.0.0.1:8787/"), { API_BASE: "https://w.dev" }), "http://127.0.0.1:8787");
  assert.strictEqual(getApiBase(store(null), { API_BASE: "https://w.dev/" }), "https://w.dev");
  assert.strictEqual(getApiBase(store(""), { API_BASE: "https://w.dev" }), "https://w.dev");
  assert.strictEqual(getApiBase(store(null), { API_BASE: "" }), "");
});

test("clipEndpoint encodes the target URL", () => {
  assert.strictEqual(
    clipEndpoint("https://w.dev/", "https://a.com/?q=1&r=2"),
    "https://w.dev/api/clip?url=https%3A%2F%2Fa.com%2F%3Fq%3D1%26r%3D2"
  );
});
