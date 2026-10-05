import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "../sw.js"), "utf8");

function load({ fetchImpl }) {
  const listeners = {};
  const store = new Map();
  const key = (req, opts) => { const u = new URL(typeof req === "string" ? req : req.url); return opts?.ignoreSearch ? u.origin + u.pathname : u.href; };
  const caches = {
    async open() {
      return {
        async addAll(reqs) { for (const r of reqs) store.set(key(r.url ?? r), new Response("cached:" + (r.url ?? r))); },
        async put(req, res) { store.set(key(req), res); },
      };
    },
    async match(req, opts) { const hit = store.get(key(req, opts)); return hit ? hit.clone() : undefined; },
    async keys() { return []; },
    async delete() { return true; },
  };
  const self = { location: new URL("https://app.test/dotmd/sw.js"), addEventListener: (n, f) => (listeners[n] = f), skipWaiting() {}, clients: { claim() {} } };
  vm.runInNewContext(src, { self, caches, fetch: fetchImpl, Request, Response, URL, Promise });
  return { listeners, store };
}

const event = (url, method = "GET") => { const e = { request: { url, method }, p: null, respondWith(p) { this.p = p; } }; return e; };

test("shell is network-first, so a new deploy is picked up", async () => {
  const { listeners } = load({ fetchImpl: async () => new Response("fresh") });
  const e = event("https://app.test/dotmd/config.js");
  listeners.fetch(e);
  assert.strictEqual(await (await e.p).text(), "fresh");
});

test("falls back to the cache when offline, ignoring ?url= for navigations", async () => {
  let online = true;
  const { listeners, store } = load({ fetchImpl: async () => { if (!online) throw new Error("offline"); return new Response("page"); } });
  const first = event("https://app.test/dotmd/");
  listeners.fetch(first); await first.p;
  await new Promise((r) => setTimeout(r, 5)); // let the cache.put settle
  online = false;
  const e = event("https://app.test/dotmd/?url=https%3A%2F%2Fa.com");
  listeners.fetch(e);
  assert.strictEqual(await (await e.p).text(), "page");
  assert.ok(store.size >= 1);
});

test("cross-origin and non-GET requests are left alone", () => {
  const { listeners } = load({ fetchImpl: async () => new Response("x") });
  const cross = event("https://worker.example/api/clip?url=x");
  listeners.fetch(cross);
  assert.strictEqual(cross.p, null);
  const post = event("https://app.test/dotmd/", "POST");
  listeners.fetch(post);
  assert.strictEqual(post.p, null);
});
